using UnityEngine;

namespace Veyr.Client
{
    /// <summary>The engine-free core uses System.Numerics; Unity uses its own vectors. Convert at the edge only.</summary>
    public static class NumericsBridge
    {
        public static Vector3 ToUnity(this System.Numerics.Vector3 v) => new Vector3(v.X, v.Y, v.Z);
        public static Vector2 ToUnity(this System.Numerics.Vector2 v) => new Vector2(v.X, v.Y);
        public static System.Numerics.Vector3 ToNumerics(this Vector3 v) => new System.Numerics.Vector3(v.x, v.y, v.z);
        public static System.Numerics.Vector2 ToNumerics(this Vector2 v) => new System.Numerics.Vector2(v.x, v.y);
    }
}
