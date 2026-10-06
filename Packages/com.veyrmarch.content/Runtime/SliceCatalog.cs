namespace Veyr.Content;

public static class SliceCatalog
{
    public static ContentCatalog Create()
    {
        var items = Items().ToDictionary(i => i.Id);
        var recipes = Recipes().ToDictionary(r => r.Id);
        var nodes = Nodes().ToDictionary(n => n.Id);
        var actors = Actors().ToDictionary(a => a.Id);
        var bosses = Bosses().ToDictionary(b => b.Id);
        var regions = Regions().ToDictionary(r => r.Id);
        var spells = Spells().ToDictionary(s => s.Id);
        var pieces = Pieces().ToDictionary(p => p.Id);
        return new ContentCatalog
        {
            Items = items,
            Recipes = recipes,
            Nodes = nodes,
            Actors = actors,
            Bosses = bosses,
            Regions = regions,
            Npcs = Npcs(),
            Schedules = Schedules(),
            Lines = Lines(),
            Quests = Quests(),
            Spells = spells,
            Pieces = pieces,
            SettlementTiers = Tiers(),
            Events = Events(),
            Skills = Skills()
        };
    }

    static ItemDef Mat(string id, string name, ToolTier tier = ToolTier.None) => new()
    {
        Id = id,
        DisplayName = name,
        Kind = ItemKind.Material,
        Tier = tier,
        MaxStack = 99
    };

    static ItemDef Weapon(
        string id,
        string name,
        int damage,
        ToolTier tier,
        SkillId skill,
        Rarity rarity,
        bool soulbound,
        string moveset,
        float range = 1.8f,
        int posture = 12,
        int light = 8,
        int heavy = 18,
        Element element = Element.None) => new()
    {
        Id = id,
        DisplayName = name,
        Kind = moveset is "pick" or "drill" ? ItemKind.Tool : ItemKind.Weapon,
        Slot = EquipSlot.MainHand,
        Rarity = rarity,
        Tier = tier,
        BaseDamage = damage,
        StaminaLight = light,
        StaminaHeavy = heavy,
        PostureDamage = posture,
        RangeMetres = range,
        Skill = skill,
        Element = element,
        Soulbound = soulbound,
        MovesetId = moveset,
        MaxStack = 1
    };

