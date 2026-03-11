import { Vector3 } from '../math/Vector3';
import { Quaternion } from '../math/Quaternion';
import { ColliderType, Collider } from './Collider';
import { SphereCollider } from './SphereCollider';
import { BoxCollider } from './BoxCollider';
import { PlaneCollider } from './PlaneCollider';
import { CapsuleCollider } from './CapsuleCollider';
import { ContactManifold } from './ContactManifold';
import { RigidBody } from './RigidBody';

const EPSILON = 1e-6;
const CONTACT_MARGIN = 0.01;

/**
 * Narrow-phase collision detection.
 * Tests exact collision between pairs of collider shapes and produces ContactManifolds.
 */
export class NarrowPhase {
  /**
   * Test collision between two bodies. Returns a ContactManifold or null if no collision.
   * Normal always points from B toward A.
   */
  test(bodyA: RigidBody, bodyB: RigidBody, indexA: number, indexB: number): ContactManifold | null {
    const cA = bodyA.collider;
    const cB = bodyB.collider;
    if (!cA || !cB) return null;

    let manifold: ContactManifold | null = null;

    // Dispatch based on collider types
    const typeA = cA.type;
    const typeB = cB.type;

    if (typeA === ColliderType.SPHERE && typeB === ColliderType.SPHERE) {
      manifold = this.sphereVsSphere(
        cA as SphereCollider, bodyA.position, 
        cB as SphereCollider, bodyB.position);
    } else if (typeA === ColliderType.SPHERE && typeB === ColliderType.BOX) {
      manifold = this.sphereVsBox(
        cA as SphereCollider, bodyA.position,
        cB as BoxCollider, bodyB.position, bodyB.rotation);
    } else if (typeA === ColliderType.BOX && typeB === ColliderType.SPHERE) {
      manifold = this.sphereVsBox(
        cB as SphereCollider, bodyB.position,
        cA as BoxCollider, bodyA.position, bodyA.rotation);
      if (manifold) this.flipManifold(manifold);  
    } else if (typeA === ColliderType.SPHERE && typeB === ColliderType.PLANE) {
      manifold = this.sphereVsPlane(
        cA as SphereCollider, bodyA.position,
        cB as PlaneCollider);
    } else if (typeA === ColliderType.PLANE && typeB === ColliderType.SPHERE) {
      manifold = this.sphereVsPlane(
        cB as SphereCollider, bodyB.position,
        cA as PlaneCollider);
      if (manifold) this.flipManifold(manifold);
    } else if (typeA === ColliderType.BOX && typeB === ColliderType.BOX) {
      manifold = this.boxVsBox(
        cA as BoxCollider, bodyA.position, bodyA.rotation,
        cB as BoxCollider, bodyB.position, bodyB.rotation);
    } else if (typeA === ColliderType.BOX && typeB === ColliderType.PLANE) {
      manifold = this.boxVsPlane(
        cA as BoxCollider, bodyA.position, bodyA.rotation,
        cB as PlaneCollider);
    } else if (typeA === ColliderType.PLANE && typeB === ColliderType.BOX) {
      manifold = this.boxVsPlane(
        cB as BoxCollider, bodyB.position, bodyB.rotation,
        cA as PlaneCollider);
      if (manifold) this.flipManifold(manifold);
    } else if (typeA === ColliderType.CAPSULE && typeB === ColliderType.CAPSULE) {
      manifold = this.capsuleVsCapsule(
        cA as CapsuleCollider, bodyA.position, bodyA.rotation,
        cB as CapsuleCollider, bodyB.position, bodyB.rotation);
    } else if (typeA === ColliderType.SPHERE && typeB === ColliderType.CAPSULE) {
      manifold = this.sphereVsCapsule(
        cA as SphereCollider, bodyA.position,
        cB as CapsuleCollider, bodyB.position, bodyB.rotation);
    } else if (typeA === ColliderType.CAPSULE && typeB === ColliderType.SPHERE) {
      manifold = this.sphereVsCapsule(
        cB as SphereCollider, bodyB.position,
        cA as CapsuleCollider, bodyA.position, bodyA.rotation);
      if (manifold) this.flipManifold(manifold);
    } else if (typeA === ColliderType.CAPSULE && typeB === ColliderType.PLANE) {
      manifold = this.capsuleVsPlane(
        cA as CapsuleCollider, bodyA.position, bodyA.rotation,
        cB as PlaneCollider);
    } else if (typeA === ColliderType.PLANE && typeB === ColliderType.CAPSULE) {
      manifold = this.capsuleVsPlane(
        cB as CapsuleCollider, bodyB.position, bodyB.rotation,
        cA as PlaneCollider);
      if (manifold) this.flipManifold(manifold);
    } else if (typeA === ColliderType.BOX && typeB === ColliderType.CAPSULE) {
      manifold = this.boxVsCapsule(
        cA as BoxCollider, bodyA.position, bodyA.rotation,
        cB as CapsuleCollider, bodyB.position, bodyB.rotation);
    } else if (typeA === ColliderType.CAPSULE && typeB === ColliderType.BOX) {
      manifold = this.boxVsCapsule(
        cB as BoxCollider, bodyB.position, bodyB.rotation,
        cA as CapsuleCollider, bodyA.position, bodyA.rotation);
      if (manifold) this.flipManifold(manifold);
    }

    if (manifold) {
      manifold.bodyIndexA = indexA;
      manifold.bodyIndexB = indexB;
    }
    return manifold;
  }

