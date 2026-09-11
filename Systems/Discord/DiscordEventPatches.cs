using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Reflection;
using HarmonyLib;
using UnityEngine;
using Bifrostheim.Helpers;

namespace Bifrostheim.Systems.Discord
{
    public static class DiscordEventPatches
    {
        private static Harmony? _harmony;
        private static readonly ConcurrentDictionary<string, DateTime> _sessionStartTimes = new ConcurrentDictionary<string, DateTime>(StringComparer.OrdinalIgnoreCase);
        private static readonly ConcurrentDictionary<string, float> _playerLastHealth = new ConcurrentDictionary<string, float>(StringComparer.OrdinalIgnoreCase);
        private static readonly ConcurrentDictionary<string, byte> _knownGlobalKeys = new ConcurrentDictionary<string, byte>(StringComparer.OrdinalIgnoreCase);
        private static RandomEvent? _activeRaid;
        private static string _activeRaidBiome = "";
        private static float _healthCheckTimer = 0f;

        // Cached reflection handles for Skald
        private static bool _skaldReflectionInitialized = false;
        private static MethodInfo? _skaldGetRecentDeathsMethod;
        private static PropertyInfo? _skaldVictimProp;
        private static PropertyInfo? _skaldKillerProp;
        private static PropertyInfo? _skaldFormattedLoreProp;

        public static void ApplyPatches()
        {
            if (_harmony != null) return;

            try
            {
                _harmony = new Harmony("com.bigai.bigfrost_serverportal.discord");

                var patchClasses = new[]
                {
                    typeof(ServerReadyPatch),
                    typeof(PlayerJoinPatch),
                    typeof(PlayerLeavePatch),
                    typeof(ZoneSystemStartPatch),
                    typeof(BossDefeatedKeyPatch),
                    typeof(BossDefeatedKeyEnumPatch),
                    typeof(RaidStartPatch),
                    typeof(RaidEndPatch),
                    typeof(ChatShoutPatch)
                };

                int successCount = 0;
                foreach (var patchClass in patchClasses)
                {
                    try
                    {
                        _harmony.PatchAll(patchClass);
                        successCount++;
                        BifrostheimPlugin.Log?.LogInfo($"[Discord] Harmony patch applied: {patchClass.Name}");
                    }
                    catch (Exception ex)
                    {
                        BifrostheimPlugin.Log?.LogError($"[Discord] Failed to apply {patchClass.Name}: {ex.Message}");
                    }
                }

                BifrostheimPlugin.Log?.LogInfo($"[Discord] Harmony event patches initialized ({successCount}/{patchClasses.Length} active).");
            }
            catch (Exception ex)
            {
                BifrostheimPlugin.Log?.LogError($"[Discord] Fatal error initializing event patches: {ex}");
            }
        }

        public static void RemovePatches()
        {
            try
            {
                _harmony?.UnpatchSelf();
                _harmony = null;
                _sessionStartTimes.Clear();
                _playerLastHealth.Clear();
            }
            catch (Exception ex)
            {
                BifrostheimPlugin.Log?.LogDebug($"[DiscordEventPatches] Failed to cleanly unpatch Harmony: {ex.Message}");
            }
        }

        // ── 0. Server Ready Patch ─────────────────────────────────────────────────
        [HarmonyPatch(typeof(ZNet), "Awake")]
        internal static class ServerReadyPatch
        {
            [HarmonyPostfix]
            private static void Postfix()
            {
                try
                {
                    if (ZNet.instance != null && ZNet.instance.IsServer() && (BifrostheimPlugin.DiscordEnabled?.Value ?? false))
                    {
                        DiscordWebhookDispatcher.OnServerLifecycle("🌲 Server Online", "Valheim dedicated server is online and ready for warriors.", DiscordWebhookDispatcher.ColorGreen);
                    }
                }
                catch (Exception ex)
                {
                    BifrostheimPlugin.Log?.LogWarning($"[Discord] Error in Server Online patch: {ex.Message}");
                }
            }
        }

