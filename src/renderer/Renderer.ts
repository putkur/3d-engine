import { ShaderProgram } from './ShaderProgram';
import { VertexArray } from './VertexArray';

export interface RenderStats {
  drawCalls: number;
  triangles: number;
  shaderSwitches: number;
}

export class Renderer {
  public readonly gl: WebGL2RenderingContext;
  public readonly canvas: HTMLCanvasElement;
  public stats: RenderStats = { drawCalls: 0, triangles: 0, shaderSwitches: 0 };

  private currentProgram: WebGLProgram | null = null;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.canvas = gl.canvas as HTMLCanvasElement;
  }

  /** Set default GL state. */
  configure(): void {
    const gl = this.gl;
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.clearColor(0.1, 0.1, 0.12, 1.0);
  }

  setClearColor(r: number, g: number, b: number, a = 1): void {
    this.gl.clearColor(r, g, b, a);
  }

  clear(): void {
    const gl = this.gl;
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }

  setViewport(x: number, y: number, width: number, height: number): void {
    this.gl.viewport(x, y, width, height);
  }

  resetStats(): void {
    this.stats.drawCalls = 0;
    this.stats.triangles = 0;
    this.stats.shaderSwitches = 0;
  }

  useProgram(program: ShaderProgram): void {
    if (this.currentProgram !== program.handle) {
      program.use();
      this.currentProgram = program.handle;
      this.stats.shaderSwitches++;
    }
  }

  /** Draw elements from a VAO that has an index buffer set. Auto-detects Uint16 vs Uint32 index type. */
  drawElements(vao: VertexArray, mode?: number): void {
    const gl = this.gl;
    const ib = vao.getIndexBuffer();
    if (!ib) {
      throw new Error('VertexArray has no index buffer set');
    }

    vao.bind();
    gl.drawElements(mode ?? gl.TRIANGLES, ib.count, ib.indexType, 0);
    vao.unbind();

    this.stats.drawCalls++;
    this.stats.triangles += ib.count / 3;
  }

  /** Draw arrays (no index buffer). */
  drawArrays(vao: VertexArray, vertexCount: number, mode?: number): void {
    const gl = this.gl;
    vao.bind();
    gl.drawArrays(mode ?? gl.TRIANGLES, 0, vertexCount);
    vao.unbind();

    this.stats.drawCalls++;
    this.stats.triangles += vertexCount / 3;
  }

  setDepthTest(enabled: boolean): void {
    if (enabled) this.gl.enable(this.gl.DEPTH_TEST);
    else this.gl.disable(this.gl.DEPTH_TEST);
  }

  setCullFace(enabled: boolean): void {
    if (enabled) this.gl.enable(this.gl.CULL_FACE);
    else this.gl.disable(this.gl.CULL_FACE);
  }

  setBlending(enabled: boolean): void {
    const gl = this.gl;
    if (enabled) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    } else {
      gl.disable(gl.BLEND);
    }
  }
}
