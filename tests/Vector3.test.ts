import { describe, it, expect } from 'vitest';
import { Vector3 } from '../src/math/Vector3';

describe('Vector3', () => {
  it('constructs with defaults (0,0,0)', () => {
    const v = new Vector3();
    expect(v.x).toBe(0);
    expect(v.y).toBe(0);
    expect(v.z).toBe(0);
  });

  it('constructs with values', () => {
    const v = new Vector3(1, 2, 3);
    expect(v.toArray()).toEqual([1, 2, 3]);
  });

  it('clone does not alias', () => {
    const a = new Vector3(1, 2, 3);
    const b = a.clone();
    b.x = 99;
    expect(a.x).toBe(1);
  });

  it('add()', () => {
    const c = new Vector3(1, 2, 3).add(new Vector3(4, 5, 6));
    expect(c.toArray()).toEqual([5, 7, 9]);
  });

  it('addSelf()', () => {
    const a = new Vector3(1, 2, 3);
    a.addSelf(new Vector3(4, 5, 6));
    expect(a.toArray()).toEqual([5, 7, 9]);
  });

  it('subtract()', () => {
    const c = new Vector3(5, 7, 9).subtract(new Vector3(1, 2, 3));
    expect(c.toArray()).toEqual([4, 5, 6]);
  });

  it('scale()', () => {
    const c = new Vector3(1, 2, 3).scale(2);
    expect(c.toArray()).toEqual([2, 4, 6]);
  });

  it('negate()', () => {
    const c = new Vector3(1, -2, 3).negate();
    expect(c.toArray()).toEqual([-1, 2, -3]);
  });

  it('dot()', () => {
    expect(new Vector3(1, 0, 0).dot(new Vector3(0, 1, 0))).toBe(0);
    expect(new Vector3(1, 2, 3).dot(new Vector3(4, 5, 6))).toBe(32);
  });

  it('cross()', () => {
    const c = new Vector3(1, 0, 0).cross(new Vector3(0, 1, 0));
    expect(c.x).toBeCloseTo(0);
    expect(c.y).toBeCloseTo(0);
    expect(c.z).toBeCloseTo(1);
  });

  it('length()', () => {
    expect(new Vector3(1, 2, 2).length()).toBeCloseTo(3);
  });

  it('lengthSquared()', () => {
    expect(new Vector3(1, 2, 2).lengthSquared()).toBeCloseTo(9);
  });

  it('normalize()', () => {
    const n = new Vector3(3, 0, 0).normalize();
    expect(n.x).toBeCloseTo(1);
    expect(n.length()).toBeCloseTo(1);
  });

  it('distance()', () => {
    expect(new Vector3(0, 0, 0).distance(new Vector3(1, 2, 2))).toBeCloseTo(3);
  });

  it('lerp()', () => {
    const a = new Vector3(0, 0, 0);
    const b = new Vector3(10, 20, 30);
    const c = a.lerp(b, 0.5);
    expect(c.toArray()).toEqual([5, 10, 15]);
  });

  it('equals()', () => {
    expect(new Vector3(1, 2, 3).equals(new Vector3(1, 2, 3))).toBe(true);
    expect(new Vector3(1, 2, 3).equals(new Vector3(1, 2, 4))).toBe(false);
  });

  it('static factories', () => {
    expect(Vector3.zero().toArray()).toEqual([0, 0, 0]);
    expect(Vector3.one().toArray()).toEqual([1, 1, 1]);
    expect(Vector3.unitX().toArray()).toEqual([1, 0, 0]);
    expect(Vector3.unitY().toArray()).toEqual([0, 1, 0]);
    expect(Vector3.unitZ().toArray()).toEqual([0, 0, 1]);
    expect(Vector3.up().toArray()).toEqual([0, 1, 0]);
    expect(Vector3.right().toArray()).toEqual([1, 0, 0]);
    expect(Vector3.forward().toArray()).toEqual([0, 0, -1]);
  });

  it('fromArray()', () => {
    const v = Vector3.fromArray([10, 20, 30, 40], 1);
    expect(v.toArray()).toEqual([20, 30, 40]);
  });

  it('data is Float32Array', () => {
    const v = new Vector3(1, 2, 3);
    expect(v.data).toBeInstanceOf(Float32Array);
    expect(v.data.length).toBe(3);
  });
});