        // ── 1. Player Join Patch ──────────────────────────────────────────────────
        [HarmonyPatch(typeof(ZNet), "RPC_PeerInfo")]
        internal static class PlayerJoinPatch
        {
            [HarmonyPostfix]
            private static void Postfix(ZRpc rpc)
            {
                try
                {
                    if (ZNet.instance == null || !ZNet.instance.IsServer()) return;

                    var peer = ZNetHelper.GetPeerByRpc(rpc);
                    if (peer == null || string.IsNullOrWhiteSpace(peer.m_playerName)) return;

                    string playerName = peer.m_playerName.Trim();
                    string playerId = ZNetHelper.GetPlayerId(peer);
                    string trackingKey = !string.IsNullOrWhiteSpace(playerId) ? playerId : playerName;

                    _sessionStartTimes[trackingKey] = DateTime.UtcNow;

                    int onlineCount = ZNetHelper.GetPeers().Count;
                    int maxSlots = ZNetHelper.GetServerPlayerLimit();

                    BifrostheimPlugin.Log?.LogInfo($"[Discord] Player joined: '{playerName}' ({onlineCount}/{maxSlots}).");
                    DiscordWebhookDispatcher.OnPlayerJoin(playerName, onlineCount, maxSlots);
                }
                catch (Exception ex)
                {
                    BifrostheimPlugin.Log?.LogWarning($"[Discord] Error in Join patch: {ex.Message}");
                }
            }
        }

        // ── 2. Player Leave Patch ─────────────────────────────────────────────────
        [HarmonyPatch(typeof(ZNet), "Disconnect")]
        internal static class PlayerLeavePatch
        {
            [HarmonyPrefix]
            private static void Prefix(ZNetPeer peer)
            {
                try
                {
                    if (ZNet.instance == null || !ZNet.instance.IsServer() || peer == null) return;
                    if (string.IsNullOrWhiteSpace(peer.m_playerName)) return;

                    string playerName = peer.m_playerName.Trim();
                    string playerId = ZNetHelper.GetPlayerId(peer);
                    string trackingKey = !string.IsNullOrWhiteSpace(playerId) ? playerId : playerName;

                    TimeSpan duration = TimeSpan.Zero;
                    if (_sessionStartTimes.TryRemove(trackingKey, out var start))
                    {
                        duration = DateTime.UtcNow - start;
                    }

                    _playerLastHealth.TryRemove(trackingKey, out _);

                    int remaining = Math.Max(0, ZNetHelper.GetPeers().Count - 1);
                    int maxSlots = ZNetHelper.GetServerPlayerLimit();

                    BifrostheimPlugin.Log?.LogInfo($"[Discord] Player left: '{playerName}' (session: {duration.TotalMinutes:F1}m).");
                    DiscordWebhookDispatcher.OnPlayerLeave(playerName, duration, remaining, maxSlots);
                }
                catch (Exception ex)
                {
                    BifrostheimPlugin.Log?.LogWarning($"[Discord] Error in Leave patch: {ex.Message}");
                }
            }
        }

        // ── 3. Player Death Polling Tick (Runs from BifrostheimPlugin.Update) ──────
        public static void TickPlayerHealthMonitoring(float dt)
        {
            if (ZNet.instance == null || !ZNet.instance.IsServer()) return;

            _healthCheckTimer += dt;
            float interval = BifrostheimPlugin.PlayerHealthPollInterval?.Value ?? 1.0f;
            if (_healthCheckTimer < interval) return;
            _healthCheckTimer = 0f;

            try
            {
                var peers = ZNetHelper.GetPeers();
                foreach (var peer in peers)
                {
                    if (peer == null || string.IsNullOrWhiteSpace(peer.m_playerName) || peer.m_characterID == ZDOID.None)
                        continue;

                    string playerId = ZNetHelper.GetPlayerId(peer);
                    string trackingKey = !string.IsNullOrWhiteSpace(playerId) ? playerId : peer.m_playerName;

                    var zdo = ZDOMan.instance?.GetZDO(peer.m_characterID);
                    if (zdo == null) continue;

                    float currentHealth = zdo.GetFloat("health", 25f);
                    bool isDeadFlag = zdo.GetBool("dead", false);

                    if (_playerLastHealth.TryGetValue(trackingKey, out float lastHealth))
                    {
                        if ((currentHealth <= 0.001f || isDeadFlag) && lastHealth > 0.001f)
                        {
                            HandlePlayerDeath(peer);
                        }
                    }

                    _playerLastHealth[trackingKey] = isDeadFlag ? 0f : currentHealth;
                }
            }
            catch (Exception ex)
            {
                BifrostheimPlugin.Log?.LogDebug($"[DiscordEventPatches] Player health monitor error: {ex.Message}");
            }
        }

        private static void EnsureSkaldReflection()
        {
            if (_skaldReflectionInitialized) return;
            _skaldReflectionInitialized = true;

            try
            {
                foreach (var asm in AppDomain.CurrentDomain.GetAssemblies())
                {
                    if (asm.GetName().Name == "Skald" || asm.GetName().Name == "Skald_VikingKillFeed")
                    {
                        var regType = asm.GetType("Skald.Logic.ChronicleRegistry");
                        _skaldGetRecentDeathsMethod = regType?.GetMethod("GetRecentDeaths", BindingFlags.Public | BindingFlags.Static);
                        break;
                    }
                }
            }
            catch (Exception ex)
            {
                BifrostheimPlugin.Log?.LogDebug($"[DiscordEventPatches] EnsureSkaldReflection error: {ex.Message}");
            }
        }

