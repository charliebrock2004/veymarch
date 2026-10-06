using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using NUnit.Framework;
using Veyr.Content;
using Veyr.Sim;

namespace Veyr.Tests.Sim
{
    public class ClockTests
    {
        [Test]
        public void TwentyTicksAreOneSecond()
        {
            var clock = new SimClock();
            clock.Advance(20);
            Assert.That(clock.Tick, Is.EqualTo(20));
            Assert.That(clock.ElapsedSeconds, Is.EqualTo(1f).Within(0.0001f));
        }
    }

    public class MovementTests
    {
        [Test]
        public void ForgedSpeedDoesNotMove()
        {
            var sim = New();
            var body = sim.SpawnPlayer("p");
            var result = sim.TryMove("p", new PlayerIntent { MoveX = 1, ClaimedSpeed = 40 });
            Assert.That(result.Accepted, Is.False);
            Assert.That(result.Reason, Is.EqualTo("speed"));
            Assert.That(body.X, Is.EqualTo(0));
        }

        [Test]
        public void StickMovesAtWalkSpeed()
        {
            var sim = New();
            var body = sim.SpawnPlayer("p");
            sim.TryMove("p", new PlayerIntent { MoveX = 1, MoveZ = 0, ClaimedSpeed = 0 });
            Assert.That(body.X, Is.EqualTo(4.2f / 20f).Within(0.0001f));
        }

        [Test]
        public void SprintIsFasterAndStillUnderCap()
        {
            var walk = New();
            walk.SpawnPlayer("a");
            walk.TryMove("a", new PlayerIntent { MoveX = 1 });
            var sprint = New();
            var body = sprint.SpawnPlayer("b");
            sprint.TryMove("b", new PlayerIntent { MoveX = 1, Sprint = true });
            Assert.That(body.X, Is.GreaterThan(walk.Actors["a"].X));
            Assert.That(body.X, Is.LessThan(7f / 20f + 0.001f));
        }

        static WorldSimulation New() => new("world", DeathMode.Adventure, 1);
    }

    public class InventoryCraftTests
    {
        [Test]
        public void MaterialsStackAndEquipmentDoesNotOverflowForever()
        {
            var sim = New();
            sim.SpawnPlayer("p");
            var bag = sim.Bag("p");
            var flint = sim.Content.Item("mat_flint");
            bag.Add(flint, 10, "p", "a");
            bag.Add(flint, 5, "p", "b");
            Assert.That(bag.CountOf("mat_flint"), Is.EqualTo(15));
            Assert.That(bag.Items.Count, Is.EqualTo(1));

            var knife = sim.Content.Item("wpn_stone_knife");
            int added = 0;
            for (int i = 0; i < Inventory.SlotCap + 2; i++)
            {
                if (!bag.Add(knife, 1, "p", "k" + i).Ok)
                    break;
                added++;
            }
            Assert.That(bag.Items.Count, Is.EqualTo(Inventory.SlotCap));
            Assert.That(added, Is.EqualTo(Inventory.SlotCap - 1));
        }

        [Test]
        public void StoneKnifeConsumesMaterialsAndReplayDoesNotDuplicate()
        {
            var sim = ForestPrep();
            var first = sim.TryCraft("p", "recipe_stone_knife", StationId.Hand, "craft-1");
            var second = sim.TryCraft("p", "recipe_stone_knife", StationId.Hand, "craft-1");
            Assert.That(first.Ok, Is.True);
            Assert.That(second.InstanceId, Is.EqualTo(first.InstanceId));
            Assert.That(sim.Bag("p").CountOf("wpn_stone_knife"), Is.EqualTo(1));
            Assert.That(sim.Bag("p").CountOf("mat_flint"), Is.EqualTo(0));
        }

        [Test]
        public void TwoCraftKeysWithOneSetOfMaterialsMakeOneKnife()
        {
            var sim = ForestPrep();
            Assert.That(sim.TryCraft("p", "recipe_stone_knife", StationId.Hand, "a").Ok, Is.True);
            var again = sim.TryCraft("p", "recipe_stone_knife", StationId.Bench, "b");
            Assert.That(again.Ok, Is.False);
            Assert.That(again.Reason, Is.EqualTo("materials"));
        }

