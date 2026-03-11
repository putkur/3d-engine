import { ShaderProgram } from '../renderer/ShaderProgram';
import { Texture } from '../renderer/Texture';
import { Vector3 } from '../math/Vector3';

export interface MaterialOptions {
  color?: [number, number, number, number];
  diffuseMap?: Texture | null;
  normalMap?: Texture | null;
  specular?: number;
  shininess?: number;
  depthTest?: boolean;
  depthWrite?: boolean;
  blending?: boolean;
  cullFace?: boolean;
  wireframe?: boolean;
}

/**
 * Describes the visual appearance of a mesh.
 * References a ShaderProgram and stores uniform values + render state.
 */
export class Material {
  public shader: ShaderProgram;

  // Uniform values
  public color: [number, number, number, number] = [1, 1, 1, 1];
  public diffuseMap: Texture | null = null;
  public normalMap: Texture | null = null;
  public specular = 0.5;
  public shininess = 32;

  // Render state
  public depthTest = true;
  public depthWrite = true;
  public blending = false;
  public cullFace = true;
  public wireframe = false;

  constructor(shader: ShaderProgram, options?: MaterialOptions) {
    this.shader = shader;
    if (options) {
      if (options.color !== undefined) this.color = options.color;
      if (options.diffuseMap !== undefined) this.diffuseMap = options.diffuseMap ?? null;
      if (options.normalMap !== undefined) this.normalMap = options.normalMap ?? null;
      if (options.specular !== undefined) this.specular = options.specular;
      if (options.shininess !== undefined) this.shininess = options.shininess;
      if (options.depthTest !== undefined) this.depthTest = options.depthTest;
      if (options.depthWrite !== undefined) this.depthWrite = options.depthWrite;
      if (options.blending !== undefined) this.blending = options.blending;
      if (options.cullFace !== undefined) this.cullFace = options.cullFace;
      if (options.wireframe !== undefined) this.wireframe = options.wireframe;
    }
  }

  /**
   * Apply render state to the GL context and set common uniforms.
   */
  bind(gl: WebGL2RenderingContext): void {
    // Render state
    if (this.depthTest) gl.enable(gl.DEPTH_TEST);
    else gl.disable(gl.DEPTH_TEST);

    gl.depthMask(this.depthWrite);

    if (this.blending) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    } else {
      gl.disable(gl.BLEND);
    }

    if (this.cullFace) {
      gl.enable(gl.CULL_FACE);
      gl.cullFace(gl.BACK);
    } else {
      gl.disable(gl.CULL_FACE);
    }

    // Bind shader
    this.shader.use();

    // Set uniforms
    this.shader.setVec4('u_color', this.color[0], this.color[1], this.color[2], this.color[3]);
    this.shader.setFloat('u_specular', this.specular);
    this.shader.setFloat('u_shininess', this.shininess);

    // Textures
    let texUnit = 0;

    if (this.diffuseMap) {
      this.diffuseMap.bind(texUnit);
      this.shader.setInt('u_diffuseMap', texUnit);
      this.shader.setInt('u_useDiffuseMap', 1);
      texUnit++;
    } else {
      this.shader.setInt('u_useDiffuseMap', 0);
    }

    if (this.normalMap) {
      this.normalMap.bind(texUnit);
      this.shader.setInt('u_normalMap', texUnit);
      this.shader.setInt('u_useNormalMap', 1);
      texUnit++;
    } else {
      this.shader.setInt('u_useNormalMap', 0);
    }
  }
}