        private static void HandlePlayerDeath(ZNetPeer peer)
        {
            try
            {
                string victimName = peer.m_playerName.Trim();
                Vector3 pos = peer.m_refPos;
                string biome = "Meadows";

                try
                {
                    if (WorldGenerator.instance != null)
                    {
                        biome = WorldGenerator.instance.GetBiome(pos.x, pos.z).ToString();
                    }
                }
                catch (Exception ex)
                {
                    BifrostheimPlugin.Log?.LogDebug($"[DiscordEventPatches] Biome resolve error on player death: {ex.Message}");
                }

                // Check Skald Chronicle if available (cached reflection)
                string? killerName = null;
                string? formattedLore = null;

                try
                {
                    EnsureSkaldReflection();
                    if (_skaldGetRecentDeathsMethod != null)
                    {
                        var list = _skaldGetRecentDeathsMethod.Invoke(null, new object[] { 5 }) as System.Collections.IEnumerable;
                        if (list != null)
                        {
                            foreach (var item in list)
                            {
                                if (item == null) continue;
                                var t = item.GetType();
                                if (_skaldVictimProp == null)
                                {
                                    _skaldVictimProp = t.GetProperty("VictimName");
                                    _skaldKillerProp = t.GetProperty("KillerName");
                                    _skaldFormattedLoreProp = t.GetProperty("FormattedMessage");
                                }

                                string vName = _skaldVictimProp?.GetValue(item)?.ToString() ?? "";
                                if (string.Equals(vName, victimName, StringComparison.OrdinalIgnoreCase))
                                {
                                    killerName = _skaldKillerProp?.GetValue(item)?.ToString();
                                    formattedLore = _skaldFormattedLoreProp?.GetValue(item)?.ToString();
                                    break;
                                }
                            }
                        }
                    }
                }
                catch (Exception ex)
                {
                    BifrostheimPlugin.Log?.LogDebug($"[DiscordEventPatches] Error querying Skald kill feed: {ex.Message}");
                }

                BifrostheimPlugin.Log?.LogInfo($"[Discord] Detected player death: '{victimName}' in biome '{biome}'.");
                DiscordWebhookDispatcher.OnPlayerDeath(victimName, biome, killerName, formattedLore);
            }
            catch (Exception ex)
            {
                BifrostheimPlugin.Log?.LogWarning($"[Discord] Error handling player death: {ex.Message}");
            }
        }

        // ── 4. Boss Defeated Patch (ZoneSystem.SetGlobalKey) ──────────────────────
        [HarmonyPatch(typeof(ZoneSystem), "Start")]
        internal static class ZoneSystemStartPatch
        {
            [HarmonyPostfix]
            private static void Postfix()
            {
                try
                {
                    var globalKeys = ZoneSystem.instance?.GetGlobalKeys();
                    if (globalKeys != null)
                    {
                        foreach (string key in globalKeys)
                        {
                            if (!string.IsNullOrWhiteSpace(key))
                            {
                                _knownGlobalKeys.TryAdd(key.Trim().ToLowerInvariant(), 0);
                            }
                        }
                    }
                }
                catch (Exception ex)
                {
                    BifrostheimPlugin.Log?.LogDebug($"[DiscordEventPatches] Error caching initial global keys: {ex.Message}");
                }
            }
        }

        [HarmonyPatch(typeof(ZoneSystem), "SetGlobalKey", new[] { typeof(string) })]
        internal static class BossDefeatedKeyPatch
        {
            [HarmonyPostfix]
            private static void Postfix(string name)
            {
                ProcessGlobalKey(name);
            }
        }

        [HarmonyPatch(typeof(ZoneSystem), "SetGlobalKey", new[] { typeof(GlobalKeys) })]
        internal static class BossDefeatedKeyEnumPatch
        {
            [HarmonyPostfix]
            private static void Postfix(GlobalKeys key)
            {
                ProcessGlobalKey(key.ToString());
            }
        }

        internal static void ProcessGlobalKey(string? rawKey)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(rawKey)) return;
                string key = rawKey!.Trim().ToLowerInvariant();

                if (_knownGlobalKeys.ContainsKey(key)) return;
                _knownGlobalKeys.TryAdd(key, 0);

                string? bossName = null;
                string biome = "Meadows";