    static IEnumerable<ItemDef> Items()
    {
        yield return new ItemDef
        {
            Id = SimRates.FistId,
            DisplayName = "Fists",
            Kind = ItemKind.Weapon,
            Slot = EquipSlot.MainHand,
            MaxStack = 1,
            BaseDamage = 4,
            StaminaLight = 6,
            StaminaHeavy = 14,
            PostureDamage = 4,
            RangeMetres = 1.2f,
            Skill = SkillId.None,
            MovesetId = "fists"
        };
        yield return Mat("mat_wood", "Wood");
        yield return Mat("mat_flint", "Flint");
        yield return Mat("mat_stone", "Stone");
        yield return Mat("mat_fibre", "Fibre");
        yield return Mat("mat_bone", "Bone");
        yield return Mat("mat_resin", "Resin");
        yield return Mat("mat_copper", "Copper");
        yield return Mat("mat_iron", "Iron");
        yield return Mat("mat_leather", "Leather");
        yield return Mat("mat_honey", "Honey");
        yield return Mat("mat_froststeel", "Froststeel");
        yield return Mat("mat_mire_crystal", "Mire Crystal");
        yield return Mat("mat_grave_iron", "Grave Iron");
        yield return Mat("mat_sunstone", "Sunstone");
        yield return Mat("mat_infernal", "Infernal Ore");
        yield return Mat("mat_abyssal", "Abyssal Crystal");
        yield return Mat("mat_celestium", "Celestium");
        yield return Mat("mat_voidstone_shard", "Voidstone");
        yield return Mat("mat_cookie_brass", "Cookie Brass");
        yield return Weapon("wpn_stone_knife", "Stone Knife", 10, ToolTier.Hand, SkillId.Dagger, Rarity.Common, false, "knife", 1.5f, 8, 7, 14);
        yield return Weapon("wpn_stone_pick", "Stone Pick", 7, ToolTier.Stone, SkillId.Mining, Rarity.Common, false, "pick", 1.6f);
        yield return Weapon("wpn_copper_pick", "Copper Pick", 9, ToolTier.Copper, SkillId.Mining, Rarity.Common, false, "pick", 1.6f);
        yield return Weapon("wpn_copper_sword", "Copper Sword", 14, ToolTier.Copper, SkillId.Sword, Rarity.Common, false, "sword", 1.9f, 14, 9, 18);
        yield return Weapon("wpn_iron_sword", "Iron Sword", 20, ToolTier.Royal, SkillId.Sword, Rarity.Uncommon, false, "sword", 1.9f, 16);
        yield return Weapon("wpn_cookie_blade", "Cookie's Blade", 22, ToolTier.Cookie, SkillId.Sword, Rarity.Unique, true, "cookie_blade", 2f, 18, 9, 20, Element.None);
        yield return Weapon("wpn_cookie_pick", "Cookie's Pickaxe", 16, ToolTier.Cookie, SkillId.Mining, Rarity.Unique, true, "cookie_pick", 1.7f);
        yield return new ItemDef
        {
            Id = "key_cookie_core",
            DisplayName = "Cookie's Core",
            Kind = ItemKind.Key,
            Rarity = Rarity.Unique,
            Soulbound = true,
            MaxStack = 1,
            Tier = ToolTier.Cookie
        };
        yield return Weapon("wpn_smacko", "Smacko", 18, ToolTier.Cookie, SkillId.Sword, Rarity.Unique, true, "smacko", 1.8f, 20, 6, 12);
        yield return Weapon("wpn_knightfall", "Knightfall Greatsword", 28, ToolTier.Royal, SkillId.Greatsword, Rarity.Unique, true, "greatsword", 2.2f, 28, 14, 26);
        yield return Weapon("wpn_royal_pick", "Royal Pickaxe", 18, ToolTier.Royal, SkillId.Mining, Rarity.Unique, true, "pick");
        yield return Key("key_knights_oath", "Knight's Oath");
        yield return Weapon("wpn_mire_staff", "Mire Staff", 12, ToolTier.Rotbreaker, SkillId.Magic, Rarity.Unique, true, "staff", 2.4f, element: Element.Rot);
        yield return Weapon("wpn_rotbreaker", "Rotbreaker Pickaxe", 18, ToolTier.Rotbreaker, SkillId.Mining, Rarity.Unique, true, "pick");
        yield return Key("key_mothers_veil", "Mother's Veil");
        yield return Weapon("wpn_grave_blade", "Grave King's Blade", 30, ToolTier.Soulbreaker, SkillId.Sword, Rarity.Unique, true, "sword", element: Element.Soul);
        yield return Weapon("wpn_soulbreaker", "Soulbreaker Pickaxe", 20, ToolTier.Soulbreaker, SkillId.Mining, Rarity.Unique, true, "pick");
        yield return Key("key_crown_shard", "Crown Shard");
        yield return Weapon("wpn_wyrmfang", "Wyrmfang", 32, ToolTier.Frostbite, SkillId.Greatsword, Rarity.Unique, true, "greatsword", element: Element.Ice);
        yield return Weapon("wpn_frostbite", "Frostbite Pickaxe", 20, ToolTier.Frostbite, SkillId.Mining, Rarity.Unique, true, "pick");
        yield return Key("key_wyrm_heart", "Wyrm Heart");
        yield return Weapon("wpn_pharaoh_blade", "Pharaoh's Blade", 34, ToolTier.Sunbreaker, SkillId.Sword, Rarity.Unique, true, "sword", element: Element.Fire);
        yield return Weapon("wpn_sunbreaker", "Sunbreaker Pickaxe", 22, ToolTier.Sunbreaker, SkillId.Mining, Rarity.Unique, true, "pick");
        yield return Key("key_solar_cartouche", "Solar Cartouche");
        yield return Weapon("wpn_infernal_gs", "Infernal Greatsword", 38, ToolTier.Magma, SkillId.Greatsword, Rarity.Unique, true, "greatsword", element: Element.Fire);
        yield return Weapon("wpn_magma_drill", "Magma Drill", 24, ToolTier.Magma, SkillId.Mining, Rarity.Unique, true, "drill");
        yield return Key("key_titan_nail", "Titan Nail");
        yield return Weapon("wpn_tidebreaker", "Tidebreaker", 36, ToolTier.Abyssal, SkillId.Sword, Rarity.Unique, true, "sword", element: Element.Lightning);
        yield return Weapon("wpn_abyssal_drill", "Abyssal Drill", 24, ToolTier.Abyssal, SkillId.Mining, Rarity.Unique, true, "drill");
        yield return Key("key_queens_lung", "Queen's Lung");
        yield return Weapon("wpn_celestial_blade", "Celestial Blade", 40, ToolTier.Starforged, SkillId.Sword, Rarity.Unique, true, "sword", element: Element.Holy);
        yield return Weapon("wpn_starforged", "Starforged Pickaxe", 26, ToolTier.Starforged, SkillId.Mining, Rarity.Unique, true, "pick");
        yield return Key("key_sky", "Sky Key");
        yield return Weapon("wpn_finster_longsword", "Finster's Longsword", 44, ToolTier.Starforged, SkillId.Greatsword, Rarity.Unique, true, "finster", 2.4f, 30, element: Element.Void);
        yield return new ItemDef
        {
            Id = "mat_voidstone",
            DisplayName = "Voidstone",
            Kind = ItemKind.Material,
            Rarity = Rarity.Mythic,
            Soulbound = true,
            MaxStack = 1,
            Tier = ToolTier.Starforged,
            Element = Element.Void
        };
        yield return new ItemDef
        {
            Id = "arm_stump_shield",
            DisplayName = "Stump Shield",
            Kind = ItemKind.Armour,
            Slot = EquipSlot.OffHand,
            Rarity = Rarity.Common,
            Defence = 6,
            MaxStack = 1,
            Skill = SkillId.Defence,
            MovesetId = "shield"
        };
        yield return new ItemDef
        {
            Id = "arm_cloth",
            DisplayName = "Cloth",
            Kind = ItemKind.Armour,
            Slot = EquipSlot.Chest,
            Defence = 0,
            MaxStack = 1
        };
        yield return new ItemDef
        {
            Id = "piece_bedroll_kit",
            DisplayName = "Bedroll",
            Kind = ItemKind.Quest,
            MaxStack = 5
        };
        yield return new ItemDef
        {
            Id = "piece_fire_kit",
            DisplayName = "Campfire Kit",
            Kind = ItemKind.Quest,
            MaxStack = 5
        };
        yield return new ItemDef
        {
            Id = "piece_bench_kit",
            DisplayName = "Bench Kit",
            Kind = ItemKind.Quest,
            MaxStack = 5
        };
    }

