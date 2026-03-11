import { Texture, TextureOptions } from '../renderer/Texture';

/**
 * Asynchronous image/texture loader.
 * Loads images from URLs and creates GPU-ready Texture objects.
 */
export class TextureLoader {
  private gl: WebGL2RenderingContext;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
  }

  /**
   * Load an image from the given URL and create a Texture.
   * Supports PNG, JPG, WebP — any format the browser can decode.
   */
  async load(url: string, options?: TextureOptions): Promise<Texture> {
    const image = await this.loadImage(url);
    return Texture.fromImage(this.gl, image, options);
  }

  /**
   * Load an image element from a URL.
   */
  private loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
      img.src = url;
    });
  }
}
