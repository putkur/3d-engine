import { AudioClip } from './AudioClip';
import { AudioListener } from './AudioListener';
import { AudioSource, AudioSourceOptions } from './AudioSource';

/** Built-in channel group names. */
export type ChannelName = 'sfx' | 'music' | 'ambient';

/**
 * Central audio system owner.
 *
 * Manages the single `AudioContext`, master volume, per-channel volume groups,
 * and the set of active `AudioSource` nodes. The context is created lazily on
 * the first user gesture to comply with the browser autoplay policy.
 *
 * Usage:
 * ```ts
 * const audio = new AudioManager();
 * audio.ensureContext();                        // call from a click handler
 * const clip = await audio.decodeAudio(buffer); // decoded AudioClip
 * const src  = audio.createSource({ clip, spatial: true, loop: true });
 * scene.add(src);                               // attach to scene graph
 *
 * // Each frame:
 * audio.update(listener);
 * ```
 */
export class AudioManager {
  private _ctx: AudioContext | null = null;
  private _masterGain: GainNode | null = null;

  /** Per-channel gain nodes keyed by channel name. */
  private _channels = new Map<ChannelName, GainNode>();
  /** All sources managed by this manager. */
  private readonly _sources: AudioSource[] = [];

  private _masterVolume = 1;
  private _visibilityHandler: (() => void) | null = null;

  /** Lazily create the AudioContext (safe to call multiple times). */
  ensureContext(): AudioContext {
    if (this._ctx) return this._ctx;

    this._ctx = new AudioContext();
    this._masterGain = this._ctx.createGain();
    this._masterGain.gain.value = this._masterVolume;
    this._masterGain.connect(this._ctx.destination);

    // Create the three default channel groups
    for (const name of ['sfx', 'music', 'ambient'] as ChannelName[]) {
      const g = this._ctx.createGain();
      g.connect(this._masterGain);
      this._channels.set(name, g);
    }

    // Suspend / resume when the tab gains or loses visibility
    this._visibilityHandler = () => {
      if (!this._ctx) return;
      if (document.hidden) {
        this._ctx.suspend();
      } else {
        this._ctx.resume();
      }
    };
    document.addEventListener('visibilitychange', this._visibilityHandler);

    return this._ctx;
  }

  /** The raw AudioContext (null until ensureContext is called). */
  get context(): AudioContext | null { return this._ctx; }

  // --- Volume controls ---

  get masterVolume(): number { return this._masterVolume; }
  set masterVolume(v: number) {
    this._masterVolume = Math.max(0, Math.min(1, v));
    if (this._masterGain) this._masterGain.gain.value = this._masterVolume;
  }

  /** Get the volume for a channel group (0–1). */
  getChannelVolume(channel: ChannelName): number {
    return this._channels.get(channel)?.gain.value ?? 1;
  }

  /** Set the volume for a channel group (0–1). */
  setChannelVolume(channel: ChannelName, vol: number): void {
    const g = this._channels.get(channel);
    if (g) g.gain.value = Math.max(0, Math.min(1, vol));
  }

  // --- Source management ---

  /**
   * Create a new AudioSource, wire it into the audio graph under the given
   * channel, and register it with the manager.
   */
  createSource(options: AudioSourceOptions = {}, channel: ChannelName = 'sfx'): AudioSource {
    const ctx = this.ensureContext();
    const src = new AudioSource(options);
    const channelGain = this._channels.get(channel)!;
    src._wire(ctx, channelGain);
    this._sources.push(src);
    return src;
  }

  /** Remove a source from the manager and disconnect it. */
  removeSource(source: AudioSource): void {
    const idx = this._sources.indexOf(source);
    if (idx !== -1) {
      this._sources.splice(idx, 1);
      source.dispose();
    }
  }

  /** All registered sources (read-only snapshot). */
  get sources(): readonly AudioSource[] { return this._sources; }

  // --- Per-frame update ---

  /**
   * Called once per frame after world transforms are up-to-date.
   * Syncs the listener and all spatial source positions.
   */
  update(listener: AudioListener): void {
    if (!this._ctx) return;
    listener.syncToContext(this._ctx);
    for (const src of this._sources) {
      src.syncPosition();
    }
  }

  // --- Decoding ---

  /** Decode raw audio bytes into a playable AudioClip. */
  async decodeAudio(arrayBuffer: ArrayBuffer): Promise<AudioClip> {
    const ctx = this.ensureContext();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    return new AudioClip(audioBuffer);
  }

  // --- Lifecycle ---

  /** Resume the audio context (e.g. after a user gesture). */
  resume(): void {
    this._ctx?.resume();
  }

  /** Suspend the audio context (pause all output). */
  suspend(): void {
    this._ctx?.suspend();
  }

  /** Tear down the manager — stops everything and closes the context. */
  dispose(): void {
    for (const src of this._sources) src.dispose();
    this._sources.length = 0;

    if (this._visibilityHandler) {
      document.removeEventListener('visibilitychange', this._visibilityHandler);
      this._visibilityHandler = null;
    }

    this._ctx?.close();
    this._ctx = null;
    this._masterGain = null;
    this._channels.clear();
  }
}
