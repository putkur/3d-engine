import { Renderer, RenderStats } from '../renderer/Renderer';

/**
 * Performance overlay showing FPS, frame time, draw calls, triangles,
 * shader switches, and physics step time.
 *
 * Rendered as an HTML overlay element.
 */
export class Stats {
  private el: HTMLDivElement;
  private renderer: Renderer | null = null;

  // FPS tracking
  private frameCount = 0;
  private fpsAccum = 0;
  private fps = 0;
  private frameTimeMs = 0;

  // Physics timing
  private physicsMs = 0;

  constructor() {
    this.el = document.createElement('div');
    this.el.style.cssText =
      'position:fixed;top:8px;left:8px;color:#0f0;font:bold 12px monospace;' +
      'background:rgba(0,0,0,0.7);padding:6px 10px;border-radius:4px;' +
      'z-index:1001;pointer-events:none;line-height:1.5;white-space:pre;';
    this.el.textContent = 'Stats: --';
    document.body.appendChild(this.el);
  }

  /** Attach a renderer to read draw-call stats from. */
  setRenderer(renderer: Renderer): void {
    this.renderer = renderer;
  }

  /** Record how long the physics step took this frame (in seconds). */
  setPhysicsTime(seconds: number): void {
    this.physicsMs = seconds * 1000;
  }

  /**
   * Call once per frame with the frame's delta time (seconds).
   * Reads stats from the attached renderer.
   */
  update(dt: number): void {
    this.frameCount++;
    this.fpsAccum += dt;
    this.frameTimeMs = dt * 1000;

    if (this.fpsAccum >= 1.0) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.fpsAccum -= 1.0;
    }

    const stats: RenderStats = this.renderer?.stats ?? { drawCalls: 0, triangles: 0, shaderSwitches: 0 };

    this.el.textContent =
      `FPS: ${this.fps}  (${this.frameTimeMs.toFixed(1)} ms)\n` +
      `Draw calls: ${stats.drawCalls}\n` +
      `Triangles:  ${Math.round(stats.triangles)}\n` +
      `Shaders:    ${stats.shaderSwitches}\n` +
      `Physics:    ${this.physicsMs.toFixed(2)} ms`;
  }

  /** Show / hide the overlay. */
  setVisible(visible: boolean): void {
    this.el.style.display = visible ? '' : 'none';
  }

  dispose(): void {
    if (this.el.parentNode) {
      this.el.parentNode.removeChild(this.el);
    }
  }
}
