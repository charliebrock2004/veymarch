using System;
using System.Collections.Generic;
using System.Numerics;
using NUnit.Framework;
using Veyr.Client.Core;
using Veyr.Content;
using Veyr.Net;
using Veyr.Server;
using Veyr.Sim;

namespace Veyr.Tests.ClientCore
{
    public class StickTests
    {
        [Test]
        public void TheStickLandsWhereTheThumbDoesAndFollowsPastTheRim()
        {
            var stick = new VirtualStick { RadiusPixels = 100f, DeadZone = 0.1f };
            Assert.That(stick.Press(3, new Vector2(200, 200)), Is.True);
            Assert.That(stick.Press(4, new Vector2(10, 10)), Is.False);
            stick.Drag(3, new Vector2(205, 200));
            Assert.That(stick.Value, Is.EqualTo(Vector2.Zero));
            stick.Drag(3, new Vector2(250, 200));
            Assert.That(stick.Value.X, Is.EqualTo((0.5f - 0.1f) / 0.9f).Within(0.001f));
            stick.Drag(3, new Vector2(500, 200));
            Assert.That(stick.Value.X, Is.EqualTo(1f).Within(0.0001f));
            Assert.That(stick.Origin.X, Is.EqualTo(400f).Within(0.001f));
            Assert.That(stick.AtRim, Is.True);
            stick.Drag(3, new Vector2(400, 300));
            Assert.That(stick.Value.Y, Is.GreaterThan(0.9f));
            stick.Release(4);
            Assert.That(stick.Active, Is.True);
            stick.Release(3);
            Assert.That(stick.Active, Is.False);
            Assert.That(stick.Value, Is.EqualTo(Vector2.Zero));
        }

        [Test]
        public void ADiagonalNeverExceedsOne()
        {
            var v = VirtualStick.Remap(new Vector2(1f, 1f), 0.1f);
            Assert.That(v.Length(), Is.EqualTo(1f).Within(0.0001f));
        }

        [Test]
        public void LookDragTurnsByScreenHeightNotPixels()
        {
            var look = new LookDrag { DegreesPerScreenHeight = 200f };
            look.Press(1, new Vector2(1500, 500), 0);
            look.Drag(1, new Vector2(540, 0));
            var turn = look.Consume(1080f, 1f, false);
            Assert.That(turn.X, Is.EqualTo(100f).Within(0.01f));
            Assert.That(look.Consume(1080f, 1f, false), Is.EqualTo(Vector2.Zero));

            look.Drag(1, new Vector2(0, 108));
            var down = look.Consume(1080f, 1f, false);
            var inverted = new LookDrag { DegreesPerScreenHeight = 200f };
            inverted.Press(1, Vector2.Zero, 0);
            inverted.Drag(1, new Vector2(0, 108));
            Assert.That(inverted.Consume(1080f, 1f, true).Y, Is.EqualTo(-down.Y).Within(0.001f));
        }

        [Test]
        public void AFastShortSwipeIsADodgeAndASlowDragIsNot()
        {
            var look = new LookDrag();
            look.Press(2, new Vector2(1500, 500), 1.0);
            look.Drag(2, new Vector2(160, 0));
            bool flick = look.Release(2, new Vector2(1660, 500), 1.1, 1080f, out var dir, out var turn);
            Assert.That(flick, Is.True);
            Assert.That(dir.X, Is.EqualTo(1f).Within(0.001f));
            Assert.That(turn.X, Is.EqualTo(160f));

            look.Press(2, new Vector2(1500, 500), 2.0);
            look.Drag(2, new Vector2(160, 0));
            Assert.That(look.Release(2, new Vector2(1660, 500), 2.6, 1080f, out _, out _), Is.False);

            look.Press(2, new Vector2(1500, 500), 3.0);
            Assert.That(look.Release(2, new Vector2(1510, 500), 3.05, 1080f, out _, out _), Is.False);
        }

