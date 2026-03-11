import { Vector3 } from '../math/Vector3';
import { Quaternion } from '../math/Quaternion';
import { Matrix4 } from '../math/Matrix4';

/**
 * Collider shape types.
 */
export const enum ColliderType {
  SPHERE = 0,
  BOX = 1,
  PLANE = 2,
  CAPSULE = 3,
}

/**
 * Axis-Aligned Bounding Box for broad-phase.
 */
export interface AABB {
  min: Vector3;
  max: Vector3;
}

/**
 * Base collider interface. All shapes implement this.
 */
export abstract class Collider {
  public abstract readonly type: ColliderType;

  /** Local-space offset from the rigid body center. */
  public offset: Vector3 = Vector3.zero();

  /**
   * Compute the world-space AABB given a body position and rotation.
   */
  abstract computeAABB(position: Vector3, rotation: Quaternion): AABB;

  /**
   * Get the support point in the given world-space direction (for GJK/EPA if needed).
   * Used mainly for box and capsule shapes.
   */
  abstract support(direction: Vector3, position: Vector3, rotation: Quaternion): Vector3;
}
