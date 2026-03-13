import { SceneNode } from '../scene/SceneNode';
import { AudioClip } from './AudioClip';

/** Distance model used by the PannerNode for spatial audio sources. */
export type DistanceModel = 'linear' | 'inverse' | 'exponential';

export interface AudioSourceOptions {
  /** Audio clip to play. */
  clip?: AudioClip | null;
  /** Master volume for this source (0–1). */
  volume?: number;
  /** Whether playback should loop. */
  loop?: boolean;
  /** Enable 3D spatialization (PannerNode). False = flat stereo via GainNode. */
  spatial?: boolean;
  /** Reference distance for spatial rolloff (default 1). */
  refDistance?: number;
  /** Maximum distance beyond which volume stays constant (default 10000). */
  maxDistance?: number;
  /** How quickly volume drops with distance (default 1). */
  rolloffFactor?: number;
  /** Distance model for the PannerNode (default 'inverse'). */
  distanceModel?: DistanceModel;
  /** Begin playing immediately when attached (default false). */
  autoplay?: boolean;
}

/**
 * A positional or non-spatial sound emitter that lives in the scene graph.
 *
 * Spatial sources use a `PannerNode` whose position is synced from the node's
 * world transform each frame. Non-spatial sources route through a plain
 * `GainNode` for flat-stereo playback (music, UI sounds).
 *
 * Audio graph:
 *   `BufferSourceNode → PannerNode|GainNode → channelGain → masterGain → destination`
 *
 * AudioSources are wired to a channel group GainNode (sfx / music / ambient)
 * by AudioManager.createSource().
 */
export class AudioSource extends SceneNode {
  public clip: AudioClip | null;
  public loop: boolean;
  public spatial: boolean;
  public autoplay: boolean;
  public refDistance: number;
  public maxDistance: number;
  public rolloffFactor: number;
  public distanceModel: DistanceModel;

  /** The GainNode that controls this source's individual volume. */
  private _gain: GainNode | null = null;
  /** PannerNode for 3D spatialization (null when non-spatial). */
  private _panner: PannerNode | null = null;
  /** The currently active AudioBufferSourceNode (null when stopped). */
  private _bufferSource: AudioBufferSourceNode | null = null;
  /** AudioContext reference (set by AudioManager when wiring). */
  private _ctx: AudioContext | null = null;
  /** The channel-group GainNode this source feeds into. */
  private _outputNode: GainNode | null = null;

  private _volume = 1;
  private _playing = false;
  private _pauseOffset = 0;
  private _startTime = 0;

  constructor(options: AudioSourceOptions = {}, name = 'AudioSource') {
    super(name);
    this.clip = options.clip ?? null;
    this._volume = options.volume ?? 1;
    this.loop = options.loop ?? false;
    this.spatial = options.spatial ?? true;
    this.refDistance = options.refDistance ?? 1;
    this.maxDistance = options.maxDistance ?? 10000;
    this.rolloffFactor = options.rolloffFactor ?? 1;
    this.distanceModel = options.distanceModel ?? 'inverse';
    this.autoplay = options.autoplay ?? false;
  }

  /** Individual source volume (0–1). */
  get volume(): number { return this._volume; }
  set volume(v: number) {
    this._volume = Math.max(0, Math.min(1, v));
    if (this._gain) this._gain.gain.value = this._volume;
  }

  get playing(): boolean { return this._playing; }

  /**
   * Wire this source into the Web Audio graph.
   * Called by AudioManager — not meant to be called directly.
   */
  _wire(ctx: AudioContext, channelGain: GainNode): void {
    this._ctx = ctx;
    this._outputNode = channelGain;

    // Create per-source gain
    this._gain = ctx.createGain();
    this._gain.gain.value = this._volume;

    if (this.spatial) {
      this._panner = ctx.createPanner();
      this._panner.panningModel = 'HRTF';
      this._panner.distanceModel = this.distanceModel;
      this._panner.refDistance = this.refDistance;
      this._panner.maxDistance = this.maxDistance;
      this._panner.rolloffFactor = this.rolloffFactor;
      this._panner.connect(this._gain);
    }

    this._gain.connect(channelGain);

    if (this.autoplay && this.clip) {
      this.play();
    }
  }

  /** Start (or restart) playback from the beginning. */
  play(): void {
    if (!this._ctx || !this.clip) return;
    this.stopInternal();

    const src = this._ctx.createBufferSource();
    src.buffer = this.clip.buffer;
    src.loop = this.loop;

    // Connect: source → panner (if spatial) → gain
    if (this.spatial && this._panner) {
      src.connect(this._panner);
    } else {
      src.connect(this._gain!);
    }

    src.onended = () => {
      if (this._bufferSource === src) {
        this._playing = false;
        this._bufferSource = null;
      }
    };

    src.start(0, this._pauseOffset);
    this._startTime = this._ctx.currentTime - this._pauseOffset;
    this._pauseOffset = 0;
    this._bufferSource = src;
    this._playing = true;
  }

  /** Pause playback (can be resumed later). */
  pause(): void {
    if (!this._playing || !this._bufferSource || !this._ctx) return;
    this._pauseOffset = this._ctx.currentTime - this._startTime;
    this.stopInternal();
    this._playing = false;
  }

  /** Resume from where pause() left off. */
  resume(): void {
    if (this._playing || this._pauseOffset === 0) return;
    this.play();
  }

  /** Fully stop playback and reset position to start. */
  stop(): void {
    this.stopInternal();
    this._pauseOffset = 0;
    this._playing = false;
  }

  /** Returns true while audio is actively playing. */
  isPlaying(): boolean { return this._playing; }

  /**
   * Sync the PannerNode position from this node's world transform.
   * Called once per frame by AudioManager.update().
   */
  syncPosition(): void {
    if (!this._panner) return;
    const m = this.transform.worldMatrix.data;
    this._panner.positionX.value = m[12];
    this._panner.positionY.value = m[13];
    this._panner.positionZ.value = m[14];
  }

  /** Disconnect all audio nodes and release resources. */
  dispose(): void {
    this.stopInternal();
    this._panner?.disconnect();
    this._gain?.disconnect();
    this._panner = null;
    this._gain = null;
    this._ctx = null;
    this._outputNode = null;
  }

  // ---------------------------------------------------------------
  private stopInternal(): void {
    if (this._bufferSource) {
      this._bufferSource.onended = null;
      try { this._bufferSource.stop(); } catch { /* already stopped */ }
      this._bufferSource.disconnect();
      this._bufferSource = null;
    }
  }
}