        [Test]
        public void FistsCannotCraftTheKnife()
        {
            var sim = New();
            sim.SpawnPlayer("p");
            var result = sim.TryCraft("p", "recipe_stone_knife", StationId.Hand, "empty");
            Assert.That(result.Ok, Is.False);
            Assert.That(result.Reason, Is.EqualTo("materials"));
        }

        [Test]
        public void CopperPickRequiresTheStonePick()
        {
            var sim = New();
            sim.SpawnPlayer("p");
            var bag = sim.Bag("p");
            bag.Add(sim.Content.Item("mat_copper"), 4, "p", "c");
            bag.Add(sim.Content.Item("mat_wood"), 2, "p", "w");
            Assert.That(sim.TryCraft("p", "recipe_copper_pick", StationId.Bench, "cu").Reason, Is.EqualTo("materials"));
            bag.Add(sim.Content.Item("wpn_stone_pick"), 1, "p", "sp");
            Assert.That(sim.TryCraft("p", "recipe_copper_pick", StationId.Bench, "cu2").Ok, Is.True);
            Assert.That(bag.CountOf("wpn_stone_pick"), Is.EqualTo(0));
        }

        [Test]
        public void CookieBladeIsNotCrafted()
        {
            var sim = New();
            sim.SpawnPlayer("p");
            sim.Bag("p").Add(sim.Content.Item("mat_cookie_brass"), 1, "p", "b");
            sim.Bag("p").Add(sim.Content.Item("mat_iron"), 1, "p", "i");
            Assert.That(sim.TryCraft("p", "recipe_cookie_blade", StationId.Forge, "no").Reason, Is.EqualTo("not_craftable"));
        }

        [Test]
        public void IronSwordNeedsSmithRank()
        {
            var sim = New();
            sim.SpawnPlayer("p");
            sim.Bag("p").Add(sim.Content.Item("mat_iron"), 6, "p", "i");
            sim.Bag("p").Add(sim.Content.Item("mat_wood"), 2, "p", "w");
            sim.Bag("p").Add(sim.Content.Item("mat_leather"), 1, "p", "l");
            Assert.That(sim.TryCraft("p", "recipe_iron_sword", StationId.Forge, "ir").Reason, Is.EqualTo("skill"));
            sim.Skills("p").SetRank(SkillId.Blacksmithing, 2);
            Assert.That(sim.TryCraft("p", "recipe_iron_sword", StationId.Forge, "ir2").Ok, Is.True);
        }

        [Test]
        public void IronNodeRejectsCopperPickAndAcceptsCookiePickAfterSeal()
        {
            var sim = New();
            var body = sim.SpawnPlayer("p");
            Assert.That(sim.TryGather("p", "node_iron").Reason, Is.EqualTo("sealed"));
            sim.Flags.Set("seal_cookie");
            Give(sim, "wpn_copper_pick");
            sim.TryEquip("p", sim.Bag("p").Items[^1].InstanceId);
            Assert.That(sim.TryGather("p", "node_iron").Reason, Is.EqualTo("tier"));
            Give(sim, "wpn_cookie_pick");
            sim.TryEquip("p", Last(sim));
            Assert.That(sim.TryGather("p", "node_iron").Ok, Is.True);
            Assert.That(sim.Bag("p").CountOf("mat_iron"), Is.EqualTo(1));
            Assert.That(body.EquippedId, Is.Not.Empty);
        }

        static WorldSimulation ForestPrep()
        {
            var sim = New();
            sim.SpawnPlayer("p");
            sim.TryGather("p", "node_flint");
            sim.TryGather("p", "node_flint");
            sim.TryGather("p", "node_wood");
            return sim;
        }

        static void Give(WorldSimulation sim, string item) =>
            sim.Bag("p").Add(sim.Content.Item(item), 1, "p", item + "-inst");

        static string Last(WorldSimulation sim) => sim.Bag("p").Items[^1].InstanceId;

        static WorldSimulation New() => new("world", DeathMode.Adventure, 3);
    }

