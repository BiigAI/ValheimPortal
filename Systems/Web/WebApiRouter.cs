using System;
using System.Collections;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net;
using System.Reflection;
using System.Runtime.CompilerServices;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using BepInEx.Bootstrap;
using Bifrostheim.Helpers;
using Bifrostheim.Systems.Discord;
using UnityEngine;

namespace Bifrostheim.Systems.Web
{
    public static class WebApiRouter
    {
        private const int MaxRequestBodySizeBytes = 1024 * 1024; // 1 MB limit to prevent DoS

        private static readonly HashSet<string> _blockedConsoleCommands = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "devcommands",
            "debugmode",
            "god",
            "ghost",
            "dpspath",
            "resetwind",
            "killall",
            "spawn",
            "fly",
            "nocost",
            "raiseskill"
        };

        [MethodImpl(MethodImplOptions.NoInlining | MethodImplOptions.NoOptimization)]
        private static bool ConstantTimeEquals(string? a, string? b)
        {
            if (a == null || b == null)
            {
                return false;
            }

            byte[] aBytes = Encoding.UTF8.GetBytes(a);
            byte[] bBytes = Encoding.UTF8.GetBytes(b);

            // Hash both inputs using SHA256 to normalize length to 32 bytes,
            // preventing both length-based and byte-by-byte timing leakage.
            using (var sha = SHA256.Create())
            {
                byte[] hashA = sha.ComputeHash(aBytes);
                byte[] hashB = sha.ComputeHash(bBytes);

                int diff = 0;
                for (int i = 0; i < hashA.Length; i++)
                {
                    diff |= hashA[i] ^ hashB[i];
                }
                return diff == 0;
            }
        }

