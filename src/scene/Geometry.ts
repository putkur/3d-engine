import { vec3 } from 'gl-matrix';

export interface GeometryData {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: Uint16Array | Uint32Array;
  tangents?: Float32Array;
}

/**
 * Holds vertex data: positions, normals, uvs, tangents, indices.
 * Provides built-in generators for common primitives.
 */
export class Geometry {
  public positions: Float32Array;
  public normals: Float32Array;
  public uvs: Float32Array;
  public indices: Uint16Array | Uint32Array;
  public tangents: Float32Array | null = null;

  public vertexCount: number;
  public indexCount: number;

  constructor(data: GeometryData) {
    this.positions = data.positions;
    this.normals = data.normals;
    this.uvs = data.uvs;
    this.indices = data.indices;
    this.tangents = data.tangents ?? null;

    this.vertexCount = data.positions.length / 3;
    this.indexCount = data.indices.length;
  }

  /**
   * Compute flat normals from triangle faces, overwriting existing normals.
   */
  computeNormals(): void {
    const pos = this.positions;
    const idx = this.indices;
    const normals = new Float32Array(pos.length);

    const a = vec3.create();
    const b = vec3.create();
    const c = vec3.create();
    const cb = vec3.create();
    const ab = vec3.create();

    for (let i = 0; i < idx.length; i += 3) {
      const i0 = idx[i] * 3;
      const i1 = idx[i + 1] * 3;
      const i2 = idx[i + 2] * 3;

      vec3.set(a, pos[i0], pos[i0 + 1], pos[i0 + 2]);
      vec3.set(b, pos[i1], pos[i1 + 1], pos[i1 + 2]);
      vec3.set(c, pos[i2], pos[i2 + 1], pos[i2 + 2]);

      vec3.subtract(cb, c, b);
      vec3.subtract(ab, a, b);
      vec3.cross(cb, cb, ab);

      normals[i0] += cb[0]; normals[i0 + 1] += cb[1]; normals[i0 + 2] += cb[2];
      normals[i1] += cb[0]; normals[i1 + 1] += cb[1]; normals[i1 + 2] += cb[2];
      normals[i2] += cb[0]; normals[i2 + 1] += cb[1]; normals[i2 + 2] += cb[2];
    }

    // Normalize
    for (let i = 0; i < normals.length; i += 3) {
      vec3.set(a, normals[i], normals[i + 1], normals[i + 2]);
      vec3.normalize(a, a);
      normals[i] = a[0]; normals[i + 1] = a[1]; normals[i + 2] = a[2];
    }

    this.normals = normals;
  }

  /**
   * Compute tangents using the MikkTSpace-like approach for normal mapping.
   */
  computeTangents(): void {
    const pos = this.positions;
    const nrm = this.normals;
    const uv = this.uvs;
    const idx = this.indices;
    const tangents = new Float32Array((pos.length / 3) * 4);

    const tan1 = new Float32Array(pos.length);
    const tan2 = new Float32Array(pos.length);

    for (let i = 0; i < idx.length; i += 3) {
      const i0 = idx[i], i1 = idx[i + 1], i2 = idx[i + 2];

      const x1 = pos[i1 * 3] - pos[i0 * 3];
      const y1 = pos[i1 * 3 + 1] - pos[i0 * 3 + 1];
      const z1 = pos[i1 * 3 + 2] - pos[i0 * 3 + 2];

      const x2 = pos[i2 * 3] - pos[i0 * 3];
      const y2 = pos[i2 * 3 + 1] - pos[i0 * 3 + 1];
      const z2 = pos[i2 * 3 + 2] - pos[i0 * 3 + 2];

      const s1 = uv[i1 * 2] - uv[i0 * 2];
      const t1 = uv[i1 * 2 + 1] - uv[i0 * 2 + 1];
      const s2 = uv[i2 * 2] - uv[i0 * 2];
      const t2 = uv[i2 * 2 + 1] - uv[i0 * 2 + 1];

      const denom = s1 * t2 - s2 * t1;
      const r = denom !== 0 ? 1.0 / denom : 0.0;

      const sx = (t2 * x1 - t1 * x2) * r;
      const sy = (t2 * y1 - t1 * y2) * r;
      const sz = (t2 * z1 - t1 * z2) * r;

      const tx = (s1 * x2 - s2 * x1) * r;
      const ty = (s1 * y2 - s2 * y1) * r;
      const tz = (s1 * z2 - s2 * z1) * r;

      for (const vi of [i0, i1, i2]) {
        tan1[vi * 3] += sx; tan1[vi * 3 + 1] += sy; tan1[vi * 3 + 2] += sz;
        tan2[vi * 3] += tx; tan2[vi * 3 + 1] += ty; tan2[vi * 3 + 2] += tz;
      }
    }

    const n = vec3.create();
    const t = vec3.create();
    const tmp = vec3.create();
    const vertCount = pos.length / 3;

    for (let i = 0; i < vertCount; i++) {
      vec3.set(n, nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]);
      vec3.set(t, tan1[i * 3], tan1[i * 3 + 1], tan1[i * 3 + 2]);

      // Gram-Schmidt orthogonalize: tangent = normalize(t - n * dot(n, t))
      const d = vec3.dot(n, t);
      vec3.scale(tmp, n, d);
      vec3.subtract(tmp, t, tmp);
      vec3.normalize(tmp, tmp);

      tangents[i * 4] = tmp[0];
      tangents[i * 4 + 1] = tmp[1];
      tangents[i * 4 + 2] = tmp[2];

      // Handedness
      vec3.cross(tmp, n, t);
      tangents[i * 4 + 3] = vec3.dot(tmp, vec3.fromValues(tan2[i * 3], tan2[i * 3 + 1], tan2[i * 3 + 2])) < 0 ? -1 : 1;
    }

