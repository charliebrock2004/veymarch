using System.Text;
using UnityEngine;
using UnityEngine.Profiling;
using UnityEngine.UI;
using Veyr.Client.Core;
using Veyr.Net;

namespace Veyr.Client.Platform
{
    /// <summary>
    /// Debug frame overlay (T014): frame ms, median and p95 over the last 600 frames, GPU and CPU
    /// time from FrameTimingManager where the device reports it, tier, render scale, sim tick,
    /// memory. Developer-facing, so it is plain text, not localised.
    /// </summary>
    public sealed class FrameOverlay : MonoBehaviour
    {
        [SerializeField] Text label;
        [SerializeField] float refreshSeconds = 0.5f;

        readonly FrameStats _window = new FrameStats(600);
        readonly FrameHistogram _run = new FrameHistogram();
        readonly FrameTiming[] _timings = new FrameTiming[1];
        readonly StringBuilder _text = new StringBuilder(256);
        ISimEndpoint _endpoint;
        IHostDiagnostics _host;
        QualityService _quality;
        float _refresh;
        double _gpuMs;
        double _cpuMs;

        public FrameStats Window => _window;
        public FrameHistogram Run => _run;
        public double GpuMs => _gpuMs;
        public double CpuMs => _cpuMs;
        public string LogPath { get; set; } = "";

        public void Wire(Text text) => label = text;

        public void Bind(ISimEndpoint endpoint, IHostDiagnostics host, QualityService quality)
        {
            _endpoint = endpoint;
            _host = host;
            _quality = quality;
        }

        public void SetVisible(bool visible)
        {
            if (label != null)
                label.enabled = visible;
        }

        void Update()
        {
            float ms = Time.unscaledDeltaTime * 1000f;
            _window.Add(ms);
            _run.Add(ms);
            FrameTimingManager.CaptureFrameTimings();
            if (FrameTimingManager.GetLatestTimings(1, _timings) > 0)
            {
                _gpuMs = _timings[0].gpuFrameTime;
                _cpuMs = _timings[0].cpuFrameTime;
            }

            _refresh -= Time.unscaledDeltaTime;
            if (_refresh > 0f || label == null || !label.enabled)
                return;
            _refresh = refreshSeconds;
            label.text = Compose(ms);
        }

        string Compose(float ms)
        {
            _text.Clear();
            _text.Append("frame ").Append(ms.ToString("0.0")).Append(" ms   med ").Append(_window.Median.ToString("0.0"))
                .Append("  p95 ").Append(_window.P95.ToString("0.0"))
                .Append("  run med ").Append(_run.Percentile(0.5f).ToString("0.0"))
                .Append("  >33ms ").Append((_window.OverBudgetShare * 100f).ToString("0")).Append('%');
            _text.Append('\n');
            _text.Append("cpu ").Append(_cpuMs > 0 ? _cpuMs.ToString("0.0") : "n/a")
                .Append("  gpu ").Append(_gpuMs > 0 ? _gpuMs.ToString("0.0") : "n/a")
                .Append("  mem ").Append((Profiler.GetTotalReservedMemoryLong() / (1024 * 1024)).ToString())
                .Append(" MB");
            if (_quality != null)
            {
                _text.Append("  ").Append(_quality.Tier.ToString()).Append(' ')
                    .Append(Mathf.RoundToInt(_quality.RenderScale * Mathf.Min(Screen.width, Screen.height))).Append('p');
                if (_quality.ThermalStepDowns > 0)
                    _text.Append(" (thermal -").Append(_quality.ThermalStepDowns).Append(')');
            }
            _text.Append('\n');
            if (_endpoint != null)
                _text.Append("tick ").Append(_endpoint.ServerTick);
            if (_host != null && _host.DroppedSeconds > 0.0001)
                _text.Append("  dropped ").Append(_host.DroppedSeconds.ToString("0.00")).Append(" s");
            _text.Append("  ").Append(Screen.width).Append('x').Append(Screen.height);
            if (LogPath.Length > 0)
                _text.Append('\n').Append("log ").Append(LogPath);
            return _text.ToString();
        }
    }
}
