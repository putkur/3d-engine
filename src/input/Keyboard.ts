/**
 * Tracks keyboard key states using KeyboardEvent.code for layout-independent keys.
 * Call `poll()` at the start of each frame and `endFrame()` at the end.
 */
export class Keyboard {
  /** Keys currently held down. */
  private _down = new Set<string>();
  /** Keys that went down this frame (single-frame pulse). */
  private _pressed = new Set<string>();
  /** Keys that went up this frame (single-frame pulse). */
  private _released = new Set<string>();

  /** Queued presses/releases between polls. */
  private _queuedDown: string[] = [];
  private _queuedUp: string[] = [];

  private _disposed = false;

  constructor() {
    this.bindEvents();
  }

  /** Returns true while the key is held down. */
  isDown(code: string): boolean {
    return this._down.has(code);
  }

  /** Returns true only on the frame the key was first pressed. */
  wasPressed(code: string): boolean {
    return this._pressed.has(code);
  }

  /** Returns true only on the frame the key was released. */
  wasReleased(code: string): boolean {
    return this._released.has(code);
  }

  /** Returns a read-only view of all currently held keys. */
  get downKeys(): ReadonlySet<string> {
    return this._down;
  }

  /**
   * Process queued input events. Call once at the start of each frame.
   */
  poll(): void {
    this._pressed.clear();
    this._released.clear();

    for (const code of this._queuedDown) {
      if (!this._down.has(code)) {
        this._pressed.add(code);
      }
      this._down.add(code);
    }

    for (const code of this._queuedUp) {
      this._down.delete(code);
      this._released.add(code);
    }

    this._queuedDown.length = 0;
    this._queuedUp.length = 0;
  }

  /** Reset all state (e.g. when window loses focus). */
  reset(): void {
    this._down.clear();
    this._pressed.clear();
    this._released.clear();
    this._queuedDown.length = 0;
    this._queuedUp.length = 0;
  }

  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;
    this.unbindEvents();
    this.reset();
  }

  // ------- Event handlers -------

  private _onKeyDown = (e: KeyboardEvent): void => {
    if (this._disposed) return;
    this._queuedDown.push(e.code);
  };

  private _onKeyUp = (e: KeyboardEvent): void => {
    if (this._disposed) return;
    this._queuedUp.push(e.code);
  };

  private _onBlur = (): void => {
    this.reset();
  };

  private bindEvents(): void {
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
  }

  private unbindEvents(): void {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
  }
}
