import { mat4, vec3 as glVec3 } from 'gl-matrix';
import { Vector3 } from './Vector3';
import { degToRad } from './MathUtils';

export class Matrix4 {
  public readonly data: Float32Array;

  constructor() {
    this.data = mat4.create() as Float32Array; // identity by default
  }

  clone(): Matrix4 {
    const out = new Matrix4();
    mat4.copy(out.data, this.data);
    return out;
  }

  copy(m: Matrix4): this {
    mat4.copy(this.data, m.data);
    return this;
  }

  // --- Instance methods (mutate self, return self for chaining) ---

  setIdentity(): this {
    mat4.identity(this.data);
    return this;
  }

  multiply(m: Matrix4): Matrix4 {
    const out = new Matrix4();
    mat4.multiply(out.data, this.data, m.data);
    return out;
  }

  multiplySelf(m: Matrix4): this {
    mat4.multiply(this.data, this.data, m.data);
    return this;
  }

  premultiply(m: Matrix4): Matrix4 {
    const out = new Matrix4();
    mat4.multiply(out.data, m.data, this.data);
    return out;
  }

  inverse(): Matrix4 {
    const out = new Matrix4();
    mat4.invert(out.data, this.data);
    return out;
  }

  inverseSelf(): this {
    mat4.invert(this.data, this.data);
    return this;
  }

  transpose(): Matrix4 {
    const out = new Matrix4();
    mat4.transpose(out.data, this.data);
    return out;
  }

  transposeSelf(): this {
    mat4.transpose(this.data, this.data);
    return this;
  }

  determinant(): number {
    return mat4.determinant(this.data);
  }

  /** Transform a point (applies translation). w=1 */
  transformPoint(v: Vector3): Vector3 {
    const out = new Vector3();
    glVec3.transformMat4(out.data, v.data, this.data);
    return out;
  }

  /** Transform a direction (ignores translation). Uses upper-left 3x3. */
  transformDirection(v: Vector3): Vector3 {
    const d = this.data;
    const x = v.x, y = v.y, z = v.z;
    return new Vector3(
      d[0] * x + d[4] * y + d[8] * z,
      d[1] * x + d[5] * y + d[9] * z,
      d[2] * x + d[6] * y + d[10] * z,
    );
  }

  getTranslation(): Vector3 {
    const out = new Vector3();
    mat4.getTranslation(out.data, this.data);
    return out;
  }

  getScaling(): Vector3 {
    const out = new Vector3();
    mat4.getScaling(out.data, this.data);
    return out;
  }

  equals(m: Matrix4): boolean {
    return mat4.exactEquals(this.data, m.data);
  }

  toArray(): number[] {
    return Array.from(this.data);
  }

  toString(): string {
    const d = this.data;
    return `Matrix4(\n` +
      `  ${d[0].toFixed(4)}, ${d[4].toFixed(4)}, ${d[8].toFixed(4)}, ${d[12].toFixed(4)}\n` +
      `  ${d[1].toFixed(4)}, ${d[5].toFixed(4)}, ${d[9].toFixed(4)}, ${d[13].toFixed(4)}\n` +
      `  ${d[2].toFixed(4)}, ${d[6].toFixed(4)}, ${d[10].toFixed(4)}, ${d[14].toFixed(4)}\n` +
      `  ${d[3].toFixed(4)}, ${d[7].toFixed(4)}, ${d[11].toFixed(4)}, ${d[15].toFixed(4)}\n)`;
  }

  // --- Static factories ---

  static identity(): Matrix4 {
    return new Matrix4(); // mat4.create() already returns identity
  }

  static fromArray(arr: ArrayLike<number>): Matrix4 {
    const out = new Matrix4();
    for (let i = 0; i < 16; i++) {
      out.data[i] = arr[i];
    }
    return out;
  }

  static translation(x: number, y: number, z: number): Matrix4 {
    const out = new Matrix4();
    mat4.fromTranslation(out.data, [x, y, z]);
    return out;
  }

  static rotationX(degrees: number): Matrix4 {
    const out = new Matrix4();
    mat4.fromXRotation(out.data, degToRad(degrees));
    return out;
  }

  static rotationY(degrees: number): Matrix4 {
    const out = new Matrix4();
    mat4.fromYRotation(out.data, degToRad(degrees));
    return out;
  }

  static rotationZ(degrees: number): Matrix4 {
    const out = new Matrix4();
    mat4.fromZRotation(out.data, degToRad(degrees));
    return out;
  }

  static scale(x: number, y: number, z: number): Matrix4 {
    const out = new Matrix4();
    mat4.fromScaling(out.data, [x, y, z]);
    return out;
  }

  static lookAt(eye: Vector3, center: Vector3, up: Vector3): Matrix4 {
    const out = new Matrix4();
    mat4.lookAt(out.data, eye.data, center.data, up.data);
    return out;
  }

  /** Perspective projection. fov in degrees. */
  static perspective(fovDegrees: number, aspect: number, near: number, far: number): Matrix4 {
    const out = new Matrix4();
    mat4.perspective(out.data, degToRad(fovDegrees), aspect, near, far);
    return out;
  }

  static orthographic(
    left: number, right: number,
    bottom: number, top: number,
    near: number, far: number,
  ): Matrix4 {
    const out = new Matrix4();
    mat4.ortho(out.data, left, right, bottom, top, near, far);
    return out;
  }

  /** Compose a TRS matrix from translation, rotation (quaternion data), and scale. */
  static compose(position: Vector3, rotationData: Float32Array, scaleVec: Vector3): Matrix4 {
    const out = new Matrix4();
    mat4.fromRotationTranslationScale(out.data, rotationData, position.data, scaleVec.data);
    return out;
  }
}
