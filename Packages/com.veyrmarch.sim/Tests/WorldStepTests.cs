using System;
using System.Collections.Generic;
using System.Linq;
using NUnit.Framework;
using Veyr.Content;
using Veyr.Sim;

namespace Veyr.Tests.Sim
{
    public class WorldStepTests
    {
        const float Dt = 1f / SimRates.TicksPerSecond;

        [Test]
        public void OneStepIsOneTickWhateverThePlayerCount()
        {
            var sim = New();
            sim.SpawnPlayer("a");
            sim.SpawnPlayer("b", 2f, 0f, 0f);
            for (int i = 0; i < SimRates.TicksPerSecond; i++)
            {
                sim.Submit("a", new PlayerIntent { MoveX = 1f });
                sim.Submit("b", new PlayerIntent { MoveZ = 1f });
                sim.Step();
            }

            Assert.That(sim.Clock.Tick, Is.EqualTo(20));
            Assert.That(sim.Clock.ElapsedSeconds, Is.EqualTo(1f).Within(0.0001f));
            Assert.That(sim.Actors["a"].X, Is.EqualTo(4.2f).Within(0.001f));
            Assert.That(sim.Actors["b"].Z, Is.EqualTo(4.2f).Within(0.001f));
        }

        [Test]
        public void AStepWithNoIntentStillAdvancesTheWorld()
        {
            var sim = New();
            var body = sim.SpawnPlayer("p");
            body.Stamina = 10;
            sim.Step();
            Assert.That(sim.Clock.Tick, Is.EqualTo(1));
            Assert.That(body.Stamina, Is.GreaterThan(10f));
            Assert.That(body.X, Is.EqualTo(0f));
        }

        [Test]
        public void TwoIntentsBeforeAStepKeepTheDodgePress()
        {
            var sim = New();
            var body = sim.SpawnPlayer("p");
            sim.Submit("p", new PlayerIntent { Dodge = true, Seq = 1 });
            sim.Submit("p", new PlayerIntent { MoveX = 1f, Seq = 2 });
            sim.Step();
            Assert.That(body.IFrameTicks, Is.EqualTo(SimRates.DodgeIFrameTicks));
            Assert.That(body.LastSeq, Is.EqualTo(2));
            Assert.That(body.X, Is.GreaterThan(0f));
        }

        [Test]
        public void HalfAStickWalksAtHalfSpeed()
        {
            var sim = New();
            var body = sim.SpawnPlayer("p");
            sim.Tick(new PlayerIntent { MoveX = 0.5f }, "p");
            Assert.That(body.X, Is.EqualTo(4.2f * 0.5f * Dt).Within(0.0001f));
        }

        [Test]
        public void ADodgeBurstsAlongTheFacingWithoutAStick()
        {
            var sim = New();
            var body = sim.SpawnPlayer("p");
            sim.Tick(new PlayerIntent { Dodge = true, Yaw = 90f }, "p");
            Assert.That(body.X, Is.GreaterThan(0.4f));
            Assert.That(body.Z, Is.EqualTo(0f).Within(0.001f));
        }

        [Test]
        public void OnlyPlayersMaySubmit()
        {
            var sim = New();
            sim.SpawnPlayer("p");
            var wolf = sim.SpawnActor("mob_wolf", 3f, 0f);
            sim.Submit(wolf.Id, new PlayerIntent { MoveX = 1f });
            sim.Submit("nobody", new PlayerIntent { MoveX = 1f });
            sim.Step();
            Assert.That(wolf.X, Is.EqualTo(3f));
            Assert.That(sim.Events.Peek().Count(e => e.Kind == SimEventKind.Rejected), Is.EqualTo(2));
        }

        [Test]
        public void AClaimInsideTheBudgetMovesTheBody()
        {
            var sim = New();
            var body = sim.SpawnPlayer("p");
            float x = 0f;
            for (int i = 0; i < 40; i++)
            {
                x += 4.2f * Dt;
                var move = sim.TryMove("p", Claim(x, 0f, 0f));
                Assert.That(move.Accepted, Is.True, "tick " + i + " " + move.Reason);
            }
            Assert.That(body.X, Is.EqualTo(x).Within(0.0001f));
        }