    this.tangents = tangents;
  }

  // =====================================================================
  // Built-in primitive generators
  // =====================================================================

  /**
   * Create a unit box centered at the origin.
   * @param width  Size along X (default 1)
   * @param height Size along Y (default 1)
   * @param depth  Size along Z (default 1)
   */
  static createBox(width = 1, height = 1, depth = 1): Geometry {
    const w = width / 2, h = height / 2, d = depth / 2;

    // Each face has its own vertices (for separate normals)
    // prettier-ignore
    const positions = new Float32Array([
      // Front face (+Z)
      -w, -h,  d,   w, -h,  d,   w,  h,  d,  -w,  h,  d,
      // Back face (-Z)
       w, -h, -d,  -w, -h, -d,  -w,  h, -d,   w,  h, -d,
      // Top face (+Y)
      -w,  h,  d,   w,  h,  d,   w,  h, -d,  -w,  h, -d,
      // Bottom face (-Y)
      -w, -h, -d,   w, -h, -d,   w, -h,  d,  -w, -h,  d,
      // Right face (+X)
       w, -h,  d,   w, -h, -d,   w,  h, -d,   w,  h,  d,
      // Left face (-X)
      -w, -h, -d,  -w, -h,  d,  -w,  h,  d,  -w,  h, -d,
    ]);

    // prettier-ignore
    const normals = new Float32Array([
       0,  0,  1,   0,  0,  1,   0,  0,  1,   0,  0,  1,
       0,  0, -1,   0,  0, -1,   0,  0, -1,   0,  0, -1,
       0,  1,  0,   0,  1,  0,   0,  1,  0,   0,  1,  0,
       0, -1,  0,   0, -1,  0,   0, -1,  0,   0, -1,  0,
       1,  0,  0,   1,  0,  0,   1,  0,  0,   1,  0,  0,
      -1,  0,  0,  -1,  0,  0,  -1,  0,  0,  -1,  0,  0,
    ]);

    // prettier-ignore
    const uvs = new Float32Array([
      0, 0,  1, 0,  1, 1,  0, 1,
      0, 0,  1, 0,  1, 1,  0, 1,
      0, 0,  1, 0,  1, 1,  0, 1,
      0, 0,  1, 0,  1, 1,  0, 1,
      0, 0,  1, 0,  1, 1,  0, 1,
      0, 0,  1, 0,  1, 1,  0, 1,
    ]);

    // Two triangles per face, 6 faces = 36 indices
    // prettier-ignore
    const indices = new Uint16Array([
       0,  1,  2,   0,  2,  3,  // front
       4,  5,  6,   4,  6,  7,  // back
       8,  9, 10,   8, 10, 11,  // top
      12, 13, 14,  12, 14, 15,  // bottom
      16, 17, 18,  16, 18, 19,  // right
      20, 21, 22,  20, 22, 23,  // left
    ]);

    return new Geometry({ positions, normals, uvs, indices });
  }

  /**
   * Create a UV sphere.
   * @param radius      Sphere radius (default 0.5)
   * @param widthSegs   Horizontal segments (default 32)
   * @param heightSegs  Vertical segments (default 16)
   */
  static createSphere(radius = 0.5, widthSegs = 32, heightSegs = 16): Geometry {
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let y = 0; y <= heightSegs; y++) {
      const v = y / heightSegs;
      const phi = v * Math.PI;

      for (let x = 0; x <= widthSegs; x++) {
        const u = x / widthSegs;
        const theta = u * Math.PI * 2;

        const nx = -Math.cos(theta) * Math.sin(phi);
        const ny = Math.cos(phi);
        const nz = Math.sin(theta) * Math.sin(phi);

        positions.push(radius * nx, radius * ny, radius * nz);
        normals.push(nx, ny, nz);
        uvs.push(u, 1 - v);
      }
    }

    for (let y = 0; y < heightSegs; y++) {
      for (let x = 0; x < widthSegs; x++) {
        const a = y * (widthSegs + 1) + x;
        const b = a + widthSegs + 1;

        indices.push(a, b, a + 1);
        indices.push(b, b + 1, a + 1);
      }
    }

    const useU32 = positions.length / 3 > 65535;
    return new Geometry({
      positions: new Float32Array(positions),
      normals: new Float32Array(normals),
      uvs: new Float32Array(uvs),
      indices: useU32 ? new Uint32Array(indices) : new Uint16Array(indices),
    });
  }

  /**
   * Create a plane on the XZ plane (facing +Y).
   * @param width   Size along X (default 1)
   * @param height  Size along Z (default 1)
   * @param widthSegs  Segments along X (default 1)
   * @param heightSegs Segments along Z (default 1)
   */
  static createPlane(width = 1, height = 1, widthSegs = 1, heightSegs = 1): Geometry {
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    const halfW = width / 2;
    const halfH = height / 2;

    for (let iz = 0; iz <= heightSegs; iz++) {
      const v = iz / heightSegs;
      const z = v * height - halfH;

      for (let ix = 0; ix <= widthSegs; ix++) {
        const u = ix / widthSegs;
        const x = u * width - halfW;

        positions.push(x, 0, z);
        normals.push(0, 1, 0);
        uvs.push(u, 1 - v);
      }
    }

    for (let iz = 0; iz < heightSegs; iz++) {
      for (let ix = 0; ix < widthSegs; ix++) {
        const a = iz * (widthSegs + 1) + ix;
        const b = a + widthSegs + 1;

        indices.push(a, b, a + 1);
        indices.push(b, b + 1, a + 1);
      }
    }

    return new Geometry({
      positions: new Float32Array(positions),
      normals: new Float32Array(normals),
      uvs: new Float32Array(uvs),
      indices: new Uint16Array(indices),
    });
  }

  /**
   * Create a cylinder along the Y axis.
   * @param radiusTop    Top radius (default 0.5)
   * @param radiusBottom Bottom radius (default 0.5)
   * @param height       Height (default 1)
   * @param radialSegs   Segments around circumference (default 32)
   * @param heightSegs   Segments along height (default 1)
   */
  static createCylinder(
    radiusTop = 0.5,
    radiusBottom = 0.5,
    height = 1,
    radialSegs = 32,
    heightSegs = 1,
  ): Geometry {
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    const halfH = height / 2;
    const slope = (radiusBottom - radiusTop) / height;

    // Side
    for (let iy = 0; iy <= heightSegs; iy++) {
      const v = iy / heightSegs;
      const y = v * height - halfH;
      const radius = v * (radiusBottom - radiusTop) + radiusTop;

      for (let ix = 0; ix <= radialSegs; ix++) {
        const u = ix / radialSegs;
        const theta = u * Math.PI * 2;

        const cos = Math.cos(theta);
        const sin = Math.sin(theta);

        positions.push(radius * cos, y, radius * sin);

        // Normal for cylinder side: perpendicular to surface
        const nx = cos;
        const nz = sin;
        const ny = slope;
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        normals.push(nx / len, ny / len, nz / len);

        uvs.push(u, 1 - v);
      }
    }

    for (let iy = 0; iy < heightSegs; iy++) {
      for (let ix = 0; ix < radialSegs; ix++) {
        const a = iy * (radialSegs + 1) + ix;
        const b = a + radialSegs + 1;
        indices.push(a, b, a + 1);
        indices.push(b, b + 1, a + 1);
      }
    }

    // Top cap
    const topCenterIdx = positions.length / 3;
    positions.push(0, halfH, 0);
    normals.push(0, 1, 0);
    uvs.push(0.5, 0.5);

    for (let ix = 0; ix <= radialSegs; ix++) {
      const u = ix / radialSegs;
      const theta = u * Math.PI * 2;
      positions.push(radiusTop * Math.cos(theta), halfH, radiusTop * Math.sin(theta));
      normals.push(0, 1, 0);
      uvs.push(Math.cos(theta) * 0.5 + 0.5, Math.sin(theta) * 0.5 + 0.5);
    }

    for (let ix = 0; ix < radialSegs; ix++) {
      indices.push(topCenterIdx, topCenterIdx + ix + 1, topCenterIdx + ix + 2);
    }

    // Bottom cap
    const botCenterIdx = positions.length / 3;
    positions.push(0, -halfH, 0);
    normals.push(0, -1, 0);
    uvs.push(0.5, 0.5);

    for (let ix = 0; ix <= radialSegs; ix++) {
      const u = ix / radialSegs;
      const theta = u * Math.PI * 2;
      positions.push(radiusBottom * Math.cos(theta), -halfH, radiusBottom * Math.sin(theta));
      normals.push(0, -1, 0);
      uvs.push(Math.cos(theta) * 0.5 + 0.5, Math.sin(theta) * 0.5 + 0.5);
    }

    for (let ix = 0; ix < radialSegs; ix++) {
      indices.push(botCenterIdx, botCenterIdx + ix + 2, botCenterIdx + ix + 1);
    }

    const useU32 = positions.length / 3 > 65535;
    return new Geometry({
      positions: new Float32Array(positions),
      normals: new Float32Array(normals),
      uvs: new Float32Array(uvs),
      indices: useU32 ? new Uint32Array(indices) : new Uint16Array(indices),
    });
  }
}
