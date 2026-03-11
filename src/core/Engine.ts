import { Clock } from './Clock';
import { EventEmitter } from './EventEmitter';

export class Engine extends EventEmitter {
  public readonly canvas: HTMLCanvasElement;
  public readonly gl: WebGL2RenderingContext;
  public readonly clock: Clock;

  private animationFrameId: number = 0;
  private running: boolean = false;

  // Stats
  private frameCount: number = 0;
  private fpsTime: number = 0;
  private currentFps: number = 0;
  private statsEl: HTMLDivElement | null = null;

  constructor(canvasOrSelector: HTMLCanvasElement | string) {
    super();

    if (typeof canvasOrSelector === 'string') {
      const el = document.querySelector<HTMLCanvasElement>(canvasOrSelector);
      if (!el) {
        throw new Error(`Canvas element not found: ${canvasOrSelector}`);
      }
      this.canvas = el;
    } else {
      this.canvas = canvasOrSelector;
    }

    const gl = this.canvas.getContext('webgl2', {
      antialias: true,
      alpha: false,
      premultipliedAlpha: false,
    });
    if (!gl) {
      throw new Error('WebGL 2 is not supported in this browser.');
    }
    this.gl = gl;

    this.clock = new Clock();
  }

  init(): void {
    this.resizeCanvas();
    window.addEventListener('resize', this.onResize);

    const gl = this.gl;
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.clearColor(0.1, 0.1, 0.12, 1.0);

    this.createStatsOverlay();

    this.emit('init');
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.clock.start();
    this.emit('start');
    this.loop();
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.clock.stop();
    cancelAnimationFrame(this.animationFrameId);
    this.emit('stop');
  }

  private loop = (): void => {
    if (!this.running) return;

    this.animationFrameId = requestAnimationFrame(this.loop);

    const dt = this.clock.tick();

    // Fixed timestep physics updates (placeholder for Phase 7)
    while (this.clock.accumulator >= this.clock.fixedDeltaTime) {
      this.emit('fixedUpdate', this.clock.fixedDeltaTime);
      this.clock.accumulator -= this.clock.fixedDeltaTime;
    }

    // Variable timestep update (game logic / animations)
    this.emit('update', dt);

    // Render
    const gl = this.gl;
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    this.emit('render', dt);

    // Stats
    this.updateStats(dt);
  };

  private updateStats(dt: number): void {
    this.frameCount++;
    this.fpsTime += dt;

    if (this.fpsTime >= 1.0) {
      this.currentFps = this.frameCount;
      this.frameCount = 0;
      this.fpsTime -= 1.0;

      if (this.statsEl) {
        this.statsEl.textContent = `FPS: ${this.currentFps}`;
      }
    }
  }

  private createStatsOverlay(): void {
    this.statsEl = document.createElement('div');
    this.statsEl.style.cssText =
      'position:fixed;top:8px;left:8px;color:#0f0;font:bold 14px monospace;' +
      'background:rgba(0,0,0,0.6);padding:4px 8px;border-radius:4px;z-index:1000;pointer-events:none;';
    this.statsEl.textContent = 'FPS: --';
    document.body.appendChild(this.statsEl);
  }

  private resizeCanvas(): void {
    const dpr = window.devicePixelRatio || 1;
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;

    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  private onResize = (): void => {
    this.resizeCanvas();
    this.emit('resize', {
      width: this.canvas.width,
      height: this.canvas.height,
    });
  };

  getFps(): number {
    return this.currentFps;
  }

  destroy(): void {
    this.stop();
    window.removeEventListener('resize', this.onResize);
    if (this.statsEl && this.statsEl.parentNode) {
      this.statsEl.parentNode.removeChild(this.statsEl);
    }
    this.removeAllListeners();
  }
}