        [Test]
        public void SprintCanBeHeldOrToggled()
        {
            var hold = new HoldOrToggle();
            hold.Update(true);
            Assert.That(hold.On && hold.PressedThisFrame, Is.True);
            hold.Update(true);
            Assert.That(hold.On && !hold.PressedThisFrame, Is.True);
            hold.Update(false);
            Assert.That(hold.On, Is.False);

            var toggle = new HoldOrToggle { Toggle = true };
            toggle.Update(true);
            toggle.Update(false);
            Assert.That(toggle.On, Is.True);
            toggle.Update(true);
            toggle.Update(false);
            Assert.That(toggle.On, Is.False);
        }
    }

    public class IntentTests
    {
        [Test]
        public void TheStickIsRelativeToTheCamera()
        {
            var forward = IntentMath.CameraRelative(new Vector2(0f, 1f), 90f);
            Assert.That(forward.X, Is.EqualTo(1f).Within(0.0001f));
            Assert.That(forward.Y, Is.EqualTo(0f).Within(0.0001f));
            var right = IntentMath.CameraRelative(new Vector2(1f, 0f), 90f);
            Assert.That(right.Y, Is.EqualTo(-1f).Within(0.0001f));
            var half = IntentMath.CameraRelative(new Vector2(0.3f, 0.4f), 33f);
            Assert.That(half.Length(), Is.EqualTo(0.5f).Within(0.0001f));
            Assert.That(IntentMath.YawOf(new Vector2(1f, 0f), 0f), Is.EqualTo(90f).Within(0.001f));
            Assert.That(IntentMath.YawOf(new Vector2(0f, -1f), 0f), Is.EqualTo(180f).Within(0.001f));
            Assert.That(IntentMath.DeltaAngle(350f, 10f), Is.EqualTo(20f).Within(0.001f));
        }

        [Test]
        public void ATapBetweenTicksStillReachesTheSim()
        {
            var sender = new IntentSender();
            Assert.That(sender.Due(0.03), Is.False);
            sender.Latch(true, false, false, false, false);
            Assert.That(sender.Due(0.03), Is.True);
            var first = sender.Compose(Vector2.Zero, false, false, 0f, Vector3.Zero, 4);
            Assert.That(first.Intent.Dodge, Is.True);
            Assert.That(first.Intent.Seq, Is.EqualTo(1));
            Assert.That(first.Protocol, Is.EqualTo(Protocol.Version));
            Assert.That(sender.Due(0.05), Is.True);
            var second = sender.Compose(Vector2.Zero, false, false, 0f, Vector3.Zero, 5);
            Assert.That(second.Intent.Dodge, Is.False);
            Assert.That(second.Intent.Seq, Is.EqualTo(2));
        }

        [Test]
        public void ALongFrameSendsOnceNotABurst()
        {
            var sender = new IntentSender();
            Assert.That(sender.Due(1.0), Is.True);
            int extra = 0;
            for (int i = 0; i < 10; i++)
            {
                if (sender.Due(0.0))
                    extra++;
            }
            Assert.That(extra, Is.LessThanOrEqualTo(2));
        }
    }

    public class MotorTests
    {
        const float Frame = 1f / 30f;

        [Test]
        public void WalkSprintAndAHalfStickReachTheTuningSpeeds()
        {
            var tuning = new MoveTuning();
            Assert.That(Speed(tuning, new Vector2(0f, 1f), false), Is.EqualTo(tuning.WalkMetresPerSecond).Within(0.01f));
            Assert.That(Speed(tuning, new Vector2(0f, 1f), true), Is.EqualTo(tuning.SprintMetresPerSecond).Within(0.01f));
            Assert.That(Speed(tuning, new Vector2(0f, 0.5f), false), Is.EqualTo(tuning.WalkMetresPerSecond * 0.5f).Within(0.01f));
        }

        [Test]
        public void ADodgeLastsTheSimsBurstAndNeedsStamina()
        {
            var tuning = new MoveTuning();
            var motor = new PredictionMotor(tuning);
            var input = new MotorInput { DodgePressed = true, KnownStamina = 60f, SpeedScale = 1f };
            motor.Step(input, Frame);
            Assert.That(motor.Dodging, Is.True);
            input.DodgePressed = false;
            float t = Frame;
            while (motor.Dodging && t < 1f)
            {
                motor.Step(input, Frame);
                t += Frame;
            }
            Assert.That(t, Is.EqualTo(tuning.DodgeTicks * tuning.TickDt).Within(Frame * 1.01f));

            var tired = new PredictionMotor(tuning);
            tired.Step(new MotorInput { DodgePressed = true, KnownStamina = 4f, SpeedScale = 1f }, Frame);
            Assert.That(tired.Dodging, Is.False);
        }

