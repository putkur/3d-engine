import { Light, LightType } from './Light';
import { Vector3 } from '../math/Vector3';

/**
 * Point light — emits light in all directions from a position.
 * Attenuates with distance using the `range` parameter.
 */
export class PointLight extends Light {
  public readonly lightType = LightType.POINT;

  /** Maximum range of the light. Objects beyond this distance receive no light. */
  public range = 10;

  constructor(color?: [number, number, number], intensity = 1.0, range = 10) {
    super('PointLight');
    if (color) this.color = color;
    this.intensity = intensity;
    this.range = range;
  }

  /** Convenience: get world position from transform. */
  getWorldPosition(): Vector3 {
    return this.transform.worldMatrix.getTranslation();
  }
}
