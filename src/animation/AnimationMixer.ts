import { AnimationClip } from './AnimationClip';
import { SceneNode } from '../scene/SceneNode';
import { Vector3 } from '../math/Vector3';
import { Quaternion } from '../math/Quaternion';

export interface AnimationActionOptions {
  loop?: boolean;
  timeScale?: number;
  weight?: number;
}

/**
 * A single playing instance of an AnimationClip on a node hierarchy.
 * Created and owned by AnimationMixer.
 */
export class AnimationAction {
  public readonly clip: AnimationClip;

  public loop: boolean;
  public timeScale: number;
  /** 0–1 blending weight for this action. */
  public weight: number;

  /** Current playback time in seconds. */
  public time = 0;
  /** Whether the action has finished (last frame, no loop). */
  public finished = false;
  /** Whether the action is playing (not paused). */
  public playing = true;

  constructor(clip: AnimationClip, options: AnimationActionOptions = {}) {
    this.clip = clip;
    this.loop = options.loop ?? true;
    this.timeScale = options.timeScale ?? 1;
    this.weight = options.weight ?? 1;
  }

  /** Reset the action to the beginning. */
  reset(): this {
    this.time = 0;
    this.finished = false;
    return this;
  }

  /** Pause/resume playback. */
  pause(): this  { this.playing = false; return this; }
  resume(): this { this.playing = true;  return this; }

