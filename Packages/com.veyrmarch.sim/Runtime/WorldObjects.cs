#nullable enable
using System;
using System.Collections.Generic;
using Veyr.Content;

namespace Veyr.Sim
{
    /// <summary>A gather node placed in the world. Authored placement; the def says what it yields.</summary>
    public sealed class NodeInstance
    {
        public NodeInstance(string id, NodeDef def, float x, float y, float z)
        {
            Id = id;
            Def = def;
            X = x;
            Y = y;
            Z = z;
            ChargesLeft = Math.Max(1, def.Charges);
        }

        public string Id { get; }
        public NodeDef Def { get; }
        public float X { get; }
        public float Y { get; }
        public float Z { get; }
        public int ChargesLeft { get; internal set; }
        /// <summary>Tick the node returns. -1 while it still has charges or if it never returns.</summary>
        public long RespawnAtTick { get; internal set; } = -1;
        public bool Spent => ChargesLeft <= 0;
    }

    /// <summary>A crafting station in the world: a bench, a campfire, a forge.</summary>
    public sealed class StationInstance
    {
        public StationInstance(string id, StationId station, float x, float y, float z)
        {
            Id = id;
            Station = station;
            X = x;
            Y = y;
            Z = z;
        }

        public string Id { get; }
        public StationId Station { get; }
        public float X { get; }
        public float Y { get; }
        public float Z { get; }
    }

    public static class Reach
    {
        /// <summary>Ground-plane distance check with a vertical allowance for a step or a ledge.</summary>
        public static bool Within(ActorBody body, float x, float y, float z, float metres = SimRates.InteractReachMetres)
        {
            float dx = x - body.X;
            float dz = z - body.Z;
            float dy = y - body.Y;
            return dx * dx + dz * dz <= metres * metres && MathF.Abs(dy) <= 2.5f;
        }

        /// <summary>
        /// True when <paramref name="attacker"/> stands behind <paramref name="target"/>: more than
        /// <see cref="SimRates.FlankDegrees"/> from the way the target faces. Computed by the sim,
        /// never taken from a client.
        /// </summary>
        public static bool Flank(ActorBody target, ActorBody attacker)
        {
            float dx = attacker.X - target.X;
            float dz = attacker.Z - target.Z;
            float len = MathF.Sqrt(dx * dx + dz * dz);
            if (len < 0.001f)
                return false;
            float rad = target.Yaw * (MathF.PI / 180f);
            float dot = (MathF.Sin(rad) * dx + MathF.Cos(rad) * dz) / len;
            return dot < MathF.Cos(SimRates.FlankDegrees * (MathF.PI / 180f));
        }
    }
}
