import { SceneNode } from './SceneNode';

/**
 * Root of the scene graph.
 * Maintains flat lists for quick iteration over meshes, lights, cameras.
 */
export class Scene extends SceneNode {
  /** Flat list of all Mesh nodes in the scene (auto-maintained). */
  public readonly meshes: SceneNode[] = [];
  /** Flat list of all Light nodes in the scene (auto-maintained). */
  public readonly lights: SceneNode[] = [];
  /** Flat list of all Camera nodes in the scene (auto-maintained). */
  public readonly cameras: SceneNode[] = [];

  constructor() {
    super('Scene');
  }

  /**
   * Add a node (and its subtree) to the scene.
   * Automatically registers meshes/lights/cameras in flat lists.
   */
  override add(child: SceneNode): this {
    super.add(child);
    this.registerNode(child);
    return this;
  }

  /**
   * Remove a node (and its subtree) from the scene.
   * Automatically unregisters from flat lists.
   */
  override remove(child: SceneNode): this {
    this.unregisterNode(child);
    super.remove(child);
    return this;
  }

  /**
   * Update all world matrices from the root down.
   */
  updateMatrixWorld(): void {
    this.updateWorldMatrix();
  }

  /** Register a node and its subtree into the flat lists based on type tag. */
  private registerNode(node: SceneNode): void {
    this.categorize(node, true);
    for (const child of node.children) {
      this.registerNode(child);
    }
  }

  /** Unregister a node and its subtree from the flat lists. */
  private unregisterNode(node: SceneNode): void {
    this.categorize(node, false);
    for (const child of node.children) {
      this.unregisterNode(child);
    }
  }

  /**
   * Categorize a node into the correct flat list.
   * Uses duck-typing: checks for `isMesh`, `isLight`, `isCamera` properties.
   */
  private categorize(node: SceneNode, adding: boolean): void {
    const n = node as unknown as Record<string, unknown>;
    if (adding) {
      if (n['isMesh']) this.meshes.push(node);
      if (n['isLight']) this.lights.push(node);
      if (n['isCamera']) this.cameras.push(node);
    } else {
      if (n['isMesh']) removeFromArray(this.meshes, node);
      if (n['isLight']) removeFromArray(this.lights, node);
      if (n['isCamera']) removeFromArray(this.cameras, node);
    }
  }
}

function removeFromArray<T>(arr: T[], item: T): void {
  const idx = arr.indexOf(item);
  if (idx !== -1) arr.splice(idx, 1);
}
