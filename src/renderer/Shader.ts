export enum ShaderType {
  VERTEX,
  FRAGMENT,
}

export class Shader {
  public readonly handle: WebGLShader;
  public readonly type: ShaderType;

  private constructor(handle: WebGLShader, type: ShaderType) {
    this.handle = handle;
    this.type = type;
  }

  static compile(gl: WebGL2RenderingContext, type: ShaderType, source: string): Shader {
    const glType = type === ShaderType.VERTEX ? gl.VERTEX_SHADER : gl.FRAGMENT_SHADER;
    const handle = gl.createShader(glType);
    if (!handle) {
      throw new Error('Failed to create shader object');
    }

    gl.shaderSource(handle, source);
    gl.compileShader(handle);

    if (!gl.getShaderParameter(handle, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(handle) || 'Unknown error';
      const typeName = type === ShaderType.VERTEX ? 'VERTEX' : 'FRAGMENT';
      gl.deleteShader(handle);

      // Annotate error with source line numbers for debugging
      const numbered = source
        .split('\n')
        .map((line, i) => `${(i + 1).toString().padStart(4)}: ${line}`)
        .join('\n');
      throw new Error(
        `${typeName} shader compile error:\n${log}\n--- Source ---\n${numbered}`
      );
    }

    return new Shader(handle, type);
  }

  destroy(gl: WebGL2RenderingContext): void {
    gl.deleteShader(this.handle);
  }
}
