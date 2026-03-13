# AGENTS.md — 3D Engine in TypeScript with WebGL & Physics

## Project Overview

Build a fully-featured 3D engine from scratch using **TypeScript**, rendered via **WebGL 2** in the browser, with an integrated **out-of-box (OOB) physics engine**. The engine should support scene management, lighting, materials, mesh loading, camera controls, and rigid-body physics simulation.

---

## Architecture

```
src/
├── core/                  # Engine lifecycle, loop, clock, event system
│   ├── Engine.ts          # Main engine class — init, start, stop, update loop
│   ├── Clock.ts           # High-resolution timer, delta time, fixed timestep
│   └── EventEmitter.ts    # Pub/sub event bus for decoupled communication
│
├── math/                  # Linear algebra (wraps gl-matrix)
│   ├── Vector2.ts         # Thin wrapper around gl-matrix vec2
│   ├── Vector3.ts         # Thin wrapper around gl-matrix vec3
│   ├── Vector4.ts         # Thin wrapper around gl-matrix vec4
│   ├── Matrix4.ts         # Thin wrapper around gl-matrix mat4
│   ├── Quaternion.ts      # Thin wrapper around gl-matrix quat
│   └── MathUtils.ts       # Clamp, lerp, degToRad, radToDeg
│
├── renderer/              # WebGL 2 abstraction layer
│   ├── Renderer.ts        # WebGL context setup, render loop orchestration
│   ├── Shader.ts          # Compile, link, uniform/attribute management
│   ├── ShaderProgram.ts   # Vertex + fragment shader pairing
│   ├── Texture.ts         # 2D texture loading, mipmaps, filtering
│   ├── Framebuffer.ts     # Off-screen render targets (shadows, post-processing)
│   ├── VertexBuffer.ts    # VBO wrapper
│   ├── IndexBuffer.ts     # EBO wrapper
│   ├── VertexArray.ts     # VAO wrapper — attribute layout
│   └── RenderPipeline.ts  # Multi-pass rendering orchestration
│
├── scene/                 # Scene graph and spatial management
│   ├── Scene.ts           # Root node, manages all objects
│   ├── SceneNode.ts       # Base node: transform, parent/child hierarchy
│   ├── Mesh.ts            # Geometry + Material pairing
│   ├── Geometry.ts        # Vertex data: positions, normals, uvs, indices
│   ├── Material.ts        # Shader reference, uniforms, textures, blend state
│   └── Transform.ts       # Position, rotation (quat), scale, local/world matrices
│
├── camera/                # Camera systems
│   ├── Camera.ts          # Base: view matrix, projection matrix
│   ├── PerspectiveCamera.ts
│   ├── OrthographicCamera.ts
│   └── CameraController.ts # Orbit, fly, first-person controls
│
├── lighting/              # Light types and shadow mapping
│   ├── Light.ts           # Base light class
│   ├── DirectionalLight.ts
│   ├── PointLight.ts
│   ├── SpotLight.ts
│   └── ShadowMap.ts       # Depth-pass shadow mapping
│
├── physics/               # OOB rigid-body physics engine
│   ├── PhysicsWorld.ts    # Simulation world, gravity, timestep
│   ├── RigidBody.ts       # Mass, velocity, angular velocity, forces
│   ├── Collider.ts        # Base collider interface
│   ├── BoxCollider.ts     # AABB and OBB box collision shape
│   ├── SphereCollider.ts  # Sphere collision shape
│   ├── PlaneCollider.ts   # Infinite plane / half-space
│   ├── CapsuleCollider.ts # Capsule collision shape
│   ├── BroadPhase.ts      # Spatial partitioning (sweep-and-prune or grid)
│   ├── NarrowPhase.ts     # GJK/EPA or SAT exact collision detection
│   ├── ContactManifold.ts # Contact points, penetration depth, normal
│   ├── CollisionResolver.ts # Impulse-based collision response
│   └── Constraints.ts     # Distance, hinge, and fixed joint constraints
│
├── loaders/               # Asset loading
│   ├── OBJLoader.ts       # Wavefront OBJ parser
│   ├── GLTFLoader.ts      # glTF 2.0 loader (binary + JSON)
│   ├── TextureLoader.ts   # Image loading with format detection
│   └── AssetManager.ts    # Caching, async loading queue, progress tracking
│
├── input/                 # User input handling
│   ├── InputManager.ts    # Unified keyboard, mouse, pointer lock, gamepad
│   ├── Keyboard.ts
│   ├── Mouse.ts
│   └── Gamepad.ts
│
├── animation/             # Skeletal & keyframe animation
│   ├── AnimationClip.ts   # Named clip: array of tracks, duration
│   ├── AnimationTrack.ts  # Per-property keyframe channel (position/rotation/scale)
│   ├── AnimationMixer.ts  # Play, pause, loop, crossfade one or more clips on a node
│   ├── Skeleton.ts        # Bone hierarchy, inverse bind matrices, joint palette
│   └── SkinnedMesh.ts     # Mesh + Skeleton; uploads joint matrices to GPU
│
├── audio/                 # 3D spatial audio (Web Audio API)
│   ├── AudioClip.ts       # Decoded AudioBuffer wrapper
│   ├── AudioListener.ts   # Scene-graph listener synced to camera
│   ├── AudioSource.ts     # Positional or non-spatial sound emitter
│   ├── AudioManager.ts    # AudioContext owner, channel groups, master volume
│   └── AudioLoader.ts     # Async fetch + decode audio files
│
├── debug/                 # Development tools
│   ├── DebugRenderer.ts   # Wireframe, collider visualization, grid
│   ├── Stats.ts           # FPS, draw calls, triangle count overlay
│   └── Inspector.ts       # Runtime scene tree / property editor
│
├── utils/                 # Shared utilities
│   ├── Logger.ts
│   ├── Color.ts           # RGBA, hex conversion, blending
│   └── UUID.ts            # Unique ID generation for entities
│
└── index.ts               # Public API barrel export
```