    public class CombatTests
    {
        [Test]
        public void KnifeHitsHarderThanFistsAndKillsTheWolf()
        {
            var fists = HitWolf(false);
            var knife = HitWolf(true);
            Assert.That(knife, Is.GreaterThan(fists));

            var sim = new WorldSimulation("w", DeathMode.Adventure, 1);
            sim.SpawnPlayer("p");
            ArmKnife(sim);
            var wolf = sim.SpawnActor("mob_wolf", 1f, 0f);
            while (wolf.Life == LifeState.Alive)
            {
                sim.Actors["p"].Stamina = 60;
                var hit = sim.TryAttack("p", wolf.Id, false, false);
                Assert.That(hit.Accepted, Is.True);
            }
            Assert.That(wolf.Health, Is.EqualTo(0));
        }

        [Test]
        public void FistsDoNotGrantSwordRank()
        {
            var sim = new WorldSimulation("w", DeathMode.Adventure, 1);
            sim.SpawnPlayer("p");
            var wolf = sim.SpawnActor("mob_wolf", 1f, 0f);
            sim.Actors["p"].Stamina = 60;
            sim.TryAttack("p", wolf.Id, false, false);
            Assert.That(sim.Skills("p").Rank(SkillId.Sword), Is.EqualTo(0));
        }

        [Test]
        public void SwordUseRaisesSwordRank()
        {
            var sim = new WorldSimulation("w", DeathMode.Adventure, 1);
            sim.SpawnPlayer("p");
            Arm(sim, "wpn_copper_sword");
            var wolf = sim.SpawnActor("mob_wolf", 1f, 0f);
            for (int i = 0; i < 3; i++)
            {
                sim.Actors["p"].Stamina = 60;
                wolf.Health = wolf.MaxHealth;
                wolf.Life = LifeState.Alive;
                sim.TryAttack("p", wolf.Id, false, false);
            }
            Assert.That(sim.Skills("p").Rank(SkillId.Sword), Is.EqualTo(1));
        }

        [Test]
        public void LowStaminaRejectsTheSwing()
        {
            var sim = new WorldSimulation("w", DeathMode.Adventure, 1);
            sim.SpawnPlayer("p");
            sim.Actors["p"].Stamina = 0;
            var wolf = sim.SpawnActor("mob_wolf", 1f, 0f);
            var hit = sim.TryAttack("p", wolf.Id, true, false);
            Assert.That(hit.Reason, Is.EqualTo("stamina"));
            Assert.That(wolf.Health, Is.EqualTo(wolf.MaxHealth));
        }

        [Test]
        public void DodgeIFramesNegateTheHit()
        {
            var sim = new WorldSimulation("w", DeathMode.Adventure, 1);
            var player = sim.SpawnPlayer("p");
            var wolf = sim.SpawnActor("mob_wolf", 1f, 0f);
            player.IFrameTicks = SimRates.DodgeIFrameTicks;
            var fromWolf = sim.TryAttack(wolf.Id, "p", false, false);
            Assert.That(fromWolf.Reason, Is.EqualTo("iframe"));
            Assert.That(fromWolf.Damage, Is.EqualTo(0));
            Assert.That(player.Health, Is.EqualTo(80));
        }

        [Test]
        public void FistsCannotBlockAShieldCanAndGreatswordRankFourCan()
        {
            Assert.That(CombatMath.CanBlock(null, 0), Is.False);
            Assert.That(CombatMath.CanBlock(null, 4), Is.True);
            var shield = ContentCatalog.Slice().Item("arm_stump_shield");
            Assert.That(CombatMath.CanBlock(shield, 0), Is.True);
        }

        [Test]
        public void ParryWindowRejectsALateBlock()
        {
            var sim = new WorldSimulation("w", DeathMode.Adventure, 1);
            var player = sim.SpawnPlayer("p");
            Arm(sim, "arm_stump_shield");
            var wolf = sim.SpawnActor("mob_wolf", 1f, 0f);
            player.Blocking = true;
            player.BlockStartedTick = 0;
            sim.Clock.Advance(10);
            var late = sim.TryAttack(wolf.Id, "p", false, false);
            Assert.That(late.Parried, Is.False);
            Assert.That(late.Damage, Is.GreaterThan(0));

            player.Health = 80;
            player.BlockStartedTick = sim.Clock.Tick;
            var parry = sim.TryAttack(wolf.Id, "p", false, false);
            Assert.That(parry.Parried, Is.True);
            Assert.That(parry.Damage, Is.EqualTo(0));
        }

