import { describe, it, expect } from 'vitest';
import { Matrix4 } from '../src/math/Matrix4';
import { Vector3 } from '../src/math/Vector3';

describe('Matrix4', () => {
  it('creates identity by default', () => {
    const m = new Matrix4();
    const d = m.data;
    expect(d[0]).toBe(1); expect(d[5]).toBe(1); expect(d[10]).toBe(1); expect(d[15]).toBe(1);
    expect(d[1]).toBe(0); expect(d[4]).toBe(0);
  });

  it('identity() static', () => {
    const m = Matrix4.identity();
    expect(m.determinant()).toBeCloseTo(1);
  });

  it('clone does not alias', () => {
    const a = Matrix4.translation(1, 2, 3);
    const b = a.clone();
    b.data[12] = 99;
    expect(a.data[12]).toBe(1);
  });

  it('translation()', () => {
    const m = Matrix4.translation(5, 10, 15);
    expect(m.data[12]).toBe(5);
    expect(m.data[13]).toBe(10);
    expect(m.data[14]).toBe(15);
  });

  it('scale()', () => {
    const m = Matrix4.scale(2, 3, 4);
    expect(m.data[0]).toBe(2);
    expect(m.data[5]).toBe(3);
    expect(m.data[10]).toBe(4);
  });

  it('rotationX()', () => {
    const m = Matrix4.rotationX(90);
    // After 90° rotation around X, Y-axis should transform to Z-axis
    const v = m.transformPoint(new Vector3(0, 1, 0));
    expect(v.x).toBeCloseTo(0);
    expect(v.y).toBeCloseTo(0);
    expect(v.z).toBeCloseTo(1);
  });

  it('rotationY()', () => {
    const m = Matrix4.rotationY(90);
    const v = m.transformPoint(new Vector3(1, 0, 0));
    expect(v.x).toBeCloseTo(0);
    expect(v.y).toBeCloseTo(0);
    expect(v.z).toBeCloseTo(-1);
  });

  it('rotationZ()', () => {
    const m = Matrix4.rotationZ(90);
    const v = m.transformPoint(new Vector3(1, 0, 0));
    expect(v.x).toBeCloseTo(0);
    expect(v.y).toBeCloseTo(1);
    expect(v.z).toBeCloseTo(0);
  });

  it('multiply() produces correct TRS', () => {
    const t = Matrix4.translation(10, 0, 0);
    const s = Matrix4.scale(2, 2, 2);
    const ts = t.multiply(s);
    // Point at origin should be translated
    const p = ts.transformPoint(new Vector3(0, 0, 0));
    expect(p.x).toBeCloseTo(10);
    // Point at (1,0,0) should be scaled then translated
    const q = ts.transformPoint(new Vector3(1, 0, 0));
    expect(q.x).toBeCloseTo(12);
  });

  it('inverse()', () => {
    const m = Matrix4.translation(3, 4, 5);
    const inv = m.inverse();
    const product = m.multiply(inv);
    // Should be identity
    expect(product.data[0]).toBeCloseTo(1);
    expect(product.data[12]).toBeCloseTo(0);
    expect(product.data[15]).toBeCloseTo(1);
  });

  it('transpose()', () => {
    const m = Matrix4.identity();
    m.data[1] = 5; // row 1, col 0
    const t = m.transpose();
    expect(t.data[4]).toBe(5); // col 1, row 0
  });

  it('determinant() of identity is 1', () => {
    expect(Matrix4.identity().determinant()).toBeCloseTo(1);
  });

  it('transformPoint() applies translation', () => {
    const m = Matrix4.translation(1, 2, 3);
    const p = m.transformPoint(new Vector3(0, 0, 0));
    expect(p.toArray()).toEqual([1, 2, 3]);
  });

  it('transformDirection() ignores translation', () => {
    const m = Matrix4.translation(100, 200, 300);
    const d = m.transformDirection(new Vector3(1, 0, 0));
    expect(d.x).toBeCloseTo(1);
    expect(d.y).toBeCloseTo(0);
    expect(d.z).toBeCloseTo(0);
  });

  it('perspective() creates valid projection', () => {
    const m = Matrix4.perspective(60, 16/9, 0.1, 100);
    expect(m.data[0]).not.toBe(0);
    expect(m.data[5]).not.toBe(0);
    expect(m.data[11]).toBe(-1); // perspective divide
  });

  it('orthographic() creates valid projection', () => {
    const m = Matrix4.orthographic(-1, 1, -1, 1, 0.1, 100);
    expect(m.data[0]).toBeCloseTo(1);
    expect(m.data[5]).toBeCloseTo(1);
  });

  it('lookAt() creates view matrix', () => {
    const m = Matrix4.lookAt(
      new Vector3(0, 0, 5),
      new Vector3(0, 0, 0),
      new Vector3(0, 1, 0),
    );
    // Looking down -Z, eye at z=5
    const p = m.transformPoint(new Vector3(0, 0, 0));
    expect(p.z).toBeCloseTo(-5);
  });

  it('getTranslation()', () => {
    const m = Matrix4.translation(7, 8, 9);
    const t = m.getTranslation();
    expect(t.toArray()).toEqual([7, 8, 9]);
  });

  it('getScaling()', () => {
    const m = Matrix4.scale(2, 3, 4);
    const s = m.getScaling();
    expect(s.x).toBeCloseTo(2);
    expect(s.y).toBeCloseTo(3);
    expect(s.z).toBeCloseTo(4);
  });

  it('equals()', () => {
    expect(Matrix4.identity().equals(Matrix4.identity())).toBe(true);
    expect(Matrix4.identity().equals(Matrix4.translation(1, 0, 0))).toBe(false);
  });

  it('data is Float32Array(16)', () => {
    const m = new Matrix4();
    expect(m.data).toBeInstanceOf(Float32Array);
    expect(m.data.length).toBe(16);
  });
});
