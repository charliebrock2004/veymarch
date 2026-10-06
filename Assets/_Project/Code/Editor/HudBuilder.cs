using UnityEditor;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem.UI;
using UnityEngine.UI;
using Veyr.Client.Hud;
using Veyr.Client.Input;
using Veyr.Client.Platform;

namespace Veyr.EditorTools
{
    /// <summary>
    /// The touch HUD from code: ink-and-parchment controls (art bible §22), stick on the left, look
    /// on the right, combat cluster bottom-right, Use bottom-centre, vitals top-left, the debug
    /// overlay beneath them. All inside the safe area. Labels are localisation keys.
    /// </summary>
    public static class HudBuilder
    {
        static readonly Color ButtonFill = new Color(0.906f, 0.863f, 0.784f, 0.32f);
        static readonly Color StickFill = new Color(0.906f, 0.863f, 0.784f, 0.22f);
        static readonly Color Clear = new Color(0f, 0f, 0f, 0f);

        public static GameObject Build(out TouchControls touch, out FrameOverlay overlay, out VitalsHud vitals)
        {
            var canvasObject = new GameObject("PF_Hud");
            var canvas = canvasObject.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = 10;
            var scaler = canvasObject.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1920f, 1080f);
            scaler.screenMatchMode = CanvasScaler.ScreenMatchMode.MatchWidthOrHeight;
            scaler.matchWidthOrHeight = 1f;
            canvasObject.AddComponent<GraphicRaycaster>();

            var safe = Rect("SafeArea", canvasObject.transform, Vector2.zero, Vector2.one, new Vector2(0.5f, 0.5f), Vector2.zero, Vector2.zero);
            safe.gameObject.AddComponent<SafeAreaFitter>();

            var stickZone = Zone("StickZone", safe, new Vector2(0f, 0f), new Vector2(0.42f, 0.82f));
            var lookZone = Zone("LookZone", safe, new Vector2(0.42f, 0f), new Vector2(1f, 1f));

            var knob = AssetDatabase.GetBuiltinExtraResource<Sprite>("UI/Skin/Knob.psd");
            var stickBase = Rect("StickBase", safe, Vector2.zero, Vector2.zero, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(220f, 220f));
            Fill(stickBase.gameObject, StickFill, knob, false);
            var stickKnob = Rect("StickKnob", safe, Vector2.zero, Vector2.zero, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(90f, 90f));
            Fill(stickKnob.gameObject, new Color(0.906f, 0.863f, 0.784f, 0.55f), knob, false);

            var cluster = Rect("CombatCluster", safe, new Vector2(1f, 0f), new Vector2(1f, 0f), new Vector2(1f, 0f), new Vector2(-48f, 40f), new Vector2(520f, 460f));
            var strike = Button("Strike", cluster, new Vector2(-150f, 150f), 230f, "hud.strike", knob);
            var dodge = Button("Dodge", cluster, new Vector2(-370f, 90f), 150f, "hud.dodge", knob);
            var jump = Button("Jump", cluster, new Vector2(-110f, 370f), 140f, "hud.jump", knob);
            var block = Button("Block", cluster, new Vector2(-330f, 290f), 130f, "hud.block", knob);
            var lockOn = Button("Lock", cluster, new Vector2(-60f, 520f), 100f, "hud.lock", knob);
            var interact = Button("Use", safe, new Vector2(0f, 120f), 160f, "hud.use", knob, new Vector2(0.5f, 0f));

            touch = safe.gameObject.AddComponent<TouchControls>();
            touch.Wire(stickZone.GetComponent<TouchZone>(), lookZone.GetComponent<TouchZone>(), stickBase, stickKnob, cluster, strike, dodge, jump, interact, block, lockOn);

            var vitalsRoot = Rect("Vitals", safe, new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(40f, -36f), new Vector2(440f, 40f));
            var health = Bar(vitalsRoot, "Health", new Vector2(0f, 0f), 18f, Palette.Hex("#7A2E2A"));
            var stamina = Bar(vitalsRoot, "Stamina", new Vector2(0f, -26f), 10f, Palette.SealGreen);
            vitals = vitalsRoot.gameObject.AddComponent<VitalsHud>();
            vitals.Wire(health, stamina);