        [Test]
        public void ASpeedHackIsHeldToTheCapOverTime()
        {
            var sim = New();
            var body = sim.SpawnPlayer("p");
            float claimed = 0f;
            int refused = 0;
            for (int i = 0; i < 60; i++)
            {
                claimed = body.X + 14f * Dt;
                var move = sim.TryMove("p", Claim(claimed, 0f, 0f));
                if (!move.Accepted)
                {
                    refused++;
                    Assert.That(move.Reason, Is.EqualTo("speed"));
                }
            }

            float seconds = 60 * Dt;
            float cap = sim.Content.Move.SpeedCapMetresPerSecond;
            Assert.That(refused, Is.GreaterThan(0));
            Assert.That(body.X, Is.LessThanOrEqualTo(cap * seconds + cap * sim.Content.Move.ClaimBankSeconds + 0.2f));
        }

        [Test]
        public void ATeleportIsRefusedAndTheClientIsToldWhereItIs()
        {
            var sim = New();
            var body = sim.SpawnPlayer("p", 1f, 0f, 1f);
            var move = sim.TryMove("p", Claim(60f, 0f, 1f));
            Assert.That(move.Accepted, Is.False);
            Assert.That(move.Reason, Is.EqualTo("teleport"));
            Assert.That(body.X, Is.EqualTo(1f));
            var rejected = sim.Events.Peek().Single(e => e.Kind == SimEventKind.MoveRejected);
            Assert.That(rejected.X, Is.EqualTo(1f));
            Assert.That(rejected.Arg, Is.EqualTo("teleport"));
        }

        [Test]
        public void ANaNClaimIsRefused()
        {
            var sim = New();
            var body = sim.SpawnPlayer("p");
            var move = sim.TryMove("p", Claim(float.NaN, 0f, 0f));
            Assert.That(move.Accepted, Is.False);
            Assert.That(move.Reason, Is.EqualTo("invalid"));
            Assert.That(float.IsNaN(body.X), Is.False);
        }

        [Test]
        public void TheDodgeBurstIsOnlyLegalWhileDodging()
        {
            var tuning = new MoveTuning();
            float burst = tuning.DodgeMetresPerSecond * Dt;

            var dodging = New();
            var a = dodging.SpawnPlayer("p");
            for (int i = 0; i < tuning.DodgeTicks; i++)
            {
                var intent = Claim(a.X + burst, 0f, 0f);
                intent.Dodge = i == 0;
                Assert.That(dodging.TryMove("p", intent).Accepted, Is.True, "dodge tick " + i);
            }

            var faking = New();
            var b = faking.SpawnPlayer("p");
            int refused = 0;
            for (int i = 0; i < 60; i++)
            {
                if (!faking.TryMove("p", Claim(b.X + burst, 0f, 0f)).Accepted)
                    refused++;
            }
            Assert.That(refused, Is.GreaterThan(0));
        }

        [Test]
        public void AJumpArcIsLegalAndFlyingIsNot()
        {
            var tuning = new MoveTuning();
            var jumper = New();
            var body = jumper.SpawnPlayer("p");
            float v = tuning.JumpVelocity;
            float y = 0f;
            for (int i = 0; i < 40; i++)
            {
                v -= tuning.Gravity * Dt;
                y = MathF.Max(0f, y + v * Dt);
                var move = jumper.TryMove("p", Claim(0f, y, 0f));
                Assert.That(move.Accepted, Is.True, "jump tick " + i + " " + move.Reason);
                if (y <= 0f)
                    break;
            }

            var flyer = New();
            var fly = flyer.SpawnPlayer("p");
            string reason = "";
            for (int i = 0; i < 40 && reason.Length == 0; i++)
            {
                var move = flyer.TryMove("p", Claim(0f, fly.Y + 0.25f, 0f));
                if (!move.Accepted)
                    reason = move.Reason;
            }
            Assert.That(reason, Is.EqualTo("climb"));
            Assert.That(fly.Y, Is.LessThan(2f));
            Assert.That(body.Y, Is.EqualTo(0f));
        }

