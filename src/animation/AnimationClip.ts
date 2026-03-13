import { AnimationTrack } from './AnimationTrack';

/**
 * A named, data-only collection of AnimationTrack instances that together
 * describe a complete animation (e.g. "walk", "idle", "jump").
 *
 * Clips are purely data — playback and blending are handled by AnimationMixer.
 */
export class AnimationClip {
  public readonly name: string;
  public readonly tracks: AnimationTrack[];
  public readonly duration: number;

  constructor(name: string, tracks: AnimationTrack[], duration?: number) {
    this.name = name;
    this.tracks = tracks;
    // If duration not supplied, derive from the longest track.
    this.duration = duration ?? tracks.reduce((max, t) => Math.max(max, t.duration), 0);
  }

  /** Look up a track by target node name and path, e.g. "Shoulder", "rotation". */
  findTrack(nodeName: string, path: string): AnimationTrack | undefined {
    return this.tracks.find(t => t.targetNodeName === nodeName && t.targetPath === path);
  }
}
