import { SceneNode } from '../scene/SceneNode';

/** Light type enum matching GLSL: 0=directional, 1=point, 2=spot. */
export enum LightType {
  DIRECTIONAL = 0,
  POINT = 1,
  SPOT = 2,
}

/**
 * Base light class. Extends SceneNode so it lives in the scene graph.
 * Subclasses set the `lightType` and provide specific parameters.
 */
export abstract class Light extends SceneNode {
  /** Type tag used by Scene for categorization. */
  public readonly isLight = true;

  public abstract readonly lightType: LightType;

  /** RGB color components (0–1). */
  public color: [number, number, number] = [1, 1, 1];

  /** Brightness multiplier. */
  public intensity = 1.0;

  /** Whether this light casts shadows. */
  public castShadow = false;

  constructor(name = 'Light') {
    super(name);
  }
}
