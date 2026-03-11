import { vec4 } from 'gl-matrix';

export class Vector4 {
  public readonly data: Float32Array;

  constructor(x = 0, y = 0, z = 0, w = 0) {
    this.data = vec4.fromValues(x, y, z, w) as Float32Array;
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
    vec4.set(this.data, x, y, z, w);
    return this;
  }

  clone(): Vector4 {
    return new Vector4(this.x, this.y, this.z, this.w);
  }

  copy(v: Vector4): this {
    vec4.copy(this.data, v.data);
    return this;
  }

  // --- Immutable (return new) ---

  add(v: Vector4): Vector4 {
    const out = new Vector4();
    vec4.add(out.data, this.data, v.data);
    return out;
  }

  subtract(v: Vector4): Vector4 {
    const out = new Vector4();
    vec4.subtract(out.data, this.data, v.data);
    return out;
  }

  scale(s: number): Vector4 {
    const out = new Vector4();
    vec4.scale(out.data, this.data, s);
    return out;
  }

  negate(): Vector4 {
    const out = new Vector4();
    vec4.negate(out.data, this.data);
    return out;
  }

  normalize(): Vector4 {
    const out = new Vector4();
    vec4.normalize(out.data, this.data);
    return out;
  }

  lerp(v: Vector4, t: number): Vector4 {
    const out = new Vector4();
    vec4.lerp(out.data, this.data, v.data, t);
    return out;
  }

  // --- Mutable (modify self) ---

  addSelf(v: Vector4): this {
    vec4.add(this.data, this.data, v.data);
    return this;
  }

  subtractSelf(v: Vector4): this {
    vec4.subtract(this.data, this.data, v.data);
    return this;
  }

  scaleSelf(s: number): this {
    vec4.scale(this.data, this.data, s);
    return this;
  }

  negateSelf(): this {
    vec4.negate(this.data, this.data);
    return this;
  }

  normalizeSelf(): this {
    vec4.normalize(this.data, this.data);
    return this;
  }

  // --- Scalar queries ---

  dot(v: Vector4): number {
    return vec4.dot(this.data, v.data);
  }

  length(): number {
    return vec4.length(this.data);
  }

  lengthSquared(): number {
    return vec4.squaredLength(this.data);
  }

  equals(v: Vector4): boolean {
    return vec4.exactEquals(this.data, v.data);
  }

  toArray(): [number, number, number, number] {
    return [this.x, this.y, this.z, this.w];
  }

  toString(): string {
    return `Vector4(${this.x}, ${this.y}, ${this.z}, ${this.w})`;
  }

  // --- Static factories ---

  static zero(): Vector4 { return new Vector4(0, 0, 0, 0); }
  static one(): Vector4 { return new Vector4(1, 1, 1, 1); }

  static fromArray(arr: ArrayLike<number>, offset = 0): Vector4 {
    return new Vector4(arr[offset], arr[offset + 1], arr[offset + 2], arr[offset + 3]);
  }
}
