/**
 * Standard gamepad button indices (Standard Gamepad layout).
 * @see https://w3c.github.io/gamepad/#remapping
 */
export enum GamepadButton {
  A = 0,
  B = 1,
  X = 2,
  Y = 3,
  LB = 4,
  RB = 5,
  LT = 6,
  RT = 7,
  BACK = 8,
  START = 9,
  LEFT_STICK = 10,
  RIGHT_STICK = 11,
  DPAD_UP = 12,
  DPAD_DOWN = 13,
  DPAD_LEFT = 14,
  DPAD_RIGHT = 15,
  HOME = 16,
}

/**
 * Standard gamepad axis indices.
 */
export enum GamepadAxis {
  LEFT_X = 0,
  LEFT_Y = 1,
  RIGHT_X = 2,
  RIGHT_Y = 3,
}

const MAX_BUTTONS = 17;
const MAX_AXES = 4;

/**
 * Tracks a single gamepad's state: buttons, axes, with per-frame press/release detection.
 * Call `poll()` each frame to snapshot the hardware state.
 */
export class GamepadInput {
  /** Deadzone for analog sticks. Values below this are treated as 0. */
  public deadzone = 0.1;

  /** The gamepad index this instance tracks. */
  public readonly index: number;

  /** Whether a gamepad is currently connected at this index. */
  public connected = false;

  /** Current axis values (after deadzone). */
  private _axes = new Float32Array(MAX_AXES);

  /** Current button pressed state. */
  private _down = new Uint8Array(MAX_BUTTONS);
  /** Previous frame button state (for edge detection). */
  private _prevDown = new Uint8Array(MAX_BUTTONS);

  constructor(index: number = 0) {
    this.index = index;
  }

  /** Returns the value of a normalized axis (–1 to 1) after deadzone. */
  getAxis(axis: GamepadAxis): number {
    return this._axes[axis] ?? 0;
  }

  /** Returns true while a button is held. */
  isDown(button: GamepadButton): boolean {
    return this._down[button] === 1;
  }

  /** Returns true only on the frame the button was first pressed. */
  wasPressed(button: GamepadButton): boolean {
    return this._down[button] === 1 && this._prevDown[button] === 0;
  }

  /** Returns true only on the frame the button was released. */
  wasReleased(button: GamepadButton): boolean {
    return this._down[button] === 0 && this._prevDown[button] === 1;
  }

  /** Left stick as [x, y]. */
  get leftStick(): [number, number] {
    return [this._axes[GamepadAxis.LEFT_X], this._axes[GamepadAxis.LEFT_Y]];
  }

  /** Right stick as [x, y]. */
  get rightStick(): [number, number] {
    return [this._axes[GamepadAxis.RIGHT_X], this._axes[GamepadAxis.RIGHT_Y]];
  }

  /**
   * Snapshot the hardware gamepad state. Call once per frame.
   */
  poll(): void {
    // Swap prev/current
    this._prevDown.set(this._down);

    const gamepads = navigator.getGamepads();
    const gp = gamepads[this.index];

    if (!gp || !gp.connected) {
      this.connected = false;
      this._down.fill(0);
      this._axes.fill(0);
      return;
    }

    this.connected = true;

    // Buttons
    const btnCount = Math.min(gp.buttons.length, MAX_BUTTONS);
    for (let i = 0; i < btnCount; i++) {
      this._down[i] = gp.buttons[i].pressed ? 1 : 0;
    }

    // Axes with deadzone
    const axisCount = Math.min(gp.axes.length, MAX_AXES);
    for (let i = 0; i < axisCount; i++) {
      const raw = gp.axes[i];
      this._axes[i] = Math.abs(raw) < this.deadzone ? 0 : raw;
    }
  }

  reset(): void {
    this._down.fill(0);
    this._prevDown.fill(0);
    this._axes.fill(0);
    this.connected = false;
  }

  dispose(): void {
    this.reset();
  }
}
