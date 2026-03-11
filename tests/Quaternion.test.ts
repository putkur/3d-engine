import { describe, it, expect } from 'vitest';
import { Quaternion } from '../src/math/Quaternion';
import { Vector3 } from '../src/math/Vector3';

describe('Quaternion', () => {
  it('constructs identity by default', () => {
    const q = new Quaternion();
    expect(q.x).toBe(0);
    expect(q.y).toBe(0);
    expect(q.z).toBe(0);
    expect(q.w).toBe(1);
  });

  it('identity()', () => {
    const q = Quaternion.identity();
    expect(q.w).toBe(1);
    expect(q.length()).toBeCloseTo(1);
  });

  it('clone does not alias', () => {
    const a = Quaternion.fromEuler(45, 0, 0);
    const b = a.clone();
    b.w = 99;
    expect(a.w).not.toBe(99);
  });

  it('fromEuler() creates unit quaternion', () => {
    const q = Quaternion.fromEuler(90, 0, 0);
    expect(q.length()).toBeCloseTo(1);
  });

  it('fromAxisAngle()', () => {
    const q = Quaternion.fromAxisAngle(new Vector3(0, 1, 0), 90);
    expect(q.length()).toBeCloseTo(1);
    // Rotating (1,0,0) 90° around Y should give (0,0,-1)
    const v = q.rotateVector(new Vector3(1, 0, 0));
    expect(v.x).toBeCloseTo(0);
    expect(v.z).toBeCloseTo(-1);
  });

  it('multiply() composes rotations', () => {
    const a = Quaternion.fromAxisAngle(new Vector3(0, 1, 0), 45);
    const b = Quaternion.fromAxisAngle(new Vector3(0, 1, 0), 45);
    const c = a.multiply(b);
    // Should be equivalent to 90° around Y
    const v = c.rotateVector(new Vector3(1, 0, 0));
    expect(v.x).toBeCloseTo(0);
    expect(v.z).toBeCloseTo(-1);
  });

  it('conjugate()', () => {
    const q = new Quaternion(1, 2, 3, 4);
    const c = q.conjugate();
    expect(c.x).toBe(-1);
    expect(c.y).toBe(-2);
    expect(c.z).toBe(-3);
    expect(c.w).toBe(4);
  });

  it('inverse()', () => {
    const q = Quaternion.fromEuler(30, 45, 60);
    const inv = q.inverse();
    const product = q.multiply(inv);
    expect(product.x).toBeCloseTo(0);
    expect(product.y).toBeCloseTo(0);
    expect(product.z).toBeCloseTo(0);
    expect(product.w).toBeCloseTo(1);
  });

  it('normalize()', () => {
    const q = new Quaternion(1, 2, 3, 4);
    const n = q.normalize();
    expect(n.length()).toBeCloseTo(1);
  });

  it('slerp()', () => {
    const a = Quaternion.identity();
    const b = Quaternion.fromAxisAngle(new Vector3(0, 1, 0), 90);
    const mid = a.slerp(b, 0.5);
    expect(mid.length()).toBeCloseTo(1);
    // Should be roughly 45° around Y
    const v = mid.rotateVector(new Vector3(1, 0, 0));
    expect(v.x).toBeCloseTo(Math.cos(Math.PI / 4));
    expect(v.z).toBeCloseTo(-Math.sin(Math.PI / 4));
  });

  it('rotateVector()', () => {
    // 180° around Y: (1,0,0) → (-1,0,0)
    const q = Quaternion.fromAxisAngle(new Vector3(0, 1, 0), 180);
    const v = q.rotateVector(new Vector3(1, 0, 0));
    expect(v.x).toBeCloseTo(-1);
    expect(v.y).toBeCloseTo(0);
    expect(v.z).toBeCloseTo(0);
  });

  it('toMatrix4() matches rotateVector()', () => {
    const q = Quaternion.fromEuler(30, 45, 60);
    const m = q.toMatrix4();
    const v = new Vector3(1, 2, 3);
    const fromQuat = q.rotateVector(v);
    const fromMat = m.transformPoint(v);
    expect(fromQuat.x).toBeCloseTo(fromMat.x, 4);
    expect(fromQuat.y).toBeCloseTo(fromMat.y, 4);
    expect(fromQuat.z).toBeCloseTo(fromMat.z, 4);
  });

  it('toEuler() round-trips approximately', () => {
    const q = Quaternion.fromEuler(30, 45, 60);
    const e = q.toEuler();
    const q2 = Quaternion.fromEuler(e.x, e.y, e.z);
    // Rotating same vector should give same result
    const v = new Vector3(1, 0, 0);
    const r1 = q.rotateVector(v);
    const r2 = q2.rotateVector(v);
    expect(r1.x).toBeCloseTo(r2.x, 3);
    expect(r1.y).toBeCloseTo(r2.y, 3);
    expect(r1.z).toBeCloseTo(r2.z, 3);
  });

  it('dot()', () => {
    const a = Quaternion.identity();
    const b = Quaternion.identity();
    expect(a.dot(b)).toBeCloseTo(1);
  });

  it('equals()', () => {
    const a = Quaternion.identity();
    const b = Quaternion.identity();
    expect(a.equals(b)).toBe(true);
  });

  it('mutable ops', () => {
    const q = Quaternion.identity();
    const r = Quaternion.fromAxisAngle(new Vector3(0, 1, 0), 90);
    q.multiplySelf(r);
    expect(q.length()).toBeCloseTo(1);
    q.normalizeSelf();
    expect(q.length()).toBeCloseTo(1);
  });

  it('fromArray()', () => {
    const q = Quaternion.fromArray([0.1, 0.2, 0.3, 0.9]);
    expect(q.x).toBeCloseTo(0.1);
    expect(q.w).toBeCloseTo(0.9);
  });

  it('data is Float32Array(4)', () => {
    const q = new Quaternion();
    expect(q.data).toBeInstanceOf(Float32Array);
    expect(q.data.length).toBe(4);
  });
});
