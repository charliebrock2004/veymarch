#nullable enable
using System;

namespace Veyr.Content
{
    public sealed record ItemDef
    {
        public string Id { get; init; } = "";
        public string DisplayName { get; init; } = "";
        public ItemKind Kind { get; init; }
        public int MaxStack { get; init; } = 99;
        public EquipSlot Slot { get; init; }
        public Rarity Rarity { get; init; }
        public ToolTier Tier { get; init; }
        public int BaseDamage { get; init; }
        public int StaminaLight { get; init; } = 8;
        public int StaminaHeavy { get; init; } = 18;
        public int PostureDamage { get; init; } = 12;
        public float RangeMetres { get; init; } = 1.8f;
        public int Defence { get; init; }
        public SkillId Skill { get; init; }
        public Element Element { get; init; }
        public bool Soulbound { get; init; }
        public string MovesetId { get; init; } = "";
        public float Knockback { get; init; }
        public int DurabilityMax { get; init; }
        public int Heal { get; init; }
        public StatusId OnHit { get; init; } = StatusId.None;
    }

    public sealed record RecipeInput(string ItemId, int Count);

    public sealed record RecipeDef
    {
        public string Id { get; init; } = "";
        public string OutputItemId { get; init; } = "";
        public int OutputCount { get; init; } = 1;
        public StationId[] Stations { get; init; } = Array.Empty<StationId>();
        public RecipeInput[] Inputs { get; init; } = Array.Empty<RecipeInput>();
        public SkillId Skill { get; init; }
        public int MinSkillRank { get; init; }
        public bool Craftable { get; init; } = true;
    }

    public sealed record NodeDef
    {
        public string Id { get; init; } = "";
        public string DisplayName { get; init; } = "";
        public string YieldItemId { get; init; } = "";
        public int YieldCount { get; init; } = 1;
        public ToolTier RequiredTier { get; init; }
        public string? RequiredSeal { get; init; }
        public SkillId Practice { get; init; } = SkillId.Mining;
        /// <summary>Strikes before the node is spent. Trivial nodes respawn; story nodes may not.</summary>
        public int Charges { get; init; } = 3;
        /// <summary>Ticks until a spent node returns. 0 means never.</summary>
        public int RespawnTicks { get; init; } = SimRates.TicksPerSecond * 90;
    }

    public sealed record ActorDef
    {
        public string Id { get; init; } = "";
        public string DisplayName { get; init; } = "";
        public string RegionId { get; init; } = "";
        public string Verb { get; init; } = "";
        public int MaxHealth { get; init; }
        public int Damage { get; init; }
        public bool Elite { get; init; }
        public bool Hostile { get; init; } = true;
        public Element Weakness { get; init; }
        public int RegionBand { get; init; } = 1;
    }

    public sealed record BossPhaseDef(int Index, string Tell, string AttackId, int MaxTicks);

    public sealed record BossDef
    {
        public string Id { get; init; } = "";
        public string DisplayName { get; init; } = "";
        public string RegionId { get; init; } = "";
        public string? SealId { get; init; }
        public int BaseHealth { get; init; }
        public Element Weakness { get; init; }
        public string StaggerTell { get; init; } = "";
        public string[] RewardItemIds { get; init; } = Array.Empty<string>();
        public BossPhaseDef[] Phases { get; init; } = Array.Empty<BossPhaseDef>();
        public int AddCap { get; init; }
        public float HpPhase2 { get; init; } = 0.66f;
        public float HpPhase3 { get; init; } = 0.33f;
    }

    public sealed record RegionDef
    {
        public string Id { get; init; } = "";
        public string DisplayName { get; init; } = "";
        public int Band { get; init; }
        public string UniqueMechanic { get; init; } = "";
        public string? SealToEnter { get; init; }
        public string? SealAwarded { get; init; }
        public int DefenceK { get; init; } = 50;
    }

    public sealed record NpcDef
    {
        public string Id { get; init; } = "";
        public string DisplayName { get; init; } = "";
        public string RegionId { get; init; } = "";
        public string Role { get; init; } = "";
        public bool QuestCritical { get; init; }
        public string Want { get; init; } = "";
        public string Fear { get; init; } = "";
        public string RelatedNpcId { get; init; } = "";
        public string Notes { get; init; } = "";
    }

    public sealed record ScheduleEntry(float StartHour, float EndHour, string StationId);

    public sealed record NpcSchedule(string NpcId, ScheduleEntry[] Entries);

    public sealed record DialogueLine(string Key, string English);

    public sealed record QuestStepDef(string Kind, string Arg);

    public sealed record QuestDef
    {
        public string Id { get; init; } = "";
        public string DisplayName { get; init; } = "";
        public bool Optional { get; init; }
        public QuestStepDef[] Steps { get; init; } = Array.Empty<QuestStepDef>();
    }

    public sealed record SpellDef
    {
        public string Id { get; init; } = "";
        public string DisplayName { get; init; } = "";
        public Element School { get; init; }
        public int ManaCost { get; init; }
        public int CooldownTicks { get; init; }
        public int TtlTicks { get; init; }
        public int CapPerCaster { get; init; } = 8;
        public SchoolId Discipline { get; init; } = SchoolId.None;
        public int MinMagicRank { get; init; }
        public int CorruptionCost { get; init; }
        public string RequiredSeal { get; init; } = "";
        public string Grade { get; init; } = "cantrip";
    }

