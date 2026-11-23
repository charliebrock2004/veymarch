#nullable enable
using System;
using System.Numerics;
using Veyr.Content;
using Veyr.Net;
using Veyr.Sim;

namespace Veyr.Client.Core
{
    public static class IntentMath
    {
        const float Deg = MathF.PI / 180f;

        /// <summary>
        /// Turns a stick (x right, y forward) into a world direction relative to the camera's yaw.
        /// Yaw 0 looks down +Z; positive yaw turns toward +X. Length is preserved.
        /// </summary>
        public static Vector2 CameraRelative(Vector2 stick, float cameraYawDegrees)
        {
            float rad = cameraYawDegrees * Deg;
            float sin = MathF.Sin(rad);
            float cos = MathF.Cos(rad);
            return new Vector2(stick.X * cos + stick.Y * sin, -stick.X * sin + stick.Y * cos);
        }

        /// <summary>Yaw that faces along a world direction, or <paramref name="fallback"/> for a zero vector.</summary>
        public static float YawOf(Vector2 world, float fallback)
        {
            if (world.LengthSquared() < 1e-8f)
                return fallback;
            float yaw = MathF.Atan2(world.X, world.Y) / Deg;
            return yaw < 0f ? yaw + 360f : yaw;
        }

        /// <summary>Signed shortest turn from one yaw to another, in degrees (-180..180].</summary>
        public static float DeltaAngle(float from, float to)
        {
            float d = (to - from) % 360f;
            if (d > 180f)
                d -= 360f;
            else if (d <= -180f)
                d += 360f;
            return d;
        }

        public static float MoveTowardsAngle(float current, float target, float maxDelta)
        {
            float d = DeltaAngle(current, target);
            if (MathF.Abs(d) <= maxDelta)
                return Movement.NormaliseYaw(target);
            return Movement.NormaliseYaw(current + MathF.Sign(d) * maxDelta);
        }
    }

    /// <summary>
    /// Sends one intent per sim tick. Button presses between sends are latched so a tap that lands
    /// between two ticks still reaches the sim. Sequence numbers rise by one per send.
    /// </summary>
    public sealed class IntentSender
    {
        static readonly double TickSeconds = 1.0 / SimRates.TicksPerSecond;
        double _accumulator;
        bool _dodge;
        bool _jump;
        bool _light;
        bool _heavy;
        bool _interact;

        public int Seq { get; private set; }

        public void Latch(bool dodge, bool jump, bool light, bool heavy, bool interact)
        {
            _dodge |= dodge;
            _jump |= jump;
            _light |= light;
            _heavy |= heavy;
            _interact |= interact;
        }

        /// <summary>Adds frame time. True when a send is due; a long frame still sends only once.</summary>
        public bool Due(double frameSeconds)
        {
            if (double.IsNaN(frameSeconds) || frameSeconds < 0)
                frameSeconds = 0;
            _accumulator += frameSeconds;
            if (_accumulator + 1e-9 < TickSeconds)
                return false;
            _accumulator -= TickSeconds;
            if (_accumulator > TickSeconds * 2)
                _accumulator = TickSeconds;
            return true;
        }

        /// <summary>Builds the next message and clears the latched presses.</summary>
        public IntentMessage Compose(Vector2 moveWorld, bool sprint, bool block, float yaw, Vector3 claim, long serverTick)
        {
            Seq++;
            var intent = new PlayerIntent
            {
                Seq = Seq,
                MoveX = moveWorld.X,
                MoveZ = moveWorld.Y,
                Yaw = Movement.NormaliseYaw(yaw),
                Sprint = sprint,
                Block = block,
                Dodge = _dodge,
                Jump = _jump,
                Light = _light,
                Heavy = _heavy,
                Interact = _interact,
                HasClaim = true,
                ClaimX = claim.X,
                ClaimY = claim.Y,
                ClaimZ = claim.Z
            };
            _dodge = _jump = _light = _heavy = _interact = false;
            return new IntentMessage { Protocol = Protocol.Version, ClientTick = serverTick, Intent = intent };
        }
    }

    public struct MotorInput
    {
        /// <summary>World-space move direction, length 0..1.</summary>
        public Vector2 Move;
        public bool Sprint;
        public bool JumpPressed;
        public bool DodgePressed;
        /// <summary>Dodge direction when the stick is idle (a flick). Zero means along the facing.</summary>
        public Vector2 DodgeDirection;
        /// <summary>Last stamina the server reported. A dodge it would refuse is not predicted.</summary>
        public float KnownStamina;
        /// <summary>Status and armour scaling the client knows about. 1 when unknown.</summary>
        public float SpeedScale;
    }

