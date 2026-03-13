import { mat4 } from 'gl-matrix';
import { SceneNode } from '../scene/SceneNode';
import { Matrix4 } from '../math/Matrix4';

/**
 * A bone hierarchy used for skeletal animation.
 *
 * Each joint is a SceneNode whose world matrix is computed by the normal
 * scene-graph update (scene.updateMatrixWorld()).  The Skeleton's job is to
 * combine those world matrices with the per-joint inverse bind matrices and
 * pack the results into a flat Float32Array that can be uploaded to the GPU
 * as a `mat4` uniform array (u_jointMatrices).
 *
 * Maximum joint palette size: 128 joints (glTF recommendation).
 */
export class Skeleton {
  /** Ordered joint nodes (matches the glTF skin's `joints` array). */
  public readonly joints: SceneNode[];
  /** One inverse-bind-pose matrix per joint. */
  public readonly inverseBindMatrices: Matrix4[];
  /**
   * Flattened joint palette: numJoints × 16 floats.
   * Ready to upload with `gl.uniformMatrix4fv(u_jointMatrices, false, jointMatrices)`.
   */
  public readonly jointMatrices: Float32Array;

  /** Scratch mat4 to avoid allocations in the hot-path. */
  private readonly _scratch: Float32Array = mat4.create() as Float32Array;

  constructor(joints: SceneNode[], inverseBindMatrices: Matrix4[]) {
    if (joints.length !== inverseBindMatrices.length) {
      throw new Error(
        `Skeleton: joints.length (${joints.length}) must equal inverseBindMatrices.length (${inverseBindMatrices.length})`,
      );
    }
    this.joints = joints;
    this.inverseBindMatrices = inverseBindMatrices;
    this.jointMatrices = new Float32Array(joints.length * 16);
  }

  /** Number of joints in this skeleton. */
  get jointCount(): number { return this.joints.length; }

  /**
   * Recompute the joint palette for the current frame.
   * Call this after scene.updateMatrixWorld() and before rendering.
   *
   * jointMatrix[i] = joint[i].worldMatrix * inverseBindMatrix[i]
   */
  update(): void {
    const palette = this.jointMatrices;
    const scratch = this._scratch;

    for (let i = 0; i < this.joints.length; i++) {
      const worldData = this.joints[i].transform.worldMatrix.data;
      const ibmData   = this.inverseBindMatrices[i].data;

      mat4.multiply(scratch, worldData, ibmData);

      const base = i * 16;
      for (let j = 0; j < 16; j++) {
        palette[base + j] = scratch[j];
      }
    }
  }
}
