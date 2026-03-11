import { Framebuffer } from '../renderer/Framebuffer';
import { ShaderProgram } from '../renderer/ShaderProgram';
import { Renderer } from '../renderer/Renderer';
import { Mesh } from '../scene/Mesh';
import { SceneNode } from '../scene/SceneNode';
import { Matrix4 } from '../math/Matrix4';
import { Texture } from '../renderer/Texture';
import shadowVert from '../renderer/shaders/shadow.vert';
import shadowFrag from '../renderer/shaders/shadow.frag';

/**
 * Shadow mapping utility.
 * Renders the scene from a light's perspective into a depth framebuffer,
 * producing a shadow map texture that can be sampled in the main lighting pass.
 */
export class ShadowMap {
  public readonly framebuffer: Framebuffer;
  public readonly size: number;
  private readonly gl: WebGL2RenderingContext;
  private readonly depthProgram: ShaderProgram;

  constructor(gl: WebGL2RenderingContext, size = 1024) {
    this.gl = gl;
    this.size = size;

    // Create framebuffer with depth-only attachment
    this.framebuffer = new Framebuffer(gl, size, size);
    this.framebuffer.attachDepth();

    // No color attachment — tell WebGL we're not rendering color
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer.handle);
    gl.drawBuffers([gl.NONE]);
    gl.readBuffer(gl.NONE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    this.framebuffer.checkStatus();

    // Compile the depth-only shader
    this.depthProgram = ShaderProgram.create(gl, shadowVert, shadowFrag);
  }

  /** Get the depth texture to sample in the lighting pass. */
  get depthTexture(): Texture {
    return this.framebuffer.depthTexture!;
  }

  /**
   * Render the scene depth from the light's perspective.
   * @param lightSpaceMatrix  Combined view-projection matrix of the light.
   * @param meshes            Flat list of mesh nodes to render.
   * @param renderer          The renderer (for draw call tracking).
   */
  render(lightSpaceMatrix: Matrix4, meshes: SceneNode[], renderer: Renderer): void {
    const gl = this.gl;

    // Bind shadow FBO
    this.framebuffer.bind();
    gl.clear(gl.DEPTH_BUFFER_BIT);

    // Use depth-only shader
    this.depthProgram.use();
    this.depthProgram.setMat4('u_lightSpaceMatrix', lightSpaceMatrix.data);

    // Use polygon offset to push depth values away, preventing shadow acne
    // without culling front faces (which breaks single-sided geometry like planes)
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(2.0, 2.0);

    for (const node of meshes) {
      const mesh = node as Mesh;
      if (!mesh.visible) continue;

      const vao = mesh.ensureGPUBuffers(gl);
      this.depthProgram.setMat4('u_model', mesh.transform.worldMatrix.data);
      renderer.drawElements(vao);
    }

    // Disable polygon offset
    gl.disable(gl.POLYGON_OFFSET_FILL);

    // Unbind shadow FBO — restore default framebuffer
    this.framebuffer.unbind();
  }

  destroy(): void {
    this.framebuffer.destroy();
    this.depthProgram.destroy();
  }
}
