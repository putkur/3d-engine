import { Camera } from './Camera';
import { Matrix4 } from '../math/Matrix4';

/**
 * Orthographic projection camera.
 * Parameters: left, right, bottom, top, near, far.
 */
export class OrthographicCamera extends Camera {
  private _left: number;
  private _right: number;
  private _bottom: number;
  private _top: number;
  private _near: number;
  private _far: number;

  constructor(
    left = -1,
    right = 1,
    bottom = -1,
    top = 1,
    near = 0.1,
    far = 1000,
  ) {
    super('OrthographicCamera');
    this._left = left;
    this._right = right;
    this._bottom = bottom;
    this._top = top;
    this._near = near;
    this._far = far;
    this._projectionDirty = true;
  }

  get left(): number { return this._left; }
  set left(v: number) { this._left = v; this._projectionDirty = true; }

  get right(): number { return this._right; }
  set right(v: number) { this._right = v; this._projectionDirty = true; }

  get bottom(): number { return this._bottom; }
  set bottom(v: number) { this._bottom = v; this._projectionDirty = true; }

  get top(): number { return this._top; }
  set top(v: number) { this._top = v; this._projectionDirty = true; }

  get near(): number { return this._near; }
  set near(v: number) { this._near = v; this._projectionDirty = true; }

  get far(): number { return this._far; }
  set far(v: number) { this._far = v; this._projectionDirty = true; }

  protected updateProjectionMatrix(): void {
    this._projectionMatrix = Matrix4.orthographic(
      this._left, this._right,
      this._bottom, this._top,
      this._near, this._far,
    );
  }
}
