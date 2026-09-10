using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Net.Http;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Bifrostheim.Helpers;

namespace Bifrostheim.Systems.Discord
{
    public enum DiscordChannelTarget
    {
        Default,
        Chat,
        Admin
    }

    public class DiscordQueueItem
    {
        public DiscordChannelTarget Target { get; set; } = DiscordChannelTarget.Default;
        public string? ExplicitUrl { get; set; }
        public string PayloadJson { get; set; } = string.Empty;
        public int RetryCount { get; set; } = 0;
    }

    public static class DiscordWebhookDispatcher
    {
        private static readonly HttpClient _httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(10) };
        private static readonly ConcurrentQueue<DiscordQueueItem> _queue = new ConcurrentQueue<DiscordQueueItem>();
        private static CancellationTokenSource? _cts;
        private static Task? _workerTask;
        private static readonly object _lock = new object();

        // ── Discord Embed Colors ──────────────────────────────────────────────────
        public const int ColorGreen = 0x2ECC71;
        public const int ColorRed = 0xE74C3C;
        public const int ColorGold = 0xF39C12;
        public const int ColorBlue = 0x3498DB;
        public const int ColorPurple = 0x9B59B6;
        public const int ColorOrange = 0xE67E22;
        public const int ColorSlate = 0x95A5A6;

        public static void Initialize()
        {
            lock (_lock)
            {
                if (_workerTask != null && !_workerTask.IsCompleted) return;
                _cts = new CancellationTokenSource();
                _workerTask = Task.Run(() => WorkerLoop(_cts.Token));
                BifrostheimPlugin.Log?.LogInfo("[Discord] Webhook dispatcher worker initialized.");
            }
        }

        public static void Shutdown()
        {
            lock (_lock)
            {
                try
                {
                    _cts?.Cancel();
                    _cts?.Dispose();
                    _cts = null;
                    _workerTask = null;
                    BifrostheimPlugin.Log?.LogInfo("[Discord] Webhook dispatcher stopped.");
                }
                catch { }
            }
        }

        public static string ResolveWebhookUrl(DiscordChannelTarget target, string? explicitUrl = null)
        {
            if (!string.IsNullOrWhiteSpace(explicitUrl)) return explicitUrl!.Trim();

            if (target == DiscordChannelTarget.Chat && !string.IsNullOrWhiteSpace(BifrostheimPlugin.DiscordOverrideChatWebhookUrl?.Value))
            {
                return BifrostheimPlugin.DiscordOverrideChatWebhookUrl.Value.Trim();
            }

            if (target == DiscordChannelTarget.Admin && !string.IsNullOrWhiteSpace(BifrostheimPlugin.DiscordOverrideAdminWebhookUrl?.Value))
            {
                return BifrostheimPlugin.DiscordOverrideAdminWebhookUrl.Value.Trim();
            }

            return BifrostheimPlugin.DiscordWebhookUrl?.Value?.Trim() ?? string.Empty;
        }

        public static void EnqueuePayload(string payloadJson, DiscordChannelTarget target = DiscordChannelTarget.Default, string? explicitUrl = null)
        {
            if (!BifrostheimPlugin.DiscordEnabled.Value && string.IsNullOrWhiteSpace(explicitUrl))
            {
                return;
            }

            _queue.Enqueue(new DiscordQueueItem
            {
                Target = target,
                ExplicitUrl = explicitUrl,
                PayloadJson = payloadJson,
                RetryCount = 0
            });
        }

