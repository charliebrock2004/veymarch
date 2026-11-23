using UnityEngine;
using UnityEngine.Rendering.Universal;
using Veyr.Client.Core;

namespace Veyr.Client.Platform
{
    /// <summary>The three URP assets the tiers switch between. A definition asset, not live state.</summary>
    [CreateAssetMenu(menuName = "Veyrmarch/Quality Asset Set", fileName = "VeyrQualityAssets")]
    public sealed class QualityAssetSet : ScriptableObject
    {
        public UniversalRenderPipelineAsset low;
        public UniversalRenderPipelineAsset medium;
        public UniversalRenderPipelineAsset high;

        public UniversalRenderPipelineAsset For(QualityTier tier) =>
            tier == QualityTier.Low ? low : tier == QualityTier.High ? high : medium;
    }
}
