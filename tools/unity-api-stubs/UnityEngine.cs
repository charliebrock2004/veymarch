// Hand-written declarations of the Unity 6 API surface used by Assets/_Project/Code.
// For the .NET compile check only (sim/UnityStubs). Bodies are empty on purpose.
// This is not Unity and is never shipped. If Unity's real signature differs, Unity wins:
// fix the code and this file together.
#pragma warning disable 1591
using System;
using System.Collections;
using System.Collections.Generic;

namespace UnityEngine
{
    public class Object
    {
        public string name { get; set; }
        public static void Destroy(Object obj) { }
        public static void DestroyImmediate(Object obj) { }
        public static void DontDestroyOnLoad(Object target) { }
        public static T Instantiate<T>(T original) where T : Object => throw null;
        public static T FindAnyObjectByType<T>() where T : Object => throw null;
        public static T[] FindObjectsByType<T>(FindObjectsSortMode sortMode) where T : Object => throw null;
        public static bool operator ==(Object x, Object y) => ReferenceEquals(x, y);
        public static bool operator !=(Object x, Object y) => !ReferenceEquals(x, y);
        public static implicit operator bool(Object exists) => !ReferenceEquals(exists, null);
        public override bool Equals(object other) => ReferenceEquals(this, other);
        public override int GetHashCode() => 0;
    }

    public enum FindObjectsSortMode { None = 0, InstanceID = 1 }

    public class Component : Object
    {
        public GameObject gameObject => throw null;
        public Transform transform => throw null;
        public string tag { get; set; }
        public T GetComponent<T>() => throw null;
        public T GetComponentInChildren<T>(bool includeInactive) => throw null;
        public T[] GetComponentsInChildren<T>(bool includeInactive) => throw null;
        public T GetComponentInParent<T>() => throw null;
    }

    public class Behaviour : Component
    {
        public bool enabled { get; set; }
    }

    public class MonoBehaviour : Behaviour
    {
        public Coroutine StartCoroutine(IEnumerator routine) => throw null;
    }

    public sealed class Coroutine { }

    public class ScriptableObject : Object
    {
        public static T CreateInstance<T>() where T : ScriptableObject => throw null;
    }

    public sealed class GameObject : Object
    {
        public GameObject(string name) { }
        public GameObject(string name, params Type[] components) { }
        public Transform transform => throw null;
        public int layer { get; set; }
        public string tag { get; set; }
        public SceneManagement.Scene scene => throw null;
        public T AddComponent<T>() where T : Component => throw null;
        public T GetComponent<T>() => throw null;
        public T GetComponentInChildren<T>(bool includeInactive) => throw null;
        public void SetActive(bool value) { }
        public static GameObject CreatePrimitive(PrimitiveType type) => throw null;
    }

    public enum PrimitiveType { Sphere = 0, Capsule = 1, Cylinder = 2, Cube = 3, Plane = 4, Quad = 5 }

    public class Transform : Component, IEnumerable
    {
        public Vector3 position { get; set; }
        public Quaternion rotation { get; set; }
        public Vector3 localPosition { get; set; }
        public Vector3 localScale { get; set; }
        public Vector3 eulerAngles { get; set; }
        public void SetParent(Transform parent) { }
        public void SetParent(Transform parent, bool worldPositionStays) { }
        public void SetSiblingIndex(int index) { }
        public IEnumerator GetEnumerator() => throw null;
    }

    public sealed class RectTransform : Transform
    {
        public Vector2 anchorMin { get; set; }
        public Vector2 anchorMax { get; set; }
        public Vector2 pivot { get; set; }
        public Vector2 anchoredPosition { get; set; }
        public Vector2 sizeDelta { get; set; }
        public Vector2 offsetMin { get; set; }
        public Vector2 offsetMax { get; set; }
    }

    public struct Vector2 : IEquatable<Vector2>
    {
        public float x;
        public float y;
        public Vector2(float x, float y) { this.x = x; this.y = y; }
        public static Vector2 zero => default;
        public static Vector2 one => new Vector2(1f, 1f);
        public float magnitude => throw null;
        public float sqrMagnitude => throw null;
        public Vector2 normalized => throw null;
        public static Vector2 ClampMagnitude(Vector2 vector, float maxLength) => throw null;
        public static Vector2 operator +(Vector2 a, Vector2 b) => throw null;
        public static Vector2 operator -(Vector2 a, Vector2 b) => throw null;
        public static Vector2 operator -(Vector2 a) => throw null;
        public static Vector2 operator *(Vector2 a, float d) => throw null;
        public static Vector2 operator *(float d, Vector2 a) => throw null;
        public static Vector2 operator /(Vector2 a, float d) => throw null;
        public static bool operator ==(Vector2 a, Vector2 b) => throw null;
        public static bool operator !=(Vector2 a, Vector2 b) => throw null;
        public bool Equals(Vector2 other) => throw null;
        public override bool Equals(object other) => throw null;
        public override int GetHashCode() => 0;
    }

