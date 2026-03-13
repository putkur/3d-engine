// Physics simulation web worker.
// Webpack 5 bundles this as a separate chunk when referenced as:
//   new Worker(new URL('./PhysicsWorker.ts', import.meta.url))
//
// `import type` imports are erased at compile time and never included in the
// worker bundle — so this file does not transitively pull in DOM code.

import { PhysicsWorld } from './PhysicsWorld';
import { RigidBody, BodyType } from './RigidBody';
import { BoxCollider } from './BoxCollider';
import { SphereCollider } from './SphereCollider';
import { PlaneCollider } from './PlaneCollider';
import { CapsuleCollider } from './CapsuleCollider';
import { Vector3 } from '../math/Vector3';
import { Quaternion } from '../math/Quaternion';

// Type-only imports: erased at runtime, never bundled into the worker chunk.
import type {
  WorkerInMessage,
  WorkerInitMessage,
  WorkerStepMessage,
  SerializedCollider,
} from './PhysicsWorkerHost';

// Use an untyped self to avoid conflicting DOM / WebWorker lib declarations.
const workerCtx = self as unknown as {
  onmessage: (event: { data: WorkerInMessage }) => void;
  postMessage(data: unknown, transfer?: Transferable[]): void;
};

let world: PhysicsWorld | null = null;

// --- Collider deserialisation ---

function buildCollider(c: SerializedCollider) {
  switch (c.type) {
    case 'sphere': {
      const col = new SphereCollider(c.radius);
      col.offset.set(c.offset[0], c.offset[1], c.offset[2]);
      return col;
    }
    case 'box': {
      const col = new BoxCollider(new Vector3(c.halfExtents[0], c.halfExtents[1], c.halfExtents[2]));
      col.offset.set(c.offset[0], c.offset[1], c.offset[2]);
      return col;
    }
    case 'plane': {
      const col = new PlaneCollider(new Vector3(c.normal[0], c.normal[1], c.normal[2]), c.distance);
      return col;
    }
    case 'capsule': {
      const col = new CapsuleCollider(c.height, c.radius);
      col.offset.set(c.offset[0], c.offset[1], c.offset[2]);
      return col;
    }
  }
}

// --- Message handler ---

workerCtx.onmessage = (event) => {
  const msg = event.data;

  if (msg.type === 'INIT') {
    const init = msg as WorkerInitMessage;

    world = new PhysicsWorld();
    world.gravity.set(init.gravity[0], init.gravity[1], init.gravity[2]);
    world.iterations = init.iterations;

    for (const bd of init.bodies) {
      const body = new RigidBody(bd.bodyType as BodyType);
      body.position.set(bd.position[0], bd.position[1], bd.position[2]);
      body.rotation = new Quaternion(bd.rotation[0], bd.rotation[1], bd.rotation[2], bd.rotation[3]);
      body.linearVelocity.set(bd.linearVelocity[0], bd.linearVelocity[1], bd.linearVelocity[2]);
      body.angularVelocity.set(bd.angularVelocity[0], bd.angularVelocity[1], bd.angularVelocity[2]);
      body.restitution    = bd.restitution;
      body.friction       = bd.friction;
      body.linearDamping  = bd.linearDamping;
      body.angularDamping = bd.angularDamping;
      if (bd.mass > 0) body.mass = bd.mass;
      if (bd.collider) body.collider = buildCollider(bd.collider);
      body.computeInertia();
      world.addBody(body);
    }

    workerCtx.postMessage({ type: 'READY' });
    return;
  }

  if (msg.type === 'STEP' && world) {
    const step = msg as WorkerStepMessage;
    const t0 = performance.now();

    // Push kinematic / camera-driven body state in before stepping.
    for (const upd of step.kinematicUpdates) {
      const body = world.bodies[upd.index];
      if (!body) continue;
      body.position.set(upd.px, upd.py, upd.pz);
      body.rotation = new Quaternion(upd.rx, upd.ry, upd.rz, upd.rw);
      body.linearVelocity.set(upd.lvx, upd.lvy, upd.lvz);
      body.angularVelocity.set(upd.avx, upd.avy, upd.avz);
    }

    world.step(step.dt);
    const stepTime = (performance.now() - t0) / 1000;

    // Pack transforms + velocities into a transferable Float32Array: 10 floats per body.
    // Layout: [px, py, pz, rx, ry, rz, rw, lvx, lvy, lvz]
    const count = world.bodies.length;
    const buf   = new Float32Array(count * 10);
    for (let i = 0; i < count; i++) {
      const b    = world.bodies[i];
      const base = i * 10;
      buf[base]     = b.position.x;
      buf[base + 1] = b.position.y;
      buf[base + 2] = b.position.z;
      buf[base + 3] = b.rotation.x;
      buf[base + 4] = b.rotation.y;
      buf[base + 5] = b.rotation.z;
      buf[base + 6] = b.rotation.w;
      buf[base + 7] = b.linearVelocity.x;
      buf[base + 8] = b.linearVelocity.y;
      buf[base + 9] = b.linearVelocity.z;
    }

    // Transfer the buffer (zero-copy) back to the main thread.
    workerCtx.postMessage({ type: 'STEP_COMPLETE', transforms: buf, stepTime }, [buf.buffer]);
  }
};
