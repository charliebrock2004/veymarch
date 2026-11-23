using System;
using UnityEngine;
using UnityEngine.EventSystems;
using Veyr.Client.Core;

namespace Veyr.Client.Input
{
    /// <summary>
    /// Touch layout from design bible §31 and architecture §31: stick on the left, look drag on the
    /// right, combat cluster bottom-right, context interact bottom-centre. Owns the touch maths
    /// objects; <see cref="PlayerInputReader"/> reads them each frame.
    /// </summary>
    public sealed class TouchControls : MonoBehaviour
    {
        [SerializeField] TouchZone stickZone;
        [SerializeField] TouchZone lookZone;
        [SerializeField] RectTransform stickBase;
        [SerializeField] RectTransform stickKnob;
        [SerializeField] RectTransform combatCluster;
        [SerializeField] TouchButton strike;
        [SerializeField] TouchButton dodge;
        [SerializeField] TouchButton jump;
        [SerializeField] TouchButton interact;
        [SerializeField] TouchButton block;
        [SerializeField] TouchButton lockOn;
        [Tooltip("Stick radius at the 1080p reference height. Scaled with the canvas.")]
        [SerializeField] float stickRadiusReference = 110f;

        readonly VirtualStick _stick = new VirtualStick();
        readonly LookDrag _look = new LookDrag();
        Canvas _canvas;
        Vector2 _clusterHome;
        bool _flick;
        Vector2 _flickDirection;
        Vector2 _flickUndoPixels;

        public VirtualStick Stick => _stick;
        public LookDrag Look => _look;
        public TouchButton Strike => strike;
        public TouchButton Dodge => dodge;
        public TouchButton Jump => jump;
        public TouchButton Interact => interact;
        public TouchButton Block => block;
        public TouchButton LockOn => lockOn;
        public bool FlickEnabled { get; set; } = true;

        public void Wire(TouchZone stickArea, TouchZone lookArea, RectTransform stickBaseVisual, RectTransform stickKnobVisual, RectTransform cluster,
            TouchButton strikeButton, TouchButton dodgeButton, TouchButton jumpButton, TouchButton interactButton, TouchButton blockButton, TouchButton lockOnButton)
        {
            stickZone = stickArea;
            lookZone = lookArea;
            stickBase = stickBaseVisual;
            stickKnob = stickKnobVisual;
            combatCluster = cluster;
            strike = strikeButton;
            dodge = dodgeButton;
            jump = jumpButton;
            interact = interactButton;
            block = blockButton;
            lockOn = lockOnButton;
        }

        /// <summary>One-handed mode moves the combat cluster (design bible §31). Offset in reference pixels.</summary>
        public void SetClusterOffset(Vector2 offset)
        {
            if (combatCluster != null)
                combatCluster.anchoredPosition = _clusterHome + offset;
        }

        /// <summary>True once per flick. Direction is in screen space; undo is the pixel turn the flick caused.</summary>
        public bool ConsumeFlick(out Vector2 direction, out Vector2 undoPixels)
        {
            direction = _flickDirection;
            undoPixels = _flickUndoPixels;
            bool had = _flick;
            _flick = false;
            return had;
        }

        void Awake()
        {
            _canvas = GetComponentInParent<Canvas>();
            if (combatCluster != null)
                _clusterHome = combatCluster.anchoredPosition;
        }

        void OnEnable()
        {
            if (stickZone != null)
            {
                stickZone.Down += OnStickDown;
                stickZone.Dragged += OnStickDrag;
                stickZone.Up += OnStickUp;
            }
            if (lookZone != null)
            {
                lookZone.Down += OnLookDown;
                lookZone.Dragged += OnLookDrag;
                lookZone.Up += OnLookUp;
            }
            ShowStick(false);
        }

        void OnDisable()
        {
            if (stickZone != null)
            {
                stickZone.Down -= OnStickDown;
                stickZone.Dragged -= OnStickDrag;
                stickZone.Up -= OnStickUp;
            }
            if (lookZone != null)
            {
                lookZone.Down -= OnLookDown;
                lookZone.Dragged -= OnLookDrag;
                lookZone.Up -= OnLookUp;
            }
            _stick.Release(_stick.PointerId);
        }

        float CanvasScale => _canvas != null && _canvas.scaleFactor > 0f ? _canvas.scaleFactor : 1f;

        void OnStickDown(PointerEventData e)
        {
            _stick.RadiusPixels = stickRadiusReference * CanvasScale;
            if (_stick.Press(e.pointerId, e.position.ToNumerics()))
            {
                ShowStick(true);
                UpdateStickVisual();
            }
        }

        void OnStickDrag(PointerEventData e)
        {
            _stick.Drag(e.pointerId, e.position.ToNumerics());
            UpdateStickVisual();
        }

        void OnStickUp(PointerEventData e)
        {
            if (e.pointerId != _stick.PointerId)
                return;
            _stick.Release(e.pointerId);
            ShowStick(false);
        }

        void OnLookDown(PointerEventData e) => _look.Press(e.pointerId, e.position.ToNumerics(), Time.unscaledTimeAsDouble);

        void OnLookDrag(PointerEventData e) => _look.Drag(e.pointerId, e.delta.ToNumerics());

        void OnLookUp(PointerEventData e)
        {
            bool flick = _look.Release(e.pointerId, e.position.ToNumerics(), Time.unscaledTimeAsDouble, Screen.height, out var dir, out var undo);
            if (flick && FlickEnabled)
            {
                _flick = true;
                _flickDirection = dir.ToUnity();
                _flickUndoPixels = undo.ToUnity();
            }
        }

        void ShowStick(bool visible)
        {
            if (stickBase != null)
                stickBase.gameObject.SetActive(visible);
            if (stickKnob != null)
                stickKnob.gameObject.SetActive(visible);
        }

        void UpdateStickVisual()
        {
            if (stickBase == null || stickKnob == null)
                return;
            // Screen-space overlay canvas: world position is screen pixels, size is reference units.
            var origin = _stick.Origin.ToUnity();
            var knob = _stick.Knob.ToUnity();
            stickBase.position = new Vector3(origin.x, origin.y, 0f);
            stickKnob.position = new Vector3(knob.x, knob.y, 0f);
            stickBase.sizeDelta = Vector2.one * (stickRadiusReference * 2f);
            stickKnob.sizeDelta = Vector2.one * (stickRadiusReference * 0.8f);
        }
    }
}
