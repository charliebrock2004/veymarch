namespace Veyr.Content;

public static class ExtendedCatalog
{
    public static IEnumerable<ItemDef> Items()
    {
        yield return Arm("arm_hunter_head", "Hunter Hood", EquipSlot.Head, 1);
        yield return Arm("arm_hunter_chest", "Hunter Hide", EquipSlot.Chest, 1);
        yield return Arm("arm_hunter_hands", "Hunter Wraps", EquipSlot.Hands, 1);
        yield return Arm("arm_hunter_legs", "Hunter Trousers", EquipSlot.Legs, 1);
        yield return Arm("arm_knight_head", "Knight Helm", EquipSlot.Head, 6);
        yield return Arm("arm_knight_chest", "Knight Plate", EquipSlot.Chest, 8);
        yield return Arm("arm_knight_hands", "Knight Gauntlets", EquipSlot.Hands, 4);
        yield return Arm("arm_knight_legs", "Knight Greaves", EquipSlot.Legs, 6);
        yield return new ItemDef
        {
            Id = "arm_finster_plate",
            DisplayName = "Finster Plate",
            Kind = ItemKind.Armour,
            Slot = EquipSlot.Chest,
            Rarity = Rarity.Unique,
            Defence = 14,
            MaxStack = 1,
            Soulbound = true,
            DurabilityMax = 40
        };
        yield return new ItemDef
        {
            Id = "wpn_stone_hammer",
            DisplayName = "Stone Hammer",
            Kind = ItemKind.Weapon,
            Slot = EquipSlot.MainHand,
            Rarity = Rarity.Common,
            BaseDamage = 12,
            StaminaLight = 10,
            StaminaHeavy = 22,
            PostureDamage = 28,
            RangeMetres = 1.5f,
            Skill = SkillId.Hammer,
            MovesetId = "hammer",
            Knockback = 1.2f,
            DurabilityMax = 20,
            MaxStack = 1
        };
        yield return new ItemDef
        {
            Id = "wpn_bone_dagger",
            DisplayName = "Bone Dagger",
            Kind = ItemKind.Weapon,
            Slot = EquipSlot.MainHand,
            Rarity = Rarity.Common,
            BaseDamage = 8,
            StaminaLight = 5,
            StaminaHeavy = 12,
            RangeMetres = 1.3f,
            Skill = SkillId.Dagger,
            MovesetId = "dagger",
            OnHit = StatusId.Bleed,
            DurabilityMax = 20,
            MaxStack = 1
        };
        yield return new ItemDef
        {
            Id = "cons_bandage",
            DisplayName = "Bandage",
            Kind = ItemKind.Consumable,
            MaxStack = 10,
            Heal = 15
        };
        yield return new ItemDef
        {
            Id = "trinket_copper",
            DisplayName = "Copper Nail",
            Kind = ItemKind.Armour,
            Slot = EquipSlot.Trinket,
            Rarity = Rarity.Common,
            MaxStack = 1,
            Element = Element.Lightning
        };
    }

    public static IEnumerable<RecipeDef> Recipes()
    {
        yield return new RecipeDef
        {
            Id = "recipe_bandage",
            OutputItemId = "cons_bandage",
            Stations = [StationId.Hand, StationId.Campfire],
            Inputs = [new RecipeInput("mat_fibre", 1)],
            Skill = SkillId.Cooking
        };
        yield return new RecipeDef
        {
            Id = "recipe_stone_hammer",
            OutputItemId = "wpn_stone_hammer",
            Stations = [StationId.Bench],
            Inputs = [new RecipeInput("mat_stone", 2), new RecipeInput("mat_wood", 1)],
            Skill = SkillId.Blacksmithing
        };
    }