  // ---------------------------------------------------------------
  // Sphere vs Sphere
  // ---------------------------------------------------------------
  private sphereVsSphere(
    sA: SphereCollider, posA: Vector3,
    sB: SphereCollider, posB: Vector3,
  ): ContactManifold | null {
    const cA = sA.getWorldCenter(posA);
    const cB = sB.getWorldCenter(posB);
    const diff = cA.subtract(cB);
    const dist2 = diff.lengthSquared();
    const radiusSum = sA.radius + sB.radius;

    if (dist2 > radiusSum * radiusSum) return null;

    const dist = Math.sqrt(dist2);
    const normal = dist > EPSILON ? diff.scale(1 / dist) : Vector3.up();
    const penetration = radiusSum - dist;
    const contactPoint = cB.add(normal.scale(sB.radius));

    const manifold = new ContactManifold();
    manifold.addContact(contactPoint, normal, penetration);
    return manifold;
  }

  // ---------------------------------------------------------------
  // Sphere vs Box
  // ---------------------------------------------------------------
  private sphereVsBox(
    sphere: SphereCollider, spherePos: Vector3,
    box: BoxCollider, boxPos: Vector3, boxRot: Quaternion,
  ): ContactManifold | null {
    const sphereCenter = sphere.getWorldCenter(spherePos);
    const boxCenter = box.getWorldCenter(boxPos);

    // Transform sphere center into box local space
    const invRot = boxRot.inverse();
    const localCenter = invRot.rotateVector(sphereCenter.subtract(boxCenter));

    // Clamp to box half-extents to find closest point
    const hx = box.halfExtents.x;
    const hy = box.halfExtents.y;
    const hz = box.halfExtents.z;
    const closest = new Vector3(
      Math.max(-hx, Math.min(hx, localCenter.x)),
      Math.max(-hy, Math.min(hy, localCenter.y)),
      Math.max(-hz, Math.min(hz, localCenter.z)),
    );

    const diff = localCenter.subtract(closest);
    const dist2 = diff.lengthSquared();

    const radiusMargin = sphere.radius + CONTACT_MARGIN;
    if (dist2 > radiusMargin * radiusMargin) return null;

    const dist = Math.sqrt(dist2);

    let localNormal: Vector3;
    let penetration: number;

    if (dist > EPSILON) {
      // Sphere center is outside the box
      localNormal = diff.scale(1 / dist);
      penetration = radiusMargin - dist;
    } else {
      // Sphere center is inside the box — push along smallest penetration axis
      const px = hx - Math.abs(localCenter.x);
      const py = hy - Math.abs(localCenter.y);
      const pz = hz - Math.abs(localCenter.z);
      
      if (px <= py && px <= pz) {
        localNormal = new Vector3(localCenter.x >= 0 ? 1 : -1, 0, 0);
        penetration = px + sphere.radius;
      } else if (py <= pz) {
        localNormal = new Vector3(0, localCenter.y >= 0 ? 1 : -1, 0);
        penetration = py + sphere.radius;
      } else {
        localNormal = new Vector3(0, 0, localCenter.z >= 0 ? 1 : -1);
        penetration = pz + sphere.radius;
      }
    }

    // Transform back to world space
    const worldNormal = boxRot.rotateVector(localNormal);
    const worldClosest = boxCenter.add(boxRot.rotateVector(closest));

    const manifold = new ContactManifold();
    manifold.addContact(worldClosest, worldNormal, penetration);
    return manifold;
  }

