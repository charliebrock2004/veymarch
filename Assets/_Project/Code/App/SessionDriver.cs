using UnityEngine;
using Veyr.Client;
using Veyr.Client.Platform;
using Veyr.Net;
using Veyr.Server;

namespace Veyr.App
{
    /// <summary>
    /// Owns the running offline session for the life of the app. Runs after the local player has
    /// sent this frame's intent (execution order 100), advances the embedded authority by real
    /// time, then pumps events and snapshots to the scene. Pauses the authority while the app is
    /// suspended so a resumed phone does not fast-forward the world.
    /// </summary>
    [DefaultExecutionOrder(100)]
    public sealed class SessionDriver : MonoBehaviour
    {
        readonly SessionEvents _events = new SessionEvents();
        EmbeddedHost _host;
        bool _suspended;

        public SessionContext Context { get; private set; }
        public EmbeddedHost Host => _host;
        public SessionEvents Events => _events;
        public QualityService Quality { get; private set; }
        public SettingsService Settings { get; private set; }

        /// <summary>Creates the persistent session object: settings, quality, and an offline world with the player at <paramref name="spawn"/>.</summary>
        public static SessionDriver CreateLocal(Vector3 spawn, QualityAssetSet qualityAssets, SettingsService settings = null)
        {
            var go = new GameObject("Veyr Session");
            DontDestroyOnLoad(go);
            var driver = go.AddComponent<SessionDriver>();
            driver.Settings = settings ?? new SettingsService();
            if (settings == null)
                driver.Settings.Load();
            driver.Quality = go.AddComponent<QualityService>();
            driver.Quality.Init(qualityAssets, driver.Settings.Current);
            var (host, context) = LocalSession.Start(new LocalSessionOptions
            {
                WorldId = "local",
                PlayerId = "unmarked",
                SpawnX = spawn.x,
                SpawnY = spawn.y,
                SpawnZ = spawn.z
            });
            driver._host = host;
            driver.Context = context;
            return driver;
        }

        void Update()
        {
            if (_host == null || _suspended)
                return;
            int steps = _host.Advance(Time.unscaledDeltaTime);
            _events.Pump(Context.Endpoint, steps > 0);
        }

        void OnApplicationPause(bool paused)
        {
            _suspended = paused;
            if (paused)
                Settings?.Save();
        }

        void OnApplicationQuit() => Settings?.Save();
    }
}