        [Test]
        public void AJumpRisesToTheApexAndFalls()
        {
            var tuning = new MoveTuning();
            var motor = new PredictionMotor(tuning);
            float y = 0f;
            float peak = 0f;
            motor.Step(new MotorInput { JumpPressed = true, SpeedScale = 1f }, Frame);
            motor.Grounded = false;
            y += tuning.JumpVelocity * Frame;
            for (int i = 0; i < 60 && y > 0f; i++)
            {
                y += motor.Step(new MotorInput { SpeedScale = 1f }, Frame).Y;
                peak = MathF.Max(peak, y);
            }
            float apex = tuning.JumpVelocity * tuning.JumpVelocity / (2f * tuning.Gravity);
            Assert.That(peak, Is.EqualTo(apex).Within(0.15f));
        }

        static float Speed(MoveTuning tuning, Vector2 move, bool sprint)
        {
            var motor = new PredictionMotor(tuning);
            var input = new MotorInput { Move = move, Sprint = sprint, SpeedScale = 1f };
            for (int i = 0; i < 30; i++)
                motor.Step(input, Frame);
            return motor.HorizontalVelocity.Length();
        }
    }

    /// <summary>The honest client must never trip the server's checks. Client motor and sim validation run together here.</summary>
    public class PredictionAgreesWithAuthorityTests
    {
        [TestCase(30)]
        [TestCase(60)]
        [TestCase(24)]
        public void SprintingDodgingAndJumpingAreNeverRefused(int fps)
        {
            var (host, context) = LocalSession.Start(new LocalSessionOptions());
            var tuning = context.Content.Move;
            var motor = new PredictionMotor(tuning);
            var sender = new IntentSender();
            var position = Vector3.Zero;
            float dt = 1f / fps;
            var events = new List<SimEvent>();
            float stamina = 60f;

            for (int frame = 0; frame < fps * 12; frame++)
            {
                float t = frame * dt;
                var stick = new Vector2(MathF.Sin(t * 0.7f), MathF.Cos(t * 0.7f));
                bool dodge = frame % (fps * 2) == fps;
                bool jump = frame % (fps * 3) == fps / 2;
                var input = new MotorInput
                {
                    Move = stick,
                    Sprint = (frame / fps) % 2 == 0,
                    DodgePressed = dodge,
                    JumpPressed = jump,
                    KnownStamina = stamina,
                    SpeedScale = 1f
                };
                var delta = motor.Step(input, dt);
                position += delta;
                if (position.Y <= 0f)
                {
                    position.Y = 0f;
                    motor.Grounded = true;
                }
                else
                {
                    motor.Grounded = false;
                }

                sender.Latch(dodge, jump, false, false, false);
                if (sender.Due(dt))
                    context.Endpoint.Send(sender.Compose(stick, input.Sprint, false, motor.Yaw, position, host.ServerTick));
                host.Advance(dt);
                if (host.Latest.TryGet("unmarked", out var me))
                    stamina = me.Stamina;
            }

            context.Endpoint.DrainEvents(events);
            var refused = events.FindAll(e => e.Kind == SimEventKind.MoveRejected);
            Assert.That(refused, Is.Empty, refused.Count > 0 ? refused[0].ToString() : "");
            Assert.That(events.Exists(e => e.Kind == SimEventKind.Dodged), Is.True);
            Assert.That(host.Latest.TryGet("unmarked", out var body), Is.True);
            Assert.That(new Vector2(body.X - position.X, body.Z - position.Z).Length(), Is.LessThan(1.0f));
        }

