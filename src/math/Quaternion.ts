import { quat, mat4, vec3 as glVec3 } from 'gl-matrix';
import { Vector3 } from './Vector3';
import { Matrix4 } from './Matrix4';
import { degToRad } from './MathUtils';

export class Quaternion {
  public readonly data: Float32Array;

  constructor(x = 0, y = 0, z = 0, w = 1) {
    this.data = quat.fromValues(x, y, z, w) as Float32Array;
  }

  get x(): number { return this.data[0]; }
  set x(v: number) { this.data[0] = v; }
  get y(): number { return this.data[1]; }
  set y(v: number) { this.data[1] = v; }
  get z(): number { return this.data[2]; }
  set z(v: number) { this.data[2] = v; }
  get w(): number { return this.data[3]; }
  set w(v: number) { this.data[3] = v; }

  set(x: number, y: number, z: number, w: number): this {
    quat.set(this.data, x, y, z, w);
    return this;
  }

  clone(): Quaternion {
    return new Quaternion(this.x, this.y, this.z, this.w);
  }

  copy(q: Quaternion): this {
    quat.copy(this.data, q.data);
    return this;
  }

  setIdentity(): this {
    quat.identity(this.data);
    return this;
  }

  // --- Immutable (return new) ---

  multiply(q: Quaternion): Quaternion {
    const out = new Quaternion();
    quat.multiply(out.data, this.data, q.data);
    return out;
  }

  conjugate(): Quaternion {
    const out = new Quaternion();
    quat.conjugate(out.data, this.data);
    return out;
  }

  inverse(): Quaternion {
    const out = new Quaternion();
    quat.invert(out.data, this.data);
    return out;
  }

  normalize(): Quaternion {
    const out = new Quaternion();
    quat.normalize(out.data, this.data);
    return out;
  }

  slerp(q: Quaternion, t: number): Quaternion {
    const out = new Quaternion();
    quat.slerp(out.data, this.data, q.data, t);
    return out;
  }

  /** Rotate a Vector3 by this quaternion */
  rotateVector(v: Vector3): Vector3 {
    const out = new Vector3();
    glVec3.transformQuat(out.data, v.data, this.data);
    return out;
  }

  // --- Mutable ---

  multiplySelf(q: Quaternion): this {
    quat.multiply(this.data, this.data, q.data);
    return this;
  }

  conjugateSelf(): this {
    quat.conjugate(this.data, this.data);
    return this;
  }

  inverseSelf(): this {
    quat.invert(this.data, this.data);
    return this;
  }

  normalizeSelf(): this {
    quat.normalize(this.data, this.data);
    return this;
  }

  // --- Conversion ---

  toMatrix4(): Matrix4 {
    const out = new Matrix4();
    mat4.fromQuat(out.data, this.data);
    return out;
  }

  /** Get Euler angles in degrees (XYZ order). Approximate. */
  toEuler(): Vector3 {
    const d = this.data;
    const x = d[0], y = d[1], z = d[2], w = d[3];

    const sinrCosp = 2 * (w * x + y * z);
    const cosrCosp = 1 - 2 * (x * x + y * y);
    const roll = Math.atan2(sinrCosp, cosrCosp);

    const sinp = 2 * (w * y - z * x);
    const pitch = Math.abs(sinp) >= 1
      ? Math.sign(sinp) * (Math.PI / 2)
      : Math.asin(sinp);

    const sinyCosp = 2 * (w * z + x * y);
    const cosyCosp = 1 - 2 * (y * y + z * z);
    const yaw = Math.atan2(sinyCosp, cosyCosp);

    return new Vector3(
      roll * (180 / Math.PI),
      pitch * (180 / Math.PI),
      yaw * (180 / Math.PI),
    );
  }

  length(): number {
    return quat.length(this.data);
  }

  dot(q: Quaternion): number {
    return quat.dot(this.data, q.data);
  }

  equals(q: Quaternion): boolean {
    return quat.exactEquals(this.data, q.data);
  }

  toArray(): [number, number, number, number] {
    return [this.x, this.y, this.z, this.w];
  }

  toString(): string {
    return `Quaternion(${this.x}, ${this.y}, ${this.z}, ${this.w})`;
  }

  // --- Static factories ---

  static identity(): Quaternion {
    return new Quaternion(0, 0, 0, 1);
  }

  /** Create from Euler angles in degrees (applied in XYZ order). */
  static fromEuler(xDeg: number, yDeg: number, zDeg: number): Quaternion {
    const out = new Quaternion();
    // gl-matrix fromEuler expects degrees
    quat.fromEuler(out.data, xDeg, yDeg, zDeg);
    return out;
  }

  static fromAxisAngle(axis: Vector3, degrees: number): Quaternion {
    const out = new Quaternion();
    quat.setAxisAngle(out.data, axis.data, degToRad(degrees));
    return out;
  }

  /** Create quaternion that looks from origin along `forward` direction, with given `up`. */
  static lookRotation(forward: Vector3, up?: Vector3): Quaternion {
    const u = up ?? Vector3.up();
    // Build a rotation matrix from axes, then extract quaternion
    const f = forward.normalize();
    const r = u.cross(f).normalize();
    const correctedUp = f.cross(r);

    // Construct rotation matrix (column-major for gl-matrix)
    const m = mat4.create();
    m[0] = r.x;       m[1] = r.y;       m[2] = r.z;       m[3] = 0;
    m[4] = correctedUp.x; m[5] = correctedUp.y; m[6] = correctedUp.z; m[7] = 0;
    m[8] = f.x;       m[9] = f.y;       m[10] = f.z;      m[11] = 0;
    m[12] = 0;         m[13] = 0;         m[14] = 0;         m[15] = 1;

    const out = new Quaternion();
    quat.fromMat3(out.data, [
      m[0], m[1], m[2],
      m[4], m[5], m[6],
      m[8], m[9], m[10],
    ]);
    quat.normalize(out.data, out.data);
    return out;
  }

  static fromArray(arr: ArrayLike<number>, offset = 0): Quaternion {
    return new Quaternion(arr[offset], arr[offset + 1], arr[offset + 2], arr[offset + 3]);
  }
}