    public static IEnumerable<SpellDef> Spells()
    {
        yield return Art("spell_hearthlash", "Hearthlash", Element.Fire, SchoolId.Fire, 14, 1);
        yield return Art("spell_kiln_wall", "Kiln Wall", Element.Fire, SchoolId.Fire, 16, 2);
        yield return Rite("spell_cinder_rite", "Cinder Rite", Element.Fire, SchoolId.Fire, 0);
        yield return Cantrip("spell_rime", "Rime", Element.Ice, SchoolId.Ice);
        yield return Art("spell_glass_spear", "Glass Spear", Element.Ice, SchoolId.Ice, 14, 1);
        yield return Art("spell_hoarfrost_ring", "Hoarfrost Ring", Element.Ice, SchoolId.Ice, 16, 2);
        yield return Rite("spell_still_rite", "Still Rite", Element.Ice, SchoolId.Ice, 0);
        yield return Cantrip("spell_spark", "Spark", Element.Lightning, SchoolId.Lightning);
        yield return Art("spell_rod_bolt", "Rod Bolt", Element.Lightning, SchoolId.Lightning, 14, 1);
        yield return Art("spell_arc_step", "Arc Step", Element.Lightning, SchoolId.Lightning, 12, 2);
        yield return Rite("spell_storm_rite", "Storm Rite", Element.Lightning, SchoolId.Lightning, 0);
        yield return Cantrip("spell_pebble", "Pebble", Element.Earth, SchoolId.Earth);
        yield return Art("spell_bulwark", "Bulwark", Element.Earth, SchoolId.Earth, 12, 1);
        yield return Art("spell_grave_of_stone", "Grave of Stone", Element.Earth, SchoolId.Earth, 16, 2);
        yield return Rite("spell_root_rite", "Root Rite", Element.Earth, SchoolId.Earth, 0);
        yield return Cantrip("spell_dim", "Dim", Element.Shadow, SchoolId.Shadow);
        yield return Art("spell_needle", "Needle", Element.Shadow, SchoolId.Shadow, 12, 1);
        yield return Art("spell_step_aside", "Step-Aside", Element.Shadow, SchoolId.Shadow, 14, 2);
        yield return Rite("spell_name_eater", "Name-Eater", Element.Shadow, SchoolId.Shadow, 0);
        yield return Cantrip("spell_gleam", "Gleam", Element.Holy, SchoolId.Holy);
        yield return Art("spell_turn", "Turn", Element.Holy, SchoolId.Holy, 12, 1);
        yield return Art("spell_sanctuary", "Sanctuary", Element.Holy, SchoolId.Holy, 18, 2);
        yield return Rite("spell_bell_rite", "Bell Rite", Element.Holy, SchoolId.Holy, 0);
        yield return Cantrip("spell_whisper", "Whisper", Element.Void, SchoolId.Forbidden, 4);
        yield return Art("spell_debt_bolt", "Debt Bolt", Element.Void, SchoolId.Forbidden, 16, 2, 8);
        yield return Art("spell_second_skin", "Second Skin", Element.Void, SchoolId.Forbidden, 18, 3, 12);
        yield return new SpellDef
        {
            Id = "spell_open_the_tear",
            DisplayName = "Open the Tear",
            School = Element.Void,
            Discipline = SchoolId.Forbidden,
            ManaCost = 40,
            CooldownTicks = 200,
            TtlTicks = 40,
            MinMagicRank = 4,
            CorruptionCost = 25,
            RequiredSeal = "seal_guardian",
            Grade = "rite"
        };
    }

    public static IReadOnlyDictionary<StatusId, StatusDef> Statuses()
    {
        StatusDef[] all =
        [
            Status(StatusId.Bleed, 3, 100, 1f, CleanseSource.Potion, CleanseSource.Campfire),
            Status(StatusId.Poison, 2, 120, 1f, CleanseSource.Potion, CleanseSource.Spell),
            Status(StatusId.Burn, 4, 60, 1f, CleanseSource.Spell, CleanseSource.Campfire),
            Status(StatusId.Frost, 0, 80, 0.6f, CleanseSource.Spell, CleanseSource.Campfire),
            Status(StatusId.Shock, 2, 40, 1f, CleanseSource.Spell),
            Status(StatusId.Rot, 3, 100, 0.85f, CleanseSource.Spell, CleanseSource.Potion),
            Status(StatusId.Curse, 1, 160, 1f, CleanseSource.Spell),
            new StatusDef
            {
                Id = StatusId.Silence,
                BuildupMax = 20,
                DurationTicks = 60,
                Silences = true,
                CleansedBy = [CleanseSource.Spell, CleanseSource.Campfire]
            }
        ];
        return all.ToDictionary(s => s.Id);
    }

