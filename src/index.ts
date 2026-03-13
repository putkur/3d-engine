export { Engine } from './core/Engine';
export { Clock } from './core/Clock';
export { EventEmitter } from './core/EventEmitter';

// Math
export { Vector2 } from './math/Vector2';
export { Vector3 } from './math/Vector3';
export { Vector4 } from './math/Vector4';
export { Matrix4 } from './math/Matrix4';
export { Quaternion } from './math/Quaternion';
export * from './math/MathUtils';

// Renderer
export { Renderer } from './renderer/Renderer';
export { Shader, ShaderType } from './renderer/Shader';
export { ShaderProgram } from './renderer/ShaderProgram';
export { VertexBuffer, BufferUsage } from './renderer/VertexBuffer';
export { IndexBuffer } from './renderer/IndexBuffer';
export { VertexArray } from './renderer/VertexArray';
export type { VertexAttribute } from './renderer/VertexArray';
export { Texture, TextureWrap, TextureFilter } from './renderer/Texture';
export type { TextureOptions } from './renderer/Texture';
export { Framebuffer } from './renderer/Framebuffer';
export { basicVert, basicFrag, standardVert, standardFrag, phongVert, phongFrag,
  shadowVert, shadowFrag, pbrVert, pbrFrag, skyboxVert, skyboxFrag,
  instancedVert, instancedFrag, particleVert, particleFrag,
  postprocessVert, postprocessFrag, bloomExtractFrag, blurFrag } from './renderer/shaders';
export { PostProcessing } from './renderer/PostProcessing';
export { CubeTexture } from './renderer/CubeTexture';
export { Skybox } from './renderer/Skybox';

// Scene
export { Transform } from './scene/Transform';
export { SceneNode } from './scene/SceneNode';
export { Scene } from './scene/Scene';
export { Geometry } from './scene/Geometry';
export type { GeometryData } from './scene/Geometry';
export { Material } from './scene/Material';
export type { MaterialOptions } from './scene/Material';
export { Mesh } from './scene/Mesh';
export { PBRMaterial } from './scene/PBRMaterial';
export { InstancedMesh } from './scene/InstancedMesh';
export { ParticleSystem } from './scene/ParticleSystem';
export type { ParticleSystemOptions } from './scene/ParticleSystem';

// Camera
export { Camera } from './camera/Camera';
export { PerspectiveCamera } from './camera/PerspectiveCamera';
export { OrthographicCamera } from './camera/OrthographicCamera';
export { CameraController, CameraMode } from './camera/CameraController';
export type { CameraControllerOptions } from './camera/CameraController';

// Lighting
export { Light, LightType } from './lighting/Light';
export { DirectionalLight } from './lighting/DirectionalLight';
export { PointLight } from './lighting/PointLight';
export { SpotLight } from './lighting/SpotLight';
export { ShadowMap } from './lighting/ShadowMap';

// Physics
export { PhysicsWorld } from './physics/PhysicsWorld';
export { RigidBody, BodyType } from './physics/RigidBody';
export { Collider, ColliderType } from './physics/Collider';
export type { AABB } from './physics/Collider';
export { SphereCollider } from './physics/SphereCollider';
export { BoxCollider } from './physics/BoxCollider';
export { PlaneCollider } from './physics/PlaneCollider';
export { CapsuleCollider } from './physics/CapsuleCollider';
export { BroadPhase } from './physics/BroadPhase';
export type { BroadPhasePair } from './physics/BroadPhase';
export { NarrowPhase } from './physics/NarrowPhase';
export { ContactManifold } from './physics/ContactManifold';
export type { ContactPoint } from './physics/ContactManifold';
export { CollisionResolver } from './physics/CollisionResolver';
export { Constraint, DistanceConstraint, HingeConstraint, FixedConstraint } from './physics/Constraints';

// Loaders
export { TextureLoader } from './loaders/TextureLoader';
export { OBJLoader } from './loaders/OBJLoader';
export { GLTFLoader } from './loaders/GLTFLoader';
export { AssetManager } from './loaders/AssetManager';
export type { Asset, ProgressCallback } from './loaders/AssetManager';

// Input
export { Keyboard } from './input/Keyboard';
export { Mouse } from './input/Mouse';
export { GamepadInput, GamepadButton, GamepadAxis } from './input/Gamepad';
export { InputManager } from './input/InputManager';
export type { ActionBinding } from './input/InputManager';

// Debug
export { Stats } from './debug/Stats';
export { DebugRenderer } from './debug/DebugRenderer';
export { Inspector } from './debug/Inspector';

// Phase 12 — Optimization & Production
export { Frustum } from './renderer/Frustum';
export { RenderQueue } from './renderer/RenderQueue';
export type { RenderItem } from './renderer/RenderQueue';
export { BVH } from './scene/BVH';
export type { BVHCuller, BVHBounds } from './scene/BVH';
export { ObjectPool } from './utils/Pool';
export { PhysicsWorkerHost } from './physics/PhysicsWorkerHost';
export type { BodyAttachment, KinematicUpdate, SerializedBody, SerializedCollider } from './physics/PhysicsWorkerHost';
