import { Vector3 } from '../math/Vector3';

/**
 * A single contact point between two rigid bodies.
 */
export interface ContactPoint {
  /** World-space contact position. */
  point: Vector3;
  /** Contact normal pointing from body B toward body A. */
  normal: Vector3;
  /** Penetration depth (positive = overlapping). */
  penetrationDepth: number;
}

/**
 * Contains all contact information for a collision between two bodies.
 */
export class ContactManifold {
  public readonly contacts: ContactPoint[] = [];

  /** Index of body A in the physics world. */
  public bodyIndexA = -1;
  /** Index of body B in the physics world. */
  public bodyIndexB = -1;

  /** Cached normal impulse per contact (for warm starting). */
  public normalImpulses: number[] = [];
  /** Cached tangent impulse per contact (for warm starting). */
  public tangentImpulses: number[] = [];

  addContact(point: Vector3, normal: Vector3, penetrationDepth: number): void {
    this.contacts.push({ point, normal, penetrationDepth });
    this.normalImpulses.push(0);
    this.tangentImpulses.push(0);
  }

  clear(): void {
    this.contacts.length = 0;
    this.normalImpulses.length = 0;
    this.tangentImpulses.length = 0;
  }
}
