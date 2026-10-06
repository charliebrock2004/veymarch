using NUnit.Framework;
using Veyr.Content;
using Veyr.Sim;

namespace Veyr.Tests.Sim;

public class SimDepthTests
{
    [Test]
    public void CatalogAuditIsCleanAndTheFingerprintIsStable()
    {
        var content = ContentCatalog.Slice();
        Assert.That(ContentRules.Audit(content), Is.Empty);
        Assert.That(ContentRules.Fingerprint(content), Is.EqualTo(ContentRules.Fingerprint(content)));
        Assert.That(content.Spells.ContainsKey("spell_ember"), Is.True);
        Assert.That(content.Spells.ContainsKey("spell_open_the_tear"), Is.True);
        Assert.That(SliceBuild.Ships("Kingdom"), Is.False);
        Assert.That(SliceBuild.Ships("Cookie_Nursery"), Is.True);
    }

    [Test]
    public void StatusBuildsUpTicksAndCampfireCleansesIt()
    {
        var content = ContentCatalog.Slice();
        var sim = new WorldSimulation("w", DeathMode.Adventure, 1);
        var body = sim.SpawnPlayer("p");
        var bleed = content.Statuses[StatusId.Bleed];
        Assert.That(sim.Status("p").Apply(bleed, bleed.BuildupMax - 1), Is.False);
        Assert.That(sim.Status("p").Apply(bleed, 1), Is.True);
        sim.Tick(default, "p");
        Assert.That(body.Health, Is.EqualTo(77));
        Assert.That(sim.Status("p").Cleanse(CleanseSource.Campfire, content.Statuses), Is.EqualTo(1));
        Assert.That(sim.Status("p").IsActive(StatusId.Bleed), Is.False);
    }

    [Test]
    public void FrostSlowsTheNextStep()
    {
        var content = ContentCatalog.Slice();
        var slowed = new WorldSimulation("w", DeathMode.Adventure, 1);
        var open = new WorldSimulation("w", DeathMode.Adventure, 1);
        slowed.SpawnPlayer("p");
        open.SpawnPlayer("p");
        var frost = content.Statuses[StatusId.Frost];
        slowed.Status("p").Apply(frost, frost.BuildupMax);
        slowed.Tick(default, "p");
        var intent = new PlayerIntent { MoveX = 1f, MoveZ = 0f };
        slowed.Tick(intent, "p");
        open.Tick(intent, "p");
        Assert.That(slowed.Actors["p"].X, Is.LessThan(open.Actors["p"].X));
    }

    [Test]
    public void GoblinRushesBeforeTheWolfPouncesAndAnEliteIsSlower()
    {
        var wolf = Body("wolf", 1f);
        var goblin = Body("goblin", 1f);
        var elite = Body("elite", 1f);
        var player = Body("p", 0f);
        var wolfBrain = new EnemyBrain();
        var goblinBrain = new EnemyBrain();
        var eliteBrain = new EnemyBrain();
        bool wolfStruck = false;
        bool goblinStruck = false;
        for (int i = 0; i < 7; i++)
        {
            wolfBrain.Tick(wolf, player, VerbTuning.For("pounce"));
            goblinBrain.Tick(goblin, player, VerbTuning.For("rush"));
            wolfStruck |= wolfBrain.StrikeThisTick;
            goblinStruck |= goblinBrain.StrikeThisTick;
        }

        Assert.That(goblinStruck, Is.True);
        Assert.That(wolfStruck, Is.False);
        wolfStruck = false;
        bool eliteStruck = false;
        for (int i = 0; i < 11; i++)
        {
            wolfBrain.Tick(wolf, player, VerbTuning.For("pounce"));
            eliteBrain.Tick(elite, player, VerbTuning.For("brood"));
            wolfStruck |= wolfBrain.StrikeThisTick;
            eliteStruck |= eliteBrain.StrikeThisTick;
        }

        Assert.That(wolfStruck, Is.True);
        Assert.That(eliteStruck, Is.False);
        Assert.That(VerbTuning.WindupLegal(80, 4), Is.False);
        Assert.That(BossTells.WindupTicks("spin"), Is.GreaterThanOrEqualTo(8));
        Assert.That(BossTells.WindupTicks("circle"), Is.EqualTo(100));
    }