  // ---------------------------------------------------------------
  // Sphere vs Plane
  // ---------------------------------------------------------------
  private sphereVsPlane(
    sphere: SphereCollider, spherePos: Vector3,
    plane: PlaneCollider,
  ): ContactManifold | null {
    const center = sphere.getWorldCenter(spherePos);
    const dist = plane.signedDistanceTo(center);

    if (dist > sphere.radius + CONTACT_MARGIN) return null;

    const penetration = sphere.radius + CONTACT_MARGIN - dist;
    const contactPoint = center.subtract(plane.normal.scale(dist));

    const manifold = new ContactManifold();
    manifold.addContact(contactPoint, plane.normal.clone(), penetration);
    return manifold;
  }

  // ---------------------------------------------------------------
  // Box vs Plane
  // ---------------------------------------------------------------
  private boxVsPlane(
    box: BoxCollider, boxPos: Vector3, boxRot: Quaternion,
    plane: PlaneCollider,
  ): ContactManifold | null {
    const vertices = box.getWorldVertices(boxPos, boxRot);
    const manifold = new ContactManifold();

    for (const v of vertices) {
      const dist = plane.signedDistanceTo(v);
      if (dist < CONTACT_MARGIN) {
        manifold.addContact(
          v.subtract(plane.normal.scale(dist)),
          plane.normal.clone(),
          CONTACT_MARGIN - dist,
        );
      }
    }

    return manifold.contacts.length > 0 ? manifold : null;
  }

