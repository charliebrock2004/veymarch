using System.Collections;
using UnityEngine;
using UnityEngine.SceneManagement;
using Veyr.Client.Platform;

namespace Veyr.App
{
    /// <summary>
    /// Composition root (architecture §4). Lives in Boot.unity: loads settings, loads the first
    /// gameplay scene, creates the offline session at that scene's spawn, and binds the scene.
    /// No god manager: once the scene is bound this object removes itself.
    /// </summary>
    public sealed class GameBootstrap : MonoBehaviour
    {
        [SerializeField] string firstScene = "Dev_Move";
        [SerializeField] QualityAssetSet qualityAssets;

        public string FirstScene => firstScene;

        public void Wire(string scene, QualityAssetSet assets)
        {
            firstScene = scene;
            qualityAssets = assets;
        }

        IEnumerator Start()
        {
            DontDestroyOnLoad(gameObject);
            var settings = new SettingsService();
            settings.Load();

            var load = SceneManager.LoadSceneAsync(firstScene, LoadSceneMode.Single);
            if (load == null)
            {
                Debug.LogError("Veyr boot: scene '" + firstScene + "' is not in the build list. Run Veyrmarch > Setup > Build Dev Scenes.");
                yield break;
            }
            while (!load.isDone)
                yield return null;

            var scene = SceneManager.GetSceneByName(firstScene);
            SceneRoot root = null;
            foreach (var go in scene.GetRootGameObjects())
            {
                root = go.GetComponentInChildren<SceneRoot>(true);
                if (root != null)
                    break;
            }

            if (root == null)
            {
                Debug.LogError("Veyr boot: " + firstScene + " has no SceneRoot.");
                Destroy(gameObject);
                yield break;
            }

            // Unity objects overload ==; do not use ?? on them.
            var driver = FindAnyObjectByType<SessionDriver>();
            if (driver == null)
                driver = SessionDriver.CreateLocal(root.SpawnPosition, qualityAssets, settings);
            root.Bind(driver);
            Destroy(gameObject);
        }
    }
}
