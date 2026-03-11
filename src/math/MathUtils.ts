export const EPSILON = 1e-6;
export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function inverseLerp(a: number, b: number, value: number): number {
  if (Math.abs(b - a) < EPSILON) return 0;
  return (value - a) / (b - a);
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function degToRad(degrees: number): number {
  return degrees * DEG2RAD;
}

export function radToDeg(radians: number): number {
  return radians * RAD2DEG;
}

export function isPowerOfTwo(value: number): boolean {
  return (value & (value - 1)) === 0 && value > 0;
}

export function nextPowerOfTwo(value: number): number {
  if (value <= 0) return 1;
  value--;
  value |= value >> 1;
  value |= value >> 2;
  value |= value >> 4;
  value |= value >> 8;
  value |= value >> 16;
  return value + 1;
}
