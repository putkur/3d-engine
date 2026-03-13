import { Camera } from './Camera';
import { Vector3 } from '../math/Vector3';
import { Quaternion } from '../math/Quaternion';
import { clamp, degToRad } from '../math/MathUtils';
import { InputManager } from '../input/InputManager';
import { RigidBody } from '../physics/RigidBody';

export enum CameraMode {
  ORBIT = 'orbit',
  FLY = 'fly',
  FIRST_PERSON = 'firstPerson',
}

export interface CameraControllerOptions {
  mode?: CameraMode;
  /** Orbit target point (orbit mode). */
  target?: Vector3;
  /** Distance from target (orbit mode). */
  distance?: number;
  /** Min/max distance for zoom (orbit mode). */
  minDistance?: number;
  maxDistance?: number;
  /** Movement speed in units/sec (fly/first-person). */
  moveSpeed?: number;
  /** Look sensitivity in degrees per pixel of mouse movement. */
  lookSensitivity?: number;
  /** Zoom sensitivity (orbit mode). */
  zoomSensitivity?: number;
  /** Pan sensitivity (orbit mode). */
  panSensitivity?: number;
  /** Smooth damping factor (0 = no smoothing, 1 = infinite). */
  damping?: number;
  /** Min/max pitch in degrees. */
  minPitch?: number;
  maxPitch?: number;
  /** Optional rigid body for physics-driven first-person movement. */
  rigidBody?: RigidBody;
  /** Jump impulse speed (units/s). Only used when rigidBody is set. */
  jumpSpeed?: number;
}

/**
 * Interactive camera controller supporting orbit, fly, and first-person modes.
 * Reads input from an InputManager instance (keyboard + mouse + gamepad).
 * Attach to a Camera and call `update(dt)` each frame after `inputManager.poll()`.
 */
export class CameraController {
  public camera: Camera;
  public mode: CameraMode;

  // Orbit state
  private _target = Vector3.zero();
  private _distance: number;
  private _minDistance: number;
  private _maxDistance: number;

  // Spherical coords (orbit) / Euler angles (fly/FP)
  private _yaw = 0;    // degrees
  private _pitch = 0;   // degrees (positive = above target)
  private _minPitch: number;
  private _maxPitch: number;

  // Smoothed values
  private _currentYaw = 0;
  private _currentPitch = 0;
  private _currentDistance: number;
  private _currentTarget = Vector3.zero();

  // Movement (fly / first-person)
  private _moveSpeed: number;
  private _lookSensitivity: number;
  private _zoomSensitivity: number;
  private _panSensitivity: number;
  private _damping: number;

  // Input
  private _input: InputManager;

  // Physics body (optional)
  private _rigidBody: RigidBody | null = null;
  private _jumpSpeed: number;

  constructor(camera: Camera, input: InputManager, options?: CameraControllerOptions) {
    this.camera = camera;
    this._input = input;

    const opts = options ?? {};
    this.mode = opts.mode ?? CameraMode.ORBIT;
    this._target = opts.target?.clone() ?? Vector3.zero();
    this._distance = opts.distance ?? 5;
    this._minDistance = opts.minDistance ?? 0.5;
    this._maxDistance = opts.maxDistance ?? 100;
    this._moveSpeed = opts.moveSpeed ?? 5;
    this._lookSensitivity = opts.lookSensitivity ?? 0.3;
    this._zoomSensitivity = opts.zoomSensitivity ?? 0.5;
    this._panSensitivity = opts.panSensitivity ?? 0.005;
    this._damping = opts.damping ?? 0.1;
    this._minPitch = opts.minPitch ?? -89;
    this._maxPitch = opts.maxPitch ?? 89;
    this._rigidBody = opts.rigidBody ?? null;
    this._jumpSpeed = opts.jumpSpeed ?? 5;

    // Sync smoothed values
    this._currentDistance = this._distance;
    this._currentTarget.copy(this._target);
    this._currentYaw = this._yaw;
    this._currentPitch = this._pitch;
  }

  // ---------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------

  get target(): Vector3 { return this._target; }
  set target(v: Vector3) { this._target.copy(v); }

  get distance(): number { return this._distance; }
  set distance(v: number) { this._distance = clamp(v, this._minDistance, this._maxDistance); }

  get yaw(): number { return this._yaw; }
  set yaw(v: number) { this._yaw = v; }

  get pitch(): number { return this._pitch; }
  set pitch(v: number) { this._pitch = clamp(v, this._minPitch, this._maxPitch); }

  get moveSpeed(): number { return this._moveSpeed; }
  set moveSpeed(v: number) { this._moveSpeed = v; }

