import { Mesh } from '../scene/Mesh';
import { Geometry } from '../scene/Geometry';
import { Material } from '../scene/Material';
import { Skeleton } from './Skeleton';
import { VertexBuffer, BufferUsage } from '../renderer/VertexBuffer';
import { IndexBuffer } from '../renderer/IndexBuffer';
import { VertexArray } from '../renderer/VertexArray';

/**
 * A Mesh that carries a Skeleton and per-vertex skinning data (joints + weights).
 *
 * Skinning is performed in the vertex shader (GPU skinning):
 *  - layout(location=4) in uvec4 a_joints  — indices into the joint palette
 *  - layout(location=5) in vec4  a_weights — per-joint blend weights (sum≈1)
 *
 * The skinned shader is selected automatically when `skeleton` is non-null.
 * Falls back to the regular phong render path otherwise.
 */
export class SkinnedMesh extends Mesh {
  public skeleton: Skeleton | null = null;

  /** JOINTS_0 accessor — 4 joint indices per vertex (Uint8 or Uint16: stored as float for upload). */
  public jointsData:  Float32Array | null = null;
  /** WEIGHTS_0 accessor — 4 blend weights per vertex. */
  public weightsData: Float32Array | null = null;

  // Additional GPU buffers for skin data
  private jointsVBO:  VertexBuffer | null = null;
  private weightsVBO: VertexBuffer | null = null;
  private skinnedVAO: VertexArray  | null = null;
  private skinnedVAODirty = true;

  constructor(geometry: Geometry, material: Material, name = '') {
    super(geometry, material, name);
  }

  /**
   * Build (or rebuild) a VAO that includes the base mesh attributes
   * (position, normal, uv) plus the skinning attributes (joints, weights).
   *
   * Returns the skinning VAO when skinning data is available, otherwise
   * falls back to the base VAO from Mesh.ensureGPUBuffers().
   */
  ensureSkinVAO(gl: WebGL2RenderingContext): VertexArray {
    // If no skinning data, use the normal path
    if (!this.jointsData || !this.weightsData) {
      return this.ensureGPUBuffers(gl);
    }

    // Re-use base VAO — we'll rebuild only the skinning VBOs
    const baseVAO = this.ensureGPUBuffers(gl);

    if (!this.skinnedVAODirty && this.skinnedVAO) {
      return this.skinnedVAO;
    }

    // Destroy old skinning buffers
    this.jointsVBO?.destroy();
    this.weightsVBO?.destroy();
    this.skinnedVAO?.destroy();

    // Upload joints and weights as separate VBOs
    this.jointsVBO  = new VertexBuffer(gl, this.jointsData,  BufferUsage.STATIC);
    this.weightsVBO = new VertexBuffer(gl, this.weightsData, BufferUsage.STATIC);

    // Create a new VAO that also binds the skinning attributes.
    // We copy the base VAO bindings by re-running ensureGPUBuffers (already done above)
    // and then add the skin buffers.
    const FLOAT = 4;
    const vao = new VertexArray(gl);
    const ibo = baseVAO.getIndexBuffer();
    if (ibo) vao.setIndexBuffer(ibo);

    // Bind base attributes through the existing base VBO
    // (We replicate the layout from Mesh.ensureGPUBuffers):
    const geo = this.geometry;
    const hasTangents = geo.tangents !== null;
    const vertexSize = hasTangents ? 12 : 8;
    const stride = vertexSize * FLOAT;

    // We need to pull the base VBO handle out — since Mesh keeps vbo private
    // we re-upload (already in GPU, this is a quick path via the base ensureGPUBuffers).
    // Actually, a cleaner approach: build the combined VAO from scratch.
    // We re-create the interleaved base buffer part via Mesh.ensureGPUBuffers and
    // track the extra attribs on top.

    // Add joints at location 4: 4 floats per vertex (uvec4 uploaded as float)
    vao.addVertexBuffer(this.jointsVBO, [
      { location: 4, size: 4, type: gl.FLOAT, stride: 0, offset: 0 },
    ]);
    // Add weights at location 5: 4 floats per vertex
    vao.addVertexBuffer(this.weightsVBO, [
      { location: 5, size: 4, stride: 0, offset: 0 },
    ]);

    // For the base geometry we borrow from the base VAO's VBO.
    // Since we can't easily extract VBO from Mesh (it's private), use a different
    // strategy: re-create the interleaved base data and attach it to the new vao.
    const vertCount = geo.vertexCount;
    const interleaved = new Float32Array(vertCount * vertexSize);
    for (let i = 0; i < vertCount; i++) {
      const off = i * vertexSize;
      interleaved[off]   = geo.positions[i * 3];
      interleaved[off+1] = geo.positions[i * 3 + 1];
      interleaved[off+2] = geo.positions[i * 3 + 2];
      interleaved[off+3] = geo.normals[i * 3];
      interleaved[off+4] = geo.normals[i * 3 + 1];
      interleaved[off+5] = geo.normals[i * 3 + 2];
      interleaved[off+6] = geo.uvs[i * 2];
      interleaved[off+7] = geo.uvs[i * 2 + 1];
      if (hasTangents && geo.tangents) {
        interleaved[off+8]  = geo.tangents[i * 4];
        interleaved[off+9]  = geo.tangents[i * 4 + 1];
        interleaved[off+10] = geo.tangents[i * 4 + 2];
        interleaved[off+11] = geo.tangents[i * 4 + 3];
      }
    }

    const baseVBO = new VertexBuffer(gl, interleaved, BufferUsage.STATIC);
    const baseAttribs = [
      { location: 0, size: 3, stride, offset: 0 },
      { location: 1, size: 3, stride, offset: 3 * FLOAT },
      { location: 2, size: 2, stride, offset: 6 * FLOAT },
    ];
    if (hasTangents) {
      baseAttribs.push({ location: 3, size: 4, stride, offset: 8 * FLOAT });
    }
    vao.addVertexBuffer(baseVBO, baseAttribs);

    // Index buffer
    const newIBO = new IndexBuffer(gl, geo.indices, BufferUsage.STATIC);
    vao.setIndexBuffer(newIBO);

    this.skinnedVAO = vao;
    this.skinnedVAODirty = false;
    return vao;
  }

  /** Upload the joint palette to the currently-bound shader. */
  uploadSkeleton(gl: WebGL2RenderingContext): void {
    if (!this.skeleton) return;
    this.skeleton.update();
    // The caller (render loop) is responsible for setting u_jointMatrices.
    // Expose the palette so the renderer can upload it.
  }

  override markGPUDirty(): void {
    super.markGPUDirty();
    this.skinnedVAODirty = true;
  }
}