    public struct Vector2Int
    {
        public Vector2Int(int x, int y) { this.x = x; this.y = y; }
        public int x;
        public int y;
    }

    public struct Vector3 : IEquatable<Vector3>
    {
        public float x;
        public float y;
        public float z;
        public Vector3(float x, float y, float z) { this.x = x; this.y = y; this.z = z; }
        public static Vector3 zero => default;
        public static Vector3 one => new Vector3(1f, 1f, 1f);
        public static Vector3 up => new Vector3(0f, 1f, 0f);
        public float magnitude => throw null;
        public float sqrMagnitude => throw null;
        public Vector3 normalized => throw null;
        public static Vector3 Cross(Vector3 lhs, Vector3 rhs) => throw null;
        public static float Distance(Vector3 a, Vector3 b) => throw null;
        public static Vector3 Scale(Vector3 a, Vector3 b) => throw null;
        public static Vector3 operator +(Vector3 a, Vector3 b) => throw null;
        public static Vector3 operator -(Vector3 a, Vector3 b) => throw null;
        public static Vector3 operator -(Vector3 a) => throw null;
        public static Vector3 operator *(Vector3 a, float d) => throw null;
        public static Vector3 operator *(float d, Vector3 a) => throw null;
        public static Vector3 operator /(Vector3 a, float d) => throw null;
        public static bool operator ==(Vector3 a, Vector3 b) => throw null;
        public static bool operator !=(Vector3 a, Vector3 b) => throw null;
        public bool Equals(Vector3 other) => throw null;
        public override bool Equals(object other) => throw null;
        public override int GetHashCode() => 0;
    }

    public struct Quaternion
    {
        public static Quaternion identity => default;
        public static Quaternion Euler(float x, float y, float z) => throw null;
        public static Quaternion LookRotation(Vector3 forward, Vector3 upwards) => throw null;
        public static Vector3 operator *(Quaternion rotation, Vector3 point) => throw null;
        public static Quaternion operator *(Quaternion lhs, Quaternion rhs) => throw null;
    }

    public struct Color
    {
        public float r;
        public float g;
        public float b;
        public float a;
        public Color(float r, float g, float b, float a) { this.r = r; this.g = g; this.b = b; this.a = a; }
        public Color(float r, float g, float b) { this.r = r; this.g = g; this.b = b; a = 1f; }
    }

    public static class ColorUtility
    {
        public static bool TryParseHtmlString(string htmlString, out Color color) => throw null;
    }

    public struct Rect : IEquatable<Rect>
    {
        public float x { get; set; }
        public float y { get; set; }
        public float width { get; set; }
        public float height { get; set; }
        public static bool operator ==(Rect lhs, Rect rhs) => throw null;
        public static bool operator !=(Rect lhs, Rect rhs) => throw null;
        public bool Equals(Rect other) => throw null;
        public override bool Equals(object other) => throw null;
        public override int GetHashCode() => 0;
    }

    public static class Mathf
    {
        public const float PI = 3.14159274f;
        public const float Deg2Rad = PI / 180f;
        public static float Sin(float f) => throw null;
        public static float Cos(float f) => throw null;
        public static float Sqrt(float f) => throw null;
        public static float Abs(float f) => throw null;
        public static float Min(float a, float b) => throw null;
        public static int Min(int a, int b) => throw null;
        public static float Max(float a, float b) => throw null;
        public static int Max(int a, int b) => throw null;
        public static float Clamp(float value, float min, float max) => throw null;
        public static float Clamp01(float value) => throw null;
        public static float Lerp(float a, float b, float t) => throw null;
        public static int RoundToInt(float f) => throw null;
    }

    public static class Time
    {
        public static float deltaTime => throw null;
        public static float unscaledDeltaTime => throw null;
        public static double unscaledTimeAsDouble => throw null;
        public static float realtimeSinceStartup => throw null;
    }

    public static class Screen
    {
        public static int width => throw null;
        public static int height => throw null;
        public static Rect safeArea => throw null;
    }

    public static class Application
    {
        public static string persistentDataPath => throw null;
        public static bool isEditor => throw null;
        public static bool isMobilePlatform => throw null;
        public static bool isBatchMode => throw null;
        public static int targetFrameRate { get; set; }
        public static string version => throw null;
        public static string unityVersion => throw null;
    }

    public static class Debug
    {
        public static void Log(object message) { }
        public static void LogWarning(object message) { }
        public static void LogError(object message) { }
        public static void LogException(Exception exception) { }
    }

