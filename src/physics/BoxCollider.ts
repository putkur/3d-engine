import { Vector3 } from '../math/Vector3';
import { Quaternion } from '../math/Quaternion';
import { Collider, ColliderType, AABB } from './Collider';

/**
 * Box collision shape defined by half-extents.
 * Supports both AABB (when rotation is identity) and OBB (oriented).
 */
export class BoxCollider extends Collider {
  public readonly type = ColliderType.BOX;
  /** Half-extents along each local axis. */
  public halfExtents: Vector3;

  constructor(halfExtents?: Vector3) {
    super();
    this.halfExtents = halfExtents ?? new Vector3(0.5, 0.5, 0.5);
  }

  computeAABB(position: Vector3, rotation: Quaternion): AABB {
    const center = position.add(this.offset);
    // Rotate each local axis, take absolute value for AABB extent
    const axes = this.getWorldAxes(rotation);
    const ex =
      Math.abs(axes[0].x) * this.halfExtents.x +
      Math.abs(axes[1].x) * this.halfExtents.y +
      Math.abs(axes[2].x) * this.halfExtents.z;
    const ey =
      Math.abs(axes[0].y) * this.halfExtents.x +
      Math.abs(axes[1].y) * this.halfExtents.y +
      Math.abs(axes[2].y) * this.halfExtents.z;
    const ez =
      Math.abs(axes[0].z) * this.halfExtents.x +
      Math.abs(axes[1].z) * this.halfExtents.y +
      Math.abs(axes[2].z) * this.halfExtents.z;

    const extent = new Vector3(ex, ey, ez);
    return {
      min: center.subtract(extent),
      max: center.add(extent),
    };
  }

  support(direction: Vector3, position: Vector3, rotation: Quaternion): Vector3 {
    const center = position.add(this.offset);
    // Transform direction into local space
    const invRot = rotation.inverse();
    const localDir = invRot.rotateVector(direction);

    // Pick the vertex most extreme in localDir
    const sx = localDir.x >= 0 ? this.halfExtents.x : -this.halfExtents.x;
    const sy = localDir.y >= 0 ? this.halfExtents.y : -this.halfExtents.y;
    const sz = localDir.z >= 0 ? this.halfExtents.z : -this.halfExtents.z;

    // Transform back to world space
    const localPoint = new Vector3(sx, sy, sz);
    return center.add(rotation.rotateVector(localPoint));
  }

  /** Get the 3 world-space axes of the box (unit vectors). */
  getWorldAxes(rotation: Quaternion): [Vector3, Vector3, Vector3] {
    return [
      rotation.rotateVector(Vector3.right()),
      rotation.rotateVector(Vector3.up()),
      rotation.rotateVector(new Vector3(0, 0, 1)),
    ];
  }

  /** Get world-space center of the box. */
  getWorldCenter(position: Vector3): Vector3 {
    return position.add(this.offset);
  }

  /** Get all 8 world-space vertices of the OBB. */
  getWorldVertices(position: Vector3, rotation: Quaternion): Vector3[] {
    const center = position.add(this.offset);
    const hx = this.halfExtents.x;
    const hy = this.halfExtents.y;
    const hz = this.halfExtents.z;
    const verts: Vector3[] = [];
    for (let sx = -1; sx <= 1; sx += 2) {
      for (let sy = -1; sy <= 1; sy += 2) {
        for (let sz = -1; sz <= 1; sz += 2) {
          const local = new Vector3(sx * hx, sy * hy, sz * hz);
          verts.push(center.add(rotation.rotateVector(local)));
        }
      }
    }
    return verts;
  }
}
