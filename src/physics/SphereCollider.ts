import { Vector3 } from '../math/Vector3';
import { Quaternion } from '../math/Quaternion';
import { Collider, ColliderType, AABB } from './Collider';

/**
 * Sphere collision shape defined by a radius.
 */
export class SphereCollider extends Collider {
  public readonly type = ColliderType.SPHERE;
  public radius: number;

  constructor(radius = 0.5) {
    super();
    this.radius = radius;
  }

  computeAABB(position: Vector3, _rotation: Quaternion): AABB {
    const center = position.add(this.offset);
    const r = new Vector3(this.radius, this.radius, this.radius);
    return {
      min: center.subtract(r),
      max: center.add(r),
    };
  }

  support(direction: Vector3, position: Vector3, _rotation: Quaternion): Vector3 {
    const center = position.add(this.offset);
    const len = direction.length();
    if (len < 1e-10) return center;
    return center.add(direction.scale(this.radius / len));
  }

  /** Get world-space center of the sphere. */
  getWorldCenter(position: Vector3): Vector3 {
    return position.add(this.offset);
  }
}
