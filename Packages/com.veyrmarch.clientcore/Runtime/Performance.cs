#nullable enable
using System;

namespace Veyr.Client.Core
{
    /// <summary>
    /// Rolling frame-time statistics. Fixed buffers: adding a frame never allocates, and a
    /// percentile query sorts a scratch copy. Query a few times a second, not every frame.
    /// </summary>
    public sealed class FrameStats
    {
        public const float BudgetMs = 33.3f;
        readonly float[] _ring;
        readonly float[] _scratch;
        int _next;

        public FrameStats(int capacity = 600)
        {
            if (capacity < 2)
                throw new ArgumentOutOfRangeException(nameof(capacity));
            _ring = new float[capacity];
            _scratch = new float[capacity];
        }

        public int Count { get; private set; }
        public int Capacity => _ring.Length;
        public long Total { get; private set; }
        public long OverBudgetTotal { get; private set; }

        public void Add(float frameMs)
        {
            if (float.IsNaN(frameMs) || frameMs < 0f)
                return;
            _ring[_next] = frameMs;
            _next = (_next + 1) % _ring.Length;
            if (Count < _ring.Length)
                Count++;
            Total++;
            if (frameMs > BudgetMs)
                OverBudgetTotal++;
        }

        public void Clear()
        {
            Count = 0;
            _next = 0;
        }

        public float Percentile(float p)
        {
            if (Count == 0)
                return 0f;
            Array.Copy(_ring, _scratch, Count);
            Array.Sort(_scratch, 0, Count);
            float rank = Math.Clamp(p, 0f, 1f) * (Count - 1);
            int lo = (int)MathF.Floor(rank);
            int hi = Math.Min(Count - 1, lo + 1);
            float t = rank - lo;
            return _scratch[lo] + (_scratch[hi] - _scratch[lo]) * t;
        }

        public float Median => Percentile(0.5f);
        public float P95 => Percentile(0.95f);

        public float Max
        {
            get
            {
                float max = 0f;
                for (int i = 0; i < Count; i++)
                    max = MathF.Max(max, _ring[i]);
                return max;
            }
        }

        public float Mean
        {
            get
            {
                if (Count == 0)
                    return 0f;
                double sum = 0;
                for (int i = 0; i < Count; i++)
                    sum += _ring[i];
                return (float)(sum / Count);
            }
        }

        /// <summary>Share of the frames in the window over the 33.3 ms budget.</summary>
        public float OverBudgetShare
        {
            get
            {
                if (Count == 0)
                    return 0f;
                int over = 0;
                for (int i = 0; i < Count; i++)
                {
                    if (_ring[i] > BudgetMs)
                        over++;
                }
                return over / (float)Count;
            }
        }
    }

    public enum QualityTier
    {
        Low,
        Medium,
        High
    }

    /// <summary>
    /// One graphics tier. Numbers from architecture §32 and art bible §26. Identity survives Low:
    /// landmarks and tells are meshes, so dropping shadows and resolution never removes a tell.
    /// </summary>
    public sealed class QualityProfile
    {
        public QualityTier Tier { get; init; }
        /// <summary>Target rendered height in pixels: 720p, 900p, 1080p dynamic.</summary>
        public int TargetHeight { get; init; }
        public int ShadowCascades { get; init; }
        public float ShadowDistance { get; init; }
        public float DrawDistance { get; init; }
        public int Msaa { get; init; }
        public bool Hdr { get; init; }
        public int TargetFps { get; init; } = 30;
        /// <summary>Scatter density multiplier for grass and small props.</summary>
        public float FoliageDensity { get; init; }
        public float ImpostorDistance { get; init; }
        public int ActiveHostileCap { get; init; }
        public int FullNpcCap { get; init; }
        public float ResidentWarningMb { get; init; }

        /// <summary>Render scale that reaches <see cref="TargetHeight"/> on this screen, never above 1.</summary>
        public float RenderScale(int screenHeight)
        {
            int shortSide = Math.Max(1, screenHeight);
            return Math.Clamp(TargetHeight / (float)shortSide, 0.5f, 1f);
        }

        public static readonly QualityProfile Low = new QualityProfile
        {
            Tier = QualityTier.Low,
            TargetHeight = 720,
            ShadowCascades = 0,
            ShadowDistance = 0f,
            DrawDistance = 100f,
            Msaa = 1,
            Hdr = false,
            FoliageDensity = 0.5f,
            ImpostorDistance = 40f,
            ActiveHostileCap = 8,
            FullNpcCap = 6,
            ResidentWarningMb = 1000f
        };

        public static readonly QualityProfile Medium = new QualityProfile
        {
            Tier = QualityTier.Medium,
            TargetHeight = 900,
            ShadowCascades = 1,
            ShadowDistance = 35f,
            DrawDistance = 160f,
            Msaa = 1,
            Hdr = false,
            FoliageDensity = 0.8f,
            ImpostorDistance = 70f,
            ActiveHostileCap = 12,
            FullNpcCap = 10,
            ResidentWarningMb = 1200f
        };

