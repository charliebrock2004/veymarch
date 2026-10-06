#nullable enable
using System;
using System.Numerics;

namespace Veyr.Client.Core
{
    /// <summary>Framing for one situation. Values from art bible §24 and design bible §11.6.</summary>
    public readonly struct CameraProfile
    {
        public CameraProfile(string name, float distance, float pivotHeight, float shoulder, float fov, float minPitch, float maxPitch)
        {
            Name = name;
            Distance = distance;
            PivotHeight = pivotHeight;
            Shoulder = shoulder;
            Fov = fov;
            MinPitch = minPitch;
            MaxPitch = maxPitch;
        }

        public string Name { get; }
        /// <summary>Boom length behind the pivot, metres.</summary>
        public float Distance { get; }
        /// <summary>Pivot height above the feet, metres. About head height.</summary>
        public float PivotHeight { get; }
        /// <summary>Sideways offset of the look point. Positive keeps the body left of centre for the right thumb.</summary>
        public float Shoulder { get; }
        public float Fov { get; }
        public float MinPitch { get; }
        public float MaxPitch { get; }

        public static CameraProfile Lerp(CameraProfile a, CameraProfile b, float t)
        {
            t = Math.Clamp(t, 0f, 1f);
            return new CameraProfile(
                t < 0.5f ? a.Name : b.Name,
                a.Distance + (b.Distance - a.Distance) * t,
                a.PivotHeight + (b.PivotHeight - a.PivotHeight) * t,
                a.Shoulder + (b.Shoulder - a.Shoulder) * t,
                a.Fov + (b.Fov - a.Fov) * t,
                a.MinPitch + (b.MinPitch - a.MinPitch) * t,
                a.MaxPitch + (b.MaxPitch - a.MaxPitch) * t);
        }
    }

    public static class CameraProfiles
    {
        /// <summary>Exploring: 4–6 m boom, body left of centre.</summary>
        public static readonly CameraProfile Explore = new CameraProfile("explore", 5f, 1.6f, 0.55f, 60f, -35f, 70f);
        /// <summary>Combat: closer, over the shoulder so the weapon reads.</summary>
        public static readonly CameraProfile Combat = new CameraProfile("combat", 4f, 1.55f, 0.65f, 60f, -30f, 60f);
        /// <summary>Indoors and dungeons: pulled in.</summary>
        public static readonly CameraProfile Indoor = new CameraProfile("indoor", 3f, 1.55f, 0.5f, 60f, -25f, 55f);
        /// <summary>Boss arenas: wider so floor tells stay visible.</summary>
        public static readonly CameraProfile Boss = new CameraProfile("boss", 7f, 1.8f, 0.45f, 64f, -20f, 65f);
    }

    public struct CameraPose
    {
        public Vector3 Position;
        public Vector3 LookAt;
        public float Fov;
        /// <summary>True when the camera is so close the body would fill the lens. The view fades the body.</summary>
        public bool HideBody;
        /// <summary>Distance actually used after collision.</summary>
        public float Distance;
    }

    /// <summary>
    /// Third-person orbit maths. The adapter casts a sphere from <see cref="Pivot"/> along
    /// <see cref="BoomDirection"/> for <see cref="DesiredBoomLength"/> and passes the hit distance
    /// back into <see cref="Solve"/>. The camera never ends inside the body capsule.
    /// </summary>
    public sealed class OrbitRig
    {
        const float Deg = MathF.PI / 180f;
        float _distance = -1f;

        public float Yaw { get; set; }
        public float Pitch { get; set; } = 12f;
        public CameraProfile Profile { get; set; } = CameraProfiles.Explore;
        /// <summary>Closest the boom may get before the camera lifts over the head instead.</summary>
        public float MinDistance { get; set; } = 0.9f;
        /// <summary>How fast the boom grows back after an obstacle clears, metres per second.</summary>
        public float EaseOutSpeed { get; set; } = 4f;
        public float CapsuleRadius { get; set; } = 0.35f;
        public float CapsuleHeight { get; set; } = 1.8f;
        /// <summary>Radius of the cast the adapter uses. Kept here so the resolve matches the cast.</summary>
        public float CastRadius { get; set; } = 0.25f;

