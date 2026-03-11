import { Vector3 } from '../math/Vector3';
import { Quaternion } from '../math/Quaternion';
import { Collider, ColliderType, AABB } from './Collider';

/**
 * Infinite plane / half-space collider.
 * Defined by a normal and distance from origin: dot(normal, point) = distance.
 * The solid half-space is on the negative side (below the plane).
 * Typically used for ground/walls. Always treated as static.
 */
export class PlaneCollider extends Collider {
  public readonly type = ColliderType.PLANE;
  /** Plane normal (unit vector). */
  public normal: Vector3;
  /** Signed distance from origin along normal. */
  public distance: number;

  constructor(normal?: Vector3, distance = 0) {
    super();
    this.normal = normal ? normal.normalize() : Vector3.up();
    this.distance = distance;
  }

  computeAABB(_position: Vector3, _rotation: Quaternion): AABB {
    // Infinite plane — use a very large AABB so it always overlaps in broadphase
    const BIG = 1e6;
    return {
      min: new Vector3(-BIG, -BIG, -BIG),
      max: new Vector3(BIG, BIG, BIG),
    };
  }

  support(direction: Vector3, position: Vector3, _rotation: Quaternion): Vector3 {
    // Not meaningful for an infinite plane — return a point on the plane
    // in the given direction for completeness
    const d = direction.dot(this.normal);
    if (Math.abs(d) < 1e-10) {
      return position.add(this.normal.scale(this.distance));
    }
    return position.add(this.normal.scale(this.distance));
  }

  /**
   * Signed distance from a point to the plane.
   * Positive = above the plane (same side as normal).
   * Negative = below the plane.
   */
  signedDistanceTo(point: Vector3): number {
    return point.dot(this.normal) - this.distance;
  }
}
