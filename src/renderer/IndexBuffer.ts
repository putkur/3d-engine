import { BufferUsage } from './VertexBuffer';

export class IndexBuffer {
  public readonly handle: WebGLBuffer;
  public readonly count: number;
  /** GL index type: gl.UNSIGNED_SHORT (Uint16) or gl.UNSIGNED_INT (Uint32). */
  public readonly indexType: number;
  private readonly gl: WebGL2RenderingContext;

  constructor(gl: WebGL2RenderingContext, data: Uint16Array | Uint32Array, usage: BufferUsage = BufferUsage.STATIC) {
    this.gl = gl;
    this.count = data.length;
    this.indexType = data instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;

    const handle = gl.createBuffer();
    if (!handle) {
      throw new Error('Failed to create index buffer');
    }
    this.handle = handle;

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.handle);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data, usage);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
  }

  bind(): void {
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.handle);
  }

  unbind(): void {
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, null);
  }

  destroy(): void {
    this.gl.deleteBuffer(this.handle);
  }
}
