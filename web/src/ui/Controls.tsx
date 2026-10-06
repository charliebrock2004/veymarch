import { useEffect, useRef, useState, type PointerEvent as RPE } from "react";
import type { GameApi, Hud, Press } from "../game/Game";
import { Glyph } from "./icons";

/**
 * Touch controls: a floating stick on the left half, drag-to-look on the right half,
 * and a thumb cluster of large buttons. Pointer events track each finger separately,
 * so moving, looking and attacking all work at once.
 */

const R = 54;

export function Controls({ api, hud }: { api: GameApi; hud: Hud }) {
  const layer = useRef<HTMLDivElement>(null);
  const stick = useRef<{ id: number; ox: number; oy: number } | null>(null);
  const looks = useRef(new Map<number, { x: number; y: number; moved: number; mouse: boolean }>());
  const [knob, setKnob] = useState<{ ox: number; oy: number; kx: number; ky: number } | null>(null);

  useEffect(() => () => api.setStick(0, 0), [api]);

  const down = (e: RPE<HTMLDivElement>) => {
    const el = layer.current!;
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const w = el.clientWidth;
    if (e.pointerType !== "mouse" && e.clientX < w * 0.46 && !stick.current) {
      stick.current = { id: e.pointerId, ox: e.clientX, oy: e.clientY };
      setKnob({ ox: e.clientX, oy: e.clientY, kx: 0, ky: 0 });
    } else looks.current.set(e.pointerId, { x: e.clientX, y: e.clientY, moved: 0, mouse: e.pointerType === "mouse" });
  };
  const move = (e: RPE<HTMLDivElement>) => {
    const s = stick.current;
    if (s && s.id === e.pointerId) {
      let dx = e.clientX - s.ox;
      let dy = e.clientY - s.oy;
      const d = Math.hypot(dx, dy);
      if (d > R * 1.6) {
        // drag the stick base along so the thumb never runs off it
        s.ox += (dx / d) * (d - R * 1.6);
        s.oy += (dy / d) * (d - R * 1.6);
        dx = e.clientX - s.ox;
        dy = e.clientY - s.oy;
      }
      const dd = Math.hypot(dx, dy);
      const k = dd > R ? R / dd : 1;
      const kx = dx * k;
      const ky = dy * k;
      setKnob({ ox: s.ox, oy: s.oy, kx, ky });
      const mag = Math.min(1, dd / R);
      const dead = 0.12;
      const m = mag < dead ? 0 : (mag - dead) / (1 - dead);
      api.setStick(dd > 0 ? (dx / dd) * m : 0, dd > 0 ? (-dy / dd) * m : 0);
      return;
    }
    const l = looks.current.get(e.pointerId);
    if (l) {
      const dx = e.clientX - l.x;
      const dy = e.clientY - l.y;
      l.x = e.clientX;
      l.y = e.clientY;
      l.moved += Math.abs(dx) + Math.abs(dy);
      if (!l.mouse || e.buttons) api.look(dx * (l.mouse ? 0.8 : 1.15), dy * (l.mouse ? 0.8 : 1.0));
    }
  };
  const up = (e: RPE<HTMLDivElement>) => {
    const s = stick.current;
    if (s && s.id === e.pointerId) {
      stick.current = null;
      setKnob(null);
      api.setStick(0, 0);
    }
    const l = looks.current.get(e.pointerId);
    if (l) {
      looks.current.delete(e.pointerId);
      if (l.mouse && l.moved < 6) {
        api.press("attackDown");
        api.press("attackUp");
      }
    }
  };

  const btn = (p: Press, release?: Press) => ({
    onPointerDown: (e: RPE) => {
      e.stopPropagation();
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        /* capture is a nicety; the press still counts */
      }
      api.press(p);
    },
    onPointerUp: (e: RPE) => {
      e.stopPropagation();
      if (release) api.press(release);
    },
    onPointerCancel: () => release && api.press(release),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  const bandages = hud.items.filter((i) => i.id === "cons_bandage").reduce((n, i) => n + i.count, 0);
  const promptIcon = hud.prompt.startsWith("Talk") ? "speak" : hud.prompt.startsWith("Gather") ? "gather" : /Enter|Leave|Out|door|Gate/i.test(hud.prompt) ? "door" : "hand";

  return (
    <>
      <div ref={layer} className="vm-touch" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onContextMenu={(e) => e.preventDefault()} />
      {knob ? (
        <div className="vm-stick" style={{ left: knob.ox, top: knob.oy }}>
          <div className="vm-knob" style={{ transform: `translate(${knob.kx}px, ${knob.ky}px)` }} />
        </div>
      ) : (
        <div className="vm-stick vm-stick-ghost">
          <div className="vm-knob" />
        </div>
      )}
      <div className="vm-cluster">
        {hud.prompt && (
          <button className="vm-btn vm-prompt" {...btn("interact")}>
            <Glyph name={promptIcon as "hand"} size={22} />
            <span>{hud.prompt}</span>
          </button>
        )}
        <button className={`vm-btn vm-attack ${hud.charge > 0 ? "is-charging" : ""}`} {...btn("attackDown", "attackUp")} aria-label="Attack">
          <svg className="vm-charge" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="46" pathLength={1} strokeDasharray={`${hud.charge} 1`} />
          </svg>
          <Glyph name="sword" size={38} />
        </button>
        <button className="vm-btn vm-dodge" {...btn("dodge")} aria-label="Dodge">
          <Glyph name="dodge" size={30} />
        </button>
        <button className={`vm-btn vm-block ${hud.shield ? "" : "is-dim"}`} {...btn("blockDown", "blockUp")} aria-label="Block">
          <Glyph name="shield" size={26} />
        </button>
        {hud.ember && (
          <button className={`vm-btn vm-ember ${hud.emberReady ? "" : "is-dim"}`} {...btn("ember")} aria-label="Ember">
            <Glyph name="flame" size={28} />
          </button>
        )}
        <button className={`vm-btn vm-heal ${bandages ? "" : "is-dim"}`} {...btn("heal")} aria-label="Bandage">
          <Glyph name="heal" size={22} />
          {bandages > 0 && <b>{bandages}</b>}
        </button>
      </div>
    </>
  );
}
