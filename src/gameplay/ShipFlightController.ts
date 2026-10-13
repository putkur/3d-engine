import { InputManager } from '../input/InputManager';
import { clamp } from '../math/MathUtils';
import { Quaternion } from '../math/Quaternion';
import { Vector3 } from '../math/Vector3';
import { RigidBody } from '../physics/RigidBody';

export interface ShipFlightControllerOptions {
  lookSensitivity?: number;
  maxForwardSpeed?: number;
  maxReverseSpeed?: number;
  boostMultiplier?: number;
  acceleration?: number;
  brakeDamping?: number;
  lateralDamping?: number;
  strafeResponse?: number;
  strafeDriftDamping?: number;
  throttleChangeRate?: number;
  throttleSmoothing?: number;
  angularResponse?: number;
  maxPitchRate?: number;
  maxYawRate?: number;
  maxRollRate?: number;
}

export interface ShipHudState {
  speed: number;
  throttle: number;
  throttleTarget: number;
  boostActive: boolean;
  flightAssist: boolean;
  pitchDeg: number;
  rollDeg: number;
  yawDeg: number;
  pitchRate: number;
  yawRate: number;
  rollRate: number;
}

const DEFAULTS: Required<ShipFlightControllerOptions> = {
  lookSensitivity: 0.08,
  maxForwardSpeed: 72,
  maxReverseSpeed: 20,
  boostMultiplier: 1.45,
  acceleration: 30,
  brakeDamping: 2.8,
  lateralDamping: 3.8,
  strafeResponse: 7.2,
  strafeDriftDamping: 1.35,
  throttleChangeRate: 0.85,
  throttleSmoothing: 3.2,
  angularResponse: 8.5,
  maxPitchRate: 85,
  maxYawRate: 90,
  maxRollRate: 120,
};

export class ShipFlightController {
  private readonly input: InputManager;
  private readonly body: RigidBody;
  private readonly opts: Required<ShipFlightControllerOptions>;

  private orientation: Quaternion;

  private throttleTarget = 0;
  private throttle = 0;
  private boostActive = false;
  private flightAssist = true;

  private pitchRate = 0;
  private yawRate = 0;
  private rollRate = 0;

  constructor(input: InputManager, body: RigidBody, options?: ShipFlightControllerOptions) {
    this.input = input;
    this.body = body;
    this.opts = { ...DEFAULTS, ...(options ?? {}) };
    this.orientation = body.rotation.clone();
  }

  get lookSensitivity(): number {
    return this.opts.lookSensitivity;
  }

  set lookSensitivity(value: number) {
    this.opts.lookSensitivity = clamp(value, 0.01, 0.5);
  }

  requestPointerLock(): void {
    this.input.mouse.requestPointerLock();
  }