    static ItemDef Key(string id, string name) => new()
    {
        Id = id,
        DisplayName = name,
        Kind = ItemKind.Key,
        Rarity = Rarity.Unique,
        Soulbound = true,
        MaxStack = 1
    };

    static IEnumerable<RecipeDef> Recipes()
    {
        yield return new RecipeDef
        {
            Id = "recipe_stone_knife",
            OutputItemId = "wpn_stone_knife",
            Stations = [StationId.Hand, StationId.Bench],
            Inputs = [new("mat_flint", 2), new("mat_wood", 1)]
        };
        yield return new RecipeDef
        {
            Id = "recipe_stone_pick",
            OutputItemId = "wpn_stone_pick",
            Stations = [StationId.Bench],
            Inputs = [new("mat_flint", 3), new("mat_wood", 2), new("mat_fibre", 1)]
        };
        yield return new RecipeDef
        {
            Id = "recipe_copper_pick",
            OutputItemId = "wpn_copper_pick",
            Stations = [StationId.Bench],
            Inputs = [new("mat_copper", 4), new("mat_wood", 2), new("wpn_stone_pick", 1)]
        };
        yield return new RecipeDef
        {
            Id = "recipe_copper_sword",
            OutputItemId = "wpn_copper_sword",
            Stations = [StationId.Bench],
            Inputs = [new("mat_copper", 5), new("mat_wood", 1), new("mat_flint", 1)]
        };
        yield return new RecipeDef
        {
            Id = "recipe_iron_sword",
            OutputItemId = "wpn_iron_sword",
            Stations = [StationId.Forge],
            Skill = SkillId.Blacksmithing,
            MinSkillRank = 2,
            Inputs = [new("mat_iron", 6), new("mat_wood", 2), new("mat_leather", 1)]
        };
        yield return new RecipeDef
        {
            Id = "recipe_cookie_blade",
            OutputItemId = "wpn_cookie_blade",
            Craftable = false,
            Stations = [StationId.Forge],
            Inputs = [new("mat_cookie_brass", 1), new("mat_iron", 1)]
        };
    }

