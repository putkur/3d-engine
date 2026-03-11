import { vec2 } from 'gl-matrix';

export class Vector2 {
  public readonly data: Float32Array;

  constructor(x = 0, y = 0) {
    this.data = vec2.fromValues(x, y) as Float32Array;
  }

  get x(): number { return this.data[0]; }
  set x(v: number) { this.data[0] = v; }
  get y(): number { return this.data[1]; }
  set y(v: number) { this.data[1] = v; }

  set(x: number, y: number): this {
    vec2.set(this.data, x, y);
    return this;
  }

  clone(): Vector2 {
    return new Vector2(this.x, this.y);
  }

  copy(v: Vector2): this {
    vec2.copy(this.data, v.data);
    return this;
  }

  // --- Immutable (return new) ---

  add(v: Vector2): Vector2 {
    const out = new Vector2();
    vec2.add(out.data, this.data, v.data);
    return out;
  }

  subtract(v: Vector2): Vector2 {
    const out = new Vector2();
    vec2.subtract(out.data, this.data, v.data);
    return out;
  }

  scale(s: number): Vector2 {
    const out = new Vector2();
    vec2.scale(out.data, this.data, s);
    return out;
  }

  negate(): Vector2 {
    const out = new Vector2();
    vec2.negate(out.data, this.data);
    return out;
  }

  normalize(): Vector2 {
    const out = new Vector2();
    vec2.normalize(out.data, this.data);
    return out;
  }

  lerp(v: Vector2, t: number): Vector2 {
    const out = new Vector2();
    vec2.lerp(out.data, this.data, v.data, t);
    return out;
  }

  // --- Mutable (modify self) ---

  addSelf(v: Vector2): this {
    vec2.add(this.data, this.data, v.data);
    return this;
  }

  subtractSelf(v: Vector2): this {
    vec2.subtract(this.data, this.data, v.data);
    return this;
  }

  scaleSelf(s: number): this {
    vec2.scale(this.data, this.data, s);
    return this;
  }

  negateSelf(): this {
    vec2.negate(this.data, this.data);
    return this;
  }

  normalizeSelf(): this {
    vec2.normalize(this.data, this.data);
    return this;
  }

  // --- Scalar queries ---

  dot(v: Vector2): number {
    return vec2.dot(this.data, v.data);
  }

  length(): number {
    return vec2.length(this.data);
  }

  lengthSquared(): number {
    return vec2.squaredLength(this.data);
  }

  distance(v: Vector2): number {
    return vec2.distance(this.data, v.data);
  }

  distanceSquared(v: Vector2): number {
    return vec2.squaredDistance(this.data, v.data);
  }

  equals(v: Vector2): boolean {
    return vec2.exactEquals(this.data, v.data);
  }

  toArray(): [number, number] {
    return [this.x, this.y];
  }

  toString(): string {
    return `Vector2(${this.x}, ${this.y})`;
  }

  // --- Static factories ---

  static zero(): Vector2 { return new Vector2(0, 0); }
  static one(): Vector2 { return new Vector2(1, 1); }
  static unitX(): Vector2 { return new Vector2(1, 0); }
  static unitY(): Vector2 { return new Vector2(0, 1); }

  static fromArray(arr: ArrayLike<number>, offset = 0): Vector2 {
    return new Vector2(arr[offset], arr[offset + 1]);
  }
}
