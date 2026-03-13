import { AudioClip } from './AudioClip';
import { AudioManager } from './AudioManager';

/**
 * Asynchronous audio file loader.
 *
 * Fetches an audio file by URL, decodes it via the AudioManager's
 * AudioContext, and returns an AudioClip ready for playback.
 *
 * Supports MP3, OGG, WAV, FLAC — browser-dependent codec availability.
 */
export class AudioLoader {
  private manager: AudioManager;
  private cache = new Map<string, AudioClip>();

  constructor(manager: AudioManager) {
    this.manager = manager;
  }

  /**
   * Load an audio file from `url` and return an `AudioClip`.
   * Results are cached — subsequent calls with the same URL return the
   * previously decoded clip without a network request.
   */
  async load(url: string): Promise<AudioClip> {
    const existing = this.cache.get(url);
    if (existing) return existing;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`AudioLoader: failed to fetch ${url} (${response.status})`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const clip = await this.manager.decodeAudio(arrayBuffer);
    this.cache.set(url, clip);
    return clip;
  }

  /** Remove a cached clip. */
  uncache(url: string): void {
    this.cache.delete(url);
  }

  /** Clear the entire cache. */
  clearCache(): void {
    this.cache.clear();
  }
}
