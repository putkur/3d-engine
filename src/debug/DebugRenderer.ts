import { ShaderProgram } from '../renderer/ShaderProgram';
import { VertexBuffer, BufferUsage } from '../renderer/VertexBuffer';
import { VertexArray } from '../renderer/VertexArray';
import { Matrix4 } from '../math/Matrix4';
import { Vector3 } from '../math/Vector3';
import { Camera } from '../camera/Camera';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { ColliderType } from '../physics/Collider';
import { BoxCollider } from '../physics/BoxCollider';
import { SphereCollider } from '../physics/SphereCollider';
import { basicVert, basicFrag } from '../renderer/shaders';

/** Max number of line-segment vertices per frame. 2 vertices per line. */
const MAX_LINE_VERTS = 65536;
/** Floats per vertex: 3 pos + 3 color = 6. */
const FLOATS_PER_VERT = 6;

// Box edge index pairs (12 edges connecting 8 vertices)
const BOX_EDGES = [
  0, 1, 1, 3, 3, 2, 2, 0, // bottom face
  4, 5, 5, 7, 7, 6, 6, 4, // top face
  0, 4, 1, 5, 2, 6, 3, 7, // vertical edges
];

/**
 * Debug renderer for wireframes, collider visualisation, grid, axis gizmo,
 * and arbitrary lines / points.
 *
 * Uses an unlit shader (basic.vert / basic.frag) with gl.LINES.
 * Rendered after the main pass — call `render(camera)` at the end of each frame.
 */
export class DebugRenderer {
  private gl: WebGL2RenderingContext;
  private shader: ShaderProgram;
  private vao: VertexArray;
  private vbo: VertexBuffer;
  private data: Float32Array;
  private vertexCount = 0;

  /** Whether debug rendering is enabled. */
  public enabled = true;
  /** Draw physics colliders. */
  public showColliders = true;
  /** Draw world-space grid. */
  public showGrid = true;
  /** Draw axis gizmo at origin. */
  public showAxes = true;

  /** Grid half-size in units. */
  public gridSize = 20;
  /** Grid step. */
  public gridStep = 1;
  /** Grid color [r, g, b]. */
  public gridColor: [number, number, number] = [0.3, 0.3, 0.3];
  /** Collider wireframe color. */
  public colliderColor: [number, number, number] = [0, 1, 0];
  /** Number of segments for sphere wireframe rings. */
  public sphereSegments = 24;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;

    // Compile the unlit debug shader
    this.shader = ShaderProgram.create(gl, basicVert, basicFrag);