  /** Advance internal time by dt. Handles looping / clamping. */
  tick(dt: number): void {
    if (!this.playing || this.finished) return;
    this.time += dt * this.timeScale;
    if (this.clip.duration > 0) {
      if (this.loop) {
        this.time = this.time % this.clip.duration;
        if (this.time < 0) this.time += this.clip.duration;
      } else {
        if (this.time >= this.clip.duration) {
          this.time = this.clip.duration;
          this.finished = true;
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Cross-fade state (handled internally by the mixer)
// ---------------------------------------------------------------------------
interface FadeState {
  from: AnimationAction;
  to: AnimationAction;
  duration: number;
  elapsed: number;
}

/**
 * AnimationMixer manages playback of one or more AnimationActions on a
 * SceneNode hierarchy.
 *
 * Usage:
 * ```ts
 * const mixer = new AnimationMixer(rootNode);
 * const action = mixer.play(clip, { loop: true });
 *
 * // Each frame:
 * mixer.update(dt);
 * ```
 */
export class AnimationMixer {
  public readonly root: SceneNode;

  private readonly actions: AnimationAction[] = [];
  // Pre-built map from node name → node (for fast lookup during update)
  private readonly nodeMap: Map<string, SceneNode> = new Map();
  private fade: FadeState | null = null;

  constructor(root: SceneNode) {
    this.root = root;
    this.buildNodeMap(root);
  }

  // --- Public API ---

  /**
   * Create and start playing an AnimationAction for the given clip.
   * Returns the new action for further configuration.
   */
  play(clip: AnimationClip, options: AnimationActionOptions = {}): AnimationAction {
    const action = new AnimationAction(clip, options);
    this.actions.push(action);
    return action;
  }

  /**
   * Stop and remove an action.
   */
  stop(action: AnimationAction): void {
    const idx = this.actions.indexOf(action);
    if (idx !== -1) this.actions.splice(idx, 1);
  }

  /** Stop all actions. */
  stopAll(): void {
    this.actions.length = 0;
    this.fade = null;
  }

  /**
   * Smoothly cross-fade from one action to another over `duration` seconds.
   *
   * The `from` action's weight will decrease from 1 → 0 while the `to`
   * action's weight increases from 0 → 1.  Both actions must already be
   * registered with this mixer (i.e. returned by `play()`).
   */
  crossFadeTo(from: AnimationAction, to: AnimationAction, duration: number): void {
    // Auto-register 'to' if it was previously stopped/removed
    if (!this.actions.includes(to)) this.actions.push(to);
    from.weight = 1;
    to.weight   = 0;
    to.reset();
    to.resume();
    this.fade = { from, to, duration, elapsed: 0 };
  }

  /**
   * Advance the mixer by `dt` seconds:
   * 1. Tick all actions.
   * 2. Apply cross-fade weights.
   * 3. Sample tracks and write values to target nodes.
   */
  update(dt: number): void {
    // Advance cross-fade
    if (this.fade) {
      this.fade.elapsed += dt;
      const alpha = Math.min(this.fade.elapsed / this.fade.duration, 1);
      this.fade.from.weight = 1 - alpha;
      this.fade.to.weight   = alpha;
      if (alpha >= 1) {
        // Fade complete — zero out the old action (keep it registered so it
        // can be the target of a future crossFadeTo in the opposite direction)
        this.fade.from.weight = 0;
        this.fade.from.pause();
        this.fade.to.weight = 1;
        this.fade = null;
      }
    }

    // Tick all actions
    for (const action of this.actions) {
      action.tick(dt);
    }

    // Apply: accumulate weighted contributions per property per node
    this.applyActions();
  }

  // --- Private helpers ---

  private buildNodeMap(node: SceneNode): void {
    if (node.name) this.nodeMap.set(node.name, node);
    for (const child of node.children) {
      this.buildNodeMap(child);
    }
  }

  private applyActions(): void {
    // Accumulate weighted position / rotation / scale per node
    type BlendAccum = {
      pos: [number, number, number];   posW: number;
      rot: [number, number, number, number]; rotW: number;
      scl: [number, number, number];   sclW: number;
    };
    const accum = new Map<string, BlendAccum>();

    for (const action of this.actions) {
      if (action.weight === 0) continue;
      const w = action.weight;

      for (const track of action.clip.tracks) {
        const node = this.nodeMap.get(track.targetNodeName);
        if (!node) continue;

        const key = track.targetNodeName;
        if (!accum.has(key)) {
          accum.set(key, {
            pos: [0, 0, 0], posW: 0,
            rot: [0, 0, 0, 0], rotW: 0,
            scl: [0, 0, 0], sclW: 0,
          });
        }
        const a = accum.get(key)!;
        const val = track.evaluate(action.time);

        if (track.targetPath === 'position') {
          a.pos[0] += val[0] * w; a.pos[1] += val[1] * w; a.pos[2] += val[2] * w;
          a.posW += w;
        } else if (track.targetPath === 'rotation') {
          // Accumulate quaternion contributions (simple weighted-add then normalize)
          // For proper multi-clip blending we nlerp each pair, but for common
          // 2-clip crossfades this is numerically identical.
          const q = val as [number, number, number, number];
          // Ensure quaternions point to same hemisphere before accumulating
          const dot = a.rot[0] * q[0] + a.rot[1] * q[1] + a.rot[2] * q[2] + a.rot[3] * q[3];
          const sign = (a.rotW === 0 || dot >= 0) ? 1 : -1;
          a.rot[0] += q[0] * w * sign; a.rot[1] += q[1] * w * sign;
          a.rot[2] += q[2] * w * sign; a.rot[3] += q[3] * w * sign;
          a.rotW += w;
        } else if (track.targetPath === 'scale') {
          a.scl[0] += val[0] * w; a.scl[1] += val[1] * w; a.scl[2] += val[2] * w;
          a.sclW += w;
        }
      }
    }

    // Write back accumulated values to node transforms
    for (const [name, a] of accum) {
      const node = this.nodeMap.get(name)!;
      const tf = node.transform;

      if (a.posW > 0) {
        const iw = 1 / a.posW;
        tf.position.set(a.pos[0] * iw, a.pos[1] * iw, a.pos[2] * iw);
        tf.markDirty();
      }

      if (a.rotW > 0) {
        const [rx, ry, rz, rw] = a.rot;
        const len = Math.sqrt(rx * rx + ry * ry + rz * rz + rw * rw);
        if (len > 0) {
          tf.rotation.set(rx / len, ry / len, rz / len, rw / len);
          tf.markDirty();
        }
      }

      if (a.sclW > 0) {
        const iw = 1 / a.sclW;
        tf.scale.set(a.scl[0] * iw, a.scl[1] * iw, a.scl[2] * iw);
        tf.markDirty();
      }
    }
  }
}
