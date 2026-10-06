using System.Linq;
using NUnit.Framework;
using Veyr.Content;
using Veyr.Sim;

namespace Veyr.Tests.Sim
{
    /// <summary>Forged or impossible requests a client could send. Each must be refused by the sim.</summary>
    public class AuthorityTests
    {
        [Test]
        public void AFarNodeCannotBeGathered()
        {
            var sim = New();
            sim.SpawnPlayer("p");
            sim.PlaceNode("flint_far", "node_flint", 12f, 0f, 0f);
            var result = sim.TryGather("p", "flint_far");
            Assert.That(result.Ok, Is.False);
            Assert.That(result.Reason, Is.EqualTo("range"));
            Assert.That(sim.Bag("p").CountOf("mat_flint"), Is.EqualTo(0));
            Assert.That(sim.Events.Peek().Any(e => e.Kind == SimEventKind.Rejected && e.Arg == "gather_range"), Is.True);
        }

        [Test]
        public void NamingANodeTypeIsNotANode()
        {
            var sim = New();
            sim.SpawnPlayer("p");
            Assert.That(sim.TryGather("p", "node_flint").Reason, Is.EqualTo("node"));
            Assert.That(sim.TryGather("p", "anything").Reason, Is.EqualTo("node"));
        }

        [Test]
        public void ANodeIsSpentThenReturns()
        {
            var sim = New();
            sim.SpawnPlayer("p");
            var node = sim.PlaceNode("flint", "node_flint", 1f, 0f, 0f);
            int charges = node.Def.Charges;
            for (int i = 0; i < charges; i++)
                Assert.That(sim.TryGather("p", "flint").Ok, Is.True);
            Assert.That(sim.TryGather("p", "flint").Reason, Is.EqualTo("spent"));
            Assert.That(sim.Bag("p").CountOf("mat_flint"), Is.EqualTo(charges));
            Assert.That(sim.Events.Peek().Count(e => e.Kind == SimEventKind.NodeDepleted), Is.EqualTo(1));

            for (int t = 0; t <= node.Def.RespawnTicks; t++)
                sim.Step();
            Assert.That(node.Spent, Is.False);
            Assert.That(sim.Events.Peek().Count(e => e.Kind == SimEventKind.NodeRestored), Is.EqualTo(1));
            Assert.That(sim.TryGather("p", "flint").Ok, Is.True);
        }

        [Test]
        public void ADeadPlayerCannotGatherOrCraft()
        {
            var sim = New();
            var body = sim.SpawnPlayer("p");
            sim.PlaceNode("flint", "node_flint", 1f, 0f, 0f);
            sim.Bag("p").Add(sim.Content.Item("mat_flint"), 2, "p", "f");
            sim.Bag("p").Add(sim.Content.Item("mat_wood"), 1, "p", "w");
            body.Life = LifeState.Dead;
            Assert.That(sim.TryGather("p", "flint").Reason, Is.EqualTo("dead"));
            Assert.That(sim.TryCraft("p", "recipe_stone_knife", StationId.Hand, "k").Reason, Is.EqualTo("dead"));
        }

        [Test]
        public void ABenchCraftNeedsABenchInReach()
        {
            var sim = New();
            var body = sim.SpawnPlayer("p");
            Stock(sim);
            Assert.That(sim.TryCraft("p", "recipe_stone_pick", StationId.Bench, "pick-1").Reason, Is.EqualTo("station_range"));

            sim.PlaceStation("bench_far", StationId.Bench, 30f, 0f, 0f);
            Assert.That(sim.TryCraft("p", "recipe_stone_pick", StationId.Bench, "pick-2").Reason, Is.EqualTo("station_range"));

            sim.PlaceStation("forge_near", StationId.Forge, 1f, 0f, 0f);
            Assert.That(sim.TryCraft("p", "recipe_stone_pick", StationId.Bench, "pick-3").Reason, Is.EqualTo("station_range"));

            body.X = 29f;
            var made = sim.TryCraft("p", "recipe_stone_pick", StationId.Bench, "pick-4");
            Assert.That(made.Ok, Is.True);
            Assert.That(sim.Bag("p").CountOf("wpn_stone_pick"), Is.EqualTo(1));
        }

        [Test]
        public void ARetriedCraftAfterWalkingAwayReturnsTheSameItem()
        {
            var sim = New();
            var body = sim.SpawnPlayer("p");
            Stock(sim);
            sim.PlaceStation("bench", StationId.Bench, 1f, 0f, 0f);
            var first = sim.TryCraft("p", "recipe_stone_pick", StationId.Bench, "pick");
            body.X = 50f;
            var retry = sim.TryCraft("p", "recipe_stone_pick", StationId.Bench, "pick");
            Assert.That(retry.Ok, Is.True);
            Assert.That(retry.Reason, Is.EqualTo("replay"));
            Assert.That(retry.InstanceId, Is.EqualTo(first.InstanceId));
            Assert.That(sim.Bag("p").CountOf("wpn_stone_pick"), Is.EqualTo(1));
        }