    // Dynamic line buffer
    this.data = new Float32Array(MAX_LINE_VERTS * FLOATS_PER_VERT);
    this.vbo = new VertexBuffer(gl, this.data, BufferUsage.DYNAMIC);
    this.vao = new VertexArray(gl);
    this.vao.addVertexBuffer(this.vbo, [
      { location: 0, size: 3, stride: FLOATS_PER_VERT * 4, offset: 0 },  // a_position
      { location: 1, size: 3, stride: FLOATS_PER_VERT * 4, offset: 12 }, // a_color
    ]);
  }

  // -----------------------------------------------------------------
  // Public API — queue primitives before calling render()
  // -----------------------------------------------------------------

  /** Queue a single line segment. */
  drawLine(a: Vector3, b: Vector3, r: number, g: number, bl: number): void {
    this.pushVertex(a.x, a.y, a.z, r, g, bl);
    this.pushVertex(b.x, b.y, b.z, r, g, bl);
  }

  /** Queue a ray (origin + direction * length). */
  drawRay(origin: Vector3, direction: Vector3, length: number, r: number, g: number, b: number): void {
    const end = origin.add(direction.normalize().scale(length));
    this.drawLine(origin, end, r, g, b);
  }

  /** Queue a point as a small cross. */
  drawPoint(p: Vector3, size: number, r: number, g: number, b: number): void {
    const hs = size * 0.5;
    this.drawLine(new Vector3(p.x - hs, p.y, p.z), new Vector3(p.x + hs, p.y, p.z), r, g, b);
    this.drawLine(new Vector3(p.x, p.y - hs, p.z), new Vector3(p.x, p.y + hs, p.z), r, g, b);
    this.drawLine(new Vector3(p.x, p.y, p.z - hs), new Vector3(p.x, p.y, p.z + hs), r, g, b);
  }

  /** Queue a wireframe box from 8 world-space vertices. */
  drawBoxWireframe(verts: Vector3[], r: number, g: number, b: number): void {
    for (let i = 0; i < BOX_EDGES.length; i += 2) {
      this.drawLine(verts[BOX_EDGES[i]], verts[BOX_EDGES[i + 1]], r, g, b);
    }
  }

  /** Queue a wireframe sphere as 3 circle rings (XY, XZ, YZ planes). */
  drawSphereWireframe(center: Vector3, radius: number, r: number, g: number, b: number): void {
    const seg = this.sphereSegments;
    const step = (Math.PI * 2) / seg;

    // XZ ring (horizontal)
    for (let i = 0; i < seg; i++) {
      const a0 = i * step;
      const a1 = (i + 1) * step;
      this.drawLine(
        new Vector3(center.x + Math.cos(a0) * radius, center.y, center.z + Math.sin(a0) * radius),
        new Vector3(center.x + Math.cos(a1) * radius, center.y, center.z + Math.sin(a1) * radius),
        r, g, b,
      );
    }

    // XY ring
    for (let i = 0; i < seg; i++) {
      const a0 = i * step;
      const a1 = (i + 1) * step;
      this.drawLine(
        new Vector3(center.x + Math.cos(a0) * radius, center.y + Math.sin(a0) * radius, center.z),
        new Vector3(center.x + Math.cos(a1) * radius, center.y + Math.sin(a1) * radius, center.z),
        r, g, b,
      );
    }

    // YZ ring
    for (let i = 0; i < seg; i++) {
      const a0 = i * step;
      const a1 = (i + 1) * step;
      this.drawLine(
        new Vector3(center.x, center.y + Math.cos(a0) * radius, center.z + Math.sin(a0) * radius),
        new Vector3(center.x, center.y + Math.cos(a1) * radius, center.z + Math.sin(a1) * radius),
        r, g, b,
      );
    }
  }

  /**
   * Render all queued debug geometry plus automatic overlays (grid, axes, colliders).
   * Call once per frame AFTER the main scene render.
   */
  render(camera: Camera, physicsWorld?: PhysicsWorld): void {
    if (!this.enabled) {
      this.vertexCount = 0;
      return;
    }

    // Auto-generate built-in overlays
    if (this.showGrid) this.generateGrid();
    if (this.showAxes) this.generateAxes();
    if (this.showColliders && physicsWorld) this.generateColliders(physicsWorld);

    if (this.vertexCount === 0) return;

    const gl = this.gl;

    // Upload line data
    this.vbo.update(new Float32Array(this.data.buffer, 0, this.vertexCount * FLOATS_PER_VERT));

    // Set up state — draw on top with depth test, no face culling
    gl.disable(gl.CULL_FACE);

    this.shader.use();

    // MVP = projection * view (model is identity for world-space lines)
    const vp = camera.viewProjectionMatrix;
    this.shader.setMat4('u_modelViewProjection', vp.data);
    this.shader.setVec4('u_color', 1, 1, 1, 1); // per-vertex color multiplied by white

    this.vao.bind();
    gl.drawArrays(gl.LINES, 0, this.vertexCount);
    this.vao.unbind();

    gl.enable(gl.CULL_FACE);

    // Reset for next frame
    this.vertexCount = 0;
  }

  dispose(): void {
    this.vao.destroy();
    this.vbo.destroy();
    this.shader.destroy();
  }

  // -----------------------------------------------------------------
  // Internal generators
  // -----------------------------------------------------------------

  private generateGrid(): void {
    const s = this.gridSize;
    const step = this.gridStep;
    const [r, g, b] = this.gridColor;

    for (let i = -s; i <= s; i += step) {
      // Lines along Z
      this.pushVertex(i, 0, -s, r, g, b);
      this.pushVertex(i, 0, s, r, g, b);
      // Lines along X
      this.pushVertex(-s, 0, i, r, g, b);
      this.pushVertex(s, 0, i, r, g, b);
    }
  }

  private generateAxes(): void {
    const len = 2;
    // X = red
    this.drawLine(Vector3.zero(), new Vector3(len, 0, 0), 1, 0, 0);
    // Y = green
    this.drawLine(Vector3.zero(), new Vector3(0, len, 0), 0, 1, 0);
    // Z = blue
    this.drawLine(Vector3.zero(), new Vector3(0, 0, len), 0, 0, 1);
  }

  private generateColliders(world: PhysicsWorld): void {
    const [r, g, b] = this.colliderColor;
    for (const body of world.bodies) {
      if (!body.collider) continue;

      switch (body.collider.type) {
        case ColliderType.BOX: {
          const box = body.collider as BoxCollider;
          const verts = box.getWorldVertices(body.position, body.rotation);
          this.drawBoxWireframe(verts, r, g, b);
          break;
        }
        case ColliderType.SPHERE: {
          const sphere = body.collider as SphereCollider;
          const center = sphere.getWorldCenter(body.position);
          this.drawSphereWireframe(center, sphere.radius, r, g, b);
          break;
        }
        // PLANE and CAPSULE — draw a simple marker
        case ColliderType.PLANE: {
          // Draw a large flat cross on the plane
          this.drawLine(new Vector3(-20, body.position.y, 0), new Vector3(20, body.position.y, 0), r, g, b);
          this.drawLine(new Vector3(0, body.position.y, -20), new Vector3(0, body.position.y, 20), r, g, b);
          break;
        }
      }
    }
  }

  // -----------------------------------------------------------------
  // Vertex push helper
  // -----------------------------------------------------------------

  private pushVertex(x: number, y: number, z: number, r: number, g: number, b: number): void {
    if (this.vertexCount >= MAX_LINE_VERTS) return; // silently drop overflow
    const i = this.vertexCount * FLOATS_PER_VERT;
    this.data[i] = x;
    this.data[i + 1] = y;
    this.data[i + 2] = z;
    this.data[i + 3] = r;
    this.data[i + 4] = g;
    this.data[i + 5] = b;
    this.vertexCount++;
  }
}
