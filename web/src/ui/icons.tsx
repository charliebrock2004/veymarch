import { ITEMS } from "../game/data/items";
/** Hand-drawn item icons in the art bible's palette. */

const S = { fill: "none", stroke: "#17110c", strokeWidth: 1.8, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

const GLOW: Record<string, string> = { uncommon: "#7fae5a", rare: "#5a8fd0", epic: "#a56ad8", legendary: "#e2a53c", unique: "#e2a53c" };

/**
 * Mounted once at the app root. Every item icon is drawn flat and then lit by this filter:
 * a soft bevel from the upper left, a warm bounce from below, and a contact shadow, so the
 * whole set reads as painted objects under one light.
 */
export function IconDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
      <defs>
        <filter id="vm-paint" x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceAlpha" stdDeviation="1.6" result="bump" />
          <feSpecularLighting in="bump" surfaceScale="3.2" specularConstant="0.75" specularExponent="14" lightingColor="#fff1d0" result="spec">
            <feDistantLight azimuth="225" elevation="48" />
          </feSpecularLighting>
          <feComposite in="spec" in2="SourceAlpha" operator="in" result="specIn" />
          <feDiffuseLighting in="bump" surfaceScale="2.6" diffuseConstant="1.05" lightingColor="#ffffff" result="diff">
            <feDistantLight azimuth="225" elevation="58" />
          </feDiffuseLighting>
          <feComposite in="SourceGraphic" in2="diff" operator="arithmetic" k1="0.82" k2="0.3" k3="0" k4="0" result="lit" />
          <feComposite in="lit" in2="SourceAlpha" operator="in" result="litIn" />
          <feComposite in="specIn" in2="litIn" operator="arithmetic" k1="0" k2="0.55" k3="1" k4="0" result="shaded" />
          <feComposite in="shaded" in2="SourceAlpha" operator="in" result="obj" />
          <feGaussianBlur in="SourceAlpha" stdDeviation="1.4" result="sh" />
          <feOffset in="sh" dx="1" dy="2" result="shOff" />
          <feComponentTransfer in="shOff" result="shadow">
            <feFuncA type="linear" slope="0.6" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode in="shadow" />
            <feMergeNode in="obj" />
          </feMerge>
        </filter>
        <radialGradient id="vm-glow-uncommon"><stop offset="0" stopColor={GLOW.uncommon} stopOpacity="0.5" /><stop offset="1" stopColor={GLOW.uncommon} stopOpacity="0" /></radialGradient>
        <radialGradient id="vm-glow-rare"><stop offset="0" stopColor={GLOW.rare} stopOpacity="0.55" /><stop offset="1" stopColor={GLOW.rare} stopOpacity="0" /></radialGradient>
        <radialGradient id="vm-glow-epic"><stop offset="0" stopColor={GLOW.epic} stopOpacity="0.6" /><stop offset="1" stopColor={GLOW.epic} stopOpacity="0" /></radialGradient>
        <radialGradient id="vm-glow-legendary"><stop offset="0" stopColor={GLOW.legendary} stopOpacity="0.65" /><stop offset="1" stopColor={GLOW.legendary} stopOpacity="0" /></radialGradient>
        <radialGradient id="vm-glow-unique"><stop offset="0" stopColor={GLOW.unique} stopOpacity="0.7" /><stop offset="1" stopColor={GLOW.unique} stopOpacity="0" /></radialGradient>
      </defs>
    </svg>
  );
}

