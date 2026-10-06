/** Hand-drawn item icons in the art bible's palette. */

const S = { fill: "none", stroke: "#1c1916", strokeWidth: 2, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

export function ItemIcon({ id, size = 44 }: { id: string; size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden>
      {art(id)}
    </svg>
  );
}

function art(id: string) {
  switch (id) {
    case "mat_wood":
      return (
        <g {...S}>
          <rect x="8" y="17" width="30" height="14" rx="3" fill="#7a5e40" />
          <ellipse cx="38" cy="24" rx="5" ry="7" fill="#c8a678" />
          <ellipse cx="38" cy="24" rx="2" ry="3" fill="none" stroke="#7a5e40" />
          <path d="M14 21 h12 M12 27 h16" stroke="#4a3a2a" />
        </g>
      );
    case "mat_flint":
      return (
        <g {...S}>
          <path d="M10 32 L18 12 L32 10 L39 26 L28 38 Z" fill="#3a3836" />
          <path d="M18 12 L24 24 L39 26 M24 24 L28 38" stroke="#6a6662" />
          <path d="M30 14 l3 6" stroke="#d8d0c0" />
        </g>
      );
    case "mat_fibre":
      return (
        <g {...S}>
          <path d="M16 40 C18 28 14 18 10 8 M22 40 C22 26 24 16 22 6 M28 40 C28 28 32 18 38 10 M34 40 C32 30 36 24 42 20" stroke="#8a9450" strokeWidth={3} />
          <rect x="14" y="28" width="20" height="5" rx="2" fill="#b59a55" />
        </g>
      );
    case "mat_stone":
      return (
        <g {...S}>
          <path d="M8 34 C8 22 16 14 26 14 C36 14 42 22 40 32 C38 38 14 40 8 34 Z" fill="#9a948a" />
          <path d="M18 22 c4 -2 8 -2 10 0" stroke="#cfc8bc" />
        </g>
      );
    case "mat_bone":
      return (
        <g {...S}>
          <path d="M14 34 L34 14" stroke="#1c1916" strokeWidth={9} />
          <path d="M14 34 L34 14" stroke="#e4d7c3" strokeWidth={6} />
          <circle cx="11" cy="33" r="4" fill="#e4d7c3" />
          <circle cx="15" cy="37" r="4" fill="#e4d7c3" />
          <circle cx="33" cy="11" r="4" fill="#e4d7c3" />
          <circle cx="37" cy="15" r="4" fill="#e4d7c3" />
        </g>
      );
    case "mat_leather":
      return (
        <g {...S}>
          <path d="M12 10 C18 14 30 14 36 10 C38 18 42 22 40 30 C36 34 36 40 30 40 C26 36 22 36 18 40 C12 40 12 34 8 30 C6 22 10 18 12 10 Z" fill="#8a5a3a" />
          <path d="M16 20 c6 3 10 3 16 0" stroke="#b07a52" />
        </g>
      );
    case "mat_copper":
      return (
        <g {...S}>
          <path d="M10 30 L16 16 L30 12 L40 22 L34 36 L18 38 Z" fill="#b87333" />
          <path d="M16 16 L24 26 L40 22 M24 26 L18 38" stroke="#7a4a20" />
          <circle cx="32" cy="18" r="2" fill="#5e8a72" stroke="none" />
          <circle cx="14" cy="30" r="1.5" fill="#5e8a72" stroke="none" />
        </g>
      );
    case "mat_iron":
      return (
        <g {...S}>
          <path d="M8 30 L14 20 L40 20 L40 30 L34 36 L8 36 Z" fill="#6e7378" />
          <path d="M14 20 L8 30 L34 30 L40 20 M34 30 L34 36" stroke="#3a3e42" />
          <path d="M18 24 h14" stroke="#b0b6bc" />
        </g>
      );
    case "wpn_fists":
      return (
        <g {...S}>
          <path d="M12 22 C12 16 18 14 22 16 C24 12 30 12 32 16 C36 14 40 18 38 24 L36 34 C34 38 18 40 14 34 Z" fill="#e2c0a0" />
          <path d="M22 16 v8 M32 16 v8" stroke="#a07858" />
        </g>
      );
    case "wpn_stone_knife":
      return (
        <g {...S}>
          <path d="M8 40 L18 30" stroke="#1c1916" strokeWidth={7} />
          <path d="M8 40 L18 30" stroke="#7a5e40" strokeWidth={4} />
          <path d="M16 32 L36 8 L40 12 L20 36 Z" fill="#3a3836" />
          <path d="M16 31 l4 4" stroke="#b59a55" strokeWidth={3} />
        </g>
      );
    case "wpn_copper_sword":
    case "wpn_iron_sword":
    case "wpn_smacko": {
      const blade = id === "wpn_copper_sword" ? "#c07a42" : id === "wpn_iron_sword" ? "#b0b6bc" : "#d0d4d8";
      return (
        <g {...S}>
          <path d="M18 30 L40 8 L42 6 L40 12 L22 34 Z" fill={blade} />
          <path d="M12 26 L26 40" stroke="#1c1916" strokeWidth={6} />
          <path d="M12 26 L26 40" stroke={id === "wpn_smacko" ? "#b5893a" : "#55595e"} strokeWidth={3} />
          <path d="M8 44 L18 32" stroke="#3c2a1c" strokeWidth={5} />
          {id === "wpn_smacko" && <circle cx="19" cy="33" r="3" fill="#b5893a" />}
        </g>
      );
    }
    case "wpn_cookie_blade":
      return (
        <g {...S}>
          <path d="M18 30 L40 8 L43 5 L40 13 L22 34 Z" fill="#8e2f2f" />
          <path d="M21 27 L40 8" stroke="#d4a64a" strokeWidth={1.5} />
          <circle cx="18" cy="33" r="6" fill="none" stroke="#b5893a" strokeWidth={3} />
          <path d="M8 44 L15 36" stroke="#8e2f2f" strokeWidth={5} />
          <circle cx="7" cy="45" r="3" fill="#1c1916" />
        </g>
      );
    case "wpn_stone_pick":
    case "wpn_copper_pick":
    case "wpn_cookie_pick": {
      const head = id === "wpn_cookie_pick" ? "#b5893a" : id === "wpn_copper_pick" ? "#c07a42" : "#7a7670";
      const haft = id === "wpn_cookie_pick" ? "#8e2f2f" : "#7a5e40";
      return (
        <g {...S}>
          <path d="M14 42 L32 12" stroke="#1c1916" strokeWidth={6} />
          <path d="M14 42 L32 12" stroke={haft} strokeWidth={3} />
          <path d="M14 10 C22 6 34 8 42 18 L38 20 C32 14 24 12 16 14 Z" fill={head} />
        </g>
      );
    }
    case "key_cookie_core":
      return (
        <g {...S}>
          <circle cx="24" cy="24" r="13" fill="#b5893a" />
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
            const a = (i / 8) * Math.PI * 2;
            return <rect key={i} x={24 + Math.cos(a) * 15 - 2.5} y={24 + Math.sin(a) * 15 - 2.5} width="5" height="5" fill="#b5893a" transform={`rotate(${(a * 180) / Math.PI} ${24 + Math.cos(a) * 15} ${24 + Math.sin(a) * 15})`} />;
          })}
          <circle cx="24" cy="24" r="6" fill="#8e2f2f" />
          <circle cx="22" cy="22" r="2" fill="#ffe8c0" stroke="none" />
        </g>
      );
    case "arm_stump_shield":
      return (
        <g {...S}>
          <circle cx="24" cy="24" r="16" fill="#7a5e40" />
          <circle cx="24" cy="24" r="11" fill="none" stroke="#a88c66" />
          <circle cx="24" cy="24" r="6" fill="none" stroke="#a88c66" />
          <circle cx="24" cy="24" r="3" fill="#55595e" />
        </g>
      );
    case "arm_cloth":
      return (
        <g {...S}>
          <path d="M16 8 L32 8 L40 16 L36 20 L34 18 L34 40 L14 40 L14 18 L12 20 L8 16 Z" fill="#cdbba6" />
          <path d="M20 8 C22 12 26 12 28 8" />
        </g>
      );
    case "cons_bandage":
      return (
        <g {...S}>
          <rect x="8" y="16" width="26" height="16" rx="8" fill="#e8dcc6" />
          <path d="M30 20 L42 24 L40 30 L30 28" fill="#e8dcc6" />
          <path d="M16 20 v8 M22 20 v8" stroke="#b5a68a" />
          <path d="M18 24 h6 M21 21 v6" stroke="#8e2f2f" strokeWidth={2.5} />
        </g>
      );
    default:
      return <circle cx="24" cy="24" r="12" {...S} fill="#a39888" />;
  }
}