    static IEnumerable<NodeDef> Nodes()
    {
        yield return new NodeDef { Id = "node_wood", DisplayName = "Tree", YieldItemId = "mat_wood", RequiredTier = ToolTier.Hand, Practice = SkillId.Woodcutting };
        yield return new NodeDef { Id = "node_flint", DisplayName = "Flint", YieldItemId = "mat_flint", RequiredTier = ToolTier.Hand };
        yield return new NodeDef { Id = "node_stone", DisplayName = "Stone", YieldItemId = "mat_stone", RequiredTier = ToolTier.Hand };
        yield return new NodeDef { Id = "node_fibre", DisplayName = "Fibre", YieldItemId = "mat_fibre", RequiredTier = ToolTier.Hand };
        yield return new NodeDef { Id = "node_bone", DisplayName = "Bone", YieldItemId = "mat_bone", RequiredTier = ToolTier.Hand };
        yield return new NodeDef { Id = "node_copper", DisplayName = "Copper Creek", YieldItemId = "mat_copper", RequiredTier = ToolTier.Stone };
        yield return new NodeDef { Id = "node_iron", DisplayName = "Iron Vein", YieldItemId = "mat_iron", RequiredTier = ToolTier.Cookie, RequiredSeal = "seal_cookie" };
        yield return new NodeDef { Id = "node_froststeel", DisplayName = "Froststeel", YieldItemId = "mat_froststeel", RequiredTier = ToolTier.Frostbite, RequiredSeal = "seal_wyrm" };
        yield return new NodeDef { Id = "node_mire", DisplayName = "Mire Crystal", YieldItemId = "mat_mire_crystal", RequiredTier = ToolTier.Rotbreaker, RequiredSeal = "seal_mire" };
        yield return new NodeDef { Id = "node_grave", DisplayName = "Grave Iron", YieldItemId = "mat_grave_iron", RequiredTier = ToolTier.Soulbreaker, RequiredSeal = "seal_grave" };
        yield return new NodeDef { Id = "node_sun", DisplayName = "Sunstone", YieldItemId = "mat_sunstone", RequiredTier = ToolTier.Sunbreaker, RequiredSeal = "seal_pharaoh" };
        yield return new NodeDef { Id = "node_infernal", DisplayName = "Infernal Ore", YieldItemId = "mat_infernal", RequiredTier = ToolTier.Magma, RequiredSeal = "seal_titan" };
        yield return new NodeDef { Id = "node_abyssal", DisplayName = "Abyssal Crystal", YieldItemId = "mat_abyssal", RequiredTier = ToolTier.Abyssal, RequiredSeal = "seal_queen" };
        yield return new NodeDef { Id = "node_celestium", DisplayName = "Celestium", YieldItemId = "mat_celestium", RequiredTier = ToolTier.Starforged, RequiredSeal = "seal_guardian" };
    }

    static ActorDef Mob(string id, string name, string region, string verb, int band, bool elite = false, bool hostile = true, Element weakness = Element.None)
    {
        int hp = (18 + band * 3) * (elite ? 2 : 1);
        return new ActorDef
        {
            Id = id,
            DisplayName = name,
            RegionId = region,
            Verb = verb,
            MaxHealth = hp,
            Damage = 3 + band / 2,
            Elite = elite,
            Hostile = hostile,
            Weakness = weakness,
            RegionBand = band
        };
    }

