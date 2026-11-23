using System;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
using Veyr.Client.Core;
using Veyr.Sim;

namespace Veyr.Client.Platform
{
    /// <summary>
    /// Applies a quality tier: URP asset (shadows, MSAA), render scale to 720/900/1080p on this
    /// screen, draw distance, 30 fps cap. Steps down one tier when the thermal governor says the
    /// phone has run slow for ten seconds (architecture §32). Never steps itself back up.
    /// </summary>
    public sealed class QualityService : MonoBehaviour
    {
        [SerializeField] QualityAssetSet assets;

        public const string LandmarkLayer = "Landmark";

        readonly ThermalGovernor _governor = new ThermalGovernor();
        readonly float[] _cullDistances = new float[32];
        UniversalRenderPipelineAsset _runtimeAsset;
        RenderPipelineAsset _originalQualityPipeline;
        bool _captured;
        Camera _camera;

        public QualityTier Tier { get; private set; } = QualityTier.Medium;
        public QualityProfile Profile => QualityProfile.For(Tier);
        public float RenderScale { get; private set; } = 1f;
        public int ThermalStepDowns => _governor.StepDowns;
        public event Action<QualityTier> TierChanged;

        public static DeviceInfo Device() =>
            new DeviceInfo(SystemInfo.systemMemorySize, SystemInfo.graphicsMemorySize, SystemInfo.processorCount, Application.isMobilePlatform);

        public void Init(QualityAssetSet assetSet, LocalSettings settings)
        {
            assets = assetSet;
            Apply(QualityChooser.Parse(settings != null ? settings.Quality : "Auto", Device()));
        }

        public void SetCamera(Camera camera)
        {
            _camera = camera;
            ApplyCamera();
        }

        /// <summary>
        /// Dressing culls at the tier's draw distance; the Landmark layer uses the far clip, which is
        /// the horizon distance, so the next castle stays visible (design pillar: horizon hunger).
        /// </summary>
        void ApplyCamera()
        {
            if (_camera == null)
                return;
            var profile = Profile;
            _camera.farClipPlane = profile.HorizonDistance;
            for (int i = 0; i < _cullDistances.Length; i++)
                _cullDistances[i] = profile.DrawDistance;
            int landmark = LayerMask.NameToLayer(LandmarkLayer);
            if (landmark >= 0)
                _cullDistances[landmark] = 0f;
            _camera.layerCullDistances = _cullDistances;
            _camera.layerCullSpherical = true;
        }

        public void Apply(QualityTier tier)
        {
            Tier = tier;
            var profile = QualityProfile.For(tier);
            RenderScale = profile.RenderScale(Mathf.Min(Screen.width, Screen.height));
            var source = assets != null ? assets.For(tier) : null;
            if (source != null)
            {
                if (!_captured)
                {
                    _originalQualityPipeline = QualitySettings.renderPipeline;
                    _captured = true;
                }
                // Work on a copy so play mode never edits the asset on disk.
                var copy = Instantiate(source);
                copy.name = source.name + " (runtime)";
                copy.renderScale = RenderScale;
                QualitySettings.renderPipeline = copy;
                if (_runtimeAsset != null)
                    Destroy(_runtimeAsset);
                _runtimeAsset = copy;
            }
            else
            {
                Debug.LogWarning("Veyr quality: no URP asset for " + tier + ". Run Veyrmarch > Setup to create the tier assets.");
            }

            QualitySettings.vSyncCount = 0;
            Application.targetFrameRate = profile.TargetFps;
            ApplyCamera();
            TierChanged?.Invoke(tier);
        }

        void Update()
        {
            if (_governor.Observe(Time.unscaledDeltaTime * 1000f, Tier))
            {
                var lower = Tier == QualityTier.High ? QualityTier.Medium : QualityTier.Low;
                Debug.Log("Veyr quality: sustained slow frames, stepping down to " + lower + ".");
                Apply(lower);
            }
        }

        void OnDestroy()
        {
            if (_captured)
                QualitySettings.renderPipeline = _originalQualityPipeline;
            if (_runtimeAsset != null)
                Destroy(_runtimeAsset);
        }
    }
}
