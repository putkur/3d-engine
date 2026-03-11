import { describe, it, expect } from 'vitest';
import {
  clamp, lerp, inverseLerp, smoothstep,
  degToRad, radToDeg, isPowerOfTwo, nextPowerOfTwo,
  EPSILON, DEG2RAD, RAD2DEG,
} from '../src/math/MathUtils';

describe('MathUtils', () => {
  describe('clamp', () => {
    it('clamps below min', () => expect(clamp(-5, 0, 10)).toBe(0));
    it('clamps above max', () => expect(clamp(15, 0, 10)).toBe(10));
    it('passes through in range', () => expect(clamp(5, 0, 10)).toBe(5));
  });

  describe('lerp', () => {
    it('t=0 returns a', () => expect(lerp(10, 20, 0)).toBe(10));
    it('t=1 returns b', () => expect(lerp(10, 20, 1)).toBe(20));
    it('t=0.5 returns midpoint', () => expect(lerp(10, 20, 0.5)).toBe(15));
  });

  describe('inverseLerp', () => {
    it('returns 0 at a', () => expect(inverseLerp(10, 20, 10)).toBe(0));
    it('returns 1 at b', () => expect(inverseLerp(10, 20, 20)).toBe(1));
    it('returns 0.5 at midpoint', () => expect(inverseLerp(10, 20, 15)).toBe(0.5));
    it('returns 0 when a === b', () => expect(inverseLerp(5, 5, 5)).toBe(0));
  });

  describe('smoothstep', () => {
    it('returns 0 below edge0', () => expect(smoothstep(0, 1, -1)).toBe(0));
    it('returns 1 above edge1', () => expect(smoothstep(0, 1, 2)).toBe(1));
    it('returns 0.5 at midpoint', () => expect(smoothstep(0, 1, 0.5)).toBe(0.5));
  });

  describe('degToRad / radToDeg', () => {
    it('converts 180 degrees to PI', () => expect(degToRad(180)).toBeCloseTo(Math.PI));
    it('converts PI to 180 degrees', () => expect(radToDeg(Math.PI)).toBeCloseTo(180));
    it('round-trips', () => expect(radToDeg(degToRad(45))).toBeCloseTo(45));
  });

  describe('isPowerOfTwo', () => {
    it('1 is power of two', () => expect(isPowerOfTwo(1)).toBe(true));
    it('2 is power of two', () => expect(isPowerOfTwo(2)).toBe(true));
    it('256 is power of two', () => expect(isPowerOfTwo(256)).toBe(true));
    it('3 is not power of two', () => expect(isPowerOfTwo(3)).toBe(false));
    it('0 is not power of two', () => expect(isPowerOfTwo(0)).toBe(false));
  });

  describe('nextPowerOfTwo', () => {
    it('returns 1 for 0', () => expect(nextPowerOfTwo(0)).toBe(1));
    it('returns 1 for 1', () => expect(nextPowerOfTwo(1)).toBe(1));
    it('returns 4 for 3', () => expect(nextPowerOfTwo(3)).toBe(4));
    it('returns 256 for 200', () => expect(nextPowerOfTwo(200)).toBe(256));
    it('returns 512 for 512', () => expect(nextPowerOfTwo(512)).toBe(512));
  });

  describe('constants', () => {
    it('EPSILON is small positive', () => expect(EPSILON).toBeGreaterThan(0));
    it('DEG2RAD * 180 ≈ PI', () => expect(DEG2RAD * 180).toBeCloseTo(Math.PI));
    it('RAD2DEG * PI ≈ 180', () => expect(RAD2DEG * Math.PI).toBeCloseTo(180));
  });
});