        public static readonly QualityProfile High = new QualityProfile
        {
            Tier = QualityTier.High,
            TargetHeight = 1080,
            ShadowCascades = 2,
            ShadowDistance = 50f,
            DrawDistance = 160f,
            Msaa = 2,
            Hdr = false,
            FoliageDensity = 1f,
            ImpostorDistance = 100f,
            ActiveHostileCap = 15,
            FullNpcCap = 12,
            ResidentWarningMb = 1600f
        };

        public static QualityProfile For(QualityTier tier) =>
            tier == QualityTier.Low ? Low : tier == QualityTier.High ? High : Medium;
    }

    public readonly struct DeviceInfo
    {
        public DeviceInfo(int systemMemoryMb, int graphicsMemoryMb, int processorCount, bool mobile)
        {
            SystemMemoryMb = systemMemoryMb;
            GraphicsMemoryMb = graphicsMemoryMb;
            ProcessorCount = processorCount;
            Mobile = mobile;
        }

        public int SystemMemoryMb { get; }
        public int GraphicsMemoryMb { get; }
        public int ProcessorCount { get; }
        public bool Mobile { get; }
    }

    public static class QualityChooser
    {
        /// <summary>
        /// A first guess by device class. The 4 GB Android class gets Low, the mid class Medium.
        /// It is only a starting point: the governor steps down on real frame times.
        /// </summary>
        public static QualityTier Auto(DeviceInfo device)
        {
            if (!device.Mobile)
                return QualityTier.High;
            if (device.SystemMemoryMb <= 0)
                return QualityTier.Medium;
            if (device.SystemMemoryMb < 4500 || device.ProcessorCount < 6)
                return QualityTier.Low;
            if (device.SystemMemoryMb < 7500)
                return QualityTier.Medium;
            return QualityTier.High;
        }

        public static QualityTier Parse(string setting, DeviceInfo device)
        {
            switch (setting)
            {
                case "Low": return QualityTier.Low;
                case "Medium": return QualityTier.Medium;
                case "High": return QualityTier.High;
                default: return Auto(device);
            }
        }
    }

    /// <summary>
    /// Thermal step-down (architecture §32): if frames run over 40 ms for 10 seconds, drop a tier.
    /// Never steps up on its own, so a hot phone does not oscillate between tiers.
    /// </summary>
    public sealed class ThermalGovernor
    {
        public float SlowFrameMs { get; set; } = 40f;
        public float SustainSeconds { get; set; } = 10f;
        /// <summary>Share of slow frames inside the window that counts as sustained.</summary>
        public float SlowShare { get; set; } = 0.6f;
        public float CooldownSeconds { get; set; } = 30f;

        float _window;
        float _slow;
        float _cooldown;

        public int StepDowns { get; private set; }

        /// <summary>Feeds one frame. Returns true when the caller should drop one tier now.</summary>
        public bool Observe(float frameMs, QualityTier current)
        {
            float seconds = MathF.Max(0f, frameMs) / 1000f;
            if (_cooldown > 0f)
            {
                _cooldown -= seconds;
                return false;
            }
            _window += seconds;
            if (frameMs > SlowFrameMs)
                _slow += seconds;
            if (_window < SustainSeconds)
                return false;
            bool sustained = _slow / _window >= SlowShare;
            _window = 0f;
            _slow = 0f;
            if (!sustained || current == QualityTier.Low)
                return false;
            StepDowns++;
            _cooldown = CooldownSeconds;
            return true;
        }
    }

    public readonly struct SafeAnchors
    {
        public SafeAnchors(float minX, float minY, float maxX, float maxY)
        {
            MinX = minX;
            MinY = minY;
            MaxX = maxX;
            MaxY = maxY;
        }

        public float MinX { get; }
        public float MinY { get; }
        public float MaxX { get; }
        public float MaxY { get; }
    }

    public static class SafeArea
    {
        /// <summary>Normalised anchors for a UI root that must stay inside the device safe rect (notches, home bar).</summary>
        public static SafeAnchors Anchors(int screenWidth, int screenHeight, float safeX, float safeY, float safeWidth, float safeHeight)
        {
            if (screenWidth <= 0 || screenHeight <= 0)
                return new SafeAnchors(0f, 0f, 1f, 1f);
            float minX = Math.Clamp(safeX / screenWidth, 0f, 1f);
            float minY = Math.Clamp(safeY / screenHeight, 0f, 1f);
            float maxX = Math.Clamp((safeX + safeWidth) / screenWidth, minX, 1f);
            float maxY = Math.Clamp((safeY + safeHeight) / screenHeight, minY, 1f);
            return new SafeAnchors(minX, minY, maxX, maxY);
        }
    }
}
