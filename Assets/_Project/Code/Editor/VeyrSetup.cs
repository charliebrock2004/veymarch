using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.Build;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.Rendering;
using Veyr.Client.Platform;

namespace Veyr.EditorTools
{
    /// <summary>
    /// One entry point for a fresh checkout: configure the player, create the quality tiers, build
    /// the dev scenes, then validate. Menu: Veyrmarch > Setup. Command line:
    /// <c>Unity -batchmode -projectPath . -executeMethod Veyr.EditorTools.VeyrSetup.BatchSetup -quit</c>
    /// </summary>
    public static class VeyrSetup
    {
        [MenuItem("Veyrmarch/Setup/Run All Setup Steps", priority = 0)]
        public static void RunAllMenu()
        {
            var report = RunAll();
            Debug.Log(string.Join("\n", report));
        }

        [MenuItem("Veyrmarch/Setup/1 Configure Player Settings", priority = 20)]
        public static void ConfigureMenu() => Debug.Log(string.Join("\n", ProjectSetup.ConfigurePlayer()));

        [MenuItem("Veyrmarch/Setup/2 Create Quality Tiers", priority = 21)]
        public static void TiersMenu() => RenderingSetup.CreateTiers();

        [MenuItem("Veyrmarch/Setup/3 Build Dev Scenes", priority = 22)]
        public static void ScenesMenu()
        {
            var set = AssetDatabase.LoadAssetAtPath<QualityAssetSet>(RenderingSetup.SetPath);
            if (set == null)
                set = RenderingSetup.CreateTiers();
            Debug.Log("Veyr scenes built. " + SceneBuilder.BuildAll(set));
        }

        [MenuItem("Veyrmarch/Validate Project", priority = 40)]
        public static void ValidateMenu()
        {
            var problems = ProjectValidator.Run();
            if (problems.Count == 0)
                Debug.Log("Veyr validation: clean.");
            else
                Debug.LogError("Veyr validation found " + problems.Count + " problem(s):\n" + string.Join("\n", problems));
        }

        public static List<string> RunAll()
        {
            var report = new List<string>();
            report.AddRange(ProjectSetup.ConfigurePlayer());
            var set = RenderingSetup.CreateTiers();
            report.Add("Quality tiers: Low, Medium, High URP assets at " + RenderingSetup.Folder + ".");
            report.Add(SceneBuilder.BuildAll(set));
            report.Add("Scenes: " + SceneBuilder.BootPath + ", " + SceneBuilder.DevMovePath + ", " + SceneBuilder.ForestPath + ". Build list set.");
            var problems = ProjectValidator.Run();
            report.Add(problems.Count == 0 ? "Validation: clean." : "Validation: " + string.Join("; ", problems));
            return report;
        }

        /// <summary>Batch-mode entry. Exits 0 when setup and validation pass, 1 when validation fails, 2 on an exception.</summary>
        public static void BatchSetup()
        {
            try
            {
                var report = RunAll();
                foreach (var line in report)
                    Debug.Log("[veyr] " + line);
                EditorApplication.Exit(ProjectValidator.Run().Count == 0 ? 0 : 1);
            }
            catch (Exception e)
            {
                Debug.LogException(e);
                EditorApplication.Exit(2);
            }
        }

        /// <summary>Batch-mode Android development build for the phone checkpoint (T015). Needs the Android module and SDK.</summary>
        public static void BatchBuildAndroid()
        {
            try
            {
                var problems = ProjectValidator.Run();
                if (problems.Count > 0)
                {
                    Debug.LogError("[veyr] validation failed: " + string.Join("; ", problems));
                    EditorApplication.Exit(1);
                    return;
                }
                Directory.CreateDirectory("Builds/Android");
                var options = new BuildPlayerOptions
                {
                    scenes = EditorBuildSettings.scenes.Where(s => s.enabled).Select(s => s.path).ToArray(),
                    locationPathName = "Builds/Android/veyrmarch-dev.apk",
                    target = BuildTarget.Android,
                    options = BuildOptions.Development
                };
                var result = BuildPipeline.BuildPlayer(options);
                Debug.Log("[veyr] Android build: " + result.summary.result + ", " + result.summary.totalSize + " bytes, " + result.summary.totalTime);
                EditorApplication.Exit(result.summary.result == UnityEditor.Build.Reporting.BuildResult.Succeeded ? 0 : 1);
            }
            catch (Exception e)
            {
                Debug.LogException(e);
                EditorApplication.Exit(2);
            }
        }
    }