---

## Phase 1 — Project Scaffolding & Core Loop

### Goals
Set up the development environment and implement the fundamental engine update loop.

### Steps

1. **Initialize the project**
   - Run `npm init -y` and install dev dependencies:
     ```
     typescript, ts-loader, webpack, webpack-cli, webpack-dev-server, html-webpack-plugin
     ```
   - Create `tsconfig.json` with `"strict": true`, `"target": "ES2020"`, `"module": "ESNext"`, `"moduleResolution": "bundler"`.
   - Create `webpack.config.js` with dev server, source maps, and HTML template plugin.
   - Create `public/index.html` with a `<canvas id="engine-canvas">` element.

2. **Implement `Clock.ts`**
   - Use `performance.now()` for high-resolution timing.
   - Track `deltaTime` (time since last frame), `elapsedTime`, and `fixedDeltaTime` (for physics, default `1/60`).
   - Provide `getDelta(): number` and `getElapsed(): number`.

3. **Implement `EventEmitter.ts`**
   - Generic typed event emitter: `on<T>(event, callback)`, `off()`, `emit()`.
   - Used throughout the engine for decoupled communication.

4. **Implement `Engine.ts`**
   - Constructor takes a canvas element or selector string.
   - `init()`: acquire WebGL2 context, initialize subsystems.
   - `start()`: begin `requestAnimationFrame` loop.
   - `stop()`: cancel animation frame.
   - Main loop structure:
     ```
     update loop:
       clock.tick()
       inputManager.poll()
       physicsWorld.step(fixedDeltaTime)   // fixed timestep with accumulator
       scene.update(deltaTime)             // game logic / animations
       renderer.render(scene, camera)      // draw
       stats.update()
     ```

5. **Verify**: A blank canvas with a cleared WebGL background color and FPS counter running.

---

## Phase 2 — Math Library

