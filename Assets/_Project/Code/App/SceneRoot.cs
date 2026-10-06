using System.Collections;
using UnityEngine;
using Veyr.Client;
using Veyr.Client.CameraRig;
using Veyr.Client.Hud;
using Veyr.Client.Input;
using Veyr.Client.Platform;
using Veyr.Client.Player;
using Veyr.Sim;

namespace Veyr.App
{
    /// <summary>
    /// One per gameplay scene. Holds explicit references to the scene's player, camera, and HUD,
    /// and wires them to a session when the composition root calls <see cref="Bind"/>. If the scene
    /// is played directly in the editor without Boot, it starts its own offline dev session.
    /// </summary>
    public sealed class SceneRoot : MonoBehaviour
    {
        [SerializeField] Transform spawnPoint;
        [SerializeField] LocalPlayerController player;
        [SerializeField] PlayerInputReader input;
        [SerializeField] OrbitCameraRig cameraRig;
        [SerializeField] FrameOverlay overlay;
        [SerializeField] DeviceLog deviceLog;
        [SerializeField] VitalsHud vitals;
        [SerializeField] QualityAssetSet qualityAssets;

        SessionDriver _driver;

        public bool IsBound => _driver != null;
        public SessionDriver Driver => _driver;
        public LocalPlayerController Player => player;
        public PlayerInputReader InputReader => input;
        public OrbitCameraRig CameraRig => cameraRig;
        public Vector3 SpawnPosition => spawnPoint != null ? spawnPoint.position : transform.position;

        public void Wire(Transform spawn, LocalPlayerController localPlayer, PlayerInputReader inputReader, OrbitCameraRig rig,
            FrameOverlay frameOverlay, DeviceLog log, VitalsHud vitalsHud, QualityAssetSet assets)
        {
            spawnPoint = spawn;
            player = localPlayer;
            input = inputReader;
            cameraRig = rig;
            overlay = frameOverlay;
            deviceLog = log;
            vitals = vitalsHud;
            qualityAssets = assets;
        }

        public void Bind(SessionDriver driver)
        {
            if (_driver != null)
            {
                Debug.LogWarning("Veyr: scene root bound twice; ignoring the second session.");
                return;
            }
            _driver = driver;
            LocalSettings settings = driver.Settings != null ? driver.Settings.Current : new LocalSettings();
            var endpoint = driver.Context.Endpoint;

            if (input != null)
                input.Configure(settings);
            if (player != null)
            {
                player.Bind(driver.Context);
                driver.Events.Raised += player.OnSimEvent;
                driver.Events.Snapshot += player.OnSnapshot;
            }
            if (cameraRig != null && driver.Quality != null)
                driver.Quality.SetCamera(cameraRig.ViewCamera);
            if (overlay != null)
            {
                overlay.Bind(endpoint, driver.Host, driver.Quality);
                overlay.SetVisible(settings.ShowFrameOverlay);
            }
            if (deviceLog != null)
                deviceLog.Bind(overlay, driver.Quality, endpoint);
            if (vitals != null)
                vitals.Bind(player);
        }

        IEnumerator Start()
        {
            // Give Boot a frame to bind us after the scene load completes.
            yield return null;
            if (IsBound || FindAnyObjectByType<GameBootstrap>() != null)
                yield break;
            var existing = FindAnyObjectByType<SessionDriver>();
            if (existing != null)
            {
                Bind(existing);
                yield break;
            }
            Debug.Log("Veyr: " + gameObject.scene.name + " started without Boot. Starting a local dev session.");
            Bind(SessionDriver.CreateLocal(SpawnPosition, qualityAssets));
        }

        void OnDestroy()
        {
            if (_driver == null || player == null)
                return;
            _driver.Events.Raised -= player.OnSimEvent;
            _driver.Events.Snapshot -= player.OnSnapshot;
        }
    }
}
