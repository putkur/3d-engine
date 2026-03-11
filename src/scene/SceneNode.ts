import { Transform } from './Transform';
import { Matrix4 } from '../math/Matrix4';

let nextId = 0;
function generateUUID(): string {
  return `node_${++nextId}_${Math.random().toString(36).substring(2, 9)}`;
}

export class SceneNode {
  public readonly uuid: string;
  public name: string;
  public readonly transform: Transform;

  public parent: SceneNode | null = null;
  public readonly children: SceneNode[] = [];

  /** If false, this node and its children are skipped during update/render. */
  public visible = true;

  constructor(name = '') {
    this.uuid = generateUUID();
    this.name = name;
    this.transform = new Transform();
  }

  // --- Hierarchy ---

  add(child: SceneNode): this {
    if (child === this) {
      throw new Error('Cannot add a node as a child of itself');
    }
    if (child.parent) {
      child.parent.remove(child);
    }
    child.parent = this;
    this.children.push(child);
    return this;
  }

  remove(child: SceneNode): this {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      child.parent = null;
      this.children.splice(idx, 1);
    }
    return this;
  }

  removeFromParent(): this {
    if (this.parent) {
      this.parent.remove(this);
    }
    return this;
  }

  /**
   * Traverse this node and all descendants depth-first.
   * Callback receives each node. Return `false` to skip subtree.
   */
  traverse(callback: (node: SceneNode) => void | false): void {
    if (callback(this) === false) return;
    for (const child of this.children) {
      child.traverse(callback);
    }
  }

  /**
   * Recursively update world matrices down the tree.
   * Call on root node each frame.
   */
  updateWorldMatrix(parentWorldMatrix?: Matrix4): void {
    this.transform.updateWorldMatrix(parentWorldMatrix);

    const worldMatrix = this.transform.worldMatrix;
    for (const child of this.children) {
      child.updateWorldMatrix(worldMatrix);
    }
  }

  /**
   * Find a descendant by name (depth-first).
   */
  getByName(name: string): SceneNode | null {
    if (this.name === name) return this;
    for (const child of this.children) {
      const found = child.getByName(name);
      if (found) return found;
    }
    return null;
  }

  /**
   * Find a descendant by UUID (depth-first).
   */
  getByUUID(uuid: string): SceneNode | null {
    if (this.uuid === uuid) return this;
    for (const child of this.children) {
      const found = child.getByUUID(uuid);
      if (found) return found;
    }
    return null;
  }
}
