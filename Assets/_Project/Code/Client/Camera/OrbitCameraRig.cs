using UnityEngine;
using Veyr.Client.Core;
using Veyr.Client.Input;

namespace Veyr.Client.CameraRig
{
    /// <summary>
    /// Third-person orbit camera (art bible §24). The maths lives in <see cref="OrbitRig"/>; this
    /// adapter feeds it look input and a sphere cast, ignoring the player's own colliders.
    /// </summary>
    [DefaultExecutionOrder(200)]
    public sealed class OrbitCameraRig : MonoBehaviour
    {
        [SerializeField] Camera viewCamera;
        [SerializeField] Transform target;
        [SerializeField] PlayerInputReader input;
        [SerializeField] LayerMask obstacles = ~0;
        [Tooltip("Renderers faded when the camera is pressed against the body.")]
        [SerializeField] Renderer[] bodyRenderers = new Renderer[0];

        readonly OrbitRig _rig = new OrbitRig();
        readonly RaycastHit[] _hits = new RaycastHit[8];
        Collider[] _ignore = new Collider[0];
        CameraProfile _from = CameraProfiles.Explore;
        CameraProfile _to = CameraProfiles.Explore;
        float _blend = 1f;
        bool _bodyHidden;

        public float Yaw => _rig.Yaw;
        public float Pitch => _rig.Pitch;
        public OrbitRig Rig => _rig;
        public Camera ViewCamera => viewCamera;
        public bool BodyHidden => _bodyHidden;

        public void Wire(Camera cam, Transform followTarget, PlayerInputReader inputReader, Renderer[] renderers)
        {
            viewCamera = cam;
            target = followTarget;
            input = inputReader;
            bodyRenderers = renderers ?? new Renderer[0];
            CacheIgnored();
        }

        /// <summary>Blend to another framing: combat, indoor, boss. Seconds to complete.</summary>
        public void SetProfile(CameraProfile profile, float seconds = 0.4f)
        {
            _from = _rig.Profile;
            _to = profile;
            _blend = seconds <= 0f ? 1f : 0f;
            _blendSeconds = Mathf.Max(0.01f, seconds);
        }

        float _blendSeconds = 0.4f;

        void Awake()
        {
            CacheIgnored();
            if (target != null)
                _rig.Yaw = target.eulerAngles.y;
        }

        void CacheIgnored()
        {
            _ignore = target != null ? target.GetComponentsInChildren<Collider>(true) : new Collider[0];
        }

        void LateUpdate()
        {
            if (target == null || viewCamera == null)
                return;
            float dt = Time.unscaledDeltaTime;
            if (_blend < 1f)
            {
                _blend = Mathf.Min(1f, _blend + dt / _blendSeconds);
                _rig.Profile = CameraProfile.Lerp(_from, _to, _blend);
            }

            if (input != null)
            {
                Vector2 look = input.Current.LookDegrees;
                _rig.ApplyLook(look.x, look.y);
            }

            Vector3 feet = target.position;
            Vector3 pivot = _rig.Pivot(feet.ToNumerics()).ToUnity();
            Vector3 direction = _rig.BoomDirection.ToUnity();
            float length = _rig.DesiredBoomLength;
            float? hit = NearestObstacle(pivot, direction, length);
            var pose = _rig.Solve(feet.ToNumerics(), hit, dt);

            Vector3 position = pose.Position.ToUnity();
            Vector3 lookAt = pose.LookAt.ToUnity();
            transform.position = position;
            Vector3 forward = lookAt - position;
            if (forward.sqrMagnitude > 1e-6f)
                transform.rotation = Quaternion.LookRotation(forward, Vector3.up);
            viewCamera.fieldOfView = pose.Fov;
            SetBodyHidden(pose.HideBody);
        }

        float? NearestObstacle(Vector3 origin, Vector3 direction, float length)
        {
            int count = Physics.SphereCastNonAlloc(origin, _rig.CastRadius, direction, _hits, length, obstacles, QueryTriggerInteraction.Ignore);
            float best = float.MaxValue;
            for (int i = 0; i < count; i++)
            {
                var h = _hits[i];
                if (h.collider == null || IsIgnored(h.collider))
                    continue;
                // A cast that starts inside a collider reports distance 0 and point zero; treat it as touching.
                float d = h.distance;
                if (d < best)
                    best = d;
            }
            return best < float.MaxValue ? best : (float?)null;
        }

        bool IsIgnored(Collider c)
        {
            for (int i = 0; i < _ignore.Length; i++)
            {
                if (_ignore[i] == c)
                    return true;
            }
            return false;
        }

        void SetBodyHidden(bool hidden)
        {
            if (hidden == _bodyHidden)
                return;
            _bodyHidden = hidden;
            for (int i = 0; i < bodyRenderers.Length; i++)
            {
                if (bodyRenderers[i] != null)
                    bodyRenderers[i].enabled = !hidden;
            }
        }
    }
}
