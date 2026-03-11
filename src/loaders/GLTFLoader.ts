import { Geometry, GeometryData } from '../scene/Geometry';
import { Material } from '../scene/Material';
import { Mesh } from '../scene/Mesh';
import { SceneNode } from '../scene/SceneNode';
import { ShaderProgram } from '../renderer/ShaderProgram';
import { Texture, TextureFilter, TextureWrap, TextureOptions } from '../renderer/Texture';

// ---------------------------------------------------------------
// glTF 2.0 JSON Schema types (subset needed for loading)
// ---------------------------------------------------------------

interface GLTFJson {
  asset: { version: string };
  scene?: number;
  scenes?: GLTFScene[];
  nodes?: GLTFNode[];
  meshes?: GLTFMesh[];
  accessors?: GLTFAccessor[];
  bufferViews?: GLTFBufferView[];
  buffers?: GLTFBuffer[];
  materials?: GLTFMaterial[];
  textures?: GLTFTextureInfo[];
  images?: GLTFImage[];
  samplers?: GLTFSampler[];
}

interface GLTFScene { nodes?: number[]; name?: string; }

interface GLTFNode {
  name?: string;
  mesh?: number;
  children?: number[];
  translation?: [number, number, number];
  rotation?: [number, number, number, number];
  scale?: [number, number, number];
  matrix?: number[];
}

interface GLTFMesh {
  name?: string;
  primitives: GLTFPrimitive[];
}

interface GLTFPrimitive {
  attributes: Record<string, number>;
  indices?: number;
  material?: number;
  mode?: number; // 4 = TRIANGLES (default)
}

interface GLTFAccessor {
  bufferView?: number;
  byteOffset?: number;
  componentType: number;
  count: number;
  type: string;
  min?: number[];
  max?: number[];
}

interface GLTFBufferView {
  buffer: number;
  byteOffset?: number;
  byteLength: number;
  byteStride?: number;
  target?: number;
}

interface GLTFBuffer {
  uri?: string;
  byteLength: number;
}

interface GLTFMaterial {
  name?: string;
  pbrMetallicRoughness?: {
    baseColorFactor?: [number, number, number, number];
    baseColorTexture?: { index: number; texCoord?: number };
    metallicFactor?: number;
    roughnessFactor?: number;
  };
  normalTexture?: { index: number; texCoord?: number; scale?: number };
  doubleSided?: boolean;
  alphaMode?: string;
}

interface GLTFTextureInfo {
  source?: number;
  sampler?: number;
}

interface GLTFImage {
  uri?: string;
  mimeType?: string;
  bufferView?: number;
}

interface GLTFSampler {
  magFilter?: number;
  minFilter?: number;
  wrapS?: number;
  wrapT?: number;
}

// glTF component type constants
const GL_BYTE = 5120;
const GL_UNSIGNED_BYTE = 5121;
const GL_SHORT = 5122;
const GL_UNSIGNED_SHORT = 5123;
const GL_UNSIGNED_INT = 5125;
const GL_FLOAT = 5126;

// glTF type → element count
const TYPE_SIZES: Record<string, number> = {
  SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16,
};

/**
 * glTF 2.0 loader.
 * Supports .gltf (JSON + separate binaries) and .glb (single binary) formats.
 */
