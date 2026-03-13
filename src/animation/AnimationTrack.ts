/**
 * Interpolation modes supported by an AnimationTrack.
 * Matches glTF 2.0 animation sampler interpolation values.
 */
export const enum Interpolation {
  STEP = 'STEP',
  LINEAR = 'LINEAR',
  CUBICSPLINE = 'CUBICSPLINE',
}

/**
 * The animated property on a target node.
 */
export type TargetPath = 'position' | 'rotation' | 'scale' | 'weights';

/**
 * A single channel of animation data for one property on one target node.
 *
 * - `times`  : monotonically increasing keyframe timestamps in seconds.
 * - `values` : packed keyframe values.
 *   - position/scale  : 3 floats per keyframe (x, y, z)
 *   - rotation        : 4 floats per keyframe (x, y, z, w)
 *   - weights         : `numTargets` floats per keyframe
 *   - CUBICSPLINE     : values are `[in-tangent, value, out-tangent]` triples
 */
export class AnimationTrack {
  public readonly targetNodeName: string;
  public readonly targetPath: TargetPath;
  public readonly times: Float32Array;
  public readonly values: Float32Array;
  public readonly interpolation: Interpolation;

  /** Number of components per keyframe value (e.g. 3 for position, 4 for rotation). */
  public readonly components: number;

  constructor(
    targetNodeName: string,
    targetPath: TargetPath,
    times: Float32Array,
    values: Float32Array,
    interpolation: Interpolation = Interpolation.LINEAR,
  ) {
    this.targetNodeName = targetNodeName;
    this.targetPath = targetPath;
    this.times = times;
    this.values = values;
    this.interpolation = interpolation;

    if (targetPath === 'rotation') {
      this.components = 4;
    } else if (targetPath === 'position' || targetPath === 'scale') {
      this.components = 3;
    } else {
      // weights — derive from data
      const keyCount = times.length;
      this.components = keyCount > 0 ? values.length / keyCount : 1;
    }
  }

  /** Duration of this track in seconds. */
  get duration(): number {
    return this.times.length > 0 ? this.times[this.times.length - 1] : 0;
  }

  /**
   * Sample the track at time `t` (clamped to [0, duration]).
   * Returns a new number[] with the interpolated value.
   */
  evaluate(t: number): number[] {
    const times = this.times;
    const values = this.values;
    const n = times.length;

    if (n === 0) return [];
    if (n === 1) return this.getKeyframe(0);

    // Clamp to track extents
    if (t <= times[0]) return this.getKeyframe(0);
    if (t >= times[n - 1]) return this.getKeyframe(n - 1);

    // Find surrounding keyframe indices
    let hi = 1;
    while (hi < n && times[hi] < t) hi++;
    const lo = hi - 1;

    const t0 = times[lo];
    const t1 = times[hi];
    const alpha = (t - t0) / (t1 - t0);

    switch (this.interpolation) {
      case Interpolation.STEP:
        return this.getKeyframe(lo);

      case Interpolation.LINEAR:
        return this.interpolateLinear(lo, hi, alpha);

      case Interpolation.CUBICSPLINE:
        return this.interpolateCubic(lo, hi, alpha, t1 - t0);

      default:
        return this.interpolateLinear(lo, hi, alpha);
    }
  }

  // ---------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------

  private getKeyframe(idx: number): number[] {
    const c = this.components;
    if (this.interpolation === Interpolation.CUBICSPLINE) {
      // CUBICSPLINE packs [inTangent(c), value(c), outTangent(c)] per keyframe
      const base = idx * c * 3 + c; // skip inTangent, take value
      return Array.from(this.values.subarray(base, base + c));
    }
    const base = idx * c;
    return Array.from(this.values.subarray(base, base + c));
  }

  private interpolateLinear(lo: number, hi: number, alpha: number): number[] {
    const c = this.components;
    const a = this.getKeyframe(lo);
    const b = this.getKeyframe(hi);
    const out: number[] = new Array(c);

    if (this.targetPath === 'rotation') {
      // Quaternion slerp
      out[0] = this.slerpComponent(a, b, alpha, c);
      return this.slerpQuat(a, b, alpha);
    }

    for (let i = 0; i < c; i++) {
      out[i] = a[i] + (b[i] - a[i]) * alpha;
    }
    return out;
  }

  private slerpQuat(a: number[], b: number[], t: number): number[] {
    let ax = a[0], ay = a[1], az = a[2], aw = a[3];
    let bx = b[0], by = b[1], bz = b[2], bw = b[3];

    // Ensure shortest path
    let dot = ax * bx + ay * by + az * bz + aw * bw;
    if (dot < 0) { bx = -bx; by = -by; bz = -bz; bw = -bw; dot = -dot; }

    if (dot > 0.9995) {
      // Lerp + normalize
      const rx = ax + t * (bx - ax);
      const ry = ay + t * (by - ay);
      const rz = az + t * (bz - az);
      const rw = aw + t * (bw - aw);
      const len = Math.sqrt(rx * rx + ry * ry + rz * rz + rw * rw);
      return len > 0 ? [rx / len, ry / len, rz / len, rw / len] : [0, 0, 0, 1];
    }

    const theta0 = Math.acos(dot);
    const theta = theta0 * t;
    const sinTheta0 = Math.sin(theta0);
    const sinTheta = Math.sin(theta);
    const s0 = Math.cos(theta) - dot * sinTheta / sinTheta0;
    const s1 = sinTheta / sinTheta0;

    return [
      s0 * ax + s1 * bx,
      s0 * ay + s1 * by,
      s0 * az + s1 * bz,
      s0 * aw + s1 * bw,
    ];
  }

  // Needed to satisfy return type — not actually used (slerpQuat handles it)
  private slerpComponent(_a: number[], _b: number[], _t: number, _c: number): number {
    return 0;
  }

  private interpolateCubic(lo: number, hi: number, t: number, dt: number): number[] {
    const c = this.components;
    const stride = c * 3;

    // inTangent = values[idx*stride + 0..c-1]
    // value     = values[idx*stride + c..2c-1]
    // outTangent= values[idx*stride + 2c..3c-1]
    // glTF CUBICSPLINE layout per keyframe: [inTangent(c), value(c), outTangent(c)]
    const p0 = Array.from(this.values.subarray(lo * stride + c,       lo * stride + c * 2));  // value at lo
    const m0 = Array.from(this.values.subarray(lo * stride + c * 2,   lo * stride + c * 3));  // outTangent at lo
    const p1 = Array.from(this.values.subarray(hi * stride + c,       hi * stride + c * 2));  // value at hi
    const m1 = Array.from(this.values.subarray(hi * stride,           hi * stride + c));       // inTangent at hi

    // Cubic Hermite
    const t2 = t * t;
    const t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;

    const out: number[] = new Array(c);
    for (let i = 0; i < c; i++) {
      out[i] = h00 * p0[i] + h10 * dt * m0[i] + h01 * p1[i] + h11 * dt * m1[i];
    }

    // Normalize quaternion after cubic interpolation
    if (this.targetPath === 'rotation') {
      const [x, y, z, w] = out;
      const len = Math.sqrt(x * x + y * y + z * z + w * w);
      if (len > 0) { out[0] /= len; out[1] /= len; out[2] /= len; out[3] /= len; }
    }

    return out;
  }
}
