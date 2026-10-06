namespace Veyr.Content;

public sealed class ContentCatalog
{
    public required IReadOnlyDictionary<string, ItemDef> Items { get; init; }
    public required IReadOnlyDictionary<string, RecipeDef> Recipes { get; init; }
    public required IReadOnlyDictionary<string, NodeDef> Nodes { get; init; }
    public required IReadOnlyDictionary<string, ActorDef> Actors { get; init; }
    public required IReadOnlyDictionary<string, BossDef> Bosses { get; init; }
    public required IReadOnlyDictionary<string, RegionDef> Regions { get; init; }
    public required IReadOnlyList<NpcDef> Npcs { get; init; }
    public required IReadOnlyList<NpcSchedule> Schedules { get; init; }
    public required IReadOnlyDictionary<string, string> Lines { get; init; }
    public required IReadOnlyList<QuestDef> Quests { get; init; }
    public required IReadOnlyDictionary<string, SpellDef> Spells { get; init; }
    public required IReadOnlyDictionary<string, PieceDef> Pieces { get; init; }
    public required IReadOnlyList<SettlementTierDef> SettlementTiers { get; init; }
    public required IReadOnlyList<WorldEventDef> Events { get; init; }
    public required IReadOnlyList<SkillDef> Skills { get; init; }
    public IReadOnlyDictionary<StatusId, StatusDef> Statuses { get; init; } = new Dictionary<StatusId, StatusDef>();
    public IReadOnlyDictionary<string, LootTableDef> Loot { get; init; } = new Dictionary<string, LootTableDef>();
    public IReadOnlyDictionary<string, ArmourSetDef> Sets { get; init; } = new Dictionary<string, ArmourSetDef>();
    public IReadOnlyDictionary<string, DungeonKitDef> Dungeons { get; init; } = new Dictionary<string, DungeonKitDef>();
    public MoveTuning Move { get; init; } = new();

    public ItemDef Item(string id) => Items[id];
    public RecipeDef Recipe(string id) => Recipes[id];
    public NodeDef Node(string id) => Nodes[id];
    public BossDef Boss(string id) => Bosses[id];

    public static ContentCatalog Slice() => SliceCatalog.Create();
}