### Goals
Provide all linear algebra primitives needed by the renderer and physics engine, powered by **[gl-matrix](https://glmatrix.net/)** for battle-tested, high-performance SIMD-friendly math.

### Steps

1. **Install gl-matrix**
   ```bash
   npm install gl-matrix
   ```
   - `gl-matrix` provides `vec2`, `vec3`, `vec4`, `mat4`, `quat` and more, all backed by `Float32Array` — exactly what WebGL expects.

2. **`Vector2.ts`, `Vector3.ts`, `Vector4.ts`** — thin wrappers around `gl-matrix`
   - Create ergonomic class wrappers that delegate to `gl-matrix` functions internally.
   - Expose a clean OOP API: `add()`, `subtract()`, `scale()`, `dot()`, `cross()` (Vec3), `normalize()`, `length()`, `lengthSquared()`, `lerp()`, `distance()`.
   - Provide both immutable (returns new instance) and mutable (`addSelf`, `normalizeSelf`) variants for perf-critical paths.
   - The internal `data` property is a `Float32Array` from `gl-matrix`, directly passable to WebGL uniforms.

3. **`Matrix4.ts`** — wraps `gl-matrix/mat4`
   - Internal storage: `Float32Array(16)`, column-major (WebGL convention, which `gl-matrix` uses natively).
   - Static factories delegating to `mat4.*`: `identity()`, `translation()`, `rotationX/Y/Z()`, `scale()`, `lookAt()`, `perspective()`, `orthographic()`.
   - Instance methods: `multiply()`, `inverse()`, `transpose()`, `determinant()`, `transformPoint()`, `transformDirection()`.

4. **`Quaternion.ts`** — wraps `gl-matrix/quat`
   - Operations: `fromEuler()`, `fromAxisAngle()`, `toMatrix4()`, `multiply()`, `conjugate()`, `normalize()`, `slerp()`, `lookRotation()`.

5. **`MathUtils.ts`** — custom utilities (not covered by gl-matrix)
   - `clamp`, `lerp`, `inverseLerp`, `smoothstep`, `degToRad`, `radToDeg`, `EPSILON`, `isPowerOfTwo`, `nextPowerOfTwo`.

6. **Unit tests**: Write tests for all wrapper methods (use Vitest). Focus on verifying the wrapper API produces correct results — `gl-matrix` internals are already well-tested.

---

## Phase 3 — WebGL Renderer Foundation

### Goals
Abstract WebGL 2 into a clean, type-safe rendering layer.

### Steps

1. **`Renderer.ts`**
   - Acquire `WebGL2RenderingContext` from canvas.
   - Configure: depth test, face culling, blend mode, viewport, clear color.
   - `render(scene, camera)`: traverse scene, bind shaders, set uniforms, issue draw calls.
   - Track render stats: draw calls, triangles, shader switches.

2. **`Shader.ts` / `ShaderProgram.ts`**
   - Compile vertex and fragment shaders from source strings.
   - Link into a program. Cache uniform locations.
   - Typed uniform setters: `setFloat`, `setVec3`, `setMat4`, `setTexture`.
   - Error reporting: log exact compile/link errors with shader source line numbers.

3. **`VertexBuffer.ts`, `IndexBuffer.ts`, `VertexArray.ts`**
   - `VertexBuffer`: wraps `gl.ARRAY_BUFFER`. Supports static and dynamic usage.
   - `IndexBuffer`: wraps `gl.ELEMENT_ARRAY_BUFFER`.
   - `VertexArray`: wraps VAO. Defines attribute layout (position, normal, uv, tangent).

4. **`Texture.ts`**
   - Load from `HTMLImageElement` or `ArrayBuffer`.
   - Support `TEXTURE_2D`, mipmap generation, wrap modes, filtering modes.
   - Bind to texture units.

5. **`Framebuffer.ts`**
   - Off-screen render targets for shadow maps and post-processing.
   - Attach color and depth textures.

6. **Default shaders**
   - Create `shaders/basic.vert` and `shaders/basic.frag` (unlit, single color or texture).
   - Create `shaders/phong.vert` and `shaders/phong.frag` (Blinn-Phong lighting).

7. **Verify**: Render a colored triangle on screen using the shader pipeline.

---

## Phase 4 — Scene Graph & Transforms

### Goals
Implement a hierarchical scene graph where every object has a transform and parent/child relationships.

### Steps

1. **`Transform.ts`**
   - Properties: `position: Vector3`, `rotation: Quaternion`, `scale: Vector3`.
   - Computed: `localMatrix: Matrix4` (TRS composition), `worldMatrix: Matrix4` (parent chain).
   - Dirty flag pattern: only recompute matrices when transform changes.

2. **`SceneNode.ts`**
   - Has a `Transform`, optional `name`, `uuid`.
   - `parent`, `children[]` with `add()`, `remove()`, `traverse(callback)`.
   - `updateWorldMatrix(parentMatrix?)` recursive computation.

3. **`Scene.ts`**
   - Root `SceneNode`. Maintains flat lists for quick access: `meshes[]`, `lights[]`, `cameras[]`.
   - `add(node)`, `remove(node)`, `getByName()`, `getByUUID()`.

4. **`Geometry.ts`**
   - Holds vertex attribute arrays: positions, normals, uvs, tangents, indices.
   - Built-in generators: `Geometry.createBox()`, `Geometry.createSphere()`, `Geometry.createPlane()`, `Geometry.createCylinder()`.
   - Computes normals from faces if not provided. Computes tangents for normal mapping.

5. **`Material.ts`**
   - References a `ShaderProgram`.
   - Stores uniform values: `color`, `diffuseMap`, `normalMap`, `specular`, `shininess`.
   - Render state: `depthTest`, `depthWrite`, `blending`, `cullFace`, `wireframe`.

6. **`Mesh.ts`**
   - Extends `SceneNode`. Combines `Geometry` + `Material`.
   - Uploads geometry to GPU buffers on first render (lazy init).

7. **Verify**: Render a lit, textured cube that can be rotated via transform manipulation.

---

## Phase 5 — Camera System

### Goals
Implement flexible camera types with interactive controls.

### Steps

1. **`Camera.ts`** (base class extends `SceneNode`)
   - `viewMatrix`: derived from world transform inverse.
   - `projectionMatrix`: abstract, computed by subclasses.
   - `viewProjectionMatrix`: cached product.

2. **`PerspectiveCamera.ts`**
   - Parameters: `fov` (degrees), `aspect`, `near`, `far`.
   - Uses `Matrix4.perspective()`.

3. **`OrthographicCamera.ts`**
   - Parameters: `left`, `right`, `bottom`, `top`, `near`, `far`.

4. **`CameraController.ts`**
   - **Orbit mode**: rotate around a target point, zoom with scroll, pan with middle mouse.
   - **Fly mode**: WASD + mouse look, shift to speed up.
   - **First-person**: pointer lock, WASD movement, mouse look.
   - Smooth damping on all movements.

5. **Verify**: Orbit around the scene with mouse, zoom with scroll wheel.

---

## Phase 6 — Lighting & Shadows

### Goals
Support multiple light types with real-time shadow mapping.

### Steps

1. **`Light.ts`** (base, extends `SceneNode`)
   - Properties: `color: Color`, `intensity: number`.

2. **`DirectionalLight.ts`**
   - Parallel rays, defined by direction. Used for sun/moon.
   - Provides `lightSpaceMatrix` for shadow mapping.

3. **`PointLight.ts`**
   - Position-based, with `range` and `attenuation` (constant, linear, quadratic).

4. **`SpotLight.ts`**
   - Position + direction, `innerAngle`, `outerAngle` for soft edges.

5. **`ShadowMap.ts`**
   - Render scene from light's perspective into a depth `Framebuffer`.
   - Sample depth texture in main pass using PCF (percentage-closer filtering) for soft shadows.
   - Support shadow cascades for directional lights (optional, advanced).

6. **Update `phong.frag`**
   - Accept uniform arrays for up to N lights.
   - Compute diffuse + specular per light.
   - Apply shadow factor from shadow map.

7. **Verify**: A scene with a directional light casting shadows on multiple objects.

---

## Phase 7 — Physics Engine (Out-of-Box)

### Goals
Build a rigid-body physics simulation from scratch: broadphase, narrowphase, collision response, constraints.

### Steps

1. **`PhysicsWorld.ts`**
   - Manages all rigid bodies and constraints.
   - `step(dt)`: fixed timestep integration loop.
   - Pipeline per step:
     ```
     1. Apply forces (gravity, user forces)
     2. Integrate velocities (semi-implicit Euler)
     3. Broadphase: generate candidate pairs
     4. Narrowphase: exact collision detection → contact manifolds
     5. Solve constraints and contacts (sequential impulse solver)
     6. Integrate positions
     7. Sync transforms back to scene nodes
     ```
   - Configurable: `gravity: Vector3`, `iterations: number` (solver iterations, default 10).

2. **`RigidBody.ts`**
   - Properties: `mass`, `inverseMass`, `inertia` (Matrix3), `inverseInertia`.
   - State: `position`, `rotation` (Quaternion), `linearVelocity`, `angularVelocity`.
   - Accumulators: `force`, `torque`.
   - Methods: `applyForce()`, `applyImpulse()`, `applyTorque()`.
   - Types: `DYNAMIC` (simulated), `STATIC` (immovable, infinite mass), `KINEMATIC` (user-driven).

3. **Collider shapes**
   - **`SphereCollider.ts`**: center + radius. Simplest shape, fast intersection.
   - **`BoxCollider.ts`**: half-extents. Support both AABB (axis-aligned) and OBB (oriented).
   - **`PlaneCollider.ts`**: normal + distance. Used for ground/walls.
   - **`CapsuleCollider.ts`**: two endpoints + radius. Good for characters.
   - Each collider references its parent `RigidBody` and provides `getWorldTransform()`.

4. **`BroadPhase.ts`** — Sweep and Prune
   - Project all AABBs onto each axis.
   - Sort endpoints and detect overlapping intervals.
   - Output: array of potentially colliding `[bodyA, bodyB]` pairs.
   - Alternative: spatial hash grid for many small objects.

5. **`NarrowPhase.ts`** — SAT (Separating Axis Theorem)
   - **Sphere vs Sphere**: distance check.
   - **Sphere vs Box**: closest point on box to sphere center.
   - **Box vs Box**: SAT with 15 axes (3 face normals per box + 9 edge cross products).
   - **Sphere vs Plane**: signed distance.
   - **Box vs Plane**: project vertices.
   - **Capsule vs Capsule**: closest points on two line segments + radius sum.
   - Each test produces a `ContactManifold` or null.

6. **`ContactManifold.ts`**
   - Contains: `contactPoints[]`, each with `point`, `normal`, `penetrationDepth`.
   - Used by the solver to compute impulses.

7. **`CollisionResolver.ts`** — Sequential Impulse Solver
   - For each contact point:
     ```
     a. Compute relative velocity at contact point
     b. Compute normal impulse (restitution for bounciness)
     c. Apply friction impulse (Coulomb friction model)
     d. Apply position correction (Baumgarte stabilization or split impulse)
     ```
   - Run multiple iterations for stability (`world.iterations`).
   - Warm starting: cache impulses from previous frame for faster convergence.

8. **`Constraints.ts`**
   - **Distance constraint**: maintain fixed distance between two bodies.
   - **Hinge constraint**: allow rotation around a single axis.
   - **Fixed constraint**: lock two bodies together.
   - Solved alongside contacts in the impulse solver.

9. **Physics-Scene sync**
   - After `physicsWorld.step()`, copy each `RigidBody.position` and `RigidBody.rotation` to the corresponding `SceneNode.transform`.
   - Interpolate between physics steps for smooth rendering at variable frame rates.

10. **Verify**: Drop a stack of boxes onto a ground plane. They should collide, bounce, settle, and stack.

---

## Phase 8 — Asset Loading

### Goals
Load external 3D models and textures.

### Steps

1. **`TextureLoader.ts`**
   - Async image loading via `HTMLImageElement` or `createImageBitmap`.
   - Support PNG, JPG, WebP.
   - Return `Texture` objects ready for GPU upload.

2. **`OBJLoader.ts`**
   - Parse `.obj` text format: vertices (`v`), normals (`vn`), texcoords (`vt`), faces (`f`).
   - Parse companion `.mtl` files for materials.
   - Return `Mesh[]` with correct geometry and materials.

3. **`GLTFLoader.ts`**
   - Parse glTF 2.0 JSON + binary buffer(s).
   - Support: meshes, materials (PBR metallic-roughness), node hierarchy, textures.
   - Handle both `.gltf` (separate files) and `.glb` (single binary) formats.

4. **`AssetManager.ts`**
   - Central cache: don't reload the same asset twice.
   - Async queue with progress callbacks.
   - `load(url): Promise<Asset>`, `get(url): Asset | undefined`.

5. **Verify**: Load and render a glTF model (e.g., a character or vehicle).

---

## Phase 9 — Input System

### Goals
Unified input handling for keyboard, mouse, and gamepad.

### Steps

1. **`Keyboard.ts`**
   - Track key states: `isDown(key)`, `wasPressed(key)` (single frame), `wasReleased(key)`.
   - Listen to `keydown`/`keyup` on window with `event.code` for layout-independent keys.

2. **`Mouse.ts`**
   - Track position, delta, button states, scroll delta.
   - Support pointer lock (`canvas.requestPointerLock()`).

3. **`Gamepad.ts`**
   - Poll `navigator.getGamepads()` each frame.
   - Normalize axes and buttons to a standard layout.

4. **`InputManager.ts`**
   - Aggregate all input sources.
   - `poll()` called once per frame before update.
   - Action mapping: bind named actions to keys/buttons (e.g., `"jump" → Space / Gamepad A`).

5. **Verify**: Move camera with WASD + mouse, trigger actions with keyboard.

---

## Phase 10 — Debug Tools

### Goals
In-engine development tools for rapid iteration.

### Steps

1. **`Stats.ts`**
   - Overlay showing: FPS, frame time (ms), draw calls, triangle count, physics step time.
   - Rendered as HTML overlay or canvas 2D.

2. **`DebugRenderer.ts`**
   - Draw wireframe outlines of meshes.
   - Visualize colliders (box wireframes, sphere wireframes).
   - Draw world-space grid, axis gizmo.
   - Draw lines, points, rays (useful for raycasting debug).
   - Uses a separate unlit shader, rendered after the main pass.

3. **`Inspector.ts`** (optional, advanced)
   - HTML panel listing scene tree.
   - Click to select node, edit transform, material properties.
   - Toggle physics debug visualization.

4. **Verify**: See collider outlines overlaid on physics objects, FPS counter in corner.

---

## Phase 11 — Advanced Rendering (Post-Phase)

### Goals
Optional rendering enhancements for visual quality.

### Steps

1. **Post-processing pipeline**
   - Render scene to an off-screen framebuffer.
   - Apply fullscreen quad passes: bloom, tone mapping, FXAA, vignette, color grading.
   - Chain multiple effects via ping-pong framebuffers.

2. **PBR shading**
   - Implement physically-based BRDF (Cook-Torrance specular).
   - Metallic-roughness workflow matching glTF standard.
   - Image-based lighting (IBL) with environment cubemaps.

3. **Normal mapping & parallax mapping**
   - Sample normal maps in tangent space.
   - Compute TBN matrix from vertex tangents.

4. **Skybox**
   - Cubemap texture rendered on an inverted cube at infinity.
   - Used as environment map for reflections.

5. **Instanced rendering**
   - For rendering many identical meshes (particles, foliage, crowds).
   - Use `gl.drawElementsInstanced()` with per-instance attribute buffers.

6. **Particle system**
   - GPU-driven particles using transform feedback or compute-like vertex shaders.
   - Emitter shapes, velocity, lifetime, color/size over time.

---

## Phase 12 — Optimization & Production

### Goals
Make the engine production-ready with solid performance.

### Steps

1. **Frustum culling**
   - Compute view frustum planes from camera's view-projection matrix.
   - Test each object's bounding sphere/box against frustum; skip if outside.

2. **Spatial partitioning for rendering**
   - BVH (Bounding Volume Hierarchy) or Octree for large scenes.
   - Accelerate frustum culling and raycasting.

3. **Batch rendering**
   - Sort draw calls by shader, then material, then mesh to minimize state changes.
   - Merge static geometry into combined buffers.

4. **Object pooling**
   - Pool `Vector3`, `Matrix4`, contact manifolds to avoid GC pressure.
   - Use `Float32Array` backing for math types in hot paths.

5. **Web Workers**
   - Offload physics simulation to a Web Worker.
   - Use `SharedArrayBuffer` + `Atomics` or message passing for transform sync.

6. **Bundle & deploy**
   - Tree-shake unused modules.
   - Minify and gzip for production.
   - Publish as an npm package or host demo on GitHub Pages.

---

## Phase 13 — Animation System

### Goals
Add skeletal and keyframe animation support so meshes can be driven by bone hierarchies and
time-sampled property tracks. Integrate with the glTF loader to play back `skins` and
`animations` exported from DCCs (Blender, Maya, etc.).

### Steps

1. **`AnimationTrack.ts`**
   - Represents a single animated property channel on a target node.
   - Properties: `targetPath` (`"position"` | `"rotation"` | `"scale"` | `"weights"`), `times: Float32Array`, `values: Float32Array`.
   - Interpolation modes: `STEP`, `LINEAR`, `CUBICSPLINE` (Catmull-Rom / glTF cubic).
   - `evaluate(t: number): number[]` — sample the channel at time `t`.

2. **`AnimationClip.ts`**
   - Named collection of `AnimationTrack[]` plus a `duration` (seconds).
   - `static fromGLTF(gltfAnim, nodes)` — convert a parsed glTF animation object into an `AnimationClip`.
   - Clips are data-only; playback is handled by `AnimationMixer`.

3. **`AnimationMixer.ts`**
   - Manages one or more active `AnimationAction` instances on a root `SceneNode`.
   - `play(clip, options?)` — creates an `AnimationAction`, returns it.
   - `crossFadeTo(fromAction, toAction, duration)` — smooth weight blend over `duration` seconds.
   - `update(dt)` — advance all active actions; write sampled values back to each target node's `Transform`.
   - Supports `loop: boolean`, `timeScale`, `weight` (for blending).

4. **`Skeleton.ts`**
   - `joints: SceneNode[]` — ordered list of bone nodes matching the glTF skin joint array.
   - `inverseBindMatrices: Matrix4[]` — one per joint, loaded from the glTF accessor.
   - `jointMatrices: Float32Array` — flattened `4×4 × numJoints` palette uploaded to the shader each frame.
   - `update()` — recomputes `jointMatrices`: `jointMatrix[i] = joint.worldMatrix * inverseBindMatrix[i]`.

5. **`SkinnedMesh.ts`** (extends `Mesh`)
   - Adds `skeleton: Skeleton` and optional per-vertex `joints` (uvec4) + `weights` (vec4) attribute buffers.
   - `render(camera)` — calls `skeleton.update()`, uploads `u_jointMatrices` uniform array, then draws.
   - Falls back to rigid rendering when no skeleton is attached.

6. **Skinning shader** (`shaders/skinned.vert` / reuse `phong.frag`)
   - New vertex shader that reads `a_joints` (uvec4) and `a_weights` (vec4).
   - Computes the blended skin matrix:
     ```glsl
     mat4 skin = w.x * u_jointMatrices[j.x]
               + w.y * u_jointMatrices[j.y]
               + w.z * u_jointMatrices[j.z]
               + w.w * u_jointMatrices[j.w];
     vec4 skinnedPos = skin * vec4(a_position, 1.0);
     ```
   - Normals are transformed with the inverse-transpose of the skin matrix.
   - Maximum joint palette size: 128 joints (uniform array limit).

7. **Update `GLTFLoader.ts`**
   - Parse `skins` → build `Skeleton` with joint nodes + inverse bind matrices.
   - Parse `animations` → build `AnimationClip[]` from animation channels + samplers.
   - Attach `joints` and `weights` accessors as extra vertex attribute buffers on `SkinnedMesh`.
   - Return `{ meshes, skeletons, clips }` from the loader.

8. **`AnimationMixer` integration in the update loop**
   - Create one `AnimationMixer` per animated character / object.
   - Call `mixer.update(dt)` each frame in the `engine 'update'` event.
   - Bone transforms propagate through the normal `scene.updateMatrixWorld()` call that already runs before rendering.

9. **Blend trees (optional, advanced)**
   - `BlendTree` node that inputs multiple clips weighted by a parameter (e.g. `speed`).
   - Linear 1D blend: lerp between two clips based on a scalar.
   - 2D blend: four-corner blend for locomotion (idle/walk/run/strafe).

10. **Morph targets / blend shapes**
    - Store per-vertex delta buffers (`morphPositions[]`, `morphNormals[]`) on `Geometry`.
    - Upload `u_morphWeights` uniform array; shader adds weighted deltas to base positions.
    - `AnimationTrack` with `targetPath: "weights"` drives morph weights for facial animation.

11. **`DebugRenderer` extensions**
    - Draw skeleton bone lines (joint-to-parent) as coloured line segments.
    - Draw joint axes (tiny RGB gizmos) for each bone when debug mode is active.

12. **Verify**
    - Load a rigged glTF character (e.g., the Khronos `Fox.glb` or `RiggedFigure.glb` sample).
    - Play its walk/idle animation clip in a loop.
    - Hot-swap between two clips with `crossFadeTo()` on a key press.
    - Confirm skeleton debug visualisation draws correct bone hierarchy.

---

## Phase 14 — Audio System

### Goals
Add 3D spatial audio using the **Web Audio API**. Sound sources live in the scene graph
so they move with their parent nodes and attenuate naturally with distance from the
listener (camera). Support one-shot sound effects, looping ambient sounds, and
non-spatial background music with per-channel volume control.

### Steps

1. **`AudioClip.ts`**
   - Thin wrapper around a decoded `AudioBuffer`.
   - Read-only properties: `duration`, `sampleRate`, `numberOfChannels`.
   - Purely data — one clip can be shared by many `AudioSource`s.

2. **`AudioListener.ts`** (extends `SceneNode`)
   - Wraps the `AudioContext.listener` (an `AudioListener` on the Web Audio graph).
   - `update()`: syncs `positionX/Y/Z`, `forwardX/Y/Z`, and `upX/Y/Z`
     from its world-space transform every frame.
   - Typically attached as a child of the active camera so it inherits camera movement.
   - Only one listener can be active at a time.

3. **`AudioSource.ts`** (extends `SceneNode`)
   - Creates a `PannerNode` for 3D spatialization **or** a plain `GainNode` for
     non-spatial playback (music / UI sounds).
   - Properties: `clip`, `volume` (0–1), `loop`, `spatial` (boolean),
     `refDistance`, `maxDistance`, `rolloffFactor`, `autoplay`.
   - Methods: `play()`, `pause()`, `resume()`, `stop()`, `isPlaying()`.
   - Distance model: `"inverse"` rolloff by default (configurable).
   - Audio graph: `BufferSourceNode → PannerNode|GainNode → channelGain → masterGain → destination`.
   - `update()`: syncs the `PannerNode` position from the node's world transform.

4. **`AudioManager.ts`**
   - Owns the single `AudioContext` (lazily created on the first user gesture
     to comply with browser autoplay policy).
   - Master volume via a `GainNode` at the end of the audio graph.
   - **Channel groups**: `"sfx"`, `"music"`, `"ambient"` — each with its own
     `GainNode` and independent volume (0–1).
   - `resume()` / `suspend()` — respond to `document.visibilitychange` to
     pause audio when the tab is hidden.
   - `update(listener)`: called once per frame to sync the listener and all
     registered sources.
   - `createSource(options)`: factory that wires a new `AudioSource` into the
     correct channel group.
   - `decodeAudio(arrayBuffer): Promise<AudioClip>` — decodes raw bytes into
     a playable `AudioClip`.

5. **`AudioLoader.ts`**
   - `load(url): Promise<AudioClip>` — fetches an audio file, decodes it
     via `AudioManager.decodeAudio()`, and returns an `AudioClip`.
   - Supports MP3, OGG, WAV (browser-dependent codec support).
   - Integrates with `AssetManager` for deduplication and caching.

6. **Engine integration**
   - The demo creates an `AudioManager` and an `AudioListener` attached to the
     camera.
   - Each frame, `audioManager.update(listener)` is called after the camera
     controller runs (world transforms must be up-to-date).
   - `AudioSource` nodes are added to the scene like any other `SceneNode`;
     their panner positions are synced automatically.

7. **Demo scene**
   - A looping spatial "hum" `AudioSource` attached to the particle emitter
     position — volume fades as the player walks away.
   - A non-spatial background music track on the `"music"` channel.
   - On-screen UI slider for master volume and per-channel volumes.
   - A one-shot "click" sound played on each physics collision (rate-limited).

8. **Verify**
   - Walk around the scene and hear the spatial hum pan left/right and attenuate.
   - Toggle background music with a key press.
   - Adjust master / SFX / music volumes via the settings panel.
   - Confirm audio suspends when the tab loses focus and resumes on return.

---

## Build & Run Commands

```bash
# Install dependencies
npm install

# Development server with hot reload
npm run dev

# Production build
npm run build

# Run tests
npm test

# Lint
npm run lint
```

---

## Technology Stack

| Layer          | Technology                          |
|----------------|-------------------------------------|
| Language       | TypeScript 5.x (strict mode)       |
| Math           | gl-matrix (vec, mat, quat)          |
| Rendering      | WebGL 2 (native, no wrapper libs)  |
| Physics        | Custom rigid-body engine (Web Worker) |
| Animation      | Custom skeletal + keyframe (built-in) |
| Audio          | Web Audio API (spatial + mixing)       |
| Build          | Webpack 5 + ts-loader, code-split    |
| Testing        | Vitest                              |
| Linting        | ESLint + @typescript-eslint         |
| Formatting     | Prettier                            |

---

## Conventions

- **gl-matrix for linear algebra** — vectors, matrices, and quaternions use [gl-matrix](https://glmatrix.net/) for proven correctness and performance. Thin class wrappers provide an ergonomic API while keeping raw `Float32Array` access for WebGL.
- **No external 3D/physics libraries** — the renderer, scene graph, and physics engine are all built from scratch for learning and full control.
- **Column-major matrices** — matches WebGL's expected layout for `uniformMatrix4fv` (and gl-matrix's native format).
- **Right-hand coordinate system** — +X right, +Y up, -Z into screen.
- **Radians internally** — all API surfaces accept degrees but convert immediately.
- **Fixed physics timestep** — 60 Hz default, decoupled from render frame rate via accumulator.
- **Component-like design** — nodes have transforms; meshes, lights, and cameras extend nodes. Physics bodies are attached to nodes.

---

## Recommended Development Order

```
Phase 1  → Scaffolding & loop          (foundation)
Phase 2  → Math library                (everything depends on this)
Phase 3  → WebGL renderer              (see triangles on screen)
Phase 4  → Scene graph & transforms    (organize objects)
Phase 5  → Camera system               (navigate the scene)
Phase 6  → Lighting & shadows          (visual depth)
Phase 7  → Physics engine              (interactivity)
Phase 8  → Asset loading               (real content)
Phase 9  → Input system                (user control)
Phase 10 → Debug tools                 (developer experience)
Phase 11 → Advanced rendering          (visual polish)
Phase 12 → Optimization & production   (ship it)
Phase 13 → Animation system            (bring scenes to life)
Phase 14 → Audio system                (spatial sound & music)
```

Each phase builds on the previous. Phases 1–5 get a visible, navigable 3D scene running. Phase 7 (physics) is the largest single effort and can be developed in parallel with Phases 5–6 since it only depends on the math library and scene sync. Phase 14 (audio) depends only on the scene graph and can be developed alongside any phase after Phase 4.