    static IEnumerable<ActorDef> Actors()
    {
        yield return Mob("mob_wolf", "Bramble Wolf", "forest", "pounce", 2);
        yield return Mob("mob_boar", "Tusk Boar", "forest", "charge", 2, hostile: false);
        yield return Mob("mob_spider", "Orchard Spider", "forest", "web", 3);
        yield return Mob("mob_goblin", "Stitch Goblin", "forest", "rush", 3);
        yield return Mob("mob_bandit", "Road Knife", "forest", "flank", 4);
        yield return Mob("mob_spirit", "Lantern Spirit", "forest", "drain", 4);
        yield return Mob("mob_bear", "Moss Bear", "forest", "maul", 5);
        yield return Mob("mob_shambler", "Root Shambler", "forest", "root", 4);
        yield return Mob("mob_grove_matron", "Grove Matron", "forest", "brood", 6, true);
        yield return Mob("mob_redcap", "Redcap Captain", "forest", "net", 6, true);
        yield return Mob("mob_mossback", "Mossback Bear", "forest", "maul", 6, true);
        yield return Mob("mob_deserter", "Deserter", "kingdom", "oathbreak", 8);
        yield return Mob("mob_thief", "Banner Thief", "kingdom", "snatch", 8);
        yield return Mob("mob_tax_hound", "Tax Hound", "kingdom", "tax", 9);
        yield return Mob("mob_archer", "Wall Archer", "kingdom", "pin", 9);
        yield return Mob("mob_ghoul", "Cellar Ghoul", "kingdom", "cling", 10);
        yield return Mob("mob_shade", "Tournament Shade", "kingdom", "echo", 10);
        yield return Mob("mob_witch", "Bell Witch", "mire", "hex", 14, weakness: Element.Fire);
        yield return Mob("mob_croc", "Silt Croc", "mire", "snap", 13);
        yield return Mob("mob_midge", "Choir Midge", "mire", "cloud", 12);
        yield return Mob("mob_hulk", "Peat Hulk", "mire", "sink", 15);
        yield return Mob("mob_toad", "Widow Toad", "mire", "spit", 13);
        yield return Mob("mob_verger", "Cathedral Verger", "mire", "censer", 16, true);
        yield return Mob("mob_skeleton", "Rake Skeleton", "waste", "rake", 18);
        yield return Mob("mob_walker", "Drowned Walker", "waste", "shamble", 18);
        yield return Mob("mob_ghost", "Veil Ghost", "waste", "wail", 19);
        yield return Mob("mob_notary", "Bone Notary", "waste", "name-call", 19);
        yield return Mob("mob_oath_knight", "Oath Knight", "waste", "salute", 20, true);
        yield return Mob("mob_lamprey", "Soul Lamprey", "waste", "drain", 18);
        yield return Mob("mob_frost_wolf", "Pale Wolf", "frost", "whiteout", 22);
        yield return Mob("mob_yeti", "Ridge Yeti", "frost", "avalanche", 24, true);
        yield return Mob("mob_glass_spider", "Glass Spider", "frost", "shatter", 22);
        yield return Mob("mob_rime", "Rime Elemental", "frost", "breath", 23, weakness: Element.Fire);
        yield return Mob("mob_pilgrim", "Frozen Pilgrim", "frost", "kneel", 22);
        yield return Mob("mob_fox", "Desert Fox", "desert", "steal", 26, hostile: false);
        yield return Mob("mob_scorpion", "Gilt Scorpion", "desert", "sting", 26);
        yield return Mob("mob_worm", "Dune Worm", "desert", "surface", 28, true);
        yield return Mob("mob_mummy", "Linen Mummy", "desert", "bind", 27);
        yield return Mob("mob_sun_bandit", "Sun Bandit", "desert", "lane", 26);
        yield return Mob("mob_salt", "Salt Spirit", "desert", "scour", 27);
        yield return Mob("mob_imp", "Cinder Imp", "volcano", "spark", 30);
        yield return Mob("mob_lizard", "Crust Lizard", "volcano", "crack", 30);
        yield return Mob("mob_kiln", "Kiln Elemental", "volcano", "bellows", 32, weakness: Element.Ice);
        yield return Mob("mob_slag", "Slag Beast", "volcano", "slag", 31);
        yield return Mob("mob_cantor", "Ash Cantor", "volcano", "chant", 31);
        yield return Mob("mob_shark", "Shelf Shark", "drowned", "open-water", 34);
        yield return Mob("mob_tide_knight", "Tide Knight", "drowned", "riposte", 35);
        yield return Mob("mob_jelly", "Lantern Jelly", "drowned", "lamp", 33, hostile: false);
        yield return Mob("mob_eel", "Abyssal Eel", "drowned", "breath-steal", 35);
        yield return Mob("mob_hull", "Hull Crawler", "drowned", "cling", 34);
        yield return Mob("mob_ray", "Gale Ray", "sky", "updraft", 38);
        yield return Mob("mob_wisp", "Storm Wisp", "sky", "flash", 38);
        yield return Mob("mob_seraph", "Bridge Seraph", "sky", "lock", 40, true);
        yield return Mob("mob_chorister", "Fallen Chorister", "sky", "hymn", 39);
        yield return Mob("mob_memory_knight", "Memory Knight", "void", "echo-attack", 42);
        yield return Mob("mob_button_remnant", "Button-eyed Remnant", "void", "wind-up", 42);
        yield return Mob("mob_hound_shade", "Hound Shade", "void", "collar", 42);
        yield return Mob("mob_tear_leach", "Tear Leach", "void", "sour", 44, true);
    }

    static BossPhaseDef P(int i, string tell, string attack, int max) => new(i, tell, attack, max);