        [Test]
        public void RewindHitsTheOldPose()
        {
            var sim = new WorldSimulation("w", DeathMode.Adventure, 1);
            var player = sim.SpawnPlayer("p");
            var wolf = sim.SpawnActor("mob_wolf", 1f, 0f);
            sim.RecordHurt(wolf.Id);
            long then = sim.Clock.Tick;
            wolf.X = 30;
            sim.Clock.Advance(1);
            sim.RecordHurt(wolf.Id);
            player.Stamina = 40;
            var hit = sim.TryAttack("p", wolf.Id, false, false, then);
            Assert.That(hit.Accepted, Is.True);
            Assert.That(hit.Reason, Is.Not.EqualTo("range"));
            Assert.That(hit.Damage, Is.GreaterThan(0));
        }

        [Test]
        public void OutOfRangeIsRejected()
        {
            var sim = new WorldSimulation("w", DeathMode.Adventure, 1);
            sim.SpawnPlayer("p");
            var wolf = sim.SpawnActor("mob_wolf", 12f, 0f);
            var hit = sim.TryAttack("p", wolf.Id, false, false);
            Assert.That(hit.Reason, Is.EqualTo("range"));
        }

        [Test]
        public void BossesAreNotSoftCapped()
        {
            float trash = CombatMath.RegionCap(20, 40, 2, false);
            float boss = CombatMath.RegionCap(20, 40, 2, true);
            Assert.That(trash, Is.LessThan(20));
            Assert.That(boss, Is.EqualTo(20));
        }

        [Test]
        public void AdventureRespawnReturnsToThePad()
        {
            var sim = new WorldSimulation("w", DeathMode.Adventure, 1);
            var player = sim.SpawnPlayer("p");
            player.X = 4;
            player.Health = 1;
            var wolf = sim.SpawnActor("mob_wolf", 4.5f, 0f);
            var hit = sim.TryAttack(wolf.Id, "p", false, false);
            Assert.That(hit.Killed, Is.True);
            Assert.That(player.Life, Is.EqualTo(LifeState.Alive));
            Assert.That(player.X, Is.EqualTo(0));
            Assert.That(player.Health, Is.EqualTo(80));
        }

        static int HitWolf(bool knife)
        {
            var sim = new WorldSimulation("w", DeathMode.Adventure, 1);
            sim.SpawnPlayer("p");
            if (knife)
                ArmKnife(sim);
            var wolf = sim.SpawnActor("mob_wolf", 1f, 0f);
            sim.Actors["p"].Stamina = 30;
            return sim.TryAttack("p", wolf.Id, false, false).Damage;
        }

        static void ArmKnife(WorldSimulation sim) => Arm(sim, "wpn_stone_knife");

        static void Arm(WorldSimulation sim, string item)
        {
            sim.Bag("p").Add(sim.Content.Item(item), 1, "p", item);
            sim.TryEquip("p", item);
        }
    }