    public static class ProjectValidator
    {
        static readonly string[] RequiredActions = { "Move", "Look", "Light", "Dodge", "Jump", "Interact", "Block", "Ability", "LockOn", "QuickItem", "Sprint" };

        public static List<string> Run()
        {
            var problems = new List<string>();
            if (!Application.unityVersion.StartsWith("6000.", StringComparison.Ordinal))
                problems.Add("Unity " + Application.unityVersion + " is not Unity 6 (6000.x). Stop: the programme requires Unity 6.");

            var scenes = EditorBuildSettings.scenes;
            foreach (var path in new[] { SceneBuilder.BootPath, SceneBuilder.DevMovePath, SceneBuilder.ForestPath })
            {
                if (!File.Exists(path))
                    problems.Add("Missing scene " + path + ". Run Veyrmarch > Setup.");
                else if (!scenes.Any(s => s.path == path && s.enabled))
                    problems.Add("Scene " + path + " is not enabled in the build list.");
            }
            if (scenes.Length > 0 && scenes[0].path != SceneBuilder.BootPath)
                problems.Add("Boot must be the first scene in the build list.");

            var actions = AssetDatabase.LoadAssetAtPath<InputActionAsset>(SceneBuilder.InputPath);
            if (actions == null)
            {
                problems.Add("Input actions did not import: " + SceneBuilder.InputPath + ".");
            }
            else
            {
                var map = actions.FindActionMap("Player", false);
                if (map == null)
                    problems.Add("Input map 'Player' is missing.");
                else
                {
                    foreach (var name in RequiredActions)
                    {
                        if (map.FindAction(name, false) == null)
                            problems.Add("Input action '" + name + "' is missing.");
                    }
                }
                foreach (var scheme in new[] { "Touch", "Gamepad" })
                {
                    if (!actions.controlSchemes.Any(s => s.name == scheme))
                        problems.Add("Control scheme '" + scheme + "' is missing.");
                }
            }

            var set = AssetDatabase.LoadAssetAtPath<QualityAssetSet>(RenderingSetup.SetPath);
            if (set == null || set.low == null || set.medium == null || set.high == null)
                problems.Add("Quality tier assets are missing. Run Veyrmarch > Setup > 2.");
            if (GraphicsSettings.defaultRenderPipeline == null)
                problems.Add("No default render pipeline: the project is not on URP.");

            if (LayerMask.NameToLayer(ProjectSetup.LandmarkLayer) < 0)
                problems.Add("Layer '" + ProjectSetup.LandmarkLayer + "' is missing; far landmarks will cull at draw distance.");
            if (!ProjectSetup.InputHandlerIncludesNewSystem())
                problems.Add("Active Input Handling does not include the Input System package.");
            if (PlayerSettings.GetScriptingBackend(NamedBuildTarget.Android) != ScriptingImplementation.IL2CPP)
                problems.Add("Android scripting backend is not IL2CPP.");
            if ((PlayerSettings.Android.targetArchitectures & AndroidArchitecture.ARM64) == 0)
                problems.Add("Android does not target ARM64.");
            if (PlayerSettings.allowedAutorotateToPortrait || !PlayerSettings.allowedAutorotateToLandscapeLeft)
                problems.Add("Orientation is not landscape-only.");
            if (!PlayerSettings.enableFrameTimingStats)
                problems.Add("Frame timing stats are off; the GPU time will read n/a.");
            if (Directory.Exists("Assets/Resources"))
                problems.Add("Assets/Resources exists. Loading is explicit or Addressables (architecture §3).");
            return problems;
        }
    }
}
