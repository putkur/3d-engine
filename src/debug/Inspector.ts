import { Scene } from '../scene/Scene';
import { SceneNode } from '../scene/SceneNode';
import { DebugRenderer } from './DebugRenderer';

/**
 * Runtime scene inspector — an HTML panel listing the scene tree.
 * Click a node to select it and view its transform properties.
 * Toggle collider debug visualisation.
 */
export class Inspector {
  private panel: HTMLDivElement;
  private treeEl: HTMLDivElement;
  private propsEl: HTMLDivElement;
  private toggleBtn: HTMLButtonElement;

  private scene: Scene | null = null;
  private debugRenderer: DebugRenderer | null = null;
  private selectedNode: SceneNode | null = null;
  private _visible = true;
  private refreshTimer = 0;

  constructor() {
    // Main panel
    this.panel = document.createElement('div');
    this.panel.style.cssText =
      'position:fixed;top:8px;left:220px;width:260px;max-height:70vh;' +
      'background:rgba(20,20,25,0.92);color:#ddd;font:12px monospace;' +
      'border-radius:6px;z-index:1001;overflow:hidden;display:flex;flex-direction:column;';

    // Header
    const header = document.createElement('div');
    header.style.cssText =
      'padding:6px 10px;background:rgba(255,255,255,0.08);display:flex;' +
      'justify-content:space-between;align-items:center;';
    header.innerHTML = '<b>Inspector</b>';

    this.toggleBtn = document.createElement('button');
    this.toggleBtn.textContent = 'Colliders: ON';
    this.toggleBtn.style.cssText =
      'font:11px monospace;background:#333;color:#0f0;border:1px solid #555;' +
      'border-radius:3px;padding:2px 6px;cursor:pointer;';
    this.toggleBtn.addEventListener('click', () => this.toggleColliders());
    header.appendChild(this.toggleBtn);
    this.panel.appendChild(header);

    // Tree
    this.treeEl = document.createElement('div');
    this.treeEl.style.cssText = 'flex:1;overflow-y:auto;padding:4px 0;';
    this.panel.appendChild(this.treeEl);

    // Properties
    this.propsEl = document.createElement('div');
    this.propsEl.style.cssText =
      'border-top:1px solid #444;padding:6px 10px;min-height:60px;white-space:pre;line-height:1.6;';
    this.propsEl.textContent = 'Select a node…';
    this.panel.appendChild(this.propsEl);

    document.body.appendChild(this.panel);
  }

  /** Bind the scene and optional debug renderer. */
  attach(scene: Scene, debugRenderer?: DebugRenderer): void {
    this.scene = scene;
    this.debugRenderer = debugRenderer ?? null;
  }

  /**
   * Call each frame with deltaTime to periodically refresh the tree.
   * Refreshes at ~4 Hz to avoid DOM thrashing.
   */
  update(dt: number): void {
    if (!this._visible || !this.scene) return;
    this.refreshTimer += dt;
    if (this.refreshTimer >= 0.25) {
      this.refreshTimer = 0;
      this.rebuildTree();
      if (this.selectedNode) this.showProperties(this.selectedNode);
    }
  }

  setVisible(visible: boolean): void {
    this._visible = visible;
    this.panel.style.display = visible ? '' : 'none';
  }

  dispose(): void {
    if (this.panel.parentNode) {
      this.panel.parentNode.removeChild(this.panel);
    }
  }

  // ---------------------------------------------------------------

  private toggleColliders(): void {
    if (this.debugRenderer) {
      this.debugRenderer.showColliders = !this.debugRenderer.showColliders;
      this.toggleBtn.textContent = `Colliders: ${this.debugRenderer.showColliders ? 'ON' : 'OFF'}`;
      this.toggleBtn.style.color = this.debugRenderer.showColliders ? '#0f0' : '#f55';
    }
  }

  private rebuildTree(): void {
    this.treeEl.innerHTML = '';
    if (!this.scene) return;
    this.buildNode(this.scene, 0);
  }

  private buildNode(node: SceneNode, depth: number): void {
    const row = document.createElement('div');
    row.style.cssText =
      `padding:2px 8px 2px ${8 + depth * 14}px;cursor:pointer;` +
      (node === this.selectedNode ? 'background:rgba(100,150,255,0.25);' : '');

    const tag = this.getTag(node);
    const label = node.name || node.uuid.substring(0, 12);
    row.textContent = `${tag} ${label}`;

    row.addEventListener('click', () => {
      this.selectedNode = node;
      this.rebuildTree();
      this.showProperties(node);
    });

    this.treeEl.appendChild(row);

    for (const child of node.children) {
      this.buildNode(child, depth + 1);
    }
  }

  private getTag(node: SceneNode): string {
    const n = node as unknown as Record<string, unknown>;
    if (n['isMesh']) return '\u25A0'; // ■
    if (n['isLight']) return '\u2600'; // ☀
    if (n['isCamera']) return '\uD83C\uDFA5'; // 🎥
    return '\u25CB'; // ○
  }

  private showProperties(node: SceneNode): void {
    const t = node.transform;
    const p = t.position;
    const r = t.rotation;
    const s = t.scale;
    this.propsEl.textContent =
      `Name: ${node.name || '(unnamed)'}\n` +
      `UUID: ${node.uuid}\n` +
      `Pos:  ${fmt(p.x)} ${fmt(p.y)} ${fmt(p.z)}\n` +
      `Rot:  ${fmt(r.x)} ${fmt(r.y)} ${fmt(r.z)} ${fmt(r.w)}\n` +
      `Scale:${fmt(s.x)} ${fmt(s.y)} ${fmt(s.z)}`;
  }
}

function fmt(n: number): string {
  return n.toFixed(2).padStart(7);
}
