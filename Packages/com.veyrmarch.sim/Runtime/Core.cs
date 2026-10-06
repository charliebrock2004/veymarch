#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using Veyr.Content;

namespace Veyr.Sim
{
    public sealed class SimClock
    {
        public long Tick { get; private set; }

        public void Advance(int steps = 1)
        {
            if (steps < 0)
                throw new ArgumentOutOfRangeException(nameof(steps));
            Tick += steps;
        }

        public float ElapsedSeconds => Tick / (float)SimRates.TicksPerSecond;
    }

    /// <summary>
    /// What a client may ask for in one tick. Directions and buttons, plus an optional position
    /// claim the server checks. A client never sends health, damage, items, or seals.
    /// </summary>
    public struct PlayerIntent
    {
        /// <summary>Client sequence number. Echoed back so the client knows what the server has applied.</summary>
        public int Seq;
        /// <summary>World-space move direction. Length 0..1 is stick deflection.</summary>
        public float MoveX;
        public float MoveZ;
        /// <summary>Facing in degrees. 0 faces +Z; positive turns toward +X.</summary>
        public float Yaw;
        /// <summary>Legacy probe for the speed-cap test. A claimed speed over the cap is refused.</summary>
        public float ClaimedSpeed;
        public bool Sprint;
        public bool Dodge;
        public bool Jump;
        public bool Light;
        public bool Heavy;
        public bool Block;
        public bool Interact;
        /// <summary>
        /// When true, the client moved its own body (CharacterController, collision) and claims
        /// where it ended. The sim accepts the claim only inside the movement budget.
        /// </summary>
        public bool HasClaim;
        public float ClaimX;
        public float ClaimY;
        public float ClaimZ;

        /// <summary>Merges a newer intent into one that has not been stepped yet. Buttons are kept, not lost.</summary>
        public static PlayerIntent Merge(PlayerIntent older, PlayerIntent newer)
        {
            var merged = newer;
            merged.Dodge |= older.Dodge;
            merged.Jump |= older.Jump;
            merged.Light |= older.Light;
            merged.Heavy |= older.Heavy;
            merged.Interact |= older.Interact;
            return merged;
        }
    }

    public sealed class ActorBody
    {
        public string Id { get; init; } = "";
        public string DefId { get; set; } = "";
        public float X { get; set; }
        public float Y { get; set; }
        public float Z { get; set; }
        /// <summary>Facing in degrees. 0 faces +Z; positive turns toward +X.</summary>
        public float Yaw { get; set; }
        public float Health { get; set; } = 80;
        public float MaxHealth { get; set; } = 80;
        public float Stamina { get; set; } = 60;
        public float MaxStamina { get; set; } = 60;
        public float Mana { get; set; }
        public float MaxMana { get; set; }
        public float Posture { get; set; } = 100;
        public float MaxPosture { get; set; } = 100;
        public LifeState Life { get; set; } = LifeState.Alive;
        public int IFrameTicks { get; set; }
        public int StaggerTicks { get; set; }
        public int DownedTicks { get; set; }
        /// <summary>Ticks left in the dodge burst. Movement may exceed the run cap only while this is above zero.</summary>
        public int DodgeTicks { get; set; }
        public string EquippedId { get; set; } = "";
        public string OffHandId { get; set; } = "";
        public string HeadId { get; set; } = "";
        public string ChestId { get; set; } = "";
        public string HandsId { get; set; } = "";
        public string LegsId { get; set; } = "";
        public string CloakId { get; set; } = "";
        public string TrinketId { get; set; } = "";
        public long BlockStartedTick { get; set; } = -1;
        public bool Blocking { get; set; }
        public int Level { get; set; } = 1;
        public int Xp { get; set; }
        public string SpawnId { get; set; } = "pad_hearthfen";
        public float SpawnX { get; set; }
        public float SpawnY { get; set; }
        public float SpawnZ { get; set; }
        public int Combo { get; set; }
        public long ComboExpireTick { get; set; } = -1;
        /// <summary>Horizontal metres the body may still cover. Refilled each tick at the cap, banked briefly.</summary>
        public float MoveBank { get; set; }
        /// <summary>Climb beyond slope since the body last stopped rising. Caps sustained flight.</summary>
        public float Ascent { get; set; }
        /// <summary>Last client intent sequence the sim applied.</summary>
        public int LastSeq { get; set; }
    }

    public readonly struct MoveResult
    {
        public MoveResult(bool accepted, string reason, float x, float z, float y = 0f)
        {
            Accepted = accepted;
            Reason = reason;
            X = x;
            Z = z;
            Y = y;
        }

        public bool Accepted { get; }
        public string Reason { get; }
        public float X { get; }
        public float Z { get; }
        public float Y { get; }
    }

    public static class Movement
    {
        /// <summary>A single claim further than this is a teleport, not lag.</summary>
        public const float TeleportMetres = 6f;