  // ---------------------------------------------------------------
  // Box vs Box (SAT with 15 axes)
  // ---------------------------------------------------------------
  private boxVsBox(
    boxA: BoxCollider, posA: Vector3, rotA: Quaternion,
    boxB: BoxCollider, posB: Vector3, rotB: Quaternion,
  ): ContactManifold | null {
    const centerA = boxA.getWorldCenter(posA);
    const centerB = boxB.getWorldCenter(posB);
    const axesA = boxA.getWorldAxes(rotA);
    const axesB = boxB.getWorldAxes(rotB);
    const heA = boxA.halfExtents;
    const heB = boxB.halfExtents;
    const heAArr = [heA.x, heA.y, heA.z];
    const heBArr = [heB.x, heB.y, heB.z];

    const T = centerB.subtract(centerA);

    let minPen = Infinity;
    let minAxis = Vector3.up();
    let minCategory = 0; // 0 = face of A, 1 = face of B, 2 = edge cross

    // Helper: test one SAT axis, return false if separating
    const satTest = (axis: Vector3, category: number): boolean => {
      const projA =
        Math.abs(axesA[0].dot(axis)) * heAArr[0] +
        Math.abs(axesA[1].dot(axis)) * heAArr[1] +
        Math.abs(axesA[2].dot(axis)) * heAArr[2];
      const projB =
        Math.abs(axesB[0].dot(axis)) * heBArr[0] +
        Math.abs(axesB[1].dot(axis)) * heBArr[1] +
        Math.abs(axesB[2].dot(axis)) * heBArr[2];

      const dist = Math.abs(T.dot(axis));
      const pen = projA + projB - dist;

      if (pen < 0) return false; // separating axis

      if (pen < minPen) {
        minPen = pen;
        // Ensure normal points from B toward A:
        // T goes from A to B, so if T·axis > 0, axis points A→B; negate it.
        minAxis = T.dot(axis) > 0 ? axis.negate() : axis;
        minCategory = category;
      }
      return true;
    };

    // Face normals of A
    for (let i = 0; i < 3; i++) {
      if (!satTest(axesA[i], 0)) return null;
    }
    // Face normals of B
    for (let i = 0; i < 3; i++) {
      if (!satTest(axesB[i], 1)) return null;
    }
    // Edge cross products
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const cross = axesA[i].cross(axesB[j]);
        if (cross.lengthSquared() > EPSILON * EPSILON) {
          if (!satTest(cross.normalize(), 2)) return null;
        }
      }
    }

    // --- Contact generation ---
    const manifold = new ContactManifold();
    const n = minAxis;

    if (minCategory === 2) {
      // Edge-edge: single contact at midpoint
      const contactPt = centerA.add(centerB).scale(0.5);
      manifold.addContact(contactPt, n.clone(), minPen);
    } else {
      // Face contact — project vertices of the incident box through the reference face
      const projA_n =
        Math.abs(axesA[0].dot(n)) * heAArr[0] +
        Math.abs(axesA[1].dot(n)) * heAArr[1] +
        Math.abs(axesA[2].dot(n)) * heAArr[2];
      const projB_n =
        Math.abs(axesB[0].dot(n)) * heBArr[0] +
        Math.abs(axesB[1].dot(n)) * heBArr[1] +
        Math.abs(axesB[2].dot(n)) * heBArr[2];

      interface CandidateContact { point: Vector3; pen: number; }
      const candidates: CandidateContact[] = [];

      if (minCategory === 0) {
        // Reference = A, incident = B → check B's vertices against A's face
        const vertsB = boxB.getWorldVertices(posB, rotB);
        for (const v of vertsB) {
          const pen = v.subtract(centerA).dot(n) + projA_n;
          if (pen > -CONTACT_MARGIN) {
            candidates.push({ point: v, pen: pen + CONTACT_MARGIN });
          }
        }
      } else {
        // Reference = B, incident = A → check A's vertices against B's face
        const vertsA = boxA.getWorldVertices(posA, rotA);
        for (const v of vertsA) {
          const pen = centerB.subtract(v).dot(n) + projB_n;
          if (pen > -CONTACT_MARGIN) {
            candidates.push({ point: v, pen: pen + CONTACT_MARGIN });
          }
        }
      }

      if (candidates.length > 4) {
        // Keep the 4 deepest contacts
        candidates.sort((a, b) => b.pen - a.pen);
        candidates.length = 4;
      }

      for (const c of candidates) {
        manifold.addContact(c.point, n.clone(), c.pen);
      }

      // Fallback: if no vertex contacts found
      if (manifold.contacts.length === 0) {
        const contactPt = centerA.add(centerB).scale(0.5);
        manifold.addContact(contactPt, n.clone(), minPen);
      }
    }

    return manifold;
  }

  // ---------------------------------------------------------------
  // Capsule vs Capsule
  // ---------------------------------------------------------------
  private capsuleVsCapsule(
    capA: CapsuleCollider, posA: Vector3, rotA: Quaternion,
    capB: CapsuleCollider, posB: Vector3, rotB: Quaternion,
  ): ContactManifold | null {
    const [a1, a2] = capA.getWorldSegment(posA, rotA);
    const [b1, b2] = capB.getWorldSegment(posB, rotB);

    const [closestA, closestB] = closestPointsOnSegments(a1, a2, b1, b2);
    const diff = closestA.subtract(closestB);
    const dist2 = diff.lengthSquared();
    const radiusSum = capA.radius + capB.radius;

    if (dist2 > radiusSum * radiusSum) return null;

    const dist = Math.sqrt(dist2);
    const normal = dist > EPSILON ? diff.scale(1 / dist) : Vector3.up();
    const penetration = radiusSum - dist;
    const contactPoint = closestB.add(normal.scale(capB.radius));

    const manifold = new ContactManifold();
    manifold.addContact(contactPoint, normal, penetration);
    return manifold;
  }

  // ---------------------------------------------------------------
  // Sphere vs Capsule
  // ---------------------------------------------------------------
  private sphereVsCapsule(
    sphere: SphereCollider, spherePos: Vector3,
    capsule: CapsuleCollider, capPos: Vector3, capRot: Quaternion,
  ): ContactManifold | null {
    const sphereCenter = sphere.getWorldCenter(spherePos);
    const [p1, p2] = capsule.getWorldSegment(capPos, capRot);

    const closest = closestPointOnSegment(sphereCenter, p1, p2);
    const diff = sphereCenter.subtract(closest);
    const dist2 = diff.lengthSquared();
    const radiusSum = sphere.radius + capsule.radius;

    if (dist2 > radiusSum * radiusSum) return null;

    const dist = Math.sqrt(dist2);
    const normal = dist > EPSILON ? diff.scale(1 / dist) : Vector3.up();
    const penetration = radiusSum - dist;
    const contactPoint = closest.add(normal.scale(capsule.radius));

    const manifold = new ContactManifold();
    manifold.addContact(contactPoint, normal, penetration);
    return manifold;
  }

  // ---------------------------------------------------------------
  // Capsule vs Plane
  // ---------------------------------------------------------------
  private capsuleVsPlane(
    capsule: CapsuleCollider, capPos: Vector3, capRot: Quaternion,
    plane: PlaneCollider,
  ): ContactManifold | null {
    const [p1, p2] = capsule.getWorldSegment(capPos, capRot);
    const manifold = new ContactManifold();

    for (const p of [p1, p2]) {
      const dist = plane.signedDistanceTo(p) - capsule.radius;
      if (dist < 0) {
        const contactPoint = p.subtract(plane.normal.scale(dist + capsule.radius));
        manifold.addContact(contactPoint, plane.normal.clone(), -dist);
      }
    }

    return manifold.contacts.length > 0 ? manifold : null;
  }

  // ---------------------------------------------------------------
  // Box vs Capsule (closest point approach)
  // ---------------------------------------------------------------
  private boxVsCapsule(
    box: BoxCollider, boxPos: Vector3, boxRot: Quaternion,
    capsule: CapsuleCollider, capPos: Vector3, capRot: Quaternion,
  ): ContactManifold | null {
    const boxCenter = box.getWorldCenter(boxPos);
    const invRot = boxRot.inverse();
    const [p1, p2] = capsule.getWorldSegment(capPos, capRot);

    // Transform capsule segment to box local space
    const localP1 = invRot.rotateVector(p1.subtract(boxCenter));
    const localP2 = invRot.rotateVector(p2.subtract(boxCenter));

    // Find closest point on segment to box
    // Sample several points on the segment and pick the closest
    const hx = box.halfExtents.x;
    const hy = box.halfExtents.y;
    const hz = box.halfExtents.z;

    let bestDist2 = Infinity;
    let bestLocalSegPt = localP1;
    let bestLocalBoxPt = localP1;

    const steps = 8;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const segPt = localP1.lerp(localP2, t);
      const clamped = new Vector3(
        Math.max(-hx, Math.min(hx, segPt.x)),
        Math.max(-hy, Math.min(hy, segPt.y)),
        Math.max(-hz, Math.min(hz, segPt.z)),
      );
      const d2 = segPt.subtract(clamped).lengthSquared();
      if (d2 < bestDist2) {
        bestDist2 = d2;
        bestLocalSegPt = segPt;
        bestLocalBoxPt = clamped;
      }
    }

    // Refine: find closest point on segment to the best box point
    const closestOnSeg = closestPointOnSegment(bestLocalBoxPt, localP1, localP2);
    const clampedFinal = new Vector3(
      Math.max(-hx, Math.min(hx, closestOnSeg.x)),
      Math.max(-hy, Math.min(hy, closestOnSeg.y)),
      Math.max(-hz, Math.min(hz, closestOnSeg.z)),
    );

    const diff = closestOnSeg.subtract(clampedFinal);
    const dist = diff.length();

    if (dist > capsule.radius) return null;

    let localNormal: Vector3;
    let penetration: number;

    if (dist > EPSILON) {
      localNormal = diff.scale(1 / dist);
      penetration = capsule.radius - dist;
    } else {
      // Capsule segment inside box
      const px = hx - Math.abs(closestOnSeg.x);
      const py = hy - Math.abs(closestOnSeg.y);
      const pz = hz - Math.abs(closestOnSeg.z);
      if (px <= py && px <= pz) {
        localNormal = new Vector3(closestOnSeg.x >= 0 ? 1 : -1, 0, 0);
        penetration = px + capsule.radius;
      } else if (py <= pz) {
        localNormal = new Vector3(0, closestOnSeg.y >= 0 ? 1 : -1, 0);
        penetration = py + capsule.radius;
      } else {
        localNormal = new Vector3(0, 0, closestOnSeg.z >= 0 ? 1 : -1);
        penetration = pz + capsule.radius;
      }
    }

    // Transform back to world
    const worldNormal = boxRot.rotateVector(localNormal);
    const worldContact = boxCenter.add(boxRot.rotateVector(clampedFinal));

    const manifold = new ContactManifold();
    manifold.addContact(worldContact, worldNormal, penetration);
    return manifold;
  }

  // ---------------------------------------------------------------
  // Utility
  // ---------------------------------------------------------------
  private flipManifold(manifold: ContactManifold): void {
    for (const c of manifold.contacts) {
      c.normal = c.normal.negate();
    }
    // Swap indices
    const tmp = manifold.bodyIndexA;
    manifold.bodyIndexA = manifold.bodyIndexB;
    manifold.bodyIndexB = tmp;
  }
}

