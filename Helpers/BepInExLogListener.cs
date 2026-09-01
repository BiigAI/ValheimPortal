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

            // Skip internal WebPortalServer connection lines to prevent recursive spam
            if (source.Equals("Bifrostheim", StringComparison.OrdinalIgnoreCase) && text.Contains("[WebPortalServer]"))
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
