import { ShaderProgram } from '../renderer/ShaderProgram';
import { Texture } from '../renderer/Texture';

export interface PBRMaterialOptions {
  albedo?: [number, number, number, number];
  metallic?: number;
  roughness?: number;
  ao?: number;
  albedoMap?: Texture | null;
  normalMap?: Texture | null;
  metallicRoughnessMap?: Texture | null;
  depthTest?: boolean;
  depthWrite?: boolean;
  blending?: boolean;
  cullFace?: boolean;
}

/**
 * Physically-Based Rendering material using metallic-roughness workflow.
 * Compatible with glTF 2.0 PBR model.
 */
export class PBRMaterial {
  public shader: ShaderProgram;

  public albedo: [number, number, number, number] = [1, 1, 1, 1];
  public metallic = 0.0;
  public roughness = 0.5;
  public ao = 1.0;

  public albedoMap: Texture | null = null;
  public normalMap: Texture | null = null;
  public metallicRoughnessMap: Texture | null = null;

  public depthTest = true;
  public depthWrite = true;
  public blending = false;
  public cullFace = true;

  constructor(shader: ShaderProgram, options?: PBRMaterialOptions) {
    this.shader = shader;
    if (options) {
      if (options.albedo !== undefined) this.albedo = options.albedo;
      if (options.metallic !== undefined) this.metallic = options.metallic;
      if (options.roughness !== undefined) this.roughness = options.roughness;
      if (options.ao !== undefined) this.ao = options.ao;
      if (options.albedoMap !== undefined) this.albedoMap = options.albedoMap ?? null;
      if (options.normalMap !== undefined) this.normalMap = options.normalMap ?? null;
      if (options.metallicRoughnessMap !== undefined) this.metallicRoughnessMap = options.metallicRoughnessMap ?? null;
      if (options.depthTest !== undefined) this.depthTest = options.depthTest;
      if (options.depthWrite !== undefined) this.depthWrite = options.depthWrite;
      if (options.blending !== undefined) this.blending = options.blending;
      if (options.cullFace !== undefined) this.cullFace = options.cullFace;
    }
  }

  bind(gl: WebGL2RenderingContext): void {
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

    this.shader.use();

    this.shader.setVec4('u_albedoColor', this.albedo[0], this.albedo[1], this.albedo[2], this.albedo[3]);
    this.shader.setFloat('u_metallic', this.metallic);
    this.shader.setFloat('u_roughness', this.roughness);
    this.shader.setFloat('u_ao', this.ao);

    let texUnit = 0;

    if (this.albedoMap) {
      this.albedoMap.bind(texUnit);
      this.shader.setInt('u_albedoMap', texUnit);
      this.shader.setInt('u_useAlbedoMap', 1);
      texUnit++;
    } else {
      this.shader.setInt('u_useAlbedoMap', 0);
    }

    if (this.normalMap) {
      this.normalMap.bind(texUnit);
      this.shader.setInt('u_normalMap', texUnit);
      this.shader.setInt('u_useNormalMap', 1);
      texUnit++;
    } else {
      this.shader.setInt('u_useNormalMap', 0);
    }

    if (this.metallicRoughnessMap) {
      this.metallicRoughnessMap.bind(texUnit);
      this.shader.setInt('u_metallicRoughnessMap', texUnit);
      this.shader.setInt('u_useMetallicRoughnessMap', 1);
      texUnit++;
    } else {
      this.shader.setInt('u_useMetallicRoughnessMap', 0);
    }
  }
}