    public static IReadOnlyDictionary<string, LootTableDef> Loot() => new Dictionary<string, LootTableDef>
    {
        ["loot_wolf"] = new()
        {
            Id = "loot_wolf",
            Entries = [new LootEntry("mat_bone", 5, false), new LootEntry("mat_leather", 2, false)]
        },
        ["loot_goblin"] = new()
        {
            Id = "loot_goblin",
            Entries = [new LootEntry("mat_fibre", 4, false), new LootEntry("mat_flint", 1, false)]
        },
        ["loot_unique_once"] = new()
        {
            Id = "loot_unique_once",
            Entries = [new LootEntry("wpn_smacko", 1, true, true), new LootEntry("mat_bone", 1, false)]
        }
    };

    public static IReadOnlyDictionary<string, ArmourSetDef> Sets() => new Dictionary<string, ArmourSetDef>
    {
        ["set_hunter"] = new()
        {
            Id = "set_hunter",
            PieceIds = ["arm_hunter_head", "arm_hunter_chest", "arm_hunter_hands", "arm_hunter_legs"],
            BonusTwo = "move",
            BonusFour = "bow"
        },
        ["set_knight"] = new()
        {
            Id = "set_knight",
            PieceIds = ["arm_knight_head", "arm_knight_chest", "arm_knight_hands", "arm_knight_legs"],
            BonusTwo = "defence",
            BonusFour = "dodge_cost"
        }
    };

    public static IReadOnlyDictionary<string, DungeonKitDef> Dungeons() => new Dictionary<string, DungeonKitDef>
    {
        ["dungeon_cookie"] = new()
        {
            Id = "dungeon_cookie",
            RegionId = "forest",
            MinRooms = 6,
            MaxRooms = 14,
            Rooms =
            [
                new RoomKitDef { Id = "entrance", Kind = RoomKind.Entrance },
                new RoomKitDef { Id = "corridor", Kind = RoomKind.Corridor },
                new RoomKitDef { Id = "trap_bell", Kind = RoomKind.Trap, TellTicks = 16, TrapDamage = 12 },
                new RoomKitDef { Id = "weight_hall", Kind = RoomKind.Puzzle },
                new RoomKitDef { Id = "elite_den", Kind = RoomKind.Elite },
                new RoomKitDef { Id = "secret", Kind = RoomKind.Secret },
                new RoomKitDef { Id = "nursery", Kind = RoomKind.Boss }
            ]
        }
    };

    static ItemDef Arm(string id, string name, EquipSlot slot, int defence) => new()
    {
        Id = id,
        DisplayName = name,
        Kind = ItemKind.Armour,
        Slot = slot,
        Defence = defence,
        MaxStack = 1,
        DurabilityMax = 30
    };

    static SpellDef Cantrip(string id, string name, Element element, SchoolId school, int corruption = 0) => new()
    {
        Id = id,
        DisplayName = name,
        School = element,
        Discipline = school,
        ManaCost = 6,
        CooldownTicks = 12,
        TtlTicks = 40,
        CorruptionCost = corruption,
        Grade = "cantrip"
    };

    static SpellDef Art(string id, string name, Element element, SchoolId school, int mana, int rank, int corruption = 0) => new()
    {
        Id = id,
        DisplayName = name,
        School = element,
        Discipline = school,
        ManaCost = mana,
        CooldownTicks = 30,
        TtlTicks = 60,
        MinMagicRank = rank,
        CorruptionCost = corruption,
        Grade = "art"
    };

    static SpellDef Rite(string id, string name, Element element, SchoolId school, int corruption) => new()
    {
        Id = id,
        DisplayName = name,
        School = element,
        Discipline = school,
        ManaCost = 28,
        CooldownTicks = 80,
        TtlTicks = 20,
        MinMagicRank = 3,
        CorruptionCost = corruption,
        Grade = "rite"
    };

    static StatusDef Status(StatusId id, int damage, int duration, float move, params CleanseSource[] cleanse) => new()
    {
        Id = id,
        DamagePerTick = damage,
        DurationTicks = duration,
        MoveScale = move,
        CleansedBy = cleanse
    };
}
