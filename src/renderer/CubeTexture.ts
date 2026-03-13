import { TextureWrap, TextureFilter } from './Texture';

/**
 * Cubemap texture for skyboxes and environment mapping.
 * Expects 6 face images: +X, -X, +Y, -Y, +Z, -Z.
 */
export class CubeTexture {
  public readonly handle: WebGLTexture;
  private readonly gl: WebGL2RenderingContext;

  private constructor(gl: WebGL2RenderingContext, handle: WebGLTexture) {
    this.gl = gl;
    this.handle = handle;
  }

  /**
   * Create a cubemap from 6 face images.
   * @param faces [+X, -X, +Y, -Y, +Z, -Z]
   */
  static fromImages(
    gl: WebGL2RenderingContext,
    faces: [
      TexImageSource, TexImageSource, TexImageSource,
      TexImageSource, TexImageSource, TexImageSource,
    ],
  ): CubeTexture {
    const handle = gl.createTexture();
    if (!handle) throw new Error('Failed to create cubemap texture');

    const cube = new CubeTexture(gl, handle);

    gl.bindTexture(gl.TEXTURE_CUBE_MAP, handle);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

    const targets = [
      gl.TEXTURE_CUBE_MAP_POSITIVE_X,
      gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
      gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
      gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
      gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
      gl.TEXTURE_CUBE_MAP_NEGATIVE_Z,
    ];

    for (let i = 0; i < 6; i++) {
      gl.texImage2D(targets[i], 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, faces[i]);
    }

    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);

    gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
    return cube;
  }

  /**
   * Create a 1x1 solid-color cubemap (placeholder).
   */
  static createSolid(gl: WebGL2RenderingContext, r: number, g: number, b: number): CubeTexture {
    const handle = gl.createTexture();
    if (!handle) throw new Error('Failed to create cubemap texture');
    const cube = new CubeTexture(gl, handle);

    gl.bindTexture(gl.TEXTURE_CUBE_MAP, handle);
    const pixel = new Uint8Array([r, g, b, 255]);
    const targets = [
      gl.TEXTURE_CUBE_MAP_POSITIVE_X,
      gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
      gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
      gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
      gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
      gl.TEXTURE_CUBE_MAP_NEGATIVE_Z,
    ];
    for (const t of targets) {
      gl.texImage2D(t, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    }
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
    return cube;
  }

  bind(unit = 0): void {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.handle);
  }

  unbind(unit = 0): void {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
  }

  destroy(): void {
    this.gl.deleteTexture(this.handle);
  }
}
