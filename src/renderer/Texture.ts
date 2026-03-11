export enum TextureWrap {
  REPEAT = WebGL2RenderingContext.REPEAT,
  CLAMP_TO_EDGE = WebGL2RenderingContext.CLAMP_TO_EDGE,
  MIRRORED_REPEAT = WebGL2RenderingContext.MIRRORED_REPEAT,
}

export enum TextureFilter {
  NEAREST = WebGL2RenderingContext.NEAREST,
  LINEAR = WebGL2RenderingContext.LINEAR,
  NEAREST_MIPMAP_NEAREST = WebGL2RenderingContext.NEAREST_MIPMAP_NEAREST,
  LINEAR_MIPMAP_LINEAR = WebGL2RenderingContext.LINEAR_MIPMAP_LINEAR,
  LINEAR_MIPMAP_NEAREST = WebGL2RenderingContext.LINEAR_MIPMAP_NEAREST,
  NEAREST_MIPMAP_LINEAR = WebGL2RenderingContext.NEAREST_MIPMAP_LINEAR,
}

export interface TextureOptions {
  wrapS?: TextureWrap;
  wrapT?: TextureWrap;
  minFilter?: TextureFilter;
  magFilter?: TextureFilter;
  generateMipmaps?: boolean;
  flipY?: boolean;
}

const DEFAULT_OPTIONS: Required<TextureOptions> = {
  wrapS: TextureWrap.REPEAT,
  wrapT: TextureWrap.REPEAT,
  minFilter: TextureFilter.LINEAR_MIPMAP_LINEAR,
  magFilter: TextureFilter.LINEAR,
  generateMipmaps: true,
  flipY: true,
};

export class Texture {
  public readonly handle: WebGLTexture;
  public width = 0;
  public height = 0;
  private readonly gl: WebGL2RenderingContext;

  private constructor(gl: WebGL2RenderingContext, handle: WebGLTexture) {
    this.gl = gl;
    this.handle = handle;
  }

  static fromImage(
    gl: WebGL2RenderingContext,
    image: HTMLImageElement | ImageBitmap,
    options?: TextureOptions,
  ): Texture {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const handle = gl.createTexture();
    if (!handle) {
      throw new Error('Failed to create texture');
    }

    const tex = new Texture(gl, handle);
    tex.width = image.width;
    tex.height = image.height;

    gl.bindTexture(gl.TEXTURE_2D, handle);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, opts.flipY);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, opts.wrapS);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, opts.wrapT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, opts.minFilter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, opts.magFilter);

    if (opts.generateMipmaps) {
      gl.generateMipmap(gl.TEXTURE_2D);
    }

    gl.bindTexture(gl.TEXTURE_2D, null);
    return tex;
  }

  /** Create an empty texture (useful for framebuffer attachments). */
  static createEmpty(
    gl: WebGL2RenderingContext,
    width: number,
    height: number,
    internalFormat: number = gl.RGBA8,
    format: number = gl.RGBA,
    type: number = gl.UNSIGNED_BYTE,
    options?: TextureOptions,
  ): Texture {
    const opts = { ...DEFAULT_OPTIONS, generateMipmaps: false, ...options };
    const handle = gl.createTexture();
    if (!handle) {
      throw new Error('Failed to create texture');
    }

    const tex = new Texture(gl, handle);
    tex.width = width;
    tex.height = height;

    gl.bindTexture(gl.TEXTURE_2D, handle);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, format, type, null);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, opts.wrapS);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, opts.wrapT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, opts.minFilter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, opts.magFilter);

    gl.bindTexture(gl.TEXTURE_2D, null);
    return tex;
  }

  /** Create a 1x1 solid color texture (useful as placeholder). */
  static createSolid(gl: WebGL2RenderingContext, r: number, g: number, b: number, a = 255): Texture {
    const handle = gl.createTexture();
    if (!handle) {
      throw new Error('Failed to create texture');
    }

    const tex = new Texture(gl, handle);
    tex.width = 1;
    tex.height = 1;

    gl.bindTexture(gl.TEXTURE_2D, handle);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
      new Uint8Array([r, g, b, a]),
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.bindTexture(gl.TEXTURE_2D, null);

    return tex;
  }

  bind(unit = 0): void {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, this.handle);
  }

  unbind(unit = 0): void {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  destroy(): void {
    this.gl.deleteTexture(this.handle);
  }
}
