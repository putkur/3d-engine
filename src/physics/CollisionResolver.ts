import { Vector3 } from '../math/Vector3';
import { ContactManifold } from './ContactManifold';
import { RigidBody, BodyType } from './RigidBody';

const EPSILON = 1e-6;

/**
 * Sequential impulse solver for collision response.
 * Resolves contacts using impulse-based methods with friction.
 */
export class CollisionResolver {
  /** Baumgarte position correction factor. */
  public baumgarte = 0.2;
  /** Penetration slop — matches CONTACT_MARGIN so resting contacts have zero bias. */
  public slop = 0.01;

  /**
   * Solve all contact manifolds over multiple iterations.
   * Uses velocity-level Baumgarte bias instead of separate position correction.
   */
  solve(
    manifolds: ContactManifold[],
    bodies: RigidBody[],
    iterations: number,
    dt: number,
  ): void {
    // Warm start: apply cached impulses
    for (const manifold of manifolds) {
      this.warmStart(manifold, bodies);
    }

    for (let iter = 0; iter < iterations; iter++) {
      for (const manifold of manifolds) {
        this.solveManifold(manifold, bodies, dt);
      }
    }
  }

  private warmStart(manifold: ContactManifold, bodies: RigidBody[]): void {
    const bodyA = bodies[manifold.bodyIndexA];
    const bodyB = bodies[manifold.bodyIndexB];

    for (let i = 0; i < manifold.contacts.length; i++) {
      const contact = manifold.contacts[i];
      const cachedNormalImpulse = manifold.normalImpulses[i];
      if (Math.abs(cachedNormalImpulse) < EPSILON) continue;

      const impulse = contact.normal.scale(cachedNormalImpulse);
      this.applyImpulse(bodyA, bodyB, impulse, contact.point);
    }
  }

  private solveManifold(manifold: ContactManifold, bodies: RigidBody[], dt: number): void {
    const bodyA = bodies[manifold.bodyIndexA];
    const bodyB = bodies[manifold.bodyIndexB];

    for (let i = 0; i < manifold.contacts.length; i++) {
      const contact = manifold.contacts[i];
      const normal = contact.normal;

      // Compute relative velocity at contact point
      const rA = contact.point.subtract(bodyA.position);
      const rB = contact.point.subtract(bodyB.position);

      const velA = bodyA.linearVelocity.add(bodyA.angularVelocity.cross(rA));
      const velB = bodyB.linearVelocity.add(bodyB.angularVelocity.cross(rB));
      const relVel = velA.subtract(velB);

      const contactVel = relVel.dot(normal);

      // Compute effective mass along normal
      const rAxN = rA.cross(normal);
      const rBxN = rB.cross(normal);

      const invMassA = bodyA.inverseMass;
      const invMassB = bodyB.inverseMass;
      const invIA = bodyA.inverseInertia;
      const invIB = bodyB.inverseInertia;

      const angularMassA =
        rAxN.x * rAxN.x * invIA.x +
        rAxN.y * rAxN.y * invIA.y +
        rAxN.z * rAxN.z * invIA.z;
      const angularMassB =
        rBxN.x * rBxN.x * invIB.x +
        rBxN.y * rBxN.y * invIB.y +
        rBxN.z * rBxN.z * invIB.z;

      const effectiveMass = invMassA + invMassB + angularMassA + angularMassB;
      if (effectiveMass < EPSILON) continue;

      // Velocity-level Baumgarte bias: gently push bodies apart for penetration
      const penetrationBias = (this.baumgarte / dt) * Math.max(contact.penetrationDepth - this.slop, 0);

      // Restitution (bounce) — kill restitution at low speeds to prevent micro-bouncing
      const restitution = Math.max(bodyA.restitution, bodyB.restitution);
      const bounce = contactVel < -2.0 ? -restitution * contactVel : 0;

      // Normal impulse magnitude (includes bias for position correction)
      let jn = -(contactVel + bounce - penetrationBias) / effectiveMass;

      // Clamp accumulated impulse (must be non-negative)
      const oldImpulse = manifold.normalImpulses[i];
      manifold.normalImpulses[i] = Math.max(0, oldImpulse + jn);
      jn = manifold.normalImpulses[i] - oldImpulse;

      const normalImpulse = normal.scale(jn);
      this.applyImpulse(bodyA, bodyB, normalImpulse, contact.point);

      // --- Friction ---
      // Recompute relative velocity after normal impulse
      const newVelA = bodyA.linearVelocity.add(bodyA.angularVelocity.cross(rA));
      const newVelB = bodyB.linearVelocity.add(bodyB.angularVelocity.cross(rB));
      const newRelVel = newVelA.subtract(newVelB);

      // Tangent direction
      const tangentVel = newRelVel.subtract(normal.scale(newRelVel.dot(normal)));
      const tangentSpeed = tangentVel.length();
      if (tangentSpeed < EPSILON) continue;

      const tangent = tangentVel.scale(1 / tangentSpeed);

      // Tangent effective mass
      const rAxT = rA.cross(tangent);
      const rBxT = rB.cross(tangent);
      const angularMassAT =
        rAxT.x * rAxT.x * invIA.x +
        rAxT.y * rAxT.y * invIA.y +
        rAxT.z * rAxT.z * invIA.z;
      const angularMassBT =
        rBxT.x * rBxT.x * invIB.x +
        rBxT.y * rBxT.y * invIB.y +
        rBxT.z * rBxT.z * invIB.z;
      const tangentEffMass = invMassA + invMassB + angularMassAT + angularMassBT;
      if (tangentEffMass < EPSILON) continue;

      let jt = -tangentSpeed / tangentEffMass;

      // Coulomb friction: clamp to μ * normal impulse
      const mu = Math.sqrt(bodyA.friction * bodyB.friction); // geometric mean
      const maxFriction = mu * manifold.normalImpulses[i];

      const oldTangent = manifold.tangentImpulses[i];
      manifold.tangentImpulses[i] = Math.max(-maxFriction, Math.min(maxFriction, oldTangent + jt));
      jt = manifold.tangentImpulses[i] - oldTangent;

      const frictionImpulse = tangent.scale(jt);
      this.applyImpulse(bodyA, bodyB, frictionImpulse, contact.point);
    }
  }

  private applyImpulse(
    bodyA: RigidBody, bodyB: RigidBody,
    impulse: Vector3, contactPoint: Vector3,
  ): void {
    if (bodyA.bodyType === BodyType.DYNAMIC) {
      bodyA.linearVelocity.addSelf(impulse.scale(bodyA.inverseMass));
      const rA = contactPoint.subtract(bodyA.position);
      const angImpA = rA.cross(impulse);
      bodyA.angularVelocity.addSelf(new Vector3(
        angImpA.x * bodyA.inverseInertia.x,
        angImpA.y * bodyA.inverseInertia.y,
        angImpA.z * bodyA.inverseInertia.z,
      ));
    }

    if (bodyB.bodyType === BodyType.DYNAMIC) {
      bodyB.linearVelocity.subtractSelf(impulse.scale(bodyB.inverseMass));
      const rB = contactPoint.subtract(bodyB.position);
      const angImpB = rB.cross(impulse);
      bodyB.angularVelocity.subtractSelf(new Vector3(
        angImpB.x * bodyB.inverseInertia.x,
        angImpB.y * bodyB.inverseInertia.y,
        angImpB.z * bodyB.inverseInertia.z,
      ));
    }
  }

}
