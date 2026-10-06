using UnityEngine;
using Veyr.Client.CameraRig;
using Veyr.Client.Core;
using Veyr.Client.Input;
using Veyr.Content;
using Veyr.Net;
using Veyr.Sim;
using NVector2 = System.Numerics.Vector2;

namespace Veyr.Client.Player
{
    /// <summary>
    /// The local body. Moves a CharacterController with the prediction motor so the player feels
    /// no latency, sends one intent per tick with the position it claims, and accepts the
    /// server's word when it disagrees. It never decides health, damage, or items.
    /// </summary>
    [RequireComponent(typeof(CharacterController))]
    public sealed class LocalPlayerController : MonoBehaviour
    {
        [SerializeField] PlayerInputReader input;
        [SerializeField] OrbitCameraRig cameraRig;
        [Tooltip("Visual root that turns to face the move direction. The capsule itself never rotates.")]
        [SerializeField] Transform model;
        [Tooltip("Seconds over which a small server correction is blended in.")]
        [SerializeField] float smoothCorrectionSeconds = 0.12f;

        CharacterController _body;
        PredictionMotor _motor;
        readonly IntentSender _sender = new IntentSender();
        readonly Reconciler _reconciler = new Reconciler();
        ISimEndpoint _endpoint;
        string _actorId = "";
        Vector3 _pendingCorrection;
        float _knownStamina = 60f;
        float _knownHealth = 80f;
        float _knownMaxHealth = 80f;
        float _knownMaxStamina = 60f;

        public bool Bound => _endpoint != null;
        public string ActorId => _actorId;
        public float Yaw => _motor != null ? _motor.Yaw : 0f;
        public float Health => _knownHealth;
        public float MaxHealth => _knownMaxHealth;
        public float Stamina => _knownStamina;
        public float MaxStamina => _knownMaxStamina;
        public int Snaps { get; private set; }
        public int LastSentSeq => _sender.Seq;

        public void Wire(PlayerInputReader inputReader, OrbitCameraRig rig, Transform visual)
        {
            input = inputReader;
            cameraRig = rig;
            model = visual;
        }

        /// <summary>Called by the composition root once the session exists.</summary>
        public void Bind(SessionContext session)
        {
            _endpoint = session.Endpoint;
            _actorId = session.Endpoint.LocalActorId;
            _motor = new PredictionMotor(session.Content.Move);
            if (session.Endpoint.Latest.TryGet(_actorId, out var me))
            {
                Teleport(new Vector3(me.X, me.Y, me.Z));
                _motor.Yaw = me.Yaw;
                ReadVitals(me);
            }
        }

        void Awake()
        {
            _body = GetComponent<CharacterController>();
        }

        void Update()
        {
            if (_endpoint == null || input == null)
                return;
            float dt = Time.deltaTime;
            var frame = input.Current;
            float cameraYaw = cameraRig != null ? cameraRig.Yaw : 0f;
            NVector2 moveWorld = IntentMath.CameraRelative(frame.Move.ToNumerics(), cameraYaw);
            NVector2 flickWorld = NVector2.Zero;
            if (frame.DodgeScreenDirection.sqrMagnitude > 0.0001f)
                flickWorld = IntentMath.CameraRelative(frame.DodgeScreenDirection.normalized.ToNumerics(), cameraYaw);

            var motorInput = new MotorInput
            {
                Move = moveWorld,
                Sprint = frame.Sprint,
                JumpPressed = frame.JumpPressed,
                DodgePressed = frame.DodgePressed,
                DodgeDirection = flickWorld,
                KnownStamina = _knownStamina,
                SpeedScale = 1f
            };
            Vector3 delta = _motor.Step(motorInput, dt).ToUnity();
            delta += DrainCorrection(dt);
            _body.Move(delta);
            _motor.Grounded = _body.isGrounded;
            if (model != null)
                model.rotation = Quaternion.Euler(0f, _motor.Yaw, 0f);

            // A flick dodge with an idle stick still needs a direction for the sim's dodge burst.
            NVector2 intentMove = moveWorld.LengthSquared() > 0.0001f ? moveWorld : (frame.DodgePressed ? flickWorld : NVector2.Zero);
            _sender.Latch(frame.DodgePressed, frame.JumpPressed, frame.LightPressed, frame.HeavyPressed, frame.InteractPressed);
            if (_sender.Due(Time.unscaledDeltaTime))
            {
                var claim = transform.position.ToNumerics();
                var message = _sender.Compose(intentMove, frame.Sprint, frame.Block, _motor.Yaw, claim, _endpoint.ServerTick);
                _reconciler.Record(message.Intent.Seq, claim);
                _endpoint.Send(message);
            }
        }

        /// <summary>Snapshot from the authority. A drift from what the client claimed is corrected.</summary>
        public void OnSnapshot(WorldSnapshot snapshot)
        {
            if (_endpoint == null || !snapshot.TryGet(_actorId, out var me))
                return;
            ReadVitals(me);
            var correction = _reconciler.Check(me.LastSeq, new System.Numerics.Vector3(me.X, me.Y, me.Z));
            if (correction.Kind == CorrectionKind.Snap)
                Snap(new Vector3(me.X, me.Y, me.Z));
            else if (correction.Kind == CorrectionKind.Smooth)
                _pendingCorrection += correction.Offset.ToUnity();
        }

        /// <summary>Sim events for this body. A refused move or a respawn puts the body where the sim says.</summary>
        public void OnSimEvent(SimEvent e)
        {
            if (e.ActorId != _actorId)
                return;
            if (e.Kind == SimEventKind.MoveRejected || e.Kind == SimEventKind.Respawned)
                Snap(new Vector3(e.X, e.Y, e.Z));
        }

        void ReadVitals(in ActorSnapshot me)
        {
            _knownStamina = me.Stamina;
            _knownMaxStamina = me.MaxStamina;
            _knownHealth = me.Health;
            _knownMaxHealth = me.MaxHealth;
        }

        Vector3 DrainCorrection(float dt)
        {
            if (_pendingCorrection.sqrMagnitude < 1e-8f)
                return Vector3.zero;
            float t = smoothCorrectionSeconds <= 0f ? 1f : Mathf.Clamp01(dt / smoothCorrectionSeconds);
            Vector3 step = _pendingCorrection * t;
            _pendingCorrection -= step;
            return step;
        }

        void Snap(Vector3 position)
        {
            Snaps++;
            _pendingCorrection = Vector3.zero;
            _motor?.Halt();
            Teleport(position);
        }

        void Teleport(Vector3 position)
        {
            // A CharacterController overrides a direct transform write unless it is disabled first.
            bool was = _body.enabled;
            _body.enabled = false;
            transform.position = position;
            _body.enabled = was;
        }
    }
}