        public static bool IsAllowedOrigin(string? origin, HttpListenerRequest request)
        {
            if (string.IsNullOrWhiteSpace(origin))
            {
                return false;
            }

            if (!Uri.TryCreate(origin, UriKind.Absolute, out Uri? originUri) || originUri == null)
            {
                return false;
            }

            // Allow loopback / localhost origins (e.g. Vite dev server or local admin access)
            if (originUri.IsLoopback ||
                string.Equals(originUri.Host, "localhost", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(originUri.Host, "127.0.0.1", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(originUri.Host, "::1", StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }

            // Allow origin matching the server's Host header
            string hostHeader = request.Headers["Host"];
            if (!string.IsNullOrWhiteSpace(hostHeader))
            {
                string expectedHost = hostHeader;
                int colonIdx = expectedHost.IndexOf(':');
                int expectedPort = -1;
                if (colonIdx >= 0)
                {
                    int.TryParse(expectedHost.Substring(colonIdx + 1), out expectedPort);
                    expectedHost = expectedHost.Substring(0, colonIdx);
                }

                if (string.Equals(originUri.Host, expectedHost, StringComparison.OrdinalIgnoreCase))
                {
                    if (expectedPort <= 0 || originUri.Port == expectedPort)
                    {
                        return true;
                    }
                }
            }

            // Allow origin matching server URL host and port
            if (request.Url != null && string.Equals(originUri.Host, request.Url.Host, StringComparison.OrdinalIgnoreCase))
            {
                if (originUri.Port == request.Url.Port)
                {
                    return true;
                }
            }

            return false;
        }

        private static readonly DateTime StartTime = DateTime.UtcNow;
        private static readonly LinkedList<ConsoleLogEntry> LogsBuffer = new LinkedList<ConsoleLogEntry>();
        private static readonly object LogLock = new object();

        // In-memory rate limiting for brute-force prevention only. Never stored to disk, never transmitted.
        private static readonly ConcurrentDictionary<string, (int attempts, DateTime lockoutUntil)> _loginRateLimits =
            new ConcurrentDictionary<string, (int attempts, DateTime lockoutUntil)>(StringComparer.OrdinalIgnoreCase);

        // Ephemeral session tokens with sliding expiration. Never stored to disk, invalidated on restart.
        private static readonly ConcurrentDictionary<string, DateTime> _activeSessions =
            new ConcurrentDictionary<string, DateTime>(StringComparer.Ordinal);

        private static ScheduledRestartState _scheduledRestart = new ScheduledRestartState();
        private static DailyRestartState _dailyRestart = new DailyRestartState();
        private static LifecycleConfigState _lifecycleConfig = new LifecycleConfigState();

        private static readonly object _restartLock = new object();
        private static DateTime _lastLifecycleTick = DateTime.MinValue;
        private static readonly HashSet<int> _restartWarningsSent = new HashSet<int>();
        private static string _lastDailyRestartDate = string.Empty;
        private static bool _isExecutingRestart = false;

        // Staged / Pending Config Changes tracking
        private static readonly List<PendingConfigChange> _pendingChanges = new List<PendingConfigChange>();
        private static readonly object _pendingLock = new object();

        public static void RecordPendingChange(string module, string moduleName)
        {
            lock (_pendingLock)
            {
                _pendingChanges.RemoveAll(c => c.module.Equals(module, StringComparison.OrdinalIgnoreCase));
                _pendingChanges.Add(new PendingConfigChange
                {
                    module = module,
                    moduleName = moduleName,
                    timestamp = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss")
                });
            }
        }

        public static void ClearPendingChanges()
        {
            lock (_pendingLock)
            {
                _pendingChanges.Clear();
            }
        }

        private static readonly List<SkaldDeathRecordDto> _skaldChronicle = new List<SkaldDeathRecordDto>();
        private static readonly object _skaldLock = new object();

        public static void AddLog(string level, string source, string text)
        {
            lock (LogLock)
            {
                LogsBuffer.AddLast(new ConsoleLogEntry
                {
                    time = DateTime.Now.ToString("HH:mm:ss"),
                    source = source,
                    text = text,
                    level = level
                });

                while (LogsBuffer.Count > 300)
                {
                    LogsBuffer.RemoveFirst();
                }
            }
        }

        public static async Task HandleApiRequestAsync(HttpListenerContext context, string path, string clientIp)
        {
            var request = context.Request;
            var response = context.Response;
            string method = request.HttpMethod.ToUpperInvariant();

            response.ContentType = "application/json; charset=utf-8";
            string? origin = request.Headers["Origin"];
            if (!string.IsNullOrEmpty(origin) && IsAllowedOrigin(origin, request))
            {
                response.AddHeader("Access-Control-Allow-Origin", origin);
                response.AddHeader("Vary", "Origin");
            }

            try
            {
                // Auth
                if (path.Equals("/api/auth/login", StringComparison.OrdinalIgnoreCase) && method == "POST")
                {
                    await HandleAuthLogin(request, response, clientIp);
                    return;
                }

                if (path.Equals("/api/auth/verify", StringComparison.OrdinalIgnoreCase) && method == "GET")
                {
                    await HandleAuthVerify(request, response);
                    return;
                }

                if (path.Equals("/api/auth/status", StringComparison.OrdinalIgnoreCase) && method == "GET")
                {
                    await HandleAuthStatus(request, response);
                    return;
                }

                // Enforce authentication for all other API endpoints
                if (!IsAuthorized(request))
                {
                    AddLog("warn", "AUTH", $"Unauthorized {method} request to {path} from {clientIp}.");
                    await SendJsonAsync(response, 401, new { success = false, error = "Unauthorized: Admin password required." });
                    return;
                }

                // Modules
                if (path.Equals("/api/modules/installed", StringComparison.OrdinalIgnoreCase))
                {
                    await HandleGetInstalledModules(response);
                    return;
                }

                // Core Server Telemetry & Status
                if (path.Equals("/api/server/telemetry", StringComparison.OrdinalIgnoreCase))
                {
                    await HandleGetTelemetry(response);
                    return;
                }

                // Players
                if (path.Equals("/api/players", StringComparison.OrdinalIgnoreCase) && method == "GET")
                {
                    await HandleGetPlayers(response);
                    return;
                }

                if (path.Equals("/api/players/kick", StringComparison.OrdinalIgnoreCase) && method == "POST")
                {
                    await HandleKickPlayer(request, response, clientIp);
                    return;
                }

                if (path.Equals("/api/players/ban", StringComparison.OrdinalIgnoreCase) && method == "POST")
                {
                    await HandleBanPlayer(request, response, clientIp);
                    return;
                }

                // Bans
                if (path.Equals("/api/bans", StringComparison.OrdinalIgnoreCase) && method == "GET")
                {
                    await HandleGetBans(response);
                    return;
                }

                if (path.Equals("/api/bans/unban", StringComparison.OrdinalIgnoreCase) && method == "POST")
                {
                    await HandleUnbanPlayer(request, response, clientIp);
                    return;
                }

                if (path.Equals("/api/bans/add", StringComparison.OrdinalIgnoreCase) && method == "POST")
                {
                    await HandleAddBan(request, response, clientIp);
                    return;
                }

                // Console & Logs
                if (path.Equals("/api/console/logs", StringComparison.OrdinalIgnoreCase) && method == "GET")
                {
                    await HandleGetLogs(response);
                    return;
                }

                if (path.Equals("/api/console/exec", StringComparison.OrdinalIgnoreCase) && method == "POST")
                {
                    await HandleExecCommand(request, response, clientIp);
                    return;
                }

                // Server Actions
                if (path.Equals("/api/server/save", StringComparison.OrdinalIgnoreCase) && method == "POST")
                {
                    await HandleForceSave(response, clientIp);
                    return;
                }

                if (path.Equals("/api/server/broadcast", StringComparison.OrdinalIgnoreCase) && method == "POST")
                {
                    await HandleBroadcast(request, response, clientIp);
                    return;
                }

                // Restarts & Lifecycle
                if (path.Equals("/api/server/restart-status", StringComparison.OrdinalIgnoreCase) && method == "GET")
                {
                    await HandleGetRestartStatus(response);
                    return;
                }

                if (path.Equals("/api/server/schedule-restart", StringComparison.OrdinalIgnoreCase) && method == "POST")
                {
                    await HandleScheduleRestart(request, response, clientIp);
                    return;
                }

                if (path.Equals("/api/server/cancel-restart", StringComparison.OrdinalIgnoreCase) && method == "POST")
                {
                    await HandleCancelRestart(response, clientIp);
                    return;
                }

                if (path.Equals("/api/server/daily-restart", StringComparison.OrdinalIgnoreCase) && method == "POST")
                {
                    await HandleUpdateDailyRestart(request, response, clientIp);
                    return;
                }

                if (path.Equals("/api/server/pending-changes", StringComparison.OrdinalIgnoreCase) && method == "GET")
                {
                    await HandleGetPendingChanges(response);
                    return;
                }

                if (path.Equals("/api/server/clear-pending-changes", StringComparison.OrdinalIgnoreCase) && method == "POST")
                {
                    await HandleClearPendingChanges(response, clientIp);
                    return;
                }

                if (path.Equals("/api/server/lifecycle-config", StringComparison.OrdinalIgnoreCase))
                {
                    if (method == "GET")
                    {
                        await HandleGetLifecycleConfig(response);
                    }
                    else if (method == "POST")
                    {
                        await HandleSaveLifecycleConfig(request, response, clientIp);
                    }
                    return;
                }

                // ── Discord Webhook Endpoints ──
                if (path.Equals("/api/discord/config", StringComparison.OrdinalIgnoreCase))
                {
                    if (method == "GET")
                    {
                        await HandleGetDiscordConfig(response);
                    }
                    else if (method == "POST")
                    {
                        await HandleSaveDiscordConfig(request, response, clientIp);
                    }
                    return;
                }

                if (path.Equals("/api/discord/test", StringComparison.OrdinalIgnoreCase) && method == "POST")
                {
                    await HandleTestDiscordWebhook(request, response, clientIp);
                    return;
                }

                // ── CharactersVault Endpoints ──
                if (path.Equals("/api/modules/charactervault/bindings", StringComparison.OrdinalIgnoreCase) && method == "GET")
                {
                    await HandleGetCharacterBindings(response);
                    return;
                }

                if (path.Equals("/api/modules/charactervault/unbind", StringComparison.OrdinalIgnoreCase) && method == "POST")
                {
                    await HandleUnbindCharacter(request, response, clientIp);
                    return;
                }

                if (path.Equals("/api/modules/charactervault/wipe", StringComparison.OrdinalIgnoreCase) && method == "POST")
                {
                    await HandleWipeCharacters(response, clientIp);
                    return;
                }

                // ── Valgrind Endpoints ──
                if (path.Equals("/api/modules/valgrind/config", StringComparison.OrdinalIgnoreCase))
                {
                    if (method == "GET")
                    {
                        await HandleGetValgrindConfig(response);
                    }
                    else if (method == "POST")
                    {
                        await HandleSaveValgrindConfig(request, response, clientIp);
                    }
                    return;
                }

                // ── Dagr & Nott Endpoints ──
                if (path.Equals("/api/modules/dagrnott/config", StringComparison.OrdinalIgnoreCase))
                {
                    if (method == "GET")
                    {
                        await HandleGetDagrNottConfig(response);
                    }
                    else if (method == "POST")
                    {
                        await HandleSaveDagrNottConfig(request, response, clientIp);
                    }
                    return;
                }

                // ── Skald Endpoints ──
                if (path.Equals("/api/modules/skald/config", StringComparison.OrdinalIgnoreCase))
                {
                    if (method == "GET")
                    {
                        await HandleGetSkaldConfig(response);
                    }
                    else if (method == "POST")
                    {
                        await HandleSaveSkaldConfig(request, response, clientIp);
                    }
                    return;
                }

                if (path.Equals("/api/modules/skald/chronicle", StringComparison.OrdinalIgnoreCase) && method == "GET")
                {
                    await HandleGetSkaldChronicle(response);
                    return;
                }

                if (path.Equals("/api/modules/skald/test-death", StringComparison.OrdinalIgnoreCase) && method == "POST")
                {
                    await HandleTestDeathAnnouncement(request, response, clientIp);
                    return;
                }

                // ── Njörðr Endpoints ──
                if (path.Equals("/api/modules/njoror/config", StringComparison.OrdinalIgnoreCase))
                {
                    if (method == "GET")
                    {
                        await HandleGetNjororConfig(response);
                    }
                    else if (method == "POST")
                    {
                        await HandleSaveNjororConfig(request, response, clientIp);
                    }
                    return;
                }

                // ── Other Mods (3rd Party) Endpoints ──
                if (path.Equals("/api/other-mods/list", StringComparison.OrdinalIgnoreCase) && method == "GET")
                {
                    await HandleGetOtherModsList(response);
                    return;
                }

                if (path.Equals("/api/other-mods/config", StringComparison.OrdinalIgnoreCase) && method == "GET")
                {
                    await HandleGetOtherModConfig(request, response);
                    return;
                }

                if (path.Equals("/api/other-mods/config/save", StringComparison.OrdinalIgnoreCase) && method == "POST")
                {
                    await HandleSaveOtherModConfig(request, response, clientIp);
                    return;
                }

                if (path.Equals("/api/other-mods/config/reset-defaults", StringComparison.OrdinalIgnoreCase) && method == "POST")
                {
                    await HandleResetOtherModDefaults(request, response, clientIp);
                    return;
                }

                // Fallback for unknown endpoints
                await SendJsonAsync(response, 404, new { error = $"API endpoint '{path}' not found." });
            }
            catch (InvalidOperationException ex) when (ex.Message.Contains("maximum allowed size"))
            {
                AddLog("warn", "SECURITY", $"Request body size limit exceeded on '{path}' from {clientIp}: {ex.Message}");
                await SendJsonAsync(response, 413, new { error = ex.Message });
            }
            catch (Exception ex)
            {
                BifrostheimPlugin.Log.LogError($"[WebApiRouter] Error handling '{path}': {ex}");
                await SendJsonAsync(response, 500, new { error = ex.Message });
            }
        }

        private static bool HasPlugin(params string[] candidateGuids)
        {
            var keys = Chainloader.PluginInfos.Keys;
            foreach (var candidate in candidateGuids)
            {
                if (keys.Any(k => string.Equals(k, candidate, StringComparison.OrdinalIgnoreCase) ||
                                  k.IndexOf(candidate, StringComparison.OrdinalIgnoreCase) >= 0))
                {
                    return true;
                }
            }
            return false;
        }

        private static string GetConfiguredAdminPassword()
        {
            string pwd = BifrostheimPlugin.WebAdminPassword?.Value ?? WebPortalServer.AdminPassword;
            if (string.IsNullOrWhiteSpace(pwd))
            {
                return string.Empty;
            }
            return pwd;
        }

        public static bool IsAuthorized(HttpListenerRequest request)
        {
            string expectedPassword = GetConfiguredAdminPassword();
            if (string.IsNullOrWhiteSpace(expectedPassword))
            {
                return false;
            }

            if (string.Equals(expectedPassword, "none", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(expectedPassword, "open", StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }

            // Check X-Admin-Password header (for CLI/scripts)
            string? providedPassword = request.Headers["X-Admin-Password"];
            if (!string.IsNullOrEmpty(providedPassword) && ConstantTimeEquals(providedPassword, expectedPassword))
            {
                return true;
            }

            // Check Authorization header (Bearer session token or legacy direct password)
            string? authHeader = request.Headers["Authorization"];
            if (!string.IsNullOrEmpty(authHeader))
            {
                string token = authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)
                    ? authHeader.Substring(7).Trim()
                    : authHeader.Trim();

                if (!string.IsNullOrEmpty(token))
                {
                    // Check active ephemeral session
                    if (_activeSessions.TryGetValue(token, out var expiry))
                    {
                        if (DateTime.UtcNow < expiry)
                        {
                            // Slide expiration (12 hours)
                            _activeSessions[token] = DateTime.UtcNow.AddHours(12);
                            return true;
                        }
                        else
                        {
                            _activeSessions.TryRemove(token, out _);
                        }
                    }

                    // Backward-compatible fallback for direct API password auth
                    if (ConstantTimeEquals(token, expectedPassword))
                    {
                        return true;
                    }
                }
            }

            return false;
        }

        private static async Task HandleAuthVerify(HttpListenerRequest request, HttpListenerResponse response)
        {
            if (IsAuthorized(request))
            {
                await SendJsonAsync(response, 200, new { authenticated = true, message = "Session valid." });
            }
            else
            {
                await SendJsonAsync(response, 401, new { authenticated = false, message = "Unauthorized. Admin password required." });
            }
        }

        private static async Task HandleAuthStatus(HttpListenerRequest request, HttpListenerResponse response)
        {
            string expectedPassword = GetConfiguredAdminPassword();
            bool required = !string.IsNullOrWhiteSpace(expectedPassword) &&
                            !string.Equals(expectedPassword, "none", StringComparison.OrdinalIgnoreCase) &&
                            !string.Equals(expectedPassword, "open", StringComparison.OrdinalIgnoreCase);
            bool authenticated = !required || IsAuthorized(request);

            await SendJsonAsync(response, 200, new { required = required, authenticated = authenticated });
        }

        private static async Task HandleAuthLogin(HttpListenerRequest request, HttpListenerResponse response, string clientIp)
        {
            // Enforce temporary lockout if IP exceeded maximum failed attempts
            if (_loginRateLimits.TryGetValue(clientIp, out var limitState) && DateTime.UtcNow < limitState.lockoutUntil)
            {
                int remainingSec = Math.Max(1, (int)(limitState.lockoutUntil - DateTime.UtcNow).TotalSeconds);
                AddLog("warn", "AUTH", $"Blocked login attempt from locked-out address {clientIp} ({remainingSec}s remaining).");
                await SendJsonAsync(response, 429, new { success = false, message = $"Too many failed attempts. Try again in {remainingSec} seconds." });
                return;
            }

            string body = await ReadBodyAsync(request);
            var req = SimpleJson.DeserializeObject<AuthRequest>(body);
            string providedPassword = req?.password ?? string.Empty;
            string expectedPassword = GetConfiguredAdminPassword();

            if (!string.IsNullOrWhiteSpace(expectedPassword) &&
                (string.Equals(expectedPassword, "none", StringComparison.OrdinalIgnoreCase) ||
                 string.Equals(expectedPassword, "open", StringComparison.OrdinalIgnoreCase)))
            {
                string openToken = Guid.NewGuid().ToString("N");
                _activeSessions[openToken] = DateTime.UtcNow.AddHours(12);
                await SendJsonAsync(response, 200, new { success = true, token = openToken, message = "Authentication successful (open access)." });
                return;
            }

            if (!string.IsNullOrWhiteSpace(expectedPassword) &&
                !string.IsNullOrWhiteSpace(providedPassword) &&
                ConstantTimeEquals(providedPassword, expectedPassword))
            {
                _loginRateLimits.TryRemove(clientIp, out _);
                string sessionToken = Guid.NewGuid().ToString("N");
                _activeSessions[sessionToken] = DateTime.UtcNow.AddHours(12);
                AddLog("info", "AUTH", $"Admin login successful from {clientIp}.");
                await SendJsonAsync(response, 200, new { success = true, token = sessionToken, message = "Authentication successful." });
            }
            else
            {
                int attempts = 1;
                DateTime lockout = DateTime.MinValue;
                if (_loginRateLimits.TryGetValue(clientIp, out var curr))
                {
                    attempts = curr.attempts + 1;
                }

                if (attempts >= 5)
                {
                    lockout = DateTime.UtcNow.AddMinutes(5);
                    AddLog("warn", "AUTH", $"Multiple failed admin login attempts from {clientIp}. Locked out for 5 minutes.");
                }
                else
                {
                    AddLog("warn", "AUTH", $"Failed admin login attempt from {clientIp} (Attempt {attempts}/5).");
                }

                _loginRateLimits[clientIp] = (attempts, lockout);

                // Artificial delay to mitigate automated high-frequency brute-forcing
                await Task.Delay(1000);

                if (attempts >= 5)
                {
                    await SendJsonAsync(response, 429, new { success = false, message = "Too many failed attempts. Locked out for 5 minutes." });
                }
                else
                {
                    await SendJsonAsync(response, 401, new { success = false, message = "Invalid admin password." });
                }
            }
        }

        private static async Task HandleGetInstalledModules(HttpListenerResponse response)
        {
            var installed = new List<string>();

            if (HasPlugin("com.charactervault.valheim", "com.bigai.charactervault", "com.bigai.charactersvault", "charactervault"))
                installed.Add("charvault");

            if (HasPlugin("com.bigai.valgrind", "valgrind"))
                installed.Add("valgrind");

            if (HasPlugin("com.bigai.dagrnott_customdaycycle", "com.bigai.dagrandnott", "com.bigai.dagrnott", "dagrnott_customdaycycle", "dagrandnott", "dagrnott"))
                installed.Add("dagrnott");

            if (HasPlugin("com.bigai.skald_vikingkillfeed", "com.bigai.skald", "skald_vikingkillfeed", "skald"))
                installed.Add("skald");

            if (HasPlugin("com.bigai.njoror_fairwinds", "com.bigai.njoror", "njoror_fairwinds", "njoror"))
                installed.Add("njoror");

            await SendJsonAsync(response, 200, new { installed });
        }

        private static async Task HandleGetTelemetry(HttpListenerResponse response)
        {
            var uptimeSpan = DateTime.UtcNow - StartTime;
            string uptimeStr = $"{(int)uptimeSpan.TotalHours}h {uptimeSpan.Minutes}m {uptimeSpan.Seconds}s";

            int onlineCount = 0;
            int maxPlayers = 10;
            int activeZdos = 0;

            await MainThreadDispatcher.EnqueueAsync(() =>
            {
                if (ZNet.instance != null)
                {
                    onlineCount = ZNet.instance.GetNrOfPlayers();
                    maxPlayers = ZNetHelper.GetServerPlayerLimit();
                }
                if (ZDOMan.instance != null)
                {
                    activeZdos = ZDOMan.instance.NrOfObjects();
                }
            });

            long memoryMb;
            try
            {
                using (var currentProcess = Process.GetCurrentProcess())
                {
                    memoryMb = currentProcess.WorkingSet64 / (1024 * 1024);
                }
            }
            catch (Exception ex)
            {
                BifrostheimPlugin.Log?.LogDebug($"[WebApiRouter] Failed to query OS working set, falling back to GC total memory: {ex.Message}");
                // Fallback to Mono GC heap if OS process memory query fails or is sandboxed
                memoryMb = GC.GetTotalMemory(false) / (1024 * 1024);
            }

            var telemetry = new ServerTelemetryDto
            {
                uptime = uptimeStr,
                uptimeSeconds = (long)uptimeSpan.TotalSeconds,
                onlineCount = onlineCount,
                maxPlayers = maxPlayers,
                fps = BifrostheimPlugin.CurrentFps,
                tickRate = "50 Hz",
                activeZdos = activeZdos,
                memoryMb = (int)memoryMb
            };

            await SendJsonAsync(response, 200, telemetry);
        }

        private static async Task HandleGetPlayers(HttpListenerResponse response)
        {
            var playerList = new List<object>();

            await MainThreadDispatcher.EnqueueAsync(() =>
            {
                if (ZNet.instance != null)
                {
                    int worldDay = ZNetHelper.GetCurrentWorldDay();
                    var peers = ZNetHelper.GetPeers();
                    foreach (var peer in peers)
                    {
                        if (peer == null) continue;
                        string steamId = ZNetHelper.GetPlayerId(peer);
                        string charName = peer.m_playerName ?? "Unknown";
                        int ping = ZNetHelper.GetPeerPing(peer);
                        var pos = peer.m_refPos;
                        string posStr = $"{pos.x:F0}, {pos.y:F0}, {pos.z:F0}";

                        var pData = ZNetHelper.GetPlayerData(peer, worldDay);

                        playerList.Add(new
                        {
                            id = steamId,
                            name = charName,
                            steamId = steamId,
                            ping = $"{ping}ms",
                            pos = posStr,
                            zone = pData.zone,
                            health = (int)Math.Round(pData.health),
                            maxHealth = (int)Math.Round(pData.maxHealth),
                            pvp = pData.pvp,
                            daysSurvived = pData.daysSurvived
                        });
                    }
                }
            });

            await SendJsonAsync(response, 200, playerList);
        }

        private static async Task HandleKickPlayer(HttpListenerRequest request, HttpListenerResponse response, string clientIp)
        {
            string body = await ReadBodyAsync(request);
            var req = SimpleJson.DeserializeObject<KickRequest>(body);
            string name = req?.name?.Trim() ?? string.Empty;

            if (string.IsNullOrWhiteSpace(name))
            {
                await SendJsonAsync(response, 400, new { success = false, message = "Player name is required." });
                return;
            }

            bool kicked = false;
            await MainThreadDispatcher.EnqueueAsync(() =>
            {
                if (ZNet.instance != null)
                {
                    var peers = ZNetHelper.GetPeers();
                    foreach (var peer in peers)
                    {
                        if (peer != null && (peer.m_playerName.Equals(name, StringComparison.OrdinalIgnoreCase) || ZNetHelper.GetPlayerId(peer).Equals(name, StringComparison.OrdinalIgnoreCase)))
                        {
                            ZNet.instance.Disconnect(peer);
                            kicked = true;
                            break;
                        }
                    }
                }
            });

            if (kicked)
            {
                AddLog("warn", "KICK", $"Kicked player '{name}'");
                DiscordWebhookDispatcher.OnAdminAction("Kick", name, "Admin", "");
                await SendJsonAsync(response, 200, new { success = true, message = $"Kicked player '{name}'" });
            }
            else
            {
                await SendJsonAsync(response, 404, new { success = false, message = $"Player '{name}' not found online." });
            }
        }

        private static async Task HandleBanPlayer(HttpListenerRequest request, HttpListenerResponse response, string clientIp)
        {
            string body = await ReadBodyAsync(request);
            var req = SimpleJson.DeserializeObject<BanRequest>(body);
            string name = req?.name?.Trim() ?? string.Empty;
            string reason = req?.reason?.Trim() ?? "Banned by administrator";

            if (string.IsNullOrWhiteSpace(name))
            {
                await SendJsonAsync(response, 400, new { success = false, message = "Player name or ID is required." });
                return;
            }

            bool banExecuted = false;
            bool wasOnlinePeer = false;
            string targetDisplayName = name;

            await MainThreadDispatcher.EnqueueAsync(() =>
            {
                if (ZNet.instance != null)
                {
                    var peers = ZNetHelper.GetPeers();
                    ZNetPeer? targetPeer = null;
                    foreach (var peer in peers)
                    {
                        if (peer != null && (string.Equals(peer.m_playerName, name, StringComparison.OrdinalIgnoreCase) ||
                                             string.Equals(ZNetHelper.GetPlayerId(peer), name, StringComparison.OrdinalIgnoreCase)))
                        {
                            targetPeer = peer;
                            break;
                        }
                    }

                    string networkId = targetPeer != null ? ZNetHelper.GetPlayerId(targetPeer) : string.Empty;

                    // Always ban network/Steam ID if available to close character-rename evasion
                    if (!string.IsNullOrWhiteSpace(networkId))
                    {
                        ZNet.instance.Ban(networkId);
                        banExecuted = true;
                        targetDisplayName = $"{name} ({networkId})";
                    }

                    // Also ban character name if distinct
                    if (!string.Equals(name, networkId, StringComparison.OrdinalIgnoreCase))
                    {
                        ZNet.instance.Ban(name);
                        banExecuted = true;
                    }

                    // Immediately disconnect active connection if online
                    if (targetPeer != null)
                    {
                        wasOnlinePeer = true;
                        ZNet.instance.Disconnect(targetPeer);
                    }
                }
            });

            if (banExecuted)
            {
                string actionDetail = wasOnlinePeer ? $"Banned and disconnected player '{targetDisplayName}'" : $"Added '{targetDisplayName}' to ban list";
                AddLog("warn", "BAN", $"{actionDetail} (Reason: {reason})");
                DiscordWebhookDispatcher.OnAdminAction("Ban", targetDisplayName, "Admin", reason);
                await SendJsonAsync(response, 200, new { success = true, message = $"{actionDetail}." });
            }
            else
            {
                AddLog("warn", "BAN", $"Failed ban attempt for '{name}': Valheim network instance unavailable.");
                await SendJsonAsync(response, 503, new { success = false, message = "Server networking unavailable; unable to register ban." });
            }
        }

        private static async Task HandleGetBans(HttpListenerResponse response)
        {
            var bansList = new List<object>();

            await MainThreadDispatcher.EnqueueAsync(() =>
            {
                if (ZNet.instance != null)
                {
                    foreach (string banned in ZNetHelper.GetBannedList())
                    {
                        bansList.Add(new
                        {
                            id = banned,
                            name = banned,
                            steamId = banned,
                            bannedAt = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm"),
                            reason = "Server ban",
                            bannedBy = "Administrator"
                        });
                    }
                }
            });

            await SendJsonAsync(response, 200, bansList);
        }

        private static async Task HandleUnbanPlayer(HttpListenerRequest request, HttpListenerResponse response, string clientIp)
        {
            string body = await ReadBodyAsync(request);
            var req = SimpleJson.DeserializeObject<UnbanRequest>(body);
            string steamId = req?.steamId?.Trim() ?? string.Empty;

            if (string.IsNullOrWhiteSpace(steamId))
            {
                await SendJsonAsync(response, 400, new { success = false, message = "Steam ID is required." });
                return;
            }

            await MainThreadDispatcher.EnqueueAsync(() =>
            {
                if (ZNet.instance != null)
                {
                    ZNet.instance.Unban(steamId);
                }
            });

            AddLog("info", "UNBAN", $"Unbanned Steam ID '{steamId}'");
            await SendJsonAsync(response, 200, new { success = true, message = $"Unbanned player '{steamId}'" });
        }

        private static async Task HandleAddBan(HttpListenerRequest request, HttpListenerResponse response, string clientIp)
        {
            string body = await ReadBodyAsync(request);
            var req = SimpleJson.DeserializeObject<ManualBanRequest>(body);
            string steamId = req?.steamId?.Trim() ?? string.Empty;

            if (string.IsNullOrWhiteSpace(steamId))
            {
                await SendJsonAsync(response, 400, new { success = false, message = "Steam ID is required." });
                return;
            }

            await MainThreadDispatcher.EnqueueAsync(() =>
            {
                if (ZNet.instance != null)
                {
                    ZNet.instance.Ban(steamId);
                }
            });

            AddLog("warn", "BAN", $"Added ban for '{steamId}' (Reason: {req?.reason})");
            await SendJsonAsync(response, 200, new { success = true, message = $"Banned ID '{steamId}'" });
        }

        private static async Task HandleGetLogs(HttpListenerResponse response)
        {
            List<ConsoleLogEntry> logs;
            lock (LogLock)
            {
                logs = new List<ConsoleLogEntry>(LogsBuffer);
            }
            await SendJsonAsync(response, 200, logs);
        }

        private static async Task HandleExecCommand(HttpListenerRequest request, HttpListenerResponse response, string clientIp)
        {
            string body = await ReadBodyAsync(request);
            var req = SimpleJson.DeserializeObject<ExecCommandRequest>(body);
            string cmd = req?.command?.Trim() ?? string.Empty;

            if (string.IsNullOrWhiteSpace(cmd))
            {
                await SendJsonAsync(response, 400, new { success = false, output = "Command is empty." });
                return;
            }

            // Disallow multi-command injection via newline or carriage return
            if (cmd.IndexOf('\n') >= 0 || cmd.IndexOf('\r') >= 0)
            {
                AddLog("warn", "SECURITY", $"Rejected multi-line console command attempt from {clientIp}.");
                await SendJsonAsync(response, 400, new { success = false, output = "Multi-line commands are not allowed." });
                return;
            }

            string[] parts = cmd.Split(new[] { ' ', '\t' }, StringSplitOptions.RemoveEmptyEntries);
            string baseCmd = parts.Length > 0 ? parts[0] : string.Empty;

            if (_blockedConsoleCommands.Contains(baseCmd))
            {
                AddLog("warn", "SECURITY", $"Blocked restricted console command '{baseCmd}' from {clientIp}.");
                await SendJsonAsync(response, 403, new { success = false, output = $"Command '{baseCmd}' is restricted from remote execution." });
                return;
            }

            AddLog("cmd", "ADMIN", $"> {cmd}");

            bool commandDispatched = false;
            await MainThreadDispatcher.EnqueueAsync(() =>
            {
                if (global::Console.instance != null)
                {
                    global::Console.instance.TryRunCommand(cmd);
                    commandDispatched = true;
                }
                else
                {
                    try
                    {
                        var termInstField = typeof(Terminal).GetField("m_terminalInstance", BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic);
                        var termInst = termInstField?.GetValue(null) as Terminal;
                        if (termInst != null)
                        {
                            termInst.TryRunCommand(cmd);
                            commandDispatched = true;
                        }
                    }
                    catch { }
                }
            });

            if (commandDispatched)
            {
                await SendJsonAsync(response, 200, new { success = true, output = $"Command '{cmd}' dispatched for execution." });
            }
            else
            {
                await SendJsonAsync(response, 503, new { success = false, output = "Server terminal console is not initialized on this instance." });
            }
        }

        private static async Task HandleForceSave(HttpListenerResponse response, string clientIp)
        {
            await MainThreadDispatcher.EnqueueAsync(() =>
            {
                if (ZNet.instance != null)
                {
                    ZNet.instance.Save(true);
                }
            });

            AddLog("info", "SAVE", "World save triggered by administrator.");
            await SendJsonAsync(response, 200, new { success = true, message = "World save triggered successfully." });
        }

        private static async Task HandleBroadcast(HttpListenerRequest request, HttpListenerResponse response, string clientIp)
        {
            string body = await ReadBodyAsync(request);
            var req = SimpleJson.DeserializeObject<BroadcastRequest>(body);
            string message = req?.message?.Trim() ?? string.Empty;

            if (string.IsNullOrWhiteSpace(message))
            {
                await SendJsonAsync(response, 400, new { success = false, message = "Message is empty." });
                return;
            }

            try
            {
                await MainThreadDispatcher.EnqueueAsync(() =>
                {
                    ZNetHelper.BroadcastServerMessage(message);
                });

                AddLog("info", "BROADCAST", $"Broadcast: '{message}'");
                await SendJsonAsync(response, 200, new { success = true, message = "Broadcast sent." });
            }
            catch (Exception ex)
            {
                BifrostheimPlugin.Log.LogError($"[WebApiRouter] Broadcast error: {ex}");
                AddLog("error", "BROADCAST", $"Broadcast error: {ex.Message}");
                await SendJsonAsync(response, 200, new { success = false, message = $"Broadcast attempted: {ex.Message}" });
            }
        }

        private static async Task HandleGetRestartStatus(HttpListenerResponse response)
        {
            List<PendingConfigChange> pendingCopy;
            lock (_pendingLock)
            {
                pendingCopy = _pendingChanges.ToList();
            }

            ScheduledRestartState scheduledCopy;
            DailyRestartState dailyCopy;
            lock (_restartLock)
            {
                scheduledCopy = new ScheduledRestartState
                {
                    active = _scheduledRestart.active,
                    minutes = _scheduledRestart.minutes,
                    totalMinutes = _scheduledRestart.totalMinutes,
                    targetTimestamp = _scheduledRestart.targetTimestamp,
                    reason = _scheduledRestart.reason
                };
                dailyCopy = new DailyRestartState
                {
                    enabled = _dailyRestart.enabled,
                    time = _dailyRestart.time
                };
            }

            bool dailyEnabled = BifrostheimPlugin.DailyRestartEnabled?.Value ?? dailyCopy.enabled;
            string dailyTime = BifrostheimPlugin.DailyRestartTime?.Value ?? dailyCopy.time;
            string lifeMode = BifrostheimPlugin.LifecycleRestartMode?.Value ?? _lifecycleConfig.mode;
            string lifeScript = BifrostheimPlugin.LifecycleScriptPath?.Value ?? _lifecycleConfig.scriptPath;

            var res = new
            {
                scheduledRestart = scheduledCopy.active ? new
                {
                    active = true,
                    targetTimestamp = scheduledCopy.targetTimestamp,
                    totalMinutes = scheduledCopy.totalMinutes,
                    remainingSeconds = Math.Max(0, (int)((scheduledCopy.targetTimestamp - DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()) / 1000)),
                    reason = scheduledCopy.reason
                } : null,
                dailyRestart = new
                {
                    enabled = dailyEnabled,
                    time = dailyTime
                },
                lifecycleConfig = new
                {
                    mode = lifeMode,
                    scriptPath = lifeScript
                },
                pendingChanges = pendingCopy
            };

            await SendJsonAsync(response, 200, res);
        }

        private static async Task HandleGetPendingChanges(HttpListenerResponse response)
        {
            List<PendingConfigChange> pendingCopy;
            lock (_pendingLock)
            {
                pendingCopy = _pendingChanges.ToList();
            }
            await SendJsonAsync(response, 200, new { success = true, pendingChanges = pendingCopy });
        }

        private static async Task HandleClearPendingChanges(HttpListenerResponse response, string clientIp)
        {
            ClearPendingChanges();
            AddLog("info", "RESTART", "Cleared pending restart notifications list.");
            await SendJsonAsync(response, 200, new { success = true, message = "Pending changes cleared." });
        }

        private static async Task HandleScheduleRestart(HttpListenerRequest request, HttpListenerResponse response, string clientIp)
        {
            string body = await ReadBodyAsync(request);
            var req = SimpleJson.DeserializeObject<ScheduleRestartRequest>(body);
            int minutes = req?.minutes ?? 5;
            string reason = req?.reason ?? "Scheduled maintenance";

            long targetTimestamp = DateTimeOffset.UtcNow.AddMinutes(minutes).ToUnixTimeMilliseconds();
            lock (_restartLock)
            {
                _scheduledRestart = new ScheduledRestartState
                {
                    active = true,
                    minutes = minutes,
                    totalMinutes = minutes,
                    targetTimestamp = targetTimestamp,
                    reason = reason
                };
                _restartWarningsSent.Clear();
                int[] warningMarks = new int[] { 900, 600, 300, 120, 60, 30, 10 };
                int totalSec = minutes * 60;
                foreach (int mark in warningMarks)
                {
                    if (mark >= totalSec) _restartWarningsSent.Add(mark);
                }
                _isExecutingRestart = false;
            }

            AddLog("warn", "RESTART", $"Server restart scheduled in {minutes} minutes (Reason: {reason})");
            
            await MainThreadDispatcher.EnqueueAsync(() =>
            {
                ZNetHelper.BroadcastServerMessage($"⚠️ SERVER RESTART scheduled in {minutes} minute{(minutes > 1 ? "s" : "")}! Reason: {reason}.");
            });

            await SendJsonAsync(response, 200, new { success = true, message = $"Restart scheduled in {minutes} minutes.", targetTimestamp });
        }

        private static async Task HandleCancelRestart(HttpListenerResponse response, string clientIp)
        {
            lock (_restartLock)
            {
                _scheduledRestart = new ScheduledRestartState();
                _restartWarningsSent.Clear();
                _isExecutingRestart = false;
            }

            AddLog("info", "RESTART", "Scheduled server restart cancelled.");

            await MainThreadDispatcher.EnqueueAsync(() =>
            {
                ZNetHelper.BroadcastServerMessage("ℹ️ The scheduled server restart has been CANCELLED by an administrator.");
            });

            await SendJsonAsync(response, 200, new { success = true, message = "Scheduled restart cancelled." });
        }

        private static async Task HandleUpdateDailyRestart(HttpListenerRequest request, HttpListenerResponse response, string clientIp)
        {
            string body = await ReadBodyAsync(request);
            var req = SimpleJson.DeserializeObject<DailyRestartRequest>(body);
            lock (_restartLock)
            {
                _dailyRestart = new DailyRestartState
                {
                    enabled = req?.enabled ?? false,
                    time = req?.time ?? "04:00"
                };
            }

            if (BifrostheimPlugin.DailyRestartEnabled != null)
                BifrostheimPlugin.DailyRestartEnabled.Value = _dailyRestart.enabled;
            if (BifrostheimPlugin.DailyRestartTime != null)
                BifrostheimPlugin.DailyRestartTime.Value = _dailyRestart.time;
            try
            {
                BifrostheimPlugin.Instance?.Config?.Save();
            }
            catch (Exception ex)
            {
                BifrostheimPlugin.Log?.LogWarning($"[WebApiRouter] Failed to save daily restart config to disk: {ex.Message}");
            }

            AddLog("info", "RESTART", $"Updated daily restart: {(_dailyRestart.enabled ? $"Enabled at {_dailyRestart.time}" : "Disabled")} (Saved to config).");
            await SendJsonAsync(response, 200, new { success = true, dailyRestart = _dailyRestart });
        }

        private static async Task HandleGetLifecycleConfig(HttpListenerResponse response)
        {
            var config = new LifecycleConfigState
            {
                mode = BifrostheimPlugin.LifecycleRestartMode?.Value ?? _lifecycleConfig.mode,
                scriptPath = BifrostheimPlugin.LifecycleScriptPath?.Value ?? _lifecycleConfig.scriptPath
            };
            await SendJsonAsync(response, 200, config);
        }

        private static async Task HandleSaveLifecycleConfig(HttpListenerRequest request, HttpListenerResponse response, string clientIp)
        {
            string body = await ReadBodyAsync(request);
            var req = SimpleJson.DeserializeObject<LifecycleConfigState>(body);
            if (req != null && !string.IsNullOrWhiteSpace(req.mode))
            {
                string safeMode = req.mode.Equals("SpawnProcess", StringComparison.OrdinalIgnoreCase) ? "SpawnProcess" : "ExitOnly";
                _lifecycleConfig.mode = safeMode;
                if (BifrostheimPlugin.LifecycleRestartMode != null)
                {
                    BifrostheimPlugin.LifecycleRestartMode.Value = safeMode;
                }
                try
                {
                    BifrostheimPlugin.Instance?.Config?.Save();
                }
                catch (Exception ex)
                {
                    BifrostheimPlugin.Log?.LogWarning($"[WebApiRouter] Failed to save lifecycle config to disk: {ex.Message}");
                }
            }

            var saved = new LifecycleConfigState
            {
                mode = BifrostheimPlugin.LifecycleRestartMode?.Value ?? _lifecycleConfig.mode,
                scriptPath = BifrostheimPlugin.LifecycleScriptPath?.Value ?? _lifecycleConfig.scriptPath
            };
            AddLog("info", "RESTART", $"Updated restart strategy: {saved.mode} (Saved to config). Custom scriptPath is managed locally on host.");
            await SendJsonAsync(response, 200, new { success = true, lifecycleConfig = saved });
        }

        private static string MaskWebhookUrl(string? url)
        {
            if (string.IsNullOrWhiteSpace(url)) return string.Empty;
            string trimmed = url!.Trim();
            if (trimmed.Length <= 12) return new string('*', trimmed.Length);

            int lastSlash = trimmed.LastIndexOf('/');
            if (lastSlash > 0 && lastSlash < trimmed.Length - 4)
            {
                string prefix = trimmed.Substring(0, lastSlash + 1);
                string token = trimmed.Substring(lastSlash + 1);
                if (token.Length > 8)
                {
                    return prefix + new string('*', 8) + token.Substring(token.Length - 4);
                }
                return prefix + new string('*', token.Length);
            }

            return trimmed.Substring(0, 8) + "********" + trimmed.Substring(trimmed.Length - 4);
        }

        private static bool IsMaskedUrl(string? url)
        {
            return url != null && url.Contains("****");
        }

        private static async Task HandleGetDiscordConfig(HttpListenerResponse response)
        {
            var config = new DiscordConfigDto
            {
                enabled = BifrostheimPlugin.DiscordEnabled?.Value ?? false,
                webhookUrl = MaskWebhookUrl(BifrostheimPlugin.DiscordWebhookUrl?.Value),
                overrideChatWebhookUrl = MaskWebhookUrl(BifrostheimPlugin.DiscordOverrideChatWebhookUrl?.Value),
                overrideAdminWebhookUrl = MaskWebhookUrl(BifrostheimPlugin.DiscordOverrideAdminWebhookUrl?.Value),
                botUsername = BifrostheimPlugin.DiscordBotUsername?.Value ?? "Bifrostheim Herald",
                botAvatarUrl = BifrostheimPlugin.DiscordBotAvatarUrl?.Value ?? "",
                useRichEmbeds = BifrostheimPlugin.DiscordUseRichEmbeds?.Value ?? true,
                notifyPlayerJoin = BifrostheimPlugin.DiscordNotifyPlayerJoin?.Value ?? true,
                notifyPlayerLeave = BifrostheimPlugin.DiscordNotifyPlayerLeave?.Value ?? true,
                notifyPlayerDeath = BifrostheimPlugin.DiscordNotifyPlayerDeath?.Value ?? true,
                notifyServerLifecycle = BifrostheimPlugin.DiscordNotifyServerLifecycle?.Value ?? true,
                notifyWorldEvents = BifrostheimPlugin.DiscordNotifyWorldEvents?.Value ?? true,
                notifyBossMilestones = BifrostheimPlugin.DiscordNotifyBossMilestones?.Value ?? true,
                notifyAdminActions = BifrostheimPlugin.DiscordNotifyAdminActions?.Value ?? true,
                notifyChatShouts = BifrostheimPlugin.DiscordNotifyChatShouts?.Value ?? false
            };
            await SendJsonAsync(response, 200, config);
        }

        private static async Task HandleSaveDiscordConfig(HttpListenerRequest request, HttpListenerResponse response, string clientIp)
        {
            string body = await ReadBodyAsync(request);
            var req = SimpleJson.DeserializeObject<DiscordConfigDto>(body);
            if (req != null)
            {
                if (!string.IsNullOrWhiteSpace(req.webhookUrl) && !IsMaskedUrl(req.webhookUrl) && !DiscordWebhookDispatcher.IsValidDiscordWebhookUrl(req.webhookUrl))
                {
                    await SendJsonAsync(response, 400, new { success = false, message = "Primary Discord Webhook URL is invalid. Must use HTTPS and point to an official Discord webhook endpoint." });
                    return;
                }
                if (!string.IsNullOrWhiteSpace(req.overrideChatWebhookUrl) && !IsMaskedUrl(req.overrideChatWebhookUrl) && !DiscordWebhookDispatcher.IsValidDiscordWebhookUrl(req.overrideChatWebhookUrl))
                {
                    await SendJsonAsync(response, 400, new { success = false, message = "Chat Override Discord Webhook URL is invalid. Must use HTTPS and point to an official Discord webhook endpoint." });
                    return;
                }
                if (!string.IsNullOrWhiteSpace(req.overrideAdminWebhookUrl) && !IsMaskedUrl(req.overrideAdminWebhookUrl) && !DiscordWebhookDispatcher.IsValidDiscordWebhookUrl(req.overrideAdminWebhookUrl))
                {
                    await SendJsonAsync(response, 400, new { success = false, message = "Admin Override Discord Webhook URL is invalid. Must use HTTPS and point to an official Discord webhook endpoint." });
                    return;
                }

                if (BifrostheimPlugin.DiscordEnabled != null) BifrostheimPlugin.DiscordEnabled.Value = req.enabled;
                if (BifrostheimPlugin.DiscordWebhookUrl != null && !IsMaskedUrl(req.webhookUrl))
                    BifrostheimPlugin.DiscordWebhookUrl.Value = req.webhookUrl?.Trim() ?? "";
                if (BifrostheimPlugin.DiscordOverrideChatWebhookUrl != null && !IsMaskedUrl(req.overrideChatWebhookUrl))
                    BifrostheimPlugin.DiscordOverrideChatWebhookUrl.Value = req.overrideChatWebhookUrl?.Trim() ?? "";
                if (BifrostheimPlugin.DiscordOverrideAdminWebhookUrl != null && !IsMaskedUrl(req.overrideAdminWebhookUrl))
                    BifrostheimPlugin.DiscordOverrideAdminWebhookUrl.Value = req.overrideAdminWebhookUrl?.Trim() ?? "";
                if (BifrostheimPlugin.DiscordBotUsername != null) BifrostheimPlugin.DiscordBotUsername.Value = string.IsNullOrWhiteSpace(req.botUsername) ? "Bifrostheim Herald" : req.botUsername.Trim();
                if (BifrostheimPlugin.DiscordBotAvatarUrl != null) BifrostheimPlugin.DiscordBotAvatarUrl.Value = req.botAvatarUrl?.Trim() ?? "";
                if (BifrostheimPlugin.DiscordUseRichEmbeds != null) BifrostheimPlugin.DiscordUseRichEmbeds.Value = req.useRichEmbeds;
                if (BifrostheimPlugin.DiscordNotifyPlayerJoin != null) BifrostheimPlugin.DiscordNotifyPlayerJoin.Value = req.notifyPlayerJoin;
                if (BifrostheimPlugin.DiscordNotifyPlayerLeave != null) BifrostheimPlugin.DiscordNotifyPlayerLeave.Value = req.notifyPlayerLeave;
                if (BifrostheimPlugin.DiscordNotifyPlayerDeath != null) BifrostheimPlugin.DiscordNotifyPlayerDeath.Value = req.notifyPlayerDeath;
                if (BifrostheimPlugin.DiscordNotifyServerLifecycle != null) BifrostheimPlugin.DiscordNotifyServerLifecycle.Value = req.notifyServerLifecycle;
                if (BifrostheimPlugin.DiscordNotifyWorldEvents != null) BifrostheimPlugin.DiscordNotifyWorldEvents.Value = req.notifyWorldEvents;
                if (BifrostheimPlugin.DiscordNotifyBossMilestones != null) BifrostheimPlugin.DiscordNotifyBossMilestones.Value = req.notifyBossMilestones;
                if (BifrostheimPlugin.DiscordNotifyAdminActions != null) BifrostheimPlugin.DiscordNotifyAdminActions.Value = req.notifyAdminActions;
                if (BifrostheimPlugin.DiscordNotifyChatShouts != null) BifrostheimPlugin.DiscordNotifyChatShouts.Value = req.notifyChatShouts;

                try
                {
                    BifrostheimPlugin.Instance?.Config?.Save();
                }
                catch (Exception ex)
                {
                    BifrostheimPlugin.Log?.LogWarning($"[WebApiRouter] Failed to save Discord config to disk: {ex.Message}");
                }

                AddLog("info", "DISCORD", "Updated Discord webhook configuration (Saved to disk).");
            }

            var saved = new DiscordConfigDto
            {
                enabled = BifrostheimPlugin.DiscordEnabled?.Value ?? false,
                webhookUrl = MaskWebhookUrl(BifrostheimPlugin.DiscordWebhookUrl?.Value),
                overrideChatWebhookUrl = MaskWebhookUrl(BifrostheimPlugin.DiscordOverrideChatWebhookUrl?.Value),
                overrideAdminWebhookUrl = MaskWebhookUrl(BifrostheimPlugin.DiscordOverrideAdminWebhookUrl?.Value),
                botUsername = BifrostheimPlugin.DiscordBotUsername?.Value ?? "Bifrostheim Herald",
                botAvatarUrl = BifrostheimPlugin.DiscordBotAvatarUrl?.Value ?? "",
                useRichEmbeds = BifrostheimPlugin.DiscordUseRichEmbeds?.Value ?? true,
                notifyPlayerJoin = BifrostheimPlugin.DiscordNotifyPlayerJoin?.Value ?? true,
                notifyPlayerLeave = BifrostheimPlugin.DiscordNotifyPlayerLeave?.Value ?? true,
                notifyPlayerDeath = BifrostheimPlugin.DiscordNotifyPlayerDeath?.Value ?? true,
                notifyServerLifecycle = BifrostheimPlugin.DiscordNotifyServerLifecycle?.Value ?? true,
                notifyWorldEvents = BifrostheimPlugin.DiscordNotifyWorldEvents?.Value ?? true,
                notifyBossMilestones = BifrostheimPlugin.DiscordNotifyBossMilestones?.Value ?? true,
                notifyAdminActions = BifrostheimPlugin.DiscordNotifyAdminActions?.Value ?? true,
                notifyChatShouts = BifrostheimPlugin.DiscordNotifyChatShouts?.Value ?? false
            };

            await SendJsonAsync(response, 200, new { success = true, config = saved });
        }

        private static async Task HandleTestDiscordWebhook(HttpListenerRequest request, HttpListenerResponse response, string clientIp)
        {
            string body = await ReadBodyAsync(request);
            var req = SimpleJson.DeserializeObject<DiscordTestRequestDto>(body);
            string eventType = !string.IsNullOrWhiteSpace(req?.eventType) ? req!.eventType!.Trim() : "server_online";
            string? explicitUrl = !string.IsNullOrWhiteSpace(req?.webhookUrl) ? req!.webhookUrl!.Trim() : null;
            if (IsMaskedUrl(explicitUrl))
            {
                explicitUrl = null;
            }

            if (!string.IsNullOrWhiteSpace(explicitUrl) && !DiscordWebhookDispatcher.IsValidDiscordWebhookUrl(explicitUrl))
            {
                await SendJsonAsync(response, 400, new { success = false, message = "Invalid Discord Webhook URL. URL must use HTTPS and point to an official Discord webhook endpoint." });
                return;
            }

            var (success, message) = await DiscordWebhookDispatcher.SendImmediateTestAsync(eventType, explicitUrl);
            AddLog(success ? "info" : "warn", "DISCORD", $"Test webhook '{eventType}': {message}");
            await SendJsonAsync(response, success ? 200 : 400, new { success, message, eventType });
        }

        public static void TickLifecycle()
        {
            if ((DateTime.UtcNow - _lastLifecycleTick).TotalSeconds < 1.0)
                return;
            _lastLifecycleTick = DateTime.UtcNow;

            try
            {
                // 1. Scheduled Restart Countdown & Execution
                bool shouldExecuteRestart = false;
                List<(int mark, string timeText, string reason)> warningsToBroadcast = new List<(int, string, string)>();

                lock (_restartLock)
                {
                    if (_scheduledRestart != null && _scheduledRestart.active && !_isExecutingRestart)
                    {
                        long nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                        int remainingSec = Math.Max(0, (int)((_scheduledRestart.targetTimestamp - nowMs) / 1000));

                        // In-game warning intervals: 15m, 10m, 5m, 2m, 1m, 30s, 10s
                        int[] warningMarks = new int[] { 900, 600, 300, 120, 60, 30, 10 };
                        foreach (int mark in warningMarks)
                        {
                            if (remainingSec <= mark && !_restartWarningsSent.Contains(mark))
                            {
                                _restartWarningsSent.Add(mark);
                                string timeText = mark >= 60 ? $"{mark / 60} minute{(mark / 60 > 1 ? "s" : "")}" : $"{mark} seconds";
                                warningsToBroadcast.Add((mark, timeText, _scheduledRestart.reason));
                            }
                        }

                        if (remainingSec <= 0)
                        {
                            _isExecutingRestart = true;
                            shouldExecuteRestart = true;
                        }
                    }

                    // 2. Automated Daily Restart Trigger
                    bool dailyEnabled = BifrostheimPlugin.DailyRestartEnabled?.Value ?? _dailyRestart.enabled;
                    string dailyTime = BifrostheimPlugin.DailyRestartTime?.Value ?? _dailyRestart.time;

                    if (dailyEnabled && !string.IsNullOrWhiteSpace(dailyTime) && (_scheduledRestart == null || !_scheduledRestart.active))
                    {
                        string today = DateTime.Now.ToString("yyyy-MM-dd");
                        string currentHhMm = DateTime.Now.ToString("HH:mm");
                        if (currentHhMm == dailyTime && _lastDailyRestartDate != today)
                        {
                            _lastDailyRestartDate = today;
                            int minutes = 5;
                            long target = DateTimeOffset.UtcNow.AddMinutes(minutes).ToUnixTimeMilliseconds();
                            _scheduledRestart = new ScheduledRestartState
                            {
                                active = true,
                                minutes = minutes,
                                totalMinutes = minutes,
                                targetTimestamp = target,
                                reason = "Automated daily maintenance"
                            };
                            _restartWarningsSent.Clear();
                            warningsToBroadcast.Add((-1, $"{minutes} minutes", "Automated daily maintenance"));
                        }
                    }
                }

                // Broadcast warnings outside the lock to avoid holding the lock during RPC/Discord calls
                foreach (var warning in warningsToBroadcast)
                {
                    if (warning.mark == -1)
                    {
                        AddLog("warn", "RESTART", $"Daily restart triggered automatically for {warning.timeText} countdown.");
                        ZNetHelper.BroadcastServerMessage($"⚠️ AUTOMATED DAILY RESTART scheduled in {warning.timeText}. World will be saved.");
                    }
                    else
                    {
                        string shout = $"⚠️ SERVER RESTART in {warning.timeText}! Reason: {warning.reason}. Please find shelter.";
                        ZNetHelper.BroadcastServerMessage(shout);
                        AddLog("warn", "RESTART", $"Broadcast in-game warning: {warning.timeText} remaining.");

                        if (warning.mark == 600 || warning.mark == 300 || warning.mark == 60)
                        {
                            DiscordWebhookDispatcher.OnServerLifecycle("⏳ Scheduled Server Restart Warning", $"Server restarting in {warning.timeText}! Reason: {warning.reason}. Find shelter!", DiscordWebhookDispatcher.ColorOrange, true);
                        }
                    }
                }

                // Prune expired sessions and rate-limit lockouts once per minute (m-2)
                if (DateTime.UtcNow.Second == 0)
                {
                    var expiredSessions = _activeSessions.Where(kvp => kvp.Value < DateTime.UtcNow).Select(kvp => kvp.Key).ToList();
                    foreach (var token in expiredSessions) _activeSessions.TryRemove(token, out _);

                    var expiredLimits = _loginRateLimits.Where(kvp => DateTime.UtcNow >= kvp.Value.lockoutUntil && kvp.Value.lockoutUntil != DateTime.MinValue).Select(kvp => kvp.Key).ToList();
                    foreach (var ip in expiredLimits) _loginRateLimits.TryRemove(ip, out _);
                }

                if (shouldExecuteRestart)
                {
                    ExecuteServerRestartSequence();
                }
            }
            catch (Exception ex)
            {
                BifrostheimPlugin.Log?.LogError($"[WebApiRouter] Lifecycle tick error: {ex.Message}");
            }
        }

        private static void ExecuteServerRestartSequence()
        {
            AddLog("warn", "RESTART", "Executing server restart sequence: saving world and terminating process...");
            ZNetHelper.BroadcastServerMessage("⚠️ [SERVER RESTART] Server is restarting NOW. World saving...");
            DiscordWebhookDispatcher.OnServerLifecycle("🛑 Server Restarting Now", "Server restart initiated. The world is being saved and the server is restarting.", DiscordWebhookDispatcher.ColorRed);

            Task.Run(async () =>
            {
                try
                {
                    // 1. Force world save and cleanly disconnect peers on Unity thread
                    await MainThreadDispatcher.EnqueueAsync(() =>
                    {
                        try
                        {
                            if (ZNet.instance != null)
                            {
                                ZNet.instance.Save(true);
                                BifrostheimPlugin.Log?.LogInfo("[WebApiRouter] World save completed before restart.");

                                var peers = ZNetHelper.GetPeers();
                                foreach (var peer in peers)
                                {
                                    try { ZNet.instance.Disconnect(peer); } catch { }
                                }
                            }
                        }
                        catch (Exception ex)
                        {
                            BifrostheimPlugin.Log?.LogError($"[WebApiRouter] Error saving world before restart: {ex.Message}");
                        }
                    });

                    ClearPendingChanges();
                    // Stop WebPortalServer listener cleanly so it doesn't hold ports or threads
                    WebPortalServer.Stop();

                    // Flush pending Discord notifications before shutting down dispatcher (M-2)
                    DiscordWebhookDispatcher.Shutdown(drainFirst: true);

                    string lifeMode = BifrostheimPlugin.LifecycleRestartMode?.Value ?? _lifecycleConfig.mode;
                    string lifeScript = BifrostheimPlugin.LifecycleScriptPath?.Value ?? _lifecycleConfig.scriptPath;

                    // 2. Lifecycle mode: SpawnProcess if configured
                    if (lifeMode.Equals("SpawnProcess", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrWhiteSpace(lifeScript))
                    {
                        try
                        {
                            if (File.Exists(lifeScript))
                            {
                                BifrostheimPlugin.Log?.LogInfo($"[WebApiRouter] Spawning external restart process: '{lifeScript}'");
                                using var proc = System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
                                {
                                    FileName = lifeScript,
                                    UseShellExecute = false
                                });
                            }
                            else
                            {
                                BifrostheimPlugin.Log?.LogWarning($"[WebApiRouter] Configured restart script '{lifeScript}' does not exist on disk. Skipping spawn.");
                            }
                        }
                        catch (Exception pEx)
                        {
                            BifrostheimPlugin.Log?.LogError($"[WebApiRouter] Failed to spawn external restart script: {pEx.Message}");
                        }
                    }

                    // 3. For Docker containers (e.g. lloesche/valheim-server):
                    // Only attempt supervisorctl if verified to be inside a container (C-2)
                    bool isDockerContainer = File.Exists("/.dockerenv") ||
                        (File.Exists("/proc/1/cgroup") && File.ReadAllText("/proc/1/cgroup").Contains("docker"));

                    if (isDockerContainer)
                    {
                        try
                        {
                            var psiShutdown = new System.Diagnostics.ProcessStartInfo
                            {
                                FileName = "supervisorctl",
                                Arguments = "shutdown",
                                UseShellExecute = false,
                                RedirectStandardOutput = true,
                                RedirectStandardError = true,
                                CreateNoWindow = true
                            };
                            using var proc = System.Diagnostics.Process.Start(psiShutdown);
                            BifrostheimPlugin.Log?.LogInfo("[WebApiRouter] Dispatched 'supervisorctl shutdown' to trigger Docker container restart.");
                        }
                        catch (Exception ex)
                        {
                            BifrostheimPlugin.Log?.LogDebug($"[WebApiRouter] supervisorctl shutdown not available: {ex.Message}");
                        }
                    }

                    // 4. Terminate process fallback
                    await MainThreadDispatcher.EnqueueAsync(() =>
                    {
                        BifrostheimPlugin.Log?.LogInfo("[WebApiRouter] Terminating server via Application.Quit() and Environment.Exit().");
                        Application.Quit();
                    });

                    await Task.Delay(500);
                    Environment.Exit(0);

                    await Task.Delay(1000);
                    System.Diagnostics.Process.GetCurrentProcess().Kill();
                }
                catch (Exception ex)
                {
                    BifrostheimPlugin.Log?.LogError($"[WebApiRouter] Error during restart execution: {ex}");
                    _isExecutingRestart = false;
                }
            });
        }

        // ── CharactersVault Handlers ──
        private static async Task HandleGetCharacterBindings(HttpListenerResponse response)
        {
            var onlineIdentifiers = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            await MainThreadDispatcher.EnqueueAsync(() =>
            {
                if (ZNet.instance != null)
                {
                    foreach (var peer in ZNetHelper.GetPeers())
                    {
                        if (peer == null) continue;
                        string id = ZNetHelper.GetPlayerId(peer);
                        if (!string.IsNullOrWhiteSpace(id))
                        {
                            onlineIdentifiers.Add(id);
                            if (id.StartsWith("Steam_", StringComparison.OrdinalIgnoreCase))
                            {
                                onlineIdentifiers.Add(id.Substring(6));
                            }
                        }
                        if (!string.IsNullOrWhiteSpace(peer.m_playerName))
                        {
                            onlineIdentifiers.Add(peer.m_playerName);
                        }
                    }
                }
            });

            var bindings = ConfigSyncManager.LoadCharacterVaultBindings(onlineIdentifiers);
            await SendJsonAsync(response, 200, bindings);
        }

        private static async Task HandleUnbindCharacter(HttpListenerRequest request, HttpListenerResponse response, string clientIp)
        {
            string body = await ReadBodyAsync(request);
            var req = SimpleJson.DeserializeObject<UnbindRequest>(body);
            string steamId = req?.steamId?.Trim() ?? string.Empty;

            if (!string.IsNullOrWhiteSpace(steamId))
            {
                ConfigSyncManager.UnbindCharacter(steamId);
            }

            AddLog("info", "CHARVAULT", $"Unbound character binding for '{steamId}'.");
            await SendJsonAsync(response, 200, new { success = true });
        }

        private static async Task HandleWipeCharacters(HttpListenerResponse response, string clientIp)
        {
            ConfigSyncManager.WipeCharacters();
            AddLog("warn", "CHARVAULT", "Triggered character bindings wipe.");
            await SendJsonAsync(response, 200, new { success = true, message = "CharactersVault data wiped successfully." });
        }

        // ── Valgrind Handlers ──
        private static async Task HandleGetValgrindConfig(HttpListenerResponse response)
        {
            var config = ConfigSyncManager.LoadValgrindConfig();
            await SendJsonAsync(response, 200, config);
        }

        private static async Task HandleSaveValgrindConfig(HttpListenerRequest request, HttpListenerResponse response, string clientIp)
        {
            string body = await ReadBodyAsync(request);
            var updated = SimpleJson.DeserializeObject<ValgrindConfigDto>(body);
            if (updated != null)
            {
                ConfigSyncManager.SaveValgrindConfig(updated);
            }
            RecordPendingChange("valgrind", "Valgrind");
            AddLog("info", "VALGRIND", $"Updated Valgrind configuration (Mode: {updated?.calculationMode}) - Saved to disk.");
            var savedConfig = ConfigSyncManager.LoadValgrindConfig();
            await SendJsonAsync(response, 200, new { success = true, config = savedConfig });
        }

        // ── Dagr & Nott Handlers ──
        private static async Task HandleGetDagrNottConfig(HttpListenerResponse response)
        {
            var config = ConfigSyncManager.LoadDagrNottConfig();
            await SendJsonAsync(response, 200, config);
        }

        private static async Task HandleSaveDagrNottConfig(HttpListenerRequest request, HttpListenerResponse response, string clientIp)
        {
            string body = await ReadBodyAsync(request);
            var updated = SimpleJson.DeserializeObject<DagrNottConfigDto>(body);
            if (updated != null)
            {
                ConfigSyncManager.SaveDagrNottConfig(updated);
            }
            RecordPendingChange("dagrnott", "Dagr & Nott");
            AddLog("info", "DAGRNOTT", $"Updated Dagr & Nott cycle (Dawn: {updated?.dawnMultiplier:F2}x, Day: {updated?.dayMultiplier:F2}x, Dusk: {updated?.duskMultiplier:F2}x, Night: {updated?.nightMultiplier:F2}x | ~{updated?.totalMinutes:F1}m total) - Saved to disk.");
            var savedConfig = ConfigSyncManager.LoadDagrNottConfig();
            await SendJsonAsync(response, 200, new { success = true, config = savedConfig });
        }

        // ── Skald Handlers ──
        private static async Task HandleGetSkaldConfig(HttpListenerResponse response)
        {
            var config = ConfigSyncManager.LoadSkaldConfig();
            await SendJsonAsync(response, 200, config);
        }

        private static async Task HandleSaveSkaldConfig(HttpListenerRequest request, HttpListenerResponse response, string clientIp)
        {
            string body = await ReadBodyAsync(request);
            var updated = SimpleJson.DeserializeObject<SkaldConfigDto>(body);
            if (updated != null)
            {
                ConfigSyncManager.SaveSkaldConfig(updated);
            }
            RecordPendingChange("skald", "Skald");
            AddLog("info", "SKALD", "Updated Skald Viking chronicle configuration - Saved to disk.");
            var savedConfig = ConfigSyncManager.LoadSkaldConfig();
            await SendJsonAsync(response, 200, new { success = true, config = savedConfig });
        }

                private static async Task HandleGetSkaldChronicle(HttpListenerResponse response)
        {
            try
            {
                Type? skaldRegistryType = null;
                foreach (var asm in AppDomain.CurrentDomain.GetAssemblies())
                {
                    if (asm.GetName().Name == "Skald" || asm.GetName().Name == "Skald_VikingKillFeed")
                    {
                        skaldRegistryType = asm.GetType("Skald.Logic.ChronicleRegistry");
                        if (skaldRegistryType != null) break;
                    }
                }

                if (skaldRegistryType != null)
                {
                    var getRecentMethod = skaldRegistryType.GetMethod("GetRecentDeaths", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static);
                    if (getRecentMethod != null)
                    {
                        var deathsObj = getRecentMethod.Invoke(null, new object[] { 100 });
                        if (deathsObj is System.Collections.IEnumerable enumerable)
                        {
                            var list = new List<SkaldDeathRecordDto>();
                            foreach (var d in enumerable)
                            {
                                if (d == null) continue;
                                var t = d.GetType();
                                list.Add(new SkaldDeathRecordDto
                                {
                                    id = t.GetProperty("Id")?.GetValue(d)?.ToString() ?? Guid.NewGuid().ToString(),
                                    victimName = t.GetProperty("VictimName")?.GetValue(d)?.ToString() ?? "",
                                    victimSteamId = t.GetProperty("VictimSteamId")?.GetValue(d)?.ToString() ?? "",
                                    killerName = t.GetProperty("KillerName")?.GetValue(d)?.ToString() ?? "",
                                    category = t.GetProperty("Category")?.GetValue(d)?.ToString() ?? "",
                                    biome = t.GetProperty("Biome")?.GetValue(d)?.ToString() ?? "",
                                    formattedMessage = t.GetProperty("FormattedMessage")?.GetValue(d)?.ToString() ?? "",
                                    timestamp = (t.GetProperty("Timestamp")?.GetValue(d) is DateTime dt) ? dt.ToString("yyyy-MM-dd HH:mm:ss") : DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss")
                                });
                            }
                            if (list.Count > 0)
                            {
                                list.Reverse();
                                await SendJsonAsync(response, 200, list);
                                return;
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                BifrostheimPlugin.Log?.LogDebug($"[WebApiRouter] Skald live reflection query failed, falling back to local chronicle: {ex.Message}");
            }

            List<SkaldDeathRecordDto> chronicleSnapshot;
            lock (_skaldLock)
            {
                chronicleSnapshot = new List<SkaldDeathRecordDto>(_skaldChronicle);
            }
            await SendJsonAsync(response, 200, chronicleSnapshot);
        }


        private static async Task HandleTestDeathAnnouncement(HttpListenerRequest request, HttpListenerResponse response, string clientIp)
        {
            string body = await ReadBodyAsync(request);
            var record = new SkaldDeathRecordDto
            {
                id = Guid.NewGuid().ToString(),
                victimName = "VikingWarrior",
                victimSteamId = "Steam_76561198000000001",
                killerName = "Troll",
                category = "Monsters",
                biome = "BlackForest",
                formattedMessage = "VikingWarrior was crushed by Troll in Black Forest.",
                timestamp = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss")
            };
            lock (_skaldLock)
            {
                _skaldChronicle.Insert(0, record);
                if (_skaldChronicle.Count > 100) _skaldChronicle.RemoveAt(_skaldChronicle.Count - 1);
            }

            await SendJsonAsync(response, 200, new { success = true, record });
        }

        // ── Njörðr Handlers ──
        private static async Task HandleGetNjororConfig(HttpListenerResponse response)
        {
            var config = ConfigSyncManager.LoadNjororConfig();
            await SendJsonAsync(response, 200, config);
        }

        private static async Task HandleSaveNjororConfig(HttpListenerRequest request, HttpListenerResponse response, string clientIp)
        {
            string body = await ReadBodyAsync(request);
            var updated = SimpleJson.DeserializeObject<NjororConfigDto>(body);
            if (updated != null)
            {
                ConfigSyncManager.SaveNjororConfig(updated);
            }
            RecordPendingChange("njoror", "Njörðr");
            AddLog("info", "NJOROR", "Updated Njörðr fair winds configuration - Saved to disk.");
            var savedConfig = ConfigSyncManager.LoadNjororConfig();
            await SendJsonAsync(response, 200, new { success = true, config = savedConfig });
        }

        private static async Task HandleGetOtherModsList(HttpListenerResponse response)
        {
            var list = ConfigSyncManager.ScanOtherModConfigFiles();
            await SendJsonAsync(response, 200, new { mods = list });
        }

        private static async Task HandleGetOtherModConfig(HttpListenerRequest request, HttpListenerResponse response)
        {
            string? fileName = request.QueryString["file"];
            if (string.IsNullOrWhiteSpace(fileName))
            {
                await SendJsonAsync(response, 400, new { success = false, message = "Missing 'file' query parameter." });
                return;
            }

            var detail = ConfigSyncManager.ParseModConfigFile(fileName!);
            await SendJsonAsync(response, 200, detail);
        }

        private static async Task HandleSaveOtherModConfig(HttpListenerRequest request, HttpListenerResponse response, string clientIp)
        {
            string body = await ReadBodyAsync(request);
            var req = SimpleJson.DeserializeObject<SaveOtherModConfigRequest>(body);
            if (req == null || string.IsNullOrWhiteSpace(req.fileName))
            {
                await SendJsonAsync(response, 400, new { success = false, message = "Invalid save request or missing fileName." });
                return;
            }

            var updated = ConfigSyncManager.SaveOtherModConfig(req);
            string modName = !string.IsNullOrEmpty(updated.displayName) ? updated.displayName : req.fileName;
            RecordPendingChange(req.fileName, modName);
            AddLog("info", "CONFIG", $"Updated mod config '{req.fileName}' ({modName}) - Staged restart pending.");

            await SendJsonAsync(response, 200, new { success = true, config = updated });
        }

        private static async Task HandleResetOtherModDefaults(HttpListenerRequest request, HttpListenerResponse response, string clientIp)
        {
            string body = await ReadBodyAsync(request);
            var req = SimpleJson.DeserializeObject<ResetOtherModConfigRequest>(body);
            if (req == null || string.IsNullOrWhiteSpace(req.fileName))
            {
                await SendJsonAsync(response, 400, new { success = false, message = "Invalid reset request or missing fileName." });
                return;
            }

            var updated = ConfigSyncManager.ResetOtherModConfigDefaults(req.fileName);
            string modName = !string.IsNullOrEmpty(updated.displayName) ? updated.displayName : req.fileName;
            RecordPendingChange(req.fileName, modName);
            AddLog("warn", "CONFIG", $"Reset mod config '{req.fileName}' ({modName}) to default values.");

            await SendJsonAsync(response, 200, new { success = true, config = updated });
        }

        private static async Task<string> ReadBodyAsync(HttpListenerRequest request, int maxBytes = MaxRequestBodySizeBytes)
        {
            if (request.ContentLength64 > maxBytes)
            {
                throw new InvalidOperationException($"Request body exceeds maximum allowed size of {maxBytes} bytes.");
            }

            var encoding = request.ContentEncoding ?? Encoding.UTF8;
            using var timeoutCts = new CancellationTokenSource(TimeSpan.FromSeconds(15));
            using (var ms = new MemoryStream())
            {
                byte[] buffer = new byte[8192];
                int totalRead = 0;
                int bytesRead;
                while ((bytesRead = await request.InputStream.ReadAsync(buffer, 0, buffer.Length, timeoutCts.Token)) > 0)
                {
                    totalRead += bytesRead;
                    if (totalRead > maxBytes)
                    {
                        throw new InvalidOperationException($"Request body exceeds maximum allowed size of {maxBytes} bytes.");
                    }
                    ms.Write(buffer, 0, bytesRead);
                }
                return encoding.GetString(ms.ToArray());
            }
        }

        private static async Task SendJsonAsync(HttpListenerResponse response, int statusCode, object data)
        {
            string json = SimpleJson.SerializeObject(data, prettyPrint: false);
            byte[] bytes = Encoding.UTF8.GetBytes(json);

            response.StatusCode = statusCode;
            response.ContentType = "application/json; charset=utf-8";
            response.ContentLength64 = bytes.Length;

            using (var stream = response.OutputStream)
            {
                await stream.WriteAsync(bytes, 0, bytes.Length);
            }
            response.Close();
        }
    }

    public class ServerTelemetryDto
    {
        public string uptime { get; set; } = "0h 0m 0s";
        public long uptimeSeconds { get; set; } = 0;
        public int onlineCount { get; set; } = 0;
        public int maxPlayers { get; set; } = 10;
        public int fps { get; set; } = 60;
        public string tickRate { get; set; } = "50 Hz";
        public int activeZdos { get; set; } = 0;
        public int memoryMb { get; set; } = 0;
    }

    public class ValgrindConfigDto
    {
        public string calculationMode { get; set; } = "TieredBrackets";
        public bool useTopNSkillsOnly { get; set; } = false;
        public int topNSkillsCount { get; set; } = 5;
        public bool resetAccumulatorOnDeath { get; set; } = true;
        public bool enableDebugLogging { get; set; } = false;

        // Tiered Brackets Settings
        public float earlyGameLossPercent { get; set; } = 8.0f;
        public float midGameLossPercent { get; set; } = 5.0f;
        public float lateGameLossPercent { get; set; } = 2.5f;
        public float endgameLossPercent { get; set; } = 1.0f;

        // Continuous Curve Settings
        public float curveMaxLossPercent { get; set; } = 8.0f;
        public float curveMinLossPercent { get; set; } = 1.0f;
    }

    public class DagrNottConfigDto
    {
        public float dawnMultiplier { get; set; } = 0.90f;
        public float dayMultiplier { get; set; } = 0.50f;
        public float duskMultiplier { get; set; } = 0.90f;
        public float nightMultiplier { get; set; } = 0.30f;
        public bool logPhaseTransitions { get; set; } = true;

        public float dawnMinutes { get; set; } = 5.0f;
        public float dayMinutes { get; set; } = 30.0f;
        public float duskMinutes { get; set; } = 5.0f;
        public float nightMinutes { get; set; } = 20.0f;
        public float totalMinutes { get; set; } = 60.0f;
    }

    public class SkaldConfigDto
    {
        public bool enabled { get; set; } = true;
        public bool enableBosses { get; set; } = true;
        public bool includeBiome { get; set; } = true;
        public bool logToConsole { get; set; } = true;
        public string monsterTemplates { get; set; } = "{victim} was slain by a {killer} in the {biome};{victim} was torn apart by a {killer};A {killer} claimed the soul of {victim}";
        public string bossTemplates { get; set; } = "{victim} was annihilated by the mythical {killer}!;The legendary {killer} crushed {victim} into dust";
        public string overwhelmedMessages { get; set; } = "{victim} was defeated in glorious battle against a horde in the {biome};{victim} fell fighting valiantly against overwhelming odds";
        public string genericDeathMessages { get; set; } = "{victim} has departed for the halls of Valhalla;The Norns have cut the thread of {victim}'s life;{victim} died in the {biome}";
    }

    public class SkaldDeathRecordDto
    {
        public string id { get; set; } = string.Empty;
        public string victimName { get; set; } = string.Empty;
        public string victimSteamId { get; set; } = string.Empty;
        public string killerName { get; set; } = string.Empty;
        public string category { get; set; } = string.Empty;
        public string biome { get; set; } = string.Empty;
        public string formattedMessage { get; set; } = string.Empty;
        public string timestamp { get; set; } = string.Empty;
    }

    public class NjororConfigDto
    {
        public bool enableFairWinds { get; set; } = true;
        public float headwindMitigationPercent { get; set; } = 60.0f;
        public float minWindSpeedMultiplier { get; set; } = 1.0f;
        public bool alwaysTailwindInOcean { get; set; } = false;
        public bool checkDeflectOnWindChange { get; set; } = true;
        public int checkDeflectTimeSeconds { get; set; } = 0;
        public bool enableWeatherTuning { get; set; } = true;
        public float stormFrequencyMultiplier { get; set; } = 1.0f;
        public float rainFrequencyMultiplier { get; set; } = 1.0f;
        public float clearFrequencyMultiplier { get; set; } = 1.0f;
        public bool enableSerpentTuning { get; set; } = true;
        public float daytimeSerpentSpawnChance { get; set; } = 0.0f;
        public float nighttimeSerpentSpawnChance { get; set; } = 5.0f;
        public float serpentSpawnIntervalSeconds { get; set; } = 1000.0f;
        public bool allowCalmWeatherDaySerpents { get; set; } = false;
    }

    public class ConsoleLogEntry
    {
        public string time { get; set; } = string.Empty;
        public string source { get; set; } = string.Empty;
        public string text { get; set; } = string.Empty;
        public string level { get; set; } = "info";
    }

    public class AuthRequest { public string? password { get; set; } }
    public class KickRequest { public string? name { get; set; } }
    public class BanRequest { public string? name { get; set; } public string? reason { get; set; } }
    public class UnbanRequest { public string? steamId { get; set; } }
    public class UnbindRequest { public string? steamId { get; set; } public string? name { get; set; } }
    public class ManualBanRequest { public string? steamId { get; set; } public string? name { get; set; } public string? reason { get; set; } }
    public class ExecCommandRequest { public string? command { get; set; } }
    public class BroadcastRequest { public string? message { get; set; } }
    public class ScheduleRestartRequest { public int minutes { get; set; } public string? reason { get; set; } }
    public class DailyRestartRequest { public bool enabled { get; set; } public string? time { get; set; } }
    public class ScheduledRestartState
    {
        public bool active { get; set; }
        public int minutes { get; set; }
        public int totalMinutes { get; set; }
        public long targetTimestamp { get; set; }
        public string reason { get; set; } = string.Empty;
    }
    public class DailyRestartState
    {
        public bool enabled { get; set; }
        public string time { get; set; } = "04:00";
    }
    public class LifecycleConfigState
    {
        public string mode { get; set; } = "ExitOnly";
        public string scriptPath { get; set; } = string.Empty;
    }

    public class PendingConfigChange
    {
        public string module { get; set; } = string.Empty;
        public string moduleName { get; set; } = string.Empty;
        public string timestamp { get; set; } = string.Empty;
    }

    public class OtherModSummaryDto
    {
        public string fileName { get; set; } = string.Empty;
        public string filePath { get; set; } = string.Empty;
        public string displayName { get; set; } = string.Empty;
        public string pluginGuid { get; set; } = string.Empty;
        public string pluginName { get; set; } = string.Empty;
        public string pluginVersion { get; set; } = string.Empty;
        public int sectionCount { get; set; }
        public int settingCount { get; set; }
        public long fileSizeBytes { get; set; }
        public string lastModified { get; set; } = string.Empty;
        public bool isLoadedInGame { get; set; }
        public bool isFirstParty { get; set; }
    }

    public class OtherModConfigEntryDto
    {
        public string key { get; set; } = string.Empty;
        public string value { get; set; } = string.Empty;
        public string? defaultValue { get; set; }
        public string valueType { get; set; } = "String";
        public string description { get; set; } = string.Empty;
        public List<string>? acceptableValues { get; set; }
        public float? minRange { get; set; }
        public float? maxRange { get; set; }
    }

    public class OtherModSectionDto
    {
        public string name { get; set; } = string.Empty;
        public List<OtherModConfigEntryDto> entries { get; set; } = new List<OtherModConfigEntryDto>();
    }

    public class OtherModConfigDetailDto
    {
        public string fileName { get; set; } = string.Empty;
        public string displayName { get; set; } = string.Empty;
        public string pluginGuid { get; set; } = string.Empty;
        public string pluginName { get; set; } = string.Empty;
        public string pluginVersion { get; set; } = string.Empty;
        public bool isLoadedInGame { get; set; }
        public List<OtherModSectionDto> sections { get; set; } = new List<OtherModSectionDto>();
        public string rawContent { get; set; } = string.Empty;
        public string lastModified { get; set; } = string.Empty;
    }

    public class SaveOtherModConfigRequest
    {
        public string fileName { get; set; } = string.Empty;
        public Dictionary<string, Dictionary<string, string>>? updates { get; set; }
        public string? rawContent { get; set; }
        public bool saveRaw { get; set; }
    }

    public class ResetOtherModConfigRequest
    {
        public string fileName { get; set; } = string.Empty;
    }

    public class DiscordConfigDto
    {
        public bool enabled { get; set; }
        public string webhookUrl { get; set; } = string.Empty;
        public string overrideChatWebhookUrl { get; set; } = string.Empty;
        public string overrideAdminWebhookUrl { get; set; } = string.Empty;
        public string botUsername { get; set; } = "Bifrostheim Herald";
        public string botAvatarUrl { get; set; } = string.Empty;
        public bool useRichEmbeds { get; set; } = true;
        public bool notifyPlayerJoin { get; set; } = true;
        public bool notifyPlayerLeave { get; set; } = true;
        public bool notifyPlayerDeath { get; set; } = true;
        public bool notifyServerLifecycle { get; set; } = true;
        public bool notifyWorldEvents { get; set; } = true;
        public bool notifyBossMilestones { get; set; } = true;
        public bool notifyAdminActions { get; set; } = true;
        public bool notifyChatShouts { get; set; } = false;
    }

    public class DiscordTestRequestDto
    {
        public string? eventType { get; set; }
        public string? webhookUrl { get; set; }
    }
}


