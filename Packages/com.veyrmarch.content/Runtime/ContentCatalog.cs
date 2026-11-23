using System.Collections.Generic;

namespace Veyr.Content
{
    public sealed class ContentCatalog
    {
        public IReadOnlyDictionary<string, ItemDef> Items { get; init; } = new Dictionary<string, ItemDef>();
        public IReadOnlyDictionary<string, RecipeDef> Recipes { get; init; } = new Dictionary<string, RecipeDef>();
        public IReadOnlyDictionary<string, NodeDef> Nodes { get; init; } = new Dictionary<string, NodeDef>();
        public IReadOnlyDictionary<string, ActorDef> Actors { get; init; } = new Dictionary<string, ActorDef>();
        public IReadOnlyDictionary<string, BossDef> Bosses { get; init; } = new Dictionary<string, BossDef>();
        public IReadOnlyDictionary<string, RegionDef> Regions { get; init; } = new Dictionary<string, RegionDef>();
        public IReadOnlyList<NpcDef> Npcs { get; init; } = new List<NpcDef>();
        public IReadOnlyList<NpcSchedule> Schedules { get; init; } = new List<NpcSchedule>();
        public IReadOnlyDictionary<string, string> Lines { get; init; } = new Dictionary<string, string>();
        public IReadOnlyList<QuestDef> Quests { get; init; } = new List<QuestDef>();
        public IReadOnlyDictionary<string, SpellDef> Spells { get; init; } = new Dictionary<string, SpellDef>();
        public IReadOnlyDictionary<string, PieceDef> Pieces { get; init; } = new Dictionary<string, PieceDef>();
        public IReadOnlyList<SettlementTierDef> SettlementTiers { get; init; } = new List<SettlementTierDef>();
        public IReadOnlyList<WorldEventDef> Events { get; init; } = new List<WorldEventDef>();
        public IReadOnlyList<SkillDef> Skills { get; init; } = new List<SkillDef>();
        public IReadOnlyDictionary<StatusId, StatusDef> Statuses { get; init; } = new Dictionary<StatusId, StatusDef>();
        public IReadOnlyDictionary<string, LootTableDef> Loot { get; init; } = new Dictionary<string, LootTableDef>();
        public IReadOnlyDictionary<string, ArmourSetDef> Sets { get; init; } = new Dictionary<string, ArmourSetDef>();
        public IReadOnlyDictionary<string, DungeonKitDef> Dungeons { get; init; } = new Dictionary<string, DungeonKitDef>();
        public MoveTuning Move { get; init; } = new MoveTuning();

        public ItemDef Item(string id) => Items[id];
        public RecipeDef Recipe(string id) => Recipes[id];
        public NodeDef Node(string id) => Nodes[id];
        public BossDef Boss(string id) => Bosses[id];

        public static ContentCatalog Slice() => SliceCatalog.Create();
    }
}