            var overlayRect = Rect("FrameOverlay", safe, new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(40f, -90f), new Vector2(1100f, 170f));
            var overlayText = Text(overlayRect.gameObject, 24, TextAnchor.UpperLeft);
            overlayText.raycastTarget = false;
            overlay = overlayRect.gameObject.AddComponent<FrameOverlay>();
            overlay.Wire(overlayText);

            // Zones first in the sibling order so buttons, drawn later, receive the touch first.
            stickZone.SetSiblingIndex(0);
            lookZone.SetSiblingIndex(1);
            return canvasObject;
        }

        public static GameObject EventSystemObject()
        {
            var es = new GameObject("EventSystem");
            es.AddComponent<EventSystem>();
            var module = es.AddComponent<InputSystemUIInputModule>();
            module.AssignDefaultActions();
            return es;
        }

        static RectTransform Rect(string name, Transform parent, Vector2 anchorMin, Vector2 anchorMax, Vector2 pivot, Vector2 position, Vector2 size)
        {
            var go = new GameObject(name, typeof(RectTransform));
            var rect = go.GetComponent<RectTransform>();
            rect.SetParent(parent, false);
            rect.anchorMin = anchorMin;
            rect.anchorMax = anchorMax;
            rect.pivot = pivot;
            rect.anchoredPosition = position;
            rect.sizeDelta = size;
            return rect;
        }

        static RectTransform Zone(string name, Transform parent, Vector2 anchorMin, Vector2 anchorMax)
        {
            var rect = Rect(name, parent, anchorMin, anchorMax, new Vector2(0.5f, 0.5f), Vector2.zero, Vector2.zero);
            Fill(rect.gameObject, Clear, null, true);
            rect.gameObject.AddComponent<TouchZone>();
            return rect;
        }

        static Image Fill(GameObject go, Color color, Sprite sprite, bool raycast)
        {
            var image = go.AddComponent<Image>();
            image.color = color;
            image.sprite = sprite;
            image.raycastTarget = raycast;
            return image;
        }

        static TouchButton Button(string name, Transform parent, Vector2 position, float size, string labelKey, Sprite sprite, Vector2? anchor = null)
        {
            var a = anchor ?? new Vector2(1f, 0f);
            var rect = Rect(name, parent, a, a, new Vector2(0.5f, 0.5f), position, new Vector2(size, size));
            Fill(rect.gameObject, ButtonFill, sprite, true);
            var labelRect = Rect("Label", rect, Vector2.zero, Vector2.one, new Vector2(0.5f, 0.5f), Vector2.zero, Vector2.zero);
            var text = Text(labelRect.gameObject, Mathf.RoundToInt(Mathf.Clamp(size * 0.17f, 20f, 40f)), TextAnchor.MiddleCenter);
            text.raycastTarget = false;
            labelRect.gameObject.AddComponent<LocalisedLabel>().SetKey(labelKey);
            return rect.gameObject.AddComponent<TouchButton>();
        }

        static RectTransform Bar(RectTransform parent, string name, Vector2 position, float height, Color color)
        {
            var back = Rect(name, parent, new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(0f, 1f), position, new Vector2(0f, height));
            Fill(back.gameObject, new Color(0.11f, 0.098f, 0.086f, 0.7f), null, false);
            var fill = Rect("Fill", back, Vector2.zero, Vector2.one, new Vector2(0f, 0.5f), Vector2.zero, Vector2.zero);
            Fill(fill.gameObject, color, null, false);
            return fill;
        }

        static Text Text(GameObject go, int size, TextAnchor anchor)
        {
            var text = go.AddComponent<Text>();
            text.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            text.fontSize = size;
            text.alignment = anchor;
            text.color = Palette.Parchment;
            text.horizontalOverflow = HorizontalWrapMode.Overflow;
            text.verticalOverflow = VerticalWrapMode.Overflow;
            var shadow = go.AddComponent<Shadow>();
            shadow.effectColor = new Color(0.11f, 0.098f, 0.086f, 0.85f);
            shadow.effectDistance = new Vector2(2f, -2f);
            return text;
        }
    }
}
