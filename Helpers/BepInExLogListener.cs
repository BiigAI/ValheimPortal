using System;
using BepInEx.Logging;
using Bifrostheim.Systems.Web;

namespace Bifrostheim.Helpers
{
    /// <summary>
    /// BepInEx Log Listener that captures logs from all loaded plugins and routes them to the WebPortal console buffer.
    /// </summary>
    public class BepInExLogListener : ILogListener
    {
        public void LogEvent(object sender, LogEventArgs eventArgs)
        {
            if (eventArgs == null || eventArgs.Data == null) return;

            string level;
            if ((eventArgs.Level & (LogLevel.Error | LogLevel.Fatal)) != 0)
            {
                level = "error";
            }
            else if ((eventArgs.Level & LogLevel.Warning) != 0)
            {
                level = "warn";
            }
            else if ((eventArgs.Level & (LogLevel.Message | LogLevel.Info)) != 0)
            {
                level = "info";
            }
            else if ((eventArgs.Level & LogLevel.Debug) != 0)
            {
                if (!(BifrostheimPlugin.VerboseLogging?.Value ?? false)) return;
                level = "info";
            }
            else
            {
                return;
            }

            string source = eventArgs.Source?.SourceName ?? "Server";
            string text = eventArgs.Data.ToString() ?? string.Empty;
            if (string.IsNullOrWhiteSpace(text)) return;

            // Prevent recursive noise from internal HTTP server request handling while preserving warnings/errors
            bool isBifrostheimSource = source.Equals(BifrostheimPlugin.PluginName, StringComparison.OrdinalIgnoreCase) ||
                                       source.Equals("Bifrostheim", StringComparison.OrdinalIgnoreCase);

            if (isBifrostheimSource && level == "info" &&
                (text.Contains("[WebPortalServer]") || text.Contains("[WebApiRouter]")))
            {
                return;
            }

            WebApiRouter.AddLog(level, source, text);
        }

        public void Dispose()
        {
        }
    }
}
