using UnityEngine;
using UnityEngine.InputSystem;
using Veyr.Client.Core;
using Veyr.Sim;

namespace Veyr.Client.Input
{
    /// <summary>Everything the player asked for this frame, from any device. Presentation input only; the sim decides.</summary>
    public struct PlayerInputFrame
    {
        /// <summary>Stick, x right and y forward, length 0..1.</summary>
        public Vector2 Move;
        /// <summary>Camera turn this frame in degrees: x yaw, y pitch.</summary>
        public Vector2 LookDegrees;
        public bool Sprint;
        public bool Block;
        public bool DodgePressed;
        /// <summary>Screen-space direction of a dodge flick, zero for a button dodge.</summary>
        public Vector2 DodgeScreenDirection;
        public bool JumpPressed;
        public bool LightPressed;
        public bool HeavyPressed;
        public bool InteractPressed;
        public bool LockOnPressed;
    }

    /// <summary>
    /// Merges touch controls and the <c>Veyr.inputactions</c> map (gamepad, keyboard) into one
    /// <see cref="PlayerInputFrame"/> per frame. Light becomes Heavy when held (architecture §31).
    /// </summary>
    [DefaultExecutionOrder(-100)]
    public sealed class PlayerInputReader : MonoBehaviour
    {
        public const float HeavyHoldSeconds = 0.35f;
        const string MapName = "Player";

        [SerializeField] InputActionAsset actions;
        [SerializeField] TouchControls touch;
        [SerializeField] float gamepadLookDegreesPerSecond = 180f;
        [SerializeField] float mouseDegreesPerPixel = 0.15f;

        readonly HoldOrToggle _sprint = new HoldOrToggle();
        readonly HoldOrToggle _block = new HoldOrToggle();
        InputActionMap _map;
        InputAction _move;
        InputAction _look;
        InputAction _light;
        InputAction _dodge;
        InputAction _jump;
        InputAction _interact;
        InputAction _blockAction;
        InputAction _lockOn;
        InputAction _sprintAction;
        LocalSettings _settings = new LocalSettings();
        PlayerInputFrame _frame;
        float _lightHeldFor;
        bool _lightWasHeld;
        bool _heavyFired;
        bool _touchDodgeWas;
        bool _touchJumpWas;
        bool _touchInteractWas;
        bool _touchLockWas;

        public PlayerInputFrame Current => _frame;
        public TouchControls Touch => touch;

        /// <summary>When true, hardware is ignored and <see cref="ScriptedFrame"/> is used. For play-mode tests and scripted device soaks.</summary>
        public bool Scripted { get; set; }
        public PlayerInputFrame ScriptedFrame { get; set; }

        public void Wire(InputActionAsset actionAsset, TouchControls touchControls)
        {
            actions = actionAsset;
            touch = touchControls;
        }

        public void Configure(LocalSettings settings)
        {
            _settings = settings ?? new LocalSettings();
            _sprint.Toggle = _settings.SprintToggle;
            _block.Toggle = _settings.BlockToggle;
            if (touch != null)
            {
                touch.FlickEnabled = _settings.DodgeFlick;
                touch.SetClusterOffset(new Vector2(_settings.ControlOffsetX, _settings.ControlOffsetY));
            }
        }

        void OnEnable()
        {
            if (actions == null)
            {
                Debug.LogWarning("Veyr input: no action asset assigned; touch only.");
                return;
            }
            _map = actions.FindActionMap(MapName, false);
            if (_map == null)
            {
                Debug.LogError("Veyr input: action map 'Player' is missing from " + actions.name + ".");
                return;
            }
            _move = Find("Move");
            _look = Find("Look");
            _light = Find("Light");
            _dodge = Find("Dodge");
            _jump = Find("Jump");
            _interact = Find("Interact");
            _blockAction = Find("Block");
            _lockOn = Find("LockOn");
            _sprintAction = Find("Sprint");
            _map.Enable();
        }

        void OnDisable()
        {
            if (_map != null)
                _map.Disable();
        }

        InputAction Find(string name)
        {
            var action = _map.FindAction(name, false);
            if (action == null)
                Debug.LogError("Veyr input: action '" + name + "' is missing from the Player map.");
            return action;
        }

