using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

namespace Veyr.EditorTools
{
    /// <summary>
    /// Low-poly faceted blockout geometry, built in the editor and saved as mesh assets. Many
    /// trees are combined into one mesh per 64 m chunk so the blockout costs a handful of draw
    /// calls instead of thousands. Blockout only: production trees replace this with LODs and cards.
    /// </summary>
    public sealed class MeshKit
    {
        readonly List<Vector3> _vertices = new List<Vector3>();
        readonly List<Vector3> _normals = new List<Vector3>();
        readonly List<int> _triangles = new List<int>();

        public int VertexCount => _vertices.Count;
        public int TriangleCount => _triangles.Count / 3;

        public void Clear()
        {
            _vertices.Clear();
            _normals.Clear();
            _triangles.Clear();
        }

        void Face(Vector3 a, Vector3 b, Vector3 c)
        {
            Vector3 n = Vector3.Cross(b - a, c - a).normalized;
            int i = _vertices.Count;
            _vertices.Add(a);
            _vertices.Add(b);
            _vertices.Add(c);
            _normals.Add(n);
            _normals.Add(n);
            _normals.Add(n);
            _triangles.Add(i);
            _triangles.Add(i + 1);
            _triangles.Add(i + 2);
        }

        /// <summary>Tapered faceted prism standing on <paramref name="foot"/>: a trunk, a pillar, a tower.</summary>
        public void Prism(Vector3 foot, float radius, float height, int sides, float topScale, float twistDegrees = 0f)
        {
            sides = Mathf.Max(3, sides);
            float top = radius * topScale;
            Vector3 up = foot + Vector3.up * height;
            for (int i = 0; i < sides; i++)
            {
                float a0 = (i / (float)sides) * Mathf.PI * 2f + twistDegrees * Mathf.Deg2Rad;
                float a1 = ((i + 1) / (float)sides) * Mathf.PI * 2f + twistDegrees * Mathf.Deg2Rad;
                Vector3 d0 = new Vector3(Mathf.Cos(a0), 0f, Mathf.Sin(a0));
                Vector3 d1 = new Vector3(Mathf.Cos(a1), 0f, Mathf.Sin(a1));
                Vector3 b0 = foot + d0 * radius;
                Vector3 b1 = foot + d1 * radius;
                Vector3 t0 = up + d0 * top;
                Vector3 t1 = up + d1 * top;
                Face(b0, t1, b1);
                Face(b0, t0, t1);
                Face(up, t1, t0);
            }
        }

        /// <summary>Faceted icosphere: subdivision 1 is 80 faces, enough for a canopy blob at a distance.</summary>
        public void Blob(Vector3 centre, Vector3 scale, int subdivisions, Quaternion rotation)
        {
            var verts = new List<Vector3>();
            var faces = new List<int[]>();
            Icosahedron(verts, faces);
            for (int s = 0; s < subdivisions; s++)
                Subdivide(verts, faces);
            foreach (var f in faces)
            {
                Vector3 a = centre + rotation * Vector3.Scale(verts[f[0]], scale);
                Vector3 b = centre + rotation * Vector3.Scale(verts[f[1]], scale);
                Vector3 c = centre + rotation * Vector3.Scale(verts[f[2]], scale);
                Face(a, b, c);
            }
        }

        /// <summary>An oriented box. For walls, ramps, steps, banners.</summary>
        public void Box(Vector3 centre, Vector3 size, Quaternion rotation)
        {
            Vector3 h = size * 0.5f;
            Vector3[] c =
            {
                new Vector3(-h.x, -h.y, -h.z), new Vector3(h.x, -h.y, -h.z), new Vector3(h.x, h.y, -h.z), new Vector3(-h.x, h.y, -h.z),
                new Vector3(-h.x, -h.y, h.z), new Vector3(h.x, -h.y, h.z), new Vector3(h.x, h.y, h.z), new Vector3(-h.x, h.y, h.z)
            };
            for (int i = 0; i < c.Length; i++)
                c[i] = centre + rotation * c[i];
            Quad(c[0], c[3], c[2], c[1]);
            Quad(c[5], c[6], c[7], c[4]);
            Quad(c[4], c[7], c[3], c[0]);
            Quad(c[1], c[2], c[6], c[5]);
            Quad(c[3], c[7], c[6], c[2]);
            Quad(c[4], c[0], c[1], c[5]);
        }

        void Quad(Vector3 a, Vector3 b, Vector3 c, Vector3 d)
        {
            Face(a, b, c);
            Face(a, c, d);
        }

        public Mesh ToMesh(string name)
        {
            var mesh = new Mesh { name = name };
            mesh.indexFormat = _vertices.Count > 65000 ? IndexFormat.UInt32 : IndexFormat.UInt16;
            mesh.SetVertices(_vertices);
            mesh.SetNormals(_normals);
            mesh.SetTriangles(_triangles, 0);
            mesh.RecalculateBounds();
            return mesh;
        }

        static void Icosahedron(List<Vector3> v, List<int[]> f)
        {
            float t = (1f + Mathf.Sqrt(5f)) / 2f;
            Vector3[] p =
            {
                new Vector3(-1, t, 0), new Vector3(1, t, 0), new Vector3(-1, -t, 0), new Vector3(1, -t, 0),
                new Vector3(0, -1, t), new Vector3(0, 1, t), new Vector3(0, -1, -t), new Vector3(0, 1, -t),
                new Vector3(t, 0, -1), new Vector3(t, 0, 1), new Vector3(-t, 0, -1), new Vector3(-t, 0, 1)
            };
            foreach (var x in p)
                v.Add(x.normalized);
            int[,] idx =
            {
                { 0, 11, 5 }, { 0, 5, 1 }, { 0, 1, 7 }, { 0, 7, 10 }, { 0, 10, 11 },
                { 1, 5, 9 }, { 5, 11, 4 }, { 11, 10, 2 }, { 10, 7, 6 }, { 7, 1, 8 },
                { 3, 9, 4 }, { 3, 4, 2 }, { 3, 2, 6 }, { 3, 6, 8 }, { 3, 8, 9 },
                { 4, 9, 5 }, { 2, 4, 11 }, { 6, 2, 10 }, { 8, 6, 7 }, { 9, 8, 1 }
            };
            for (int i = 0; i < idx.GetLength(0); i++)
                f.Add(new[] { idx[i, 0], idx[i, 1], idx[i, 2] });
        }

        static void Subdivide(List<Vector3> v, List<int[]> f)
        {
            var cache = new Dictionary<long, int>();
            int Mid(int a, int b)
            {
                long key = a < b ? ((long)a << 32) | (uint)b : ((long)b << 32) | (uint)a;
                if (cache.TryGetValue(key, out int m))
                    return m;
                v.Add(((v[a] + v[b]) * 0.5f).normalized);
                cache[key] = v.Count - 1;
                return v.Count - 1;
            }

            var next = new List<int[]>(f.Count * 4);
            foreach (var t in f)
            {
                int a = Mid(t[0], t[1]);
                int b = Mid(t[1], t[2]);
                int c = Mid(t[2], t[0]);
                next.Add(new[] { t[0], a, c });
                next.Add(new[] { t[1], b, a });
                next.Add(new[] { t[2], c, b });
                next.Add(new[] { a, b, c });
            }
            f.Clear();
            f.AddRange(next);
        }
    }
}
