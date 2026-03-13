import { Texture } from '../renderer/Texture';
import { TextureLoader } from './TextureLoader';
import { OBJLoader } from './OBJLoader';
import { GLTFLoader } from './GLTFLoader';
import type { GLTFLoadResult } from './GLTFLoader';
import { ShaderProgram } from '../renderer/ShaderProgram';
import { SceneNode } from '../scene/SceneNode';
import { TextureOptions } from '../renderer/Texture';

/**
 * Supported asset types managed by the AssetManager.
 */
export type Asset = Texture | SceneNode | GLTFLoadResult;

/**
 * Progress callback for asset loading.
 */
export type ProgressCallback = (loaded: number, total: number) => void;

/**
 * Centralized asset loading and caching manager.
 * Prevents duplicate loads of the same URL and tracks progress.
 */
export class AssetManager {
  private gl: WebGL2RenderingContext;
  private cache: Map<string, Asset> = new Map();
  private pending: Map<string, Promise<Asset>> = new Map();

  private textureLoader: TextureLoader;
  private objLoader: OBJLoader;
  private gltfLoader: GLTFLoader;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.textureLoader = new TextureLoader(gl);
    this.objLoader = new OBJLoader(gl);
    this.gltfLoader = new GLTFLoader(gl);
  }

  /**
   * Load a texture from URL. Returns cached version if already loaded.
   */
  async loadTexture(url: string, options?: TextureOptions): Promise<Texture> {
    const key = `tex:${url}`;
    return this.loadAsset(key, () => this.textureLoader.load(url, options)) as Promise<Texture>;
  }

  /**
   * Load an OBJ model from URL. Returns cached version if already loaded.
   */
  async loadOBJ(url: string, shader: ShaderProgram): Promise<SceneNode> {
    const key = `obj:${url}`;
    return this.loadAsset(key, () => this.objLoader.load(url, shader)) as Promise<SceneNode>;
  }

  /**
   * Load a glTF/GLB model from URL. Returns cached version if already loaded.
   */
  async loadGLTF(url: string, shader: ShaderProgram): Promise<GLTFLoadResult> {
    const key = `gltf:${url}`;
    return this.loadAsset(key, () => this.gltfLoader.load(url, shader)) as Promise<GLTFLoadResult>;
  }

  /**
   * Load multiple assets in parallel, with optional progress tracking.
   */
  async loadAll(
    tasks: Array<{ type: 'texture'; url: string; options?: TextureOptions } |
                  { type: 'obj'; url: string; shader: ShaderProgram } |
                  { type: 'gltf'; url: string; shader: ShaderProgram }>,
    onProgress?: ProgressCallback,
  ): Promise<Asset[]> {
    let loaded = 0;
    const total = tasks.length;

    const promises = tasks.map(async (task) => {
      let result: Asset;
      switch (task.type) {
        case 'texture':
          result = await this.loadTexture(task.url, task.options);
          break;
        case 'obj':
          result = await this.loadOBJ(task.url, task.shader);
          break;
        case 'gltf':
          result = await this.loadGLTF(task.url, task.shader);
          break;
      }
      loaded++;
      onProgress?.(loaded, total);
      return result;
    });

    return Promise.all(promises);
  }

  /**
   * Get a previously loaded asset from cache.
   */
  get(key: string): Asset | undefined {
    return this.cache.get(key);
  }

  /**
   * Check if an asset is already cached.
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Remove an asset from the cache.
   */
  remove(key: string): void {
    this.cache.delete(key);
    this.pending.delete(key);
  }

  /**
   * Clear all cached assets.
   */
  clear(): void {
    this.cache.clear();
    this.pending.clear();
  }

  /**
   * Internal: load with caching and deduplication.
   */
  private async loadAsset(key: string, loader: () => Promise<Asset>): Promise<Asset> {
    // Return cached
    const cached = this.cache.get(key);
    if (cached) return cached;

    // Return in-flight promise (dedup concurrent loads of same URL)
    const inflight = this.pending.get(key);
    if (inflight) return inflight;

    // Start new load
    const promise = loader().then(asset => {
      this.cache.set(key, asset);
      this.pending.delete(key);
      return asset;
    }).catch(err => {
      this.pending.delete(key);
      throw err;
    });

    this.pending.set(key, promise);
    return promise;
  }
}
