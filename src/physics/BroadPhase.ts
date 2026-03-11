import { RigidBody } from './RigidBody';
import { AABB } from './Collider';

/**
 * Collision pair from broad phase.
 */
export interface BroadPhasePair {
  indexA: number;
  indexB: number;
}

/**
 * Broad-phase collision detection using sweep-and-prune on the X axis
 * with a full AABB overlap check.
 */
export class BroadPhase {
  /**
   * Generate candidate collision pairs from a list of rigid bodies.
   * Only bodies with colliders are considered.
   * Static-vs-static pairs are skipped.
   */
  computePairs(bodies: RigidBody[]): BroadPhasePair[] {
    const n = bodies.length;
    const aabbs: (AABB | null)[] = new Array(n);
    const entries: { index: number; minX: number }[] = [];

    // Compute AABBs
    for (let i = 0; i < n; i++) {
      const aabb = bodies[i].getAABB();
      aabbs[i] = aabb;
      if (aabb) {
        entries.push({ index: i, minX: aabb.min.x });
      }
    }

    // Sort by min X
    entries.sort((a, b) => a.minX - b.minX);

    const pairs: BroadPhasePair[] = [];

    // Sweep and prune on X, then verify Y and Z overlap
    for (let i = 0; i < entries.length; i++) {
      const ei = entries[i];
      const ai = aabbs[ei.index]!;
      const bodyI = bodies[ei.index];

      for (let j = i + 1; j < entries.length; j++) {
        const ej = entries[j];
        const aj = aabbs[ej.index]!;

        // If min X of j is beyond max X of i, no more overlaps for i
        if (aj.min.x > ai.max.x) break;

        // Skip static-vs-static
        const bodyJ = bodies[ej.index];
        if (bodyI.bodyType !== 0 && bodyJ.bodyType !== 0) continue; // neither is DYNAMIC

        // Skip sleeping pairs
        if (bodyI.isSleeping && bodyJ.isSleeping) continue;

        // Check Y and Z overlap
        if (ai.max.y < aj.min.y || ai.min.y > aj.max.y) continue;
        if (ai.max.z < aj.min.z || ai.min.z > aj.max.z) continue;

        pairs.push({
          indexA: Math.min(ei.index, ej.index),
          indexB: Math.max(ei.index, ej.index),
        });
      }
    }

    return pairs;
  }
}
