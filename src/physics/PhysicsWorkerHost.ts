import { RigidBody, BodyType } from './RigidBody';
import { BoxCollider } from './BoxCollider';
import { SphereCollider } from './SphereCollider';
import { PlaneCollider } from './PlaneCollider';
import { CapsuleCollider } from './CapsuleCollider';
import { ColliderType } from './Collider';
import { SceneNode } from '../scene/SceneNode';
import { Quaternion } from '../math/Quaternion';
import { Vector3 } from '../math/Vector3';

// ---------------------------------------------------------------------------
// Shared message-type definitions
// (PhysicsWorker.ts imports these as `import type` so webpack never bundles
//  PhysicsWorkerHost into the worker chunk.)
// ---------------------------------------------------------------------------

export interface SerializedSphereCollider {
  type: 'sphere';
  radius: number;
  offset: [number, number, number];
}

export interface SerializedBoxCollider {
  type: 'box';
  halfExtents: [number, number, number];
  offset: [number, number, number];
}

export interface SerializedPlaneCollider {
  type: 'plane';
  normal: [number, number, number];
  distance: number;
}

export interface SerializedCapsuleCollider {
  type: 'capsule';
  /** Distance between the two hemisphere centers (CapsuleCollider.height). */
  height: number;
  radius: number;
  offset: [number, number, number];
}

export type SerializedCollider =
  | SerializedSphereCollider
  | SerializedBoxCollider
  | SerializedPlaneCollider
  | SerializedCapsuleCollider;

export interface SerializedBody {
  bodyType: 0 | 1 | 2;
  mass: number;
  position: [number, number, number];
  rotation: [number, number, number, number]; // x, y, z, w
  linearVelocity: [number, number, number];
  angularVelocity: [number, number, number];
  restitution: number;
  friction: number;
  linearDamping: number;
  angularDamping: number;
  collider: SerializedCollider | null;
}

/** State pushed to the worker for a kinematic / camera-driven body. */
export interface KinematicUpdate {
  index: number;
  px: number; py: number; pz: number;
  rx: number; ry: number; rz: number; rw: number;
  lvx: number; lvy: number; lvz: number;
  avx: number; avy: number; avz: number;
}

export interface WorkerInitMessage {
  type: 'INIT';
  bodies: SerializedBody[];
  gravity: [number, number, number];
  iterations: number;
}

export interface WorkerStepMessage {
  type: 'STEP';
  dt: number;
  kinematicUpdates: KinematicUpdate[];
}

export type WorkerInMessage = WorkerInitMessage | WorkerStepMessage;

// ---------------------------------------------------------------------------
// Host-side attachment and response types
// ---------------------------------------------------------------------------

/** Links a main-thread RigidBody to an optional SceneNode for transform sync. */
export interface BodyAttachment {
  body: RigidBody;
  sceneNode: SceneNode | null;
}

interface WorkerReadyMessage    { type: 'READY' }
interface WorkerStepComplete    { type: 'STEP_COMPLETE'; transforms: Float32Array; stepTime: number }
type WorkerOutMessage = WorkerReadyMessage | WorkerStepComplete;

// ---------------------------------------------------------------------------
// PhysicsWorkerHost
// ---------------------------------------------------------------------------

/**
 * Main-thread controller for the physics web worker.
 *
 * The simulation runs entirely inside a dedicated Worker thread. Each physics
 * step result is returned as a transferable Float32Array containing packed
 * [px, py, pz, rx, ry, rz, rw] tuples (7 floats per body).  Results are
 * applied to main-thread RigidBody instances and their linked SceneNodes so
 * the rest of the engine can read from them as normal.
 *
 * A one-frame lag between physics and rendering is expected and acceptable —
 * this matches standard multi-threaded game engine behaviour.
 *
 * Usage:
 * 1. `const host = new PhysicsWorkerHost()`
 * 2. `await host.init(attachments, gravity, iterations)`
 * 3. Each fixedUpdate: `host.step(dt, kinematicIndexes)` (fire-and-forget)
 * 4. SceneNodes and body positions are updated asynchronously when the worker
 *    responds; call `host.terminate()` for clean shutdown.
 */
export class PhysicsWorkerHost {
  private readonly _worker: Worker;
  private _ready = false;
  private _readyResolves: Array<() => void> = [];
  private _attachments: BodyAttachment[] = [];

  /** Physics step time (seconds) from the most recently completed step. */
  public lastStepTime = 0;

  constructor() {
    // Webpack 5 automatically bundles ./PhysicsWorker.ts as a separate chunk.
    this._worker = new Worker(new URL('./PhysicsWorker.ts', import.meta.url));
    this._worker.onmessage = this._onMessage.bind(this);
  }

  /** Whether the worker has finished initialising and is ready to step. */
  get isReady(): boolean { return this._ready; }

