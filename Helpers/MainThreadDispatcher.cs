using System;
using System.Collections.Concurrent;
using System.Threading.Tasks;
using UnityEngine;

namespace Bifrostheim.Helpers
{
    public class MainThreadDispatcher : MonoBehaviour
    {
        private static readonly ConcurrentQueue<Action> ExecutionQueue = new ConcurrentQueue<Action>();
        private static MainThreadDispatcher? _instance;

        public static void Initialize()
        {
            if (_instance == null)
            {
                var go = new GameObject("Bifrostheim_MainThreadDispatcher");
                DontDestroyOnLoad(go);
                _instance = go.AddComponent<MainThreadDispatcher>();
            }
        }

        private void Update()
        {
            while (ExecutionQueue.TryDequeue(out var action))
            {
                try
                {
                    action?.Invoke();
                }
                catch (Exception ex)
                {
                    BifrostheimPlugin.Log.LogError($"[MainThreadDispatcher] Error executing action: {ex}");
                }
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
