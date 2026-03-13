import { SceneNode } from './SceneNode';
import { Geometry } from './Geometry';
import { Material } from './Material';
import { VertexBuffer, BufferUsage } from '../renderer/VertexBuffer';
import { IndexBuffer } from '../renderer/IndexBuffer';
import { VertexArray, VertexAttribute } from '../renderer/VertexArray';

/**
 * A renderable scene node that combines Geometry + Material.
 * Uploads geometry to GPU buffers on first render (lazy init).
 */
export class Mesh extends SceneNode {
  /** Type tag used by Scene for categorization. */
  public readonly isMesh = true;

  public geometry: Geometry;
  public material: Material;

  // GPU resources (created lazily)
  protected vao: VertexArray | null = null;
  protected vbo: VertexBuffer | null = null;
  protected ibo: IndexBuffer | null = null;
  protected gpuDirty = true;

  constructor(geometry: Geometry, material: Material, name = '') {
    super(name);
    this.geometry = geometry;
    this.material = material;
  }

  /** Mark GPU buffers as needing re-upload (e.g. after geometry change). */
  markGPUDirty(): void {
    this.gpuDirty = true;
  }

  /**
   * Ensure GPU buffers exist and are up to date.
   * Called by the renderer before drawing.
   */
  ensureGPUBuffers(gl: WebGL2RenderingContext): VertexArray {
    if (this.vao && !this.gpuDirty) {
      return this.vao;
    }

    // Clean up old resources
    this.destroyGPUResources();

    const geo = this.geometry;

    // Build interleaved buffer: position(3) + normal(3) + uv(2) [+ tangent(4)]
    const hasTangents = geo.tangents !== null;
    const vertexSize = hasTangents ? 12 : 8; // floats per vertex
    const vertCount = geo.vertexCount;
    const interleaved = new Float32Array(vertCount * vertexSize);

    for (let i = 0; i < vertCount; i++) {
      const off = i * vertexSize;
      // position
      interleaved[off] = geo.positions[i * 3];
      interleaved[off + 1] = geo.positions[i * 3 + 1];
      interleaved[off + 2] = geo.positions[i * 3 + 2];
      // normal
      interleaved[off + 3] = geo.normals[i * 3];
      interleaved[off + 4] = geo.normals[i * 3 + 1];
      interleaved[off + 5] = geo.normals[i * 3 + 2];
      // uv
      interleaved[off + 6] = geo.uvs[i * 2];
      interleaved[off + 7] = geo.uvs[i * 2 + 1];
      // tangent
      if (hasTangents && geo.tangents) {
        interleaved[off + 8] = geo.tangents[i * 4];
        interleaved[off + 9] = geo.tangents[i * 4 + 1];
        interleaved[off + 10] = geo.tangents[i * 4 + 2];
        interleaved[off + 11] = geo.tangents[i * 4 + 3];
      }
    }

    const FLOAT = 4;
    const stride = vertexSize * FLOAT;

    this.vbo = new VertexBuffer(gl, interleaved, BufferUsage.STATIC);
    this.ibo = new IndexBuffer(gl, geo.indices, BufferUsage.STATIC);
    this.vao = new VertexArray(gl);

    const attributes: VertexAttribute[] = [
      { location: 0, size: 3, stride, offset: 0 },                 // a_position
      { location: 1, size: 3, stride, offset: 3 * FLOAT },         // a_normal
      { location: 2, size: 2, stride, offset: 6 * FLOAT },         // a_uv
    ];

    if (hasTangents) {
      attributes.push({ location: 3, size: 4, stride, offset: 8 * FLOAT }); // a_tangent
    }

    this.vao.addVertexBuffer(this.vbo, attributes);
    this.vao.setIndexBuffer(this.ibo);

    this.gpuDirty = false;
    return this.vao;
  }

  /** Get the VAO (returns null if GPU buffers haven't been created yet). */
  getVAO(): VertexArray | null {
    return this.vao;
  }

  /**
   * World-space bounding sphere for this mesh.
   * Used by Frustum and BVH for visibility tests.
   * The sphere is centred on the mesh's world-space origin and scaled by the
   * largest uniform scale factor extracted from the world matrix.
   */
  getWorldBoundingSphere(): { cx: number; cy: number; cz: number; radius: number } {
    this.geometry.computeBounds();
    const d = this.transform.worldMatrix.data;
    const cx = d[12], cy = d[13], cz = d[14];
    const sx = Math.sqrt(d[0] * d[0] + d[1] * d[1] + d[2] * d[2]);
    const sy = Math.sqrt(d[4] * d[4] + d[5] * d[5] + d[6] * d[6]);
    const sz = Math.sqrt(d[8] * d[8] + d[9] * d[9] + d[10] * d[10]);
    const maxScale = Math.max(sx, sy, sz);
    return { cx, cy, cz, radius: this.geometry.boundingSphereRadius * maxScale };
  }

  /**
   * World-space AABB for BVH construction and refitting.
   * Transforms all 8 corners of the local AABB by the world matrix and
   * returns the enclosing axis-aligned box.
   */
  getWorldBVHBounds(): { minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number } {
    this.geometry.computeBounds();
    const d  = this.transform.worldMatrix.data;
    const lx0 = this.geometry.localMinX, lx1 = this.geometry.localMaxX;
    const ly0 = this.geometry.localMinY, ly1 = this.geometry.localMaxY;
    const lz0 = this.geometry.localMinZ, lz1 = this.geometry.localMaxZ;
    let minX =  Infinity, minY =  Infinity, minZ =  Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (let xi = 0; xi < 2; xi++) {
      for (let yi = 0; yi < 2; yi++) {
        for (let zi = 0; zi < 2; zi++) {
          const lx = xi === 0 ? lx0 : lx1;
          const ly = yi === 0 ? ly0 : ly1;
          const lz = zi === 0 ? lz0 : lz1;
          const wx = d[0] * lx + d[4] * ly + d[8]  * lz + d[12];
          const wy = d[1] * lx + d[5] * ly + d[9]  * lz + d[13];
          const wz = d[2] * lx + d[6] * ly + d[10] * lz + d[14];
          if (wx < minX) minX = wx; if (wx > maxX) maxX = wx;
          if (wy < minY) minY = wy; if (wy > maxY) maxY = wy;
          if (wz < minZ) minZ = wz; if (wz > maxZ) maxZ = wz;
        }
      }
    }
    return { minX, minY, minZ, maxX, maxY, maxZ };
  }

  /** Release GPU resources. */
  destroyGPUResources(): void {
    if (this.vao) { this.vao.destroy(); this.vao = null; }
    if (this.vbo) { this.vbo.destroy(); this.vbo = null; }
    if (this.ibo) { this.ibo.destroy(); this.ibo = null; }
  }
}
