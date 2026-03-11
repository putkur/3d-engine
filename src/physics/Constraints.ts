import { Vector3 } from '../math/Vector3';
import { RigidBody, BodyType } from './RigidBody';

const EPSILON = 1e-6;

/**
 * Base constraint interface.
 */
export abstract class Constraint {
  public bodyA: RigidBody;
  public bodyB: RigidBody;

  constructor(bodyA: RigidBody, bodyB: RigidBody) {
    this.bodyA = bodyA;
    this.bodyB = bodyB;
  }

  /** Solve the constraint (adjust velocities). Called each solver iteration. */
  abstract solve(dt: number): void;
}

/**
 * Distance constraint: maintains a fixed distance between two body anchor points.
 */
export class DistanceConstraint extends Constraint {
  /** Local-space anchor on body A. */
  public anchorA: Vector3;
  /** Local-space anchor on body B. */
  public anchorB: Vector3;
  /** Target distance. */
  public distance: number;
  /** Stiffness factor (0 = no correction, 1 = instant). */
  public stiffness = 1.0;

  constructor(
    bodyA: RigidBody, bodyB: RigidBody,
    anchorA: Vector3, anchorB: Vector3,
    distance?: number,
  ) {
    super(bodyA, bodyB);
    this.anchorA = anchorA;
    this.anchorB = anchorB;

    // Auto-compute distance from current positions if not specified
    if (distance !== undefined) {
      this.distance = distance;
    } else {
      const worldA = bodyA.position.add(bodyA.rotation.rotateVector(anchorA));
      const worldB = bodyB.position.add(bodyB.rotation.rotateVector(anchorB));
      this.distance = worldA.distance(worldB);
    }
  }

  solve(_dt: number): void {
    const worldA = this.bodyA.position.add(this.bodyA.rotation.rotateVector(this.anchorA));
    const worldB = this.bodyB.position.add(this.bodyB.rotation.rotateVector(this.anchorB));

    const diff = worldA.subtract(worldB);
    const currentDist = diff.length();
    if (currentDist < EPSILON) return;

    const normal = diff.scale(1 / currentDist);
    const error = currentDist - this.distance;

    const invMassSum = this.bodyA.inverseMass + this.bodyB.inverseMass;
    if (invMassSum < EPSILON) return;

    // Velocity constraint: project relative velocity onto direction
    const rA = worldA.subtract(this.bodyA.position);
    const rB = worldB.subtract(this.bodyB.position);
    const velA = this.bodyA.linearVelocity.add(this.bodyA.angularVelocity.cross(rA));
    const velB = this.bodyB.linearVelocity.add(this.bodyB.angularVelocity.cross(rB));
    const relVel = velA.subtract(velB).dot(normal);

    // Baumgarte position correction
    const biasFactor = 0.2;
    const bias = biasFactor * error;

    const rAxN = rA.cross(normal);
    const rBxN = rB.cross(normal);
    const angMassA = rAxN.x * rAxN.x * this.bodyA.inverseInertia.x +
                     rAxN.y * rAxN.y * this.bodyA.inverseInertia.y +
                     rAxN.z * rAxN.z * this.bodyA.inverseInertia.z;
    const angMassB = rBxN.x * rBxN.x * this.bodyB.inverseInertia.x +
                     rBxN.y * rBxN.y * this.bodyB.inverseInertia.y +
                     rBxN.z * rBxN.z * this.bodyB.inverseInertia.z;

    const effMass = invMassSum + angMassA + angMassB;
    const lambda = -(relVel + bias) / effMass * this.stiffness;

    const impulse = normal.scale(lambda);

    if (this.bodyA.bodyType === BodyType.DYNAMIC) {
      this.bodyA.linearVelocity.addSelf(impulse.scale(this.bodyA.inverseMass));
      const angImp = rA.cross(impulse);
      this.bodyA.angularVelocity.addSelf(new Vector3(
        angImp.x * this.bodyA.inverseInertia.x,
        angImp.y * this.bodyA.inverseInertia.y,
        angImp.z * this.bodyA.inverseInertia.z,
      ));
    }
    if (this.bodyB.bodyType === BodyType.DYNAMIC) {
      this.bodyB.linearVelocity.subtractSelf(impulse.scale(this.bodyB.inverseMass));
      const angImp = rB.cross(impulse);
      this.bodyB.angularVelocity.subtractSelf(new Vector3(
        angImp.x * this.bodyB.inverseInertia.x,
        angImp.y * this.bodyB.inverseInertia.y,
        angImp.z * this.bodyB.inverseInertia.z,
      ));
    }
  }
}