    [Test]
    public void TrapWaitsOutTheTellAndTheWeightOpensTheBossDoor()
    {
        var rooms = new List<PlacedRoom>
        {
            new() { Id = "entrance", Kind = RoomKind.Entrance },
            new() { Id = "trap", Kind = RoomKind.Trap, TellTicks = 3, TrapDamage = 9 },
            new() { Id = "weight", Kind = RoomKind.Puzzle },
            new() { Id = "nursery", Kind = RoomKind.Boss }
        };
        Link(rooms, 0, 1);
        Link(rooms, 1, 2);
        Link(rooms, 2, 3);
        var run = new DungeonRun(rooms);
        var body = Body("p", 0f);
        Assert.That(run.TryMove(3), Is.False);
        Assert.That(run.TryMove(1), Is.True);
        Assert.That(run.TickTrap(body), Is.EqualTo(0));
        Assert.That(run.TickTrap(body), Is.EqualTo(0));
        Assert.That(run.TickTrap(body), Is.EqualTo(0));
        Assert.That(run.TickTrap(body), Is.EqualTo(9));
        Assert.That(run.TryMove(2), Is.True);
        Assert.That(run.TryMove(3), Is.False);
        run.PlaceWeight();
        Assert.That(run.TryMove(3), Is.True);
    }

    [Test]
    public void CookieDungeonKeepsTheSeedAndSkipsASchoolThePlayerLacks()
    {
        var kit = ContentCatalog.Slice().Dungeons["dungeon_cookie"];
        var a = DungeonLayout.Build(kit, 42);
        var b = DungeonLayout.Build(kit, 42);
        Assert.That(a.Select(r => r.Id), Is.EqualTo(b.Select(r => r.Id)));
        Assert.That(a.Count, Is.InRange(6, 14));
        Assert.That(a[0].Kind, Is.EqualTo(RoomKind.Entrance));
        Assert.That(a[^1].Kind, Is.EqualTo(RoomKind.Boss));
        Assert.That(a.Any(r => r.Kind == RoomKind.Secret), Is.True);
        Assert.That(a.Any(r => r.Links.Count > 2) || a[1].Links.Contains(a.Count - 3), Is.True);

        var gated = new DungeonKitDef
        {
            Id = "toy",
            RegionId = "forest",
            MinRooms = 6,
            MaxRooms = 6,
            Rooms =
            [
                new RoomKitDef { Id = "entrance", Kind = RoomKind.Entrance },
                new RoomKitDef { Id = "corridor", Kind = RoomKind.Corridor },
                new RoomKitDef { Id = "trap", Kind = RoomKind.Trap, TellTicks = 8, TrapDamage = 1 },
                new RoomKitDef { Id = "puzzle", Kind = RoomKind.Puzzle },
                new RoomKitDef { Id = "secret", Kind = RoomKind.Secret },
                new RoomKitDef { Id = "banned", Kind = RoomKind.Corridor, RequiredSchool = "forbidden" },
                new RoomKitDef { Id = "boss", Kind = RoomKind.Boss }
            ]
        };
        var laid = DungeonLayout.Build(gated, 1, _ => false);
        Assert.That(laid.Any(r => r.Id == "banned"), Is.False);
    }

    [Test]
    public void LootDoesNotMintASecondUnique()
    {
        var table = ContentCatalog.Slice().Loot["loot_unique_once"];
        var first = LootRoll.Roll(table, 9, new HashSet<string>());
        var again = LootRoll.Roll(table, 9, new HashSet<string> { "wpn_smacko" });
        Assert.That(first, Does.Contain("wpn_smacko"));
        Assert.That(again, Does.Not.Contain("wpn_smacko"));
        Assert.That(LootRoll.Roll(table, 9, new HashSet<string>()).SequenceEqual(first), Is.True);
    }