    public static class SystemInfo
    {
        public static int systemMemorySize => throw null;
        public static int graphicsMemorySize => throw null;
        public static int processorCount => throw null;
        public static string deviceModel => throw null;
        public static string operatingSystem => throw null;
        public static string graphicsDeviceName => throw null;
        public static Rendering.GraphicsDeviceType graphicsDeviceType => throw null;
        public static float batteryLevel => throw null;
    }

    public sealed class QualitySettings
    {
        public static Rendering.RenderPipelineAsset renderPipeline { get; set; }
        public static int vSyncCount { get; set; }
    }

    public struct FrameTiming
    {
        public double cpuFrameTime;
        public double gpuFrameTime;
    }

    public static class FrameTimingManager
    {
        public static void CaptureFrameTimings() { }
        public static uint GetLatestTimings(uint numFrames, FrameTiming[] timings) => throw null;
    }

    public enum CameraClearFlags { Skybox = 1, SolidColor = 2, Depth = 3, Nothing = 4 }

    public sealed class Camera : Behaviour
    {
        public float fieldOfView { get; set; }
        public float nearClipPlane { get; set; }
        public float farClipPlane { get; set; }
        public CameraClearFlags clearFlags { get; set; }
        public Color backgroundColor { get; set; }
        public int cullingMask { get; set; }
        public float[] layerCullDistances { get; set; }
        public bool layerCullSpherical { get; set; }
    }

    public sealed class AudioListener : Behaviour { }

    public enum LightType { Spot = 0, Directional = 1, Point = 2 }
    public enum LightShadows { None = 0, Hard = 1, Soft = 2 }

    public sealed class Light : Behaviour
    {
        public LightType type { get; set; }
        public Color color { get; set; }
        public float intensity { get; set; }
        public LightShadows shadows { get; set; }
    }

    public enum FogMode { Linear = 1, Exponential = 2, ExponentialSquared = 3 }

    public sealed class RenderSettings : Object
    {
        public static Light sun { get; set; }
        public static Rendering.AmbientMode ambientMode { get; set; }
        public static Color ambientSkyColor { get; set; }
        public static Color ambientEquatorColor { get; set; }
        public static Color ambientGroundColor { get; set; }
        public static bool fog { get; set; }
        public static FogMode fogMode { get; set; }
        public static float fogDensity { get; set; }
        public static Color fogColor { get; set; }
        public static Material skybox { get; set; }
    }

    public class Material : Object
    {
        public Material(Shader shader) { }
        public Shader shader { get; set; }
        public bool enableGPUInstancing { get; set; }
        public bool HasProperty(string name) => throw null;
        public void SetColor(string name, Color value) { }
        public void SetFloat(string name, float value) { }
    }

    public sealed class Shader : Object
    {
        public static Shader Find(string name) => throw null;
    }

    public sealed class Mesh : Object
    {
        public Rendering.IndexFormat indexFormat { get; set; }
        public void SetVertices(List<Vector3> inVertices) { }
        public void SetNormals(List<Vector3> inNormals) { }
        public void SetTriangles(List<int> triangles, int submesh) { }
        public void RecalculateBounds() { }
    }

    public sealed class MeshFilter : Component
    {
        public Mesh sharedMesh { get; set; }
    }

    public class Renderer : Component
    {
        public bool enabled { get; set; }
        public Material sharedMaterial { get; set; }
        public Rendering.ShadowCastingMode shadowCastingMode { get; set; }
    }

    public sealed class MeshRenderer : Renderer { }

    public class Collider : Component
    {
        public bool enabled { get; set; }
    }

    public sealed class MeshCollider : Collider
    {
        public Mesh sharedMesh { get; set; }
    }

    public sealed class BoxCollider : Collider
    {
        public Vector3 size { get; set; }
    }

    public sealed class CapsuleCollider : Collider
    {
        public float radius { get; set; }
        public float height { get; set; }
        public Vector3 center { get; set; }
    }

    [Flags]
    public enum CollisionFlags { None = 0, Sides = 1, Above = 2, Below = 4 }

    public class CharacterController : Collider
    {
        public float height { get; set; }
        public float radius { get; set; }
        public Vector3 center { get; set; }
        public float stepOffset { get; set; }
        public float slopeLimit { get; set; }
        public float skinWidth { get; set; }
        public float minMoveDistance { get; set; }
        public bool isGrounded => throw null;
        public CollisionFlags Move(Vector3 motion) => throw null;
    }

    public enum QueryTriggerInteraction { UseGlobal = 0, Ignore = 1, Collide = 2 }

    public struct RaycastHit
    {
        public Collider collider => throw null;
        public float distance { get; set; }
    }

    public class Physics
    {
        public static int SphereCastNonAlloc(Vector3 origin, float radius, Vector3 direction, RaycastHit[] results, float maxDistance, int layerMask, QueryTriggerInteraction queryTriggerInteraction) => throw null;
    }