        [Test]
        public void WalkingUpASlopeIsNotFlying()
        {
            var sim = New();
            var body = sim.SpawnPlayer("p");
            for (int i = 0; i < 100; i++)
            {
                float step = 4.2f * Dt;
                var move = sim.TryMove("p", Claim(body.X + step, body.Y + step * 0.9f, 0f));
                Assert.That(move.Accepted, Is.True, "slope tick " + i + " " + move.Reason);
            }
            Assert.That(body.Y, Is.GreaterThan(15f));
        }

        [Test]
        public void TheGreenGateBlocksUntilTheSealThenLetsThePlayerThrough()
        {
            var sim = New();
            var body = sim.SpawnPlayer("p", 0f, 0f, 48f);
            sim.Geometry.AddBlocker("green_gate", "gate_green", -5f, 49.5f, 5f, 50.5f);

            string reason = "";
            for (int i = 0; i < 60 && reason.Length == 0; i++)
            {
                var move = sim.TryMove("p", Claim(0f, 0f, body.Z + 0.2f));
                if (!move.Accepted)
                    reason = move.Reason;
            }
            Assert.That(reason, Is.EqualTo("blocked"));
            Assert.That(body.Z, Is.LessThan(49.5f));

            var walker = New();
            var w = walker.SpawnPlayer("w", 0f, 0f, 48f);
            walker.Geometry.AddBlocker("green_gate", "gate_green", -5f, 49.5f, 5f, 50.5f);
            for (int i = 0; i < 60; i++)
                walker.Tick(new PlayerIntent { MoveZ = 1f }, "w");
            Assert.That(w.Z, Is.LessThan(49.5f));

            sim.Flags.Set("seal_cookie");
            for (int i = 0; i < 40; i++)
                Assert.That(sim.TryMove("p", Claim(0f, 0f, body.Z + 0.2f)).Accepted, Is.True);
            Assert.That(body.Z, Is.GreaterThan(51f));
        }

        [Test]
        public void ABlockerThatShutsOnABodyLetsItLeave()
        {
            var sim = New();
            var body = sim.SpawnPlayer("p", 0f, 0f, 50f);
            sim.Geometry.AddBlocker("wall", "", -5f, 49.5f, 5f, 50.5f);
            Assert.That(sim.TryMove("p", Claim(0f, 0f, 50.2f)).Accepted, Is.True);
            Assert.That(sim.TryMove("p", Claim(0f, 0f, 50.6f)).Accepted, Is.True);
            Assert.That(sim.TryMove("p", Claim(0f, 0f, 50.4f)).Accepted, Is.False);
            Assert.That(body.Z, Is.EqualTo(50.6f).Within(0.0001f));
        }

        [Test]
        public void TheBossSealIsAnnouncedOnceAndEventsDrainOnce()
        {
            var sim = New();
            var player = sim.SpawnPlayer("p");
            player.Stamina = 5000;
            player.MaxStamina = 5000;
            sim.Bag("p").Add(sim.Content.Item("wpn_copper_sword"), 1, "p", "sword");
            sim.TryEquip("p", "sword");
            var boss = sim.SpawnBoss("boss_cookie");
            sim.Actors["boss_cookie"].X = 1.2f;
            int guard = 0;
            while (boss.State != BossState.Dead && guard++ < 80)
                sim.TryAttack("p", "boss_cookie", true, false);

            var drained = new List<SimEvent>();
            sim.Events.DrainInto(drained);
            Assert.That(drained.Count(e => e.Kind == SimEventKind.SealSet && e.Arg == "seal_cookie"), Is.EqualTo(1));
            Assert.That(drained.Count(e => e.Kind == SimEventKind.ItemGranted), Is.EqualTo(3));
            Assert.That(drained.Count(e => e.Kind == SimEventKind.Killed), Is.EqualTo(1));
            Assert.That(sim.Events.Count, Is.EqualTo(0));
        }

        [Test]
        public void ADuplicatePlayerIdIsRefused()
        {
            var sim = New();
            sim.SpawnPlayer("p");
            Assert.Throws<ArgumentException>(() => sim.SpawnPlayer("p"));
        }

        static PlayerIntent Claim(float x, float y, float z) => new PlayerIntent
        {
            HasClaim = true,
            ClaimX = x,
            ClaimY = y,
            ClaimZ = z
        };

        static WorldSimulation New() => new WorldSimulation("w", DeathMode.Adventure, 1);
    }
}