        private static async Task WorkerLoop(CancellationToken ct)
        {
            while (!ct.IsCancellationRequested)
            {
                try
                {
                    if (_queue.TryDequeue(out var item))
                    {
                        string targetUrl = ResolveWebhookUrl(item.Target, item.ExplicitUrl);
                        if (string.IsNullOrWhiteSpace(targetUrl))
                        {
                            continue;
                        }

                        bool success = false;
                        int retryAfterMs = 1000;

                        try
                        {
                            using var content = new StringContent(item.PayloadJson, Encoding.UTF8, "application/json");
                            var response = await _httpClient.PostAsync(targetUrl, content, ct).ConfigureAwait(false);

                            if (response.IsSuccessStatusCode)
                            {
                                success = true;
                            }
                            else if ((int)response.StatusCode == 429)
                            {
                                // Rate limited by Discord
                                if (response.Headers.TryGetValues("Retry-After", out var values))
                                {
                                    foreach (var v in values)
                                    {
                                        if (double.TryParse(v, out var sec))
                                        {
                                            retryAfterMs = Math.Max(1000, (int)(sec * 1000.0));
                                            break;
                                        }
                                    }
                                }
                                BifrostheimPlugin.Log?.LogWarning($"[Discord] Rate limit reached. Backing off for {retryAfterMs}ms.");
                            }
                            else
                            {
                                string errorText = await response.Content.ReadAsStringAsync().ConfigureAwait(false);
                                BifrostheimPlugin.Log?.LogWarning($"[Discord] Webhook dispatch failed: {response.StatusCode} - {errorText}");
                            }
                        }
                        catch (Exception ex)
                        {
                            BifrostheimPlugin.Log?.LogWarning($"[Discord] Webhook post exception: {ex.Message}");
                        }

                        if (!success && item.RetryCount < 3)
                        {
                            item.RetryCount++;
                            await Task.Delay(retryAfterMs, ct).ConfigureAwait(false);
                            _queue.Enqueue(item);
                        }
                        else
                        {
                            // Throttle slightly between normal messages to stay well under 30 req/min
                            await Task.Delay(350, ct).ConfigureAwait(false);
                        }
                    }
                    else
                    {
                        await Task.Delay(250, ct).ConfigureAwait(false);
                    }
                }
                catch (OperationCanceledException)
                {
                    break;
                }
                catch (Exception ex)
                {
                    BifrostheimPlugin.Log?.LogError($"[Discord] Worker loop error: {ex}");
                    await Task.Delay(1000, ct).ConfigureAwait(false);
                }
            }
        }

        // ── Direct Synchronous/Async Test Dispatcher ──────────────────────────────
        public static async Task<(bool success, string message)> SendImmediateTestAsync(string eventType, string? explicitUrl = null)
        {
            string url = ResolveWebhookUrl(DiscordChannelTarget.Default, explicitUrl);
            if (string.IsNullOrWhiteSpace(url))
            {
                return (false, "No Discord Webhook URL provided or configured.");
            }

            string payloadJson = BuildMockPayload(eventType);

            try
            {
                using var content = new StringContent(payloadJson, Encoding.UTF8, "application/json");
                var response = await _httpClient.PostAsync(url, content).ConfigureAwait(false);
                if (response.IsSuccessStatusCode)
                {
                    return (true, "Test notification delivered to Discord successfully!");
                }
                string err = await response.Content.ReadAsStringAsync().ConfigureAwait(false);
                return (false, $"Discord returned {(int)response.StatusCode}: {err}");
            }
            catch (Exception ex)
            {
                return (false, $"Dispatch exception: {ex.Message}");
            }
        }

        // ── High-Level Event Triggers ─────────────────────────────────────────────

        public static void OnPlayerJoin(string playerName, int onlineCount, int maxSlots)
        {
            if (!BifrostheimPlugin.DiscordNotifyPlayerJoin.Value) return;

            string botName = GetBotName();
            string avatar = GetBotAvatar();

            if (BifrostheimPlugin.DiscordUseRichEmbeds.Value)
            {
                var payload = new Dictionary<string, object?>
                {
                    ["username"] = botName,
                    ["avatar_url"] = avatar,
                    ["embeds"] = new[]
                    {
                        new Dictionary<string, object?>
                        {
                            ["title"] = "🟢 Viking Arrived in the 10th World",
                            ["description"] = $"**{EscapeMarkdown(playerName)}** has awakened in the 10th realm.",
                            ["color"] = ColorGreen,
                            ["fields"] = new[]
                            {
                                new { name = "Online Players", value = $"{onlineCount} / {maxSlots}", inline = true }
                            },
                            ["footer"] = new { text = "Bifrostheim • Bigfrost Server Portal" },
                            ["timestamp"] = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
                        }
                    }
                };
                EnqueuePayload(SimpleJson.SerializeObject(payload, false));
            }
            else
            {
                var payload = new Dictionary<string, object?>
                {
                    ["username"] = botName,
                    ["avatar_url"] = avatar,
                    ["content"] = $"🟢 **{EscapeMarkdown(playerName)}** arrived in the 10th world ({onlineCount}/{maxSlots} online)."
                };
                EnqueuePayload(SimpleJson.SerializeObject(payload, false));
            }
        }