// ---------------------------------------------------------------
// Helper: closest point on line segment to a point
// ---------------------------------------------------------------
function closestPointOnSegment(point: Vector3, a: Vector3, b: Vector3): Vector3 {
  const ab = b.subtract(a);
  const len2 = ab.lengthSquared();
  if (len2 < EPSILON * EPSILON) return a.clone();
  let t = point.subtract(a).dot(ab) / len2;
  t = Math.max(0, Math.min(1, t));
  return a.add(ab.scale(t));
}

// ---------------------------------------------------------------
// Helper: closest points between two line segments
// ---------------------------------------------------------------
function closestPointsOnSegments(
  a1: Vector3, a2: Vector3,
  b1: Vector3, b2: Vector3,
): [Vector3, Vector3] {
  const d1 = a2.subtract(a1);
  const d2 = b2.subtract(b1);
  const r = a1.subtract(b1);

  const a = d1.dot(d1);
  const e = d2.dot(d2);
  const f = d2.dot(r);

  let s: number, t: number;

  if (a < EPSILON && e < EPSILON) {
    return [a1.clone(), b1.clone()];
  }
  if (a < EPSILON) {
    s = 0;
    t = Math.max(0, Math.min(1, f / e));
  } else {
    const c = d1.dot(r);
    if (e < EPSILON) {
      t = 0;
      s = Math.max(0, Math.min(1, -c / a));
    } else {
      const b = d1.dot(d2);
      const denom = a * e - b * b;

      if (Math.abs(denom) > EPSILON) {
        s = Math.max(0, Math.min(1, (b * f - c * e) / denom));
      } else {
        s = 0;
      }

      t = (b * s + f) / e;

      if (t < 0) {
        t = 0;
        s = Math.max(0, Math.min(1, -c / a));
      } else if (t > 1) {
        t = 1;
        s = Math.max(0, Math.min(1, (b - c) / a));
      }
    }
  }

  const closestA = a1.add(d1.scale(s));
  const closestB = b1.add(d2.scale(t));
  return [closestA, closestB];
}
