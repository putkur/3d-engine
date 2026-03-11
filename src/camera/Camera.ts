import { mat4 } from 'gl-matrix';
import { SceneNode } from '../scene/SceneNode';
import { Matrix4 } from '../math/Matrix4';

/**
 * Base camera class. Extends SceneNode so it lives in the scene graph.
 * Subclasses provide the projection matrix; the view matrix is derived
 * from the camera's world transform inverse.
 */
export abstract class Camera extends SceneNode {
  /** Type tag used by Scene for categorization. */
  public readonly isCamera = true;

  protected _projectionMatrix: Matrix4 = Matrix4.identity();
  protected _viewMatrix: Matrix4 = Matrix4.identity();
  protected _viewProjectionMatrix: Matrix4 = Matrix4.identity();
  protected _projectionDirty = true;
  protected _vpDirty = true;

  constructor(name = 'Camera') {
    super(name);
  }

  // --- Projection (subclass-defined) ---

  get projectionMatrix(): Matrix4 {
    if (this._projectionDirty) {
      this.updateProjectionMatrix();
      this._projectionDirty = false;
      this._vpDirty = true;
    }
    return this._projectionMatrix;
  }

  /** Implemented by PerspectiveCamera / OrthographicCamera. */
  protected abstract updateProjectionMatrix(): void;

  // --- View matrix ---

  /** View matrix = inverse of camera's world matrix. */
  get viewMatrix(): Matrix4 {
    mat4.invert(this._viewMatrix.data, this.transform.worldMatrix.data);
    this._vpDirty = true;
    return this._viewMatrix;
  }

  // --- Combined view-projection ---

  get viewProjectionMatrix(): Matrix4 {
    const proj = this.projectionMatrix;
    const view = this.viewMatrix;
    mat4.multiply(this._viewProjectionMatrix.data, proj.data, view.data);
    return this._viewProjectionMatrix;
  }
}
