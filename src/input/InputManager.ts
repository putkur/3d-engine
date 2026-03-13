import { Keyboard } from './Keyboard';
import { Mouse } from './Mouse';
import { GamepadInput, GamepadButton } from './Gamepad';

/**
 * A binding source: either a keyboard code, a mouse button, or a gamepad button.
 */
export type ActionBinding =
  | { type: 'key'; code: string }
  | { type: 'mouse'; button: number }
  | { type: 'gamepad'; button: GamepadButton; padIndex?: number };

/**
 * Unified input manager that aggregates keyboard, mouse, and gamepad.
 *
 * Supports named action mappings so gameplay code can query logical actions
 * (e.g. "jump") instead of raw key codes.
 *
 * Usage:
 * ```
 * const input = new InputManager(canvas);
 * input.bindAction('jump', { type: 'key', code: 'Space' });
 * input.bindAction('jump', { type: 'gamepad', button: GamepadButton.A });
 *
 * // in loop:
 * input.poll();
 * if (input.wasActionPressed('jump')) { ... }
 * ```
 */
export class InputManager {
  public readonly keyboard: Keyboard;
  public readonly mouse: Mouse;
  public readonly gamepads: GamepadInput[];

  private _actions = new Map<string, ActionBinding[]>();
  private _disposed = false;

  constructor(canvas: HTMLCanvasElement, gamepadCount: number = 1) {
    this.keyboard = new Keyboard();
    this.mouse = new Mouse(canvas);
    this.gamepads = [];
    for (let i = 0; i < gamepadCount; i++) {
      this.gamepads.push(new GamepadInput(i));
    }
  }

  // ------- Action mapping -------

  /** Bind a named action to one or more input sources. */
  bindAction(action: string, binding: ActionBinding): void {
    let list = this._actions.get(action);
    if (!list) {
      list = [];
      this._actions.set(action, list);
    }
    list.push(binding);
  }

  /** Remove all bindings for a named action. */
  unbindAction(action: string): void {
    this._actions.delete(action);
  }

  /** Remove all action bindings. */
  clearActions(): void {
    this._actions.clear();
  }

  /** Returns true while any binding for the action is held. */
  isActionDown(action: string): boolean {
    const bindings = this._actions.get(action);
    if (!bindings) return false;
    for (const b of bindings) {
      if (this.isBindingDown(b)) return true;
    }
    return false;
  }

  /** Returns true only on the frame the action was first triggered. */
  wasActionPressed(action: string): boolean {
    const bindings = this._actions.get(action);
    if (!bindings) return false;
    for (const b of bindings) {
      if (this.wasBindingPressed(b)) return true;
    }
    return false;
  }

  /** Returns true only on the frame the action was released. */
  wasActionReleased(action: string): boolean {
    const bindings = this._actions.get(action);
    if (!bindings) return false;
    for (const b of bindings) {
      if (this.wasBindingReleased(b)) return true;
    }
    return false;
  }

  // ------- Polling -------

  /**
   * Process all input events for this frame.
   * Call once at the start of each game loop iteration.
   */
  poll(): void {
    this.keyboard.poll();
    this.mouse.poll();
    for (const gp of this.gamepads) {
      gp.poll();
    }
  }

  // ------- Cleanup -------

  reset(): void {
    this.keyboard.reset();
    this.mouse.reset();
    for (const gp of this.gamepads) {
      gp.reset();
    }
  }

  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;
    this.keyboard.dispose();
    this.mouse.dispose();
    for (const gp of this.gamepads) {
      gp.dispose();
    }
    this._actions.clear();
  }

  // ------- Private helpers -------

  private isBindingDown(b: ActionBinding): boolean {
    switch (b.type) {
      case 'key':
        return this.keyboard.isDown(b.code);
      case 'mouse':
        return this.mouse.isDown(b.button);
      case 'gamepad': {
        const gp = this.gamepads[b.padIndex ?? 0];
        return gp ? gp.isDown(b.button) : false;
      }
    }
  }

  private wasBindingPressed(b: ActionBinding): boolean {
    switch (b.type) {
      case 'key':
        return this.keyboard.wasPressed(b.code);
      case 'mouse':
        return this.mouse.wasPressed(b.button);
      case 'gamepad': {
        const gp = this.gamepads[b.padIndex ?? 0];
        return gp ? gp.wasPressed(b.button) : false;
      }
    }
  }

  private wasBindingReleased(b: ActionBinding): boolean {
    switch (b.type) {
      case 'key':
        return this.keyboard.wasReleased(b.code);
      case 'mouse':
        return this.mouse.wasReleased(b.button);
      case 'gamepad': {
        const gp = this.gamepads[b.padIndex ?? 0];
        return gp ? gp.wasReleased(b.button) : false;
      }
    }
  }
}