export function Glyph({ name, size = 26 }: { name: "sword" | "dodge" | "shield" | "flame" | "hand" | "bag" | "menu" | "heal" | "close" | "speak" | "gather" | "door"; size?: number }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 2.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden>
      {name === "sword" && (
        <g {...p}>
          <path d="M8 24 L24 6 L26 6 L26 8 L8 26" />
          <path d="M6 20 L12 26 M5 27 L8 24" />
        </g>
      )}
      {name === "dodge" && (
        <g {...p}>
          <path d="M6 22 C10 10 20 8 26 12" />
          <path d="M22 8 L26 12 L21 15" />
          <circle cx="9" cy="25" r="2" />
        </g>
      )}
      {name === "shield" && <path {...p} d="M16 4 L26 8 C26 18 22 25 16 28 C10 25 6 18 6 8 Z" />}
      {name === "flame" && <path {...p} d="M16 4 C20 10 24 12 24 19 A8 8 0 0 1 8 19 C8 14 12 13 12 8 C14 10 15 11 16 13 C17 10 17 7 16 4 Z" />}
      {name === "hand" && <path {...p} d="M10 16 V8 a2 2 0 0 1 4 0 V15 V6 a2 2 0 0 1 4 0 V15 V8 a2 2 0 0 1 4 0 V18 C22 24 19 28 14 28 C10 28 8 25 6 21 L5 18 a2 2 0 0 1 3.5 -2 Z" />}
      {name === "bag" && (
        <g {...p}>
          <path d="M8 12 H24 L26 28 H6 Z" />
          <path d="M12 12 V9 a4 4 0 0 1 8 0 V12" />
        </g>
      )}
      {name === "menu" && <path {...p} d="M7 9 H25 M7 16 H25 M7 23 H25" />}
      {name === "heal" && (
        <g {...p}>
          <rect x="5" y="10" width="22" height="12" rx="6" />
          <path d="M16 13 V19 M13 16 H19" />
        </g>
      )}
      {name === "close" && <path {...p} d="M8 8 L24 24 M24 8 L8 24" />}
      {name === "speak" && <path {...p} d="M6 8 H26 V20 H14 L8 25 V20 H6 Z" />}
      {name === "gather" && (
        <g {...p}>
          <path d="M8 26 L20 10" />
          <path d="M12 8 C17 5 24 7 27 13 L24 14 C21 10 17 9 14 10 Z" />
        </g>
      )}
      {name === "door" && (
        <g {...p}>
          <path d="M8 28 V8 a8 8 0 0 1 16 0 V28" />
          <circle cx="20" cy="18" r="1.2" />
        </g>
      )}
    </svg>
  );
}
