using System;
using System.Collections.Concurrent;
using System.Threading.Tasks;

namespace Bifrostheim.Helpers
{
    /// <summary>
    /// Thread-safe dispatcher that enqueues work to be executed on Unity's main engine thread.
    /// Pumped directly from BifrostheimPlugin.Update() with a per-frame execution cap to prevent lag spikes.
    /// </summary>
    public static class MainThreadDispatcher
    {
        private static readonly ConcurrentQueue<Action> ExecutionQueue = new ConcurrentQueue<Action>();

        public static void PumpQueue(int maxActionsPerFrame = 25)
        {
            int executed = 0;
            while (executed < maxActionsPerFrame && ExecutionQueue.TryDequeue(out var action))
            {
                try
                {
                    action?.Invoke();
                }
                catch (Exception ex)
                {
                    BifrostheimPlugin.Log?.LogError($"[MainThreadDispatcher] Error executing action: {ex}");
                }
                executed++;
            }
        }

        public static void Enqueue(Action action)
        {
            if (action != null)
            {
                ExecutionQueue.Enqueue(action);
            }
        }

        public static Task EnqueueAsync(Action action)
        {
            var tcs = new TaskCompletionSource<bool>();
            Enqueue(() =>
            {
                try
                {
                    action();
                    tcs.SetResult(true);
                }
                catch (Exception ex)
                {
                    tcs.SetException(ex);
                }
            });
            return tcs.Task;
        }

        public static Task<T> EnqueueAsync<T>(Func<T> function)
        {
            var tcs = new TaskCompletionSource<T>();
            Enqueue(() =>
            {
                try
                {
                    var result = function();
                    tcs.SetResult(result);
                }
                catch (Exception ex)
                {
                    tcs.SetException(ex);
                }
            });
            return tcs.Task;
        }
    }
}
