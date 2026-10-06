#nullable enable
using System;
using System.Collections.Generic;
using Veyr.Content;
using Veyr.Sim;

namespace Veyr.Net
{
    public static class Protocol
    {
        /// <summary>Bumped when a message layout changes. A mismatched client is refused at join.</summary>
        public const int Version = SimRates.ProtocolVersion;
    }

    /// <summary>
    /// Client to authority, once per tick. The actor is bound to the connection by the server,
    /// never read from the message, so a client cannot speak for another body.
    /// </summary>
    public struct IntentMessage
    {
        public int Protocol;
        /// <summary>Server tick the client last saw. Used for hit rewind, clamped to the buffer.</summary>
        public long ClientTick;
        public PlayerIntent Intent;
    }

    [Flags]
    public enum ActorFlags : byte
    {
        None = 0,
        Dodging = 1,
        Blocking = 2,
        Staggered = 4,
        Invulnerable = 8
    }

    /// <summary>What a client may know about one body at a tick. Replicated, never authored by the client.</summary>
    public struct ActorSnapshot
    {
        public string Id;
        public string DefId;
        public float X;
        public float Y;
        public float Z;
        public float Yaw;
        public float Health;
        public float MaxHealth;
        public float Stamina;
        public float MaxStamina;
        public LifeState Life;
        public ActorFlags Flags;
        /// <summary>Last intent sequence the sim applied for this body. Zero for bodies without a client.</summary>
        public int LastSeq;
    }

    /// <summary>
    /// One tick of world state for one client: bodies inside its interest radius plus world clocks.
    /// The instance is reused between ticks; copy what you keep.
    /// </summary>
    public sealed class WorldSnapshot
    {
        readonly List<ActorSnapshot> _actors = new List<ActorSnapshot>(32);

        public long Tick { get; set; }
        public float DayHour { get; set; }
        public bool Night { get; set; }
        public string LocalActorId { get; set; } = "";
        public List<ActorSnapshot> Actors => _actors;

        public bool TryGet(string actorId, out ActorSnapshot snapshot)
        {
            foreach (var actor in _actors)
            {
                if (actor.Id == actorId)
                {
                    snapshot = actor;
                    return true;
                }
            }
            snapshot = default;
            return false;
        }
    }

    /// <summary>
    /// The only door a client has into the simulation. Offline it is the embedded host in the same
    /// process; online it will be the netcode connection. Client code must not care which.
    /// </summary>
    public interface ISimEndpoint
    {
        string LocalActorId { get; }
        /// <summary>Latest snapshot for this client. Valid until the next advance.</summary>
        WorldSnapshot Latest { get; }
        /// <summary>Server tick of <see cref="Latest"/>.</summary>
        long ServerTick { get; }
        void Send(in IntentMessage message);
        /// <summary>Moves every event addressed to this client into <paramref name="into"/>.</summary>
        void DrainEvents(List<SimEvent> into);
    }

    /// <summary>Host health a debug overlay may show. Implemented by the embedded host; a remote host may not offer it.</summary>
    public interface IHostDiagnostics
    {
        /// <summary>Real time the host threw away because a frame was too long to catch up.</summary>
        double DroppedSeconds { get; }
        int StepsTaken { get; }
    }

    /// <summary>
    /// Everything a running session needs, created by the composition root and handed down.
    /// Not a service locator: nothing looks it up, it is passed in.
    /// </summary>
    public sealed class SessionContext
    {
        public SessionContext(string worldId, DeathMode mode, ulong seed, ISimEndpoint endpoint, ContentCatalog content)
        {
            WorldId = worldId;
            Mode = mode;
            Seed = seed;
            Endpoint = endpoint;
            Content = content;
        }

        public string WorldId { get; }
        public DeathMode Mode { get; }
        public ulong Seed { get; }
        public ISimEndpoint Endpoint { get; }
        /// <summary>Read-only definitions. The client reads tuning from here; it never mutates it.</summary>
        public ContentCatalog Content { get; }
        public bool Online { get; init; }
    }
}