    public sealed record PieceDef
    {
        public string Id { get; init; } = "";
        public string DisplayName { get; init; } = "";
        public string CostItemId { get; init; } = "";
        public int CostCount { get; init; }
        public bool NeedsGround { get; init; } = true;
        public bool Bridge { get; init; }
        public int AnchorCount { get; init; }
    }

    public sealed record SettlementTierDef
    {
        public int Tier { get; init; }
        public string Name { get; init; } = "";
        public int Beds { get; init; }
        public bool Well { get; init; }
        public bool Bench { get; init; }
        public bool Palisade { get; init; }
        public bool FoodRequired { get; init; }
        public int Population { get; init; }
        public int MinHappiness { get; init; }
        public string Unlocks { get; init; } = "";
    }

    public sealed record WorldEventDef
    {
        public string Id { get; init; } = "";
        public string DisplayName { get; init; } = "";
        public int TelegraphSeconds { get; init; } = 60;
        public bool Major { get; init; } = true;
    }

    public sealed record SkillDef(SkillId Id, string DisplayName, int SliceCap);

    public sealed record LootEntry(string ItemId, int Weight, bool Guaranteed, bool Unique = false);

    public sealed record LootTableDef
    {
        public string Id { get; init; } = "";
        public LootEntry[] Entries { get; init; } = Array.Empty<LootEntry>();
    }

    public sealed record StatusDef
    {
        public StatusId Id { get; init; }
        public int BuildupMax { get; init; } = 30;
        public int DurationTicks { get; init; } = 80;
        public int DamagePerTick { get; init; }
        public float MoveScale { get; init; } = 1f;
        public bool Silences { get; init; }
        public CleanseSource[] CleansedBy { get; init; } = Array.Empty<CleanseSource>();
    }

    public sealed record ArmourSetDef
    {
        public string Id { get; init; } = "";
        public string[] PieceIds { get; init; } = Array.Empty<string>();
        public string BonusTwo { get; init; } = "";
        public string BonusFour { get; init; } = "";
    }

    public sealed record RoomKitDef
    {
        public string Id { get; init; } = "";
        public RoomKind Kind { get; init; }
        public int TellTicks { get; init; }
        public int TrapDamage { get; init; }
        public string RequiredSchool { get; init; } = "";
    }

    public sealed record DungeonKitDef
    {
        public string Id { get; init; } = "";
        public string RegionId { get; init; } = "";
        public int MinRooms { get; init; } = 6;
        public int MaxRooms { get; init; } = 14;
        public RoomKitDef[] Rooms { get; init; } = Array.Empty<RoomKitDef>();
    }

    public readonly struct VerbProfile
    {
        public VerbProfile(int telegraphTicks, int recoverTicks, float range, float knockback)
        {
            TelegraphTicks = telegraphTicks;
            RecoverTicks = recoverTicks;
            Range = range;
            Knockback = knockback;
        }

        public int TelegraphTicks { get; }
        public int RecoverTicks { get; }
        public float Range { get; }
        public float Knockback { get; }
    }

    /// <summary>
    /// Movement numbers live in data, not in Update. The sim validates against the cap;
    /// the client predicts with the walk, sprint, and dodge speeds.
    /// </summary>
    public sealed record MoveTuning
    {
        public float WalkMetresPerSecond { get; init; } = 4.2f;
        public float SprintMetresPerSecond { get; init; } = 6.4f;
        public float SpeedCapMetresPerSecond { get; init; } = 7f;
        /// <summary>Dodge burst. Allowed above the run cap for the dodge ticks only.</summary>
        public float DodgeMetresPerSecond { get; init; } = 9f;
        public int DodgeTicks { get; init; } = 6;
        public float JumpVelocity { get; init; } = 5.2f;
        public float Gravity { get; init; } = 18f;
        public float TerminalFallMetresPerSecond { get; init; } = 40f;
        /// <summary>Extra slack per tick for float error and step-up, in metres.</summary>
        public float ClaimSlackMetres { get; init; } = 0.15f;
        /// <summary>Movement budget a client may bank when packets bunch, in seconds of cap speed.</summary>
        public float ClaimBankSeconds { get; init; } = 0.5f;
        public float TickDt => 1f / SimRates.TicksPerSecond;
    }

    public static class SimRates
    {
        public const int TicksPerSecond = 20;
        public const int HurtboxTicks = 4;
        public const int DodgeIFrameTicks = 5;
        public const int ParryWindowTicks = 3;
        public const int StaggerTicks = 24;
        public const int DownedTicks = 600;
        public const float RealSecondsPerDay = 24f * 60f;
        public const float NightStartsHour = 16f;
        public const int SliceLevelCap = 12;
        public const int ProtocolVersion = 1;
        public const float HitSlackMetres = 0.5f;
        public const int InterestMetres = 100;
        public const string FistId = "wpn_fists";
        /// <summary>Gather, talk, and station use reach. Metres from the body to the object centre.</summary>
        public const float InteractReachMetres = 2.5f;
        /// <summary>Flank is behind this angle from the target's facing, in degrees.</summary>
        public const float FlankDegrees = 100f;
    }
}