  get lookSensitivity(): number { return this._lookSensitivity; }
  set lookSensitivity(v: number) { this._lookSensitivity = v; }

  get rigidBody(): RigidBody | null { return this._rigidBody; }
  set rigidBody(rb: RigidBody | null) { this._rigidBody = rb; }

  /**
   * Call every frame with deltaTime to update camera position/rotation.
   * Must be called after `inputManager.poll()`.
   */
  update(dt: number): void {
    switch (this.mode) {
      case CameraMode.ORBIT:
        this.updateOrbit(dt);
        break;
      case CameraMode.FLY:
        this.updateFly(dt);
        break;
      case CameraMode.FIRST_PERSON:
        this.updateFirstPerson(dt);
        break;
    }
  }

  /** Request pointer lock for fly/first-person modes. */
  requestPointerLock(): void {
    this._input.mouse.requestPointerLock();
  }

  /** Exit pointer lock. */
  exitPointerLock(): void {
    this._input.mouse.exitPointerLock();
  }

  dispose(): void {
    // No-op — input lifecycle is owned by InputManager
  }

  // ---------------------------------------------------------------
  // Orbit mode
  // ---------------------------------------------------------------

  private updateOrbit(dt: number): void {
    const mouse = this._input.mouse;

    // Left-click drag → rotate
    if (mouse.isDown(0)) {
      this._yaw -= mouse.deltaX * this._lookSensitivity;
      this._pitch -= mouse.deltaY * this._lookSensitivity;
      this._pitch = clamp(this._pitch, this._minPitch, this._maxPitch);
    }

    // Middle-click drag → pan
    if (mouse.isDown(1)) {
      const right = this.camera.transform.getRight();
      const up = this.camera.transform.getUp();

      const panX = -mouse.deltaX * this._panSensitivity * this._distance;
      const panY = mouse.deltaY * this._panSensitivity * this._distance;

      this._target.addSelf(right.scale(panX));
      this._target.addSelf(up.scale(panY));
    }

    // Scroll → zoom
    if (mouse.scrollY !== 0) {
      this._distance -= mouse.scrollY * this._zoomSensitivity;
      this._distance = clamp(this._distance, this._minDistance, this._maxDistance);
    }

    // Smooth interpolation
    const t = 1 - Math.pow(this._damping, dt);
    this._currentYaw = lerpAngle(this._currentYaw, this._yaw, t);
    this._currentPitch = lerpAngle(this._currentPitch, this._pitch, t);
    this._currentDistance = lerp(this._currentDistance, this._distance, t);
    lerpVector(this._currentTarget, this._target, t);

    // Spherical to Cartesian
    const pitchRad = degToRad(this._currentPitch);
    const yawRad = degToRad(this._currentYaw);

    const cosPitch = Math.cos(pitchRad);
    const x = this._currentTarget.x + this._currentDistance * cosPitch * Math.sin(yawRad);
    const y = this._currentTarget.y + this._currentDistance * Math.sin(pitchRad);
    const z = this._currentTarget.z + this._currentDistance * cosPitch * Math.cos(yawRad);

    this.camera.transform.setPosition(x, y, z);

    // Look at target
    this.lookAt(this._currentTarget);
  }

  // ---------------------------------------------------------------
  // Fly mode
  // ---------------------------------------------------------------

  private updateFly(dt: number): void {
    const mouse = this._input.mouse;
    const kb = this._input.keyboard;

    // Mouse look (any button or pointer locked)
    if (mouse.isDown(0) || mouse.locked) {
      this._yaw -= mouse.deltaX * this._lookSensitivity;
      this._pitch -= mouse.deltaY * this._lookSensitivity;
      this._pitch = clamp(this._pitch, this._minPitch, this._maxPitch);
    }

    // Movement
    const speed = this._moveSpeed * (kb.isDown('ShiftLeft') || kb.isDown('ShiftRight') ? 3 : 1) * dt;
    const forward = this.camera.transform.getForward().normalizeSelf();
    const right = this.camera.transform.getRight().normalizeSelf();
    const worldUp = Vector3.up();

    const move = Vector3.zero();

    if (kb.isDown('KeyW') || kb.isDown('ArrowUp')) move.addSelf(forward.scale(speed));
    if (kb.isDown('KeyS') || kb.isDown('ArrowDown')) move.addSelf(forward.scale(-speed));
    if (kb.isDown('KeyA') || kb.isDown('ArrowLeft')) move.addSelf(right.scale(-speed));
    if (kb.isDown('KeyD') || kb.isDown('ArrowRight')) move.addSelf(right.scale(speed));
    if (kb.isDown('KeyE') || kb.isDown('Space')) move.addSelf(worldUp.scale(speed));
    if (kb.isDown('KeyQ') || kb.isDown('ControlLeft')) move.addSelf(worldUp.scale(-speed));

    const pos = this.camera.transform.position;
    pos.addSelf(move);
    this.camera.transform.markDirty();

    this.applyEulerRotation();
  }

