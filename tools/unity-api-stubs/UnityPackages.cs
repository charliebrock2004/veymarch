// Hand-written declarations of the uGUI, EventSystems, and Input System API used by the code.
// Compile check only. Not Unity. Never shipped.
#pragma warning disable 1591
using System;
using System.Collections;
using System.Collections.Generic;

namespace UnityEngine.EventSystems
{
    public abstract class UIBehaviour : MonoBehaviour { }

    public class EventSystem : UIBehaviour { }

    public abstract class BaseInputModule : UIBehaviour { }

    public class PointerEventData
    {
        public int pointerId { get; set; }
        public Vector2 position { get; set; }
        public Vector2 delta { get; set; }
    }

    public interface IEventSystemHandler { }
    public interface IPointerDownHandler : IEventSystemHandler { void OnPointerDown(PointerEventData eventData); }
    public interface IPointerUpHandler : IEventSystemHandler { void OnPointerUp(PointerEventData eventData); }
    public interface IPointerExitHandler : IEventSystemHandler { void OnPointerExit(PointerEventData eventData); }
    public interface IDragHandler : IEventSystemHandler { void OnDrag(PointerEventData eventData); }
}

namespace UnityEngine.UI
{
    using UnityEngine.EventSystems;

    public abstract class Graphic : UIBehaviour
    {
        public virtual Color color { get; set; }
        public virtual bool raycastTarget { get; set; }
    }

    public abstract class MaskableGraphic : Graphic { }

    public class Image : MaskableGraphic
    {
        public Sprite sprite { get; set; }
    }

    public class Text : MaskableGraphic
    {
        public virtual string text { get; set; }
        public Font font { get; set; }
        public int fontSize { get; set; }
        public TextAnchor alignment { get; set; }
        public HorizontalWrapMode horizontalOverflow { get; set; }
        public VerticalWrapMode verticalOverflow { get; set; }
    }

    public class CanvasScaler : UIBehaviour
    {
        public enum ScaleMode { ConstantPixelSize = 0, ScaleWithScreenSize = 1, ConstantPhysicalSize = 2 }
        public enum ScreenMatchMode { MatchWidthOrHeight = 0, Expand = 1, Shrink = 2 }
        public ScaleMode uiScaleMode { get; set; }
        public Vector2 referenceResolution { get; set; }
        public ScreenMatchMode screenMatchMode { get; set; }
        public float matchWidthOrHeight { get; set; }
    }

    public class GraphicRaycaster : UIBehaviour { }

    public abstract class BaseMeshEffect : UIBehaviour { }

    public class Shadow : BaseMeshEffect
    {
        public Color effectColor { get; set; }
        public Vector2 effectDistance { get; set; }
    }
}

namespace UnityEngine.InputSystem.Utilities
{
    public struct ReadOnlyArray<TValue> : IReadOnlyList<TValue>
    {
        public int Count => throw null;
        public TValue this[int index] => throw null;
        public IEnumerator<TValue> GetEnumerator() => throw null;
        IEnumerator IEnumerable.GetEnumerator() => throw null;
    }
}

namespace UnityEngine.InputSystem
{
    using UnityEngine.InputSystem.Controls;
    using UnityEngine.InputSystem.Utilities;

    public struct InputControlScheme
    {
        public string name => throw null;
    }

    public class InputActionAsset : ScriptableObject
    {
        public ReadOnlyArray<InputControlScheme> controlSchemes => throw null;
        public InputActionMap FindActionMap(string nameOrId, bool throwIfNotFound = false) => throw null;
    }

    public sealed class InputActionMap
    {
        public InputAction FindAction(string actionNameOrId, bool throwIfNotFound = false) => throw null;
        public void Enable() { }
        public void Disable() { }
    }

    public sealed class InputAction
    {
        public TValue ReadValue<TValue>() where TValue : struct => throw null;
        public bool IsPressed() => throw null;
        public bool WasPressedThisFrame() => throw null;
    }

    public abstract class InputControl { }

    public abstract class InputControl<TValue> : InputControl where TValue : struct
    {
        public TValue ReadValue() => throw null;
    }

    public class InputDevice : InputControl { }

    public class Pointer : InputDevice
    {
        public Vector2Control delta => throw null;
    }

    public class Mouse : Pointer
    {
        public static Mouse current => throw null;
        public ButtonControl rightButton => throw null;
    }
}

namespace UnityEngine.InputSystem.Controls
{
    public class AxisControl : InputControl<float> { }

    public class ButtonControl : AxisControl
    {
        public bool isPressed => throw null;
    }

    public class Vector2Control : InputControl<Vector2> { }
}

namespace UnityEngine.InputSystem.UI
{
    public class InputSystemUIInputModule : UnityEngine.EventSystems.BaseInputModule
    {
        public void AssignDefaultActions() { }
    }
}
