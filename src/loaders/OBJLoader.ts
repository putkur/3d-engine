import { Geometry, GeometryData } from '../scene/Geometry';
import { Material } from '../scene/Material';
import { Mesh } from '../scene/Mesh';
import { ShaderProgram } from '../renderer/ShaderProgram';
import { SceneNode } from '../scene/SceneNode';

/**
 * Parsed MTL material definition.
 */
interface MTLMaterial {
  name: string;
  diffuseColor: [number, number, number];
  specularColor: [number, number, number];
  shininess: number;
  opacity: number;
  diffuseMapFile: string | null;
}

/**
 * Wavefront OBJ file parser.
 * Parses .obj text format and optional companion .mtl files.
 */
export class OBJLoader {
  private gl: WebGL2RenderingContext;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
  }

  /**
   * Load and parse an OBJ file from a URL.
   * Returns a SceneNode containing child Mesh nodes (one per material group).
   */
  async load(url: string, defaultShader: ShaderProgram): Promise<SceneNode> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to load OBJ: ${url} (${response.status})`);
    const text = await response.text();

    const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);
    return this.parse(text, baseUrl, defaultShader);
  }

  /**
   * Parse OBJ text content into a scene node hierarchy.
   */
  async parse(objText: string, baseUrl: string, defaultShader: ShaderProgram): Promise<SceneNode> {
    // Global vertex pools (1-indexed in OBJ)
    const positions: number[][] = [];
    const normals: number[][] = [];
    const texcoords: number[][] = [];

    // Material library
    let materials: Map<string, MTLMaterial> = new Map();
    let currentMaterialName = '';

    // Groups: one group per material
    interface FaceVertex { posIdx: number; uvIdx: number; normIdx: number; }
    interface Group { materialName: string; faces: FaceVertex[][]; }
    const groups: Group[] = [];
    let currentGroup: Group = { materialName: '', faces: [] };
    groups.push(currentGroup);

    const lines = objText.split('\n');

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (line.length === 0 || line.startsWith('#')) continue;

      const parts = line.split(/\s+/);
      const keyword = parts[0];

      switch (keyword) {
        case 'v':
          positions.push([
            parseFloat(parts[1]) || 0,
            parseFloat(parts[2]) || 0,
            parseFloat(parts[3]) || 0,
          ]);
          break;

        case 'vn':
          normals.push([
            parseFloat(parts[1]) || 0,
            parseFloat(parts[2]) || 0,
            parseFloat(parts[3]) || 0,
          ]);
          break;

        case 'vt':
          texcoords.push([
            parseFloat(parts[1]) || 0,
            parseFloat(parts[2]) || 0,
          ]);
          break;

        case 'f': {
          const face: FaceVertex[] = [];
          for (let i = 1; i < parts.length; i++) {
            face.push(this.parseFaceVertex(parts[i]));
          }
          // Triangulate fans for n-gons (n > 3)
          for (let i = 1; i < face.length - 1; i++) {
            currentGroup.faces.push([face[0], face[i], face[i + 1]]);
          }
          break;
        }

        case 'mtllib': {
          const mtlFile = parts.slice(1).join(' ');
          try {
            materials = await this.loadMTL(baseUrl + mtlFile);
          } catch {
            // MTL load failure is non-fatal
          }
          break;
        }

        case 'usemtl':
          currentMaterialName = parts.slice(1).join(' ');
          currentGroup = { materialName: currentMaterialName, faces: [] };
          groups.push(currentGroup);
          break;

        case 'o':
        case 'g':
          // New object/group — start a new face group keeping same material
          currentGroup = { materialName: currentMaterialName, faces: [] };
          groups.push(currentGroup);
          break;
      }
    }

    // Build meshes from groups
    const root = new SceneNode('OBJ_Root');

    for (const group of groups) {
      if (group.faces.length === 0) continue;

      const geometry = this.buildGeometry(group.faces, positions, normals, texcoords);
      const mtl = materials.get(group.materialName);

      const material = new Material(defaultShader, {
        color: mtl
          ? [mtl.diffuseColor[0], mtl.diffuseColor[1], mtl.diffuseColor[2], mtl.opacity]
          : [1, 1, 1, 1],
        specular: mtl ? (mtl.specularColor[0] + mtl.specularColor[1] + mtl.specularColor[2]) / 3 : 0.5,
        shininess: mtl?.shininess ?? 32,
      });

      const mesh = new Mesh(geometry, material, group.materialName || 'obj_mesh');
      root.add(mesh);
    }

    return root;
  }

  /**
   * Parse a face vertex string like "1/2/3", "1//3", "1/2", or "1".
   * OBJ indices are 1-based; we convert to 0-based.
   */
  private parseFaceVertex(str: string): { posIdx: number; uvIdx: number; normIdx: number } {
    const parts = str.split('/');
    return {
      posIdx: (parseInt(parts[0], 10) || 1) - 1,
      uvIdx: parts.length > 1 && parts[1] !== '' ? (parseInt(parts[1], 10) || 1) - 1 : -1,
      normIdx: parts.length > 2 ? (parseInt(parts[2], 10) || 1) - 1 : -1,
    };
  }

  /**
   * Build a Geometry from face data by expanding indexed vertices into flat arrays.
   * OBJ allows different indices for pos/uv/normal, so we must de-index.
   */
  private buildGeometry(
    faces: { posIdx: number; uvIdx: number; normIdx: number }[][],
    positions: number[][],
    normals: number[][],
    texcoords: number[][],
  ): Geometry {
    const outPos: number[] = [];
    const outNorm: number[] = [];
    const outUV: number[] = [];
    const outIdx: number[] = [];

    // Vertex dedup map: "posIdx/uvIdx/normIdx" → output vertex index
    const vertexMap = new Map<string, number>();
    let vertexCount = 0;

    for (const tri of faces) {
      for (const vert of tri) {
        const key = `${vert.posIdx}/${vert.uvIdx}/${vert.normIdx}`;
        let idx = vertexMap.get(key);
        if (idx === undefined) {
          idx = vertexCount++;
          vertexMap.set(key, idx);

          const p = positions[vert.posIdx] ?? [0, 0, 0];
          outPos.push(p[0], p[1], p[2]);

          if (vert.normIdx >= 0 && normals[vert.normIdx]) {
            const n = normals[vert.normIdx];
            outNorm.push(n[0], n[1], n[2]);
          } else {
            outNorm.push(0, 0, 0); // Will recompute below
          }

          if (vert.uvIdx >= 0 && texcoords[vert.uvIdx]) {
            const t = texcoords[vert.uvIdx];
            outUV.push(t[0], t[1]);
          } else {
            outUV.push(0, 0);
          }
        }
        outIdx.push(idx);
      }
    }

    const useUint32 = vertexCount > 65535;
    const geometry = new Geometry({
      positions: new Float32Array(outPos),
      normals: new Float32Array(outNorm),
      uvs: new Float32Array(outUV),
      indices: useUint32 ? new Uint32Array(outIdx) : new Uint16Array(outIdx),
    });

    // If normals weren't provided, compute them
    const hasNormals = faces.some(tri => tri.some(v => v.normIdx >= 0));
    if (!hasNormals) {
      geometry.computeNormals();
    }

    return geometry;
  }

  /**
   * Load and parse a .mtl material library file.
   */
  private async loadMTL(url: string): Promise<Map<string, MTLMaterial>> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to load MTL: ${url}`);
    const text = await response.text();
    return this.parseMTL(text);
  }

  /**
   * Parse MTL text content.
   */
  private parseMTL(text: string): Map<string, MTLMaterial> {
    const materials = new Map<string, MTLMaterial>();
    let current: MTLMaterial | null = null;

    for (const rawLine of text.split('\n')) {
      const line = rawLine.trim();
      if (line.length === 0 || line.startsWith('#')) continue;

      const parts = line.split(/\s+/);
      const keyword = parts[0];

      switch (keyword) {
        case 'newmtl':
          current = {
            name: parts.slice(1).join(' '),
            diffuseColor: [1, 1, 1],
            specularColor: [0.5, 0.5, 0.5],
            shininess: 32,
            opacity: 1,
            diffuseMapFile: null,
          };
          materials.set(current.name, current);
          break;

        case 'Kd':
          if (current) {
            current.diffuseColor = [
              parseFloat(parts[1]) || 0,
              parseFloat(parts[2]) || 0,
              parseFloat(parts[3]) || 0,
            ];
          }
          break;

        case 'Ks':
          if (current) {
            current.specularColor = [
              parseFloat(parts[1]) || 0,
              parseFloat(parts[2]) || 0,
              parseFloat(parts[3]) || 0,
            ];
          }
          break;

        case 'Ns':
          if (current) current.shininess = parseFloat(parts[1]) || 32;
          break;

        case 'd':
          if (current) current.opacity = parseFloat(parts[1]) ?? 1;
          break;

        case 'Tr':
          if (current) current.opacity = 1 - (parseFloat(parts[1]) ?? 0);
          break;

        case 'map_Kd':
          if (current) current.diffuseMapFile = parts.slice(1).join(' ');
          break;
      }
    }

    return materials;
  }
}
