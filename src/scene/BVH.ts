/**
 * Anything that can test whether an AABB is (at least partially) visible.
 * Frustum implements this naturally via structural typing — no import needed.
 */
export interface BVHCuller {
  containsBox(
    minX: number, minY: number, minZ: number,
    maxX: number, maxY: number, maxZ: number,
  ): boolean;
}

/** World-space axis-aligned bounding box used by BVH nodes. */
export interface BVHBounds {
  minX: number; minY: number; minZ: number;
  maxX: number; maxY: number; maxZ: number;
}

/** Internal BVH tree node (either an internal node or a leaf). */
class BVHNode {
  bounds: BVHBounds = { minX: 0, minY: 0, minZ: 0, maxX: 0, maxY: 0, maxZ: 0 };
  left:  BVHNode | null = null;
  right: BVHNode | null = null;
  /** Original item indices stored at this leaf. Empty for internal nodes. */
  items: number[] = [];

  get isLeaf(): boolean { return this.left === null; }
}

/**
 * Bounding Volume Hierarchy for efficient frustum culling and raycasting.
 *
 * Build once (or call `refit` each frame for dynamic scenes), then `query`
 * with any BVHCuller (e.g. a Frustum) to get visible item indices.
 *
 * @example
 * const bvh = new BVH();
 * bvh.build(meshBounds);        // one-time or when mesh count changes
 * bvh.refit(meshBounds);        // cheap per-frame update for moving objects
 * const visible: number[] = [];
 * bvh.query(frustum, visible);  // visible holds indices into meshBounds
 */
export class BVH {
  private _root: BVHNode | null = null;
  private _itemCount = 0;

  /**
   * (Re-)build the BVH from an array of world-space bounding boxes.
   * Uses a top-down median split on the longest axis.
   *
   * @param bounds      One bounding box per item (indexed 0…N-1).
   * @param maxLeafSize Maximum items per leaf node (default 2).
   */
  build(bounds: BVHBounds[], maxLeafSize = 2): void {
    this._itemCount = bounds.length;
    if (bounds.length === 0) { this._root = null; return; }
    const indices = bounds.map((_, i) => i);
    this._root = this._buildNode(bounds, indices, maxLeafSize);
  }

  /**
   * Refit node AABBs in-place for moved/scaled objects without restructuring
   * the tree. O(N) where N is the number of nodes in the tree.
   *
   * Falls back to a full `build` if the item count has changed.
   */
  refit(bounds: BVHBounds[], maxLeafSize = 2): void {
    if (bounds.length !== this._itemCount || !this._root) {
      this.build(bounds, maxLeafSize);
      return;
    }
    this._refitNode(this._root, bounds);
  }

  /**
   * Traverse the BVH and collect indices of items not culled by `culler`.
   * `out` is cleared and populated in place.
   */
  query(culler: BVHCuller, out: number[]): void {
    out.length = 0;
    if (this._root) this._queryNode(this._root, culler, out);
  }

  // --- Private helpers ---

  private _buildNode(
    bounds: BVHBounds[],
    indices: number[],
    maxLeafSize: number,
  ): BVHNode {
    const node = new BVHNode();
    node.bounds = computeUnion(bounds, indices);

    if (indices.length <= maxLeafSize) {
      node.items = indices.slice();
      return node;
    }

    // Split on the longest AABB axis at the centroid median
    const axis = longestAxis(node.bounds);
    const mid  = indices.length >> 1;

    indices.sort((a, b) => centroid(bounds[a], axis) - centroid(bounds[b], axis));

    node.left  = this._buildNode(bounds, indices.slice(0, mid), maxLeafSize);
    node.right = this._buildNode(bounds, indices.slice(mid),    maxLeafSize);
    return node;
  }

  private _refitNode(node: BVHNode, bounds: BVHBounds[]): void {
    if (node.isLeaf) {
      node.bounds = computeUnion(bounds, node.items);
      return;
    }
    if (node.left)  this._refitNode(node.left,  bounds);
    if (node.right) this._refitNode(node.right, bounds);
    node.bounds = mergeBounds(node.left!.bounds, node.right!.bounds);
  }

  private _queryNode(node: BVHNode, culler: BVHCuller, out: number[]): void {
    const b = node.bounds;
    if (!culler.containsBox(b.minX, b.minY, b.minZ, b.maxX, b.maxY, b.maxZ)) return;

    if (node.isLeaf) {
      for (const idx of node.items) out.push(idx);
      return;
    }
    if (node.left)  this._queryNode(node.left,  culler, out);
    if (node.right) this._queryNode(node.right, culler, out);
  }
}

// --- Utility functions ---

function computeUnion(bounds: BVHBounds[], indices: number[]): BVHBounds {
  let minX =  Infinity, minY =  Infinity, minZ =  Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (const i of indices) {
    const b = bounds[i];
    if (b.minX < minX) minX = b.minX;
    if (b.minY < minY) minY = b.minY;
    if (b.minZ < minZ) minZ = b.minZ;
    if (b.maxX > maxX) maxX = b.maxX;
    if (b.maxY > maxY) maxY = b.maxY;
    if (b.maxZ > maxZ) maxZ = b.maxZ;
  }
  return { minX, minY, minZ, maxX, maxY, maxZ };
}

function mergeBounds(a: BVHBounds, b: BVHBounds): BVHBounds {
  return {
    minX: Math.min(a.minX, b.minX), minY: Math.min(a.minY, b.minY), minZ: Math.min(a.minZ, b.minZ),
    maxX: Math.max(a.maxX, b.maxX), maxY: Math.max(a.maxY, b.maxY), maxZ: Math.max(a.maxZ, b.maxZ),
  };
}

function longestAxis(b: BVHBounds): 0 | 1 | 2 {
  const dx = b.maxX - b.minX;
  const dy = b.maxY - b.minY;
  const dz = b.maxZ - b.minZ;
  if (dx >= dy && dx >= dz) return 0;
  if (dy >= dz) return 1;
  return 2;
}

function centroid(b: BVHBounds, axis: 0 | 1 | 2): number {
  if (axis === 0) return (b.minX + b.maxX) * 0.5;
  if (axis === 1) return (b.minY + b.maxY) * 0.5;
  return (b.minZ + b.maxZ) * 0.5;
}
