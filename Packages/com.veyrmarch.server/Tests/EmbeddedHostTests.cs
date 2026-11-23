using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Runtime.CompilerServices;
using NUnit.Framework;
using Veyr.Content;
using Veyr.Net;
using Veyr.Server;
using Veyr.Sim;

namespace Veyr.Tests.Server
{
    public class EmbeddedHostTests
    {
        [Test]
        public void OneSecondOfFramesIsTwentyTicks()
        {
            var (host, _) = LocalSession.Start(new LocalSessionOptions());
            for (int i = 0; i < 60; i++)
                host.Advance(1.0 / 60.0);
            Assert.That(host.ServerTick, Is.EqualTo(20));

            var (other, _) = LocalSession.Start(new LocalSessionOptions());
            for (int i = 0; i < 30; i++)
                other.Advance(1.0 / 30.0);
            Assert.That(other.ServerTick, Is.EqualTo(20));
        }

        [Test]
        public void AHitchIsClampedNotReplayed()
        {
            var (host, _) = LocalSession.Start(new LocalSessionOptions());
            int steps = host.Advance(2.0);
            Assert.That(steps, Is.EqualTo(EmbeddedHost.DefaultMaxStepsPerAdvance));
            Assert.That(host.DroppedSeconds, Is.EqualTo(1.75).Within(0.001));
            Assert.That(host.Alpha, Is.LessThan(1f));
        }

        [Test]
        public void BadTimeDoesNothing()
        {
            var (host, _) = LocalSession.Start(new LocalSessionOptions());
            Assert.That(host.Advance(-1), Is.EqualTo(0));
            Assert.That(host.Advance(double.NaN), Is.EqualTo(0));
            Assert.That(host.Advance(double.PositiveInfinity), Is.EqualTo(0));
            Assert.That(host.ServerTick, Is.EqualTo(0));
        }

        [Test]
        public void TwoHostsKeepTheirOwnClocks()
        {
            var (a, _) = LocalSession.Start(new LocalSessionOptions());
            var (b, _) = LocalSession.Start(new LocalSessionOptions());
            a.Advance(1.0);
            Assert.That(a.ServerTick, Is.EqualTo(5));
            Assert.That(b.ServerTick, Is.EqualTo(0));
        }

        [Test]
        public void TheIntentMovesTheLocalBodyOnlyAndTheSequenceComesBack()
        {
            var (host, context) = LocalSession.Start(new LocalSessionOptions { PlayerId = "me" });
            var other = host.Simulation.SpawnPlayer("other", 5f, 0f, 0f);
            for (int seq = 1; seq <= 10; seq++)
            {
                context.Endpoint.Send(new IntentMessage
                {
                    Protocol = Protocol.Version,
                    Intent = new PlayerIntent { Seq = seq, MoveZ = 1f }
                });
                host.Advance(1.0 / SimRates.TicksPerSecond);
            }

            Assert.That(host.Latest.TryGet("me", out var me), Is.True);
            Assert.That(me.Z, Is.EqualTo(4.2f * 10 / SimRates.TicksPerSecond).Within(0.001f));
            Assert.That(me.LastSeq, Is.EqualTo(10));
            Assert.That(other.Z, Is.EqualTo(0f));
        }

        [Test]
        public void AWrongProtocolIsRefused()
        {
            var (host, context) = LocalSession.Start(new LocalSessionOptions());
            context.Endpoint.Send(new IntentMessage { Protocol = Protocol.Version + 1, Intent = new PlayerIntent { MoveZ = 1f } });
            host.Advance(0.05);
            var events = new List<SimEvent>();
            context.Endpoint.DrainEvents(events);
            Assert.That(events.Any(e => e.Kind == SimEventKind.Rejected && e.Arg == "protocol"), Is.True);
            Assert.That(host.Latest.Actors.Single(a => a.Id == "unmarked").Z, Is.EqualTo(0f));
        }

        [Test]
        public void FarBodiesAreLeftOutOfTheSnapshot()
        {
            var (host, _) = LocalSession.Start(new LocalSessionOptions());
            host.Simulation.SpawnActor("mob_wolf", 20f, 0f);
            host.Simulation.SpawnActor("mob_wolf", 140f, 0f);
            host.Advance(0.05);
            Assert.That(host.Latest.Actors.Count(a => a.DefId == "mob_wolf"), Is.EqualTo(1));
            Assert.That(host.Latest.Actors.Any(a => a.Id == "unmarked"), Is.True);
        }

        [Test]
        public void EventsReachTheClientOnce()
        {
            var (host, context) = LocalSession.Start(new LocalSessionOptions());
            context.Endpoint.Send(new IntentMessage { Protocol = Protocol.Version, Intent = new PlayerIntent { Dodge = true } });
            host.Advance(0.05);
            var events = new List<SimEvent>();
            context.Endpoint.DrainEvents(events);
            Assert.That(events.Count(e => e.Kind == SimEventKind.Dodged), Is.EqualTo(1));
            events.Clear();
            host.Advance(0.05);
            context.Endpoint.DrainEvents(events);
            Assert.That(events.Any(e => e.Kind == SimEventKind.Dodged), Is.False);
            Assert.That(host.Latest.TryGet("unmarked", out var me) && (me.Flags & ActorFlags.Dodging) != 0, Is.True);
        }

        [Test]
        public void SharedCodeHoldsNoMutableStatics()
        {
            // No hidden globals (architecture §2.13). A static mutable field would survive a Unity
            // domain reload with Enter Play Mode Options and double a clock or a subscription.
            var assemblies = new[]
            {
                typeof(WorldSimulation).Assembly,
                typeof(ContentCatalog).Assembly,
                typeof(ISimEndpoint).Assembly,
                typeof(EmbeddedHost).Assembly
            };
            var offenders = new List<string>();
            foreach (var assembly in assemblies)
            {
                foreach (var type in assembly.GetTypes())
                {
                    if (type.Name.StartsWith("<", StringComparison.Ordinal) || type.IsDefined(typeof(CompilerGeneratedAttribute), false))
                        continue;
                    foreach (var field in type.GetFields(BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly))
                    {
                        if (field.IsLiteral || field.IsInitOnly || field.IsDefined(typeof(CompilerGeneratedAttribute), false))
                            continue;
                        offenders.Add(type.FullName + "." + field.Name);
                    }
                }
            }
            Assert.That(offenders, Is.Empty);
        }
    }
}