  update(dt: number): void {
    const kb = this.input.keyboard;
    const mouse = this.input.mouse;

    if (kb.wasPressed('KeyT')) {
      this.flightAssist = !this.flightAssist;
    }

    // Mouse controls are active while pointer-locked, with keyboard fallback.
    const mouseYaw = mouse.locked ? clamp(-mouse.deltaX * this.opts.lookSensitivity, -3, 3) : 0;
    const mousePitch = mouse.locked ? clamp(-mouse.deltaY * this.opts.lookSensitivity, -3, 3) : 0;

    const keyYaw = (kb.isDown('ArrowLeft') ? 1 : 0) - (kb.isDown('ArrowRight') ? 1 : 0);
    const keyPitch = (kb.isDown('ArrowUp') ? 1 : 0) - (kb.isDown('ArrowDown') ? 1 : 0);
    const keyRoll = (kb.isDown('KeyE') ? 1 : 0) - (kb.isDown('KeyQ') ? 1 : 0);
    const strafeInput = (kb.isDown('KeyD') ? 1 : 0) - (kb.isDown('KeyA') ? 1 : 0);

    const yawInput = clamp(mouseYaw + keyYaw * 0.85, -3, 3);
    const pitchInput = clamp(mousePitch + keyPitch * 0.85, -3, 3);
    const rollInput = clamp(keyRoll, -1, 1);

    this.pitchRate = dampedTo(this.pitchRate, pitchInput * this.opts.maxPitchRate, this.opts.angularResponse, dt);
    this.yawRate = dampedTo(this.yawRate, yawInput * this.opts.maxYawRate, this.opts.angularResponse, dt);
    this.rollRate = dampedTo(this.rollRate, rollInput * this.opts.maxRollRate, this.opts.angularResponse, dt);

    const qDelta = Quaternion.fromEuler(this.pitchRate * dt, this.yawRate * dt, this.rollRate * dt);
    this.orientation = this.orientation.multiply(qDelta).normalize();
    this.body.rotation.copy(this.orientation);

    if (kb.isDown('KeyW')) this.throttleTarget += this.opts.throttleChangeRate * dt;
    if (kb.isDown('KeyS')) this.throttleTarget -= this.opts.throttleChangeRate * dt;
    if (kb.wasPressed('KeyX')) this.throttleTarget = 0;

    this.throttleTarget = clamp(this.throttleTarget, -0.35, 1.0);
    this.throttle = dampedTo(this.throttle, this.throttleTarget, this.opts.throttleSmoothing, dt);

    this.boostActive = (kb.isDown('ShiftLeft') || kb.isDown('ShiftRight')) && this.throttle > 0.05;
    const brakeHeld = kb.isDown('ControlLeft') || kb.isDown('ControlRight');

    const forward = this.orientation.rotateVector(Vector3.forward()).normalizeSelf();
    const right = this.orientation.rotateVector(Vector3.right()).normalizeSelf();
    const maxStrafeSpeed = this.opts.maxForwardSpeed * 0.33;
    const strafeSpeedTarget = strafeInput * maxStrafeSpeed;
    const forwardSpeedTargetBase =
      this.throttle >= 0
        ? this.throttle * this.opts.maxForwardSpeed
        : this.throttle * this.opts.maxReverseSpeed;
    const forwardSpeedTarget = this.boostActive
      ? forwardSpeedTargetBase * this.opts.boostMultiplier
      : forwardSpeedTargetBase;

    if (this.flightAssist) {
      const currentForwardSpeed = this.body.linearVelocity.dot(forward);
      const correctedForwardSpeed = dampedTo(
        currentForwardSpeed,
        forwardSpeedTarget,
        this.opts.acceleration,
        dt,
      );

      const currentStrafeSpeed = this.body.linearVelocity.dot(right);
      const correctedStrafeSpeed = dampedTo(
        currentStrafeSpeed,
        strafeSpeedTarget,
        this.opts.strafeResponse,
        dt,
      );

      const forwardVelocity = forward.scale(correctedForwardSpeed);
      const strafeVelocity = right.scale(correctedStrafeSpeed);
      const lateralVelocity = this.body.linearVelocity
        .subtract(forward.scale(currentForwardSpeed))
        .subtract(right.scale(currentStrafeSpeed));
      const lateralDecay = Math.max(0, 1 - this.opts.strafeDriftDamping * dt);
      lateralVelocity.scaleSelf(lateralDecay);

      this.body.linearVelocity.copy(forwardVelocity.add(strafeVelocity).add(lateralVelocity));
    } else {
      this.body.linearVelocity.addSelf(forward.scale(forwardSpeedTarget * 0.55 * dt));
      this.body.linearVelocity.addSelf(right.scale(strafeSpeedTarget * 0.55 * dt));
    }

    if (brakeHeld) {
      const brakeScale = Math.max(0, 1 - this.opts.brakeDamping * dt);
      this.body.linearVelocity.scaleSelf(brakeScale);
    }

    const topSpeed = this.opts.maxForwardSpeed * this.opts.boostMultiplier * 1.05;
    const speed = this.body.linearVelocity.length();
    if (speed > topSpeed && speed > 1e-6) {
      this.body.linearVelocity.scaleSelf(topSpeed / speed);
    }

    this.body.position.addSelf(this.body.linearVelocity.scale(dt));

    // Keep the linked node authoritative on the main thread in between worker syncs.
    if (this.body.sceneNode) {
      this.body.sceneNode.transform.position.copy(this.body.position);
      this.body.sceneNode.transform.rotation.copy(this.body.rotation);
      this.body.sceneNode.transform.markDirty();
    }
  }

  getHudState(): ShipHudState {
    const euler = this.orientation.toEuler();
    return {
      speed: this.body.linearVelocity.length(),
      throttle: this.throttle,
      throttleTarget: this.throttleTarget,
      boostActive: this.boostActive,
      flightAssist: this.flightAssist,
      pitchDeg: euler.x,
      rollDeg: euler.z,
      yawDeg: euler.y,
      pitchRate: this.pitchRate,
      yawRate: this.yawRate,
      rollRate: this.rollRate,
    };
  }
}

function dampedTo(current: number, target: number, sharpness: number, dt: number): number {
  const t = 1 - Math.exp(-Math.max(0, sharpness) * Math.max(0, dt));
  return current + (target - current) * t;
}