    public struct LayerMask
    {
        public int value { get; set; }
        public static implicit operator int(LayerMask mask) => mask.value;
        public static implicit operator LayerMask(int intVal) => new LayerMask { value = intVal };
        public static int NameToLayer(string layerName) => throw null;
    }

    public static class Resources
    {
        public static T GetBuiltinResource<T>(string path) where T : Object => throw null;
    }

    public sealed class Font : Object { }

    public sealed class Sprite : Object { }

    public enum ColorSpace { Uninitialized = -1, Gamma = 0, Linear = 1 }

    public enum RenderMode { ScreenSpaceOverlay = 0, ScreenSpaceCamera = 1, WorldSpace = 2 }

    public sealed class Canvas : Behaviour
    {
        public RenderMode renderMode { get; set; }
        public int sortingOrder { get; set; }
        public float scaleFactor { get; set; }
    }

    public enum TextAnchor { UpperLeft = 0, UpperCenter = 1, UpperRight = 2, MiddleLeft = 3, MiddleCenter = 4, MiddleRight = 5, LowerLeft = 6, LowerCenter = 7, LowerRight = 8 }
    public enum HorizontalWrapMode { Wrap = 0, Overflow = 1 }
    public enum VerticalWrapMode { Truncate = 0, Overflow = 1 }

    public class YieldInstruction { }

    public abstract class CustomYieldInstruction : IEnumerator
    {
        public abstract bool keepWaiting { get; }
        public object Current => null;
        public bool MoveNext() => keepWaiting;
        public void Reset() { }
    }

    public class WaitForSecondsRealtime : CustomYieldInstruction
    {
        public WaitForSecondsRealtime(float time) { }
        public override bool keepWaiting => false;
    }

    public class AsyncOperation : YieldInstruction
    {
        public bool isDone => throw null;
    }

    [AttributeUsage(AttributeTargets.Field)]
    public sealed class SerializeField : Attribute { }

    [AttributeUsage(AttributeTargets.Field)]
    public class TooltipAttribute : Attribute
    {
        public TooltipAttribute(string tooltip) { }
    }

    [AttributeUsage(AttributeTargets.Class)]
    public class DefaultExecutionOrder : Attribute
    {
        public DefaultExecutionOrder(int order) { }
    }

    [AttributeUsage(AttributeTargets.Class, AllowMultiple = true)]
    public sealed class RequireComponent : Attribute
    {
        public RequireComponent(Type requiredComponent) { }
    }

    [AttributeUsage(AttributeTargets.Class)]
    public sealed class CreateAssetMenuAttribute : Attribute
    {
        public string menuName { get; set; }
        public string fileName { get; set; }
        public int order { get; set; }
    }
}

namespace UnityEngine.Profiling
{
    public sealed class Profiler
    {
        public static long GetTotalReservedMemoryLong() => throw null;
        public static long GetTotalAllocatedMemoryLong() => throw null;
    }
}

namespace UnityEngine.SceneManagement
{
    public enum LoadSceneMode { Single = 0, Additive = 1 }

    public struct Scene
    {
        public string name => throw null;
        public string path => throw null;
        public GameObject[] GetRootGameObjects() => throw null;
    }

    public class SceneManager
    {
        public static AsyncOperation LoadSceneAsync(string sceneName, LoadSceneMode mode) => throw null;
        public static void LoadScene(string sceneName, LoadSceneMode mode) { }
        public static Scene GetSceneByName(string name) => throw null;
        public static Scene GetActiveScene() => throw null;
    }
}

namespace UnityEngine.Rendering
{
    public abstract class RenderPipelineAsset : ScriptableObject { }

    public sealed class GraphicsSettings : Object
    {
        public static RenderPipelineAsset defaultRenderPipeline { get; set; }
    }

    public enum AmbientMode { Skybox = 0, Trilight = 1, Flat = 3, Custom = 4 }
    public enum IndexFormat { UInt16 = 0, UInt32 = 1 }
    public enum ShadowCastingMode { Off = 0, On = 1, TwoSided = 2, ShadowsOnly = 3 }
    public enum GraphicsDeviceType { OpenGLES3 = 11, Metal = 16, Vulkan = 21, Direct3D11 = 2, Direct3D12 = 18 }
}

namespace UnityEngine.Rendering.Universal
{
    public abstract class ScriptableRendererData : ScriptableObject { }

    public class UniversalRendererData : ScriptableRendererData { }

    public class UniversalRenderPipelineAsset : RenderPipelineAsset
    {
        public float renderScale { get; set; }
        public static UniversalRenderPipelineAsset Create(ScriptableRendererData rendererData = null) => throw null;
    }
}

namespace UnityEngine.TestTools
{
    [AttributeUsage(AttributeTargets.Method)]
    public class UnityTestAttribute : Attribute { }

    [AttributeUsage(AttributeTargets.Method)]
    public class UnitySetUpAttribute : Attribute { }
}
