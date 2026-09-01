using System;
using BepInEx;
using BepInEx.Configuration;
using BepInEx.Logging;
using Bifrostheim.Helpers;
using Bifrostheim.Systems.Web;

namespace Bifrostheim
{
    [BepInPlugin(PluginGUID, PluginName, PluginVersion)]
    public class BifrostheimPlugin : BaseUnityPlugin
    {
        public const string PluginGUID = "com.bigai.bigfrost_serverportal";
        public const string PluginName = "Bigfrost_ServerPortal";
        public const string PluginVersion = "1.0.0";

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
                WebAdminPassword = Config.Bind("WebPortal", "WebAdminPassword", "admin", "Password required for administrative actions in the web portal.");
                VerboseLogging = Config.Bind("General", "VerboseLogging", false, "Enable verbose logging in BepInEx console.");
                LifecycleRestartMode = Config.Bind("Lifecycle", "RestartMode", "ExitOnly", "Server restart strategy: ExitOnly or SpawnProcess.");
                LifecycleScriptPath = Config.Bind("Lifecycle", "RestartScriptPath", "./start_server.sh", "Path to external restart script when RestartMode is SpawnProcess.");
                DailyRestartEnabled = Config.Bind("Lifecycle", "DailyRestartEnabled", false, "Enable automated daily server restart.");
                DailyRestartTime = Config.Bind("Lifecycle", "DailyRestartTime", "04:00", "Daily restart time in 24h format (HH:mm).");

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
            WebApiRouter.TickLifecycle();
        }

        private void OnDestroy()
        {
            WebPortalServer.Stop();
            Log.LogInfo($"[{PluginName}] Unloaded.");
        }
    }
}
