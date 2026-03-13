# 3D Engine

A fully-featured 3D engine built from scratch using **TypeScript** and **WebGL 2**, with an integrated rigid-body physics engine, post-processing pipeline, and interactive first-person camera.

![Tech: TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)
![Renderer: WebGL 2](https://img.shields.io/badge/Renderer-WebGL%202-orange)
![Math: gl-matrix](https://img.shields.io/badge/Math-gl--matrix-green)

---

## Features

### Rendering
- **WebGL 2** rendering pipeline with VAO/VBO/EBO abstractions
- **Blinn-Phong shading** with support for up to 8 simultaneous lights
- **Real-time shadow mapping** with configurable resolution and PCF filtering
- **Post-processing pipeline**: bloom, ACES tone mapping, FXAA anti-aliasing, vignette, color grading
- **Skybox** rendered from a cubemap
- **Instanced rendering** via `gl.drawElementsInstanced` for high-count objects
- **GPU particle system** with configurable emission, lifetime, color/size gradients

### Physics
- Custom rigid-body physics engine — no external physics library
- **Broadphase**: sweep-and-prune AABB overlap detection
- **Narrowphase**: SAT (Separating Axis Theorem) for box/sphere/plane/capsule shapes
- **Sequential impulse solver** with Baumgarte position correction and warm starting
- **Collider shapes**: Box, Sphere, Plane, Capsule
- **Body types**: Dynamic, Static, Kinematic
- **Constraints**: distance, hinge, fixed joint
- Fixed-timestep integration (60 Hz default) with render-rate interpolation

### Camera
- Perspective and orthographic cameras
- **First-person mode** with physics-driven movement — the camera has a dynamic rigid body with a box collider, affected by gravity and scene collisions
- **Orbit mode** — rotate/zoom/pan around a target
- **Fly mode** — free WASD movement
- Pointer lock support for mouse look

### Scene Graph
- Hierarchical `SceneNode` tree with parent/child transforms
- Dirty-flag matrix caching for efficient world matrix recomputation
- Built-in geometry generators: box, sphere, plane, cylinder
- `.OBJ` and **glTF 2.0** (including `.glb`) model loading

### Input
- Unified `InputManager` for keyboard, mouse, and gamepad
- Per-frame `wasPressed` / `wasReleased` state tracking
- Action mapping (named actions bound to keys/buttons)

### Debug Tools
- **Stats overlay**: FPS, frame time, draw calls, triangle count, physics step time
- **Debug renderer**: collider wireframes, world grid, axis gizmo, ray/line drawing
- **Inspector**: live scene tree browser with transform and material editing
- Toggle with **F3** or the Debug Mode checkbox in the settings panel

### Performance & Production (Phase 12)
- **Frustum culling** (`Frustum.ts`) — extracts 6 clip-space planes from the view-projection matrix; sphere and AABB tests reject objects outside the view before any draw call is issued
- **BVH** (`BVH.ts`) — top-down median-split Bounding Volume Hierarchy; `build` once, `refit` cheaply each frame for dynamic scenes, `query(frustum)` to collect only visible mesh indices in O(log N)
- **Render queue** (`RenderQueue.ts`) — assigns stable shader/material sort keys and sorts draw calls to minimise WebGL state changes (shader switches and texture rebinds)
- **Object pool** (`utils/Pool.ts`) — generic `ObjectPool<T>` with `acquire`/`release` and optional pre-warming; reduces GC pressure in hot paths
- **Physics Web Worker** (`PhysicsWorker.ts` + `PhysicsWorkerHost.ts`) — the entire rigid-body simulation runs in a dedicated Worker thread; transforms and velocities are returned each step as a zero-copy transferable `Float32Array` so the main thread is never blocked
- **Production bundle** — content-hash output filenames, vendor chunk splitting (gl-matrix isolated), runtime chunk separation, and per-mode `devtool` (`eval-source-map` in dev, `source-map` in production)

---

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) 18+

### Install
```bash
npm install
```

### Development server
```bash
npm run dev
```
Opens a hot-reloading dev server at `http://localhost:8080`.

### Production build
```bash
npm run build
```
Output goes to `dist/`.

### Run tests
```bash
npm test
```

---

## Controls

| Input | Action |
|-------|--------|
| **Click canvas** | Lock mouse pointer for mouse look |
| **W / A / S / D** | Move forward / left / backward / right |
| **Space** | Jump |
| **Mouse move** | Look around |
| **F3** | Toggle debug overlay |
| **Esc** | Release pointer lock |

---

## Settings Panel (top-right)

| Control | Description |
|---------|-------------|
| FOV | Camera field of view (30–120°) |
| Sensitivity | Mouse look sensitivity |
| Exposure | Post-processing exposure / brightness |
| Bloom | Bloom effect strength |
| Vignette | Screen-edge darkening strength |
| Debug Mode | Toggle collider wireframes, stats, and inspector |

---

## Project Structure

```
src/
├── core/          — Engine lifecycle, clock, event bus
├── math/          — Vector2/3/4, Matrix4, Quaternion, MathUtils (gl-matrix wrappers)
├── renderer/      — WebGL 2 abstractions, shader programs, textures, framebuffers
│   ├── shaders/   — GLSL source files (phong, shadow, PBR, skybox, particles, post-process)
│   ├── Frustum.ts — View frustum plane extraction and sphere/AABB culling tests
│   └── RenderQueue.ts — Sorted draw call queue (minimises shader/material switches)
├── scene/         — Scene graph, Geometry, Material, Mesh, InstancedMesh, ParticleSystem
│   └── BVH.ts     — Bounding Volume Hierarchy for accelerated frustum culling
├── camera/        — Camera types and camera controller
├── lighting/      — Directional, point, and spot lights; shadow map
├── physics/       — Full rigid-body physics engine + Web Worker host/worker pair
├── loaders/       — OBJ, glTF, texture, and asset manager
├── input/         — Keyboard, mouse, gamepad, unified InputManager
├── debug/         — Stats, DebugRenderer, Inspector
├── utils/
│   └── Pool.ts    — Generic object pool for GC-pressure reduction
└── demo.ts        — Interactive demo scene
tests/             — Vitest unit tests for all math library modules
```

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript 5.x (strict mode) |
| Math | gl-matrix 3.x |
| Rendering | WebGL 2 (native) |
| Physics | Custom rigid-body engine (Web Worker) |
| Build | Webpack 5 + ts-loader (code-split, content-hash) |
| Testing | Vitest |

---

## Demo Scene

The built-in demo (`src/demo.ts`) includes:

- A stacked tower of coloured physics boxes and a dropping sphere
- A directional "sun" light with real-time shadow mapping
- A point light for fill lighting
- A field of 100 instanced decorative boxes
- A fire-fountain particle emitter
- A dark solid-colour skybox
- A physics-driven first-person camera you can walk, jump, and collide with objects
- The full post-processing stack (bloom, tone mapping, FXAA, vignette)