        public void ApplyLook(float yawDegrees, float pitchDegrees)
        {
            if (float.IsNaN(yawDegrees) || float.IsNaN(pitchDegrees))
                return;
            Yaw = Sim.Movement.NormaliseYaw(Yaw + yawDegrees);
            Pitch = Math.Clamp(Pitch + pitchDegrees, Profile.MinPitch, Profile.MaxPitch);
        }

        public Vector3 Forward
        {
            get
            {
                float y = Yaw * Deg;
                float p = Pitch * Deg;
                return new Vector3(MathF.Sin(y) * MathF.Cos(p), -MathF.Sin(p), MathF.Cos(y) * MathF.Cos(p));
            }
        }

        public Vector3 Right
        {
            get
            {
                float y = Yaw * Deg;
                return new Vector3(MathF.Cos(y), 0f, -MathF.Sin(y));
            }
        }

        public Vector3 Pivot(Vector3 feet) => feet + new Vector3(0f, Profile.PivotHeight, 0f);

        /// <summary>Unnormalised vector from the pivot to where the camera wants to be.</summary>
        public Vector3 Boom => Right * Profile.Shoulder - Forward * Profile.Distance;

        public Vector3 BoomDirection => Vector3.Normalize(Boom);

        public float DesiredBoomLength => Boom.Length();

        /// <summary>
        /// Places the camera. <paramref name="obstacleDistance"/> is the sphere-cast hit distance along
        /// the boom, or null when nothing is in the way. A hit pulls the camera in at once; a cleared
        /// hit lets it ease back out.
        /// </summary>
        public CameraPose Solve(Vector3 feet, float? obstacleDistance, float dt)
        {
            Pitch = Math.Clamp(Pitch, Profile.MinPitch, Profile.MaxPitch);
            Vector3 pivot = Pivot(feet);
            Vector3 boom = Boom;
            float length = boom.Length();
            float allowed = obstacleDistance.HasValue ? Math.Clamp(obstacleDistance.Value, 0f, length) : length;

            if (_distance < 0f || allowed < _distance)
                _distance = allowed;
            else
                _distance = MathF.Min(allowed, _distance + EaseOutSpeed * MathF.Max(0f, dt));

            Vector3 dir = boom / length;
            Vector3 position = pivot + dir * _distance;
            bool hide = false;
            if (_distance < MinDistance)
            {
                // Too tight to sit behind the head. Lift over it rather than into the body.
                hide = true;
                float lift = CapsuleHeight + 0.35f - Profile.PivotHeight;
                position = pivot + dir * _distance + new Vector3(0f, MathF.Max(0f, lift), 0f);
            }

            position = KeepOutsideCapsule(feet, position);
            return new CameraPose
            {
                Position = position,
                LookAt = pivot + Right * Profile.Shoulder,
                Fov = Profile.Fov,
                HideBody = hide || _distance < MinDistance * 1.4f,
                Distance = _distance
            };
        }

        /// <summary>Pushes a point out of the body capsule (a cylinder with a cap, from the feet up).</summary>
        public Vector3 KeepOutsideCapsule(Vector3 feet, Vector3 point)
        {
            float top = CapsuleHeight + 0.1f;
            float rel = point.Y - feet.Y;
            if (rel < -0.1f || rel > top)
                return point;
            Vector2 flat = new Vector2(point.X - feet.X, point.Z - feet.Z);
            float r = flat.Length();
            float need = CapsuleRadius + 0.12f;
            if (r >= need)
                return point;
            // Inside the body: lift above the top of the capsule.
            return new Vector3(point.X, feet.Y + top + 0.05f, point.Z);
        }

        public static bool InsideCapsule(Vector3 feet, Vector3 point, float radius, float height)
        {
            float rel = point.Y - feet.Y;
            if (rel < 0f || rel > height)
                return false;
            float dx = point.X - feet.X;
            float dz = point.Z - feet.Z;
            return dx * dx + dz * dz < radius * radius;
        }
    }
}
