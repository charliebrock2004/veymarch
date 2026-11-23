using UnityEngine;
using UnityEngine.SceneManagement;
using Veyr.Client.Input;

namespace Veyr.App
{
    /// <summary>
    /// Developer button for device checkpoints: ends the current offline session and loads the
    /// other test scene, which starts a fresh session at its own spawn. One build measures both the
    /// near-empty movement scene and the forest blockout. Not part of the player-facing flow.
    /// </summary>
    public sealed class DevSceneSwitch : MonoBehaviour
    {
        [SerializeField] TouchButton button;
        [SerializeField] string targetScene = "";
        bool _was;
        bool _loading;

        public string TargetScene => targetScene;

        public void Wire(TouchButton switchButton, string scene)
        {
            button = switchButton;
            targetScene = scene;
        }

        void Update()
        {
            if (button == null || _loading || targetScene.Length == 0)
                return;
            bool held = button.Held;
            bool pressed = held && !_was;
            _was = held;
            if (!pressed)
                return;
            _loading = true;
            foreach (var driver in FindObjectsByType<SessionDriver>(FindObjectsSortMode.None))
                Destroy(driver.gameObject);
            SceneManager.LoadScene(targetScene, LoadSceneMode.Single);
        }
    }
}
