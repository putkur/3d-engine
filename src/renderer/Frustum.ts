import { Matrix4 } from '../math/Matrix4';

/** A single clip-space plane: Ax + By + Cz + D >= 0 means "inside". */
interface Plane {
  a: number;
  b: number;
  c: number;
  d: number;
  /** 1 / length(a, b, c) — pre-computed for sphere distance tests. */
  invLen: number;
}

/**
 * View frustum represented as 6 clip-space planes extracted from a
 * combined view-projection matrix.
 *
 * Uses Gribb/Hartmann plane extraction on a column-major gl-matrix layout.
 * Planes order: [left, right, bottom, top, near, far].
 */
export class Frustum {
  private readonly _planes: Plane[] = new Array<Plane>(6).fill(
    { a: 0, b: 0, c: 0, d: 0, invLen: 0 },
  );

  /**
   * (Re-)populate the 6 frustum planes from a combined view-projection matrix.
   *
   * For a column-major mat4 `m`, element at logical [row r, col c] = m[c*4 + r]:
   *   row0 = m[0],  m[4],  m[8],  m[12]
   *   row1 = m[1],  m[5],  m[9],  m[13]
   *   row2 = m[2],  m[6],  m[10], m[14]
   *   row3 = m[3],  m[7],  m[11], m[15]
   *
   * Clip-space planes (right-hand, NDC [-1, 1] on all axes):
   *   left   = row3 + row0
   *   right  = row3 - row0
   *   bottom = row3 + row1
   *   top    = row3 - row1
   *   near   = row3 + row2
   *   far    = row3 - row2
   */
  fromViewProjection(vp: Matrix4): this {
    const m = vp.data;

    // Extract row vectors (column-major indexing)
    const r0x = m[0],  r0y = m[4],  r0z = m[8],  r0w = m[12];
    const r1x = m[1],  r1y = m[5],  r1z = m[9],  r1w = m[13];
    const r2x = m[2],  r2y = m[6],  r2z = m[10], r2w = m[14];
    const r3x = m[3],  r3y = m[7],  r3z = m[11], r3w = m[15];

    this._planes[0] = makePlane(r3x + r0x, r3y + r0y, r3z + r0z, r3w + r0w);   // left
    this._planes[1] = makePlane(r3x - r0x, r3y - r0y, r3z - r0z, r3w - r0w);   // right
    this._planes[2] = makePlane(r3x + r1x, r3y + r1y, r3z + r1z, r3w + r1w);   // bottom
    this._planes[3] = makePlane(r3x - r1x, r3y - r1y, r3z - r1z, r3w - r1w);   // top
    this._planes[4] = makePlane(r3x + r2x, r3y + r2y, r3z + r2z, r3w + r2w);   // near
    this._planes[5] = makePlane(r3x - r2x, r3y - r2y, r3z - r2z, r3w - r2w);   // far

    return this;
  }

  /**
   * Test whether a sphere is (at least partially) inside the frustum.
   * Returns false only when the sphere is entirely beyond one of the clip planes.
   *
   * @param cx - World-space center X
   * @param cy - World-space center Y
   * @param cz - World-space center Z
   * @param radius - Sphere radius
   */
  containsSphere(cx: number, cy: number, cz: number, radius: number): boolean {
    for (let i = 0; i < 6; i++) {
      const p = this._planes[i];
      // Normalised signed distance from center to plane
      const dist = (p.a * cx + p.b * cy + p.c * cz + p.d) * p.invLen;
      if (dist < -radius) return false;
    }
    return true;
  }

  /**
   * Conservative AABB test using the "positive vertex" method.
   * Returns false only when the box is entirely beyond one of the clip planes.
   */
  containsBox(
    minX: number, minY: number, minZ: number,
    maxX: number, maxY: number, maxZ: number,
  ): boolean {
    for (let i = 0; i < 6; i++) {
      const p = this._planes[i];
      // Positive vertex = corner most in the plane-normal direction
      const px = p.a >= 0 ? maxX : minX;
      const py = p.b >= 0 ? maxY : minY;
      const pz = p.c >= 0 ? maxZ : minZ;
      if (p.a * px + p.b * py + p.c * pz + p.d < 0) return false;
    }
    return true;
  }
}

function makePlane(a: number, b: number, c: number, d: number): Plane {
  const len = Math.sqrt(a * a + b * b + c * c);
  const invLen = len > 1e-12 ? 1 / len : 0;
  return { a, b, c, d, invLen };
}