/**
 * Hinge constraint: allows rotation around a single axis between two bodies.
 */
export class HingeConstraint extends Constraint {
  /** Local-space pivot on body A. */
  public pivotA: Vector3;
  /** Local-space pivot on body B. */
  public pivotB: Vector3;
  /** Local-space hinge axis on body A. */
  public axisA: Vector3;

  constructor(
    bodyA: RigidBody, bodyB: RigidBody,
    pivotA: Vector3, pivotB: Vector3,
    axisA: Vector3,
  ) {
    super(bodyA, bodyB);
    this.pivotA = pivotA;
    this.pivotB = pivotB;
    this.axisA = axisA.normalize();
  }

  solve(_dt: number): void {
    // === Point constraint (keep pivots together) ===
    const worldA = this.bodyA.position.add(this.bodyA.rotation.rotateVector(this.pivotA));
    const worldB = this.bodyB.position.add(this.bodyB.rotation.rotateVector(this.pivotB));

    const diff = worldA.subtract(worldB);
    const invMassSum = this.bodyA.inverseMass + this.bodyB.inverseMass;
    if (invMassSum < EPSILON) return;

    // Simple position correction along each axis
    const correction = diff.scale(-0.2 / invMassSum);
    if (this.bodyA.bodyType === BodyType.DYNAMIC) {
      this.bodyA.position.addSelf(correction.scale(this.bodyA.inverseMass));
    }
    if (this.bodyB.bodyType === BodyType.DYNAMIC) {
      this.bodyB.position.subtractSelf(correction.scale(this.bodyB.inverseMass));
    }

    // === Angular constraint (constrain to axis) ===
    const worldAxis = this.bodyA.rotation.rotateVector(this.axisA);

    // Compute relative angular velocity perpendicular to hinge axis
    const relAngVel = this.bodyA.angularVelocity.subtract(this.bodyB.angularVelocity);
    const axisComponent = worldAxis.scale(relAngVel.dot(worldAxis));
    const perpComponent = relAngVel.subtract(axisComponent);

    // Remove perpendicular angular velocity
    const dampFactor = 0.8;
    if (this.bodyA.bodyType === BodyType.DYNAMIC) {
      this.bodyA.angularVelocity.subtractSelf(perpComponent.scale(dampFactor * 0.5));
    }
    if (this.bodyB.bodyType === BodyType.DYNAMIC) {
      this.bodyB.angularVelocity.addSelf(perpComponent.scale(dampFactor * 0.5));
    }
  }
}

/**
 * Fixed constraint: locks two bodies together (no relative movement).
 */
export class FixedConstraint extends Constraint {
  /** Relative position of B in A's local frame at creation time. */
  private relativePosition: Vector3;
  /** Relative rotation of B in A's local frame at creation time. */
  private relativeRotation: import('../math/Quaternion').Quaternion;

  constructor(bodyA: RigidBody, bodyB: RigidBody) {
    super(bodyA, bodyB);
    // Store initial relative transform
    const invRotA = bodyA.rotation.inverse();
    this.relativePosition = invRotA.rotateVector(bodyB.position.subtract(bodyA.position));
    this.relativeRotation = invRotA.multiply(bodyB.rotation);
  }

  solve(_dt: number): void {
    // Position: maintain relative offset
    const targetPos = this.bodyA.position.add(
      this.bodyA.rotation.rotateVector(this.relativePosition),
    );
    const diff = targetPos.subtract(this.bodyB.position);
    const invMassSum = this.bodyA.inverseMass + this.bodyB.inverseMass;
    if (invMassSum < EPSILON) return;

    const correction = diff.scale(0.3 / invMassSum);
    if (this.bodyA.bodyType === BodyType.DYNAMIC) {
      this.bodyA.position.subtractSelf(correction.scale(this.bodyA.inverseMass));
    }
    if (this.bodyB.bodyType === BodyType.DYNAMIC) {
      this.bodyB.position.addSelf(correction.scale(this.bodyB.inverseMass));
    }

    // Angular: lock relative rotation
    const relAngVel = this.bodyA.angularVelocity.subtract(this.bodyB.angularVelocity);
    const dampFactor = 0.8;
    if (this.bodyA.bodyType === BodyType.DYNAMIC) {
      this.bodyA.angularVelocity.subtractSelf(relAngVel.scale(dampFactor * 0.5));
    }
    if (this.bodyB.bodyType === BodyType.DYNAMIC) {
      this.bodyB.angularVelocity.addSelf(relAngVel.scale(dampFactor * 0.5));
    }
  }
}
