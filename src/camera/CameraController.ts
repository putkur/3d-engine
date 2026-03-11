import { Camera } from './Camera';
import { Vector3 } from '../math/Vector3';
import { Quaternion } from '../math/Quaternion';
import { clamp, degToRad } from '../math/MathUtils';

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
}

/**
 * Interactive camera controller supporting orbit, fly, and first-person modes.
 * Attach to a Camera and call `update(dt)` each frame.
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
  private _pitch = 20;  // degrees (positive = above target)
  private _minPitch: number;
  private _maxPitch: number;

  // Smoothed values
  private _currentYaw = 0;
  private _currentPitch = 20;
  private _currentDistance: number;
  private _currentTarget = Vector3.zero();

  // Movement (fly / first-person)
  private _moveSpeed: number;
  private _lookSensitivity: number;
  private _zoomSensitivity: number;
  private _panSensitivity: number;
  private _damping: number;

  // Input state
  private _keys = new Set<string>();
  private _mouseDown = new Set<number>();
  private _mouseDeltaX = 0;
  private _mouseDeltaY = 0;
  private _scrollDelta = 0;
  private _pointerLocked = false;

  private _canvas: HTMLCanvasElement;
  private _disposed = false;

  constructor(camera: Camera, canvas: HTMLCanvasElement, options?: CameraControllerOptions) {
    this.camera = camera;
    this._canvas = canvas;

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

    // Sync smoothed values
    this._currentDistance = this._distance;
    this._currentTarget.copy(this._target);
    this._currentYaw = this._yaw;
    this._currentPitch = this._pitch;

    this.bindEvents();
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

  /**
   * Call every frame with deltaTime to update camera position/rotation.
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

    // Reset per-frame deltas
    this._mouseDeltaX = 0;
    this._mouseDeltaY = 0;
    this._scrollDelta = 0;
  }

  /** Request pointer lock for fly/first-person modes. */
  requestPointerLock(): void {
    this._canvas.requestPointerLock();
  }

  /** Exit pointer lock. */
  exitPointerLock(): void {
    document.exitPointerLock();
  }

  dispose(): void {
    this._disposed = true;
    this.unbindEvents();
  }

  // ---------------------------------------------------------------
  // Orbit mode
  // ---------------------------------------------------------------

  private updateOrbit(dt: number): void {
    // Left-click drag → rotate
    if (this._mouseDown.has(0)) {
      this._yaw -= this._mouseDeltaX * this._lookSensitivity;
      this._pitch += this._mouseDeltaY * this._lookSensitivity;
      this._pitch = clamp(this._pitch, this._minPitch, this._maxPitch);
    }

    // Middle-click drag → pan
    if (this._mouseDown.has(1)) {
      const right = this.camera.transform.getRight();
      const up = this.camera.transform.getUp();

      const panX = -this._mouseDeltaX * this._panSensitivity * this._distance;
      const panY = this._mouseDeltaY * this._panSensitivity * this._distance;

      this._target.addSelf(right.scale(panX));
      this._target.addSelf(up.scale(panY));
    }

    // Scroll → zoom
    if (this._scrollDelta !== 0) {
      this._distance -= this._scrollDelta * this._zoomSensitivity;
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
    // Mouse look (any button or pointer locked)
    if (this._mouseDown.has(0) || this._pointerLocked) {
      this._yaw -= this._mouseDeltaX * this._lookSensitivity;
      this._pitch += this._mouseDeltaY * this._lookSensitivity;
      this._pitch = clamp(this._pitch, this._minPitch, this._maxPitch);
    }

    // Movement
    const speed = this._moveSpeed * (this._keys.has('ShiftLeft') || this._keys.has('ShiftRight') ? 3 : 1) * dt;
    const forward = this.camera.transform.getForward().normalizeSelf();
    const right = this.camera.transform.getRight().normalizeSelf();
    const worldUp = Vector3.up();

    const move = Vector3.zero();

    if (this._keys.has('KeyW') || this._keys.has('ArrowUp')) move.addSelf(forward.scale(speed));
    if (this._keys.has('KeyS') || this._keys.has('ArrowDown')) move.addSelf(forward.scale(-speed));
    if (this._keys.has('KeyA') || this._keys.has('ArrowLeft')) move.addSelf(right.scale(-speed));
    if (this._keys.has('KeyD') || this._keys.has('ArrowRight')) move.addSelf(right.scale(speed));
    if (this._keys.has('KeyE') || this._keys.has('Space')) move.addSelf(worldUp.scale(speed));
    if (this._keys.has('KeyQ') || this._keys.has('ControlLeft')) move.addSelf(worldUp.scale(-speed));

    const pos = this.camera.transform.position;
    pos.addSelf(move);
    this.camera.transform.markDirty();

    // Smooth rotation
    const t = 1 - Math.pow(this._damping, dt);
    this._currentYaw = lerpAngle(this._currentYaw, this._yaw, t);
    this._currentPitch = lerpAngle(this._currentPitch, this._pitch, t);

    this.applyEulerRotation();
  }

  // ---------------------------------------------------------------
  // First-person mode
  // ---------------------------------------------------------------

  private updateFirstPerson(dt: number): void {
    // Mouse look (pointer lock expected)
    if (this._pointerLocked) {
      this._yaw -= this._mouseDeltaX * this._lookSensitivity;
      this._pitch += this._mouseDeltaY * this._lookSensitivity;
      this._pitch = clamp(this._pitch, this._minPitch, this._maxPitch);
    }

    // Ground-locked movement (move on XZ plane, ignore camera pitch for movement)
    const speed = this._moveSpeed * (this._keys.has('ShiftLeft') || this._keys.has('ShiftRight') ? 3 : 1) * dt;
    const yawRad = degToRad(this._yaw);
    const forwardXZ = new Vector3(-Math.sin(yawRad), 0, -Math.cos(yawRad));
    const rightXZ = new Vector3(Math.cos(yawRad), 0, -Math.sin(yawRad));
    const worldUp = Vector3.up();

    const move = Vector3.zero();

    if (this._keys.has('KeyW') || this._keys.has('ArrowUp')) move.addSelf(forwardXZ.scale(speed));
    if (this._keys.has('KeyS') || this._keys.has('ArrowDown')) move.addSelf(forwardXZ.scale(-speed));
    if (this._keys.has('KeyA') || this._keys.has('ArrowLeft')) move.addSelf(rightXZ.scale(-speed));
    if (this._keys.has('KeyD') || this._keys.has('ArrowRight')) move.addSelf(rightXZ.scale(speed));
    if (this._keys.has('Space')) move.addSelf(worldUp.scale(speed));
    if (this._keys.has('ControlLeft')) move.addSelf(worldUp.scale(-speed));

    const pos = this.camera.transform.position;
    pos.addSelf(move);
    this.camera.transform.markDirty();

    // Smooth rotation
    const t = 1 - Math.pow(this._damping, dt);
    this._currentYaw = lerpAngle(this._currentYaw, this._yaw, t);
    this._currentPitch = lerpAngle(this._currentPitch, this._pitch, t);

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
    this.camera.transform.rotation = Quaternion.fromEuler(this._currentPitch, this._currentYaw, 0);
  }

  // ---------------------------------------------------------------
  // Event binding
  // ---------------------------------------------------------------

  // Store bound handlers for removal
  private _onKeyDown = (e: KeyboardEvent): void => {
    if (this._disposed) return;
    this._keys.add(e.code);
  };

  private _onKeyUp = (e: KeyboardEvent): void => {
    if (this._disposed) return;
    this._keys.delete(e.code);
  };

  private _onMouseDown = (e: MouseEvent): void => {
    if (this._disposed) return;
    this._mouseDown.add(e.button);
  };

  private _onMouseUp = (e: MouseEvent): void => {
    if (this._disposed) return;
    this._mouseDown.delete(e.button);
  };

  private _onMouseMove = (e: MouseEvent): void => {
    if (this._disposed) return;
    this._mouseDeltaX += e.movementX;
    this._mouseDeltaY += e.movementY;
  };

  private _onWheel = (e: WheelEvent): void => {
    if (this._disposed) return;
    e.preventDefault();
    this._scrollDelta += e.deltaY > 0 ? -1 : e.deltaY < 0 ? 1 : 0;
  };

  private _onPointerLockChange = (): void => {
    this._pointerLocked = document.pointerLockElement === this._canvas;
  };

  private _onContextMenu = (e: Event): void => {
    e.preventDefault();
  };

  private bindEvents(): void {
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    this._canvas.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('mousemove', this._onMouseMove);
    this._canvas.addEventListener('wheel', this._onWheel, { passive: false });
    document.addEventListener('pointerlockchange', this._onPointerLockChange);
    this._canvas.addEventListener('contextmenu', this._onContextMenu);
  }

  private unbindEvents(): void {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    this._canvas.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);
    window.removeEventListener('mousemove', this._onMouseMove);
    this._canvas.removeEventListener('wheel', this._onWheel);
    document.removeEventListener('pointerlockchange', this._onPointerLockChange);
    this._canvas.removeEventListener('contextmenu', this._onContextMenu);
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
