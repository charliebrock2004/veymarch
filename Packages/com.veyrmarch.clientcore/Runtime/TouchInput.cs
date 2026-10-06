#nullable enable
using System;
using System.Numerics;

namespace Veyr.Client.Core
{
    /// <summary>
    /// Floating thumb stick for the left half of the screen. The stick appears where the thumb lands
    /// and follows it past the rim, so a thumb that drifts never loses the stick. Positions are in
    /// screen pixels; the radius should already be scaled for the device's DPI or reference size.
    /// </summary>
    public sealed class VirtualStick
    {
        public float RadiusPixels { get; set; } = 110f;
        public float DeadZone { get; set; } = 0.12f;
        /// <summary>Deflection at which a held stick counts as a sprint request.</summary>
        public float SprintThreshold { get; set; } = 0.92f;

        public int PointerId { get; private set; } = -1;
        public Vector2 Origin { get; private set; }
        public Vector2 Knob { get; private set; }
        /// <summary>Stick value, x right and y forward, length 0..1 after the dead zone.</summary>
        public Vector2 Value { get; private set; }
        public bool Active => PointerId >= 0;
        public bool AtRim => Value.Length() >= SprintThreshold;

        public bool Press(int pointerId, Vector2 position)
        {
            if (Active || pointerId < 0)
                return false;
            PointerId = pointerId;
            Origin = position;
            Knob = position;
            Value = Vector2.Zero;
            return true;
        }

        public void Drag(int pointerId, Vector2 position)
        {
            if (pointerId != PointerId)
                return;
            float radius = MathF.Max(1f, RadiusPixels);
            Vector2 offset = position - Origin;
            float length = offset.Length();
            if (length > radius)
            {
                Vector2 dir = offset / length;
                Origin = position - dir * radius;
                offset = dir * radius;
                length = radius;
            }
            Knob = Origin + offset;
            Value = Remap(offset / radius, DeadZone);
        }

        public void Release(int pointerId)
        {
            if (pointerId != PointerId)
                return;
            PointerId = -1;
            Value = Vector2.Zero;
            Knob = Origin;
        }

        public static Vector2 Remap(Vector2 raw, float deadZone)
        {
            float mag = raw.Length();
            if (mag <= deadZone || mag < 1e-6f)
                return Vector2.Zero;
            float clamped = MathF.Min(1f, mag);
            float scaled = (clamped - deadZone) / (1f - deadZone);
            return raw / mag * scaled;
        }
    }

    /// <summary>
    /// Right-side look zone. Drag turns the camera; a short fast swipe is a dodge flick
    /// (design bible §11.1, §31). The turn a flick made is handed back so the camera can undo it.
    /// </summary>
    public sealed class LookDrag
    {
        Vector2 _pending;
        Vector2 _gesture;
        Vector2 _pressAt;
        double _pressTime;

        /// <summary>Degrees of yaw for a drag the height of the screen, at sensitivity 1.</summary>
        public float DegreesPerScreenHeight { get; set; } = 200f;
        /// <summary>Minimum swipe for a flick, as a fraction of screen height.</summary>
        public float FlickMinFraction { get; set; } = 0.09f;
        public double FlickMaxSeconds { get; set; } = 0.18;

        public int PointerId { get; private set; } = -1;
        public bool Active => PointerId >= 0;

        public bool Press(int pointerId, Vector2 position, double time)
        {
            if (Active || pointerId < 0)
                return false;
            PointerId = pointerId;
            _pressAt = position;
            _pressTime = time;
            _gesture = Vector2.Zero;
            return true;
        }

        public void Drag(int pointerId, Vector2 delta)
        {
            if (pointerId != PointerId)
                return;
            _pending += delta;
            _gesture += delta;
        }

        /// <summary>
        /// Ends the touch. Returns true and the screen-space direction when the touch was a flick.
        /// <paramref name="gestureTurn"/> is the pixel drag the gesture applied, to undo on a flick.
        /// </summary>
        public bool Release(int pointerId, Vector2 position, double time, float screenHeight, out Vector2 flickDirection, out Vector2 gestureTurn)
        {
            flickDirection = Vector2.Zero;
            gestureTurn = Vector2.Zero;
            if (pointerId != PointerId)
                return false;
            PointerId = -1;
            Vector2 travel = position - _pressAt;
            float length = travel.Length();
            bool flick = time - _pressTime <= FlickMaxSeconds && length >= FlickMinFraction * MathF.Max(1f, screenHeight);
            if (!flick)
                return false;
            flickDirection = travel / length;
            gestureTurn = _gesture;
            return true;
        }

        /// <summary>Returns yaw and pitch change in degrees since the last call, then clears it.</summary>
        public Vector2 Consume(float screenHeight, float sensitivity, bool invertY)
        {
            float scale = DegreesPerScreenHeight * sensitivity / MathF.Max(1f, screenHeight);
            Vector2 turn = new Vector2(_pending.X * scale, (invertY ? 1f : -1f) * _pending.Y * scale);
            _pending = Vector2.Zero;
            return turn;
        }

        /// <summary>Converts a pixel drag into degrees with the same scale as <see cref="Consume"/>.</summary>
        public Vector2 ToDegrees(Vector2 pixels, float screenHeight, float sensitivity, bool invertY)
        {
            float scale = DegreesPerScreenHeight * sensitivity / MathF.Max(1f, screenHeight);
            return new Vector2(pixels.X * scale, (invertY ? 1f : -1f) * pixels.Y * scale);
        }
    }

    /// <summary>
    /// A button that is either held or toggled, per accessibility settings. Tracks the press edge
    /// for actions that fire once.
    /// </summary>
    public sealed class HoldOrToggle
    {
        bool _toggled;
        bool _wasDown;

        public bool Toggle { get; set; }
        public bool On { get; private set; }
        public bool PressedThisFrame { get; private set; }

        public void Update(bool down)
        {
            PressedThisFrame = down && !_wasDown;
            _wasDown = down;
            if (Toggle)
            {
                if (PressedThisFrame)
                    _toggled = !_toggled;
                On = _toggled;
            }
            else
            {
                On = down;
            }
        }

        public void Clear()
        {
            _toggled = false;
            On = false;
        }
    }
}