    public class BossSaveTests
    {
        [Test]
        public void CookieGrantsOnceOpensTheGateAndSurvivesReload()
        {
            var sim = FightCookie();
            Assert.That(sim.Flags.Has("seal_cookie"), Is.True);
            Assert.That(WorldFlags.GateOpen(sim.Flags, "gate_green"), Is.True);
            Assert.That(sim.Bag("p").CountOf("wpn_cookie_blade"), Is.EqualTo(1));
            Assert.That(sim.Bag("p").CountOf("wpn_cookie_pick"), Is.EqualTo(1));
            Assert.That(sim.Bag("p").CountOf("key_cookie_core"), Is.EqualTo(1));
            Assert.That(sim.Content.Item("wpn_cookie_blade").Soulbound, Is.True);

            var again = Grants.Mint(sim.Content, sim.Bag("p"), sim.Content.Boss("boss_cookie"), sim.WorldId, "p", () => sim.NextId("x"));
            Assert.That(again.All(g => !g.Created), Is.True);
            Assert.That(sim.Bag("p").CountOf("wpn_cookie_blade"), Is.EqualTo(1));

            string dir = Path.Combine(Path.GetTempPath(), "veyr-save-" + Guid.NewGuid().ToString("n"));
            Directory.CreateDirectory(dir);
            try
            {
                string character = Path.Combine(dir, "character.json");
                string world = Path.Combine(dir, "world.json");
                // Unique loot saves immediately; the dirty timer saves again. A later torn copy
                // falls back to the previous generation, which already holds the grant.
                SaveGame.WriteCharacter(character, sim.CaptureCharacter("p", "Unmarked"));
                SaveGame.WriteCharacter(character, sim.CaptureCharacter("p", "Unmarked"));
                SaveGame.WriteWorld(world, sim.CaptureWorld());
                File.WriteAllText(character, "{torn");
                var loaded = SaveGame.ReadCharacter(character);
                var worldDoc = SaveGame.ReadWorld(world);
                Assert.That(loaded.Items.Any(i => i.DefId == "wpn_cookie_blade"), Is.True);
                Assert.That(worldDoc.Seals, Does.Contain("seal_cookie"));
                Assert.That(loaded.Schema, Is.EqualTo(1));
                Assert.That(worldDoc.Schema, Is.EqualTo(1));
            }
            finally
            {
                Directory.Delete(dir, true);
            }
        }

        [Test]
        public void WipeDoesNotSetTheSeal()
        {
            var sim = new WorldSimulation("w", DeathMode.Adventure, 1);
            sim.SpawnPlayer("p");
            var boss = sim.SpawnBoss("boss_cookie");
            var def = sim.Content.Boss("boss_cookie");
            boss.Tick(def);
            boss.Damage(def, 80);
            boss.Wipe(def);
            Assert.That(boss.State, Is.EqualTo(BossState.Intro));
            Assert.That(boss.Health, Is.EqualTo(boss.MaxHealth));
            Assert.That(sim.Flags.Has("seal_cookie"), Is.False);
        }

        [Test]
        public void PhaseOneWaddleIsCapped()
        {
            var def = ContentCatalog.Slice().Boss("boss_cookie");
            var boss = new BossController(def, 1);
            boss.Begin();
            boss.Tick(def);
            for (int i = 0; i < 399; i++)
                boss.Tick(def);
            Assert.That(boss.PhaseIndex, Is.EqualTo(1));
            boss.Tick(def);
            Assert.That(boss.PhaseIndex, Is.EqualTo(2));
        }

        [Test]
        public void ToyAddsRespectTheCap()
        {
            var def = ContentCatalog.Slice().Boss("boss_cookie");
            var boss = new BossController(def, 1);
            int spawned = 0;
            for (int i = 0; i < 8; i++)
            {
                if (boss.TryAdd(def))
                    spawned++;
            }
            Assert.That(spawned, Is.EqualTo(def.AddCap));
        }

        [Test]
        public void BoeDoesNotOpenCookieSeal()
        {
            var sim = new WorldSimulation("w", DeathMode.Adventure, 1);
            var player = sim.SpawnPlayer("p");
            player.Stamina = 5000;
            player.MaxStamina = 5000;
            Arm(sim);
            var boe = sim.SpawnBoss("boss_boe");
            sim.Actors["boss_boe"].X = 1;
            while (boe.State != BossState.Dead)
                sim.TryAttack("p", "boss_boe", true, false);
            Assert.That(sim.Flags.Has("seal_cookie"), Is.False);
            Assert.That(sim.Bag("p").CountOf("wpn_smacko"), Is.EqualTo(1));
            Assert.That(WorldFlags.GateOpen(sim.Flags, "gate_green"), Is.False);
        }

        [Test]
        public void ExtraPlayersRaiseBossHealth()
        {
            Assert.That(CombatMath.BossHealth(100, 1), Is.EqualTo(100));
            Assert.That(CombatMath.BossHealth(100, 2), Is.EqualTo(140));
            Assert.That(CombatMath.BossHealth(100, 4), Is.EqualTo(220));
        }

        [Test]
        public void FinsterCirclesAreStaggered()
        {
            long start = 1000;
            Assert.That(CombatMath.RiteStartTick(start, 1) - CombatMath.RiteStartTick(start, 0), Is.EqualTo(10));
        }