        public static void OnPlayerLeave(string playerName, TimeSpan sessionDuration, int onlineCount, int maxSlots)
        {
            if (!BifrostheimPlugin.DiscordNotifyPlayerLeave.Value) return;

            string botName = GetBotName();
            string avatar = GetBotAvatar();
            string durationStr = FormatDuration(sessionDuration);

            if (BifrostheimPlugin.DiscordUseRichEmbeds.Value)
            {
                var payload = new Dictionary<string, object?>
                {
                    ["username"] = botName,
                    ["avatar_url"] = avatar,
                    ["embeds"] = new[]
                    {
                        new Dictionary<string, object?>
                        {
                            ["title"] = "🔵 Viking Departed",
                            ["description"] = $"**{EscapeMarkdown(playerName)}** departed the 10th realm.",
                            ["color"] = ColorBlue,
                            ["fields"] = new[]
                            {
                                new { name = "Session Duration", value = durationStr, inline = true },
                                new { name = "Remaining Online", value = $"{onlineCount} / {maxSlots}", inline = true }
                            },
                            ["footer"] = new { text = "Bifrostheim • Bigfrost Server Portal" },
                            ["timestamp"] = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
                        }
                    }
                };
                EnqueuePayload(SimpleJson.SerializeObject(payload, false));
            }
            else
            {
                var payload = new Dictionary<string, object?>
                {
                    ["username"] = botName,
                    ["avatar_url"] = avatar,
                    ["content"] = $"🔵 **{EscapeMarkdown(playerName)}** departed the 10th realm (Session: {durationStr}, {onlineCount}/{maxSlots} online)."
                };
                EnqueuePayload(SimpleJson.SerializeObject(payload, false));
            }
        }

        public static void OnPlayerDeath(string victimName, string biome, string? killerName = null, string? formattedLore = null)
        {
            if (!BifrostheimPlugin.DiscordNotifyPlayerDeath.Value) return;

            string botName = GetBotName();
            string avatar = GetBotAvatar();

            string title = "💀 Viking Fallen";
            string desc;
            if (!string.IsNullOrWhiteSpace(formattedLore))
            {
                desc = formattedLore!;
            }
            else if (!string.IsNullOrWhiteSpace(killerName))
            {
                desc = $"**{EscapeMarkdown(victimName)}** was slain by **{EscapeMarkdown(killerName!)}** in the **{biome}**.";
            }
            else
            {
                desc = $"**{EscapeMarkdown(victimName)}** met their end in the **{biome}**.";
            }

            if (BifrostheimPlugin.DiscordUseRichEmbeds.Value)
            {
                var fields = new List<object>
                {
                    new { name = "Biome", value = biome, inline = true }
                };
                if (!string.IsNullOrWhiteSpace(killerName))
                {
                    fields.Add(new { name = "Killer", value = killerName!, inline = true });
                }

                var payload = new Dictionary<string, object?>
                {
                    ["username"] = botName,
                    ["avatar_url"] = avatar,
                    ["embeds"] = new[]
                    {
                        new Dictionary<string, object?>
                        {
                            ["title"] = title,
                            ["description"] = desc,
                            ["color"] = ColorRed,
                            ["fields"] = fields.ToArray(),
                            ["footer"] = new { text = "Bifrostheim • Bigfrost Server Portal" },
                            ["timestamp"] = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
                        }
                    }
                };
                EnqueuePayload(SimpleJson.SerializeObject(payload, false));
            }
            else
            {
                var payload = new Dictionary<string, object?>
                {
                    ["username"] = botName,
                    ["avatar_url"] = avatar,
                    ["content"] = $"💀 {desc}"
                };
                EnqueuePayload(SimpleJson.SerializeObject(payload, false));
            }
        }

        public static void OnPvPKill(string killerName, string victimName, string biome)
        {
            if (!BifrostheimPlugin.DiscordNotifyPlayerDeath.Value) return;

            string botName = GetBotName();
            string avatar = GetBotAvatar();
            string desc = $"⚔️ **{EscapeMarkdown(killerName)}** vanquished **{EscapeMarkdown(victimName)}** in glorious combat in the **{biome}**!";

            if (BifrostheimPlugin.DiscordUseRichEmbeds.Value)
            {
                var payload = new Dictionary<string, object?>
                {
                    ["username"] = botName,
                    ["avatar_url"] = avatar,
                    ["embeds"] = new[]
                    {
                        new Dictionary<string, object?>
                        {
                            ["title"] = "⚔️ Viking Duel / PvP Slaying",
                            ["description"] = desc,
                            ["color"] = ColorRed,
                            ["fields"] = new[]
                            {
                                new { name = "Victor", value = killerName, inline = true },
                                new { name = "Fallen", value = victimName, inline = true },
                                new { name = "Biome", value = biome, inline = true }
                            },
                            ["footer"] = new { text = "Bifrostheim • Bigfrost Server Portal" },
                            ["timestamp"] = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
                        }
                    }
                };
                EnqueuePayload(SimpleJson.SerializeObject(payload, false));
            }
            else
            {
                var payload = new Dictionary<string, object?>
                {
                    ["username"] = botName,
                    ["avatar_url"] = avatar,
                    ["content"] = desc
                };
                EnqueuePayload(SimpleJson.SerializeObject(payload, false));
            }
        }

