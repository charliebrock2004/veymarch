using System;
using System.Globalization;
using System.IO;
using UnityEngine;
using UnityEngine.Profiling;
using Veyr.Client.Core;
using Veyr.Net;

namespace Veyr.Client.Platform
{
    /// <summary>
    /// Writes one CSV row per second for the phone checkpoints (T016, T070): frame median, p95,
    /// max, share over 33.3 ms, GPU and CPU time, memory, tier, battery, sim tick. A summary row
    /// with the whole-run median is written on pause and quit. Numbers come from the device; this
    /// class never invents one.
    /// </summary>
    public sealed class DeviceLog : MonoBehaviour
    {
        [SerializeField] bool enabledInEditor;

        readonly FrameStats _second = new FrameStats(240);
        readonly FrameHistogram _run = new FrameHistogram();
        StreamWriter _writer;
        FrameOverlay _overlay;
        QualityService _quality;
        ISimEndpoint _endpoint;
        float _elapsed;
        float _sinceRow;

        public string FilePath { get; private set; } = "";

        public void Bind(FrameOverlay overlay, QualityService quality, ISimEndpoint endpoint)
        {
            _overlay = overlay;
            _quality = quality;
            _endpoint = endpoint;
            if (_writer == null && (enabledInEditor || !Application.isEditor))
                Open();
            if (_overlay != null)
                _overlay.LogPath = FilePath;
        }

        void Open()
        {
            try
            {
                string dir = Path.Combine(Application.persistentDataPath, "device_logs");
                Directory.CreateDirectory(dir);
                string stamp = DateTime.UtcNow.ToString("yyyyMMdd_HHmmss", CultureInfo.InvariantCulture);
                FilePath = Path.Combine(dir, "veyr_" + stamp + ".csv");
                _writer = new StreamWriter(FilePath, false);
                _writer.WriteLine("# device," + Csv(SystemInfo.deviceModel) + ",os," + Csv(SystemInfo.operatingSystem) + ",gpu," + Csv(SystemInfo.graphicsDeviceName)
                    + ",api," + SystemInfo.graphicsDeviceType + ",ram_mb," + SystemInfo.systemMemorySize + ",cores," + SystemInfo.processorCount
                    + ",app," + Application.version + ",unity," + Application.unityVersion);
                _writer.WriteLine("t_s,scene,tier,render_h,frame_med_ms,frame_p95_ms,frame_max_ms,over_33ms_pct,gpu_ms,cpu_ms,reserved_mb,allocated_mb,battery,tick");
                _writer.Flush();
            }
            catch (IOException e)
            {
                Debug.LogWarning("Veyr device log: could not open (" + e.Message + ").");
                _writer = null;
                FilePath = "";
            }
        }

        void Update()
        {
            float ms = Time.unscaledDeltaTime * 1000f;
            _second.Add(ms);
            _run.Add(ms);
            _elapsed += Time.unscaledDeltaTime;
            _sinceRow += Time.unscaledDeltaTime;
            if (_sinceRow < 1f || _writer == null)
                return;
            _sinceRow = 0f;
            WriteRow();
            _second.Clear();
        }

        void WriteRow()
        {
            var inv = CultureInfo.InvariantCulture;
            int shortSide = Mathf.Min(Screen.width, Screen.height);
            string line = string.Join(",",
                _elapsed.ToString("0.0", inv),
                Csv(UnityEngine.SceneManagement.SceneManager.GetActiveScene().name),
                _quality != null ? _quality.Tier.ToString() : "unknown",
                _quality != null ? Mathf.RoundToInt(_quality.RenderScale * shortSide).ToString(inv) : shortSide.ToString(inv),
                _second.Median.ToString("0.00", inv),
                _second.P95.ToString("0.00", inv),
                _second.Max.ToString("0.00", inv),
                (_second.OverBudgetShare * 100f).ToString("0.0", inv),
                _overlay != null && _overlay.GpuMs > 0 ? _overlay.GpuMs.ToString("0.00", inv) : "",
                _overlay != null && _overlay.CpuMs > 0 ? _overlay.CpuMs.ToString("0.00", inv) : "",
                (Profiler.GetTotalReservedMemoryLong() / (1024f * 1024f)).ToString("0", inv),
                (Profiler.GetTotalAllocatedMemoryLong() / (1024f * 1024f)).ToString("0", inv),
                SystemInfo.batteryLevel >= 0f ? SystemInfo.batteryLevel.ToString("0.00", inv) : "",
                _endpoint != null ? _endpoint.ServerTick.ToString(inv) : "");
            _writer.WriteLine(line);
            _writer.Flush();
        }

        void WriteSummary(string reason)
        {
            if (_writer == null || _run.Count == 0)
                return;
            var inv = CultureInfo.InvariantCulture;
            _writer.WriteLine("# summary," + reason + ",seconds," + _elapsed.ToString("0", inv)
                + ",frames," + _run.Count.ToString(inv)
                + ",median_ms," + _run.Percentile(0.5f).ToString("0.0", inv)
                + ",p95_ms," + _run.Percentile(0.95f).ToString("0.0", inv)
                + ",p99_ms," + _run.Percentile(0.99f).ToString("0.0", inv)
                + ",over_33ms," + _run.CountAbove(FrameStats.BudgetMs).ToString(inv)
                + ",thermal_stepdowns," + (_quality != null ? _quality.ThermalStepDowns : 0).ToString(inv));
            _writer.Flush();
        }

        void OnApplicationPause(bool paused)
        {
            if (paused)
                WriteSummary("pause");
        }

        void OnDestroy()
        {
            WriteSummary("close");
            if (_writer != null)
            {
                _writer.Dispose();
                _writer = null;
            }
        }

        static string Csv(string value) => (value ?? "").Replace(',', ';').Replace('\n', ' ');
    }
}
