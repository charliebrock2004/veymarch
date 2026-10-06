#nullable enable
using System;
using System.Collections.Generic;

namespace Veyr.Sim
{
    /// <summary>
    /// A wall the sim enforces whatever the client's physics says. Gates are blockers that open
    /// when their seal is set. Bounds are on the ground plane; blockers are walls from ground to sky.
    /// </summary>
    public sealed class BlockVolume
    {
        public BlockVolume(string id, string gateId, float minX, float minZ, float maxX, float maxZ)
        {
            if (maxX <= minX || maxZ <= minZ)
                throw new ArgumentException("Blocker " + id + " has no area.");
            Id = id;
            GateId = gateId;
            MinX = minX;
            MinZ = minZ;
            MaxX = maxX;
            MaxZ = maxZ;
        }

        public string Id { get; }
        /// <summary>Gate id from <see cref="WorldFlags.GateOpen"/>. Empty means always closed.</summary>
        public string GateId { get; }
        public float MinX { get; }
        public float MinZ { get; }
        public float MaxX { get; }
        public float MaxZ { get; }

        public bool IsClosed(WorldFlags flags) => GateId.Length == 0 || !WorldFlags.GateOpen(flags, GateId);

        public bool Contains(float x, float z) => x >= MinX && x <= MaxX && z >= MinZ && z <= MaxZ;

        /// <summary>Slab test: does the segment from (x0,z0) to (x1,z1) touch the box?</summary>
        public bool Intersects(float x0, float z0, float x1, float z1)
        {
            float t0 = 0f;
            float t1 = 1f;
            return Clip(-(x1 - x0), x0 - MinX, ref t0, ref t1)
                && Clip(x1 - x0, MaxX - x0, ref t0, ref t1)
                && Clip(-(z1 - z0), z0 - MinZ, ref t0, ref t1)
                && Clip(z1 - z0, MaxZ - z0, ref t0, ref t1);
        }

        static bool Clip(float p, float q, ref float t0, ref float t1)
        {
            if (MathF.Abs(p) < 1e-7f)
                return q >= 0f;
            float r = q / p;
            if (p < 0f)
            {
                if (r > t1)
                    return false;
                if (r > t0)
                    t0 = r;
            }
            else
            {
                if (r < t0)
                    return false;
                if (r < t1)
                    t1 = r;
            }
            return true;
        }
    }

    public sealed class WorldGeometry
    {
        readonly List<BlockVolume> _blockers = new List<BlockVolume>();

        public IReadOnlyList<BlockVolume> Blockers => _blockers;

        public BlockVolume AddBlocker(string id, string gateId, float minX, float minZ, float maxX, float maxZ)
        {
            foreach (var existing in _blockers)
            {
                if (existing.Id == id)
                    throw new ArgumentException("Duplicate blocker " + id + ".");
            }
            var volume = new BlockVolume(id, gateId, minX, minZ, maxX, maxZ);
            _blockers.Add(volume);
            return volume;
        }

        /// <summary>
        /// True if moving along the segment would pass into a closed blocker. A body that starts
        /// inside one (spawned there, or the gate shut on it) may always leave.
        /// </summary>
        public bool Blocks(WorldFlags flags, float x0, float z0, float x1, float z1)
        {
            foreach (var volume in _blockers)
            {
                if (!volume.IsClosed(flags))
                    continue;
                if (volume.Contains(x0, z0))
                    continue;
                if (volume.Intersects(x0, z0, x1, z1))
                    return true;
            }
            return false;
        }
    }
}
