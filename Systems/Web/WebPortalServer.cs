using System;
using System.IO;
using System.Net;
using System.Reflection;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace Bifrostheim.Systems.Web
{
    public static class WebPortalServer
    {
        private static HttpListener? _listener;
        private static CancellationTokenSource? _cts;
        private static byte[]? _embeddedIndexHtmlBytes;
        private static bool _isRunning;
        public static string AdminPassword { get; private set; } = string.Empty;

        public static void Start(int port, string password)
        {
            if (_isRunning) return;

            AdminPassword = password ?? string.Empty;
            _cts = new CancellationTokenSource();

            Task.Run(async () =>
            {
                try
                {
                    string[] candidatePrefixes = new[]
                    {
                        $"http://*:{port}/",
                        $"http://+:{port}/",
                        $"http://127.0.0.1:{port}/",
                        $"http://localhost:{port}/"
                    };

                    bool started = false;
                    foreach (string prefix in candidatePrefixes)
                    {
                        try
                        {
                            _listener = new HttpListener();
                            _listener.Prefixes.Add(prefix);
                            _listener.Start();
                            started = true;
                            BifrostheimPlugin.Log.LogInfo($"[WebPortalServer] Listening on {prefix}");
                            break;
                        }
                        catch (Exception ex)
                        {
                            BifrostheimPlugin.Log.LogWarning($"[WebPortalServer] Could not bind prefix '{prefix}': {ex.Message}");
                            try { _listener?.Close(); } catch { }
                        }
                    }

                    if (!started || _listener == null)
                    {
                        BifrostheimPlugin.Log.LogError($"[WebPortalServer] Failed to bind HTTP listener on port {port}.");
                        return;
                    }

                    _isRunning = true;
                    LoadEmbeddedAssets();

                    while (!_cts.Token.IsCancellationRequested && _listener.IsListening)
                    {
                        try
                        {
                            var context = await _listener.GetContextAsync();
                            _ = ProcessRequestAsync(context);
                        }
                        catch (HttpListenerException) when (_cts.Token.IsCancellationRequested)
                        {
                            break;
                        }
                        catch (Exception ex)
                        {
                            if (!_cts.Token.IsCancellationRequested)
                            {
                                BifrostheimPlugin.Log.LogWarning($"[WebPortalServer] Request accept error: {ex.Message}");
                            }
                        }
                    }
                }
                catch (Exception ex)
                {
                    BifrostheimPlugin.Log.LogError($"[WebPortalServer] Server error: {ex}");
                }
                finally
                {
                    _isRunning = false;
                }
            });
        }

        public static void Stop()
        {
            if (!_isRunning) return;

            try
            {
                _cts?.Cancel();
                _listener?.Stop();
                _listener?.Close();
                BifrostheimPlugin.Log.LogInfo("[WebPortalServer] Web portal server stopped.");
            }
            catch (Exception ex)
            {
                BifrostheimPlugin.Log.LogWarning($"[WebPortalServer] Error stopping server: {ex.Message}");
            }
            finally
            {
                _isRunning = false;
            }
        }

        private static async Task ProcessRequestAsync(HttpListenerContext context)
        {
            try
            {
                string clientIp = GetClientIp(context.Request);
                string path = context.Request.Url?.AbsolutePath ?? "/";

                // Handle CORS pre-flight
                if (context.Request.HttpMethod.Equals("OPTIONS", StringComparison.OrdinalIgnoreCase))
                {
                    context.Response.AddHeader("Access-Control-Allow-Origin", "*");
                    context.Response.AddHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
                    context.Response.AddHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Admin-Password");
                    context.Response.StatusCode = 204;
                    context.Response.Close();
                    return;
                }

                if (path.StartsWith("/api/", StringComparison.OrdinalIgnoreCase))
                {
                    await WebApiRouter.HandleApiRequestAsync(context, path, clientIp);
                    return;
                }

                await ServeStaticSpaAsync(context.Response);
            }
            catch (Exception ex)
            {
                BifrostheimPlugin.Log.LogError($"[WebPortalServer] Error processing request: {ex}");
                try
                {
                    context.Response.StatusCode = 500;
                    context.Response.Close();
                }
                catch { }
            }
        }

        private static async Task ServeStaticSpaAsync(HttpListenerResponse response)
        {
            byte[] htmlBytes = _embeddedIndexHtmlBytes ?? GetDefaultFallbackHtml();

            response.StatusCode = 200;
            response.ContentType = "text/html; charset=utf-8";
            response.ContentLength64 = htmlBytes.Length;
            response.Headers.Add("Cache-Control", "no-cache, no-store, must-revalidate");

            using (var output = response.OutputStream)
            {
                await output.WriteAsync(htmlBytes, 0, htmlBytes.Length);
            }
            response.Close();
        }

        private static void LoadEmbeddedAssets()
        {
            try
            {
                var assembly = Assembly.GetExecutingAssembly();
                string resourceName = "Bifrostheim.dist.index.html";

                using (var stream = assembly.GetManifestResourceStream(resourceName))
                {
                    if (stream != null)
                    {
                        using (var ms = new MemoryStream())
                        {
                            stream.CopyTo(ms);
                            _embeddedIndexHtmlBytes = ms.ToArray();
                            BifrostheimPlugin.Log.LogInfo($"[WebPortalServer] Loaded embedded React bundle ({_embeddedIndexHtmlBytes.Length / 1024} KB).");
                            return;
                        }
                    }
                }

                foreach (string name in assembly.GetManifestResourceNames())
                {
                    if (name.EndsWith("index.html", StringComparison.OrdinalIgnoreCase))
                    {
                        using (var stream = assembly.GetManifestResourceStream(name))
                        {
                            if (stream != null)
                            {
                                using (var ms = new MemoryStream())
                                {
                                    stream.CopyTo(ms);
                                    _embeddedIndexHtmlBytes = ms.ToArray();
                                    BifrostheimPlugin.Log.LogInfo($"[WebPortalServer] Loaded embedded resource '{name}' ({_embeddedIndexHtmlBytes.Length / 1024} KB).");
                                    return;
                                }
                            }
                        }
                    }
                }

                BifrostheimPlugin.Log.LogWarning("[WebPortalServer] Embedded index.html not found in assembly resources. Using fallback UI.");
            }
            catch (Exception ex)
            {
                BifrostheimPlugin.Log.LogError($"[WebPortalServer] Error loading embedded assets: {ex.Message}");
            }
        }

        private static byte[] GetDefaultFallbackHtml()
        {
            string html = "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"UTF-8\"><title>Bifröstheim Server Portal</title>" +
                          "<style>body{background:#030712;color:#f3f4f6;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;} .card{background:#111827;padding:2rem;border-radius:12px;border:1px solid #374151;text-align:center;max-width:480px;}</style></head>" +
                          "<body><div class=\"card\"><h1 style=\"color:#f97316;\">Bifröstheim</h1><p>Embedded web portal bundle not found in assembly.</p><p>API is active at <code>/api/modules/installed</code></p></div></body></html>";
            return Encoding.UTF8.GetBytes(html);
        }

        private static string GetClientIp(HttpListenerRequest request)
        {
            string? forwarded = request.Headers["X-Forwarded-For"];
            if (!string.IsNullOrWhiteSpace(forwarded))
            {
                string[] parts = forwarded.Split(',');
                if (parts.Length > 0 && !string.IsNullOrWhiteSpace(parts[0]))
                    return parts[0].Trim();
            }

            return request.RemoteEndPoint?.Address?.ToString() ?? "127.0.0.1";
        }
    }
}
