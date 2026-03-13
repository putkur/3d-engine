/**
 * Thin wrapper around a decoded Web Audio `AudioBuffer`.
 *
 * AudioClips are purely data — one clip can be shared by many AudioSources.
 * The clip is created by `AudioManager.decodeAudio()` or `AudioLoader.load()`.
 */
export class AudioClip {
  public readonly buffer: AudioBuffer;

  constructor(buffer: AudioBuffer) {
    this.buffer = buffer;
  }

  /** Duration in seconds. */
  get duration(): number {
    return this.buffer.duration;
  }

  /** Sample rate in Hz. */
  get sampleRate(): number {
    return this.buffer.sampleRate;
  }

  /** Number of audio channels (1 = mono, 2 = stereo, etc.). */
  get numberOfChannels(): number {
    return this.buffer.numberOfChannels;
  }
}
