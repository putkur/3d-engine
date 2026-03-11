import { Light, LightType } from './Light';
import { Vector3 } from '../math/Vector3';
import { Matrix4 } from '../math/Matrix4';

/**
 * Directional light — parallel rays defined by a direction vector.
 * Simulates distant light sources like the sun.
 */
export class DirectionalLight extends Light {
  public readonly lightType = LightType.DIRECTIONAL;

  /** World-space direction the light shines towards (normalized). */
  public direction: Vector3 = new Vector3(0, -1, 0);

  // Shadow mapping parameters
  /** Orthographic half-size for the shadow camera frustum. */
  public shadowOrthoSize = 10;
  /** Near plane for shadow camera. */
  public shadowNear = 0.1;
  /** Far plane for shadow camera. */
  public shadowFar = 50;

  constructor(direction?: Vector3, color?: [number, number, number], intensity = 1.0) {
    super('DirectionalLight');
    if (direction) this.direction = direction.normalize();
    if (color) this.color = color;
    this.intensity = intensity;
  }

  /**
   * Compute the light-space (view-projection) matrix for shadow mapping.
   * The light "camera" looks from a position opposite the light direction,
   * centered on the given target/focus point.
   */
  getLightSpaceMatrix(target?: Vector3): Matrix4 {
    const t = target ?? Vector3.zero();
    const dir = this.direction.normalize();
    // Place the light camera behind the target, along the opposite direction
    const lightPos = t.subtract(dir.scale(this.shadowFar * 0.5));

    const view = Matrix4.lookAt(lightPos, t, Vector3.up());
    const s = this.shadowOrthoSize;
    const proj = Matrix4.orthographic(-s, s, -s, s, this.shadowNear, this.shadowFar);
    return proj.multiply(view);
  }
}
