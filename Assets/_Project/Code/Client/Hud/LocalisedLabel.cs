using UnityEngine;
using UnityEngine.UI;
using Veyr.Client.Core;

namespace Veyr.Client.Hud
{
    /// <summary>Sets a uGUI Text from a localisation key at load. Text in scenes is never typed in by hand.</summary>
    [RequireComponent(typeof(Text))]
    public sealed class LocalisedLabel : MonoBehaviour
    {
        [SerializeField] string key = "";

        public string Key => key;

        public void SetKey(string value)
        {
            key = value;
            Apply();
        }

        void Awake() => Apply();

        void Apply()
        {
            var text = GetComponent<Text>();
            if (text != null && key.Length > 0)
                text.text = UiText.Get(key);
        }
    }
}
