namespace Veyr.Content;

public sealed record ItemDef
{
    public required string Id { get; init; }
    public required string DisplayName { get; init; }
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
}

public sealed record RecipeInput(string ItemId, int Count);

public sealed record RecipeDef
{
    public required string Id { get; init; }
    public required string OutputItemId { get; init; }
    public int OutputCount { get; init; } = 1;
    public StationId[] Stations { get; init; } = [];
    public RecipeInput[] Inputs { get; init; } = [];
    public SkillId Skill { get; init; }
    public int MinSkillRank { get; init; }
    public bool Craftable { get; init; } = true;
}

public sealed record NodeDef
{
    public required string Id { get; init; }
    public required string DisplayName { get; init; }
    public required string YieldItemId { get; init; }
    public int YieldCount { get; init; } = 1;
    public ToolTier RequiredTier { get; init; }
    public string? RequiredSeal { get; init; }
    public SkillId Practice { get; init; } = SkillId.Mining;
}

public sealed record ActorDef
{
    public required string Id { get; init; }
    public required string DisplayName { get; init; }
    public required string RegionId { get; init; }
    public required string Verb { get; init; }
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
    public required string Id { get; init; }
    public required string DisplayName { get; init; }
    public required string RegionId { get; init; }
    public string? SealId { get; init; }
    public int BaseHealth { get; init; }
    public Element Weakness { get; init; }
    public string StaggerTell { get; init; } = "";
    public string[] RewardItemIds { get; init; } = [];
    public BossPhaseDef[] Phases { get; init; } = [];
    public int AddCap { get; init; }
    public float HpPhase2 { get; init; } = 0.66f;
    public float HpPhase3 { get; init; } = 0.33f;
}

public sealed record RegionDef
{
    public required string Id { get; init; }
    public required string DisplayName { get; init; }
    public int Band { get; init; }
    public string UniqueMechanic { get; init; } = "";
    public string? SealToEnter { get; init; }
    public string? SealAwarded { get; init; }
    public int DefenceK { get; init; } = 50;
}

public sealed record NpcDef
{
    public required string Id { get; init; }
    public required string DisplayName { get; init; }
    public required string RegionId { get; init; }
    public required string Role { get; init; }
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
    public required string Id { get; init; }
    public required string DisplayName { get; init; }
    public bool Optional { get; init; }
    public QuestStepDef[] Steps { get; init; } = [];
}

public sealed record SpellDef
{
    public required string Id { get; init; }
    public required string DisplayName { get; init; }
    public Element School { get; init; }
    public int ManaCost { get; init; }
    public int CooldownTicks { get; init; }
    public int TtlTicks { get; init; }
    public int CapPerCaster { get; init; } = 8;
}

public sealed record PieceDef
{
    public required string Id { get; init; }
    public required string DisplayName { get; init; }
    public string CostItemId { get; init; } = "";
    public int CostCount { get; init; }
    public bool NeedsGround { get; init; } = true;
    public bool Bridge { get; init; }
    public int AnchorCount { get; init; }
}

public sealed record SettlementTierDef
{
    public int Tier { get; init; }
    public required string Name { get; init; }
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
    public required string Id { get; init; }
    public required string DisplayName { get; init; }
    public int TelegraphSeconds { get; init; } = 60;
    public bool Major { get; init; } = true;
}

public sealed record SkillDef(SkillId Id, string DisplayName, int SliceCap);

public sealed record LootEntry(string ItemId, int Weight, bool Guaranteed);

public sealed record MoveTuning
{
    public float WalkMetresPerSecond { get; init; } = 4.2f;
    public float SprintMetresPerSecond { get; init; } = 6.4f;
    public float SpeedCapMetresPerSecond { get; init; } = 7f;
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
}
