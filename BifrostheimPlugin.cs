using System;
using System.Security.Cryptography;
using BepInEx;
using BepInEx.Configuration;
using BepInEx.Logging;
using Bifrostheim.Helpers;
using Bifrostheim.Systems.Discord;
using Bifrostheim.Systems.Web;
using UnityEngine;

namespace Bifrostheim
{
    [BepInPlugin(PluginGUID, PluginName, PluginVersion)]
    public class BifrostheimPlugin : BaseUnityPlugin
    {
        public const string PluginGUID = "com.bigai.bigfrost_serverportal";
        public const string PluginName = "Bigfrost_ServerPortal";
        public const string PluginVersion = "1.1.0";

        public static BifrostheimPlugin Instance { get; private set; } = null!;
        public static ManualLogSource Log { get; private set; } = null!;

        public static ConfigEntry<bool> EnableWebPortal = null!;
        public static ConfigEntry<int> WebPortalPort = null!;
        public static ConfigEntry<string> WebAdminPassword = null!;
        public static ConfigEntry<bool> VerboseLogging = null!;
        public static ConfigEntry<float> PlayerHealthPollInterval = null!;
        public static ConfigEntry<string> LifecycleRestartMode = null!;
        public static ConfigEntry<string> LifecycleScriptPath = null!;
        public static ConfigEntry<bool> DailyRestartEnabled = null!;
        public static ConfigEntry<string> DailyRestartTime = null!;

        // ── Discord Webhook Config ─────────────────────────────────────────────
        public static ConfigEntry<bool> DiscordEnabled = null!;
        public static ConfigEntry<string> DiscordWebhookUrl = null!;
        public static ConfigEntry<string> DiscordOverrideChatWebhookUrl = null!;
        public static ConfigEntry<string> DiscordOverrideAdminWebhookUrl = null!;
        public static ConfigEntry<string> DiscordBotUsername = null!;
        public static ConfigEntry<string> DiscordBotAvatarUrl = null!;
        public static ConfigEntry<bool> DiscordUseRichEmbeds = null!;
        public static ConfigEntry<bool> DiscordNotifyPlayerJoin = null!;
        public static ConfigEntry<bool> DiscordNotifyPlayerLeave = null!;
        public static ConfigEntry<bool> DiscordNotifyPlayerDeath = null!;
        public static ConfigEntry<bool> DiscordNotifyServerLifecycle = null!;
        public static ConfigEntry<bool> DiscordNotifyWorldEvents = null!;
        public static ConfigEntry<bool> DiscordNotifyBossMilestones = null!;
        public static ConfigEntry<bool> DiscordNotifyAdminActions = null!;
        public static ConfigEntry<bool> DiscordNotifyChatShouts = null!;

        public static int CurrentFps { get; private set; } = 60;
        private static float _fpsAccumulator = 60f;
        private static bool _isClient;