  /**
   * Send the initial world configuration to the worker and wait for READY.
   *
   * @param attachments - Every physics body with its linked SceneNode, in the
   *   same order as they were added to PhysicsWorld (index = order in array).
   * @param gravity     - World gravity vector.
   * @param iterations  - Solver iterations.
   */
  init(attachments: BodyAttachment[], gravity: Vector3, iterations: number): Promise<void> {
    this._attachments = attachments;
    const msg: WorkerInitMessage = {
      type: 'INIT',
      bodies: attachments.map(({ body }) => this._serialize(body)),
      gravity:    [gravity.x, gravity.y, gravity.z],
      iterations,
    };
    this._worker.postMessage(msg);
    return new Promise<void>((resolve) => this._readyResolves.push(resolve));
  }

  /**
   * Fire-and-forget physics step in the worker.
   *
   * For each index in `kinematicIndexes`, the current main-thread velocity
   * and position of that body are pushed into the worker before it steps.
   * Use this for the camera body or any player-driven body.
   *
   * Results (updated positions/rotations for all bodies) are applied to
   * SceneNodes asynchronously when the worker responds.
   */
  step(dt: number, kinematicIndexes: number[] = []): void {
    const updates: KinematicUpdate[] = [];
    for (const idx of kinematicIndexes) {
      const b = this._attachments[idx]?.body;
      if (!b) continue;
      updates.push({
        index: idx,
        px: b.position.x, py: b.position.y, pz: b.position.z,
        rx: b.rotation.x, ry: b.rotation.y, rz: b.rotation.z, rw: b.rotation.w,
        lvx: b.linearVelocity.x, lvy: b.linearVelocity.y, lvz: b.linearVelocity.z,
        avx: b.angularVelocity.x, avy: b.angularVelocity.y, avz: b.angularVelocity.z,
      });
    }
    const msg: WorkerStepMessage = { type: 'STEP', dt, kinematicUpdates: updates };
    this._worker.postMessage(msg);
  }

  /** Terminate the worker process cleanly. */
  terminate(): void {
    this._worker.terminate();
  }

  // --- Private ---

  private _onMessage(event: MessageEvent<WorkerOutMessage>): void {
    const msg = event.data;
    if (msg.type === 'READY') {
      this._ready = true;
      for (const resolve of this._readyResolves) resolve();
      this._readyResolves.length = 0;
    } else if (msg.type === 'STEP_COMPLETE') {
      this.lastStepTime = msg.stepTime;
      this._applyTransforms(msg.transforms);
    }
  }

  /** Write worker results (position, rotation, linear velocity) back to main-thread bodies. */
  private _applyTransforms(buf: Float32Array): void {
    const n = this._attachments.length;
    for (let i = 0; i < n; i++) {
      const base = i * 10;
      if (base + 9 >= buf.length) break;
      const { body, sceneNode } = this._attachments[i];
      const px = buf[base],     py = buf[base + 1], pz = buf[base + 2];
      const rx = buf[base + 3], ry = buf[base + 4], rz = buf[base + 5], rw = buf[base + 6];
      const lvx = buf[base + 7], lvy = buf[base + 8], lvz = buf[base + 9];
      body.position.set(px, py, pz);
      body.rotation = new Quaternion(rx, ry, rz, rw);
      // Sync velocity so the camera controller reads the true physics velocity
      // (critical for grounded detection — without this, vel.y stays at jump speed).
      body.linearVelocity.set(lvx, lvy, lvz);
      if (sceneNode) {
        sceneNode.transform.setPosition(px, py, pz);
        sceneNode.transform.rotation = body.rotation;
      }
    }
  }

  private _serialize(body: RigidBody): SerializedBody {
    let collider: SerializedCollider | null = null;
    if (body.collider) {
      switch (body.collider.type) {
        case ColliderType.SPHERE: {
          const c = body.collider as SphereCollider;
          collider = { type: 'sphere', radius: c.radius, offset: [c.offset.x, c.offset.y, c.offset.z] };
          break;
        }
        case ColliderType.BOX: {
          const c = body.collider as BoxCollider;
          collider = {
            type: 'box',
            halfExtents: [c.halfExtents.x, c.halfExtents.y, c.halfExtents.z],
            offset: [c.offset.x, c.offset.y, c.offset.z],
          };
          break;
        }
        case ColliderType.PLANE: {
          const c = body.collider as PlaneCollider;
          collider = { type: 'plane', normal: [c.normal.x, c.normal.y, c.normal.z], distance: c.distance };
          break;
        }
        case ColliderType.CAPSULE: {
          const c = body.collider as CapsuleCollider;
          collider = {
            type: 'capsule',
            height: c.height,
            radius: c.radius,
            offset: [c.offset.x, c.offset.y, c.offset.z],
          };
          break;
        }
      }
    }

    return {
      bodyType:       body.bodyType as 0 | 1 | 2,
      mass:           body.mass,
      position:       [body.position.x, body.position.y, body.position.z],
      rotation:       [body.rotation.x, body.rotation.y, body.rotation.z, body.rotation.w],
      linearVelocity: [body.linearVelocity.x, body.linearVelocity.y, body.linearVelocity.z],
      angularVelocity:[body.angularVelocity.x, body.angularVelocity.y, body.angularVelocity.z],
      restitution:    body.restitution,
      friction:       body.friction,
      linearDamping:  body.linearDamping,
      angularDamping: body.angularDamping,
      collider,
    };
  }
}
