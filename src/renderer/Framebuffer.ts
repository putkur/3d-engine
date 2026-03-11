import { Texture, TextureFilter, TextureWrap } from './Texture';

export class Framebuffer {
  public readonly handle: WebGLFramebuffer;
  public readonly width: number;
  public readonly height: number;
  public colorTexture: Texture | null = null;
  public depthTexture: Texture | null = null;
  private readonly gl: WebGL2RenderingContext;

  constructor(gl: WebGL2RenderingContext, width: number, height: number) {
    this.gl = gl;
    this.width = width;
    this.height = height;

    const handle = gl.createFramebuffer();
    if (!handle) {
      throw new Error('Failed to create framebuffer');
    }
    this.handle = handle;
  }

  /** Attach a color texture (RGBA8). Creates the texture if not already attached. */
  attachColor(): Texture {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.handle);

    this.colorTexture = Texture.createEmpty(
      gl, this.width, this.height,
      gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE,
      {
        wrapS: TextureWrap.CLAMP_TO_EDGE,
        wrapT: TextureWrap.CLAMP_TO_EDGE,
        minFilter: TextureFilter.LINEAR,
        magFilter: TextureFilter.LINEAR,
      },
    );

    gl.framebufferTexture2D(
      gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D,
      this.colorTexture.handle, 0,
    );

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return this.colorTexture;
  }

  /** Attach a depth texture (DEPTH_COMPONENT24). Used for shadow maps. */
  attachDepth(): Texture {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.handle);

    this.depthTexture = Texture.createEmpty(
      gl, this.width, this.height,
      gl.DEPTH_COMPONENT24, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT,
      {
        wrapS: TextureWrap.CLAMP_TO_EDGE,
        wrapT: TextureWrap.CLAMP_TO_EDGE,
        minFilter: TextureFilter.NEAREST,
        magFilter: TextureFilter.NEAREST,
      },
    );

    gl.framebufferTexture2D(
      gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D,
      this.depthTexture.handle, 0,
    );

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return this.depthTexture;
  }

  /** Check completeness. Call after attaching textures. */
  checkStatus(): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.handle);
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error(`Framebuffer incomplete: 0x${status.toString(16)}`);
    }
  }

  bind(): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.handle);
    gl.viewport(0, 0, this.width, this.height);
  }

  unbind(): void {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
  }

  destroy(): void {
    this.colorTexture?.destroy();
    this.depthTexture?.destroy();
    this.gl.deleteFramebuffer(this.handle);
  }
}