        /// <summary>
        /// Server-integrated step. Used when the client sends no position claim (tests, AI,
        /// headless). Distance scales with stick deflection up to 1.
        /// </summary>
        public static MoveResult Step(ActorBody body, PlayerIntent intent, MoveTuning tuning, float moveScale = 1f, WorldGeometry? geometry = null, WorldFlags? flags = null)
        {
            if (intent.ClaimedSpeed > tuning.SpeedCapMetresPerSecond)
                return new MoveResult(false, "speed", body.X, body.Z, body.Y);

            float mag = MathF.Sqrt(intent.MoveX * intent.MoveX + intent.MoveZ * intent.MoveZ);
            if (mag < 0.001f && body.DodgeTicks <= 0)
                return new MoveResult(true, "", body.X, body.Z, body.Y);

            float speed;
            float dirX;
            float dirZ;
            if (body.DodgeTicks > 0)
            {
                speed = tuning.DodgeMetresPerSecond;
                if (mag >= 0.001f)
                {
                    dirX = intent.MoveX / mag;
                    dirZ = intent.MoveZ / mag;
                }
                else
                {
                    float rad = body.Yaw * (MathF.PI / 180f);
                    dirX = MathF.Sin(rad);
                    dirZ = MathF.Cos(rad);
                }
            }
            else
            {
                speed = intent.Sprint ? tuning.SprintMetresPerSecond : tuning.WalkMetresPerSecond;
                if (speed > tuning.SpeedCapMetresPerSecond)
                    return new MoveResult(false, "speed", body.X, body.Z, body.Y);
                speed *= MathF.Min(1f, mag);
                dirX = intent.MoveX / mag;
                dirZ = intent.MoveZ / mag;
            }

            speed *= Math.Clamp(moveScale, 0.2f, 1.25f);
            float step = speed * tuning.TickDt;
            float nx = body.X + dirX * step;
            float nz = body.Z + dirZ * step;
            if (geometry != null && flags != null && geometry.Blocks(flags, body.X, body.Z, nx, nz))
                return new MoveResult(false, "blocked", body.X, body.Z, body.Y);
            body.X = nx;
            body.Z = nz;
            return new MoveResult(true, "", body.X, body.Z, body.Y);
        }

        /// <summary>Speed a body may legally hold this tick, before status and set scaling.</summary>
        public static float SpeedLimit(ActorBody body, MoveTuning tuning) =>
            body.DodgeTicks > 0 ? tuning.DodgeMetresPerSecond : tuning.SpeedCapMetresPerSecond;

        /// <summary>
        /// Checks a client's claimed position against the movement budget, a teleport limit,
        /// sustained climb, and closed blockers. Accepted claims move the body; refused ones
        /// leave it where the sim last agreed, and the client must snap back.
        /// </summary>
        public static MoveResult ValidateClaim(ActorBody body, PlayerIntent intent, MoveTuning tuning, float moveScale, WorldGeometry geometry, WorldFlags flags)
        {
            float dt = tuning.TickDt;
            float limit = SpeedLimit(body, tuning) * Math.Clamp(moveScale, 0.2f, 1.25f);
            body.MoveBank = MathF.Min(body.MoveBank + limit * dt, MathF.Max(limit * dt, tuning.SpeedCapMetresPerSecond * tuning.ClaimBankSeconds));

            float dx = intent.ClaimX - body.X;
            float dz = intent.ClaimZ - body.Z;
            float dy = intent.ClaimY - body.Y;
            if (float.IsNaN(dx) || float.IsNaN(dy) || float.IsNaN(dz) || float.IsInfinity(dx) || float.IsInfinity(dy) || float.IsInfinity(dz))
                return new MoveResult(false, "invalid", body.X, body.Z, body.Y);

            float flat = MathF.Sqrt(dx * dx + dz * dz);
            float full = MathF.Sqrt(flat * flat + dy * dy);
            if (full > TeleportMetres)
                return new MoveResult(false, "teleport", body.X, body.Z, body.Y);
            if (flat > body.MoveBank + tuning.ClaimSlackMetres)
                return new MoveResult(false, "speed", body.X, body.Z, body.Y);

            float maxFall = tuning.TerminalFallMetresPerSecond * dt + tuning.ClaimSlackMetres;
            if (-dy > maxFall)
                return new MoveResult(false, "fall", body.X, body.Z, body.Y);

            // Rising faster than the slope allows uses the jump. A jump buys its apex, once.
            float climb = dy - flat;
            float ascent = dy > 0.01f ? body.Ascent + MathF.Max(0f, climb) : 0f;
            float apex = tuning.JumpVelocity * tuning.JumpVelocity / (2f * tuning.Gravity);
            if (ascent > apex + 0.5f)
                return new MoveResult(false, "climb", body.X, body.Z, body.Y);

            if (geometry.Blocks(flags, body.X, body.Z, intent.ClaimX, intent.ClaimZ))
                return new MoveResult(false, "blocked", body.X, body.Z, body.Y);

            // Slack is borrowed from the next tick, not granted every tick, so it cannot raise the cap.
            body.MoveBank = MathF.Max(-tuning.ClaimSlackMetres, body.MoveBank - flat);
            body.Ascent = ascent;
            body.X = intent.ClaimX;
            body.Y = intent.ClaimY;
            body.Z = intent.ClaimZ;
            return new MoveResult(true, "", body.X, body.Z, body.Y);
        }

        public static float NormaliseYaw(float yaw)
        {
            if (float.IsNaN(yaw) || float.IsInfinity(yaw))
                return 0f;
            yaw %= 360f;
            if (yaw < 0f)
                yaw += 360f;
            return yaw;
        }
    }

    public readonly struct DerivedStats
    {
        public DerivedStats(float health, float stamina, float mana, float load)
        {
            Health = health;
            Stamina = stamina;
            Mana = mana;
            Load = load;
        }

        public float Health { get; }
        public float Stamina { get; }
        public float Mana { get; }
        public float Load { get; }
    }

    public static class StatSheet
    {
        public static DerivedStats Derive(int vitality, int endurance, int focus) =>
            new(80 + vitality * 8, 60 + endurance * 6, focus * 10, 40 + endurance * 2);

        public static int LevelForXp(int xp)
        {
            int level = 1;
            int need = 20;
            int pool = xp;
            while (level < SimRates.SliceLevelCap && pool >= need)
            {
                pool -= need;
                level++;
                need += 20;
            }
            return level;
        }
    }
}