        [Test]
        public void AFasterMotorIsCaughtAndSnappedBack()
        {
            var (host, context) = LocalSession.Start(new LocalSessionOptions());
            var fast = new MoveTuning { WalkMetresPerSecond = 14f, SprintMetresPerSecond = 14f };
            var motor = new PredictionMotor(fast);
            var sender = new IntentSender();
            var reconciler = new Reconciler();
            var position = Vector3.Zero;
            var events = new List<SimEvent>();
            int snaps = 0;
            for (int frame = 0; frame < 90; frame++)
            {
                position += motor.Step(new MotorInput { Move = new Vector2(0f, 1f), SpeedScale = 1f }, 1f / 30f);
                position.Y = 0f;
                if (sender.Due(1f / 30f))
                {
                    var message = sender.Compose(new Vector2(0f, 1f), false, false, 0f, position, host.ServerTick);
                    reconciler.Record(message.Intent.Seq, position);
                    context.Endpoint.Send(message);
                }
                host.Advance(1f / 30f);
                events.Clear();
                context.Endpoint.DrainEvents(events);
                foreach (var e in events)
                {
                    if (e.Kind != SimEventKind.MoveRejected)
                        continue;
                    var c = reconciler.Refused(position, new Vector3(e.X, e.Y, e.Z));
                    Assert.That(c.Kind, Is.EqualTo(CorrectionKind.Snap));
                    position += c.Offset;
                    motor.Halt();
                    snaps++;
                }
            }
            float allowed = context.Content.Move.SpeedCapMetresPerSecond * 3f + context.Content.Move.SpeedCapMetresPerSecond * context.Content.Move.ClaimBankSeconds + 1f;
            Assert.That(snaps, Is.GreaterThan(0));
            Assert.That(position.Z, Is.LessThan(allowed));
        }
    }

    public class CameraTests
    {
        [Test]
        public void TheCameraNeverEndsInsideTheBody()
        {
            var rig = new OrbitRig();
            var feet = new Vector3(3f, 1f, -2f);
            for (int pitch = -40; pitch <= 75; pitch += 5)
            {
                for (int yaw = 0; yaw < 360; yaw += 30)
                {
                    rig.Pitch = pitch;
                    rig.Yaw = yaw;
                    foreach (float wall in new[] { 0f, 0.05f, 0.2f, 0.5f, 0.9f, 2f, 10f })
                    {
                        var solve = new OrbitRig { Pitch = pitch, Yaw = yaw };
                        var pose = solve.Solve(feet, wall, 0.016f);
                        Assert.That(OrbitRig.InsideCapsule(feet, pose.Position, rig.CapsuleRadius, rig.CapsuleHeight), Is.False, $"pitch {pitch} yaw {yaw} wall {wall}");
                    }
                }
            }
        }

        [Test]
        public void AWallPullsInAtOnceAndReleasesSlowly()
        {
            var rig = new OrbitRig();
            var feet = Vector3.Zero;
            var open = rig.Solve(feet, null, 0.016f);
            Assert.That(open.Distance, Is.EqualTo(rig.DesiredBoomLength).Within(0.001f));
            var blocked = rig.Solve(feet, 1.2f, 0.016f);
            Assert.That(blocked.Distance, Is.EqualTo(1.2f).Within(0.001f));
            var easing = rig.Solve(feet, null, 0.1f);
            Assert.That(easing.Distance, Is.EqualTo(1.2f + rig.EaseOutSpeed * 0.1f).Within(0.001f));
            Assert.That(easing.Distance, Is.LessThan(rig.DesiredBoomLength));
        }

        [Test]
        public void TheBodySitsLeftOfCentreAndPitchIsClamped()
        {
            var rig = new OrbitRig { Yaw = 0f, Pitch = 0f };
            var pose = rig.Solve(Vector3.Zero, null, 0.016f);
            Assert.That(pose.LookAt.X, Is.GreaterThan(0f));
            Assert.That(pose.Position.X, Is.GreaterThan(0f));
            Assert.That(pose.Position.Z, Is.LessThan(-4f));
            rig.ApplyLook(0f, 500f);
            Assert.That(rig.Pitch, Is.EqualTo(rig.Profile.MaxPitch));
            rig.ApplyLook(0f, -500f);
            Assert.That(rig.Pitch, Is.EqualTo(rig.Profile.MinPitch));
            Assert.That(CameraProfiles.Boss.Distance, Is.GreaterThan(CameraProfiles.Explore.Distance));
            Assert.That(CameraProfiles.Indoor.Distance, Is.LessThan(CameraProfiles.Explore.Distance));
            Assert.That(CameraProfiles.Explore.Distance, Is.InRange(4f, 6f));
            Assert.That(CameraProfiles.Explore.Fov, Is.EqualTo(60f));
        }
    }

