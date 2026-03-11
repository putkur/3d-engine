import { VertexBuffer } from './VertexBuffer';
import { IndexBuffer } from './IndexBuffer';

export interface VertexAttribute {
  /** Attribute location in the shader */
  location: number;
  /** Number of components (1, 2, 3, or 4) */
  size: number;
  /** GL type — default FLOAT */
  type?: number;
  /** Whether to normalize integer data — default false */
  normalized?: boolean;
  /** Byte stride between consecutive attributes — 0 for tightly packed */
  stride?: number;
  /** Byte offset of the first component in the buffer */
  offset?: number;
}

export class VertexArray {
  public readonly handle: WebGLVertexArrayObject;
  private readonly gl: WebGL2RenderingContext;
  private indexBuffer: IndexBuffer | null = null;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    const handle = gl.createVertexArray();
    if (!handle) {
      throw new Error('Failed to create vertex array object');
    }
    this.handle = handle;
  }

  bind(): void {
    this.gl.bindVertexArray(this.handle);
  }

  unbind(): void {
    this.gl.bindVertexArray(null);
  }

  /**
   * Add a vertex buffer with attribute layout.
   * Must be called while this VAO is bound.
   */
  addVertexBuffer(buffer: VertexBuffer, attributes: VertexAttribute[]): void {
    const gl = this.gl;
    this.bind();
    buffer.bind();

    for (const attr of attributes) {
      gl.enableVertexAttribArray(attr.location);
      gl.vertexAttribPointer(
        attr.location,
        attr.size,
        attr.type ?? gl.FLOAT,
        attr.normalized ?? false,
        attr.stride ?? 0,
        attr.offset ?? 0,
      );
    }

    this.unbind();
    buffer.unbind();
  }

  setIndexBuffer(buffer: IndexBuffer): void {
    this.bind();
    buffer.bind();
    this.indexBuffer = buffer;
    this.unbind();
  }

  getIndexBuffer(): IndexBuffer | null {
    return this.indexBuffer;
  }

  destroy(): void {
    this.gl.deleteVertexArray(this.handle);
  }
}