        public static void OnServerLifecycle(string title, string description, int color = ColorGreen, bool isRestartWarning = false)
        {
            if (!BifrostheimPlugin.DiscordNotifyServerLifecycle.Value) return;

            string botName = GetBotName();
            string avatar = GetBotAvatar();

            if (BifrostheimPlugin.DiscordUseRichEmbeds.Value)
            {
                var payload = new Dictionary<string, object?>
                {
                    ["username"] = botName,
                    ["avatar_url"] = avatar,
                    ["embeds"] = new[]
                    {
                        new Dictionary<string, object?>
                        {
                            ["title"] = title,
                            ["description"] = description,
                            ["color"] = color,
                            ["footer"] = new { text = "Bifrostheim • Bigfrost Server Portal" },
                            ["timestamp"] = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
                        }
                    }
                };
                EnqueuePayload(SimpleJson.SerializeObject(payload, false));
            }
            else
            {
                var payload = new Dictionary<string, object?>
                {
                    ["username"] = botName,
                    ["avatar_url"] = avatar,
                    ["content"] = $"🛡️ **{title}**: {description}"
                };
                EnqueuePayload(SimpleJson.SerializeObject(payload, false));
            }
        }

        public static void OnRaidEvent(string eventName, string announcement, string biome, bool started)
        {
            if (!BifrostheimPlugin.DiscordNotifyWorldEvents.Value) return;

            string botName = GetBotName();
            string avatar = GetBotAvatar();

            string title = started ? "⚡ Raid Event Started!" : "🌤️ Raid Event Ended";
            string desc = started
                ? $"**\"{announcement}\"**\nA raid has begun in the **{biome}**!"
                : $"The raid in the **{biome}** has subsided.";
            int color = started ? ColorOrange : ColorBlue;

            if (BifrostheimPlugin.DiscordUseRichEmbeds.Value)
            {
                var payload = new Dictionary<string, object?>
                {
                    ["username"] = botName,
                    ["avatar_url"] = avatar,
                    ["embeds"] = new[]
                    {
                        new Dictionary<string, object?>
                        {
                            ["title"] = title,
                            ["description"] = desc,
                            ["color"] = color,
                            ["fields"] = new[]
                            {
                                new { name = "Event", value = eventName, inline = true },
                                new { name = "Biome", value = biome, inline = true }
                            },
                            ["footer"] = new { text = "Bifrostheim • Bigfrost Server Portal" },
                            ["timestamp"] = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
                        }
                    }
                };
                EnqueuePayload(SimpleJson.SerializeObject(payload, false));
            }
            else
            {
                var payload = new Dictionary<string, object?>
                {
                    ["username"] = botName,
                    ["avatar_url"] = avatar,
                    ["content"] = $"⚡ **{title}**: {desc}"
                };
                EnqueuePayload(SimpleJson.SerializeObject(payload, false));
            }
        }

        public static void OnBossEvent(string bossName, string biome, bool defeated)
        {
            if (!BifrostheimPlugin.DiscordNotifyBossMilestones.Value) return;

            string botName = GetBotName();
            string avatar = GetBotAvatar();

            string title = defeated ? "🏆 Forsaken Slain!" : "⚡ Forsaken Awakened!";
            string desc = defeated
                ? $"The ancient power **{bossName}** has been vanquished from the 10th realm!"
                : $"**{bossName}** has answered the call of sacrifice in the **{biome}**!";

            if (BifrostheimPlugin.DiscordUseRichEmbeds.Value)
            {
                var payload = new Dictionary<string, object?>
                {
                    ["username"] = botName,
                    ["avatar_url"] = avatar,
                    ["embeds"] = new[]
                    {
                        new Dictionary<string, object?>
                        {
                            ["title"] = title,
                            ["description"] = desc,
                            ["color"] = ColorGold,
                            ["fields"] = new[]
                            {
                                new { name = "Forsaken", value = bossName, inline = true },
                                new { name = "Biome", value = biome, inline = true }
                            },
                            ["footer"] = new { text = "Bifrostheim • Bigfrost Server Portal" },
                            ["timestamp"] = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
                        }
                    }
                };
                EnqueuePayload(SimpleJson.SerializeObject(payload, false));
            }
            else
            {
                var payload = new Dictionary<string, object?>
                {
                    ["username"] = botName,
                    ["avatar_url"] = avatar,
                    ["content"] = $"🏆 **{title}**: {desc}"
                };
                EnqueuePayload(SimpleJson.SerializeObject(payload, false));
            }
        }

