export enum BufferUsage {
  STATIC = WebGL2RenderingContext.STATIC_DRAW,
  DYNAMIC = WebGL2RenderingContext.DYNAMIC_DRAW,
  STREAM = WebGL2RenderingContext.STREAM_DRAW,
}

export class VertexBuffer {
  public readonly handle: WebGLBuffer;
  private readonly gl: WebGL2RenderingContext;

  constructor(gl: WebGL2RenderingContext, data: ArrayBufferView, usage: BufferUsage = BufferUsage.STATIC) {
    this.gl = gl;
    const handle = gl.createBuffer();
    if (!handle) {
      throw new Error('Failed to create vertex buffer');
    }
    this.handle = handle;

    gl.bindBuffer(gl.ARRAY_BUFFER, this.handle);
    gl.bufferData(gl.ARRAY_BUFFER, data, usage);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }

  bind(): void {
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.handle);
  }

  unbind(): void {
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
  }

  update(data: ArrayBufferView, offset = 0): void {
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.handle);
    this.gl.bufferSubData(this.gl.ARRAY_BUFFER, offset, data);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
  }

  destroy(): void {
    this.gl.deleteBuffer(this.handle);
  }
}