        [Test]
        public void AnUnknownRecipeIsRefusedNotThrown()
        {
            var sim = New();
            sim.SpawnPlayer("p");
            Assert.That(sim.TryCraft("p", "recipe_cookie_blade_please", StationId.Hand, "x").Reason, Is.EqualTo("recipe"));
            Assert.That(sim.TryCraft("ghost", "recipe_stone_knife", StationId.Hand, "x").Reason, Is.EqualTo("actor"));
        }

        [Test]
        public void FlankIsTheSimsCall()
        {
            var wolf = new ActorBody { Id = "wolf", Yaw = 0f };
            var front = new ActorBody { Id = "front", Z = 1.2f };
            var side = new ActorBody { Id = "side", X = 1.2f };
            var behind = new ActorBody { Id = "behind", Z = -1.2f, X = 0.3f };
            Assert.That(Reach.Flank(wolf, front), Is.False);
            Assert.That(Reach.Flank(wolf, side), Is.False);
            Assert.That(Reach.Flank(wolf, behind), Is.True);

            int frontPosture = HeavyPostureLoss(0f, 1f);
            int behindPosture = HeavyPostureLoss(0f, -1f);
            Assert.That(behindPosture - frontPosture, Is.EqualTo(20));
        }

        [Test]
        public void AnUnknownOrSelfTargetIsRefusedNotThrown()
        {
            var sim = New();
            sim.SpawnPlayer("p");
            Assert.That(sim.TryAttack("p", "boss_cookie", true).Reason, Is.EqualTo("target"));
            Assert.That(sim.TryAttack("p", "p", false).Reason, Is.EqualTo("target"));
            Assert.That(sim.TryAttack("ghost", "p", false).Reason, Is.EqualTo("target"));
        }

        [Test]
        public void AStaggeredAttackerCannotSwing()
        {
            var sim = New();
            var body = sim.SpawnPlayer("p");
            var wolf = sim.SpawnActor("mob_wolf", 1f, 0f);
            body.StaggerTicks = 5;
            var hit = sim.TryAttack("p", wolf.Id, false);
            Assert.That(hit.Accepted, Is.False);
            Assert.That(hit.Reason, Is.EqualTo("staggered"));
            Assert.That(wolf.Health, Is.EqualTo(wolf.MaxHealth));
        }

        [Test]
        public void AMaterialIsNotAWeapon()
        {
            var sim = New();
            var body = sim.SpawnPlayer("p");
            sim.Bag("p").Add(sim.Content.Item("mat_wood"), 3, "p", "wood");
            sim.Bag("p").Add(sim.Content.Item("key_cookie_core"), 1, "p", "core");
            Assert.That(sim.TryEquip("p", "wood"), Is.False);
            Assert.That(sim.TryEquip("p", "core"), Is.False);
            Assert.That(body.EquippedId, Is.EqualTo(""));
        }

        [Test]
        public void ARewindOlderThanTheBufferIsRefused()
        {
            var sim = New();
            sim.SpawnPlayer("p");
            var wolf = sim.SpawnActor("mob_wolf", 1f, 0f);
            for (int i = 0; i < 10; i++)
                sim.Step();
            var hit = sim.TryAttack("p", wolf.Id, false, sim.Clock.Tick - SimRates.HurtboxTicks - 1);
            Assert.That(hit.Reason, Is.EqualTo("rewind"));
        }

        static int HeavyPostureLoss(float x, float z)
        {
            var sim = New();
            var body = sim.SpawnPlayer("p", x, 0f, z);
            body.Stamina = 60;
            var wolf = sim.SpawnActor("mob_wolf", 0f, 0f);
            float before = wolf.Posture;
            sim.TryAttack("p", wolf.Id, true);
            return (int)(before - wolf.Posture);
        }

        static void Stock(WorldSimulation sim)
        {
            sim.Bag("p").Add(sim.Content.Item("mat_flint"), 6, "p", "f");
            sim.Bag("p").Add(sim.Content.Item("mat_wood"), 4, "p", "w");
            sim.Bag("p").Add(sim.Content.Item("mat_fibre"), 2, "p", "fb");
        }

        static WorldSimulation New() => new WorldSimulation("w", DeathMode.Adventure, 1);
    }
}
