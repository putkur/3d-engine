import { vec3 } from 'gl-matrix';

export class Vector3 {
  public readonly data: Float32Array;

  constructor(x = 0, y = 0, z = 0) {
    this.data = vec3.fromValues(x, y, z) as Float32Array;
  }

  get x(): number { return this.data[0]; }
  set x(v: number) { this.data[0] = v; }
  get y(): number { return this.data[1]; }
  set y(v: number) { this.data[1] = v; }
  get z(): number { return this.data[2]; }
  set z(v: number) { this.data[2] = v; }

  set(x: number, y: number, z: number): this {
    vec3.set(this.data, x, y, z);
    return this;
  }

  clone(): Vector3 {
    return new Vector3(this.x, this.y, this.z);
  }

  copy(v: Vector3): this {
    vec3.copy(this.data, v.data);
    return this;
  }

  // --- Immutable (return new) ---

  add(v: Vector3): Vector3 {
    const out = new Vector3();
    vec3.add(out.data, this.data, v.data);
    return out;
  }

  subtract(v: Vector3): Vector3 {
    const out = new Vector3();
    vec3.subtract(out.data, this.data, v.data);
    return out;
  }

  scale(s: number): Vector3 {
    const out = new Vector3();
    vec3.scale(out.data, this.data, s);
    return out;
  }

  negate(): Vector3 {
    const out = new Vector3();
    vec3.negate(out.data, this.data);
    return out;
  }

  normalize(): Vector3 {
    const out = new Vector3();
    vec3.normalize(out.data, this.data);
    return out;
  }

  cross(v: Vector3): Vector3 {
    const out = new Vector3();
    vec3.cross(out.data, this.data, v.data);
    return out;
  }

  lerp(v: Vector3, t: number): Vector3 {
    const out = new Vector3();
    vec3.lerp(out.data, this.data, v.data, t);
    return out;
  }

  // --- Mutable (modify self) ---

  addSelf(v: Vector3): this {
    vec3.add(this.data, this.data, v.data);
    return this;
  }

  subtractSelf(v: Vector3): this {
    vec3.subtract(this.data, this.data, v.data);
    return this;
  }

  scaleSelf(s: number): this {
    vec3.scale(this.data, this.data, s);
    return this;
  }

  negateSelf(): this {
    vec3.negate(this.data, this.data);
    return this;
  }

  normalizeSelf(): this {
    vec3.normalize(this.data, this.data);
    return this;
  }

  crossSelf(v: Vector3): this {
    vec3.cross(this.data, this.data, v.data);
    return this;
  }

  // --- Scalar queries ---

  dot(v: Vector3): number {
    return vec3.dot(this.data, v.data);
  }

  length(): number {
    return vec3.length(this.data);
  }

  lengthSquared(): number {
    return vec3.squaredLength(this.data);
  }

  distance(v: Vector3): number {
    return vec3.distance(this.data, v.data);
  }

  distanceSquared(v: Vector3): number {
    return vec3.squaredDistance(this.data, v.data);
  }

  equals(v: Vector3): boolean {
    return vec3.exactEquals(this.data, v.data);
  }

  toArray(): [number, number, number] {
    return [this.x, this.y, this.z];
  }

  toString(): string {
    return `Vector3(${this.x}, ${this.y}, ${this.z})`;
  }

  // --- Static factories ---

  static zero(): Vector3 { return new Vector3(0, 0, 0); }
  static one(): Vector3 { return new Vector3(1, 1, 1); }
  static unitX(): Vector3 { return new Vector3(1, 0, 0); }
  static unitY(): Vector3 { return new Vector3(0, 1, 0); }
  static unitZ(): Vector3 { return new Vector3(0, 0, 1); }
  static up(): Vector3 { return new Vector3(0, 1, 0); }
  static right(): Vector3 { return new Vector3(1, 0, 0); }
  static forward(): Vector3 { return new Vector3(0, 0, -1); }

  static fromArray(arr: ArrayLike<number>, offset = 0): Vector3 {
    return new Vector3(arr[offset], arr[offset + 1], arr[offset + 2]);
  }
}
