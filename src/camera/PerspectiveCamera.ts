import { Camera } from './Camera';
import { Matrix4 } from '../math/Matrix4';

/**
 * Perspective projection camera.
 * Parameters: fov (degrees), aspect ratio, near plane, far plane.
 */
export class PerspectiveCamera extends Camera {
  private _fov: number;
  private _aspect: number;
  private _near: number;
  private _far: number;

  /**
   * @param fov    Vertical field of view in degrees (default 60)
   * @param aspect Width / height ratio (default 16/9)
   * @param near   Near clipping plane (default 0.1)
   * @param far    Far clipping plane (default 1000)
   */
  constructor(fov = 60, aspect = 16 / 9, near = 0.1, far = 1000) {
    super('PerspectiveCamera');
    this._fov = fov;
    this._aspect = aspect;
    this._near = near;
    this._far = far;
    this._projectionDirty = true;
  }

  get fov(): number { return this._fov; }
  set fov(v: number) { this._fov = v; this._projectionDirty = true; }

  get aspect(): number { return this._aspect; }
  set aspect(v: number) { this._aspect = v; this._projectionDirty = true; }

  get near(): number { return this._near; }
  set near(v: number) { this._near = v; this._projectionDirty = true; }

  get far(): number { return this._far; }
  set far(v: number) { this._far = v; this._projectionDirty = true; }

  protected updateProjectionMatrix(): void {
    this._projectionMatrix = Matrix4.perspective(this._fov, this._aspect, this._near, this._far);
  }
}