        [Test]
        public void TornSaveFallsBackAndAFinishedTempIsKept()
        {
            string dir = Path.Combine(Path.GetTempPath(), "veyr-tear-" + Guid.NewGuid().ToString("n"));
            Directory.CreateDirectory(dir);
            try
            {
                string path = Path.Combine(dir, "world.json");
                AtomicStore.Write(path, "{\"schema\":1,\"ok\":\"first\"}");
                AtomicStore.Write(path, "{\"schema\":1,\"ok\":\"second\"}");
                Assert.That(AtomicStore.ReadBody(path), Does.Contain("second"));

                // A corrupt current copy falls back to the previous good generation.
                File.WriteAllText(path, "torn-mid-write");
                Assert.That(AtomicStore.ReadBody(path), Does.Contain("first"));

                // A kill after the temp file was flushed but before the rename keeps the finished temp.
                AtomicStore.Write(path, "{\"schema\":1,\"ok\":\"third\"}");
                File.Copy(path, path + ".tmp", true);
                File.Delete(path);
                Assert.That(AtomicStore.ReadBody(path), Does.Contain("third"));
                Assert.That(File.Exists(path), Is.True);

                // A kill mid-way through the temp write leaves a torn temp. The current copy wins.
                File.WriteAllText(path + ".tmp", "{\"Schema\":1,\"Chec");
                Assert.That(AtomicStore.ReadBody(path), Does.Contain("third"));
            }
            finally
            {
                Directory.Delete(dir, true);
            }
        }

        [Test]
        public void ClientCannotBirthAnItem()
        {
            Assert.That(Authority.ClientMaySend("GrantItem"), Is.False);
            Assert.That(Authority.ClientMaySend("TryCraft"), Is.True);
            Assert.That(Authority.ProtocolVersion, Is.EqualTo(1));
        }

        static WorldSimulation FightCookie()
        {
            var sim = new WorldSimulation("hearth", DeathMode.Adventure, 9);
            var player = sim.SpawnPlayer("p");
            player.Stamina = 5000;
            player.MaxStamina = 5000;
            sim.Bag("p").Add(sim.Content.Item("wpn_copper_sword"), 1, "p", "sword");
            sim.TryEquip("p", "sword");
            var boss = sim.SpawnBoss("boss_cookie");
            sim.Actors["boss_cookie"].X = 1.2f;
            int guard = 0;
            while (boss.State != BossState.Dead)
            {
                sim.TryAttack("p", "boss_cookie", true, true);
                if (++guard > 80)
                    Assert.Fail("Cookie did not die");
            }
            return sim;
        }

        static void Arm(WorldSimulation sim)
        {
            sim.Bag("p").Add(sim.Content.Item("wpn_cookie_blade"), 1, "p", "blade-temp");
            sim.TryEquip("p", "blade-temp");
        }
    }

    public class WorldSystemTests
    {
        [Test]
        public void DayBecomesNightAfterSixteenRealMinutes()
        {
            var day = new DayClock();
            Assert.That(day.IsNight, Is.False);
            day.AdvanceRealSeconds(16f * 60f);
            Assert.That(day.Hour, Is.EqualTo(16f).Within(0.01f));
            Assert.That(day.IsNight, Is.True);
        }

        [Test]
        public void TanicIsAtTheSmithLaneInTheMorning()
        {
            var schedule = ContentCatalog.Slice().Schedules.Single(s => s.NpcId == "npc_tanic");
            Assert.That(Schedules.StationAt(schedule, 8f), Is.EqualTo("hearthfen_smith_lane"));
            Assert.That(Schedules.StationAt(schedule, 20f), Is.EqualTo("hearthfen_workshop"));
        }

        [Test]
        public void DialogueKeyResolvesEnglish()
        {
            var lines = ContentCatalog.Slice().Lines;
            Assert.That(lines["finster.rite.line"], Is.EqualTo("Smell my fingers."));
            Assert.That(lines["tanic.kingdom.quiet"], Is.EqualTo(""));
        }

