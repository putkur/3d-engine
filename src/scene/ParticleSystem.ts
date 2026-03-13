import { ShaderProgram } from '../renderer/ShaderProgram';
import { VertexBuffer, BufferUsage } from '../renderer/VertexBuffer';
import { IndexBuffer } from '../renderer/IndexBuffer';
import { VertexArray } from '../renderer/VertexArray';
import { Texture } from '../renderer/Texture';
import { Camera } from '../camera/Camera';
import { Vector3 } from '../math/Vector3';

import particleVert from '../renderer/shaders/particle.vert';
import particleFrag from '../renderer/shaders/particle.frag';

export interface ParticleSystemOptions {
  maxParticles?: number;

  /** Particles emitted per second. */
  emissionRate?: number;
  /** Particle lifetime in seconds. */
  lifetime?: number;
  /** Half-range for random lifetime variation. */
  lifetimeVariance?: number;

  /** Initial speed along emitter direction. */
  speed?: number;
  speedVariance?: number;

  /** World-space gravity applied each frame. */
  gravity?: Vector3;

  /** Start/end size for size-over-lifetime interpolation. */
  startSize?: number;
  endSize?: number;

  /** Start/end color [r,g,b,a] for color-over-lifetime. */
  startColor?: [number, number, number, number];
  endColor?: [number, number, number, number];

  /** Emitter shape: 'point' or 'sphere'. */
  emitterShape?: 'point' | 'sphere';
  /** Sphere emitter radius. */
  emitterRadius?: number;

  /** Optional billboard texture. */
  texture?: Texture | null;
}

interface Particle {
  posX: number; posY: number; posZ: number;
  velX: number; velY: number; velZ: number;
  life: number;
  maxLife: number;
  alive: boolean;
}

/**
 * GPU-billboarded particle system with instanced rendering.
 *
 * Features: emission rate, lifetime, velocity + gravity, size-over-life,
 * color-over-life, billboard quad, optional texture.
 */
export class ParticleSystem {
  public position = new Vector3(0, 0, 0);
  public direction = new Vector3(0, 1, 0);
  public enabled = true;

  // Options (mutable at runtime)
  public emissionRate: number;
  public lifetime: number;
  public lifetimeVariance: number;
  public speed: number;
  public speedVariance: number;
  public gravity: Vector3;
  public startSize: number;
  public endSize: number;
  public startColor: [number, number, number, number];
  public endColor: [number, number, number, number];
  public emitterShape: 'point' | 'sphere';
  public emitterRadius: number;
  public texture: Texture | null;

  // Internals
  private gl: WebGL2RenderingContext;
  private shader: ShaderProgram;
  private quadVAO: VertexArray;
  private quadVBO: VertexBuffer;
  private quadIBO: IndexBuffer;
  private instanceVBO: VertexBuffer;
  private instanceData: Float32Array;
  private particles: Particle[];
  private maxParticles: number;
  private aliveCount = 0;
  private emitAccumulator = 0;

  // Per-instance data layout: pos(3) + size(1) + color(4) = 8 floats
  private static readonly INSTANCE_FLOATS = 8;