export function ItemIcon({ id, size = 44 }: { id: string; size?: number }) {
  const rar = ITEMS[id]?.rarity;
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden>
      {rar && rar !== "common" && <circle cx="24" cy="24" r="23" fill={`url(#vm-glow-${rar})`} />}
      <g filter="url(#vm-paint)">{art(id)}</g>
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
    case "mat_coal":
      return (
        <g {...S}>
          <path d="M8 34 L12 22 L22 16 L30 20 L40 18 L42 30 L34 38 L16 38 Z" fill="#2b2927" />
          <path d="M12 22 L20 28 L30 20 M20 28 L16 38 M20 28 L34 30 L42 30 M34 30 L34 38" stroke="#55504a" />
          <path d="M24 20 l4 2" stroke="#8a847c" />
        </g>
      );
    case "mat_wheat":
      return (
        <g {...S}>
          <path d="M24 44 V22 M17 44 C17 34 14 28 12 22 M31 44 C31 34 34 28 36 22" stroke="#a8842e" strokeWidth={2.4} />
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <ellipse cx="21" cy={20 - i * 5} rx="3" ry="4" fill="#e2bd58" transform={`rotate(-28 21 ${20 - i * 5})`} />
              <ellipse cx="27" cy={20 - i * 5} rx="3" ry="4" fill="#e2bd58" transform={`rotate(28 27 ${20 - i * 5})`} />
            </g>
          ))}
          <ellipse cx="24" cy="5" rx="2.6" ry="4" fill="#efd27a" />
          <ellipse cx="11" cy="18" rx="2.6" ry="4.5" fill="#d8b04c" transform="rotate(-20 11 18)" />
          <ellipse cx="37" cy="18" rx="2.6" ry="4.5" fill="#d8b04c" transform="rotate(20 37 18)" />
          <path d="M14 36 h20" stroke="#8e2f2f" strokeWidth={3} />
        </g>
      );
    case "mat_meat":
      return (
        <g {...S}>
          <path d="M10 26 C8 14 22 6 32 12 C42 18 40 32 30 36 C20 40 12 36 10 26 Z" fill="#a8443a" />
          <path d="M16 24 C16 17 24 13 30 17 C35 21 33 28 27 30 C21 32 16 30 16 24 Z" fill="#d07a66" stroke="#7a2e28" />
          <circle cx="25" cy="23" r="3.4" fill="#efe6d2" />
          <path d="M33 34 L40 41" stroke="#17110c" strokeWidth={6} />
          <path d="M33 34 L40 41" stroke="#efe6d2" strokeWidth={3.4} />
          <circle cx="41" cy="42" r="2.6" fill="#efe6d2" />
        </g>
      );
    case "mat_hound_hide":
      return (
        <g {...S}>
          <path d="M12 8 C18 12 30 12 36 8 C37 15 43 19 41 28 C37 32 38 41 31 41 C27 36 21 36 17 41 C10 41 11 32 7 28 C5 19 11 15 12 8 Z" fill="#2e2a26" />
          <path d="M15 17 l3 4 M22 14 l1 5 M30 16 l-2 5 M14 27 l4 2 M33 26 l-4 3 M23 26 l2 5" stroke="#5a524a" />
          <path d="M12 8 C18 12 30 12 36 8" stroke="#6a5a48" />
        </g>
      );
    case "mat_boe_fang":
      return (
        <g {...S}>
          <path d="M14 8 C22 6 32 8 36 12 C34 26 28 38 20 44 C22 32 18 20 14 8 Z" fill="#efe8d8" />
          <path d="M14 8 C22 6 32 8 36 12 C30 14 20 13 14 8 Z" fill="#b89a8a" />
          <path d="M24 18 C26 26 25 33 22 39" stroke="#b8ac96" />
        </g>
      );
    case "mat_ember_shard":
      return (
        <g {...S}>
          <path d="M24 4 L34 20 L28 44 L16 30 Z" fill="#ff8a30" />
          <path d="M24 4 L24 24 L28 44 M16 30 L24 24 L34 20" stroke="#ffd58a" />
          <path d="M24 4 L16 30 L24 24 Z" fill="#c8481c" stroke="none" opacity={0.75} />
          <circle cx="38" cy="10" r="1.4" fill="#ffd58a" stroke="none" />
          <circle cx="10" cy="18" r="1.1" fill="#ffb060" stroke="none" />
        </g>
      );
    case "mat_grave_iron":
      return (
        <g {...S}>
          <path d="M6 30 L14 20 H40 L34 30 Z" fill="#59626a" />
          <path d="M6 30 V37 H34 V30 M34 37 L40 28 V20" fill="#353c44" />
          <path d="M16 23 h10 M20 26 h8" stroke="#9bd0c0" />
          <path d="M12 33 l3 2 l2 -3 M26 32 l2 3" stroke="#17110c" strokeWidth={1.2} />
        </g>
      );
    case "mat_grave_dust":
      return (
        <g {...S}>
          <path d="M12 40 C8 30 14 20 18 16 H30 C34 20 40 30 36 40 C30 44 18 44 12 40 Z" fill="#7a6e60" />
          <path d="M17 16 C20 12 28 12 31 16" fill="#5a4e42" />
          <path d="M18 14 H30" stroke="#b5893a" strokeWidth={2.6} />
          <path d="M20 9 C22 5 26 5 28 9 C26 11 22 11 20 9 Z" fill="#cfc8ba" />
          <path d="M18 28 c4 3 8 3 12 0" stroke="#a89c8a" />
        </g>
      );
    case "mat_tallow":
      return (
        <g {...S}>
          <path d="M16 40 V20 C16 17 32 17 32 20 V40 C32 43 16 43 16 40 Z" fill="#e8dcb8" />
          <path d="M16 22 C20 25 28 25 32 22" stroke="#b8a878" />
          <path d="M20 22 V30 C20 32 23 32 23 30" stroke="#b8a878" />
          <path d="M24 19 V14" stroke="#17110c" />
          <path d="M24 4 C28 8 28 12 24 14 C20 12 20 8 24 4 Z" fill="#ffb648" stroke="#c8641c" />
        </g>
      );
    case "mat_ruined_banner":
      return (
        <g {...S}>
          <path d="M10 6 V44" stroke="#5a4634" strokeWidth={3} />
          <path d="M10 8 H38 V30 L33 26 L29 34 L24 27 L19 36 L15 28 L10 32 Z" fill="#7a2a2a" />
          <path d="M24 12 l3 5 h5 l-4 4 l2 5 l-6 -3 l-6 3 l2 -5 l-4 -4 h5 z" fill="#c9a44e" stroke="#5a2020" />
          <circle cx="10" cy="6" r="2.6" fill="#b5893a" />
        </g>
      );
    case "key_crown_shard":
      return (
        <g {...S}>
          <path d="M8 36 L10 16 L18 26 L24 10 L30 24 L36 20 L34 30 L28 36 Z" fill="#c9a44e" />
          <path d="M8 36 H28" stroke="#7a5a1e" strokeWidth={3} />
          <path d="M34 30 L40 34 L36 38" stroke="#7a5a1e" />
          <circle cx="24" cy="29" r="3" fill="#5ad0b8" />
          <circle cx="14" cy="30" r="2" fill="#8e2f2f" />
        </g>
      );
    case "key_red_collar":
      return (
        <g {...S}>
          <ellipse cx="24" cy="22" rx="16" ry="11" fill="none" stroke="#17110c" strokeWidth={8} />
          <ellipse cx="24" cy="22" rx="16" ry="11" fill="none" stroke="#a83232" strokeWidth={5} />
          <rect x="19" y="29" width="10" height="8" rx="1.5" fill="#c9a44e" />
          <circle cx="24" cy="41" r="3.4" fill="#d7b458" />
          <path d="M10 20 l2 1 M36 20 l2 1 M17 13 l1 2 M30 13 l-1 2" stroke="#d7b458" />
        </g>
      );
    case "trk_hound_bell":
      return (
        <g {...S}>
          <path d="M24 6 V12" stroke="#8e2f2f" strokeWidth={3} />
          <path d="M12 34 C12 18 16 12 24 12 C32 12 36 18 36 34 Z" fill="#c9a44e" />
          <path d="M9 34 H39" stroke="#8a6a26" strokeWidth={3.4} />
          <circle cx="24" cy="39" r="3.2" fill="#6a4e34" />
          <path d="M18 20 C19 17 21 16 23 16" stroke="#f4e2a8" />
        </g>
      );
    case "cons_last_rites":
      return (
        <g {...S}>
          <path d="M20 6 H28 V15 C35 18 38 24 38 31 C38 39 31 43 24 43 C17 43 10 39 10 31 C10 24 13 18 20 15 Z" fill="#cfd8d4" />
          <path d="M12 30 C12 39 19 41 24 41 C30 41 36 38 36 30 Z" fill="#5ad0b8" />
          <path d="M19 6 H29" stroke="#6a4e34" strokeWidth={3.4} />
          <path d="M24 22 V36 M19 27 H29" stroke="#f2fbf6" strokeWidth={2.4} />
        </g>
      );
    default:
      return generic(id);
  }
}

