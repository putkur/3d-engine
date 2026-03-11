import { Vector3 } from '../math/Vector3';
import { Quaternion } from '../math/Quaternion';
import { Collider, ColliderType, AABB } from './Collider';
import { SphereCollider } from './SphereCollider';
import { BoxCollider } from './BoxCollider';
import { CapsuleCollider } from './CapsuleCollider';
import { SceneNode } from '../scene/SceneNode';

/**
 * Rigid body types.
 */
export const enum BodyType {
  /** Fully simulated by physics. */
  DYNAMIC = 0,
  /** Immovable, infinite mass. Participates in collisions but never moves. */
  STATIC = 1,
  /** User-driven. Participates in collisions but velocity is set externally. */
  KINEMATIC = 2,
}

/**
 * A rigid body in the physics simulation.
 */
export class RigidBody {
  // --- Type ---
  public bodyType: BodyType = BodyType.DYNAMIC;

  // --- Mass properties ---
  private _mass = 1;
  private _inverseMass = 1;
  /** Inertia tensor diagonal (local space, for box/sphere approximations). */
  private _inertia: Vector3 = new Vector3(1, 1, 1);
  private _inverseInertia: Vector3 = new Vector3(1, 1, 1);

  // --- State ---
  public position: Vector3 = Vector3.zero();
  public rotation: Quaternion = Quaternion.identity();
  public linearVelocity: Vector3 = Vector3.zero();
  public angularVelocity: Vector3 = Vector3.zero();

  // --- Accumulators (cleared each step) ---
  public force: Vector3 = Vector3.zero();
  public torque: Vector3 = Vector3.zero();

  // --- Material properties ---
  public restitution = 0.3;
  public friction = 0.5;
  public linearDamping = 0.01;
  public angularDamping = 0.05;

  // --- Collider ---
  public collider: Collider | null = null;

  // --- Scene link ---
  public sceneNode: SceneNode | null = null;

  // --- Sleeping (optional optimization) ---
  public isSleeping = false;
  private _sleepTimer = 0;
  private static readonly SLEEP_THRESHOLD = 0.05;
  private static readonly SLEEP_TIME = 0.5; // seconds of low velocity before sleeping

  // --- Interpolation (previous state for smooth rendering) ---
  public prevPosition: Vector3 = Vector3.zero();
  public prevRotation: Quaternion = Quaternion.identity();

  constructor(bodyType: BodyType = BodyType.DYNAMIC) {
    this.bodyType = bodyType;
    if (bodyType === BodyType.STATIC) {
      this._mass = 0;
      this._inverseMass = 0;
      this._inertia = Vector3.zero();
      this._inverseInertia = Vector3.zero();
    }
  }

  // --- Mass ---

  get mass(): number { return this._mass; }
  set mass(value: number) {
    if (this.bodyType === BodyType.STATIC) {
      this._mass = 0;
      this._inverseMass = 0;
      return;
    }
    this._mass = value;
    this._inverseMass = value > 0 ? 1 / value : 0;
  }

  get inverseMass(): number { return this._inverseMass; }

  get inertia(): Vector3 { return this._inertia; }
  get inverseInertia(): Vector3 { return this._inverseInertia; }

  /**
   * Automatically compute the inertia tensor from collider shape and mass.
   * Call after setting mass and collider.
   */
  computeInertia(): void {
    if (this.bodyType === BodyType.STATIC || this._mass <= 0) {
      this._inertia = Vector3.zero();
      this._inverseInertia = Vector3.zero();
      return;
    }

    if (!this.collider) {
      // Default: unit sphere inertia
      const I = (2 / 5) * this._mass * 0.5 * 0.5;
      this._inertia = new Vector3(I, I, I);
    } else {
      switch (this.collider.type) {
        case ColliderType.SPHERE: {
          const r = (this.collider as SphereCollider).radius;
          const I = (2 / 5) * this._mass * r * r;
          this._inertia = new Vector3(I, I, I);
          break;
        }
        case ColliderType.BOX: {
          const he = (this.collider as BoxCollider).halfExtents;
          const w2 = (2 * he.x) ** 2;
          const h2 = (2 * he.y) ** 2;
          const d2 = (2 * he.z) ** 2;
          const m12 = this._mass / 12;
          this._inertia = new Vector3(m12 * (h2 + d2), m12 * (w2 + d2), m12 * (w2 + h2));
          break;
        }
        case ColliderType.CAPSULE: {
          const capsule = this.collider as CapsuleCollider;
          const r = capsule.radius;
          const h = capsule.height;
          // Approximate as cylinder + 2 hemispheres
          const cylM = this._mass * h / (h + (4 / 3) * r);
          const hemM = (this._mass - cylM) / 2;
          const Iy = cylM * r * r / 2 + 2 * hemM * (2 / 5) * r * r;
          const Ixz = cylM * (3 * r * r + h * h) / 12 +
            2 * hemM * ((2 / 5) * r * r + (h / 2) ** 2);
          this._inertia = new Vector3(Ixz, Iy, Ixz);
          break;
        }
        default: {
          const I = (2 / 5) * this._mass * 0.5 * 0.5;
          this._inertia = new Vector3(I, I, I);
        }
      }
    }

    this._inverseInertia = new Vector3(
      this._inertia.x > 0 ? 1 / this._inertia.x : 0,
      this._inertia.y > 0 ? 1 / this._inertia.y : 0,
      this._inertia.z > 0 ? 1 / this._inertia.z : 0,
    );
  }

