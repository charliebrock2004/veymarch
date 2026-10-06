using System;
using System.Collections.Generic;
using UnityEngine;
using Veyr.Client.Core;
using Veyr.Client.Player;
using Veyr.Net;
using Veyr.Sim;

namespace Veyr.Client.Hud
{
    /// <summary>
    /// Health and stamina as solid bars (art bible §22): health thick, stamina thin. Reads what the
    /// server last reported through the local player; it never computes either value.
    /// </summary>
    public sealed class VitalsHud : MonoBehaviour
    {
        [SerializeField] RectTransform healthFill;
        [SerializeField] RectTransform staminaFill;
        LocalPlayerController _player;

        public void Wire(RectTransform health, RectTransform stamina)
        {
            healthFill = health;
            staminaFill = stamina;
        }

        public void Bind(LocalPlayerController player) => _player = player;

        void LateUpdate()
        {
            if (_player == null)
                return;
            SetFill(healthFill, _player.MaxHealth > 0f ? _player.Health / _player.MaxHealth : 0f);
            SetFill(staminaFill, _player.MaxStamina > 0f ? _player.Stamina / _player.MaxStamina : 0f);
        }

        static void SetFill(RectTransform fill, float t)
        {
            if (fill == null)
                return;
            fill.anchorMax = new Vector2(Mathf.Clamp01(t), fill.anchorMax.y);
        }
    }
}