        public static void OnAdminAction(string actionType, string targetName, string adminName, string reason)
        {
            if (!BifrostheimPlugin.DiscordNotifyAdminActions.Value) return;

            string botName = GetBotName();
            string avatar = GetBotAvatar();

            string title = $"🔨 Admin Action: Player {actionType}";
            string desc = $"**{EscapeMarkdown(targetName)}** was {actionType.ToLower()}ed by **{adminName}**.";

            if (BifrostheimPlugin.DiscordUseRichEmbeds.Value)
            {
                var fields = new List<object>
                {
                    new { name = "Target", value = targetName, inline = true },
                    new { name = "Moderator", value = adminName, inline = true }
                };
                if (!string.IsNullOrWhiteSpace(reason))
                {
                    fields.Add(new { name = "Reason", value = reason, inline = false });
                }

                var payload = new Dictionary<string, object?>
                {
                    ["username"] = botName,
                    ["avatar_url"] = avatar,
                    ["embeds"] = new[]
                    {
                        new Dictionary<string, object?>
                        {
                            ["title"] = title,
                            ["description"] = desc,
                            ["color"] = ColorPurple,
                            ["fields"] = fields.ToArray(),
                            ["footer"] = new { text = "Bifrostheim • Bigfrost Server Portal" },
                            ["timestamp"] = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
                        }
                    }
                };
                EnqueuePayload(SimpleJson.SerializeObject(payload, false), DiscordChannelTarget.Admin);
            }
            else
            {
                var payload = new Dictionary<string, object?>
                {
                    ["username"] = botName,
                    ["avatar_url"] = avatar,
                    ["content"] = $"🔨 **{title}**: {desc} (Reason: {reason})"
                };
                EnqueuePayload(SimpleJson.SerializeObject(payload, false), DiscordChannelTarget.Admin);
            }
        }

        public static void OnChatShout(string playerName, string message)
        {
            if (!BifrostheimPlugin.DiscordNotifyChatShouts.Value) return;
            if (string.IsNullOrWhiteSpace(message)) return;

            string botName = GetBotName();
            string avatar = GetBotAvatar();

            if (BifrostheimPlugin.DiscordUseRichEmbeds.Value)
            {
                var payload = new Dictionary<string, object?>
                {
                    ["username"] = botName,
                    ["avatar_url"] = avatar,
                    ["embeds"] = new[]
                    {
                        new Dictionary<string, object?>
                        {
                            ["author"] = new { name = playerName },
                            ["description"] = $"📢 \"{EscapeMarkdown(message)}\"",
                            ["color"] = ColorSlate,
                            ["footer"] = new { text = "In-Game Shout" },
                            ["timestamp"] = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
                        }
                    }
                };
                EnqueuePayload(SimpleJson.SerializeObject(payload, false), DiscordChannelTarget.Chat);
            }
            else
            {
                var payload = new Dictionary<string, object?>
                {
                    ["username"] = botName,
                    ["avatar_url"] = avatar,
                    ["content"] = $"📢 **{EscapeMarkdown(playerName)}** shouted: \"{EscapeMarkdown(message)}\""
                };
                EnqueuePayload(SimpleJson.SerializeObject(payload, false), DiscordChannelTarget.Chat);
            }
        }

        // ── Mock Payload Generator for Per-Event Testing ──────────────────────────

