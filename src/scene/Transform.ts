import { mat4 } from 'gl-matrix';
import { Vector3 } from '../math/Vector3';
import { Quaternion } from '../math/Quaternion';
import { Matrix4 } from '../math/Matrix4';

export class Transform {
  private _position: Vector3 = Vector3.zero();
  private _rotation: Quaternion = Quaternion.identity();
  private _scale: Vector3 = Vector3.one();

  private _localMatrix: Matrix4 = Matrix4.identity();
  private _worldMatrix: Matrix4 = Matrix4.identity();

  private _localDirty = true;
  private _worldDirty = true;

  // --- Position ---

  get position(): Vector3 {
    return this._position;
  }

  set position(v: Vector3) {
    this._position = v;
    this.markDirty();
  }

  setPosition(x: number, y: number, z: number): this {
    this._position.set(x, y, z);
    this.markDirty();
    return this;
  }

  // --- Rotation ---

  get rotation(): Quaternion {
    return this._rotation;
  }

  set rotation(q: Quaternion) {
    this._rotation = q;
    this.markDirty();
  }

  setRotationFromEuler(xDeg: number, yDeg: number, zDeg: number): this {
    this._rotation = Quaternion.fromEuler(xDeg, yDeg, zDeg);
    this.markDirty();
    return this;
  }

  // --- Scale ---

  get scale(): Vector3 {
    return this._scale;
  }

  set scale(v: Vector3) {
    this._scale = v;
    this.markDirty();
  }

  setScale(x: number, y: number, z: number): this {
    this._scale.set(x, y, z);
    this.markDirty();
    return this;
  }

  // --- Matrices ---

  get localMatrix(): Matrix4 {
    if (this._localDirty) {
      this.updateLocalMatrix();
    }
    return this._localMatrix;
  }

  get worldMatrix(): Matrix4 {
    return this._worldMatrix;
  }

  /** Mark local matrix as needing recalculation. */
  markDirty(): void {
    this._localDirty = true;
    this._worldDirty = true;
  }

  get needsWorldUpdate(): boolean {
    return this._worldDirty || this._localDirty;
  }

  private updateLocalMatrix(): void {
    mat4.fromRotationTranslationScale(
      this._localMatrix.data,
      this._rotation.data,
      this._position.data,
      this._scale.data,
    );
    this._localDirty = false;
  }

  /**
   * Update the world matrix.
   * If a parent world matrix is provided, world = parent * local.
   * Otherwise world = local.
   */
  updateWorldMatrix(parentWorldMatrix?: Matrix4): void {
    if (this._localDirty) {
      this.updateLocalMatrix();
    }

    if (parentWorldMatrix) {
      mat4.multiply(
        this._worldMatrix.data,
        parentWorldMatrix.data,
        this._localMatrix.data,
      );
    } else {
      mat4.copy(this._worldMatrix.data, this._localMatrix.data);
    }

    this._worldDirty = false;
  }

  /** Get the world-space forward direction (-Z). */
  getForward(): Vector3 {
    return this._worldMatrix.transformDirection(Vector3.forward());
  }

  /** Get the world-space right direction (+X). */
  getRight(): Vector3 {
    return this._worldMatrix.transformDirection(Vector3.right());
  }

  /** Get the world-space up direction (+Y). */
  getUp(): Vector3 {
    return this._worldMatrix.transformDirection(Vector3.up());
  }
}
