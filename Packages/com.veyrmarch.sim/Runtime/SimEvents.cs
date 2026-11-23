#nullable enable
using System.Collections.Generic;

namespace Veyr.Sim
{
    public enum SimEventKind
    {
        MoveRejected,
        Dodged,
        Hit,
        Parried,
        Killed,
        Respawned,
        Gathered,
        NodeDepleted,
        NodeRestored,
        Crafted,
        ItemGranted,
        SealSet,
        Rejected
    }

    /// <summary>
    /// Something the sim decided that presentation may react to. Events are facts, not requests:
    /// a view plays a hit flash because the sim said Hit, never the other way round.
    /// </summary>
    public readonly struct SimEvent
    {
        public SimEvent(SimEventKind kind, long tick, string actorId, string targetId = "", string arg = "", float value = 0f, float x = 0f, float y = 0f, float z = 0f)
        {
            Kind = kind;
            Tick = tick;
            ActorId = actorId;
            TargetId = targetId;
            Arg = arg;
            Value = value;
            X = x;
            Y = y;
            Z = z;
        }

        public SimEventKind Kind { get; }
        public long Tick { get; }
        public string ActorId { get; }
        public string TargetId { get; }
        /// <summary>Reason, item id, seal id, or node id depending on the kind.</summary>
        public string Arg { get; }
        public float Value { get; }
        public float X { get; }
        public float Y { get; }
        public float Z { get; }

        public override string ToString() => Kind + " t" + Tick + " " + ActorId + (TargetId.Length > 0 ? "→" + TargetId : "") + (Arg.Length > 0 ? " " + Arg : "");
    }

    /// <summary>Append-only event list. A host drains it after each step so nothing is read twice.</summary>
    public sealed class SimEventLog
    {
        const int Cap = 4096;
        readonly List<SimEvent> _events = new List<SimEvent>(64);

        public int Count => _events.Count;

        public int Dropped { get; private set; }

        public void Add(in SimEvent e)
        {
            if (_events.Count >= Cap)
            {
                // A host that never drains must not grow memory without bound.
                Dropped++;
                return;
            }
            _events.Add(e);
        }

        public void DrainInto(List<SimEvent> into)
        {
            into.AddRange(_events);
            _events.Clear();
        }

        public IReadOnlyList<SimEvent> Peek() => _events;
    }
}
