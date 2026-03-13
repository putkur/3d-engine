import { Geometry } from '../scene/Geometry';
import { VertexBuffer, BufferUsage } from '../renderer/VertexBuffer';
import { IndexBuffer } from '../renderer/IndexBuffer';
import { VertexArray, VertexAttribute } from '../renderer/VertexArray';
import { ShaderProgram } from '../renderer/ShaderProgram';
import { Matrix4 } from '../math/Matrix4';
import { Camera } from '../camera/Camera';

import instancedVert from '../renderer/shaders/instanced.vert';
import instancedFrag from '../renderer/shaders/instanced.frag';

/**
 * Renders many copies of the same geometry efficiently using
 * `gl.drawElementsInstanced()` with per-instance model matrices.
 */
export class InstancedMesh {
  private gl: WebGL2RenderingContext;
  private vao: VertexArray;
  private vbo: VertexBuffer;
  private ibo: IndexBuffer;
  private instanceVBO: VertexBuffer;
  private instanceData: Float32Array;
  private _instanceCount: number;
  private shader: ShaderProgram;
  private indexCount: number;

  // Uniforms
  public color: [number, number, number, number] = [1, 1, 1, 1];
  public lightDir: [number, number, number] = [-0.5, -1, -0.3];
  public lightColor: [number, number, number] = [1, 1, 1];
  public ambientColor: [number, number, number] = [0.15, 0.15, 0.18];

  constructor(gl: WebGL2RenderingContext, geometry: Geometry, maxInstances: number) {
    this.gl = gl;
    this._instanceCount = 0;

    this.shader = ShaderProgram.create(gl, instancedVert, instancedFrag);

    // Build interleaved geometry VBO: position(3) + normal(3) + uv(2)
    const vertCount = geometry.vertexCount;
    const stride = 8; // floats
    const interleaved = new Float32Array(vertCount * stride);
    for (let i = 0; i < vertCount; i++) {
      const off = i * stride;
      interleaved[off] = geometry.positions[i * 3];
      interleaved[off + 1] = geometry.positions[i * 3 + 1];
      interleaved[off + 2] = geometry.positions[i * 3 + 2];
      interleaved[off + 3] = geometry.normals[i * 3];
      interleaved[off + 4] = geometry.normals[i * 3 + 1];
      interleaved[off + 5] = geometry.normals[i * 3 + 2];
      interleaved[off + 6] = geometry.uvs[i * 2];
      interleaved[off + 7] = geometry.uvs[i * 2 + 1];
    }

    this.vbo = new VertexBuffer(gl, interleaved, BufferUsage.STATIC);
    this.ibo = new IndexBuffer(gl, geometry.indices, BufferUsage.STATIC);
    this.indexCount = geometry.indices.length;

    // Instance buffer: 16 floats (mat4) per instance
    this.instanceData = new Float32Array(maxInstances * 16);
    this.instanceVBO = new VertexBuffer(gl, this.instanceData, BufferUsage.DYNAMIC);

    // Set up VAO
    this.vao = new VertexArray(gl);
    const FLOAT = 4;
    const geoStride = stride * FLOAT;

    // Geometry attributes
    this.vao.addVertexBuffer(this.vbo, [
      { location: 0, size: 3, stride: geoStride, offset: 0 },
      { location: 1, size: 3, stride: geoStride, offset: 3 * FLOAT },
      { location: 2, size: 2, stride: geoStride, offset: 6 * FLOAT },
    ]);

    // Instance attributes (mat4 = 4 × vec4)
    const instStride = 16 * FLOAT;
    gl.bindVertexArray(this.vao.handle);
    this.instanceVBO.bind();
    for (let col = 0; col < 4; col++) {
      const loc = 4 + col;
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, instStride, col * 4 * FLOAT);
      gl.vertexAttribDivisor(loc, 1);
    }
    this.instanceVBO.unbind();
    gl.bindVertexArray(null);

    this.vao.setIndexBuffer(this.ibo);
  }

  get instanceCount(): number {
    return this._instanceCount;
  }

  /**
   * Set the model matrices for all instances.
   * @param matrices Array of Matrix4 (one per instance).
   */
  setInstances(matrices: Matrix4[]): void {
    this._instanceCount = matrices.length;
    for (let i = 0; i < matrices.length; i++) {
      this.instanceData.set(matrices[i].data, i * 16);
    }
    this.instanceVBO.update(
      new Float32Array(this.instanceData.buffer, 0, matrices.length * 16),
    );
  }

  /**
   * Update a single instance's model matrix.
   */
  setInstance(index: number, matrix: Matrix4): void {
    this.instanceData.set(matrix.data, index * 16);
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceVBO.handle);
    gl.bufferSubData(gl.ARRAY_BUFFER, index * 16 * 4, matrix.data);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }

  /**
   * Render all instances.
   */
  render(camera: Camera): void {
    if (this._instanceCount === 0) return;
    const gl = this.gl;

    this.shader.use();
    this.shader.setMat4('u_view', camera.viewMatrix.data);
    this.shader.setMat4('u_projection', camera.projectionMatrix.data);
    this.shader.setVec4('u_color', this.color[0], this.color[1], this.color[2], this.color[3]);

    const camPos = camera.transform.worldMatrix.getTranslation();
    this.shader.setVec3('u_viewPos', camPos.x, camPos.y, camPos.z);
    this.shader.setVec3('u_lightDir', this.lightDir[0], this.lightDir[1], this.lightDir[2]);
    this.shader.setVec3('u_lightColor', this.lightColor[0], this.lightColor[1], this.lightColor[2]);
    this.shader.setVec3('u_ambientColor', this.ambientColor[0], this.ambientColor[1], this.ambientColor[2]);

    this.vao.bind();
    gl.drawElementsInstanced(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0, this._instanceCount);
    this.vao.unbind();
  }

  dispose(): void {
    this.vao.destroy();
    this.vbo.destroy();
    this.ibo.destroy();
    this.instanceVBO.destroy();
    this.shader.destroy();
  }
}