    /// <summary>
    /// The local body's movement model. The Unity adapter feeds the returned displacement into a
    /// CharacterController and reports back whether it is grounded. Speeds come from the same
    /// <see cref="MoveTuning"/> the sim validates against, so an honest client never exceeds the
    /// server's budget.
    /// </summary>
    public sealed class PredictionMotor
    {
        public const int BaseDodgeStamina = 16;
        readonly MoveTuning _tuning;
        Vector2 _horizontal;
        float _vertical;
        float _dodgeLeft;
        Vector2 _dodgeDir;

        public PredictionMotor(MoveTuning tuning)
        {
            _tuning = tuning;
        }

        /// <summary>Time to reach the target speed from rest, seconds. Short: responsiveness first.</summary>
        public float AccelerationTime { get; set; } = 0.08f;
        public float DecelerationTime { get; set; } = 0.06f;
        public float TurnDegreesPerSecond { get; set; } = 720f;
        public float Yaw { get; set; }
        public bool Grounded { get; set; } = true;
        public bool Dodging => _dodgeLeft > 0f;
        public Vector2 HorizontalVelocity => _horizontal;
        public float VerticalVelocity => _vertical;
        public float DodgeSeconds => _tuning.DodgeTicks * _tuning.TickDt;

        /// <summary>Advances one frame and returns the displacement to apply.</summary>
        public Vector3 Step(in MotorInput input, float dt)
        {
            if (dt <= 0f || float.IsNaN(dt))
                return Vector3.Zero;
            float scale = input.SpeedScale > 0f ? MathF.Min(1.25f, input.SpeedScale) : 1f;
            float moveMag = MathF.Min(1f, input.Move.Length());

            if (input.DodgePressed && !Dodging && Grounded && input.KnownStamina >= BaseDodgeStamina)
            {
                Vector2 dir = moveMag > 0.05f ? input.Move / input.Move.Length()
                    : input.DodgeDirection.LengthSquared() > 1e-6f ? Vector2.Normalize(input.DodgeDirection)
                    : new Vector2(MathF.Sin(Yaw * MathF.PI / 180f), MathF.Cos(Yaw * MathF.PI / 180f));
                _dodgeDir = dir;
                _dodgeLeft = DodgeSeconds;
            }

            if (Dodging)
            {
                _horizontal = _dodgeDir * (_tuning.DodgeMetresPerSecond * scale);
                _dodgeLeft = MathF.Max(0f, _dodgeLeft - dt);
                Yaw = IntentMath.YawOf(_dodgeDir, Yaw);
                if (!Dodging)
                    _horizontal = _dodgeDir * (_tuning.WalkMetresPerSecond * scale * moveMag);
            }
            else
            {
                float speed = (input.Sprint ? _tuning.SprintMetresPerSecond : _tuning.WalkMetresPerSecond) * scale * moveMag;
                Vector2 target = moveMag > 1e-4f ? input.Move / input.Move.Length() * speed : Vector2.Zero;
                float time = target.LengthSquared() > _horizontal.LengthSquared() ? AccelerationTime : DecelerationTime;
                float maxChange = time <= 0f ? float.MaxValue : _tuning.SprintMetresPerSecond / time * dt;
                Vector2 change = target - _horizontal;
                float changeLength = change.Length();
                _horizontal = changeLength <= maxChange ? target : _horizontal + change / changeLength * maxChange;
                if (moveMag > 0.05f)
                    Yaw = IntentMath.MoveTowardsAngle(Yaw, IntentMath.YawOf(input.Move, Yaw), TurnDegreesPerSecond * dt);
            }

            if (Grounded)
            {
                _vertical = -2f;
                if (input.JumpPressed && !Dodging)
                    _vertical = _tuning.JumpVelocity;
            }
            else
            {
                _vertical = MathF.Max(-_tuning.TerminalFallMetresPerSecond, _vertical - _tuning.Gravity * dt);
            }

            return new Vector3(_horizontal.X * dt, _vertical * dt, _horizontal.Y * dt);
        }

        /// <summary>Called when the server put the body somewhere else. Momentum is dropped with the position.</summary>
        public void Halt()
        {
            _horizontal = Vector2.Zero;
            _vertical = 0f;
            _dodgeLeft = 0f;
        }
    }
}