    static IEnumerable<BossDef> Bosses()
    {
        yield return new BossDef
        {
            Id = "boss_cookie",
            DisplayName = "Cookie",
            RegionId = "forest",
            SealId = "seal_cookie",
            BaseHealth = 180,
            Weakness = Element.Fire,
            StaggerTell = "back-stitch",
            RewardItemIds = ["wpn_cookie_blade", "wpn_cookie_pick", "key_cookie_core"],
            AddCap = 4,
            Phases =
            [
                P(1, "bow", "peck", 400),
                P(2, "coat-open", "spin", 0),
                P(3, "music-box", "slam", 0)
            ]
        };
        yield return new BossDef
        {
            Id = "boss_boe",
            DisplayName = "Boe",
            RegionId = "forest",
            SealId = null,
            BaseHealth = 140,
            Weakness = Element.Earth,
            StaggerTell = "landing",
            RewardItemIds = ["wpn_smacko"],
            AddCap = 0,
            Phases = [P(1, "wag", "charge", 0), P(2, "collar", "pounce", 0), P(3, "wings", "dive", 0)]
        };
        yield return new BossDef
        {
            Id = "boss_black_knight",
            DisplayName = "The Black Knight",
            RegionId = "kingdom",
            SealId = "seal_knight",
            BaseHealth = 260,
            Weakness = Element.Lightning,
            StaggerTell = "salute",
            RewardItemIds = ["wpn_knightfall", "wpn_royal_pick", "key_knights_oath"],
            Phases = [P(1, "shield", "counter", 0), P(2, "sword", "rush", 0), P(3, "broken-oath", "edge", 0)]
        };
        yield return new BossDef
        {
            Id = "boss_mire_mother",
            DisplayName = "Mire Mother",
            RegionId = "mire",
            SealId = "seal_mire",
            BaseHealth = 280,
            Weakness = Element.Fire,
            RewardItemIds = ["wpn_mire_staff", "wpn_rotbreaker", "key_mothers_veil"],
            Phases = [P(1, "hymn", "censer", 0), P(2, "knee", "swing", 0), P(3, "drown", "flood", 0)]
        };
        yield return new BossDef
        {
            Id = "boss_grave_king",
            DisplayName = "Grave King",
            RegionId = "waste",
            SealId = "seal_grave",
            BaseHealth = 300,
            Weakness = Element.Holy,
            StaggerTell = "name",
            RewardItemIds = ["wpn_grave_blade", "wpn_soulbreaker", "key_crown_shard"],
            Phases = [P(1, "roll", "court", 0), P(2, "duel", "blade", 0), P(3, "mass", "call", 0)]
        };
        yield return new BossDef
        {
            Id = "boss_wyrm",
            DisplayName = "Frost Wyrm",
            RegionId = "frost",
            SealId = "seal_wyrm",
            BaseHealth = 340,
            Weakness = Element.Fire,
            RewardItemIds = ["wpn_wyrmfang", "wpn_frostbite", "key_wyrm_heart"],
            Phases = [P(1, "inhale", "ground", 0), P(2, "lanes", "breath", 0), P(3, "low-flight", "dive", 0)]
        };
        yield return new BossDef
        {
            Id = "boss_pharaoh",
            DisplayName = "Sand Pharaoh",
            RegionId = "desert",
            SealId = "seal_pharaoh",
            BaseHealth = 320,
            Weakness = Element.None,
            StaggerTell = "opposite-lane",
            RewardItemIds = ["wpn_pharaoh_blade", "wpn_sunbreaker", "key_solar_cartouche"],
            Phases = [P(1, "sun", "lane", 0), P(2, "shadow", "lane", 0), P(3, "split", "both", 0)]
        };
        yield return new BossDef
        {
            Id = "boss_titan",
            DisplayName = "Infernal Titan",
            RegionId = "volcano",
            SealId = "seal_titan",
            BaseHealth = 400,
            Weakness = Element.Ice,
            RewardItemIds = ["wpn_infernal_gs", "wpn_magma_drill", "key_titan_nail"],
            Phases = [P(1, "stand", "limb", 0), P(2, "core", "slam", 0), P(3, "eruption", "tiles", 0)]
        };
        yield return new BossDef
        {
            Id = "boss_queen",
            DisplayName = "Drowned Queen",
            RegionId = "drowned",
            SealId = "seal_queen",
            BaseHealth = 360,
            Weakness = Element.Lightning,
            RewardItemIds = ["wpn_tidebreaker", "wpn_abyssal_drill", "key_queens_lung"],
            Phases = [P(1, "dry", "duel", 0), P(2, "waist", "tide", 0), P(3, "submerge", "globes", 0)]
        };
        yield return new BossDef
        {
            Id = "boss_guardian",
            DisplayName = "Celestial Guardian",
            RegionId = "sky",
            SealId = "seal_guardian",
            BaseHealth = 380,
            Weakness = Element.Earth,
            RewardItemIds = ["wpn_celestial_blade", "wpn_starforged", "key_sky"],
            Phases = [P(1, "bridge", "sword", 0), P(2, "air", "fall", 0), P(3, "core", "lock", 0)]
        };
        yield return new BossDef
        {
            Id = "boss_finster",
            DisplayName = "Finster",
            RegionId = "void",
            SealId = "seal_finster",
            BaseHealth = 460,
            Weakness = Element.None,
            StaggerTell = "raised-hand",
            RewardItemIds = ["wpn_finster_longsword", "mat_voidstone"],
            Phases = [P(1, "sword", "parry", 0), P(2, "helm-off", "room", 0), P(3, "rite", "circle", 100)]
        };
    }

