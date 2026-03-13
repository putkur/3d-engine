import { ShaderProgram } from './ShaderProgram';
import { Framebuffer } from './Framebuffer';
import { VertexBuffer, BufferUsage } from './VertexBuffer';
import { VertexArray } from './VertexArray';

import postprocessVert from './shaders/postprocess.vert';
import postprocessFrag from './shaders/postprocess.frag';
import bloomExtractFrag from './shaders/bloom_extract.frag';
import blurFrag from './shaders/blur.frag';

export interface PostProcessingOptions {
  /** HDR exposure multiplier (default 1.0). */
  exposure?: number;
  /** Bloom brightness threshold (default 0.8). */
  bloomThreshold?: number;
  /** Bloom mix strength 0-1 (default 0.3). */
  bloomStrength?: number;
  /** Number of Gaussian blur passes (default 5). */
  bloomPasses?: number;
  /** Vignette darkening 0-1 (default 0.4). */
  vignetteStrength?: number;
  /** Color saturation, 1 = normal (default 1.0). */
  saturation?: number;
  /** Enable FXAA (default true). */
  enableFXAA?: boolean;
}

/**
 * Post-processing pipeline: bloom, tone mapping, FXAA, vignette, color grading.
 *
 * Usage:
 *   1. `postProcess.begin()` — binds the scene framebuffer.
 *   2. Render your scene normally.
 *   3. `postProcess.end()` — runs the effect chain and blits to the default framebuffer.
 */
export class PostProcessing {
  public enabled = true;

  public exposure: number;
  public bloomThreshold: number;
  public bloomStrength: number;
  public bloomPasses: number;
  public vignetteStrength: number;
  public saturation: number;
  public enableFXAA: boolean;

  private gl: WebGL2RenderingContext;
  private width: number;
  private height: number;

  // Framebuffers
  private sceneFB: Framebuffer;
  private bloomExtractFB: Framebuffer;
  private pingFB: Framebuffer;
  private pongFB: Framebuffer;

  // Shaders
  private compositeShader: ShaderProgram;
  private bloomExtractShader: ShaderProgram;
  private blurShader: ShaderProgram;

  // Fullscreen quad
  private quadVAO: VertexArray;
  private quadVBO: VertexBuffer;

  constructor(gl: WebGL2RenderingContext, width: number, height: number, options?: PostProcessingOptions) {
    this.gl = gl;
    this.width = width;
    this.height = height;

    const o = options ?? {};
    this.exposure = o.exposure ?? 1.0;
    this.bloomThreshold = o.bloomThreshold ?? 0.8;
    this.bloomStrength = o.bloomStrength ?? 0.3;
    this.bloomPasses = o.bloomPasses ?? 5;
    this.vignetteStrength = o.vignetteStrength ?? 0.4;
    this.saturation = o.saturation ?? 1.0;
    this.enableFXAA = o.enableFXAA ?? true;

    // Scene framebuffer (render to this instead of default)
    this.sceneFB = new Framebuffer(gl, width, height);
    this.sceneFB.attachColor();
    this.sceneFB.attachDepth();
    this.sceneFB.checkStatus();

    // Bloom framebuffers at half resolution
    const bw = Math.max(1, width >> 1);
    const bh = Math.max(1, height >> 1);
    this.bloomExtractFB = new Framebuffer(gl, bw, bh);
    this.bloomExtractFB.attachColor();
    this.bloomExtractFB.checkStatus();

    this.pingFB = new Framebuffer(gl, bw, bh);
    this.pingFB.attachColor();
    this.pingFB.checkStatus();

    this.pongFB = new Framebuffer(gl, bw, bh);
    this.pongFB.attachColor();
    this.pongFB.checkStatus();

    // Compile shaders
    this.compositeShader = ShaderProgram.create(gl, postprocessVert, postprocessFrag);
    this.bloomExtractShader = ShaderProgram.create(gl, postprocessVert, bloomExtractFrag);
    this.blurShader = ShaderProgram.create(gl, postprocessVert, blurFrag);

    // Fullscreen triangle-strip quad: position(2) + uv(2)
    const quadData = new Float32Array([
      -1, -1,  0, 0,
       1, -1,  1, 0,
      -1,  1,  0, 1,
       1,  1,  1, 1,
    ]);
    this.quadVBO = new VertexBuffer(gl, quadData, BufferUsage.STATIC);
    this.quadVAO = new VertexArray(gl);
    this.quadVAO.addVertexBuffer(this.quadVBO, [
      { location: 0, size: 2, stride: 16, offset: 0 },
      { location: 1, size: 2, stride: 16, offset: 8 },
    ]);
  }