    public class PerformanceTests
    {
        [Test]
        public void FrameStatsReportMedianAndTail()
        {
            var stats = new FrameStats(100);
            for (int i = 1; i <= 100; i++)
                stats.Add(i);
            Assert.That(stats.Median, Is.EqualTo(50.5f).Within(0.01f));
            Assert.That(stats.P95, Is.EqualTo(95.05f).Within(0.01f));
            Assert.That(stats.Max, Is.EqualTo(100f));
            Assert.That(stats.OverBudgetShare, Is.EqualTo(0.67f).Within(0.001f));
            for (int i = 0; i < 100; i++)
                stats.Add(16.6f);
            Assert.That(stats.Median, Is.EqualTo(16.6f).Within(0.001f));
            Assert.That(stats.Total, Is.EqualTo(200));
        }

        [Test]
        public void TiersHitTheirResolutionsAndLowKeepsNoShadows()
        {
            Assert.That(QualityProfile.Low.RenderScale(1080), Is.EqualTo(720f / 1080f).Within(0.001f));
            Assert.That(QualityProfile.Medium.RenderScale(1080), Is.EqualTo(900f / 1080f).Within(0.001f));
            Assert.That(QualityProfile.High.RenderScale(1080), Is.EqualTo(1f));
            Assert.That(QualityProfile.High.RenderScale(720), Is.EqualTo(1f));
            Assert.That(QualityProfile.Low.ShadowCascades, Is.EqualTo(0));
            Assert.That(QualityProfile.Medium.ShadowCascades, Is.EqualTo(1));
            Assert.That(QualityProfile.High.ShadowCascades, Is.EqualTo(2));
            Assert.That(QualityProfile.Low.DrawDistance, Is.EqualTo(100f));
            Assert.That(QualityProfile.Medium.DrawDistance, Is.EqualTo(160f));
            Assert.That(QualityProfile.Medium.ActiveHostileCap, Is.EqualTo(12));
            Assert.That(QualityProfile.Low.TargetFps, Is.EqualTo(30));
        }

        [Test]
        public void AutoTierFollowsTheDeviceClass()
        {
            Assert.That(QualityChooser.Auto(new DeviceInfo(3800, 1024, 8, true)), Is.EqualTo(QualityTier.Low));
            Assert.That(QualityChooser.Auto(new DeviceInfo(6000, 2048, 8, true)), Is.EqualTo(QualityTier.Medium));
            Assert.That(QualityChooser.Auto(new DeviceInfo(12000, 4096, 8, true)), Is.EqualTo(QualityTier.High));
            Assert.That(QualityChooser.Parse("Low", new DeviceInfo(12000, 4096, 8, true)), Is.EqualTo(QualityTier.Low));
            Assert.That(QualityChooser.Parse("Auto", new DeviceInfo(6000, 2048, 8, true)), Is.EqualTo(QualityTier.Medium));
        }

        [Test]
        public void ASustainedSlowPhoneStepsDownOnceThenWaits()
        {
            var governor = new ThermalGovernor();
            int steps = 0;
            for (int i = 0; i < 400; i++)
            {
                if (governor.Observe(45f, QualityTier.High))
                    steps++;
            }
            Assert.That(steps, Is.EqualTo(1));

            var fine = new ThermalGovernor();
            for (int i = 0; i < 2000; i++)
                Assert.That(fine.Observe(i % 10 == 0 ? 50f : 30f, QualityTier.Medium), Is.False);

            var floor = new ThermalGovernor();
            for (int i = 0; i < 2000; i++)
                Assert.That(floor.Observe(60f, QualityTier.Low), Is.False);
        }