    static IEnumerable<RegionDef> Regions()
    {
        yield return new RegionDef { Id = "forest", DisplayName = "Giant Forest", Band = 2, UniqueMechanic = "toy-aggro", SealAwarded = "seal_cookie", DefenceK = 40 };
        yield return new RegionDef { Id = "kingdom", DisplayName = "Medieval Kingdom", Band = 8, UniqueMechanic = "law", SealToEnter = "seal_cookie", SealAwarded = "seal_knight", DefenceK = 55 };
        yield return new RegionDef { Id = "mire", DisplayName = "Dark Mire", Band = 14, UniqueMechanic = "knee-deep", SealToEnter = "seal_knight", SealAwarded = "seal_mire", DefenceK = 50 };
        yield return new RegionDef { Id = "waste", DisplayName = "Undead Wasteland", Band = 18, UniqueMechanic = "naming", SealToEnter = "seal_mire", SealAwarded = "seal_grave", DefenceK = 60 };
        yield return new RegionDef { Id = "frost", DisplayName = "Frostlands", Band = 22, UniqueMechanic = "cold", SealToEnter = "seal_knight", SealAwarded = "seal_wyrm", DefenceK = 60 };
        yield return new RegionDef { Id = "desert", DisplayName = "Golden Desert", Band = 26, UniqueMechanic = "light-lanes", SealToEnter = "seal_grave", SealAwarded = "seal_pharaoh", DefenceK = 55 };
        yield return new RegionDef { Id = "volcano", DisplayName = "Ashen Volcano", Band = 30, UniqueMechanic = "sinking-tiles", SealToEnter = "seal_pharaoh", SealAwarded = "seal_titan", DefenceK = 70 };
        yield return new RegionDef { Id = "drowned", DisplayName = "Drowned Kingdom", Band = 34, UniqueMechanic = "breath", SealToEnter = "seal_titan", SealAwarded = "seal_queen", DefenceK = 65 };
        yield return new RegionDef { Id = "sky", DisplayName = "Skylands", Band = 38, UniqueMechanic = "vertical", SealToEnter = "seal_queen", SealAwarded = "seal_guardian", DefenceK = 50 };
        yield return new RegionDef { Id = "void", DisplayName = "The Void", Band = 42, UniqueMechanic = "rite", SealToEnter = "seal_guardian", SealAwarded = "seal_finster", DefenceK = 80 };
    }

    static NpcDef Npc(string id, string name, string region, string role, bool critical, string want, string fear, string rel, string notes = "") =>
        new()
        {
            Id = id,
            DisplayName = name,
            RegionId = region,
            Role = role,
            QuestCritical = critical,
            Want = want,
            Fear = fear,
            RelatedNpcId = rel,
            Notes = notes
        };

    static List<NpcDef> Npcs() =>
    [
        Npc("npc_tanic", "Tanic", "forest", "adjutant-in-hiding", true, "Stay useful and unasked.", "Finster's name said aloud.", "npc_mara"),
        Npc("npc_mara", "Mara", "forest", "smith", true, "Keep the forge fed.", "Night spirits at the palisade.", "npc_tanic"),
        Npc("npc_penn", "Old Penn", "forest", "beekeeper", false, "Keep the hives.", "Smoke in the clearing.", "npc_bramble"),
        Npc("npc_sera", "Sera", "forest", "hunter", false, "Clean trails.", "The castle rhyme.", "npc_bramble"),
        Npc("npc_bramble", "Captain Bramble", "forest", "guard", false, "Hold the palisade.", "The green gate.", "npc_sera"),
        Npc("npc_elspeth", "Elspeth", "kingdom", "keeper", true, "Boe comes home.", "The red collar.", "npc_voss"),
        Npc("npc_voss", "Castellan Voss", "kingdom", "castellan", true, "The oath held.", "The royal ledger.", "npc_elspeth"),
        Npc("npc_maree", "Sister Maree", "kingdom", "priest", false, "A quiet abbey.", "The cellar.", "npc_holt"),
        Npc("npc_holt", "Holt", "kingdom", "smith", false, "Honest iron.", "The fortress.", "npc_maree"),
        Npc("npc_phem", "Mother Phem", "mire", "sacristan", true, "Name the choir.", "The flooded nave.", "npc_corrin"),
        Npc("npc_corrin", "Corrin", "mire", "boatman", true, "A dry boat.", "Fog that hides the markers.", "npc_phem"),
        Npc("npc_caldus", "Brother Caldus", "waste", "priest", true, "Name the dead.", "The citadel roll.", ""),
        Npc("npc_liss", "Liss", "sky", "chapel", true, "The portrait stays.", "The Tear.", "npc_tanic", "Knows Tanic's younger face. Sky chapel."),
        Npc("npc_varga", "Varga", "volcano", "miner", true, "The crew freed.", "The caldera standing.", "", "Freed when the Titan falls."),
        Npc("npc_renn", "Abbess Renn", "frost", "priest", false, "", "", "", "Named in the cast list. Want and fear are not in the design bible."),
        Npc("npc_nadira", "Speaker Nadira", "desert", "speaker", false, "", "", "", "Named in the cast list. Want and fear are not in the design bible."),
        Npc("npc_osman", "Osman", "desert", "traveller", false, "", "", "", "Named in the cast list. Want and fear are not in the design bible."),
        Npc("npc_yssa", "Captain Yssa", "drowned", "captain", false, "", "", "", "Named in the cast list. Want and fear are not in the design bible.")
    ];

    static List<NpcSchedule> Schedules() =>
    [
        new("npc_tanic",
        [
            new ScheduleEntry(5f, 18f, "hearthfen_smith_lane"),
            new ScheduleEntry(18f, 5f, "hearthfen_workshop")
        ])
    ];

