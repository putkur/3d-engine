import { describe, it, expect } from 'vitest';
import { Vector4 } from '../src/math/Vector4';

describe('Vector4', () => {
  it('constructs with defaults (0,0,0,0)', () => {
    const v = new Vector4();
    expect(v.toArray()).toEqual([0, 0, 0, 0]);
  });

  it('constructs with values', () => {
    const v = new Vector4(1, 2, 3, 4);
    expect(v.toArray()).toEqual([1, 2, 3, 4]);
  });

  it('clone does not alias', () => {
    const a = new Vector4(1, 2, 3, 4);
    const b = a.clone();
    b.w = 99;
    expect(a.w).toBe(4);
  });

  it('add()', () => {
    const c = new Vector4(1, 2, 3, 4).add(new Vector4(5, 6, 7, 8));
    expect(c.toArray()).toEqual([6, 8, 10, 12]);
  });

  it('subtract()', () => {
    const c = new Vector4(5, 6, 7, 8).subtract(new Vector4(1, 2, 3, 4));
    expect(c.toArray()).toEqual([4, 4, 4, 4]);
  });

  it('scale()', () => {
    const c = new Vector4(1, 2, 3, 4).scale(2);
    expect(c.toArray()).toEqual([2, 4, 6, 8]);
  });

  it('negate()', () => {
    const c = new Vector4(1, -2, 3, -4).negate();
    expect(c.toArray()).toEqual([-1, 2, -3, 4]);
  });

  it('dot()', () => {
    expect(new Vector4(1, 2, 3, 4).dot(new Vector4(5, 6, 7, 8))).toBe(70);
  });

  it('length()', () => {
    expect(new Vector4(1, 0, 0, 0).length()).toBeCloseTo(1);
    expect(new Vector4(0, 3, 4, 0).length()).toBeCloseTo(5);
  });

  it('normalize()', () => {
    const n = new Vector4(3, 0, 0, 0).normalize();
    expect(n.x).toBeCloseTo(1);
    expect(n.length()).toBeCloseTo(1);
  });

  it('lerp()', () => {
    const a = new Vector4(0, 0, 0, 0);
    const b = new Vector4(10, 20, 30, 40);
    const c = a.lerp(b, 0.5);
    expect(c.toArray()).toEqual([5, 10, 15, 20]);
  });

  it('equals()', () => {
    expect(new Vector4(1, 2, 3, 4).equals(new Vector4(1, 2, 3, 4))).toBe(true);
    expect(new Vector4(1, 2, 3, 4).equals(new Vector4(1, 2, 3, 5))).toBe(false);
  });

  it('mutable ops', () => {
    const v = new Vector4(1, 2, 3, 4);
    v.addSelf(new Vector4(1, 1, 1, 1));
    expect(v.toArray()).toEqual([2, 3, 4, 5]);
    v.scaleSelf(2);
    expect(v.toArray()).toEqual([4, 6, 8, 10]);
  });

  it('static factories', () => {
    expect(Vector4.zero().toArray()).toEqual([0, 0, 0, 0]);
    expect(Vector4.one().toArray()).toEqual([1, 1, 1, 1]);
  });

  it('fromArray()', () => {
    const v = Vector4.fromArray([10, 20, 30, 40, 50], 1);
    expect(v.toArray()).toEqual([20, 30, 40, 50]);
  });

  it('data is Float32Array', () => {
    const v = new Vector4(1, 2, 3, 4);
    expect(v.data).toBeInstanceOf(Float32Array);
    expect(v.data.length).toBe(4);
  });
});
