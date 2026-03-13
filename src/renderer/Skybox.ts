import { ShaderProgram } from './ShaderProgram';
import { VertexBuffer, BufferUsage } from './VertexBuffer';
import { IndexBuffer } from './IndexBuffer';
import { VertexArray } from './VertexArray';
import { CubeTexture } from './CubeTexture';
import { Camera } from '../camera/Camera';
import { Matrix4 } from '../math/Matrix4';

import skyboxVert from './shaders/skybox.vert';
import skyboxFrag from './shaders/skybox.frag';

/**
 * Renders a cubemap skybox at infinite distance.
 * Drawn after the scene with depth func = LEQUAL, z forced to max depth.
 */
export class Skybox {
  private gl: WebGL2RenderingContext;
  private shader: ShaderProgram;
  private vao: VertexArray;
  private vbo: VertexBuffer;
  private ibo: IndexBuffer;
  public texture: CubeTexture;

  constructor(gl: WebGL2RenderingContext, texture: CubeTexture) {
    this.gl = gl;
    this.texture = texture;
    this.shader = ShaderProgram.create(gl, skyboxVert, skyboxFrag);

    // Unit cube vertices (inward-facing)
    const positions = new Float32Array([
      -1, -1,  1,
       1, -1,  1,
       1,  1,  1,
      -1,  1,  1,
      -1, -1, -1,
       1, -1, -1,
       1,  1, -1,
      -1,  1, -1,
    ]);

    // Indices for 6 faces (36 indices, facing inward)
    const indices = new Uint16Array([
      // Front
      0, 1, 2,  2, 3, 0,
      // Right
      1, 5, 6,  6, 2, 1,
      // Back
      5, 4, 7,  7, 6, 5,
      // Left
      4, 0, 3,  3, 7, 4,
      // Top
      3, 2, 6,  6, 7, 3,
      // Bottom
      4, 5, 1,  1, 0, 4,
    ]);

    this.vbo = new VertexBuffer(gl, positions, BufferUsage.STATIC);
    this.ibo = new IndexBuffer(gl, indices, BufferUsage.STATIC);
    this.vao = new VertexArray(gl);
    this.vao.addVertexBuffer(this.vbo, [
      { location: 0, size: 3, stride: 0, offset: 0 },
    ]);
    this.vao.setIndexBuffer(this.ibo);
  }

  /**
   * Render the skybox. Call AFTER the main scene render.
   */
  render(camera: Camera): void {
    const gl = this.gl;

    // Remove translation from the view matrix (skybox stays at camera origin)
    const view = camera.viewMatrix;
    const viewNoTranslation = Matrix4.identity();
    const vd = view.data;
    const nd = viewNoTranslation.data;
    // Copy upper-left 3×3 rotation
    nd[0] = vd[0]; nd[1] = vd[1]; nd[2] = vd[2];
    nd[4] = vd[4]; nd[5] = vd[5]; nd[6] = vd[6];
    nd[8] = vd[8]; nd[9] = vd[9]; nd[10] = vd[10];

    const vp = camera.projectionMatrix.multiply(viewNoTranslation);

    // Depth func = LEQUAL so skybox passes at max depth (z=w → NDC z=1)
    gl.depthFunc(gl.LEQUAL);
    gl.disable(gl.CULL_FACE);

    this.shader.use();
    this.shader.setMat4('u_viewProjection', vp.data);

    this.texture.bind(0);
    this.shader.setInt('u_skybox', 0);

    this.vao.bind();
    gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);
    this.vao.unbind();

    gl.depthFunc(gl.LESS);
    gl.enable(gl.CULL_FACE);
  }

  dispose(): void {
    this.vao.destroy();
    this.vbo.destroy();
    this.ibo.destroy();
    this.shader.destroy();
  }
}
