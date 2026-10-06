#nullable enable
using System;
using System.Collections.Generic;
using Veyr.Content;
using Veyr.Net;
using Veyr.Sim;

namespace Veyr.Server
{
    /// <summary>
    /// The authority for offline solo play, in the client's process. It is the same simulation a
    /// dedicated server runs: the client reaches it only through <see cref="ISimEndpoint"/>, sends
    /// intents, and reads snapshots and events. Steps at a fixed 20 Hz from real time.
    /// </summary>
    public sealed class EmbeddedHost : ISimEndpoint
    {
        public const int DefaultMaxStepsPerAdvance = 5;
        const int EventCap = 4096;
        static readonly double TickSeconds = 1.0 / SimRates.TicksPerSecond;
        // Frame times summed in floating point land a hair under a whole tick; do not lose that tick.
        const double Epsilon = 1e-9;

        readonly WorldSimulation _sim;
        readonly string _actorId;
        readonly int _maxSteps;
        readonly WorldSnapshot _snapshot = new WorldSnapshot();
        readonly List<SimEvent> _events = new List<SimEvent>(64);
        double _accumulator;

        public EmbeddedHost(WorldSimulation sim, string localActorId, int maxStepsPerAdvance = DefaultMaxStepsPerAdvance)
        {
            if (!sim.Actors.ContainsKey(localActorId))
                throw new ArgumentException("Local actor " + localActorId + " is not in the world.");
            if (maxStepsPerAdvance < 1)
                throw new ArgumentOutOfRangeException(nameof(maxStepsPerAdvance));
            _sim = sim;
            _actorId = localActorId;
            _maxSteps = maxStepsPerAdvance;
            Snapshots.Build(_sim, _actorId, _snapshot);
        }

        /// <summary>Server-side access for server adapters and tests. Client code holds the endpoint, not this.</summary>
        public WorldSimulation Simulation => _sim;
        public string LocalActorId => _actorId;
        public WorldSnapshot Latest => _snapshot;
        public long ServerTick => _snapshot.Tick;
        /// <summary>Real time thrown away because a frame took longer than the step cap allows.</summary>
        public double DroppedSeconds { get; private set; }
        public int StepsTaken { get; private set; }
        /// <summary>How far real time is between the last tick and the next, 0..1. For render interpolation.</summary>
        public float Alpha => (float)Math.Clamp(_accumulator / TickSeconds, 0.0, 1.0);

        /// <summary>
        /// Advances by real time. Runs whole 20 Hz steps; at most <c>maxStepsPerAdvance</c> per call,
        /// so a long hitch drops time instead of spiralling. Returns the steps taken.
        /// </summary>
        public int Advance(double realSeconds)
        {
            if (double.IsNaN(realSeconds) || double.IsInfinity(realSeconds) || realSeconds < 0)
                realSeconds = 0;
            _accumulator += realSeconds;
            int steps = 0;
            while (_accumulator + Epsilon >= TickSeconds && steps < _maxSteps)
            {
                _sim.Step();
                _accumulator -= TickSeconds;
                steps++;
            }

            if (_accumulator + Epsilon >= TickSeconds)
            {
                // The epsilon keeps 1.75 / 0.05 from flooring to 34 and leaving a full tick behind.
                double backlog = Math.Floor(_accumulator / TickSeconds + 1e-9) * TickSeconds;
                DroppedSeconds += backlog;
                _accumulator -= backlog;
            }

            if (steps > 0)
            {
                StepsTaken += steps;
                Snapshots.Build(_sim, _actorId, _snapshot);
            }
            _sim.Events.DrainInto(_events);
            if (_events.Count > EventCap)
                _events.RemoveRange(0, _events.Count - EventCap);
            return steps;
        }

        public void Send(in IntentMessage message)
        {
            if (message.Protocol != Protocol.Version)
            {
                _events.Add(new SimEvent(SimEventKind.Rejected, _sim.Clock.Tick, _actorId, arg: "protocol"));
                return;
            }
            _sim.Submit(_actorId, message.Intent);
        }

        public void DrainEvents(List<SimEvent> into)
        {
            into.AddRange(_events);
            _events.Clear();
        }
    }

    public static class Snapshots
    {
        /// <summary>
        /// Fills <paramref name="into"/> with what <paramref name="viewerId"/> may see: its own body
        /// always, other bodies inside the interest radius. Reuses the list; no per-tick allocation
        /// once the list has grown.
        /// </summary>
        public static void Build(WorldSimulation sim, string viewerId, WorldSnapshot into)
        {
            into.Actors.Clear();
            into.Tick = sim.Clock.Tick;
            into.DayHour = sim.Day.Hour;
            into.Night = sim.Day.IsNight;
            into.LocalActorId = viewerId;
            sim.Actors.TryGetValue(viewerId, out var viewer);
            foreach (var body in sim.Actors.Values)
            {
                if (viewer != null && !ReferenceEquals(body, viewer))
                {
                    float dx = body.X - viewer.X;
                    float dz = body.Z - viewer.Z;
                    if (!Authority.Relevant(MathF.Sqrt(dx * dx + dz * dz)))
                        continue;
                }
                into.Actors.Add(Of(body));
            }
        }

        public static ActorSnapshot Of(ActorBody body)
        {
            var flags = ActorFlags.None;
            if (body.DodgeTicks > 0)
                flags |= ActorFlags.Dodging;
            if (body.Blocking)
                flags |= ActorFlags.Blocking;
            if (body.StaggerTicks > 0)
                flags |= ActorFlags.Staggered;
            if (body.IFrameTicks > 0)
                flags |= ActorFlags.Invulnerable;
            return new ActorSnapshot
            {
                Id = body.Id,
                DefId = body.DefId,
                X = body.X,
                Y = body.Y,
                Z = body.Z,
                Yaw = body.Yaw,
                Health = body.Health,
                MaxHealth = body.MaxHealth,
                Stamina = body.Stamina,
                MaxStamina = body.MaxStamina,
                Life = body.Life,
                Flags = flags,
                LastSeq = body.LastSeq
            };
        }
    }

    public sealed class LocalSessionOptions
    {
        public string WorldId { get; init; } = "local";
        public DeathMode Mode { get; init; } = DeathMode.Adventure;
        public ulong Seed { get; init; } = 1;
        public string PlayerId { get; init; } = "unmarked";
        public float SpawnX { get; init; }
        public float SpawnY { get; init; }
        public float SpawnZ { get; init; }
        public ContentCatalog? Content { get; init; }
    }

    /// <summary>Builds an offline session: world, player body, embedded authority, and the context the client is handed.</summary>
    public static class LocalSession
    {
        public static (EmbeddedHost Host, SessionContext Context) Start(LocalSessionOptions options)
        {
            var content = options.Content ?? ContentCatalog.Slice();
            var sim = new WorldSimulation(options.WorldId, options.Mode, options.Seed, content);
            sim.SpawnPlayer(options.PlayerId, options.SpawnX, options.SpawnY, options.SpawnZ);
            var host = new EmbeddedHost(sim, options.PlayerId);
            var context = new SessionContext(options.WorldId, options.Mode, options.Seed, host, content) { Online = false };
            return (host, context);
        }
    }
}
