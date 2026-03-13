/**
 * Tracks mouse position, delta movement, button states, and scroll.
 * Supports pointer lock for FPS-style controls.
 * Call `poll()` at the start of each frame.
 */
export class Mouse {
  /** Current cursor position in CSS pixels relative to the canvas. */
  public x = 0;
  public y = 0;

  /** Accumulated movement delta since last poll. */
  public deltaX = 0;
  public deltaY = 0;

  /** Accumulated scroll delta since last poll (positive = scroll up). */
  public scrollX = 0;
  public scrollY = 0;

  /** Whether pointer lock is currently active. */
  public locked = false;

  /** Buttons currently held. */
  private _down = new Set<number>();
  /** Buttons pressed this frame. */
  private _pressed = new Set<number>();
  /** Buttons released this frame. */
  private _released = new Set<number>();

  private _queuedDown: number[] = [];
  private _queuedUp: number[] = [];
  private _queuedDX = 0;
  private _queuedDY = 0;
  private _queuedScrollX = 0;
  private _queuedScrollY = 0;
  private _queuedX = 0;
  private _queuedY = 0;

  private _canvas: HTMLCanvasElement;
  private _disposed = false;

  constructor(canvas: HTMLCanvasElement) {
    this._canvas = canvas;
    this.bindEvents();
  }

  /** Returns true while a mouse button is held. 0=left, 1=middle, 2=right. */
  isDown(button: number): boolean {
    return this._down.has(button);
  }

  /** Returns true only on the frame the button was pressed. */
  wasPressed(button: number): boolean {
    return this._pressed.has(button);
  }

  /** Returns true only on the frame the button was released. */
  wasReleased(button: number): boolean {
    return this._released.has(button);
  }

  /**
   * Process queued input events. Call once at the start of each frame.
   */
  poll(): void {
    this._pressed.clear();
    this._released.clear();

    for (const btn of this._queuedDown) {
      if (!this._down.has(btn)) {
        this._pressed.add(btn);
      }
      this._down.add(btn);
    }

    for (const btn of this._queuedUp) {
      this._down.delete(btn);
      this._released.add(btn);
    }

    this.x = this._queuedX;
    this.y = this._queuedY;
    this.deltaX = this._queuedDX;
    this.deltaY = this._queuedDY;
    this.scrollX = this._queuedScrollX;
    this.scrollY = this._queuedScrollY;

    this._queuedDown.length = 0;
    this._queuedUp.length = 0;
    this._queuedDX = 0;
    this._queuedDY = 0;
    this._queuedScrollX = 0;
    this._queuedScrollY = 0;
  }

  /** Request pointer lock on the canvas. */
  requestPointerLock(): void {
    this._canvas.requestPointerLock();
  }

  /** Exit pointer lock. */
  exitPointerLock(): void {
    if (document.pointerLockElement === this._canvas) {
      document.exitPointerLock();
    }
  }

  reset(): void {
    this._down.clear();
    this._pressed.clear();
    this._released.clear();
    this.deltaX = 0;
    this.deltaY = 0;
    this.scrollX = 0;
    this.scrollY = 0;
    this._queuedDown.length = 0;
    this._queuedUp.length = 0;
    this._queuedDX = 0;
    this._queuedDY = 0;
    this._queuedScrollX = 0;
    this._queuedScrollY = 0;
  }

  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;
    this.unbindEvents();
    this.reset();
  }

  // ------- Event handlers -------

  private _onMouseDown = (e: MouseEvent): void => {
    if (this._disposed) return;
    this._queuedDown.push(e.button);
  };

  private _onMouseUp = (e: MouseEvent): void => {
    if (this._disposed) return;
    this._queuedUp.push(e.button);
  };

  private _onMouseMove = (e: MouseEvent): void => {
    if (this._disposed) return;
    this._queuedDX += e.movementX;
    this._queuedDY += e.movementY;

    const rect = this._canvas.getBoundingClientRect();
    this._queuedX = e.clientX - rect.left;
    this._queuedY = e.clientY - rect.top;
  };

  private _onWheel = (e: WheelEvent): void => {
    if (this._disposed) return;
    e.preventDefault();
    // Normalize: positive scrollY = scroll up (zoom in)
    this._queuedScrollX += e.deltaX > 0 ? -1 : e.deltaX < 0 ? 1 : 0;
    this._queuedScrollY += e.deltaY > 0 ? -1 : e.deltaY < 0 ? 1 : 0;
  };

  private _onPointerLockChange = (): void => {
    this.locked = document.pointerLockElement === this._canvas;
  };

  private _onContextMenu = (e: Event): void => {
    e.preventDefault();
  };

  private bindEvents(): void {
    this._canvas.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('mousemove', this._onMouseMove);
    this._canvas.addEventListener('wheel', this._onWheel, { passive: false });
    document.addEventListener('pointerlockchange', this._onPointerLockChange);
    this._canvas.addEventListener('contextmenu', this._onContextMenu);
  }

  private unbindEvents(): void {
    this._canvas.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);
    window.removeEventListener('mousemove', this._onMouseMove);
    this._canvas.removeEventListener('wheel', this._onWheel);
    document.removeEventListener('pointerlockchange', this._onPointerLockChange);
    this._canvas.removeEventListener('contextmenu', this._onContextMenu);
  }
}
