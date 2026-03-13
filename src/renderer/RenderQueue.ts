import { Mesh } from '../scene/Mesh';

/** A single item in the render queue. */
export interface RenderItem {
  mesh: Mesh;
  /**
   * Sort key: lower = rendered first.
   * High 16 bits = stable shader ID, low 16 bits = stable material ID.
   * Rendering in sorted order minimises shader switches and texture binds.
   */
  sortKey: number;
}

/**
 * Collects renderable meshes for a single frame, sorts them to minimise
 * WebGL state changes (shader switches, material rebinds), and exposes
 * them for sequential rendering.
 *
 * Shader and material IDs are assigned once per unique value and reused
 * across frames, so the sort order is stable across frames without
 * rehashing every time.
 *
 * @example
 * renderQueue.clear();
 * for (const mesh of visibleMeshes) renderQueue.add(mesh);
 * renderQueue.sort();
 * for (const { mesh } of renderQueue.items) renderMesh(mesh);
 */
export class RenderQueue {
  private _items: RenderItem[] = [];

  // Stable ID maps — accumulated across the lifetime of the queue.
  private _shaderIds  = new Map<WebGLProgram | null, number>();
  private _materialIds = new Map<string, number>();
  private _nextShader   = 0;
  private _nextMaterial = 0;

  /** Remove all items from the queue (preserves ID maps). */
  clear(): void {
    this._items.length = 0;
  }

  /**
   * Add a visible mesh to the queue.
   * Derives a sort key from the mesh's shader program and material signature.
   */
  add(mesh: Mesh): void {
    const handle = mesh.material.shader.handle;

    let shaderId = this._shaderIds.get(handle);
    if (shaderId === undefined) {
      shaderId = (this._nextShader++) & 0xFFFF;
      this._shaderIds.set(handle, shaderId);
    }

    // Material key: shader handle + color + blend state flags
    const mat = mesh.material;
    const matKey = `${shaderId}_${mat.color.join('|')}_${mat.blending ? 1 : 0}`;
    let matId = this._materialIds.get(matKey);
    if (matId === undefined) {
      matId = (this._nextMaterial++) & 0xFFFF;
      this._materialIds.set(matKey, matId);
    }

    this._items.push({ mesh, sortKey: (shaderId << 16) | matId });
  }

  /** Sort items in-place by sort key (shader first, then material). */
  sort(): void {
    this._items.sort((a, b) => a.sortKey - b.sortKey);
  }

  /** Sorted list of render items. Call `sort()` first. */
  get items(): readonly RenderItem[] {
    return this._items;
  }

  /** Number of items currently in the queue. */
  get size(): number {
    return this._items.length;
  }
}