        [Test]
        public void TheSafeAreaKeepsTheNotchOut()
        {
            var a = SafeArea.Anchors(2400, 1080, 132, 0, 2136, 1080);
            Assert.That(a.MinX, Is.EqualTo(0.055f).Within(0.0001f));
            Assert.That(a.MaxX, Is.EqualTo(0.945f).Within(0.0001f));
            Assert.That(a.MinY, Is.EqualTo(0f));
            Assert.That(a.MaxY, Is.EqualTo(1f));
            var bad = SafeArea.Anchors(0, 0, 0, 0, 0, 0);
            Assert.That(bad.MaxX, Is.EqualTo(1f));
        }
    }

    public class ReconcilerTests
    {
        [Test]
        public void SmallGapsAreIgnoredMediumSmoothedLargeSnapped()
        {
            var r = new Reconciler();
            r.Record(1, new Vector3(1f, 0f, 0f));
            r.Record(2, new Vector3(2f, 0f, 0f));
            r.Record(3, new Vector3(3f, 0f, 0f));
            Assert.That(r.Check(1, new Vector3(1.01f, 0f, 0f)).Kind, Is.EqualTo(CorrectionKind.None));
            Assert.That(r.Check(2, new Vector3(2.5f, 0f, 0f)).Kind, Is.EqualTo(CorrectionKind.Smooth));
            Assert.That(r.Check(2, new Vector3(9f, 0f, 0f)).Kind, Is.EqualTo(CorrectionKind.None));
            var snap = r.Check(3, new Vector3(0f, 0f, 0f));
            Assert.That(snap.Kind, Is.EqualTo(CorrectionKind.Snap));
            Assert.That(snap.Offset.X, Is.EqualTo(-3f).Within(0.0001f));
            Assert.That(r.Check(99, Vector3.Zero).Kind, Is.EqualTo(CorrectionKind.None));
        }
    }

    public class ClientCoreStaticsTests
    {
        [Test]
        public void ClientCoreHoldsNoMutableStatics()
        {
            var offenders = new List<string>();
            foreach (var type in typeof(OrbitRig).Assembly.GetTypes())
            {
                if (type.Name.StartsWith("<", StringComparison.Ordinal) || type.IsDefined(typeof(System.Runtime.CompilerServices.CompilerGeneratedAttribute), false))
                    continue;
                foreach (var field in type.GetFields(System.Reflection.BindingFlags.Static | System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.DeclaredOnly))
                {
                    if (field.IsLiteral || field.IsInitOnly || field.IsDefined(typeof(System.Runtime.CompilerServices.CompilerGeneratedAttribute), false))
                        continue;
                    offenders.Add(type.FullName + "." + field.Name);
                }
            }
            Assert.That(offenders, Is.Empty);
        }
    }

    public class SettingsTests
    {
        [Test]
        public void AccessibilitySettingsSurviveAReloadAndAreClamped()
        {
            string path = System.IO.Path.Combine(System.IO.Path.GetTempPath(), "veyr-settings-" + Guid.NewGuid().ToString("n") + ".json");
            try
            {
                var settings = new LocalSettings
                {
                    SprintToggle = true,
                    TextScale = 1.4f,
                    TellWindowScale = 3f,
                    Quality = "Ultra",
                    ControlOffsetX = 40f,
                    Subtitles = true
                };
                settings.Clamp();
                SettingsStore.Write(path, settings);
                var loaded = SettingsStore.Read(path);
                Assert.That(loaded.SprintToggle, Is.True);
                Assert.That(loaded.TextScale, Is.EqualTo(1.4f).Within(0.0001f));
                Assert.That(loaded.TellWindowScale, Is.EqualTo(1.25f));
                Assert.That(loaded.Quality, Is.EqualTo("Auto"));
                Assert.That(loaded.ControlOffsetX, Is.EqualTo(40f));
                Assert.That(loaded.Subtitles, Is.True);
            }
            finally
            {
                foreach (var suffix in new[] { "", ".1", ".2", ".tmp" })
                {
                    if (System.IO.File.Exists(path + suffix))
                        System.IO.File.Delete(path + suffix);
                }
            }
        }
    }
}
