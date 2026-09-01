using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using HarmonyLib;

namespace Bifrostheim.Helpers
{
    /// <summary>
    /// Reflection-based wrappers for ZNet's private/internal members.
    /// </summary>
    internal static class ZNetHelper
    {
        // ── Cached reflection handles (resolved safely at static init) ──────────────
        private static FieldInfo? FiPeers;
        private static FieldInfo? FiAdminList;
        private static FieldInfo? FiBannedList;
        private static FieldInfo? FiServerPlayerLimit;
        private static MethodInfo? MiListContainsId;

        static ZNetHelper()
        {
            try
            {
                FiPeers = typeof(ZNet).GetField("m_peers", BindingFlags.NonPublic | BindingFlags.Public | BindingFlags.Instance);
                FiAdminList = typeof(ZNet).GetField("m_adminList", BindingFlags.NonPublic | BindingFlags.Public | BindingFlags.Instance);
                FiBannedList = typeof(ZNet).GetField("m_bannedList", BindingFlags.NonPublic | BindingFlags.Public | BindingFlags.Instance);
                FiServerPlayerLimit = typeof(ZNet).GetField("m_serverPlayerLimit", BindingFlags.NonPublic | BindingFlags.Public | BindingFlags.Static | BindingFlags.Instance);
                MiListContainsId = typeof(ZNet).GetMethod("ListContainsId", BindingFlags.NonPublic | BindingFlags.Public | BindingFlags.Instance);
            }
            catch { }
        }

        // ── Public API ─────────────────────────────────────────────────────────────

        public static List<ZNetPeer> GetPeers()
        {
            if (ZNet.instance == null || FiPeers == null) return new List<ZNetPeer>();
            var raw = FiPeers.GetValue(ZNet.instance) as List<ZNetPeer>;
            return raw != null ? new List<ZNetPeer>(raw) : new List<ZNetPeer>();
        }

        public static int GetServerPlayerLimit()
        {
            if (FiServerPlayerLimit != null)
            {
                object? val = FiServerPlayerLimit.IsStatic ? FiServerPlayerLimit.GetValue(null) : (ZNet.instance != null ? FiServerPlayerLimit.GetValue(ZNet.instance) : null);
                if (val is int limit) return limit;
            }
            return 10;
        }

