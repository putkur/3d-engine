import { SceneNode } from '../scene/SceneNode';

/**
 * Scene-graph audio listener that syncs its world-space transform to the
 * Web Audio API `AudioListener` every frame.
 *
 * Attach as a child of the active camera so it inherits camera movement.
 * Only one AudioListener should be active at a time.
 */
export class AudioListener extends SceneNode {
  constructor(name = 'AudioListener') {
    super(name);
  }

  /**
   * Sync the Web Audio listener position, forward, and up vectors
   * from this node's world transform.
   *
   * Call once per frame after `scene.updateMatrixWorld()`.
   */
  syncToContext(ctx: AudioContext): void {
    const m = this.transform.worldMatrix.data;

    // Position = translation column of world matrix
    const px = m[12], py = m[13], pz = m[14];

    // Forward = -Z axis of the world matrix (right-hand coordinate system)
    const fx = -m[8], fy = -m[9], fz = -m[10];

    // Up = +Y axis of the world matrix
    const ux = m[4], uy = m[5], uz = m[6];

    const listener = ctx.listener;

    // Use AudioParam setters when available (modern browsers), fall back to
    // deprecated setPosition/setOrientation for older ones.
    if (listener.positionX !== undefined) {
      listener.positionX.value = px;
      listener.positionY.value = py;
      listener.positionZ.value = pz;
      listener.forwardX.value = fx;
      listener.forwardY.value = fy;
      listener.forwardZ.value = fz;
      listener.upX.value = ux;
      listener.upY.value = uy;
      listener.upZ.value = uz;
    } else {
      // Legacy fallback
      (listener as any).setPosition(px, py, pz);
      (listener as any).setOrientation(fx, fy, fz, ux, uy, uz);
    }
  }
}