        [Test]
        public void QuestAdvancesOnTheServerEvent()
        {
            var def = ContentCatalog.Slice().Quests.Single(q => q.Id == "q_cookie");
            var progress = new QuestProgress { QuestId = def.Id };
            Quests.Advance(progress, def, "talk", "npc_tanic");
            Assert.That(progress.State, Is.EqualTo(QuestState.Active));
            Quests.Advance(progress, def, "boss", "boss_cookie");
            Assert.That(progress.State, Is.EqualTo(QuestState.Complete));
        }

        [Test]
        public void DeathModesMatchTheBible()
        {
            Assert.That(DeathRules.OnItem(DeathMode.Adventure, false, false).Keep, Is.True);
            Assert.That(DeathRules.OnItem(DeathMode.Survival, false, false).Keep, Is.False);
            Assert.That(DeathRules.OnItem(DeathMode.Survival, true, false).Keep, Is.True);
            Assert.That(DeathRules.OnItem(DeathMode.Survival, false, true).Keep, Is.True);
            Assert.That(DeathRules.CharacterDeleted(DeathMode.Hardcore), Is.True);

            var sim = new WorldSimulation("w", DeathMode.Survival, 1);
            sim.SpawnPlayer("p");
            sim.Bag("p").Add(sim.Content.Item("mat_flint"), 3, "p", "f");
            sim.Bag("p").Add(sim.Content.Item("wpn_cookie_blade"), 1, "p", "blade", Grants.Key("w", "boss_cookie", "p", "wpn_cookie_blade"));
            var blade = sim.Bag("p").Find("blade")!;
            blade.Equipped = true;
            var dropped = DeathRules.DropCarried(sim.Bag("p"), DeathMode.Survival);
            Assert.That(dropped.Any(i => i.DefId == "mat_flint"), Is.True);
            Assert.That(sim.Bag("p").CountOf("wpn_cookie_blade"), Is.EqualTo(1));
        }

        [Test]
        public void DownedBleedIsThirtySeconds()
        {
            var body = new ActorBody { Id = "p", Life = LifeState.Downed };
            for (int i = 0; i < SimRates.DownedTicks - 1; i++)
                Assert.That(DeathRules.TickDowned(body), Is.False);
            Assert.That(DeathRules.TickDowned(body), Is.True);
            Assert.That(body.Life, Is.EqualTo(LifeState.Dead));
            Assert.That(SimRates.DownedTicks / SimRates.TicksPerSecond, Is.EqualTo(30));
        }

        [Test]
        public void EmberSpendsManaExpiresAndCaps()
        {
            var caster = new Caster();
            var spell = new SpellDef
            {
                Id = "spell_ember",
                DisplayName = "Ember",
                School = Element.Fire,
                ManaCost = 1,
                CooldownTicks = 1,
                TtlTicks = 1000,
                CapPerCaster = 8
            };
            Assert.That(caster.TryCast(spell, () => "e"), Is.EqualTo("mana"));
            caster.Awaken(100);
            int id = 0;
            for (int i = 0; i < 8; i++)
            {
                Assert.That(caster.TryCast(spell, () => "e" + id++), Is.EqualTo(""));
                caster.Tick();
            }
            Assert.That(caster.Patches, Has.Count.EqualTo(8));
            Assert.That(caster.TryCast(spell, () => "over"), Is.EqualTo("cap"));
            for (int t = 0; t < spell.TtlTicks + 5; t++)
                caster.Tick();
            Assert.That(caster.Patches, Is.Empty);
        }

        [Test]
        public void CampRejectsOverlapAndUndoReturnsTheKit()
        {
            var sim = new WorldSimulation("w", DeathMode.Adventure, 1);
            sim.SpawnPlayer("p");
            sim.Bag("p").Add(sim.Content.Item("piece_bedroll_kit"), 1, "p", "kit");
            var plot = new BuildPlot();
            var placed = plot.TryPlace(sim.Content.Pieces["piece_bedroll"], sim.Bag("p"), "p", 0, 0, 0, () => sim.NextId("x"));
            Assert.That(placed.Ok, Is.True);
            Assert.That(plot.TryPlace(sim.Content.Pieces["piece_bedroll"], sim.Bag("p"), "p", 0, 0, 0, () => sim.NextId("x")).Reason, Is.EqualTo("overlap"));
            Assert.That(plot.TryUndo(sim.Content, sim.Bag("p"), "p", () => sim.NextId("x")), Is.True);
            Assert.That(sim.Bag("p").CountOf("piece_bedroll_kit"), Is.EqualTo(1));
        }