        public static List<string> GetBannedList()
        {
            var results = new List<string>();
            if (ZNet.instance == null) return results;

            try
            {
                object? bannedList = FiBannedList != null
                    ? FiBannedList.GetValue(ZNet.instance)
                    : Traverse.Create(ZNet.instance).Field("m_bannedList").GetValue();

                if (bannedList != null)
                {
                    MethodInfo? getListMethod = bannedList.GetType().GetMethod("GetList");
                    if (getListMethod != null)
                    {
                        var listObj = getListMethod.Invoke(bannedList, null);
                        if (listObj is IEnumerable enumerable)
                        {
                            foreach (object item in enumerable)
                            {
                                if (item is string s && !string.IsNullOrWhiteSpace(s))
                                    results.Add(s.Trim());
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                BifrostheimPlugin.Log?.LogError($"[ZNetHelper] GetBannedList error: {ex.Message}");
            }

            return results;
        }

        public static int GetPeerPing(ZNetPeer peer)
        {
            if (peer == null) return 0;
            try
            {
                if (peer.m_rpc != null)
                {
                    var prop = peer.m_rpc.GetType().GetProperty("m_ping", BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance);
                    if (prop != null && prop.GetValue(peer.m_rpc) is float p) return (int)(p * 1000f);

                    var field = peer.m_rpc.GetType().GetField("m_ping", BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance);
                    if (field != null && field.GetValue(peer.m_rpc) is float f) return (int)(f * 1000f);
                }
            }
            catch { }
            return 0;
        }

        public static ZNetPeer? GetPeerByRpc(ZRpc rpc)
        {
            return GetPeers().FirstOrDefault(p => p.m_rpc == rpc);
        }

        public static ZNetPeer? FindPeerByPlayerId(string playerId)
        {
            if (string.IsNullOrWhiteSpace(playerId)) return null;
            return GetPeers().FirstOrDefault(p =>
                p != null && string.Equals(GetPlayerId(p), playerId, StringComparison.OrdinalIgnoreCase));
        }

        public static bool IsPlayerOnline(string steamId, string characterName)
        {
            if (ZNet.instance == null) return false;
            try
            {
                var peers = GetPeers();
                foreach (var peer in peers)
                {
                    if (peer == null) continue;
                    string peerSteamId = GetPlayerId(peer);
                    if (ConfigSyncManager.IsSteamIdMatch(peerSteamId, steamId)) return true;
                    if (!string.IsNullOrWhiteSpace(characterName) && characterName != "Unknown" &&
                        string.Equals(peer.m_playerName, characterName, StringComparison.OrdinalIgnoreCase))
                    {
                        return true;
                    }
                }
            }
            catch { }
            return false;
        }

        public static (float health, float maxHealth, bool pvp, string zone, int daysSurvived) GetPlayerData(ZNetPeer peer)
        {
            float health = 25f;
            float maxHealth = 25f;
            bool pvp = false;
            string zone = "Meadows";
            int daysSurvived = 1;

            try
            {
                if (EnvMan.instance != null && ZNet.instance != null)
                {
                    daysSurvived = EnvMan.instance.GetDay(ZNet.instance.GetTimeSeconds());
                }
                else if (ZNet.instance != null)
                {
                    daysSurvived = Math.Max(1, (int)(ZNet.instance.GetTimeSeconds() / 1200.0) + 1);
                }
            }
            catch { }

            if (peer == null) return (health, maxHealth, pvp, zone, daysSurvived);

            var pos = peer.m_refPos;
            try
            {
                if (WorldGenerator.instance != null)
                {
                    zone = WorldGenerator.instance.GetBiome(pos.x, pos.z).ToString();
                }
            }
            catch { }

            try
            {
                if (ZDOMan.instance != null && peer.m_characterID != ZDOID.None)
                {
                    ZDO zdo = ZDOMan.instance.GetZDO(peer.m_characterID);
                    if (zdo != null)
                    {
                        health = zdo.GetFloat("health", 25f);
                        maxHealth = zdo.GetFloat("max_health", 25f);
                        if (maxHealth < health) maxHealth = health;
                        if (maxHealth <= 0) maxHealth = 25f;

                        pvp = zdo.GetBool("pvp", false);
                    }
                }
            }
            catch { }

            return (health, maxHealth, pvp, zone, daysSurvived);
        }

        public static string GetPlayerId(ZNetPeer peer)
        {
            if (peer == null || peer.m_socket == null) return string.Empty;
            string host = peer.m_socket.GetHostName();
            if (string.IsNullOrWhiteSpace(host)) return string.Empty;

            if (ulong.TryParse(host, out _))
            {
                return "Steam_" + host;
            }

            return host;
        }

        public static bool IsValidPlayerId(string? playerId)
        {
            if (string.IsNullOrWhiteSpace(playerId) || playerId!.Length > 128)
                return false;

            foreach (char character in playerId)
            {
                if (!char.IsLetterOrDigit(character) && character != '_' && character != '-')
                    return false;
            }

            return playerId.StartsWith("Steam_", StringComparison.OrdinalIgnoreCase) ||
                   playerId.StartsWith("Xbox_", StringComparison.OrdinalIgnoreCase) ||
                   playerId.StartsWith("PlayFab_", StringComparison.OrdinalIgnoreCase) ||
                   ulong.TryParse(playerId, out _);
        }

        public static bool IsAdmin(ZNetPeer peer)
        {
            if (peer == null) return false;
            string playerId = GetPlayerId(peer);
            string host = peer.m_socket?.GetHostName() ?? string.Empty;
            return IsAdmin(playerId) || (!string.IsNullOrWhiteSpace(host) && IsAdmin(host));
        }

        public static bool IsAdmin(string playerId)
        {
            if (ZNet.instance == null || string.IsNullOrWhiteSpace(playerId))
                return false;

            try
            {
                object? adminList = FiAdminList != null
                    ? FiAdminList.GetValue(ZNet.instance)
                    : Traverse.Create(ZNet.instance).Field("m_adminList").GetValue();

                if (adminList == null) return false;

                var candidates = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { playerId.Trim() };

                if (playerId.StartsWith("Steam_", StringComparison.OrdinalIgnoreCase))
                {
                    candidates.Add(playerId.Substring("Steam_".Length).Trim());
                }
                else if (ulong.TryParse(playerId.Trim(), out _))
                {
                    candidates.Add("Steam_" + playerId.Trim());
                }

                if (playerId.StartsWith("Xbox_", StringComparison.OrdinalIgnoreCase))
                {
                    candidates.Add(playerId.Substring("Xbox_".Length).Trim());
                }

                if (playerId.StartsWith("PlayFab_", StringComparison.OrdinalIgnoreCase))
                {
                    candidates.Add(playerId.Substring("PlayFab_".Length).Trim());
                }

                if (MiListContainsId != null)
                {
                    foreach (string candidate in candidates)
                    {
                        if ((bool)(MiListContainsId.Invoke(ZNet.instance, new object[] { adminList, candidate }) ?? false))
                            return true;
                    }
                }

                MethodInfo? containsMethod = adminList.GetType().GetMethod("Contains", new[] { typeof(string) });
                if (containsMethod != null)
                {
                    foreach (string candidate in candidates)
                    {
                        if ((bool)(containsMethod.Invoke(adminList, new object[] { candidate }) ?? false))
                            return true;
                    }
                }

                MethodInfo? getListMethod = adminList.GetType().GetMethod("GetList");
                if (getListMethod != null)
                {
                    var listObj = getListMethod.Invoke(adminList, null);
                    if (listObj is IEnumerable enumerable)
                    {
                        foreach (object item in enumerable)
                        {
                            if (item is string s && candidates.Contains(s.Trim()))
                                return true;
                        }
                    }
                }

                return false;
            }
            catch (Exception ex)
            {
                BifrostheimPlugin.Log?.LogError($"[ZNetHelper] IsAdmin check failed: {ex.Message}");
                return false;
            }
        }

        public static void BroadcastServerMessage(string message)
        {
            if (string.IsNullOrWhiteSpace(message)) return;
            string cleanMsg = message.Trim();
            string formattedMsg = $"<color=#FFCC00>[SERVER]</color> {cleanMsg}";

            // 1. Center Screen Banner Announcement (MessageHud.MessageType.Center = 2)
            // MessageHud registers: Register<int, string>("ShowMessage", ...) on all Valheim clients
            try
            {
                if (ZRoutedRpc.instance != null)
                {
                    ZRoutedRpc.instance.InvokeRoutedRPC(ZRoutedRpc.Everybody, "ShowMessage", new object[]
                    {
                        (int)MessageHud.MessageType.Center,
                        formattedMsg
                    });
                }
            }
            catch (Exception ex)
            {
                BifrostheimPlugin.Log?.LogWarning($"[ZNetHelper] ZRoutedRpc ShowMessage broadcast failed: {ex.Message}");
            }

            // 2. Chat Box Broadcast (ChatMessage)
            try
            {
                if (ZRoutedRpc.instance != null)
                {
                    // 4-parameter standard (pos, type, name, text)
                    try
                    {
                        ZRoutedRpc.instance.InvokeRoutedRPC(ZRoutedRpc.Everybody, "ChatMessage", new object[]
                        {
                            UnityEngine.Vector3.zero,
                            (int)Talker.Type.Shout,
                            "Server",
                            cleanMsg
                        });
                    }
                    catch { }

                    // 5-parameter variant (pos, type, name, text, userinfo)
                    try
                    {
                        ZRoutedRpc.instance.InvokeRoutedRPC(ZRoutedRpc.Everybody, "ChatMessage", new object[]
                        {
                            UnityEngine.Vector3.zero,
                            (int)Talker.Type.Shout,
                            "Server",
                            cleanMsg,
                            string.Empty
                        });
                    }
                    catch { }
                }
            }
            catch (Exception ex)
            {
                BifrostheimPlugin.Log?.LogWarning($"[ZNetHelper] ZRoutedRpc ChatMessage broadcast failed: {ex.Message}");
            }

            // 3. Direct Peer RPC invocation for all active connections
            try
            {
                if (ZNet.instance != null)
                {
                    var peers = GetPeers();
                    foreach (var peer in peers)
                    {
                        if (peer?.m_rpc != null)
                        {
                            try
                            {
                                peer.m_rpc.Invoke("ShowMessage", new object[]
                                {
                                    (int)MessageHud.MessageType.Center,
                                    formattedMsg
                                });
                            }
                            catch { }

                            try
                            {
                                peer.m_rpc.Invoke("ChatMessage", new object[]
                                {
                                    UnityEngine.Vector3.zero,
                                    (int)Talker.Type.Shout,
                                    "Server",
                                    cleanMsg
                                });
                            }
                            catch { }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                BifrostheimPlugin.Log?.LogWarning($"[ZNetHelper] Direct peer broadcast failed: {ex.Message}");
            }
        }
    }
}