export class GLTFLoader {
  private gl: WebGL2RenderingContext;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
  }

  /**
   * Load a glTF/glb file and return a SceneNode hierarchy with Mesh children.
   */
  async load(url: string, defaultShader: ShaderProgram): Promise<SceneNode> {
    const isGLB = url.toLowerCase().endsWith('.glb');
    const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);

    let json: GLTFJson;
    let binaryChunk: ArrayBuffer | null = null;

    if (isGLB) {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to load GLB: ${url} (${response.status})`);
      const arrayBuffer = await response.arrayBuffer();
      const parsed = this.parseGLB(arrayBuffer);
      json = parsed.json;
      binaryChunk = parsed.binary;
    } else {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to load glTF: ${url} (${response.status})`);
      json = await response.json() as GLTFJson;
    }

    // Validate version
    const version = json.asset?.version ?? '0';
    if (!version.startsWith('2')) {
      throw new Error(`Unsupported glTF version: ${version}`);
    }

    // Load all buffers
    const buffers = await this.loadBuffers(json, baseUrl, binaryChunk);

    // Load textures
    const textures = await this.loadTextures(json, baseUrl, buffers);

    // Build materials
    const materials = this.buildMaterials(json, defaultShader, textures);

    // Build scene graph
    const sceneIndex = json.scene ?? 0;
    const scene = json.scenes?.[sceneIndex];
    const root = new SceneNode(scene?.name ?? 'glTF_Root');

    if (scene?.nodes) {
      for (const nodeIdx of scene.nodes) {
        const child = this.buildNode(json, nodeIdx, buffers, materials, defaultShader);
        if (child) root.add(child);
      }
    }

    return root;
  }

  // ---------------------------------------------------------------
  // GLB parsing
  // ---------------------------------------------------------------

  private parseGLB(buffer: ArrayBuffer): { json: GLTFJson; binary: ArrayBuffer | null } {
    const view = new DataView(buffer);

    // Header: magic (4), version (4), length (4)
    const magic = view.getUint32(0, true);
    if (magic !== 0x46546C67) { // 'glTF'
      throw new Error('Invalid GLB magic number');
    }

    let offset = 12; // skip header
    let json: GLTFJson | null = null;
    let binary: ArrayBuffer | null = null;

    while (offset < buffer.byteLength) {
      const chunkLength = view.getUint32(offset, true);
      const chunkType = view.getUint32(offset + 4, true);
      offset += 8;

      if (chunkType === 0x4E4F534A) { // 'JSON'
        const decoder = new TextDecoder();
        const jsonText = decoder.decode(new Uint8Array(buffer, offset, chunkLength));
        json = JSON.parse(jsonText) as GLTFJson;
      } else if (chunkType === 0x004E4942) { // 'BIN\0'
        binary = buffer.slice(offset, offset + chunkLength);
      }

      offset += chunkLength;
    }

    if (!json) throw new Error('GLB file has no JSON chunk');
    return { json, binary };
  }

  // ---------------------------------------------------------------
  // Buffer loading
  // ---------------------------------------------------------------

  private async loadBuffers(
    json: GLTFJson, baseUrl: string, binaryChunk: ArrayBuffer | null,
  ): Promise<ArrayBuffer[]> {
    const bufferDefs = json.buffers ?? [];
    const buffers: ArrayBuffer[] = [];

    for (let i = 0; i < bufferDefs.length; i++) {
      const def = bufferDefs[i];
      if (!def.uri) {
        // GLB binary chunk (buffer 0 with no URI)
        if (binaryChunk) {
          buffers.push(binaryChunk);
        } else {
          throw new Error(`Buffer ${i} has no URI and no binary chunk`);
        }
      } else if (def.uri.startsWith('data:')) {
        // Data URI
        buffers.push(this.decodeDataURI(def.uri));
      } else {
        // External file
        const resp = await fetch(baseUrl + def.uri);
        if (!resp.ok) throw new Error(`Failed to load buffer: ${def.uri}`);
        buffers.push(await resp.arrayBuffer());
      }
    }

    return buffers;
  }

  private decodeDataURI(uri: string): ArrayBuffer {
    const commaIdx = uri.indexOf(',');
    const base64 = uri.substring(commaIdx + 1);
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  // ---------------------------------------------------------------
  // Accessor helpers
  // ---------------------------------------------------------------

  private getAccessorData(json: GLTFJson, accessorIdx: number, buffers: ArrayBuffer[]): ArrayBufferView {
    const accessor = json.accessors![accessorIdx];
    const bufferView = json.bufferViews![accessor.bufferView ?? 0];
    const buffer = buffers[bufferView.buffer];

    const byteOffset = (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    const count = accessor.count * TYPE_SIZES[accessor.type];

    switch (accessor.componentType) {
      case GL_FLOAT: return new Float32Array(buffer, byteOffset, count);
      case GL_UNSIGNED_SHORT: return new Uint16Array(buffer, byteOffset, count);
      case GL_UNSIGNED_INT: return new Uint32Array(buffer, byteOffset, count);
      case GL_UNSIGNED_BYTE: return new Uint8Array(buffer, byteOffset, count);
      case GL_SHORT: return new Int16Array(buffer, byteOffset, count);
      case GL_BYTE: return new Int8Array(buffer, byteOffset, count);
      default: throw new Error(`Unsupported componentType: ${accessor.componentType}`);
    }
  }

  private getFloatAccessor(json: GLTFJson, idx: number, buffers: ArrayBuffer[]): Float32Array {
    const data = this.getAccessorData(json, idx, buffers);
    if (data instanceof Float32Array) return data;
    // Convert to float
    const out = new Float32Array(data.byteLength / (data as any).BYTES_PER_ELEMENT);
    for (let i = 0; i < out.length; i++) {
      out[i] = (data as any)[i];
    }
    return out;
  }

  // ---------------------------------------------------------------
  // Texture loading
  // ---------------------------------------------------------------

  private async loadTextures(
    json: GLTFJson, baseUrl: string, buffers: ArrayBuffer[],
  ): Promise<(Texture | null)[]> {
    const textureDefs = json.textures ?? [];
    const imageDefs = json.images ?? [];
    const samplerDefs = json.samplers ?? [];
    const result: (Texture | null)[] = [];

    for (const texDef of textureDefs) {
      if (texDef.source === undefined) {
        result.push(null);
        continue;
      }

      const imageDef = imageDefs[texDef.source];
      const samplerDef = texDef.sampler !== undefined ? samplerDefs[texDef.sampler] : undefined;

      try {
        const image = await this.loadGLTFImage(imageDef, baseUrl, json, buffers);
        const options = this.samplerToTextureOptions(samplerDef);
        result.push(Texture.fromImage(this.gl, image, options));
      } catch {
        result.push(null);
      }
    }

    return result;
  }

  private async loadGLTFImage(
    imageDef: GLTFImage, baseUrl: string, json: GLTFJson, buffers: ArrayBuffer[],
  ): Promise<HTMLImageElement> {
    if (imageDef.uri) {
      if (imageDef.uri.startsWith('data:')) {
        return this.loadImageFromUrl(imageDef.uri);
      }
      return this.loadImageFromUrl(baseUrl + imageDef.uri);
    }

    // Image stored in buffer view
    if (imageDef.bufferView !== undefined) {
      const view = json.bufferViews![imageDef.bufferView];
      const buffer = buffers[view.buffer];
      const data = new Uint8Array(buffer, view.byteOffset ?? 0, view.byteLength);
      const blob = new Blob([data], { type: imageDef.mimeType ?? 'image/png' });
      const url = URL.createObjectURL(blob);
      try {
        return await this.loadImageFromUrl(url);
      } finally {
        URL.revokeObjectURL(url);
      }
    }

    throw new Error('glTF image has neither URI nor bufferView');
  }

  private loadImageFromUrl(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
      img.src = url;
    });
  }

  private samplerToTextureOptions(sampler?: GLTFSampler): TextureOptions {
    if (!sampler) return {};

    const wrapMap: Record<number, TextureWrap> = {
      [WebGL2RenderingContext.REPEAT]: TextureWrap.REPEAT,
      [WebGL2RenderingContext.CLAMP_TO_EDGE]: TextureWrap.CLAMP_TO_EDGE,
      [WebGL2RenderingContext.MIRRORED_REPEAT]: TextureWrap.MIRRORED_REPEAT,
    };

    const filterMap: Record<number, TextureFilter> = {
      [WebGL2RenderingContext.NEAREST]: TextureFilter.NEAREST,
      [WebGL2RenderingContext.LINEAR]: TextureFilter.LINEAR,
      [WebGL2RenderingContext.NEAREST_MIPMAP_NEAREST]: TextureFilter.NEAREST_MIPMAP_NEAREST,
      [WebGL2RenderingContext.LINEAR_MIPMAP_LINEAR]: TextureFilter.LINEAR_MIPMAP_LINEAR,
      [WebGL2RenderingContext.LINEAR_MIPMAP_NEAREST]: TextureFilter.LINEAR_MIPMAP_NEAREST,
      [WebGL2RenderingContext.NEAREST_MIPMAP_LINEAR]: TextureFilter.NEAREST_MIPMAP_LINEAR,
    };

    return {
      wrapS: sampler.wrapS !== undefined ? wrapMap[sampler.wrapS] : undefined,
      wrapT: sampler.wrapT !== undefined ? wrapMap[sampler.wrapT] : undefined,
      minFilter: sampler.minFilter !== undefined ? filterMap[sampler.minFilter] : undefined,
      magFilter: sampler.magFilter !== undefined ? filterMap[sampler.magFilter] : undefined,
    };
  }

  // ---------------------------------------------------------------
  // Material building
  // ---------------------------------------------------------------

  private buildMaterials(
    json: GLTFJson, defaultShader: ShaderProgram, textures: (Texture | null)[],
  ): Material[] {
    const materialDefs = json.materials ?? [];
    const result: Material[] = [];

    for (const def of materialDefs) {
      const pbr = def.pbrMetallicRoughness;
      const baseColor = pbr?.baseColorFactor ?? [1, 1, 1, 1];
      const baseColorTex = pbr?.baseColorTexture ? textures[pbr.baseColorTexture.index] : null;
      const normalTex = def.normalTexture ? textures[def.normalTexture.index] : null;

      // Map PBR roughness → Phong shininess (rough approximation)
      const roughness = pbr?.roughnessFactor ?? 1;
      const shininess = Math.max(1, (1 - roughness) * 128);
      const metallic = pbr?.metallicFactor ?? 0;
      const specular = 0.04 + metallic * 0.96; // Fresnel F0 approximation

      const material = new Material(defaultShader, {
        color: [baseColor[0], baseColor[1], baseColor[2], baseColor[3]],
        diffuseMap: baseColorTex,
        normalMap: normalTex,
        specular,
        shininess,
        cullFace: !def.doubleSided,
        blending: def.alphaMode === 'BLEND',
      });

      result.push(material);
    }

    return result;
  }

  // ---------------------------------------------------------------
  // Node building
  // ---------------------------------------------------------------

  private buildNode(
    json: GLTFJson,
    nodeIdx: number,
    buffers: ArrayBuffer[],
    materials: Material[],
    defaultShader: ShaderProgram,
  ): SceneNode | null {
    const nodeDef = json.nodes?.[nodeIdx];
    if (!nodeDef) return null;

    let node: SceneNode;

    // If the node has a mesh, create mesh nodes
    if (nodeDef.mesh !== undefined) {
      const meshDef = json.meshes?.[nodeDef.mesh];
      if (meshDef && meshDef.primitives.length === 1) {
        // Single primitive → node IS the mesh
        node = this.buildPrimitive(json, meshDef.primitives[0], buffers, materials, defaultShader);
        node.name = nodeDef.name ?? meshDef.name ?? '';
      } else if (meshDef) {
        // Multiple primitives → container node with mesh children
        node = new SceneNode(nodeDef.name ?? meshDef.name ?? '');
        for (let i = 0; i < meshDef.primitives.length; i++) {
          const child = this.buildPrimitive(json, meshDef.primitives[i], buffers, materials, defaultShader);
          child.name = `${node.name}_prim${i}`;
          node.add(child);
        }
      } else {
        node = new SceneNode(nodeDef.name ?? '');
      }
    } else {
      node = new SceneNode(nodeDef.name ?? '');
    }

    // Apply transform
    if (nodeDef.matrix) {
      // Decompose 4x4 matrix to TRS
      // For now, apply translation/rotation/scale if provided
      this.applyMatrix(node, nodeDef.matrix);
    } else {
      if (nodeDef.translation) {
        node.transform.position.set(
          nodeDef.translation[0],
          nodeDef.translation[1],
          nodeDef.translation[2],
        );
      }
      if (nodeDef.rotation) {
        node.transform.rotation.x = nodeDef.rotation[0];
        node.transform.rotation.y = nodeDef.rotation[1];
        node.transform.rotation.z = nodeDef.rotation[2];
        node.transform.rotation.w = nodeDef.rotation[3];
      }
      if (nodeDef.scale) {
        node.transform.scale.set(
          nodeDef.scale[0], nodeDef.scale[1], nodeDef.scale[2],
        );
      }
    }

    // Recurse children
    if (nodeDef.children) {
      for (const childIdx of nodeDef.children) {
        const child = this.buildNode(json, childIdx, buffers, materials, defaultShader);
        if (child) node.add(child);
      }
    }

    return node;
  }

  private applyMatrix(node: SceneNode, m: number[]): void {
    // Extract translation
    node.transform.position.set(m[12], m[13], m[14]);

    // Extract scale from column magnitudes
    const sx = Math.sqrt(m[0] * m[0] + m[1] * m[1] + m[2] * m[2]);
    const sy = Math.sqrt(m[4] * m[4] + m[5] * m[5] + m[6] * m[6]);
    const sz = Math.sqrt(m[8] * m[8] + m[9] * m[9] + m[10] * m[10]);
    node.transform.scale.set(sx, sy, sz);

    // Extract rotation from normalized rotation matrix → quaternion
    const isx = sx > 0 ? 1 / sx : 0;
    const isy = sy > 0 ? 1 / sy : 0;
    const isz = sz > 0 ? 1 / sz : 0;

    const r00 = m[0] * isx, r01 = m[4] * isy, r02 = m[8] * isz;
    const r10 = m[1] * isx, r11 = m[5] * isy, r12 = m[9] * isz;
    const r20 = m[2] * isx, r21 = m[6] * isy, r22 = m[10] * isz;
    const trace = r00 + r11 + r22;

    const q = node.transform.rotation;
    if (trace > 0) {
      const s = 0.5 / Math.sqrt(trace + 1);
      q.w = 0.25 / s;
      q.x = (r21 - r12) * s;
      q.y = (r02 - r20) * s;
      q.z = (r10 - r01) * s;
    } else if (r00 > r11 && r00 > r22) {
      const s = 2 * Math.sqrt(1 + r00 - r11 - r22);
      q.w = (r21 - r12) / s;
      q.x = 0.25 * s;
      q.y = (r01 + r10) / s;
      q.z = (r02 + r20) / s;
    } else if (r11 > r22) {
      const s = 2 * Math.sqrt(1 + r11 - r00 - r22);
      q.w = (r02 - r20) / s;
      q.x = (r01 + r10) / s;
      q.y = 0.25 * s;
      q.z = (r12 + r21) / s;
    } else {
      const s = 2 * Math.sqrt(1 + r22 - r00 - r11);
      q.w = (r10 - r01) / s;
      q.x = (r02 + r20) / s;
      q.y = (r12 + r21) / s;
      q.z = 0.25 * s;
    }
  }

  private buildPrimitive(
    json: GLTFJson,
    primitive: GLTFPrimitive,
    buffers: ArrayBuffer[],
    materials: Material[],
    defaultShader: ShaderProgram,
  ): Mesh {
    const attrs = primitive.attributes;

    // Positions (required)
    const positions = this.getFloatAccessor(json, attrs['POSITION'], buffers);

    // Normals
    let normals: Float32Array;
    if (attrs['NORMAL'] !== undefined) {
      normals = this.getFloatAccessor(json, attrs['NORMAL'], buffers);
    } else {
      normals = new Float32Array(positions.length); // Will compute below
    }

    // Texture coordinates
    let uvs: Float32Array;
    if (attrs['TEXCOORD_0'] !== undefined) {
      uvs = this.getFloatAccessor(json, attrs['TEXCOORD_0'], buffers);
    } else {
      uvs = new Float32Array((positions.length / 3) * 2);
    }

    // Tangents (optional)
    let tangents: Float32Array | undefined;
    if (attrs['TANGENT'] !== undefined) {
      tangents = this.getFloatAccessor(json, attrs['TANGENT'], buffers);
    }

    // Indices
    let indices: Uint16Array | Uint32Array;
    if (primitive.indices !== undefined) {
      const data = this.getAccessorData(json, primitive.indices, buffers);
      if (data instanceof Uint32Array) {
        indices = data;
      } else if (data instanceof Uint16Array) {
        indices = data;
      } else {
        // Convert to Uint16/32
        const accessor = json.accessors![primitive.indices];
        const arr = new Uint32Array(accessor.count);
        for (let i = 0; i < accessor.count; i++) {
          arr[i] = (data as any)[i];
        }
        indices = arr;
      }
    } else {
      // Non-indexed: generate sequential indices
      const count = positions.length / 3;
      indices = count > 65535
        ? new Uint32Array(count).map((_, i) => i)
        : new Uint16Array(count).map((_, i) => i);
    }

    const geometryData: GeometryData = { positions, normals, uvs, indices };
    if (tangents) geometryData.tangents = tangents;

    const geometry = new Geometry(geometryData);

    // Compute normals if not provided
    if (attrs['NORMAL'] === undefined) {
      geometry.computeNormals();
    }

    // Material
    const material = primitive.material !== undefined && materials[primitive.material]
      ? materials[primitive.material]
      : new Material(defaultShader);

    return new Mesh(geometry, material);
  }
}
