import { describe, it, expect } from 'vitest';
import { Vector2 } from '../src/math/Vector2';

describe('Vector2', () => {
  it('constructs with defaults (0,0)', () => {
    const v = new Vector2();
    expect(v.x).toBe(0);
    expect(v.y).toBe(0);
  });

  it('constructs with values', () => {
    const v = new Vector2(3, 4);
    expect(v.x).toBe(3);
    expect(v.y).toBe(4);
  });

  it('set()', () => {
    const v = new Vector2();
    v.set(5, 6);
    expect(v.x).toBe(5);
    expect(v.y).toBe(6);
  });

  it('clone()', () => {
    const a = new Vector2(1, 2);
    const b = a.clone();
    expect(b.x).toBe(1);
    expect(b.y).toBe(2);
    b.x = 99;
    expect(a.x).toBe(1); // original unchanged
  });

  it('add() returns new vector', () => {
    const a = new Vector2(1, 2);
    const b = new Vector2(3, 4);
    const c = a.add(b);
    expect(c.x).toBe(4);
    expect(c.y).toBe(6);
    expect(a.x).toBe(1); // original unchanged
  });

  it('addSelf() mutates', () => {
    const a = new Vector2(1, 2);
    a.addSelf(new Vector2(3, 4));
    expect(a.x).toBe(4);
    expect(a.y).toBe(6);
  });

  it('subtract()', () => {
    const c = new Vector2(5, 7).subtract(new Vector2(2, 3));
    expect(c.x).toBe(3);
    expect(c.y).toBe(4);
  });

  it('scale()', () => {
    const c = new Vector2(2, 3).scale(3);
    expect(c.x).toBe(6);
    expect(c.y).toBe(9);
  });

  it('negate()', () => {
    const c = new Vector2(2, -3).negate();
    expect(c.x).toBe(-2);
    expect(c.y).toBe(3);
  });

  it('dot()', () => {
    expect(new Vector2(1, 0).dot(new Vector2(0, 1))).toBe(0);
    expect(new Vector2(2, 3).dot(new Vector2(4, 5))).toBe(23);
  });

  it('length()', () => {
    expect(new Vector2(3, 4).length()).toBeCloseTo(5);
  });

  it('lengthSquared()', () => {
    expect(new Vector2(3, 4).lengthSquared()).toBeCloseTo(25);
  });

  it('normalize()', () => {
    const n = new Vector2(3, 4).normalize();
    expect(n.length()).toBeCloseTo(1);
  });

  it('distance()', () => {
    expect(new Vector2(0, 0).distance(new Vector2(3, 4))).toBeCloseTo(5);
  });

  it('lerp()', () => {
    const a = new Vector2(0, 0);
    const b = new Vector2(10, 10);
    const c = a.lerp(b, 0.5);
    expect(c.x).toBeCloseTo(5);
    expect(c.y).toBeCloseTo(5);
  });

  it('equals()', () => {
    expect(new Vector2(1, 2).equals(new Vector2(1, 2))).toBe(true);
    expect(new Vector2(1, 2).equals(new Vector2(1, 3))).toBe(false);
  });

  it('static factories', () => {
    expect(Vector2.zero().x).toBe(0);
    expect(Vector2.one().x).toBe(1);
    expect(Vector2.unitX().x).toBe(1);
    expect(Vector2.unitX().y).toBe(0);
    expect(Vector2.unitY().y).toBe(1);
  });

  it('fromArray()', () => {
    const v = Vector2.fromArray([10, 20, 30], 1);
    expect(v.x).toBe(20);
    expect(v.y).toBe(30);
  });

  it('toArray()', () => {
    expect(new Vector2(1, 2).toArray()).toEqual([1, 2]);
  });

  it('data is Float32Array passable to WebGL', () => {
    const v = new Vector2(1, 2);
    expect(v.data).toBeInstanceOf(Float32Array);
    expect(v.data.length).toBe(2);
  });
});
