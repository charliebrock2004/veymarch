using System;
using UnityEngine;
using UnityEngine.EventSystems;

namespace Veyr.Client.Input
{
    /// <summary>
    /// An invisible screen region that forwards raw touches. The left zone drives the stick, the
    /// right zone drives look and flick. Needs a transparent Image so uGUI raycasts hit it.
    /// </summary>
    public sealed class TouchZone : MonoBehaviour, IPointerDownHandler, IDragHandler, IPointerUpHandler
    {
        public event Action<PointerEventData> Down;
        public event Action<PointerEventData> Dragged;
        public event Action<PointerEventData> Up;

        public void OnPointerDown(PointerEventData eventData) => Down?.Invoke(eventData);
        public void OnDrag(PointerEventData eventData) => Dragged?.Invoke(eventData);
        public void OnPointerUp(PointerEventData eventData) => Up?.Invoke(eventData);
    }
}
