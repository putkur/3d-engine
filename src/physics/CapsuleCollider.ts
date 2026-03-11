import { Vector3 } from '../math/Vector3';
import { Quaternion } from '../math/Quaternion';
import { Collider, ColliderType, AABB } from './Collider';

/**
 * Capsule collision shape: a cylinder with hemispherical end caps.
 * Defined by a height (distance between hemisphere centers) and a radius.
 * Aligned along the local Y axis.
 */
export class CapsuleCollider extends Collider {
  public readonly type = ColliderType.CAPSULE;
  /** Distance between the two hemisphere centers (not total height). */
  public height: number;
  /** Radius of the hemispheres and cylinder. */
  public radius: number;

  constructor(height = 1, radius = 0.5) {
    super();
    this.height = height;
    this.radius = radius;
  }

  /** Total height of the capsule (including hemispheres). */
  get totalHeight(): number {
    return this.height + 2 * this.radius;
  }

  computeAABB(position: Vector3, rotation: Quaternion): AABB {
    const center = position.add(this.offset);
    // Get world-space up axis of capsule
    const localUp = new Vector3(0, this.height * 0.5, 0);
    const worldUp = rotation.rotateVector(localUp);

    const p1 = center.add(worldUp);
    const p2 = center.subtract(worldUp);

    const r = new Vector3(this.radius, this.radius, this.radius);
    return {
      min: new Vector3(
        Math.min(p1.x, p2.x) - this.radius,
        Math.min(p1.y, p2.y) - this.radius,
        Math.min(p1.z, p2.z) - this.radius,
      ),
      max: new Vector3(
        Math.max(p1.x, p2.x) + this.radius,
        Math.max(p1.y, p2.y) + this.radius,
        Math.max(p1.z, p2.z) + this.radius,
      ),
    };
  }

  support(direction: Vector3, position: Vector3, rotation: Quaternion): Vector3 {
    const center = position.add(this.offset);
    const localUp = new Vector3(0, this.height * 0.5, 0);
    const worldUp = rotation.rotateVector(localUp);

    // Pick the hemisphere center most in the direction
    const p1 = center.add(worldUp);
    const p2 = center.subtract(worldUp);

    const dot1 = direction.dot(p1);
    const dot2 = direction.dot(p2);
    const best = dot1 >= dot2 ? p1 : p2;

    // Extend by radius in direction
    const len = direction.length();
    if (len < 1e-10) return best;
    return best.add(direction.scale(this.radius / len));
  }

  /**
   * Get the world-space endpoints (hemisphere centers) of the capsule segment.
   */
  getWorldSegment(position: Vector3, rotation: Quaternion): [Vector3, Vector3] {
    const center = position.add(this.offset);
    const localUp = new Vector3(0, this.height * 0.5, 0);
    const worldUp = rotation.rotateVector(localUp);
    return [center.add(worldUp), center.subtract(worldUp)];
  }
}
