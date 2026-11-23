using System;
using System.Collections.Generic;
using UnityEngine;
using Veyr.Client.Core;

using Veyr.Net;
using Veyr.Sim;

namespace Veyr.Client.Hud
{
    /// <summary>Keeps a UI root inside Screen.safeArea so notches and home bars never cover a control.</summary>
    [RequireComponent(typeof(RectTransform))]
    public sealed class SafeAreaFitter : MonoBehaviour
    {
        RectTransform _rect;
        Rect _lastSafe;
        Vector2Int _lastScreen;

        void Awake()
        {
            _rect = GetComponent<RectTransform>();
            Fit();
        }

        void Update()
        {
            if (Screen.safeArea != _lastSafe || Screen.width != _lastScreen.x || Screen.height != _lastScreen.y)
                Fit();
        }

        void Fit()
        {
            var safe = Screen.safeArea;
            _lastSafe = safe;
            _lastScreen = new Vector2Int(Screen.width, Screen.height);
            var anchors = SafeArea.Anchors(Screen.width, Screen.height, safe.x, safe.y, safe.width, safe.height);
            _rect.anchorMin = new Vector2(anchors.MinX, anchors.MinY);
            _rect.anchorMax = new Vector2(anchors.MaxX, anchors.MaxY);
            _rect.offsetMin = Vector2.zero;
            _rect.offsetMax = Vector2.zero;
        }
    }
}