        private void Awake()
        {
            Instance = this;
            Log = Logger;

            try
            {
                Log.LogInfo("══════════════════════════════════════════");
                Log.LogInfo($"  {PluginName} v{PluginVersion} loading...");
                Log.LogInfo("══════════════════════════════════════════");

                // Config binding
                EnableWebPortal = Config.Bind("WebPortal", "EnableWebPortal", true, "Enable the embedded web management portal.");
                WebPortalPort = Config.Bind("WebPortal", "WebPortalPort", 8080, "Port for the embedded web management portal.");
                WebAdminPassword = Config.Bind("WebPortal", "WebAdminPassword", string.Empty, "Password required for administrative actions in the web portal.");
                VerboseLogging = Config.Bind("General", "VerboseLogging", false, "Enable verbose logging in BepInEx console.");
                PlayerHealthPollInterval = Config.Bind("General", "PlayerHealthPollInterval", 1.0f, new ConfigDescription("Interval in seconds between player health and death monitoring polls. Default is 1.0s.", new AcceptableValueRange<float>(0.2f, 5.0f)));
                LifecycleRestartMode = Config.Bind("Lifecycle", "RestartMode", "ExitOnly", "Server restart strategy: ExitOnly or SpawnProcess.");
                LifecycleScriptPath = Config.Bind("Lifecycle", "RestartScriptPath", "./start_server.sh", "Path to external restart script when RestartMode is SpawnProcess.");
                DailyRestartEnabled = Config.Bind("Lifecycle", "DailyRestartEnabled", false, "Enable automated daily server restart.");
                DailyRestartTime = Config.Bind("Lifecycle", "DailyRestartTime", "04:00", "Daily restart time in 24h format (HH:mm).");

                // Discord Webhook bindings
                DiscordEnabled = Config.Bind("DiscordWebhook", "Enabled", false, "Enable Discord Webhook notifications.");
                DiscordWebhookUrl = Config.Bind("DiscordWebhook", "WebhookUrl", string.Empty, "Primary Discord Webhook URL for server notifications.");
                DiscordOverrideChatWebhookUrl = Config.Bind("DiscordWebhook", "OverrideChatWebhookUrl", string.Empty, "Optional dedicated webhook URL for in-game chat/shout relay.");
                DiscordOverrideAdminWebhookUrl = Config.Bind("DiscordWebhook", "OverrideAdminWebhookUrl", string.Empty, "Optional dedicated webhook URL for admin punishment alerts.");
                DiscordBotUsername = Config.Bind("DiscordWebhook", "BotUsername", "Bifrostheim Herald", "Display name used for Discord webhook messages.");
                DiscordBotAvatarUrl = Config.Bind("DiscordWebhook", "BotAvatarUrl", string.Empty, "Avatar image URL used for Discord webhook messages.");
                DiscordUseRichEmbeds = Config.Bind("DiscordWebhook", "UseRichEmbeds", true, "Send rich Discord embeds (set to false for minimalist markdown plain text).");
                DiscordNotifyPlayerJoin = Config.Bind("DiscordWebhook", "NotifyPlayerJoin", true, "Send notification when a player joins.");
                DiscordNotifyPlayerLeave = Config.Bind("DiscordWebhook", "NotifyPlayerLeave", true, "Send notification when a player leaves.");
                DiscordNotifyPlayerDeath = Config.Bind("DiscordWebhook", "NotifyPlayerDeath", true, "Send notification when a player dies or is slain in PvP.");
                DiscordNotifyServerLifecycle = Config.Bind("DiscordWebhook", "NotifyServerLifecycle", true, "Send notification on server startup, shutdown, and restart warnings.");
                DiscordNotifyWorldEvents = Config.Bind("DiscordWebhook", "NotifyWorldEvents", true, "Send notification when raids start and end.");
                DiscordNotifyBossMilestones = Config.Bind("DiscordWebhook", "NotifyBossMilestones", true, "Send notification when a Forsaken boss is summoned or defeated.");
                DiscordNotifyAdminActions = Config.Bind("DiscordWebhook", "NotifyAdminActions", true, "Send notification when admin kicks or bans a player.");
                DiscordNotifyChatShouts = Config.Bind("DiscordWebhook", "NotifyChatShouts", false, "Relay in-game /s shouts to Discord.");

                // Client environment guard
                if (SystemInfo.graphicsDeviceType != UnityEngine.Rendering.GraphicsDeviceType.Null)
                {
                    _isClient = true;
                    Log.LogWarning($"[{PluginName}] Client environment detected (GraphicsDevice: {SystemInfo.graphicsDeviceType}). " +
                                   $"{PluginName} is designed exclusively for Valheim dedicated servers. " +
                                   "The embedded web management server will not be started on client instances.");
                    return;
                }

                // Enforce random admin password if unset or set to legacy default 'admin'
                if (string.IsNullOrWhiteSpace(WebAdminPassword.Value) || string.Equals(WebAdminPassword.Value.Trim(), "admin", StringComparison.OrdinalIgnoreCase))
                {
                    string newPassword = GenerateRandomPassword(16);
                    WebAdminPassword.Value = newPassword;
                    Config.Save();
                    Log.LogWarning($"[{PluginName}] Generated new secure random admin password. Please check configuration file.");
                }

                Log.LogInfo($"[{PluginName}] Web Portal active. Admin password is configured in BepInEx/config/com.bigai.bigfrost_serverportal.cfg [WebPortal.WebAdminPassword]");

                // Initialize player helpers and log listener
                ConfigSyncManager.OnlinePlayerChecker = ZNetHelper.IsPlayerOnline;
                BepInEx.Logging.Logger.Listeners.Add(new BepInExLogListener());

                // Initialize Discord dispatcher & event patches
                DiscordWebhookDispatcher.Initialize();
                DiscordEventPatches.ApplyPatches();

                // Start WebPortal if enabled
                if (EnableWebPortal.Value)
                {
                    WebPortalServer.Start(WebPortalPort.Value, WebAdminPassword.Value);
                }

                Log.LogInfo($"[{PluginName}] Initialized successfully.");
            }
            catch (Exception ex)
            {
                Log.LogError($"[{PluginName}] Failed to initialize: {ex}");
            }
        }

        private void Update()
        {
            if (_isClient) return;

            float dt = Time.unscaledDeltaTime;
            if (dt > 0.0001f)
            {
                _fpsAccumulator += ((1.0f / dt) - _fpsAccumulator) * 0.1f;
                CurrentFps = (int)Math.Round(_fpsAccumulator);
            }

            MainThreadDispatcher.PumpQueue(25);
            WebApiRouter.TickLifecycle();
            DiscordEventPatches.TickPlayerHealthMonitoring(dt);
        }

        private void OnDestroy()
        {
            if (_isClient) return;
            if (DiscordEnabled != null && DiscordEnabled.Value)
            {
                DiscordWebhookDispatcher.OnServerLifecycle("🛑 Server Shutting Down", "The dedicated server is shutting down. Safe travels!", DiscordWebhookDispatcher.ColorRed);
            }
            DiscordEventPatches.RemovePatches();
            DiscordWebhookDispatcher.Shutdown();
            WebPortalServer.Stop();
            Log.LogInfo($"[{PluginName}] Unloaded.");
        }

        private static string GenerateRandomPassword(int length = 16)
        {
            const string chars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
            var bytes = new byte[length];
            using (var rng = RandomNumberGenerator.Create())
            {
                rng.GetBytes(bytes);
            }
            var result = new char[length];
            for (int i = 0; i < length; i++)
            {
                result[i] = chars[bytes[i] % chars.Length];
            }
            return new string(result);
        }
    }
}
