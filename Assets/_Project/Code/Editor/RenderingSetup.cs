using UnityEditor;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
using Veyr.Client.Core;
using Veyr.Client.Platform;

namespace Veyr.EditorTools
{
    /// <summary>
    /// Creates the URP assets for Low, Medium, and High (architecture §32, art bible §26) and the
    /// <see cref="QualityAssetSet"/> the runtime switches between. Render scale is set at runtime
    /// from the device screen; these assets carry shadows, MSAA, and HDR.
    /// </summary>
    public static class RenderingSetup
    {
        public const string Folder = "Assets/_Project/Settings/Rendering";
        public const string SetPath = Folder + "/VeyrQualityAssets.asset";

        public static QualityAssetSet CreateTiers()
        {
            Folders.Ensure(Folder);
            var renderer = AssetDatabase.LoadAssetAtPath<UniversalRendererData>(Folder + "/VeyrRenderer.asset");
            if (renderer == null)
            {
                renderer = ScriptableObject.CreateInstance<UniversalRendererData>();
                AssetDatabase.CreateAsset(renderer, Folder + "/VeyrRenderer.asset");
            }

            var low = Tier(renderer, QualityProfile.Low, "VeyrURP_Low");
            var medium = Tier(renderer, QualityProfile.Medium, "VeyrURP_Medium");
            var high = Tier(renderer, QualityProfile.High, "VeyrURP_High");

            var set = AssetDatabase.LoadAssetAtPath<QualityAssetSet>(SetPath);
            if (set == null)
            {
                set = ScriptableObject.CreateInstance<QualityAssetSet>();
                AssetDatabase.CreateAsset(set, SetPath);
            }
            set.low = low;
            set.medium = medium;
            set.high = high;
            EditorUtility.SetDirty(set);

            // Medium is the gate-device tier and the editor default.
            GraphicsSettings.defaultRenderPipeline = medium;
            QualitySettings.renderPipeline = null;
            AssetDatabase.SaveAssets();
            return set;
        }

        static UniversalRenderPipelineAsset Tier(UniversalRendererData renderer, QualityProfile profile, string name)
        {
            string path = Folder + "/" + name + ".asset";
            var asset = AssetDatabase.LoadAssetAtPath<UniversalRenderPipelineAsset>(path);
            if (asset == null)
            {
                asset = UniversalRenderPipelineAsset.Create(renderer);
                AssetDatabase.CreateAsset(asset, path);
            }

            // Serialized names are stable across URP versions; several have no public setter.
            var so = new SerializedObject(asset);
            Set(so, "m_RenderScale", 1f);
            Set(so, "m_MainLightShadowsSupported", profile.ShadowCascades > 0);
            Set(so, "m_ShadowDistance", Mathf.Max(0.1f, profile.ShadowDistance));
            Set(so, "m_ShadowCascadeCount", Mathf.Max(1, profile.ShadowCascades));
            Set(so, "m_MSAA", profile.Msaa);
            Set(so, "m_SupportsHDR", profile.Hdr);
            Set(so, "m_SoftShadowsSupported", profile.Tier == QualityTier.High);
            Set(so, "m_SupportsCameraOpaqueTexture", false);
            Set(so, "m_SupportsCameraDepthTexture", false);
            // Player light plus a couple of fires on Low (art bible §5): keep additional lights per pixel but few.
            Set(so, "m_AdditionalLightsPerObjectLimit", profile.Tier == QualityTier.Low ? 2 : 4);
            so.ApplyModifiedPropertiesWithoutUndo();
            EditorUtility.SetDirty(asset);
            return asset;
        }

        static void Set(SerializedObject so, string name, float value)
        {
            var p = so.FindProperty(name);
            if (p == null)
                Debug.LogWarning("Veyr rendering: URP field " + name + " not found; check the tier asset by hand.");
            else
                p.floatValue = value;
        }

        static void Set(SerializedObject so, string name, int value)
        {
            var p = so.FindProperty(name);
            if (p == null)
                Debug.LogWarning("Veyr rendering: URP field " + name + " not found; check the tier asset by hand.");
            else
                p.intValue = value;
        }

        static void Set(SerializedObject so, string name, bool value)
        {
            var p = so.FindProperty(name);
            if (p == null)
                Debug.LogWarning("Veyr rendering: URP field " + name + " not found; check the tier asset by hand.");
            else
                p.boolValue = value;
        }
    }
}