const TIER_METAL = ["#a39888", "#8a7a68", "#8a847a", "#c07a42", "#9aa0a6", "#d4d8de", "#3a3c42"];

function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
}

/** Icons for items without a drawn one, from what they are: a family, a slot, a tier. */
function generic(id: string) {
  const d = ITEMS[id];
  if (!d) return <circle cx="24" cy="24" r="12" {...S} fill="#a39888" />;
  const metal = id === "wpn_ember_sword" ? "#e0a070" : id === "wpn_finlay_longsword" || d.set === "bk" ? "#2c2e34" : d.set === "hound" ? "#2a2622" : TIER_METAL[Math.min(6, d.tier)];
  const trim = d.rarity === "unique" || d.rarity === "legendary" ? "#d7a441" : "#4a3a2a";
  if (id === "coin_crown")
    return (
      <g {...S}>
        <circle cx="20" cy="26" r="11" fill="#c9b48a" />
        <circle cx="28" cy="22" r="11" fill="#e4d2a6" />
        <path d="M22 22 l3 -5 l3 4 l3 -4 l3 5 v4 h-12 z" fill="#b5893a" />
      </g>
    );
  if (d.kind === "weapon") {
    switch (d.family) {
      case "axe":
        return (
          <g {...S}>
            <path d="M12 40 L32 12" stroke="#6a4e34" strokeWidth={4} />
            <path d="M26 10 C34 6 42 12 40 22 C36 18 32 18 28 20 Z" fill={metal} />
          </g>
        );
      case "mace":
        return (
          <g {...S}>
            <path d="M12 40 L28 20" stroke="#4a3a2a" strokeWidth={4} />
            <circle cx="31" cy="16" r="8" fill={metal} />
            <path d="M31 4 v6 M31 22 v6 M19 16 h6 M37 16 h6" stroke={metal} strokeWidth={3} />
          </g>
        );
      case "spear":
        return (
          <g {...S}>
            <path d="M8 42 L34 14" stroke="#7a5e40" strokeWidth={3} />
            <path d="M32 16 L42 6 L38 18 Z" fill={metal} />
          </g>
        );
      case "dagger":
        return (
          <g {...S}>
            <path d="M14 36 L22 28" stroke="#4a3a2a" strokeWidth={4} />
            <path d="M18 26 L22 30 M20 28 L36 12 L38 10 L36 16 Z" fill={metal} />
          </g>
        );
      case "pick":
        return (
          <g {...S}>
            <path d="M14 40 L30 18" stroke="#6a4e34" strokeWidth={4} />
            <path d="M18 12 C26 8 36 10 42 18 C34 14 26 14 18 12 Z" fill={metal} />
          </g>
        );
      default: {
        const big = d.family === "greatsword";
        return (
          <g {...S}>
            <path d={big ? "M10 38 L36 8 L40 8 L40 12 L14 42 Z" : "M12 36 L34 12 L38 12 L38 16 L16 38 Z"} fill={metal} />
            <path d={big ? "M8 32 L18 42 M6 44 L10 40" : "M10 30 L18 38 M8 40 L12 36"} stroke={trim} strokeWidth={3} />
            {id === "wpn_ember_sword" && <path d="M18 32 L34 14" stroke="#ff8a30" strokeWidth={2} />}
          </g>
        );
      }
    }
  }
  if (d.kind === "armour") {
    const dark = shade(metal, 0.62);
    const lite = shade(metal, 1.25);
    const soft = d.set === "leather" || d.tier <= 1;
    switch (d.slot) {
      case "head":
        return soft ? (
          <g {...S}>
            <path d="M10 32 C8 14 40 14 38 32 C36 36 34 40 32 40 C30 34 18 34 16 40 C14 40 12 36 10 32 Z" fill={metal} />
            <path d="M12 26 C18 22 30 22 36 26" stroke={dark} strokeWidth={2.6} />
            <path d="M24 13 V24" stroke={dark} />
          </g>
        ) : (
          <g {...S}>
            <path d="M10 30 C10 10 38 10 38 30 V40 H30 V32 H18 V40 H10 Z" fill={metal} />
            <path d="M24 9 V32" stroke={dark} strokeWidth={2.6} />
            <path d="M12 26 H36" stroke={trim} strokeWidth={2.6} />
            <path d="M17 29 H22 M26 29 H31" stroke="#17110c" strokeWidth={2.6} />
            <path d="M24 9 C28 3 34 4 36 8" stroke={trim} strokeWidth={2.6} />
            <path d="M15 18 c2 -3 4 -4 6 -5" stroke={lite} />
          </g>
        );
      case "chest":
        return (
          <g {...S}>
            <path d="M15 12 C19 16 29 16 33 12 L38 16 V40 C30 43 18 43 10 40 V16 Z" fill={metal} />
            <path d="M4 20 C4 12 10 9 16 11 L15 22 C11 24 6 23 4 20 Z M44 20 C44 12 38 9 32 11 L33 22 C37 24 42 23 44 20 Z" fill={lite} />
            <path d="M24 16 V41" stroke={dark} />
            <path d="M11 30 C19 33 29 33 37 30 M11 36 C19 39 29 39 37 36" stroke={dark} />
            <path d="M15 12 C19 16 29 16 33 12" stroke={trim} strokeWidth={2.6} />
          </g>
        );
      case "hands":
        return (
          <g {...S}>
            <path d="M14 26 V14 c0 -3 5 -3 5 0 V11 c0 -3 5 -3 5 0 V13 c0 -3 5 -3 5 0 V17 c0 -3 5 -3 5 0 V28 Z" fill={metal} />
            <path d="M14 22 C10 20 8 24 12 28" fill={metal} />
            <path d="M11 27 H36 L38 42 H10 Z" fill={lite} />
            <path d="M11 32 H37 M10.5 37 H37.5" stroke={dark} />
            <path d="M19 14 V24 M24 13 V24 M29 16 V24" stroke={dark} />
            <path d="M11 27 H36" stroke={trim} strokeWidth={2.6} />
          </g>
        );
      case "legs":
        return (
          <g {...S}>
            <path d="M12 6 H36 L37 18 L34 42 H26 L24 22 L22 42 H14 L11 18 Z" fill={metal} />
            <path d="M12 6 H36 V11 H12 Z" fill={dark} />
            <ellipse cx="17.5" cy="26" rx="4.5" ry="4" fill={lite} />
            <ellipse cx="30.5" cy="26" rx="4.5" ry="4" fill={lite} />
            <path d="M22 9 H26" stroke={trim} strokeWidth={3} />
            <path d="M15 34 H21 M27 34 H33" stroke={dark} />
          </g>
        );
      case "feet":
        return (
          <g {...S}>
            <path d="M14 6 H26 V26 C32 26 40 28 42 34 V38 H14 Z" fill={metal} />
            <path d="M12 38 H43 V42 H12 Z" fill={dark} />
            <path d="M12 6 H28 V12 H12 Z" fill={lite} />
            <path d="M26 26 C22 26 18 28 15 31 M30 28 l-2 5 M35 30 l-2 5" stroke={dark} />
            <path d="M12 12 H28" stroke={trim} strokeWidth={2.2} />
          </g>
        );
      case "off":
        return (
          <g {...S}>
            <path d="M8 8 C18 12 30 12 40 8 V22 C40 33 31 39 24 44 C17 39 8 33 8 22 Z" fill={metal} />
            <path d="M24 11 V43 M9 22 H39" stroke={trim} strokeWidth={2.6} />
            <circle cx="24" cy="22" r="4.5" fill={lite} />
            <path d="M12 13 C12 22 13 28 18 33" stroke={lite} />
          </g>
        );
    }
  }
  if (d.kind === "trinket")
    return (
      <g {...S}>
        <path d="M16 34 C16 22 32 22 32 34 Z" fill="#b5893a" />
        <circle cx="24" cy="36" r="3" fill="#6a4e34" />
        <path d="M24 22 V14" stroke="#8e2f2f" strokeWidth={3} />
      </g>
    );
  if (d.kind === "consumable") {
    const liquid = id.includes("draught") ? "#c8384a" : id.includes("tonic") ? "#6a9a4a" : "#c89a5a";
    if (id === "cons_bread")
      return (
        <g {...S}>
          <ellipse cx="24" cy="28" rx="16" ry="10" fill="#c8964e" />
          <path d="M14 26 l4 -4 M22 24 l4 -4 M30 26 l4 -4" stroke="#8a5e2e" />
        </g>
      );
    if (id === "cons_roast" || id === "cons_stew")
      return (
        <g {...S}>
          <ellipse cx="24" cy="32" rx="16" ry="7" fill="#7a5e40" />
          <ellipse cx="24" cy="28" rx="12" ry="6" fill={id === "cons_stew" ? "#a06030" : "#8a3e22"} />
        </g>
      );
    return (
      <g {...S}>
        <path d="M20 8 H28 V16 C34 18 36 24 36 30 C36 38 30 42 24 42 C18 42 12 38 12 30 C12 24 14 18 20 16 Z" fill="#d8d0c0" />
        <path d="M14 30 C14 38 20 40 24 40 C30 40 34 36 34 30 Z" fill={liquid} />
      </g>
    );
  }
  if (id.startsWith("herb_")) {
    const petal = id === "herb_marigold" ? "#e88a2a" : id === "herb_rotcap" ? "#8a7460" : "#d6dcea";
    const core = id === "herb_marigold" ? "#8a4a12" : id === "herb_rotcap" ? "#4a3a30" : "#7a6aa8";
    return (
      <g {...S}>
        <path d="M24 44 C24 34 23 28 24 20" stroke="#4e5c36" strokeWidth={2.6} />
        <path d="M24 34 C16 34 11 30 10 24 C17 24 22 28 24 34 Z M24 30 C31 30 36 27 38 21 C31 21 26 24 24 30 Z" fill="#6f8748" />
        {id === "herb_rotcap" ? (
          <>
            <path d="M10 20 C10 8 38 8 38 20 C30 23 18 23 10 20 Z" fill={petal} />
            <circle cx="18" cy="15" r="2" fill="#c8b8a0" stroke="none" />
            <circle cx="28" cy="13" r="1.6" fill="#c8b8a0" stroke="none" />
            <circle cx="31" cy="18" r="1.3" fill="#c8b8a0" stroke="none" />
          </>
        ) : (
          <>
            {[0, 60, 120, 180, 240, 300].map((r) => (
              <ellipse key={r} cx="24" cy="8" rx="4" ry="6" fill={petal} transform={`rotate(${r} 24 15)`} />
            ))}
            <circle cx="24" cy="15" r="3.6" fill={core} />
          </>
        )}
      </g>
    );
  }
  // materials: a lump in its colour
  const col: Record<string, string> = { mat_coal: "#2a2826", mat_steel: "#c8ccd2", mat_black_iron: "#34363c", mat_wheat: "#d8b860", mat_meat: "#b05a4a", mat_hound_hide: "#2c2824", mat_boe_fang: "#efe8d8", mat_ember_shard: "#ff8a30" };
  if (id === "mat_steel" || id === "mat_black_iron")
    return (
      <g {...S}>
        <path d="M8 30 L16 20 H40 L32 30 Z" fill={col[id]} />
        <path d="M8 30 V36 H32 V30 M32 36 L40 26 V20" fill="#6a6e74" />
      </g>
    );
  return (
    <g {...S}>
      <path d="M10 32 C10 20 18 12 28 14 C38 16 42 26 36 34 C30 40 14 40 10 32 Z" fill={col[id] ?? "#a39888"} />
    </g>
  );
}

export function Glyph({ name, size = 26 }: { name: "sword" | "dodge" | "shield" | "flame" | "hand" | "bag" | "menu" | "heal" | "close" | "speak" | "gather" | "door" | "book" | "target"; size?: number }) {
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
      {name === "target" && (
        <>
          <circle {...p} cx="16" cy="16" r="8" />
          <path {...p} d="M16 3 V9 M16 23 V29 M3 16 H9 M23 16 H29" />
        </>
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
      {name === "book" && (
        <g {...p}>
          <path d="M6 8 C10 6 14 6 16 9 C18 6 22 6 26 8 V25 C22 23 18 23 16 26 C14 23 10 23 6 25 Z" />
          <path d="M16 9 V26" />
        </g>
      )}
    </svg>
  );
}
