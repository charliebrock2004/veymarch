#nullable enable
using System;
using System.Collections.Generic;

namespace Veyr.Sim
{
    /// <summary>
    /// World grid sizes from architecture §10: 64 m object chunks for spawning and relevance,
    /// 128 m terrain tiles. One world space, Y up, 1 unit = 1 metre.
    /// </summary>
    public static class WorldGrid
    {
        public const float ObjectChunkMetres = 64f;
        public const float TerrainTileMetres = 128f;

        public static (int X, int Z) ChunkOf(float x, float z) =>
            ((int)MathF.Floor(x / ObjectChunkMetres), (int)MathF.Floor(z / ObjectChunkMetres));

        public static (int X, int Z) TileOf(float x, float z) =>
            ((int)MathF.Floor(x / TerrainTileMetres), (int)MathF.Floor(z / TerrainTileMetres));
    }

    public readonly struct ScatterPoint
    {
        public ScatterPoint(float x, float z, float a, float b, float c)
        {
            X = x;
            Z = z;
            A = a;
            B = b;
            C = c;
        }

        public float X { get; }
        public float Z { get; }
        /// <summary>Three uniform 0..1 values for size, rotation, and variant. Same seed, same values.</summary>
        public float A { get; }
        public float B { get; }
        public float C { get; }
    }

    /// <summary>
    /// Seeded scatter for dressing (trees, rocks, grass). The world seed drives scatter only;
    /// landmarks, gates, and boss approaches are placed by hand and never come from here
    /// (architecture §10, §12). Jittered grid, so spacing stays inside a readable band.
    /// </summary>
    public static class Scatter
    {
        public static List<ScatterPoint> Grid(ulong seed, float minX, float minZ, float maxX, float maxZ, float spacing, float jitter, Func<float, float, bool>? keep = null)
        {
            if (spacing <= 0f)
                throw new ArgumentOutOfRangeException(nameof(spacing));
            jitter = Math.Clamp(jitter, 0f, spacing * 0.45f);
            var points = new List<ScatterPoint>();
            ulong state = seed == 0 ? 0x9E3779B97F4A7C15UL : seed;
            for (float z = minZ + spacing * 0.5f; z < maxZ; z += spacing)
            {
                for (float x = minX + spacing * 0.5f; x < maxX; x += spacing)
                {
                    float jx = (Next(ref state) * 2f - 1f) * jitter;
                    float jz = (Next(ref state) * 2f - 1f) * jitter;
                    float a = Next(ref state);
                    float b = Next(ref state);
                    float c = Next(ref state);
                    float px = x + jx;
                    float pz = z + jz;
                    if (keep != null && !keep(px, pz))
                        continue;
                    points.Add(new ScatterPoint(px, pz, a, b, c));
                }
            }
            return points;
        }

        static float Next(ref ulong state)
        {
            state ^= state << 13;
            state ^= state >> 7;
            state ^= state << 17;
            return (state >> 40) / (float)(1UL << 24);
        }
    }
}