    static Dictionary<string, string> Lines() => new()
    {
        ["tanic.forest.practical"] = "Flint in the creek. Wood from the fallen limb. The bench is past the smith, if you want an edge.",
        ["tanic.forest.castle"] = "That hill was a nursery before it was a castle. Do not answer the box.",
        ["tanic.kingdom.quiet"] = "",
        ["tanic.waste.served"] = "I served the March. I did not hold the seal I was given.",
        ["tanic.sky.face"] = "That portrait is mine. I was younger. Liss should not have kept it.",
        ["tanic.tear.move"] = "When the air sweetens, move. Do not stand in it.",
        ["finster.rite.line"] = "Smell my fingers.",
        ["children.rhyme"] = "Caller Cookie, button and bow, count the toys and don't be slow."
    };

    static List<QuestDef> Quests() =>
    [
        new()
        {
            Id = "q_village_name",
            DisplayName = "A name in the village",
            Optional = true,
            Steps = [new("talk", "npc_tanic")]
        },
        new()
        {
            Id = "q_rhyme",
            DisplayName = "The rhyme",
            Optional = true,
            Steps = [new("talk", "children.rhyme")]
        },
        new()
        {
            Id = "q_tools",
            DisplayName = "An edge",
            Steps = [new("possess", "wpn_stone_knife")]
        },
        new()
        {
            Id = "q_cookie",
            DisplayName = "Cookie",
            Steps = [new("boss", "boss_cookie")]
        },
        new()
        {
            Id = "q_gate",
            DisplayName = "The gate that answers",
            Steps = [new("seal", "seal_cookie")]
        }
    ];

    static IEnumerable<SpellDef> Spells()
    {
        yield return new SpellDef
        {
            Id = "spell_ember",
            DisplayName = "Ember",
            School = Element.Fire,
            ManaCost = 10,
            CooldownTicks = 20,
            TtlTicks = 160,
            CapPerCaster = 8
        };
    }

    static IEnumerable<PieceDef> Pieces()
    {
        yield return new PieceDef { Id = "piece_bedroll", DisplayName = "Bedroll", CostItemId = "piece_bedroll_kit", CostCount = 1 };
        yield return new PieceDef { Id = "piece_fire", DisplayName = "Campfire", CostItemId = "piece_fire_kit", CostCount = 1 };
        yield return new PieceDef { Id = "piece_bench", DisplayName = "Bench", CostItemId = "piece_bench_kit", CostCount = 1 };
        yield return new PieceDef { Id = "piece_foundation", DisplayName = "Foundation", CostItemId = "mat_wood", CostCount = 4, NeedsGround = true };
        yield return new PieceDef { Id = "piece_bridge", DisplayName = "Bridge", CostItemId = "mat_wood", CostCount = 6, NeedsGround = false, Bridge = true, AnchorCount = 2 };
    }

    static List<SettlementTierDef> Tiers() =>
    [
        new() { Tier = 0, Name = "Camp", Unlocks = "Sleep, cook" },
        new() { Tier = 1, Name = "Village", Beds = 4, Well = true, Bench = true, Palisade = true, FoodRequired = true, Unlocks = "Farmers, basic trader" },
        new() { Tier = 2, Name = "Town", Population = 8, MinHappiness = 50, Unlocks = "Guards, alchemy, tax chest" },
        new() { Tier = 3, Name = "City", Population = 16, Unlocks = "Specialist NPCs, raid tier 2" }
    ];

    static List<WorldEventDef> Events() =>
    [
        new() { Id = "event_goblin_push", DisplayName = "Goblin push" },
        new() { Id = "event_bandit_raid", DisplayName = "Bandit raid" },
        new() { Id = "event_wyrm_shadow", DisplayName = "Wyrm-shadow", Major = false },
        new() { Id = "event_magic_storm", DisplayName = "Magic storm" },
        new() { Id = "event_meteor", DisplayName = "Meteor" },
        new() { Id = "event_undead_night", DisplayName = "Undead night" },
        new() { Id = "event_merchant", DisplayName = "Travelling merchant", Major = false },
        new() { Id = "event_emergency", DisplayName = "Village emergency" },
        new() { Id = "event_blood_moon", DisplayName = "Blood moon" },
        new() { Id = "event_rare", DisplayName = "Rare spawn", Major = false },
        new() { Id = "event_unseal", DisplayName = "Dungeon unseal" },
        new() { Id = "event_anomaly", DisplayName = "Anomaly" }
    ];

    static List<SkillDef> Skills()
    {
        var list = new List<SkillDef>();
        foreach (SkillId id in Enum.GetValues<SkillId>())
        {
            if (id == SkillId.None)
                continue;
            list.Add(new SkillDef(id, id.ToString(), 4));
        }
        return list;
    }
}