  // ---------------------------------------------------------------
  // First-person mode
  // ---------------------------------------------------------------

  private updateFirstPerson(dt: number): void {
    const mouse = this._input.mouse;
    const kb = this._input.keyboard;

    // Mouse look (pointer lock expected)
    if (mouse.locked) {
      this._yaw -= mouse.deltaX * this._lookSensitivity;
      this._pitch -= mouse.deltaY * this._lookSensitivity;
      this._pitch = clamp(this._pitch, this._minPitch, this._maxPitch);
    }

    // Direction vectors on XZ plane
    const yawRad = degToRad(this._yaw);
    const forwardXZ = new Vector3(-Math.sin(yawRad), 0, -Math.cos(yawRad));
    const rightXZ = new Vector3(Math.cos(yawRad), 0, -Math.sin(yawRad));

    if (this._rigidBody) {
      // Physics-driven movement: set horizontal velocity, preserve vertical
      const speed = this._moveSpeed * (kb.isDown('ShiftLeft') || kb.isDown('ShiftRight') ? 3 : 1);
      const wish = Vector3.zero();

      if (kb.isDown('KeyW') || kb.isDown('ArrowUp')) wish.addSelf(forwardXZ);
      if (kb.isDown('KeyS') || kb.isDown('ArrowDown')) wish.addSelf(forwardXZ.scale(-1));
      if (kb.isDown('KeyA') || kb.isDown('ArrowLeft')) wish.addSelf(rightXZ.scale(-1));
      if (kb.isDown('KeyD') || kb.isDown('ArrowRight')) wish.addSelf(rightXZ);

      if (wish.lengthSquared() > 1e-6) wish.normalizeSelf();

      const vel = this._rigidBody.linearVelocity;
      vel.x = wish.x * speed;
      vel.z = wish.z * speed;

      // Jump (only when approximately grounded — vertical velocity near zero)
      if (kb.isDown('Space') && Math.abs(vel.y) < 0.5) {
        vel.y = this._jumpSpeed;
      }

      // Sync camera position from body (physics owns position)
      const bp = this._rigidBody.position;
      this.camera.transform.setPosition(bp.x, bp.y, bp.z);
    } else {
      // Non-physics: direct transform movement
      const speed = this._moveSpeed * (kb.isDown('ShiftLeft') || kb.isDown('ShiftRight') ? 3 : 1) * dt;
      const worldUp = Vector3.up();
      const move = Vector3.zero();

      if (kb.isDown('KeyW') || kb.isDown('ArrowUp')) move.addSelf(forwardXZ.scale(speed));
      if (kb.isDown('KeyS') || kb.isDown('ArrowDown')) move.addSelf(forwardXZ.scale(-speed));
      if (kb.isDown('KeyA') || kb.isDown('ArrowLeft')) move.addSelf(rightXZ.scale(-speed));
      if (kb.isDown('KeyD') || kb.isDown('ArrowRight')) move.addSelf(rightXZ.scale(speed));
      if (kb.isDown('Space')) move.addSelf(worldUp.scale(speed));
      if (kb.isDown('ControlLeft')) move.addSelf(worldUp.scale(-speed));

      const pos = this.camera.transform.position;
      pos.addSelf(move);
      this.camera.transform.markDirty();
    }

    this.applyEulerRotation();
  }

  // ---------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------

  /**
   * Point the camera at a world-space position using the transform.
   */
  private lookAt(target: Vector3): void {
    const pos = this.camera.transform.position;
    const dir = target.subtract(pos);
    if (dir.lengthSquared() < 1e-8) return;

    this.camera.transform.rotation = Quaternion.lookRotation(dir.normalize());
  }

  /**
   * Apply yaw/pitch euler angles directly to the camera transform quaternion.
   */
  private applyEulerRotation(): void {
    this.camera.transform.rotation = Quaternion.fromEuler(this._pitch, this._yaw, 0);
  }

}

// ---------------------------------------------------------------
// Utility functions (module-private)
// ---------------------------------------------------------------

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpAngle(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpVector(out: Vector3, target: Vector3, t: number): void {
  out.x = out.x + (target.x - out.x) * t;
  out.y = out.y + (target.y - out.y) * t;
  out.z = out.z + (target.z - out.z) * t;
}