        void Update()
        {
            if (Scripted)
            {
                _frame = ScriptedFrame;
                return;
            }

            float dt = Time.unscaledDeltaTime;
            var frame = new PlayerInputFrame();

            Vector2 stick = touch != null ? touch.Stick.Value.ToUnity() : Vector2.zero;
            Vector2 device = _move != null ? Vector2.ClampMagnitude(_move.ReadValue<Vector2>(), 1f) : Vector2.zero;
            frame.Move = device.sqrMagnitude > stick.sqrMagnitude ? device : stick;

            frame.LookDegrees = ReadLook(dt);

            bool touchSprint = touch != null && touch.Stick.Active && touch.Stick.AtRim;
            _sprint.Update(_sprintAction != null && _sprintAction.IsPressed());
            frame.Sprint = touchSprint || _sprint.On;

            bool touchBlock = touch != null && touch.Block != null && touch.Block.Held;
            _block.Update(touchBlock || (_blockAction != null && _blockAction.IsPressed()));
            frame.Block = _block.On;

            ReadStrike(dt, ref frame);

            bool touchDodge = touch != null && touch.Dodge != null && touch.Dodge.Held;
            frame.DodgePressed = Edge(touchDodge, ref _touchDodgeWas) || Pressed(_dodge);
            if (touch != null && touch.ConsumeFlick(out var flickDir, out var undoPixels))
            {
                frame.DodgePressed = true;
                frame.DodgeScreenDirection = flickDir;
                var undo = touch.Look.ToDegrees(undoPixels.ToNumerics(), Screen.height, _settings.LookSensitivity, _settings.InvertLook).ToUnity();
                frame.LookDegrees -= undo;
            }

            bool touchJump = touch != null && touch.Jump != null && touch.Jump.Held;
            frame.JumpPressed = Edge(touchJump, ref _touchJumpWas) || Pressed(_jump);
            bool touchInteract = touch != null && touch.Interact != null && touch.Interact.Held;
            frame.InteractPressed = Edge(touchInteract, ref _touchInteractWas) || Pressed(_interact);
            bool touchLock = touch != null && touch.LockOn != null && touch.LockOn.Held;
            frame.LockOnPressed = Edge(touchLock, ref _touchLockWas) || Pressed(_lockOn);

            _frame = frame;
        }

        Vector2 ReadLook(float dt)
        {
            Vector2 look = Vector2.zero;
            float sensitivity = _settings.LookSensitivity;
            float invert = _settings.InvertLook ? -1f : 1f;
            if (touch != null)
                look += touch.Look.Consume(Screen.height, sensitivity, _settings.InvertLook).ToUnity();
            if (_look != null)
            {
                // Same convention as touch and mouse: pushing up looks up (pitch goes down).
                Vector2 pad = _look.ReadValue<Vector2>();
                look += new Vector2(pad.x, -pad.y * invert) * (gamepadLookDegreesPerSecond * sensitivity * dt);
            }
            var mouse = Mouse.current;
            if (mouse != null && mouse.rightButton.isPressed)
            {
                Vector2 delta = mouse.delta.ReadValue();
                look += new Vector2(delta.x, -delta.y * invert) * (mouseDegreesPerPixel * sensitivity);
            }
            return look;
        }

        void ReadStrike(float dt, ref PlayerInputFrame frame)
        {
            bool held = (touch != null && touch.Strike != null && touch.Strike.Held) || (_light != null && _light.IsPressed());
            if (held)
            {
                _lightHeldFor += dt;
                if (!_heavyFired && _lightHeldFor >= HeavyHoldSeconds)
                {
                    frame.HeavyPressed = true;
                    _heavyFired = true;
                }
            }
            else if (_lightWasHeld)
            {
                if (!_heavyFired)
                    frame.LightPressed = true;
                _lightHeldFor = 0f;
                _heavyFired = false;
            }
            _lightWasHeld = held;
        }

        static bool Pressed(InputAction action) => action != null && action.WasPressedThisFrame();

        static bool Edge(bool now, ref bool was)
        {
            bool pressed = now && !was;
            was = now;
            return pressed;
        }
    }
}
