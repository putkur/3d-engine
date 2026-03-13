import { Mesh } from '../scene/Mesh';
import { Geometry } from '../scene/Geometry';
import { Material } from '../scene/Material';
import { Skeleton } from './Skeleton';
import { VertexBuffer, BufferUsage } from '../renderer/VertexBuffer';
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
   * Reuses the base VBO/IBO created by Mesh.ensureGPUBuffers() and adds
   * separate VBOs for joints (location 4) and weights (location 5).
   *
   * Returns the skinning VAO when skinning data is available, otherwise
   * falls back to the base VAO from Mesh.ensureGPUBuffers().
   */
  ensureSkinVAO(gl: WebGL2RenderingContext): VertexArray {
    // If no skinning data, use the normal path
    if (!this.jointsData || !this.weightsData) {
      return this.ensureGPUBuffers(gl);
    }

    // Ensure base VBO/IBO exist (created lazily by parent)
    this.ensureGPUBuffers(gl);

    if (!this.skinnedVAODirty && this.skinnedVAO) {
      return this.skinnedVAO;
    }

    // Destroy old skinning-specific resources
    this.jointsVBO?.destroy();
    this.weightsVBO?.destroy();
    this.skinnedVAO?.destroy();

    // Upload joints and weights as separate VBOs
    this.jointsVBO  = new VertexBuffer(gl, this.jointsData,  BufferUsage.STATIC);
    this.weightsVBO = new VertexBuffer(gl, this.weightsData, BufferUsage.STATIC);

    // Build a new VAO that combines the base VBO with the skin VBOs
    const FLOAT = 4;
    const geo = this.geometry;
    const hasTangents = geo.tangents !== null;
    const vertexSize = hasTangents ? 12 : 8;
    const stride = vertexSize * FLOAT;

    const vao = new VertexArray(gl);

    // Reuse the base VBO (already uploaded by ensureGPUBuffers)
    const baseAttribs = [
      { location: 0, size: 3, stride, offset: 0 },
      { location: 1, size: 3, stride, offset: 3 * FLOAT },
      { location: 2, size: 2, stride, offset: 6 * FLOAT },
    ];
    if (hasTangents) {
      baseAttribs.push({ location: 3, size: 4, stride, offset: 8 * FLOAT });
    }
    vao.addVertexBuffer(this.vbo!, baseAttribs);

    // Add joints at location 4: 4 floats per vertex
    vao.addVertexBuffer(this.jointsVBO, [
      { location: 4, size: 4, type: gl.FLOAT, stride: 0, offset: 0 },
    ]);
    // Add weights at location 5: 4 floats per vertex
    vao.addVertexBuffer(this.weightsVBO, [
      { location: 5, size: 4, stride: 0, offset: 0 },
    ]);

    // Reuse the base IBO
    vao.setIndexBuffer(this.ibo!);

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

  /** Release all skinning-specific GPU resources. */
  destroySkinResources(): void {
    this.jointsVBO?.destroy();
    this.weightsVBO?.destroy();
    this.skinnedVAO?.destroy();
    this.jointsVBO = null;
    this.weightsVBO = null;
    this.skinnedVAO = null;
    this.skinnedVAODirty = true;
  }

  override destroyGPUResources(): void {
    this.destroySkinResources();
    super.destroyGPUResources();
  }
}
