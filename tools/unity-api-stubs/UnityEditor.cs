// Hand-written declarations of the UnityEditor API used by Assets/_Project/Code/Editor.
// Compile check only. Not Unity. Never shipped.
#pragma warning disable 1591
using System;
using UnityEngine;

namespace UnityEditor
{
    [AttributeUsage(AttributeTargets.Method, AllowMultiple = true)]
    public sealed class MenuItem : Attribute
    {
        public string menuItem;
        public bool validate;
        public int priority;
        public MenuItem(string itemName) { }
        public MenuItem(string itemName, bool isValidateFunction) { }
        public MenuItem(string itemName, bool isValidateFunction, int priority) { }
    }

    public sealed class AssetDatabase
    {
        public static bool IsValidFolder(string path) => throw null;
        public static string CreateFolder(string parentFolder, string newFolderName) => throw null;
        public static void CreateAsset(UnityEngine.Object asset, string path) { }
        public static T LoadAssetAtPath<T>(string assetPath) where T : UnityEngine.Object => throw null;
        public static UnityEngine.Object[] LoadAllAssetsAtPath(string assetPath) => throw null;
        public static void SaveAssets() { }
        public static bool DeleteAsset(string path) => throw null;
        public static T GetBuiltinExtraResource<T>(string path) where T : UnityEngine.Object => throw null;
    }

    public sealed class EditorUtility
    {
        public static void SetDirty(UnityEngine.Object target) { }
    }

    public sealed class EditorApplication
    {
        public static void Exit(int returnValue) { }
    }

    public class SerializedObject : IDisposable
    {
        public SerializedObject(UnityEngine.Object obj) { }
        public SerializedProperty FindProperty(string propertyPath) => throw null;
        public bool ApplyModifiedPropertiesWithoutUndo() => throw null;
        public void Dispose() { }
    }

    public class SerializedProperty
    {
        public int intValue { get; set; }
        public float floatValue { get; set; }
        public bool boolValue { get; set; }
        public string stringValue { get; set; }
        public int arraySize { get; set; }
        public SerializedProperty GetArrayElementAtIndex(int index) => throw null;
    }

    public class EditorBuildSettingsScene
    {
        public EditorBuildSettingsScene(string path, bool enabled) { }
        public string path { get; set; }
        public bool enabled { get; set; }
    }

    public class EditorBuildSettings : UnityEngine.Object
    {
        public static EditorBuildSettingsScene[] scenes { get; set; }
    }

    public enum UIOrientation { Portrait = 0, PortraitUpsideDown = 1, LandscapeRight = 2, LandscapeLeft = 3, AutoRotation = 4 }
    public enum ScriptingImplementation { Mono2x = 0, IL2CPP = 1 }

    [Flags]
    public enum AndroidArchitecture : uint { None = 0, ARMv7 = 1, ARM64 = 2, X86_64 = 8, All = 0xffffffff }

    public enum BuildTarget { StandaloneWindows64 = 19, iOS = 9, Android = 13, StandaloneLinux64 = 24 }

    [Flags]
    public enum BuildOptions { None = 0, Development = 1 }

    public struct BuildPlayerOptions
    {
        public string[] scenes { get; set; }
        public string locationPathName { get; set; }
        public BuildTarget target { get; set; }
        public BuildOptions options { get; set; }
    }

    public class BuildPipeline
    {
        public static Build.Reporting.BuildReport BuildPlayer(BuildPlayerOptions buildPlayerOptions) => throw null;
    }

    public sealed class PlayerSettings : UnityEngine.Object
    {
        public static string companyName { get; set; }
        public static string productName { get; set; }
        public static UIOrientation defaultInterfaceOrientation { get; set; }
        public static bool allowedAutorotateToLandscapeLeft { get; set; }
        public static bool allowedAutorotateToLandscapeRight { get; set; }
        public static bool allowedAutorotateToPortrait { get; set; }
        public static bool allowedAutorotateToPortraitUpsideDown { get; set; }
        public static ColorSpace colorSpace { get; set; }
        public static bool enableFrameTimingStats { get; set; }
        public static bool runInBackground { get; set; }
        public static void SetApplicationIdentifier(Build.NamedBuildTarget buildTarget, string identifier) { }
        public static void SetScriptingBackend(Build.NamedBuildTarget buildTarget, ScriptingImplementation backend) { }
        public static ScriptingImplementation GetScriptingBackend(Build.NamedBuildTarget buildTarget) => throw null;
        public static void SetUseDefaultGraphicsAPIs(BuildTarget platform, bool automatic) { }
        public static void SetGraphicsAPIs(BuildTarget platform, UnityEngine.Rendering.GraphicsDeviceType[] apis) { }

        public sealed class Android
        {
            public static AndroidArchitecture targetArchitectures { get; set; }
        }

        public sealed class iOS
        {
            public static string targetOSVersionString { get; set; }
        }
    }

    public enum InteractionMode { AutomatedAction = 0, UserAction = 1 }

    public sealed class PrefabUtility
    {
        public static GameObject SaveAsPrefabAssetAndConnect(GameObject instanceRoot, string assetPath, InteractionMode action) => throw null;
    }

    [Flags]
    public enum StaticEditorFlags
    {
        ContributeGI = 1,
        OccluderStatic = 2,
        BatchingStatic = 4,
        NavigationStatic = 8,
        OccludeeStatic = 16,
        OffMeshLinkGeneration = 32,
        ReflectionProbeStatic = 64
    }

    public sealed class GameObjectUtility
    {
        public static void SetStaticEditorFlags(GameObject go, StaticEditorFlags flags) { }
    }
}

namespace UnityEditor.Build
{
    public readonly struct NamedBuildTarget
    {
        public static readonly NamedBuildTarget Android = default;
        public static readonly NamedBuildTarget iOS = default;
        public static readonly NamedBuildTarget Standalone = default;
    }
}

namespace UnityEditor.Build.Reporting
{
    public enum BuildResult { Unknown = 0, Succeeded = 1, Failed = 2, Cancelled = 3 }

    public struct BuildSummary
    {
        public BuildResult result => throw null;
        public ulong totalSize => throw null;
        public TimeSpan totalTime => throw null;
    }

    public sealed class BuildReport : UnityEngine.Object
    {
        public BuildSummary summary => throw null;
    }
}

namespace UnityEditor.SceneManagement
{
    public enum NewSceneSetup { EmptyScene = 0, DefaultGameObjects = 1 }
    public enum NewSceneMode { Single = 0, Additive = 1 }

    public sealed class EditorSceneManager
    {
        public static UnityEngine.SceneManagement.Scene NewScene(NewSceneSetup setup, NewSceneMode mode) => throw null;
        public static bool SaveScene(UnityEngine.SceneManagement.Scene scene, string dstScenePath) => throw null;
    }
}