    [Test]
    public void ThirdLightHitsHarderAndAHammerReportsKnockback()
    {
        var sim = new WorldSimulation("w", DeathMode.Adventure, 1);
        sim.SpawnPlayer("p");
        Arm(sim, "wpn_stone_knife");
        var wolf = sim.SpawnActor("mob_wolf", 1f, 0f);
        sim.Actors["p"].Stamina = 80;
        int first = sim.TryAttack("p", wolf.Id, false, false).Damage;
        wolf.Health = wolf.MaxHealth;
        wolf.Life = LifeState.Alive;
        sim.Actors["p"].Stamina = 80;
        sim.TryAttack("p", wolf.Id, false, false);
        wolf.Health = wolf.MaxHealth;
        wolf.Life = LifeState.Alive;
        sim.Actors["p"].Stamina = 80;
        int third = sim.TryAttack("p", wolf.Id, false, false).Damage;
        Assert.That(third, Is.GreaterThan(first));

        var hammer = new WorldSimulation("w", DeathMode.Adventure, 1);
        hammer.SpawnPlayer("p");
        Arm(hammer, "wpn_stone_hammer");
        var boar = hammer.SpawnActor("mob_boar", 1f, 0f);
        hammer.Actors["p"].Stamina = 80;
        var hit = hammer.TryAttack("p", boar.Id, true, false);
        Assert.That(hit.Knockback, Is.GreaterThan(0f));
    }

    [Test]
    public void SurvivalChipsAKnifeAndAUniqueOnlyDulls()
    {
        var sim = new WorldSimulation("w", DeathMode.Survival, 1);
        sim.SpawnPlayer("p");
        Arm(sim, "wpn_stone_knife");
        var knife = sim.Bag("p").Find("wpn_stone_knife")!;
        int start = knife.Durability;
        var wolf = sim.SpawnActor("mob_wolf", 1f, 0f);
        sim.Actors["p"].Stamina = 80;
        sim.TryAttack("p", wolf.Id, false, false);
        Assert.That(knife.Durability, Is.EqualTo(start - 1));

        var adventure = new WorldSimulation("w", DeathMode.Adventure, 1);
        adventure.SpawnPlayer("p");
        Arm(adventure, "wpn_stone_knife");
        var kept = adventure.Bag("p").Find("wpn_stone_knife")!;
        int full = kept.Durability;
        var other = adventure.SpawnActor("mob_wolf", 1f, 0f);
        adventure.Actors["p"].Stamina = 80;
        adventure.TryAttack("p", other.Id, false, false);
        Assert.That(kept.Durability, Is.EqualTo(full));

        var dull = new WorldSimulation("w", DeathMode.Survival, 1);
        dull.SpawnPlayer("p");
        Arm(dull, "wpn_cookie_blade");
        var blade = dull.Bag("p").Find("wpn_cookie_blade")!;
        blade.Durability = 1;
        var dummy = dull.SpawnActor("mob_wolf", 1f, 0f);
        dull.Actors["p"].Stamina = 80;
        int sharp = dull.TryAttack("p", dummy.Id, true, false).Damage;
        dummy.Health = dummy.MaxHealth;
        dummy.Life = LifeState.Alive;
        dull.Actors["p"].Stamina = 80;
        int dulled = dull.TryAttack("p", dummy.Id, true, false).Damage;
        Assert.That(blade.Durability, Is.EqualTo(0));
        Assert.That(dulled, Is.LessThan(sharp));
        Assert.That(DurabilityRules.IsBroken(blade, dull.Content.Item(blade.DefId), DeathMode.Survival), Is.False);
    }

    [Test]
    public void AGreatswordWillNotShareAHandWithAShield()
    {
        var sim = new WorldSimulation("w", DeathMode.Adventure, 1);
        sim.SpawnPlayer("p");
        Arm(sim, "wpn_knightfall");
        sim.Bag("p").Add(sim.Content.Item("arm_stump_shield"), 1, "p", "shield");
        Assert.That(sim.TryEquip("p", "shield"), Is.False);
        Assert.That(sim.Actors["p"].OffHandId, Is.EqualTo(""));

        var other = new WorldSimulation("w", DeathMode.Adventure, 1);
        other.SpawnPlayer("p");
        Arm(other, "arm_stump_shield");
        Arm(other, "wpn_knightfall");
        Assert.That(other.Actors["p"].OffHandId, Is.EqualTo(""));
        Assert.That(other.Actors["p"].EquippedId, Is.EqualTo("wpn_knightfall"));
    }

