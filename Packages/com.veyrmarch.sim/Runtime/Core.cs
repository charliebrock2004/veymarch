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

    public struct PlayerIntent
    {
        public float MoveX;
        public float MoveZ;
        public float ClaimedSpeed;
        public bool Sprint;
        public bool Dodge;
        public bool Light;
        public bool Heavy;
        public bool Block;
        public bool Interact;
    }

    public sealed class ActorBody
    {
        public string Id { get; init; } = "";
        public string DefId { get; set; } = "";
        public float X { get; set; }
        public float Z { get; set; }
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
        public float SpawnZ { get; set; }
        public int Combo { get; set; }
        public long ComboExpireTick { get; set; } = -1;
    }

    public readonly struct MoveResult
    {
        public MoveResult(bool accepted, string reason, float x, float z)
        {
            Accepted = accepted;
            Reason = reason;
            X = x;
            Z = z;
        }

        public bool Accepted { get; }
        public string Reason { get; }
        public float X { get; }
        public float Z { get; }
    }

    public static class Movement
    {
        public static MoveResult Step(ActorBody body, PlayerIntent intent, MoveTuning tuning, float moveScale = 1f)
        {
            if (intent.ClaimedSpeed > tuning.SpeedCapMetresPerSecond)
                return new MoveResult(false, "speed", body.X, body.Z);

            float mag = MathF.Sqrt(intent.MoveX * intent.MoveX + intent.MoveZ * intent.MoveZ);
            if (mag < 0.001f)
                return new MoveResult(true, "", body.X, body.Z);

            float speed = intent.Sprint ? tuning.SprintMetresPerSecond : tuning.WalkMetresPerSecond;
            speed *= Math.Clamp(moveScale, 0.2f, 1f);
            if (speed > tuning.SpeedCapMetresPerSecond)
                return new MoveResult(false, "speed", body.X, body.Z);

            float scale = speed * tuning.TickDt / mag;
            body.X += intent.MoveX * scale;
            body.Z += intent.MoveZ * scale;
            return new MoveResult(true, "", body.X, body.Z);
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
