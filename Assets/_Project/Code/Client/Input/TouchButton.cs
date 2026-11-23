using System;
using UnityEngine;
using UnityEngine.EventSystems;

namespace Veyr.Client.Input
{
    /// <summary>An on-screen button. Held while a finger is on it; a finger sliding off releases it.</summary>
    public sealed class TouchButton : MonoBehaviour, IPointerDownHandler, IPointerUpHandler, IPointerExitHandler
    {
        int _pointer = int.MinValue;

        public bool Held => _pointer != int.MinValue;

        public void OnPointerDown(PointerEventData eventData) => _pointer = eventData.pointerId;

        public void OnPointerUp(PointerEventData eventData)
        {
            if (eventData.pointerId == _pointer)
                _pointer = int.MinValue;
        }

        public void OnPointerExit(PointerEventData eventData)
        {
            if (eventData.pointerId == _pointer)
                _pointer = int.MinValue;
        }

        void OnDisable() => _pointer = int.MinValue;
    }
}
