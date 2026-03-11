export class Clock {
  private previousTime: number = 0;
  private elapsed: number = 0;
  private delta: number = 0;
  private running: boolean = false;

  /** Fixed timestep for physics (default 1/60s) */
  public fixedDeltaTime: number = 1 / 60;

  /** Accumulated time for fixed-step physics updates */
  public accumulator: number = 0;

  start(): void {
    this.previousTime = performance.now();
    this.elapsed = 0;
    this.delta = 0;
    this.accumulator = 0;
    this.running = true;
  }

  /**
   * Call once per frame. Updates delta, elapsed, and accumulator.
   * Returns delta time in seconds.
   */
  tick(): number {
    if (!this.running) {
      return 0;
    }

    const now = performance.now();
    // Cap delta to 250ms to avoid spiral of death after tab suspension
    this.delta = Math.min((now - this.previousTime) / 1000, 0.25);
    this.previousTime = now;
    this.elapsed += this.delta;
    this.accumulator += this.delta;

    return this.delta;
  }

  /** Time in seconds since last tick */
  getDelta(): number {
    return this.delta;
  }

  /** Total time in seconds since start */
  getElapsed(): number {
    return this.elapsed;
  }

  stop(): void {
    this.running = false;
  }
}
