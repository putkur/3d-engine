import { Light, LightType } from './Light';
import { Vector3 } from '../math/Vector3';
import { degToRad } from '../math/MathUtils';

/**
 * Spot light — emits a cone of light from a position along a direction.
 * Has inner and outer cone angles for soft edges.
 */
export class SpotLight extends Light {
  public readonly lightType = LightType.SPOT;

  /** World-space direction the spotlight points towards (normalized). */
  public direction: Vector3 = new Vector3(0, -1, 0);

  /** Maximum range. */
  public range = 10;

  /** Inner cone half-angle in degrees (full brightness inside this cone). */
  public innerAngle = 15;

  /** Outer cone half-angle in degrees (light fades to zero at this cone). */
  public outerAngle = 30;

  constructor(
    direction?: Vector3,
    color?: [number, number, number],
    intensity = 1.0,
    range = 10,
    innerAngle = 15,
    outerAngle = 30,
  ) {
    super('SpotLight');
    if (direction) this.direction = direction.normalize();
    if (color) this.color = color;
    this.intensity = intensity;
    this.range = range;
    this.innerAngle = innerAngle;
    this.outerAngle = outerAngle;
  }

  /** Get the cosine of the inner cone angle (for shader). */
  get innerAngleCos(): number {
    return Math.cos(degToRad(this.innerAngle));
  }

  /** Get the cosine of the outer cone angle (for shader). */
  get outerAngleCos(): number {
    return Math.cos(degToRad(this.outerAngle));
  }

  /** Convenience: get world position from transform. */
  getWorldPosition(): Vector3 {
    return this.transform.worldMatrix.getTranslation();
  }
}
