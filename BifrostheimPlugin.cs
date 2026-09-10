using System;
using System.Security.Cryptography;
using BepInEx;
using BepInEx.Configuration;
using BepInEx.Logging;
using Bifrostheim.Helpers;
using Bifrostheim.Systems.Web;
using UnityEngine;

namespace Bifrostheim
{
    [BepInPlugin(PluginGUID, PluginName, PluginVersion)]
    public class BifrostheimPlugin : BaseUnityPlugin
    {
        public const string PluginGUID = "com.bigai.bigfrost_serverportal";
        public const string PluginName = "Bigfrost_ServerPortal";
        public const string PluginVersion = "1.0.2";

        public static BifrostheimPlugin Instance { get; private set; } = null!;
        public static ManualLogSource Log { get; private set; } = null!;

        public static ConfigEntry<bool> EnableWebPortal = null!;
        public static ConfigEntry<int> WebPortalPort = null!;
        public static ConfigEntry<string> WebAdminPassword = null!;
        public static ConfigEntry<bool> VerboseLogging = null!;
        public static ConfigEntry<string> LifecycleRestartMode = null!;
        public static ConfigEntry<string> LifecycleScriptPath = null!;
        public static ConfigEntry<bool> DailyRestartEnabled = null!;
        public static ConfigEntry<string> DailyRestartTime = null!;

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
                LifecycleRestartMode = Config.Bind("Lifecycle", "RestartMode", "ExitOnly", "Server restart strategy: ExitOnly or SpawnProcess.");
                LifecycleScriptPath = Config.Bind("Lifecycle", "RestartScriptPath", "./start_server.sh", "Path to external restart script when RestartMode is SpawnProcess.");
                DailyRestartEnabled = Config.Bind("Lifecycle", "DailyRestartEnabled", false, "Enable automated daily server restart.");
                DailyRestartTime = Config.Bind("Lifecycle", "DailyRestartTime", "04:00", "Daily restart time in 24h format (HH:mm).");

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
                    Log.LogWarning($"[{PluginName}] Generated new secure random admin password: {newPassword}");
                }

                Log.LogInfo($"[{PluginName}] Web Portal Admin Password: {WebAdminPassword.Value}");

                // Initialize Unity dispatcher, player helpers, and log listener
                MainThreadDispatcher.Initialize();
                ConfigSyncManager.OnlinePlayerChecker = ZNetHelper.IsPlayerOnline;
                BepInEx.Logging.Logger.Listeners.Add(new BepInExLogListener());

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

            WebApiRouter.TickLifecycle();
        }

        private void OnDestroy()
        {
            if (_isClient) return;
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
