/**
 * Flat collision: circles (trunks, rocks, posts) and oriented boxes (walls, buildings).
 * Bucketed into an 8 m grid. Movement is resolved by pushing the mover's circle out.
 */

export type Circle = { x: number; z: number; r: number; on?: () => boolean };
export type Box = { x: number; z: number; hx: number; hz: number; c: number; s: number; on?: () => boolean; tag?: string };

const CELL = 8;

export class Colliders {
  private grid = new Map<number, { c: Circle[]; b: Box[] }>();
  private key(i: number, j: number) {
    return (i + 4096) * 8192 + (j + 4096);
  }
  private cell(i: number, j: number) {
    const k = this.key(i, j);
    let v = this.grid.get(k);
    if (!v) {
      v = { c: [], b: [] };
      this.grid.set(k, v);
    }
    return v;
  }
  circle(x: number, z: number, r: number, on?: () => boolean) {
    const c: Circle = { x, z, r, on };
    for (let i = Math.floor((x - r) / CELL); i <= Math.floor((x + r) / CELL); i++)
      for (let j = Math.floor((z - r) / CELL); j <= Math.floor((z + r) / CELL); j++) this.cell(i, j).c.push(c);
    return c;
  }
  /** Box of full size w × d centred at x,z, rotated by `rot` about y. */
  box(x: number, z: number, w: number, d: number, rot = 0, on?: () => boolean, tag?: string) {
    const b: Box = { x, z, hx: w / 2, hz: d / 2, c: Math.cos(rot), s: Math.sin(rot), on, tag };
    const ext = Math.hypot(w, d) / 2;
    for (let i = Math.floor((x - ext) / CELL); i <= Math.floor((x + ext) / CELL); i++)
      for (let j = Math.floor((z - ext) / CELL); j <= Math.floor((z + ext) / CELL); j++) this.cell(i, j).b.push(b);
    return b;
  }

  /** Push a circle of radius r at (x,z) out of everything it overlaps. */
  resolve(x: number, z: number, r: number) {
    let px = x;
    let pz = z;
    for (let iter = 0; iter < 2; iter++) {
      const i0 = Math.floor((px - r) / CELL);
      const i1 = Math.floor((px + r) / CELL);
      const j0 = Math.floor((pz - r) / CELL);
      const j1 = Math.floor((pz + r) / CELL);
      for (let i = i0; i <= i1; i++)
        for (let j = j0; j <= j1; j++) {
          const v = this.grid.get(this.key(i, j));
          if (!v) continue;
          for (const c of v.c) {
            if (c.on && !c.on()) continue;
            const dx = px - c.x;
            const dz = pz - c.z;
            const d = Math.hypot(dx, dz);
            const min = r + c.r;
            if (d < min) {
              if (d < 1e-4) {
                px += min;
              } else {
                px += (dx / d) * (min - d);
                pz += (dz / d) * (min - d);
              }
            }
          }
          for (const b of v.b) {
            if (b.on && !b.on()) continue;
            // local space: x' = R^T (p - c), using the box rotation about y (x→c, z→s)
            const dx = px - b.x;
            const dz = pz - b.z;
            const lx = dx * b.c - dz * b.s;
            const lz = dx * b.s + dz * b.c;
            const cx = Math.max(-b.hx, Math.min(b.hx, lx));
            const cz = Math.max(-b.hz, Math.min(b.hz, lz));
            let ox = lx - cx;
            let oz = lz - cz;
            let d = Math.hypot(ox, oz);
            if (d >= r) continue;
            if (d < 1e-5) {
              // inside: push out along the shallowest axis
              const ex = b.hx - Math.abs(lx);
              const ez = b.hz - Math.abs(lz);
              if (ex < ez) {
                ox = Math.sign(lx) || 1;
                oz = 0;
                d = -ex;
              } else {
                ox = 0;
                oz = Math.sign(lz) || 1;
                d = -ez;
              }
            } else {
              ox /= d;
              oz /= d;
            }
            const push = r - d;
            const wx = ox * b.c + oz * b.s;
            const wz = -ox * b.s + oz * b.c;
            px += wx * push;
            pz += wz * push;
          }
        }
    }
    return { x: px, z: pz };
  }

  /** True if the point is inside any active box or circle (for camera pull-in). */
  hit(x: number, z: number, pad = 0.2) {
    const v = this.grid.get(this.key(Math.floor(x / CELL), Math.floor(z / CELL)));
    if (!v) return false;
    for (const c of v.c) if ((!c.on || c.on()) && Math.hypot(x - c.x, z - c.z) < c.r + pad) return true;
    for (const b of v.b) {
      if (b.on && !b.on()) continue;
      const dx = x - b.x;
      const dz = z - b.z;
      const lx = dx * b.c - dz * b.s;
      const lz = dx * b.s + dz * b.c;
      if (Math.abs(lx) < b.hx + pad && Math.abs(lz) < b.hz + pad) return true;
    }
    return false;
  }
}