        public static string BuildMockPayload(string eventType)
        {
            string botName = GetBotName();
            string avatar = GetBotAvatar();
            bool useEmbed = BifrostheimPlugin.DiscordUseRichEmbeds?.Value ?? true;

            switch (eventType.ToLowerInvariant())
            {
                case "join":
                case "player_join":
                    if (!useEmbed)
                        return SimpleJson.SerializeObject(new { username = botName, avatar_url = avatar, content = "🟢 **Ragnar** arrived in the 10th world (3/10 online)." }, false);
                    return SimpleJson.SerializeObject(new
                    {
                        username = botName,
                        avatar_url = avatar,
                        embeds = new[]
                        {
                            new
                            {
                                title = "🟢 Viking Arrived in the 10th World",
                                description = "**Ragnar Lothbrok** has awakened in the 10th realm.",
                                color = ColorGreen,
                                fields = new[] { new { name = "Online Players", value = "3 / 10", @inline = true } },
                                footer = new { text = "Bifrostheim • Bigfrost Server Portal" },
                                timestamp = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
                            }
                        }
                    }, false);

                case "leave":
                case "player_leave":
                    if (!useEmbed)
                        return SimpleJson.SerializeObject(new { username = botName, avatar_url = avatar, content = "🔵 **Lagertha** departed the 10th realm (Session: 1h 42m, 2/10 online)." }, false);
                    return SimpleJson.SerializeObject(new
                    {
                        username = botName,
                        avatar_url = avatar,
                        embeds = new[]
                        {
                            new
                            {
                                title = "🔵 Viking Departed",
                                description = "**Lagertha** departed the 10th realm.",
                                color = ColorBlue,
                                fields = new[]
                                {
                                    new { name = "Session Duration", value = "1h 42m", @inline = true },
                                    new { name = "Remaining Online", value = "2 / 10", @inline = true }
                                },
                                footer = new { text = "Bifrostheim • Bigfrost Server Portal" },
                                timestamp = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
                            }
                        }
                    }, false);

                case "death_generic":
                case "death":
                    if (!useEmbed)
                        return SimpleJson.SerializeObject(new { username = botName, avatar_url = avatar, content = "💀 **Bjorn** met their end in the **Swamp**." }, false);
                    return SimpleJson.SerializeObject(new
                    {
                        username = botName,
                        avatar_url = avatar,
                        embeds = new[]
                        {
                            new
                            {
                                title = "💀 Viking Fallen",
                                description = "**Bjorn** met their end in the **Swamp**.",
                                color = ColorRed,
                                fields = new[] { new { name = "Biome", value = "Swamp", @inline = true } },
                                footer = new { text = "Bifrostheim • Bigfrost Server Portal" },
                                timestamp = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
                            }
                        }
                    }, false);

                case "death_skald":
                    if (!useEmbed)
                        return SimpleJson.SerializeObject(new { username = botName, avatar_url = avatar, content = "💀 **Bjorn Ironside** was crushed into dust by a legendary **2-Star Troll** in the **Black Forest**!" }, false);
                    return SimpleJson.SerializeObject(new
                    {
                        username = botName,
                        avatar_url = avatar,
                        embeds = new[]
                        {
                            new
                            {
                                title = "💀 Viking Chronicle • Skald Slaying",
                                description = "**Bjorn Ironside** was crushed into dust by a legendary **2-Star Troll** in the **Black Forest**!",
                                color = ColorRed,
                                fields = new[]
                                {
                                    new { name = "Killer", value = "2-Star Troll", @inline = true },
                                    new { name = "Biome", value = "Black Forest", @inline = true }
                                },
                                footer = new { text = "Skald Chronicle • Bigfrost Server Portal" },
                                timestamp = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
                            }
                        }
                    }, false);

                case "pvp":
                case "pvp_kill":
                    if (!useEmbed)
                        return SimpleJson.SerializeObject(new { username = botName, avatar_url = avatar, content = "⚔️ **Ragnar** vanquished **Ivar** in glorious combat in the **Plains**!" }, false);
                    return SimpleJson.SerializeObject(new
                    {
                        username = botName,
                        avatar_url = avatar,
                        embeds = new[]
                        {
                            new
                            {
                                title = "⚔️ Viking Duel / PvP Slaying",
                                description = "**Ragnar** vanquished **Ivar** in glorious combat in the **Plains**!",
                                color = ColorRed,
                                fields = new[]
                                {
                                    new { name = "Victor", value = "Ragnar", @inline = true },
                                    new { name = "Fallen", value = "Ivar", @inline = true },
                                    new { name = "Biome", value = "Plains", @inline = true }
                                },
                                footer = new { text = "Bifrostheim • Bigfrost Server Portal" },
                                timestamp = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
                            }
                        }
                    }, false);

                case "server_online":
                case "server_start":
                    if (!useEmbed)
                        return SimpleJson.SerializeObject(new { username = botName, avatar_url = avatar, content = "🌲 **Server Online**: Valheim Dedicated Server is ready for connections! (Port: 2456, World: Valhalla)" }, false);
                    return SimpleJson.SerializeObject(new
                    {
                        username = botName,
                        avatar_url = avatar,
                        embeds = new[]
                        {
                            new
                            {
                                title = "🌲 Valheim Server Online",
                                description = "The Bifrost bridge has opened! The dedicated server is now ready for warriors to enter.",
                                color = ColorGreen,
                                fields = new[]
                                {
                                    new { name = "World", value = "Valhalla", @inline = true },
                                    new { name = "Port", value = "2456", @inline = true },
                                    new { name = "Portal Bridge", value = "Active", @inline = true }
                                },
                                footer = new { text = "Bifrostheim • Bigfrost Server Portal" },
                                timestamp = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
                            }
                        }
                    }, false);

                case "server_restart":
                case "restart_warning":
                    if (!useEmbed)
                        return SimpleJson.SerializeObject(new { username = botName, avatar_url = avatar, content = "⏳ **Server Restart Warning**: Automated server restart in 5 minutes. Find shelter!" }, false);
                    return SimpleJson.SerializeObject(new
                    {
                        username = botName,
                        avatar_url = avatar,
                        embeds = new[]
                        {
                            new
                            {
                                title = "⏳ Scheduled Server Restart Warning",
                                description = "The server is scheduled to restart in **5 minutes** for maintenance.\nPlease seek shelter and ensure your progress is saved!",
                                color = ColorOrange,
                                fields = new[] { new { name = "Countdown", value = "5 minutes", @inline = true } },
                                footer = new { text = "Bifrostheim • Bigfrost Server Portal" },
                                timestamp = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
                            }
                        }
                    }, false);

                case "boss_summon":
                    if (!useEmbed)
                        return SimpleJson.SerializeObject(new { username = botName, avatar_url = avatar, content = "⚡ **Moder** has answered the call of sacrifice in the **Mountain**!" }, false);
                    return SimpleJson.SerializeObject(new
                    {
                        username = botName,
                        avatar_url = avatar,
                        embeds = new[]
                        {
                            new
                            {
                                title = "⚡ Forsaken Awakened!",
                                description = "**Moder** has answered the call of sacrifice in the **Mountain**!",
                                color = ColorGold,
                                fields = new[]
                                {
                                    new { name = "Forsaken", value = "Moder", @inline = true },
                                    new { name = "Biome", value = "Mountain", @inline = true }
                                },
                                footer = new { text = "Bifrostheim • Bigfrost Server Portal" },
                                timestamp = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
                            }
                        }
                    }, false);

                case "boss_defeat":
                    if (!useEmbed)
                        return SimpleJson.SerializeObject(new { username = botName, avatar_url = avatar, content = "🏆 The ancient dragon **Moder** has been vanquished from the 10th realm!" }, false);
                    return SimpleJson.SerializeObject(new
                    {
                        username = botName,
                        avatar_url = avatar,
                        embeds = new[]
                        {
                            new
                            {
                                title = "🏆 Forsaken Slain!",
                                description = "The ancient dragon **Moder** has been vanquished from the 10th realm! Odin smiles upon the victorious.",
                                color = ColorGold,
                                fields = new[]
                                {
                                    new { name = "Forsaken", value = "Moder", @inline = true },
                                    new { name = "Status", value = "Vanquished", @inline = true }
                                },
                                footer = new { text = "Bifrostheim • Bigfrost Server Portal" },
                                timestamp = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
                            }
                        }
                    }, false);

                case "raid_start":
                    if (!useEmbed)
                        return SimpleJson.SerializeObject(new { username = botName, avatar_url = avatar, content = "⚡ **Raid Event Started**: \"The ground is shaking\" in the **Black Forest**!" }, false);
                    return SimpleJson.SerializeObject(new
                    {
                        username = botName,
                        avatar_url = avatar,
                        embeds = new[]
                        {
                            new
                            {
                                title = "⚡ Raid Event Started!",
                                description = "**\"The ground is shaking\"**\nA troll raid has begun in the **Black Forest**! Defend your homesteads!",
                                color = ColorOrange,
                                fields = new[]
                                {
                                    new { name = "Event", value = "The ground is shaking", @inline = true },
                                    new { name = "Biome", value = "Black Forest", @inline = true }
                                },
                                footer = new { text = "Bifrostheim • Bigfrost Server Portal" },
                                timestamp = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
                            }
                        }
                    }, false);

                case "raid_end":
                    if (!useEmbed)
                        return SimpleJson.SerializeObject(new { username = botName, avatar_url = avatar, content = "🌤️ **Raid Event Ended**: The ground stops shaking in the **Black Forest**." }, false);
                    return SimpleJson.SerializeObject(new
                    {
                        username = botName,
                        avatar_url = avatar,
                        embeds = new[]
                        {
                            new
                            {
                                title = "🌤️ Raid Event Ended",
                                description = "The tremors subside. The raid in the **Black Forest** has been repelled.",
                                color = ColorBlue,
                                fields = new[]
                                {
                                    new { name = "Event", value = "The ground is shaking", @inline = true },
                                    new { name = "Status", value = "Repelled", @inline = true }
                                },
                                footer = new { text = "Bifrostheim • Bigfrost Server Portal" },
                                timestamp = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
                            }
                        }
                    }, false);

                case "admin_kick":
                case "admin_ban":
                case "admin":
                    string action = eventType.Contains("ban") ? "Banned" : "Kicked";
                    if (!useEmbed)
                        return SimpleJson.SerializeObject(new { username = botName, avatar_url = avatar, content = $"🔨 **Admin Action**: Player **Gunnar** was {action.ToLower()}ed by **Admin** (Reason: Griefing longhouse)." }, false);
                    return SimpleJson.SerializeObject(new
                    {
                        username = botName,
                        avatar_url = avatar,
                        embeds = new[]
                        {
                            new
                            {
                                title = $"🔨 Admin Action: Player {action}",
                                description = $"**Gunnar** was {action.ToLower()}ed from the server by **Admin**.",
                                color = ColorPurple,
                                fields = new[]
                                {
                                    new { name = "Target", value = "Gunnar", @inline = true },
                                    new { name = "Moderator", value = "Admin", @inline = true },
                                    new { name = "Reason", value = "Griefing longhouse perimeter", @inline = false }
                                },
                                footer = new { text = "Bifrostheim • Bigfrost Server Portal" },
                                timestamp = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
                            }
                        }
                    }, false);

                case "shout":
                case "chat":
                    if (!useEmbed)
                        return SimpleJson.SerializeObject(new { username = botName, avatar_url = avatar, content = "📢 **Torstein** shouted: \"To the longships! The serpents approach!\"" }, false);
                    return SimpleJson.SerializeObject(new
                    {
                        username = botName,
                        avatar_url = avatar,
                        embeds = new[]
                        {
                            new
                            {
                                author = new { name = "Torstein" },
                                description = "📢 \"To the longships! The serpents approach!\"",
                                color = ColorSlate,
                                footer = new { text = "In-Game Shout" },
                                timestamp = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
                            }
                        }
                    }, false);

                default:
                    return SimpleJson.SerializeObject(new
                    {
                        username = botName,
                        avatar_url = avatar,
                        embeds = new[]
                        {
                            new
                            {
                                title = "⚔️ Bifrostheim Webhook Test",
                                description = "Discord webhook bridge is active and operational.",
                                color = ColorGold,
                                footer = new { text = "Bifrostheim • Bigfrost Server Portal" },
                                timestamp = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
                            }
                        }
                    }, false);
            }
        }

        private static string GetBotName()
        {
            string name = BifrostheimPlugin.DiscordBotUsername?.Value?.Trim() ?? "";
            return string.IsNullOrWhiteSpace(name) ? "Bifrostheim Herald" : name;
        }

        private static string GetBotAvatar()
        {
            return BifrostheimPlugin.DiscordBotAvatarUrl?.Value?.Trim() ?? "";
        }

        private static string EscapeMarkdown(string text)
        {
            if (string.IsNullOrEmpty(text)) return string.Empty;
            return text.Replace("*", "\\*").Replace("_", "\\_").Replace("~", "\\~").Replace("`", "\\`");
        }

        private static string FormatDuration(TimeSpan span)
        {
            if (span.TotalHours >= 1)
            {
                return $"{(int)span.TotalHours}h {span.Minutes}m";
            }
            if (span.TotalMinutes >= 1)
            {
                return $"{span.Minutes}m {span.Seconds}s";
            }
            return $"{Math.Max(1, span.Seconds)}s";
        }
    }
}
