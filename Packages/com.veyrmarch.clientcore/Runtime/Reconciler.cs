#nullable enable
using System;
using System.Numerics;

namespace Veyr.Client.Core
{
    public enum CorrectionKind
    {
        None,
        Smooth,
        Snap
    }

    public readonly struct Correction
    {
        public Correction(CorrectionKind kind, Vector3 offset)
        {
            Kind = kind;
            Offset = offset;
        }

        public CorrectionKind Kind { get; }
        /// <summary>Server position minus what the client claimed for the same sequence.</summary>
        public Vector3 Offset { get; }

        public static Correction None => new Correction(CorrectionKind.None, Vector3.Zero);
    }

    /// <summary>
    /// Keeps the claims the client sent and compares each snapshot with the claim for the sequence
    /// the server says it applied. The server's position wins: a small gap is smoothed out, a large
    /// one (a refused move, a respawn) is snapped.
    /// </summary>
    public sealed class Reconciler
    {
        readonly int[] _seq;
        readonly Vector3[] _claim;
        int _next;
        int _lastChecked;

        public Reconciler(int capacity = 64)
        {
            _seq = new int[capacity];
            _claim = new Vector3[capacity];
        }

        public float IgnoreMetres { get; set; } = 0.05f;
        public float SnapMetres { get; set; } = 1.5f;

        public void Record(int seq, Vector3 claim)
        {
            _seq[_next] = seq;
            _claim[_next] = claim;
            _next = (_next + 1) % _seq.Length;
        }

        public bool TryClaim(int seq, out Vector3 claim)
        {
            for (int i = 0; i < _seq.Length; i++)
            {
                if (_seq[i] == seq && seq != 0)
                {
                    claim = _claim[i];
                    return true;
                }
            }
            claim = default;
            return false;
        }

        /// <summary>Compares the server body with the claim for <paramref name="appliedSeq"/>. Each sequence is checked once.</summary>
        public Correction Check(int appliedSeq, Vector3 server)
        {
            if (appliedSeq <= _lastChecked || !TryClaim(appliedSeq, out var claim))
                return Correction.None;
            _lastChecked = appliedSeq;
            Vector3 offset = server - claim;
            float gap = offset.Length();
            if (gap <= IgnoreMetres)
                return Correction.None;
            return new Correction(gap >= SnapMetres ? CorrectionKind.Snap : CorrectionKind.Smooth, offset);
        }

        /// <summary>The server refused a move outright. Snap to where it says the body is.</summary>
        public Correction Refused(Vector3 predicted, Vector3 server) =>
            new Correction(CorrectionKind.Snap, server - predicted);
    }
}