  // --- Forces ---

  applyForce(f: Vector3): void {
    if (this.bodyType !== BodyType.DYNAMIC) return;
    this.force.addSelf(f);
    this.wake();
  }

  applyImpulse(impulse: Vector3, contactPoint?: Vector3): void {
    if (this.bodyType !== BodyType.DYNAMIC) return;
    this.linearVelocity.addSelf(impulse.scale(this._inverseMass));
    if (contactPoint) {
      const r = contactPoint.subtract(this.position);
      const angImpulse = r.cross(impulse);
      this.angularVelocity.addSelf(new Vector3(
        angImpulse.x * this._inverseInertia.x,
        angImpulse.y * this._inverseInertia.y,
        angImpulse.z * this._inverseInertia.z,
      ));
    }
    this.wake();
  }

  applyTorque(t: Vector3): void {
    if (this.bodyType !== BodyType.DYNAMIC) return;
    this.torque.addSelf(t);
    this.wake();
  }

  // --- Integration ---

  /** Integrate velocities from forces (semi-implicit Euler, first half). */
  integrateForces(dt: number, gravity: Vector3): void {
    if (this.bodyType !== BodyType.DYNAMIC || this.isSleeping) return;

    // Linear: v += (F/m + gravity) * dt
    this.linearVelocity.addSelf(
      gravity.add(this.force.scale(this._inverseMass)).scale(dt),
    );

    // Angular: ω += (τ / I) * dt
    this.angularVelocity.addSelf(new Vector3(
      this.torque.x * this._inverseInertia.x * dt,
      this.torque.y * this._inverseInertia.y * dt,
      this.torque.z * this._inverseInertia.z * dt,
    ));

    // Damping
    this.linearVelocity.scaleSelf(1 / (1 + this.linearDamping * dt));
    this.angularVelocity.scaleSelf(1 / (1 + this.angularDamping * dt));
  }

  /** Integrate positions from velocities (second half). */
  integrateVelocities(dt: number): void {
    if (this.bodyType !== BodyType.DYNAMIC || this.isSleeping) return;

    // Position
    this.position.addSelf(this.linearVelocity.scale(dt));

    // Rotation: q += 0.5 * dt * ω * q
    const wx = this.angularVelocity.x;
    const wy = this.angularVelocity.y;
    const wz = this.angularVelocity.z;
    const q = this.rotation;
    const halfDt = 0.5 * dt;
    q.x += halfDt * (wx * q.w + wy * q.z - wz * q.y);
    q.y += halfDt * (wy * q.w + wz * q.x - wx * q.z);
    q.z += halfDt * (wz * q.w + wx * q.y - wy * q.x);
    q.w += halfDt * (-wx * q.x - wy * q.y - wz * q.z);
    q.normalizeSelf();
  }

  /** Clear force and torque accumulators. */
  clearForces(): void {
    this.force.set(0, 0, 0);
    this.torque.set(0, 0, 0);
  }

  // --- Sleeping ---

  updateSleeping(dt: number): void {
    if (this.bodyType !== BodyType.DYNAMIC) return;

    const linSpeed2 = this.linearVelocity.lengthSquared();
    const angSpeed2 = this.angularVelocity.lengthSquared();
    const threshold = RigidBody.SLEEP_THRESHOLD;

    if (linSpeed2 < threshold && angSpeed2 < threshold) {
      this._sleepTimer += dt;
      if (this._sleepTimer >= RigidBody.SLEEP_TIME) {
        this.isSleeping = true;
        this.linearVelocity.set(0, 0, 0);
        this.angularVelocity.set(0, 0, 0);
      }
    } else {
      this._sleepTimer = 0;
      this.isSleeping = false;
    }
  }

  wake(): void {
    this.isSleeping = false;
    this._sleepTimer = 0;
  }

  // --- AABB ---

  getAABB(): AABB | null {
    if (!this.collider) return null;
    return this.collider.computeAABB(this.position, this.rotation);
  }

  // --- Scene sync ---

  /** Save current state as the previous state (call before stepping). */
  savePreviousState(): void {
    this.prevPosition.copy(this.position);
    this.prevRotation.copy(this.rotation);
  }

  /** Copy physics state to the linked scene node's transform. */
  syncToSceneNode(): void {
    if (!this.sceneNode) return;
    this.sceneNode.transform.position.copy(this.position);
    this.sceneNode.transform.rotation.copy(this.rotation);
    this.sceneNode.transform.markDirty();
  }

  /** Interpolate between previous and current state for smooth rendering. */
  syncToSceneNodeInterpolated(alpha: number): void {
    if (!this.sceneNode) return;
    const pos = this.prevPosition.lerp(this.position, alpha);
    const rot = this.prevRotation.slerp(this.rotation, alpha);
    this.sceneNode.transform.position.copy(pos);
    this.sceneNode.transform.rotation.copy(rot);
    this.sceneNode.transform.markDirty();
  }

  /** Copy the scene node's transform into physics state. */
  syncFromSceneNode(): void {
    if (!this.sceneNode) return;
    this.position.copy(this.sceneNode.transform.position);
    this.rotation.copy(this.sceneNode.transform.rotation);
  }
}