  /** Get the scene framebuffer (for external depth reads, etc.). */
  get sceneFramebuffer(): Framebuffer {
    return this.sceneFB;
  }

  /**
   * Begin the post-processing pass: binds the scene framebuffer.
   * Render your scene after calling this.
   */
  begin(): void {
    if (!this.enabled) return;
    this.sceneFB.bind();
    const gl = this.gl;
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }

  /**
   * End the post-processing pass: runs bloom extraction, blur,
   * and the final composite to the default framebuffer.
   */
  end(): void {
    if (!this.enabled) return;

    const gl = this.gl;

    // --- 1. Bloom extraction: extract bright pixels ---
    this.bloomExtractFB.bind();
    gl.clear(gl.COLOR_BUFFER_BIT);
    this.bloomExtractShader.use();
    this.sceneFB.colorTexture!.bind(0);
    this.bloomExtractShader.setInt('u_source', 0);
    this.bloomExtractShader.setFloat('u_threshold', this.bloomThreshold);
    this.drawQuad();

    // --- 2. Gaussian blur ping-pong ---
    const bw = this.bloomExtractFB.width;
    const bh = this.bloomExtractFB.height;
    let readFB = this.bloomExtractFB;
    let horizontal = true;

    for (let i = 0; i < this.bloomPasses * 2; i++) {
      const writeFB = horizontal ? this.pingFB : this.pongFB;
      writeFB.bind();
      gl.clear(gl.COLOR_BUFFER_BIT);
      this.blurShader.use();
      readFB.colorTexture!.bind(0);
      this.blurShader.setInt('u_source', 0);
      this.blurShader.setVec2(
        'u_direction',
        horizontal ? 1.0 / bw : 0,
        horizontal ? 0 : 1.0 / bh,
      );
      this.drawQuad();
      readFB = writeFB;
      horizontal = !horizontal;
    }

    // readFB now contains the final blurred bloom

    // --- 3. Final composite: combine scene + bloom → default framebuffer ---
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.width, this.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    this.compositeShader.use();
    this.sceneFB.colorTexture!.bind(0);
    this.compositeShader.setInt('u_scene', 0);
    readFB.colorTexture!.bind(1);
    this.compositeShader.setInt('u_bloom', 1);

    this.compositeShader.setFloat('u_exposure', this.exposure);
    this.compositeShader.setFloat('u_bloomStrength', this.bloomStrength);
    this.compositeShader.setFloat('u_vignetteStrength', this.vignetteStrength);
    this.compositeShader.setFloat('u_saturation', this.saturation);
    this.compositeShader.setInt('u_enableFXAA', this.enableFXAA ? 1 : 0);

    this.drawQuad();

    // Unbind textures to prevent feedback loops on next frame's begin()
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  /** Call when the canvas resizes. Recreates framebuffers at new size. */
  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;

    // Recreate scene FB at full res
    this.sceneFB.destroy();
    this.sceneFB = new Framebuffer(this.gl, width, height);
    this.sceneFB.attachColor();
    this.sceneFB.attachDepth();
    this.sceneFB.checkStatus();

    // Recreate bloom FBs at half res
    const bw = Math.max(1, width >> 1);
    const bh = Math.max(1, height >> 1);

    this.bloomExtractFB.destroy();
    this.bloomExtractFB = new Framebuffer(this.gl, bw, bh);
    this.bloomExtractFB.attachColor();
    this.bloomExtractFB.checkStatus();

    this.pingFB.destroy();
    this.pingFB = new Framebuffer(this.gl, bw, bh);
    this.pingFB.attachColor();
    this.pingFB.checkStatus();

    this.pongFB.destroy();
    this.pongFB = new Framebuffer(this.gl, bw, bh);
    this.pongFB.attachColor();
    this.pongFB.checkStatus();
  }

  dispose(): void {
    this.sceneFB.destroy();
    this.bloomExtractFB.destroy();
    this.pingFB.destroy();
    this.pongFB.destroy();
    this.compositeShader.destroy();
    this.bloomExtractShader.destroy();
    this.blurShader.destroy();
    this.quadVAO.destroy();
    this.quadVBO.destroy();
  }

  private drawQuad(): void {
    const gl = this.gl;
    gl.disable(gl.DEPTH_TEST);
    this.quadVAO.bind();
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    this.quadVAO.unbind();
    gl.enable(gl.DEPTH_TEST);
  }
}