  constructor(gl: WebGL2RenderingContext, options?: ParticleSystemOptions) {
    this.gl = gl;
    const o = options ?? {};

    this.maxParticles = o.maxParticles ?? 1000;
    this.emissionRate = o.emissionRate ?? 50;
    this.lifetime = o.lifetime ?? 2.0;
    this.lifetimeVariance = o.lifetimeVariance ?? 0.3;
    this.speed = o.speed ?? 3.0;
    this.speedVariance = o.speedVariance ?? 0.5;
    this.gravity = o.gravity ?? new Vector3(0, -2, 0);
    this.startSize = o.startSize ?? 0.15;
    this.endSize = o.endSize ?? 0.02;
    this.startColor = o.startColor ?? [1, 0.6, 0.1, 1];
    this.endColor = o.endColor ?? [1, 0.1, 0.0, 0];
    this.emitterShape = o.emitterShape ?? 'point';
    this.emitterRadius = o.emitterRadius ?? 0.5;
    this.texture = o.texture ?? null;

    this.shader = ShaderProgram.create(gl, particleVert, particleFrag);

    // Billboard quad: 2 triangles, centered at origin
    const quadVerts = new Float32Array([
      // pos.x, pos.y, pos.z,  uv.x, uv.y
      -0.5, -0.5, 0,  0, 0,
       0.5, -0.5, 0,  1, 0,
       0.5,  0.5, 0,  1, 1,
      -0.5,  0.5, 0,  0, 1,
    ]);
    const quadIndices = new Uint16Array([0, 1, 2,  2, 3, 0]);

    this.quadVBO = new VertexBuffer(gl, quadVerts, BufferUsage.STATIC);
    this.quadIBO = new IndexBuffer(gl, quadIndices, BufferUsage.STATIC);

    // Instance data
    this.instanceData = new Float32Array(this.maxParticles * ParticleSystem.INSTANCE_FLOATS);
    this.instanceVBO = new VertexBuffer(gl, this.instanceData, BufferUsage.DYNAMIC);

    // VAO
    this.quadVAO = new VertexArray(gl);
    const FLOAT = 4;
    this.quadVAO.addVertexBuffer(this.quadVBO, [
      { location: 0, size: 3, stride: 5 * FLOAT, offset: 0 },
      { location: 1, size: 2, stride: 5 * FLOAT, offset: 3 * FLOAT },
    ]);

    // Instance attributes
    const instStride = ParticleSystem.INSTANCE_FLOATS * FLOAT;
    gl.bindVertexArray(this.quadVAO.handle);
    this.instanceVBO.bind();
    // a_particlePos (location 2)
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 3, gl.FLOAT, false, instStride, 0);
    gl.vertexAttribDivisor(2, 1);
    // a_particleSize (location 3)
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 1, gl.FLOAT, false, instStride, 3 * FLOAT);
    gl.vertexAttribDivisor(3, 1);
    // a_particleColor (location 4)
    gl.enableVertexAttribArray(4);
    gl.vertexAttribPointer(4, 4, gl.FLOAT, false, instStride, 4 * FLOAT);
    gl.vertexAttribDivisor(4, 1);
    this.instanceVBO.unbind();
    gl.bindVertexArray(null);

    this.quadVAO.setIndexBuffer(this.quadIBO);

    // Particle pool
    this.particles = [];
    for (let i = 0; i < this.maxParticles; i++) {
      this.particles.push({
        posX: 0, posY: 0, posZ: 0,
        velX: 0, velY: 0, velZ: 0,
        life: 0, maxLife: 1, alive: false,
      });
    }
  }

  /**
   * Update particle simulation. Call once per frame.
   */
  update(dt: number): void {
    if (!this.enabled) return;

    // Emit new particles
    this.emitAccumulator += dt * this.emissionRate;
    while (this.emitAccumulator >= 1) {
      this.emitAccumulator -= 1;
      this.emit();
    }

    // Update alive particles
    const gx = this.gravity.x;
    const gy = this.gravity.y;
    const gz = this.gravity.z;

    this.aliveCount = 0;
    const IF = ParticleSystem.INSTANCE_FLOATS;

    for (let i = 0; i < this.maxParticles; i++) {
      const p = this.particles[i];
      if (!p.alive) continue;

      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        continue;
      }

      // Physics
      p.velX += gx * dt;
      p.velY += gy * dt;
      p.velZ += gz * dt;
      p.posX += p.velX * dt;
      p.posY += p.velY * dt;
      p.posZ += p.velZ * dt;

      // Life factor 0→1 (birth→death)
      const t = 1 - p.life / p.maxLife;

      const size = this.startSize + (this.endSize - this.startSize) * t;
      const r = this.startColor[0] + (this.endColor[0] - this.startColor[0]) * t;
      const g = this.startColor[1] + (this.endColor[1] - this.startColor[1]) * t;
      const b = this.startColor[2] + (this.endColor[2] - this.startColor[2]) * t;
      const a = this.startColor[3] + (this.endColor[3] - this.startColor[3]) * t;

      const off = this.aliveCount * IF;
      this.instanceData[off] = p.posX;
      this.instanceData[off + 1] = p.posY;
      this.instanceData[off + 2] = p.posZ;
      this.instanceData[off + 3] = size;
      this.instanceData[off + 4] = r;
      this.instanceData[off + 5] = g;
      this.instanceData[off + 6] = b;
      this.instanceData[off + 7] = a;

      this.aliveCount++;
    }

    if (this.aliveCount > 0) {
      this.instanceVBO.update(
        new Float32Array(this.instanceData.buffer, 0, this.aliveCount * IF),
      );
    }
  }

  /**
   * Render all alive particles. Call after scene render.
   */
  render(camera: Camera): void {
    if (this.aliveCount === 0) return;
    const gl = this.gl;

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // Additive blending for fire/glow
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);

    this.shader.use();
    this.shader.setMat4('u_view', camera.viewMatrix.data);
    this.shader.setMat4('u_projection', camera.projectionMatrix.data);

    if (this.texture) {
      this.texture.bind(0);
      this.shader.setInt('u_texture', 0);
      this.shader.setInt('u_useTexture', 1);
    } else {
      this.shader.setInt('u_useTexture', 0);
    }

    this.quadVAO.bind();
    gl.drawElementsInstanced(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0, this.aliveCount);
    this.quadVAO.unbind();

    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.enable(gl.CULL_FACE);
  }

  dispose(): void {
    this.quadVAO.destroy();
    this.quadVBO.destroy();
    this.quadIBO.destroy();
    this.instanceVBO.destroy();
    this.shader.destroy();
  }

  // ------------------------------------------------------------------
  // Internal
  // ------------------------------------------------------------------

  private emit(): void {
    // Find a dead particle slot
    for (let i = 0; i < this.maxParticles; i++) {
      const p = this.particles[i];
      if (p.alive) continue;

      // Spawn position
      let ox = 0, oy = 0, oz = 0;
      if (this.emitterShape === 'sphere') {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = Math.cbrt(Math.random()) * this.emitterRadius;
        ox = r * Math.sin(phi) * Math.cos(theta);
        oy = r * Math.sin(phi) * Math.sin(theta);
        oz = r * Math.cos(phi);
      }
      p.posX = this.position.x + ox;
      p.posY = this.position.y + oy;
      p.posZ = this.position.z + oz;

      // Velocity: main direction + random spread
      const dir = this.direction.normalize();
      const spd = this.speed + (Math.random() - 0.5) * 2 * this.speedVariance;
      // Random cone spread
      const spread = 0.3;
      p.velX = (dir.x + (Math.random() - 0.5) * spread) * spd;
      p.velY = (dir.y + (Math.random() - 0.5) * spread) * spd;
      p.velZ = (dir.z + (Math.random() - 0.5) * spread) * spd;

      p.maxLife = this.lifetime + (Math.random() - 0.5) * 2 * this.lifetimeVariance;
      p.life = p.maxLife;
      p.alive = true;
      return;
    }
  }
}