    [Test]
    public void HunterAndKnightSetsPayAtTwoAndFour()
    {
        var sim = new WorldSimulation("w", DeathMode.Adventure, 1);
        var body = sim.SpawnPlayer("p");
        Arm(sim, "arm_hunter_head");
        Arm(sim, "arm_hunter_chest");
        var set = sim.Content.Sets["set_hunter"];
        Assert.That(ArmourSets.Active(set, ArmourSets.Worn(set, body, sim.Bag("p"))), Is.EqualTo("move"));
        Arm(sim, "arm_hunter_hands");
        Arm(sim, "arm_hunter_legs");
        Assert.That(ArmourSets.Active(set, ArmourSets.Worn(set, body, sim.Bag("p"))), Is.EqualTo("bow"));
        var knight = new WorldSimulation("w", DeathMode.Adventure, 1);
        var wearer = knight.SpawnPlayer("p");
        Arm(knight, "arm_knight_head");
        Arm(knight, "arm_knight_chest");
        Arm(knight, "arm_knight_hands");
        Arm(knight, "arm_knight_legs");
        wearer.Stamina = 18;
        knight.Tick(new PlayerIntent { Dodge = true }, "p");
        Assert.That(wearer.IFrameTicks, Is.EqualTo(0));
        Assert.That(wearer.Stamina, Is.GreaterThan(18f));
    }

    [Test]
    public void ProtocolMismatchAndALateJoinDoNotGrantUniques()
    {
        Assert.That(NetSession.Reject(new ClientEnvelope(1, "TryAttack", "p")), Is.EqualTo(""));
        Assert.That(NetSession.Reject(new ClientEnvelope(2, "TryAttack", "p")), Is.EqualTo("protocol"));
        Assert.That(NetSession.Reject(new ClientEnvelope(1, "GrantItem", "p")), Is.EqualTo("authority"));
        var restored = NetSession.Reconnect(true, 4f, 5f, 0f, 0f);
        var shrine = NetSession.Reconnect(false, 4f, 5f, 1f, 2f);
        Assert.That(restored.Where, Is.EqualTo("restore"));
        Assert.That(restored.X, Is.EqualTo(4f));
        Assert.That(shrine.Where, Is.EqualTo("shrine"));
        Assert.That(shrine.X, Is.EqualTo(1f));
        Assert.That(NetSession.LateJoinerGetsUnique(false), Is.False);
        var visible = NetSession.Visible([("near", 10f), ("far", 140f)]);
        Assert.That(visible, Is.EqualTo(new[] { "near" }));
    }

    [Test]
    public void SchoolsGateRankSealSilenceAndCorruption()
    {
        var content = ContentCatalog.Slice();
        var ember = content.Spells["spell_ember"];
        var lash = content.Spells["spell_hearthlash"];
        var tear = content.Spells["spell_open_the_tear"];
        var spark = content.Spells["spell_spark"];
        Assert.That(MagicRules.Gate(ember, 0, 0, false, false), Is.EqualTo(""));
        Assert.That(MagicRules.Gate(lash, 0, 0, false, false), Is.EqualTo("rank"));
        Assert.That(MagicRules.Gate(lash, 1, 0, false, true), Is.EqualTo("silence"));
        Assert.That(MagicRules.Gate(tear, 4, 0, false, false), Is.EqualTo("seal"));
        Assert.That(MagicRules.Gate(tear, 4, 100, true, false), Is.EqualTo("backfire"));
        Assert.That(MagicRules.ManaCost(spark, true), Is.LessThan(spark.ManaCost));
        Assert.That(content.Lines["finster.rite.line"], Is.EqualTo("Smell my fingers."));

        var meter = new CorruptionMeter();
        meter.Add(51);
        Assert.That(meter.Price(100), Is.EqualTo(125));
        meter.Add(49);
        Assert.That(meter.HauntReady, Is.True);
        var body = Body("p", 0f);
        body.Health = 80;
        Assert.That(meter.ApplyBackfire(body), Is.EqualTo(20));
        Assert.That(body.Health, Is.EqualTo(60));
        Assert.That(meter.Value, Is.EqualTo(80));
        Assert.That(MaterialVerbs.SoftTax(24), Is.EqualTo(1f));
        Assert.That(MaterialVerbs.SoftTax(34), Is.LessThan(1f));
    }

    [Test]
    public void IceHealsTheWyrm()
    {
        var sim = new WorldSimulation("w", DeathMode.Adventure, 1);
        sim.SpawnPlayer("p");
        Arm(sim, "wpn_wyrmfang");
        var boss = sim.SpawnBoss("boss_wyrm");
        var body = sim.Actors["boss_wyrm"];
        body.X = 1f;
        body.Health = 100;
        sim.Actors["p"].Stamina = 80;
        var hit = sim.TryAttack("p", "boss_wyrm", false, false);
        Assert.That(hit.Reason, Is.EqualTo("heal"));
        Assert.That(body.Health, Is.GreaterThan(100));
        Assert.That(boss.State, Is.Not.EqualTo(BossState.Dead));
        Assert.That(CombatMath.ElementAdjust("boss_cookie", Element.Shadow, Element.Fire, 20f), Is.EqualTo(10f));
    }

