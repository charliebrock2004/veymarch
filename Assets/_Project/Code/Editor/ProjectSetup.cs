using System.Collections.Generic;
using UnityEditor;
using UnityEditor.Build;
using UnityEngine;
using UnityEngine.Rendering;
using Veyr.Client.Platform;

namespace Veyr.EditorTools
{
    /// <summary>
    /// Player and project settings for the mobile slice: landscape, IL2CPP, ARM64, Vulkan with a
    /// GLES3 fallback, linear colour, frame timing stats for the GPU number, the Input System,
    /// and the Landmark layer. Idempotent: running it twice changes nothing the second time.
    /// </summary>
    public static class ProjectSetup
    {
        public const string BundleId = "com.veyrmarch.slice";
        public const string LandmarkLayer = QualityService.LandmarkLayer;
        public const int LandmarkLayerIndex = 8;

        public static List<string> ConfigurePlayer()
        {
            var notes = new List<string>();
            PlayerSettings.companyName = "Veyrmarch";
            PlayerSettings.productName = "Veyrmarch";
            PlayerSettings.SetApplicationIdentifier(NamedBuildTarget.Android, BundleId);
            PlayerSettings.SetApplicationIdentifier(NamedBuildTarget.iOS, BundleId);

            // Landscape only: the thumb layout is designed for it (design bible §31).
            PlayerSettings.defaultInterfaceOrientation = UIOrientation.AutoRotation;
            PlayerSettings.allowedAutorotateToLandscapeLeft = true;
            PlayerSettings.allowedAutorotateToLandscapeRight = true;
            PlayerSettings.allowedAutorotateToPortrait = false;
            PlayerSettings.allowedAutorotateToPortraitUpsideDown = false;

            PlayerSettings.colorSpace = ColorSpace.Linear;
            PlayerSettings.SetScriptingBackend(NamedBuildTarget.Android, ScriptingImplementation.IL2CPP);
            PlayerSettings.SetScriptingBackend(NamedBuildTarget.iOS, ScriptingImplementation.IL2CPP);
            PlayerSettings.Android.targetArchitectures = AndroidArchitecture.ARM64;
            PlayerSettings.SetUseDefaultGraphicsAPIs(BuildTarget.Android, false);
            PlayerSettings.SetGraphicsAPIs(BuildTarget.Android, new[] { GraphicsDeviceType.Vulkan, GraphicsDeviceType.OpenGLES3 });
            PlayerSettings.iOS.targetOSVersionString = "15.0";
            // FrameTimingManager needs this for the GPU frame time on the overlay and the device log.
            PlayerSettings.enableFrameTimingStats = true;
            PlayerSettings.runInBackground = false;
            notes.Add("Player settings: landscape, IL2CPP, ARM64, Vulkan+GLES3, linear, frame timing stats.");

            if (SetActiveInputHandler(2))
                notes.Add("Active Input Handling set to Both. Restart the editor once for it to take effect.");
            if (EnsureLayer(LandmarkLayerIndex, LandmarkLayer))
                notes.Add("Layer " + LandmarkLayerIndex + " named " + LandmarkLayer + ".");
            AssetDatabase.SaveAssets();
            return notes;
        }

        /// <summary>0 = old Input Manager, 1 = Input System, 2 = both. There is no public API, so the asset is edited.</summary>
        static bool SetActiveInputHandler(int value)
        {
            var assets = AssetDatabase.LoadAllAssetsAtPath("ProjectSettings/ProjectSettings.asset");
            if (assets == null || assets.Length == 0)
                return false;
            var so = new SerializedObject(assets[0]);
            var prop = so.FindProperty("activeInputHandler");
            if (prop == null || prop.intValue == value)
                return false;
            prop.intValue = value;
            so.ApplyModifiedPropertiesWithoutUndo();
            return true;
        }

        public static bool EnsureLayer(int index, string name)
        {
            var assets = AssetDatabase.LoadAllAssetsAtPath("ProjectSettings/TagManager.asset");
            if (assets == null || assets.Length == 0)
                return false;
            var so = new SerializedObject(assets[0]);
            var layers = so.FindProperty("layers");
            if (layers == null || layers.arraySize <= index)
                return false;
            var slot = layers.GetArrayElementAtIndex(index);
            if (slot.stringValue == name)
                return false;
            if (!string.IsNullOrEmpty(slot.stringValue))
            {
                Debug.LogWarning("Veyr setup: layer " + index + " is already '" + slot.stringValue + "'. Landmark layer not set.");
                return false;
            }
            slot.stringValue = name;
            so.ApplyModifiedPropertiesWithoutUndo();
            return true;
        }

        public static bool InputHandlerIncludesNewSystem()
        {
            var assets = AssetDatabase.LoadAllAssetsAtPath("ProjectSettings/ProjectSettings.asset");
            if (assets == null || assets.Length == 0)
                return false;
            var prop = new SerializedObject(assets[0]).FindProperty("activeInputHandler");
            return prop != null && prop.intValue >= 1;
        }
    }
}