                if (key == "defeated_eikthyr") { bossName = "Eikthyr"; biome = "Meadows"; }
                else if (key == "defeated_gdking") { bossName = "The Elder"; biome = "Black Forest"; }
                else if (key == "defeated_bonemass") { bossName = "Bonemass"; biome = "Swamp"; }
                else if (key == "defeated_dragon") { bossName = "Moder"; biome = "Mountain"; }
                else if (key == "defeated_goblinking") { bossName = "Yagluth"; biome = "Plains"; }
                else if (key == "defeated_queen") { bossName = "The Queen"; biome = "Mistlands"; }
                else if (key == "defeated_fader") { bossName = "Fader"; biome = "Ashlands"; }

                if (bossName != null)
                {
                    BifrostheimPlugin.Log?.LogInfo($"[Discord] Detected boss milestone: '{bossName}' ({key}).");
                    DiscordWebhookDispatcher.OnBossEvent(bossName, biome, true);
                }
            }
            catch (Exception ex)
            {
                BifrostheimPlugin.Log?.LogWarning($"[Discord] Error in Boss Defeated patch: {ex.Message}");
            }
        }

        // ── 5. World Raids / Random Events Patches ────────────────────────────────
        [HarmonyPatch(typeof(RandEventSystem), "SetRandomEvent")]
        internal static class RaidStartPatch
        {
            [HarmonyPostfix]
            private static void Postfix(RandomEvent ev, Vector3 pos)
            {
                try
                {
                    if (ev == null) return;
                    _activeRaid = ev;

                    string biome = "Meadows";
                    try
                    {
                        if (WorldGenerator.instance != null)
                        {
                            biome = WorldGenerator.instance.GetBiome(pos.x, pos.z).ToString();
                        }
                    }
                    catch (Exception ex)
                    {
                        BifrostheimPlugin.Log?.LogDebug($"[DiscordEventPatches] Failed to query raid biome from WorldGenerator: {ex.Message}");
                    }

                    string text = !string.IsNullOrWhiteSpace(ev.m_startMessage) ? ev.m_startMessage : ev.m_name;
                    _activeRaidBiome = biome;
                    BifrostheimPlugin.Log?.LogInfo($"[Discord] Detected raid start: '{ev.m_name}' in {biome}.");
                    DiscordWebhookDispatcher.OnRaidEvent(ev.m_name, text, biome, true);
                }
                catch (Exception ex)
                {
                    BifrostheimPlugin.Log?.LogWarning($"[Discord] Error in Raid Start patch: {ex.Message}");
                }
            }
        }

        [HarmonyPatch(typeof(RandEventSystem), "ResetRandomEvent")]
        internal static class RaidEndPatch
        {
            [HarmonyPostfix]
            private static void Postfix()
            {
                try
                {
                    if (_activeRaid != null)
                    {
                        var raid = _activeRaid;
                        string biome = _activeRaidBiome;
                        _activeRaid = null;
                        _activeRaidBiome = "";
                        BifrostheimPlugin.Log?.LogInfo($"[Discord] Detected raid end: '{raid.m_name}'.");
                        DiscordWebhookDispatcher.OnRaidEvent(raid.m_name, "", biome, false);
                    }
                }
                catch (Exception ex)
                {
                    BifrostheimPlugin.Log?.LogWarning($"[Discord] Error in Raid End patch: {ex.Message}");
                }
            }
        }

        // ── 6. Chat Shout Relay Patch ─────────────────────────────────────────────
        [HarmonyPatch(typeof(Chat), "RPC_ChatMessage")]
        internal static class ChatShoutPatch
        {
            [HarmonyPostfix]
            private static void Postfix(long sender, Vector3 position, int type, UserInfo userInfo, string text)
            {
                try
                {
                    if (type != (int)Talker.Type.Shout) return;
                    if (string.IsNullOrWhiteSpace(text)) return;

                    string senderName = userInfo.Name ?? "";
                    if (string.IsNullOrWhiteSpace(senderName) && ZNet.instance != null)
                    {
                        var peer = ZNet.instance.GetPeer(sender);
                        if (peer != null && !string.IsNullOrWhiteSpace(peer.m_playerName))
                        {
                            senderName = peer.m_playerName.Trim();
                        }
                    }

                    if (string.IsNullOrWhiteSpace(senderName) || string.Equals(senderName, "Server", StringComparison.OrdinalIgnoreCase))
                        return;

                    BifrostheimPlugin.Log?.LogInfo($"[Discord] Relaying chat shout from '{senderName}'.");
                    DiscordWebhookDispatcher.OnChatShout(senderName, text.Trim());
                }
                catch (Exception ex)
                {
                    BifrostheimPlugin.Log?.LogDebug($"[DiscordEventPatches] Error in Chat shout patch: {ex.Message}");
                }
            }
        }
    }
}