        [Test]
        public void BridgeWithoutAnchorsFails()
        {
            var sim = new WorldSimulation("w", DeathMode.Adventure, 1);
            sim.SpawnPlayer("p");
            sim.Bag("p").Add(sim.Content.Item("mat_wood"), 6, "p", "wood");
            var plot = new BuildPlot();
            var result = plot.TryPlace(sim.Content.Pieces["piece_bridge"], sim.Bag("p"), "p", 1, 0, 1, () => sim.NextId("x"));
            Assert.That(result.Reason, Is.EqualTo("anchors"));
        }

        [Test]
        public void FarmerDoesNotArriveWithoutFood()
        {
            var tiers = ContentCatalog.Slice().SettlementTiers;
            var hungry = new SettlementState { Beds = 4, Well = true, Bench = true, Palisade = true, Food = 0 };
            var fed = new SettlementState { Beds = 4, Well = true, Bench = true, Palisade = true, Food = 3 };
            Assert.That(Settlements.FarmerArrives(hungry, tiers), Is.False);
            Assert.That(Settlements.FarmerArrives(fed, tiers), Is.True);
            Assert.That(Settlements.Tier(fed, tiers), Is.EqualTo(1));
        }

        [Test]
        public void DungeonSeedIsStable()
        {
            string[] kit = { "room_nursery", "room_corridor", "room_bell", "room_elite" };
            var a = DungeonGraph.Roll(42, kit, 6);
            var b = DungeonGraph.Roll(42, kit, 6);
            var c = DungeonGraph.Roll(43, kit, 6);
            Assert.That(b, Is.EqualTo(a));
            Assert.That(c, Is.Not.EqualTo(a));
        }

        [Test]
        public void OneMajorEventAtATime()
        {
            var raid = ContentCatalog.Slice().Events.Single(e => e.Id == "event_bandit_raid");
            Assert.That(Events.CanStart(Array.Empty<string>(), raid), Is.True);
            Assert.That(Events.CanStart(new[] { "event_bandit_raid" }, raid), Is.False);
        }

        [Test]
        public void FarActorsDropOffInterest()
        {
            Assert.That(Authority.Relevant(90), Is.True);
            Assert.That(Authority.Relevant(140), Is.False);
        }

        [Test]
        public void StartingBodyMatchesTheBible()
        {
            var stats = StatSheet.Derive(0, 0, 0);
            Assert.That(stats.Health, Is.EqualTo(80));
            Assert.That(stats.Stamina, Is.EqualTo(60));
            Assert.That(stats.Mana, Is.EqualTo(0));
            Assert.That(StatSheet.LevelForXp(10000), Is.EqualTo(SimRates.SliceLevelCap));
            var json = "{\"body\":\"cloth\",\"height\":1.02,\"hair\":\"tied\"}";
            Assert.That(AppearanceRules.Valid(new AppearanceBlob("cloth", 1.02f, "tied", 1), json), Is.True);
            Assert.That(AppearanceRules.Valid(new AppearanceBlob("cloth", 1f, "tied", 1), "{\"class\":\"knight\"}"), Is.False);
        }

        [Test]
        public void GoblinIsNotAWolf()
        {
            var cat = ContentCatalog.Slice();
            Assert.That(cat.Actors["mob_goblin"].Verb, Is.Not.EqualTo(cat.Actors["mob_wolf"].Verb));
            Assert.That(cat.Bosses.ContainsKey("boss_finster"), Is.True);
            Assert.That(cat.Regions.Count, Is.EqualTo(10));
            Assert.That(cat.Npcs.Any(n => n.Id == "npc_tanic" && n.QuestCritical), Is.True);
            Assert.That(typeof(WorldSimulation).Assembly.GetReferencedAssemblies().Any(a => a.Name != null && a.Name.Contains("Unity")), Is.False);
        }
    }
}
