import { Shader, ShaderType } from './Shader';

export class ShaderProgram {
  public readonly handle: WebGLProgram;
  private readonly gl: WebGL2RenderingContext;
  private readonly uniformCache: Map<string, WebGLUniformLocation> = new Map();
  private readonly attribCache: Map<string, number> = new Map();

  private constructor(gl: WebGL2RenderingContext, handle: WebGLProgram) {
    this.gl = gl;
    this.handle = handle;
  }

  static create(
    gl: WebGL2RenderingContext,
    vertexSource: string,
    fragmentSource: string,
  ): ShaderProgram {
    const vs = Shader.compile(gl, ShaderType.VERTEX, vertexSource);
    const fs = Shader.compile(gl, ShaderType.FRAGMENT, fragmentSource);

    const handle = gl.createProgram();
    if (!handle) {
      throw new Error('Failed to create shader program');
    }

    gl.attachShader(handle, vs.handle);
    gl.attachShader(handle, fs.handle);
    gl.linkProgram(handle);

    if (!gl.getProgramParameter(handle, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(handle) || 'Unknown error';
      gl.deleteProgram(handle);
      vs.destroy(gl);
      fs.destroy(gl);
      throw new Error(`Shader program link error:\n${log}`);
    }

    // Shaders can be detached/deleted after linking
    gl.detachShader(handle, vs.handle);
    gl.detachShader(handle, fs.handle);
    vs.destroy(gl);
    fs.destroy(gl);

    return new ShaderProgram(gl, handle);
  }

  use(): void {
    this.gl.useProgram(this.handle);
  }

  // --- Uniform location caching ---

  getUniformLocation(name: string): WebGLUniformLocation | null {
    if (this.uniformCache.has(name)) {
      return this.uniformCache.get(name)!;
    }
    const loc = this.gl.getUniformLocation(this.handle, name);
    if (loc !== null) {
      this.uniformCache.set(name, loc);
    }
    return loc;
  }

  getAttribLocation(name: string): number {
    if (this.attribCache.has(name)) {
      return this.attribCache.get(name)!;
    }
    const loc = this.gl.getAttribLocation(this.handle, name);
    this.attribCache.set(name, loc);
    return loc;
  }

  // --- Typed uniform setters ---

  setInt(name: string, value: number): void {
    const loc = this.getUniformLocation(name);
    if (loc !== null) this.gl.uniform1i(loc, value);
  }

  setFloat(name: string, value: number): void {
    const loc = this.getUniformLocation(name);
    if (loc !== null) this.gl.uniform1f(loc, value);
  }

  setVec2(name: string, x: number, y: number): void {
    const loc = this.getUniformLocation(name);
    if (loc !== null) this.gl.uniform2f(loc, x, y);
  }

  setVec3(name: string, x: number, y: number, z: number): void {
    const loc = this.getUniformLocation(name);
    if (loc !== null) this.gl.uniform3f(loc, x, y, z);
  }

  setVec3v(name: string, data: Float32Array): void {
    const loc = this.getUniformLocation(name);
    if (loc !== null) this.gl.uniform3fv(loc, data);
  }

  setVec4(name: string, x: number, y: number, z: number, w: number): void {
    const loc = this.getUniformLocation(name);
    if (loc !== null) this.gl.uniform4f(loc, x, y, z, w);
  }

  setMat4(name: string, data: Float32Array): void {
    const loc = this.getUniformLocation(name);
    if (loc !== null) this.gl.uniformMatrix4fv(loc, false, data);
  }

  setTexture(name: string, texture: WebGLTexture, unit: number): void {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    this.setInt(name, unit);
  }

  destroy(): void {
    this.gl.deleteProgram(this.handle);
  }
}