    [Test]
    public void BandageHealsAndACorpseExpires()
    {
        var sim = new WorldSimulation("w", DeathMode.Survival, 1);
        var body = sim.SpawnPlayer("p");
        sim.Bag("p").Add(sim.Content.Item("mat_fibre"), 1, "p", "fibre");
        Assert.That(sim.TryCraft("p", "recipe_bandage", StationId.Hand, "bandage").Ok, Is.True);
        body.Health = 40;
        Assert.That(Consumables.TryUse(sim.Content.Item("cons_bandage"), body, sim.Bag("p")), Is.EqualTo(""));
        Assert.That(body.Health, Is.EqualTo(55));

        sim.Bag("p").Add(sim.Content.Item("mat_flint"), 3, "p", "flint");
        var dropped = DeathRules.DropCarried(sim.Bag("p"), DeathMode.Survival);
        var corpse = CorpseRules.Create("c1", body.X, body.Z, 0, dropped);
        Assert.That(corpse.Items.Count, Is.GreaterThan(0));
        Assert.That(CorpseRules.Expired(corpse, CorpseRules.LifetimeTicks - 1), Is.False);
        Assert.That(CorpseRules.Expired(corpse, CorpseRules.LifetimeTicks), Is.True);
    }

    [Test]
    public void DialogueQuestTrustAndTheRareClock()
    {
        var content = ContentCatalog.Slice();
        var talk = new DialogueSession("npc_tanic", ["tanic.forest.practical", "tanic.forest.castle"]);
        Assert.That(content.Lines[talk.CurrentKey], Does.Contain("Flint"));
        Assert.That(talk.Advance(), Is.True);
        Assert.That(talk.CurrentKey, Is.EqualTo("tanic.forest.castle"));

        var tools = content.Quests.First(q => q.Id == "q_tools");
        var progress = new QuestProgress { QuestId = tools.Id };
        Quests.Advance(progress, tools, "possess", "wpn_stone_knife");
        Assert.That(progress.State, Is.EqualTo(QuestState.Complete));

        var trust = new TrustLedger();
        Assert.That(trust.JobSlots("npc_holt"), Is.EqualTo(0));
        trust.Note("npc_holt", 1);
        Assert.That(trust.JobSlots("npc_holt"), Is.EqualTo(3));

        var rares = new RareClock();
        Assert.That(rares.TrySpawn("mob_grove_matron", 0), Is.True);
        Assert.That(rares.TrySpawn("mob_grove_matron", 10), Is.False);
        Assert.That(AiBudget.Admit(14, 4), Is.EqualTo(1));

        var wolf = Body("wolf", 0f);
        var bear = Body("bear", 2f);
        Assert.That(Ecology.WolfFleesBear(wolf, bear), Is.True);
        Assert.That(wolf.X, Is.LessThan(0f));
    }

    [Test]
    public void HapticsSettingSurvivesAReload()
    {
        string path = Path.Combine(Path.GetTempPath(), "veyr-settings-" + Guid.NewGuid().ToString("n") + ".json");
        try
        {
            var settings = new LocalSettings { Haptics = false, ColourblindShapes = true, Quality = "Low" };
            SettingsStore.Write(path, settings);
            var loaded = SettingsStore.Read(path);
            Assert.That(loaded.Haptics, Is.False);
            Assert.That(loaded.ColourblindShapes, Is.True);
            Assert.That(loaded.Schema, Is.EqualTo(1));
        }
        finally
        {
            if (File.Exists(path))
                File.Delete(path);
        }
    }

    static ActorBody Body(string id, float x) => new()
    {
        Id = id,
        Health = 80,
        MaxHealth = 80,
        X = x
    };

    static void Arm(WorldSimulation sim, string item)
    {
        sim.Bag("p").Add(sim.Content.Item(item), 1, "p", item);
        sim.TryEquip("p", item);
    }

    static void Link(List<PlacedRoom> rooms, int a, int b)
    {
        rooms[a].Links.Add(b);
        rooms[b].Links.Add(a);
    }
}
