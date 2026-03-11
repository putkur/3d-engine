import { Vector3 } from '../math/Vector3';
import { RigidBody, BodyType } from './RigidBody';
import { BroadPhase } from './BroadPhase';
import { NarrowPhase } from './NarrowPhase';
import { CollisionResolver } from './CollisionResolver';
import { ContactManifold } from './ContactManifold';
import { Constraint } from './Constraints';

/**
 * The physics simulation world.
 * Manages rigid bodies, constraints, and runs the simulation pipeline each step.
 */
export class PhysicsWorld {
  /** Gravity acceleration (default: Earth-like). */
  public gravity: Vector3 = new Vector3(0, -9.81, 0);
  /** Number of solver iterations per step (higher = more stable stacking). */
  public iterations = 10;

  /** All rigid bodies in the world. */
  public readonly bodies: RigidBody[] = [];
  /** All constraints. */
  public readonly constraints: Constraint[] = [];

  // Subsystems
  private readonly broadPhase = new BroadPhase();
  private readonly narrowPhase = new NarrowPhase();
  private readonly resolver = new CollisionResolver();

  /** Contact manifolds from the previous step (for warm starting). */
  private manifolds: ContactManifold[] = [];

  // --- Body management ---

  addBody(body: RigidBody): void {
    this.bodies.push(body);
  }

  removeBody(body: RigidBody): void {
    const idx = this.bodies.indexOf(body);
    if (idx !== -1) this.bodies.splice(idx, 1);
  }

  addConstraint(constraint: Constraint): void {
    this.constraints.push(constraint);
  }

  removeConstraint(constraint: Constraint): void {
    const idx = this.constraints.indexOf(constraint);
    if (idx !== -1) this.constraints.splice(idx, 1);
  }

  /**
   * Step the physics simulation forward by dt seconds.
   *
   * Pipeline:
   * 1. Apply forces (gravity, user forces)
   * 2. Integrate velocities (semi-implicit Euler)
   * 3. Broadphase: generate candidate pairs
   * 4. Narrowphase: exact collision detection → contact manifolds
   * 5. Solve constraints and contacts (sequential impulse solver)
   * 6. Integrate positions
   * 7. Sync transforms back to scene nodes
   */
  step(dt: number): void {
    const bodies = this.bodies;

    // 0. Save previous state for interpolation
    for (let i = 0; i < bodies.length; i++) {
      bodies[i].savePreviousState();
    }

    // 1 & 2. Integrate forces → velocities
    for (let i = 0; i < bodies.length; i++) {
      bodies[i].integrateForces(dt, this.gravity);
    }

    // 3. Broad phase
    const pairs = this.broadPhase.computePairs(bodies);

    // 4. Narrow phase
    const oldManifolds = this.manifolds;
    const newManifolds: ContactManifold[] = [];

    for (const pair of pairs) {
      const manifold = this.narrowPhase.test(
        bodies[pair.indexA], bodies[pair.indexB],
        pair.indexA, pair.indexB,
      );
      if (manifold) {
        // Check if this is a new or persistent contact
        const isNew = !this.findOldManifold(manifold, oldManifolds);
        this.warmStartTransfer(manifold, oldManifolds);
        newManifolds.push(manifold);
        // Only wake bodies for NEW contacts or significant penetration
        if (isNew || manifold.contacts.some(c => c.penetrationDepth > 0.02)) {
          bodies[pair.indexA].wake();
          bodies[pair.indexB].wake();
        }
      }
    }
    this.manifolds = newManifolds;

    // 5. Solve contacts and constraints
    this.resolver.solve(newManifolds, bodies, this.iterations, dt);

    for (let iter = 0; iter < this.iterations; iter++) {
      for (const constraint of this.constraints) {
        constraint.solve(dt);
      }
    }

    // 6. Integrate positions
    for (let i = 0; i < bodies.length; i++) {
      bodies[i].integrateVelocities(dt);
      bodies[i].clearForces();
      bodies[i].updateSleeping(dt);
    }
  }

  /** Sync all bodies to scene nodes using interpolation for smooth rendering. */
  syncToScene(alpha: number = 1): void {
    for (let i = 0; i < this.bodies.length; i++) {
      if (alpha < 1) {
        this.bodies[i].syncToSceneNodeInterpolated(alpha);
      } else {
        this.bodies[i].syncToSceneNode();
      }
    }
  }

  /**
   * Transfer cached impulses from old manifolds to new ones for warm starting.
   * Matches manifolds by body index pair.
   */
  private warmStartTransfer(
    newManifold: ContactManifold,
    oldManifolds: ContactManifold[],
  ): void {
    const old = this.findOldManifold(newManifold, oldManifolds);
    if (!old) return;
    const len = Math.min(old.normalImpulses.length, newManifold.contacts.length);
    for (let i = 0; i < len; i++) {
      newManifold.normalImpulses[i] = old.normalImpulses[i] || 0;
      // Don't transfer tangent impulses — warmStart only applies normal impulses
      // to bodies, so tangent accumulator must start at 0 to match reality.
    }
  }

  private findOldManifold(
    newManifold: ContactManifold,
    oldManifolds: ContactManifold[],
  ): ContactManifold | null {
    for (const old of oldManifolds) {
      if (
        (old.bodyIndexA === newManifold.bodyIndexA && old.bodyIndexB === newManifold.bodyIndexB) ||
        (old.bodyIndexA === newManifold.bodyIndexB && old.bodyIndexB === newManifold.bodyIndexA)
      ) {
        return old;
      }
    }
    return null;
  }
}
