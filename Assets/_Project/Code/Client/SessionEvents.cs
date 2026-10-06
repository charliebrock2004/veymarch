using System;
using System.Collections.Generic;
using UnityEngine;
using Veyr.Client.Core;

using Veyr.Net;
using Veyr.Sim;

namespace Veyr.Client
{
    /// <summary>
    /// Pumps the endpoint once per frame after the host steps: drains sim events and hands them to
    /// subscribers in this scene, then the new snapshot if there is one. Presentation reacts to
    /// facts; it never sends a fact back.
    /// </summary>
    public sealed class SessionEvents
    {
        readonly List<SimEvent> _buffer = new List<SimEvent>(64);

        public event Action<SimEvent> Raised;
        public event Action<WorldSnapshot> Snapshot;

        public void Pump(ISimEndpoint endpoint, bool newSnapshot)
        {
            _buffer.Clear();
            endpoint.DrainEvents(_buffer);
            for (int i = 0; i < _buffer.Count; i++)
                Raised?.Invoke(_buffer[i]);
            if (newSnapshot)
                Snapshot?.Invoke(endpoint.Latest);
        }
    }
}
