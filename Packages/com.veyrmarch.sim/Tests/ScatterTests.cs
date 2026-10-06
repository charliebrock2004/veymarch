using System;
using System.Linq;
using NUnit.Framework;
using Veyr.Sim;

namespace Veyr.Tests.Sim
{
    public class ScatterTests
    {
        [Test]
        public void TheSameSeedScattersTheSameForest()
        {
            var a = Scatter.Grid(7, -64f, -64f, 64f, 64f, 8f, 2.5f);
            var b = Scatter.Grid(7, -64f, -64f, 64f, 64f, 8f, 2.5f);
            var c = Scatter.Grid(8, -64f, -64f, 64f, 64f, 8f, 2.5f);
            Assert.That(a.Count, Is.EqualTo(256));
            Assert.That(a.Select(p => (p.X, p.Z, p.A)), Is.EqualTo(b.Select(p => (p.X, p.Z, p.A))));
            Assert.That(a.Select(p => p.X), Is.Not.EqualTo(c.Select(p => p.X)));
            Assert.That(a.All(p => p.A >= 0f && p.A < 1f && p.B >= 0f && p.C < 1f), Is.True);
        }

        [Test]
        public void TrunksStayInsideTheReadableSpacingBand()
        {
            // Art bible §33: trunks every 6–10 m, not a wall. Jitter keeps neighbours apart.
            var trees = Scatter.Grid(3, -50f, -50f, 50f, 50f, 8f, 2f);
            float nearest = float.MaxValue;
            for (int i = 0; i < trees.Count; i++)
            {
                for (int j = 0; j < trees.Count; j++)
                {
                    if (i == j)
                        continue;
                    var t = trees[i];
                    var u = trees[j];
                    nearest = MathF.Min(nearest, MathF.Sqrt((t.X - u.X) * (t.X - u.X) + (t.Z - u.Z) * (t.Z - u.Z)));
                }
            }
            Assert.That(nearest, Is.GreaterThanOrEqualTo(8f - 2f * 2f * MathF.Sqrt(2f)));
        }

        [Test]
        public void AClearingIsKeptClear()
        {
            var trees = Scatter.Grid(11, -60f, -60f, 60f, 60f, 7f, 2.5f, (x, z) => x * x + z * z > 16f * 16f);
            Assert.That(trees.Any(t => t.X * t.X + t.Z * t.Z <= 16f * 16f), Is.False);
            Assert.That(trees.Count, Is.GreaterThan(200));
        }

        [Test]
        public void ChunksAre64MetresAndTilesAre128()
        {
            Assert.That(WorldGrid.ChunkOf(0f, 0f), Is.EqualTo((0, 0)));
            Assert.That(WorldGrid.ChunkOf(63.9f, -0.1f), Is.EqualTo((0, -1)));
            Assert.That(WorldGrid.ChunkOf(64f, 128f), Is.EqualTo((1, 2)));
            Assert.That(WorldGrid.TileOf(127f, -129f), Is.EqualTo((0, -2)));
        }
    }
}
