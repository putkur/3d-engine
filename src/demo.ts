import { Engine } from './core/Engine';
import { Renderer } from './renderer/Renderer';
import { ShaderProgram } from './renderer/ShaderProgram';
import { Vector3 } from './math/Vector3';
import { Quaternion } from './math/Quaternion';
import { Matrix4 } from './math/Matrix4';
import { Scene } from './scene/Scene';
import { Geometry } from './scene/Geometry';
import { Material } from './scene/Material';
import { Mesh } from './scene/Mesh';
import { PerspectiveCamera } from './camera/PerspectiveCamera';
import { CameraController, CameraMode } from './camera/CameraController';
import { DirectionalLight } from './lighting/DirectionalLight';
import { PointLight } from './lighting/PointLight';
import { ShadowMap } from './lighting/ShadowMap';
import { Light, LightType } from './lighting/Light';
import { phongVert, phongFrag } from './renderer/shaders';
import { PhysicsWorld } from './physics/PhysicsWorld';
import { RigidBody, BodyType } from './physics/RigidBody';
import { BoxCollider } from './physics/BoxCollider';
import { SphereCollider } from './physics/SphereCollider';
import { PlaneCollider } from './physics/PlaneCollider';
import { Stats } from './debug/Stats';
import { DebugRenderer } from './debug/DebugRenderer';
import { Inspector } from './debug/Inspector';
import { PostProcessing } from './renderer/PostProcessing';
import { Skybox } from './renderer/Skybox';
import { CubeTexture } from './renderer/CubeTexture';
import { InstancedMesh } from './scene/InstancedMesh';
import { ParticleSystem } from './scene/ParticleSystem';
import { Frustum } from './renderer/Frustum';
import { RenderQueue } from './renderer/RenderQueue';
import { BVH } from './scene/BVH';
import { PhysicsWorkerHost } from './physics/PhysicsWorkerHost';
import { AnimationClip } from './animation/AnimationClip';
import { AnimationTrack, Interpolation } from './animation/AnimationTrack';
import { AnimationMixer } from './animation/AnimationMixer';
import { SkinnedMesh } from './animation/SkinnedMesh';

const engine = new Engine('#engine-canvas');
engine.init();

const gl = engine.gl;
const renderer = new Renderer(gl);
renderer.configure();

// --- Shader ---
const program = ShaderProgram.create(gl, phongVert, phongFrag);

// --- Scene setup ---
const scene = new Scene();

// --- Physics world ---
const physicsWorld = new PhysicsWorld();
physicsWorld.gravity = new Vector3(0, -9.81, 0);
physicsWorld.iterations = 12;

// --- Ground plane (visual + physics) ---
const planeGeo = Geometry.createPlane(20, 20);
const planeMat = new Material(program, {
  color: [0.4, 0.7, 0.4, 1.0],
  cullFace: false,
  specular: 0.1,
  shininess: 8,
});
const groundMesh = new Mesh(planeGeo, planeMat, 'ground');
groundMesh.transform.setPosition(0, 0, 0);
scene.add(groundMesh);

const groundBody = new RigidBody(BodyType.STATIC);
groundBody.position = new Vector3(0, 0, 0);
groundBody.collider = new PlaneCollider(new Vector3(0, 1, 0), 0);
groundBody.friction = 0.6;
groundBody.restitution = 0.2;
groundBody.sceneNode = groundMesh;
physicsWorld.addBody(groundBody);

// --- Helper to create physics box ---
const boxColors: [number, number, number, number][] = [
  [0.2, 0.6, 1.0, 1.0],
  [1.0, 0.3, 0.2, 1.0],
  [0.8, 0.8, 0.2, 1.0],
  [0.3, 0.9, 0.5, 1.0],
  [0.9, 0.4, 0.8, 1.0],
  [1.0, 0.6, 0.1, 1.0],
];

function createPhysicsBox(
  name: string,
  halfW: number, halfH: number, halfD: number,
  x: number, y: number, z: number,
  mass: number,
  colorIdx: number,
): { mesh: Mesh; body: RigidBody } {
  const geo = Geometry.createBox(halfW * 2, halfH * 2, halfD * 2);
  const color = boxColors[colorIdx % boxColors.length];
  const mat = new Material(program, { color, specular: 0.5, shininess: 64 });
  const mesh = new Mesh(geo, mat, name);
  scene.add(mesh);

  const body = new RigidBody(BodyType.DYNAMIC);
  body.position = new Vector3(x, y, z);
  body.mass = mass;
  body.collider = new BoxCollider(new Vector3(halfW, halfH, halfD));
  body.computeInertia();
  body.restitution = 0.2;
  body.friction = 0.5;
  body.sceneNode = mesh;
  physicsWorld.addBody(body);

  return { mesh, body };
}

function createPhysicsSphere(
  name: string,
  radius: number,
  x: number, y: number, z: number,
  mass: number,
  colorIdx: number,
): { mesh: Mesh; body: RigidBody } {
  const geo = Geometry.createSphere(radius, 24, 16);
  const color = boxColors[colorIdx % boxColors.length];
  const mat = new Material(program, { color, specular: 0.8, shininess: 128 });
  const mesh = new Mesh(geo, mat, name);
  scene.add(mesh);

  const body = new RigidBody(BodyType.DYNAMIC);
  body.position = new Vector3(x, y, z);
  body.mass = mass;
  body.collider = new SphereCollider(radius);
  body.computeInertia();
  body.restitution = 0.4;
  body.friction = 0.4;
  body.sceneNode = mesh;
  physicsWorld.addBody(body);

  return { mesh, body };
}

// --- Stack of boxes (the classic physics demo) ---
// Bottom row: 3 boxes
createPhysicsBox('box-0-0', 0.5, 0.5, 0.5, -1.1, 0.5, 0, 2, 0);
createPhysicsBox('box-0-1', 0.5, 0.5, 0.5,  0.0, 0.5, 0, 2, 1);
createPhysicsBox('box-0-2', 0.5, 0.5, 0.5,  1.1, 0.5, 0, 2, 2);

// Second row: 2 boxes
createPhysicsBox('box-1-0', 0.5, 0.5, 0.5, -0.55, 1.5, 0, 2, 3);
createPhysicsBox('box-1-1', 0.5, 0.5, 0.5,  0.55, 1.5, 0, 2, 4);

// Top: 1 box
createPhysicsBox('box-2-0', 0.5, 0.5, 0.5, 0, 2.5, 0, 2, 5);

// A sphere dropping from height
createPhysicsSphere('sphere-drop', 0.3, 0, 5, 0, 1.5, 1);

// Some extra boxes off to the side, dropped at angle
createPhysicsBox('box-side-1', 0.4, 0.4, 0.4, 3, 3, 0, 1.5, 0);
createPhysicsBox('box-side-2', 0.3, 0.3, 0.3, 3.1, 5, 0.1, 1, 2);

// --- Lights ---
const sunDir = new Vector3(-0.5, -1, -0.3);
const sun = new DirectionalLight(sunDir, [1.0, 0.95, 0.85], 1.2);
sun.castShadow = true;
sun.shadowOrthoSize = 12;
sun.shadowFar = 40;
scene.add(sun);

const pointLight = new PointLight([0.3, 0.5, 1.0], 1.5, 12);
pointLight.transform.setPosition(3, 4, 3);
scene.add(pointLight);

// --- Shadow map ---
const shadowMap = new ShadowMap(gl, 2048);

// --- Post-processing ---
const postProcess = new PostProcessing(gl, engine.canvas.width, engine.canvas.height, {
  exposure: 1.0,
  bloomThreshold: 0.8,
  bloomStrength: 0.3,
  vignetteStrength: 0.3,
  saturation: 1.0,
  enableFXAA: true,
});

// --- Skybox (solid color cubemap) ---
const skyboxCube = CubeTexture.createSolid(gl, 0.1, 0.12, 0.2);
const skybox = new Skybox(gl, skyboxCube);

// --- Instanced mesh (field of small boxes) ---
const instanceGeo = Geometry.createBox(0.3, 0.3, 0.3);
const instancedMesh = new InstancedMesh(gl, instanceGeo, 100);
instancedMesh.color = [0.55, 0.75, 0.45, 1];
instancedMesh.lightDir = [-0.5, -1, -0.3];
instancedMesh.lightColor = [1, 0.95, 0.85];
instancedMesh.ambientColor = [0.15, 0.15, 0.18];
const instanceMatrices: Matrix4[] = [];
for (let row = 0; row < 10; row++) {
  for (let col = 0; col < 10; col++) {
    const m = Matrix4.translation(
      -7 + col * 1.5,
      0.15,
      -10 - row * 1.5,
    );
    instanceMatrices.push(m);
  }
}
instancedMesh.setInstances(instanceMatrices);

// --- Particle system (fire fountain) ---
const particles = new ParticleSystem(gl, {
  maxParticles: 500,
  emissionRate: 80,
  lifetime: 1.8,
  lifetimeVariance: 0.4,
  speed: 3.5,
  speedVariance: 0.8,
  gravity: new Vector3(0, -1.5, 0),
  startSize: 0.15,
  endSize: 0.02,
  startColor: [1, 0.6, 0.1, 1],
  endColor: [1, 0.1, 0.0, 0],
  emitterShape: 'point',
});
particles.position = new Vector3(-3, 0, -2);
particles.direction = new Vector3(0, 1, 0);

// --- Debug tools ---
const stats = new Stats();
stats.setRenderer(renderer);

const debugRenderer = new DebugRenderer(gl);

const inspector = new Inspector();
inspector.attach(scene, debugRenderer);

// --- Camera ---
const aspect = engine.canvas.width / engine.canvas.height;
const camera = new PerspectiveCamera(90, aspect, 0.1, 100);
scene.add(camera);

camera.transform.setPosition(0, 2, 8);

// --- Camera physics body ---
const cameraBody = new RigidBody(BodyType.DYNAMIC);
cameraBody.position = new Vector3(0, 2, 8);
cameraBody.mass = 7;
cameraBody.collider = new BoxCollider(new Vector3(0.3, 0.8, 0.3));
cameraBody.computeInertia();
cameraBody.restitution = 0.0;
cameraBody.friction = 0.5;
cameraBody.linearDamping = 0.05;
cameraBody.angularDamping = 1.0; // prevent tumbling
cameraBody.sceneNode = camera;
physicsWorld.addBody(cameraBody);

const controller = new CameraController(camera, engine.input, {
  mode: CameraMode.FIRST_PERSON,
  moveSpeed: 5,
  lookSensitivity: 0.1,
  damping: 0.05,
  rigidBody: cameraBody,
  jumpSpeed: 5,
});

// Click canvas to lock pointer for mouse look
engine.canvas.addEventListener('click', () => {
  controller.requestPointerLock();
});

// --- Phase 13: Animated robot character ---
//
// A simple hierarchical "robot" built from SceneNodes (joints) + Mesh children.
// The AnimationMixer drives keyframe tracks that animate the joint rotations and
// the root position, demonstrating: LINEAR / STEP interpolation, multi-track clips,
// and crossfade between two clips (idle bob ↔ arm wave).
//
// Node hierarchy:
//   robotRoot
//     torso   (mesh)
//       head  (mesh)
//       armL  (joint)  → lowerArmL (mesh)
//       armR  (joint)  → lowerArmR (mesh)
//       legL  (mesh)
//       legR  (mesh)
// -----------------------------------------------------------------------

import { SceneNode } from './scene/SceneNode';

// Joint nodes
const robotRoot = new SceneNode('robotRoot');
const torsoJoint = new SceneNode('torsoJoint');
const headJoint  = new SceneNode('headJoint');
const armLJoint  = new SceneNode('armLJoint');
const armRJoint  = new SceneNode('armRJoint');
const lArmLJoint = new SceneNode('lArmLJoint');
const lArmRJoint = new SceneNode('lArmRJoint');

// Geometry shared by all body parts (small-ish boxes)
const torsoGeo    = Geometry.createBox(0.4, 0.6, 0.25);
const headGeo     = Geometry.createBox(0.3, 0.3, 0.3);
const upperArmGeo = Geometry.createBox(0.12, 0.35, 0.12);
const lowerArmGeo = Geometry.createBox(0.1,  0.3,  0.1);
const legGeo      = Geometry.createBox(0.14, 0.45, 0.14);

// Materials
const robotColor: [number, number, number, number] = [0.75, 0.75, 0.85, 1];
const robotMat  = new Material(program, { color: robotColor, specular: 0.7, shininess: 80 });
const headColor: [number, number, number, number]  = [0.95, 0.85, 0.75, 1];
const headMat   = new Material(program, { color: headColor,  specular: 0.4, shininess: 30 });
const legColor: [number, number, number, number]   = [0.3,  0.35, 0.5,  1];
const legMat    = new Material(program, { color: legColor,   specular: 0.3, shininess: 16 });

// Meshes (visual only — no physics)
const torsoMesh = new Mesh(torsoGeo, robotMat, 'torsoMesh');
torsoMesh.transform.setPosition(0, 0, 0);

const headMesh = new Mesh(headGeo, headMat, 'headMesh');
headMesh.transform.setPosition(0, 0.48, 0);  // sit on top of torso

const upperArmLMesh = new Mesh(upperArmGeo, robotMat, 'upperArmLMesh');
upperArmLMesh.transform.setPosition(0, -0.175, 0);  // hang down from shoulder

const lowerArmLMesh = new Mesh(lowerArmGeo, robotMat, 'lowerArmLMesh');
lowerArmLMesh.transform.setPosition(0, -0.15, 0);

const upperArmRMesh = new Mesh(upperArmGeo, robotMat, 'upperArmRMesh');
upperArmRMesh.transform.setPosition(0, -0.175, 0);

const lowerArmRMesh = new Mesh(lowerArmGeo, robotMat, 'lowerArmRMesh');
lowerArmRMesh.transform.setPosition(0, -0.15, 0);

const legLMesh = new Mesh(legGeo, legMat, 'legLMesh');
legLMesh.transform.setPosition(0, -0.525, 0);

const legRMesh = new Mesh(legGeo, legMat, 'legRMesh');
legRMesh.transform.setPosition(0, -0.525, 0);

// Build hierarchy
// Shoulder joints offset sideways from torso centre
armLJoint.transform.setPosition(-0.29, 0.22, 0);  // left shoulder pivot
armRJoint.transform.setPosition( 0.29, 0.22, 0);  // right shoulder pivot

// Elbow joints hang below the upper arm
lArmLJoint.transform.setPosition(0, -0.35, 0);
lArmRJoint.transform.setPosition(0, -0.35, 0);

// Head pivot (bone for head bob)
headJoint.transform.setPosition(0, 0.30, 0); // top of torso

armLJoint.add(upperArmLMesh);
armLJoint.add(lArmLJoint);
lArmLJoint.add(lowerArmLMesh);

armRJoint.add(upperArmRMesh);
armRJoint.add(lArmRJoint);
lArmRJoint.add(lowerArmRMesh);

// Leg roots hang directly off torso
const legLJoint = new SceneNode('legLJoint');
const legRJoint = new SceneNode('legRJoint');
legLJoint.transform.setPosition(-0.14, -0.30, 0);
legRJoint.transform.setPosition( 0.14, -0.30, 0);
legLJoint.add(legLMesh);
legRJoint.add(legRMesh);

headJoint.add(headMesh);

torsoJoint.add(torsoMesh);
torsoJoint.add(headJoint);
torsoJoint.add(armLJoint);
torsoJoint.add(armRJoint);
torsoJoint.add(legLJoint);
torsoJoint.add(legRJoint);

robotRoot.add(torsoJoint);

// Place robot to the left of the physics stack
robotRoot.transform.setPosition(-5, 0.9, 0);

// Add all meshes to the scene so the renderer sees them
scene.add(robotRoot);

// -----------------------------------------------------------------------
// Animation clips — created purely from keyframe data (no glTF needed)
// -----------------------------------------------------------------------

const TAU = Math.PI * 2;

// Helper: pack a Float32Array for a rotation track (sequence of [x,y,z,w])
function rotKeys(frames: [number, number, number, number][]): Float32Array {
  const out = new Float32Array(frames.length * 4);
  for (let i = 0; i < frames.length; i++) {
    out[i * 4]     = frames[i][0];
    out[i * 4 + 1] = frames[i][1];
    out[i * 4 + 2] = frames[i][2];
    out[i * 4 + 3] = frames[i][3];
  }
  return out;
}

// Helper: pack a Float32Array for a position track (sequence of [x,y,z])
function posKeys(frames: [number, number, number][]): Float32Array {
  const out = new Float32Array(frames.length * 3);
  for (let i = 0; i < frames.length; i++) {
    out[i * 3]     = frames[i][0];
    out[i * 3 + 1] = frames[i][1];
    out[i * 3 + 2] = frames[i][2];
  }
  return out;
}

// Utility: axis-angle to quaternion
function axisAngle(ax: number, ay: number, az: number, rad: number): [number, number, number, number] {
  const s = Math.sin(rad / 2);
  return [ax * s, ay * s, az * s, Math.cos(rad / 2)];
}

// -----------------------------------------------------------------------
// CLIP 1: "idle" — gentle torso bob + slow head look around
// -----------------------------------------------------------------------

const idleDuration = 2.0;
const idleTimes4 = new Float32Array([0, 0.5, 1.0, 1.5, 2.0]);
const idleTimes2 = new Float32Array([0, 1.0, 2.0]);

// Torso bobs up/down
const idleTorsoPos = new AnimationTrack(
  'torsoJoint', 'position',
  idleTimes4,
  posKeys([
    [0, 0, 0],
    [0, 0.04, 0],
    [0, 0, 0],
    [0, 0.04, 0],
    [0, 0, 0],
  ]),
  Interpolation.LINEAR,
);

// Head tilts slightly
const idleHeadRot = new AnimationTrack(
  'headJoint', 'rotation',
  idleTimes2,
  rotKeys([
    axisAngle(0, 1, 0,  0.0),
    axisAngle(0, 1, 0,  0.3),
    axisAngle(0, 1, 0,  0.0),
  ]),
  Interpolation.LINEAR,
);

// Arms hang at sides with tiny swing
const idleArmLRot = new AnimationTrack(
  'armLJoint', 'rotation',
  idleTimes4,
  rotKeys([
    axisAngle(1, 0, 0,  0.1),
    axisAngle(1, 0, 0,  0.0),
    axisAngle(1, 0, 0,  0.1),
    axisAngle(1, 0, 0,  0.0),
    axisAngle(1, 0, 0,  0.1),
  ]),
  Interpolation.LINEAR,
);

const idleArmRRot = new AnimationTrack(
  'armRJoint', 'rotation',
  idleTimes4,
  rotKeys([
    axisAngle(1, 0, 0, -0.1),
    axisAngle(1, 0, 0,  0.0),
    axisAngle(1, 0, 0, -0.1),
    axisAngle(1, 0, 0,  0.0),
    axisAngle(1, 0, 0, -0.1),
  ]),
  Interpolation.LINEAR,
);

const idleClip = new AnimationClip('idle', [
  idleTorsoPos,
  idleHeadRot,
  idleArmLRot,
  idleArmRRot,
], idleDuration);

// -----------------------------------------------------------------------
// CLIP 2: "wave" — right arm raises and waves (forearm flaps)
// -----------------------------------------------------------------------

const waveDuration = 1.2;
const waveTimes3 = new Float32Array([0.0, 0.3, 0.6, 0.9, 1.2]);

// Upper right arm raises to ~90° forward
const waveShoulderRot = new AnimationTrack(
  'armRJoint', 'rotation',
  waveTimes3,
  rotKeys([
    axisAngle(1, 0, 0, 0.0),
    axisAngle(1, 0, 0, -1.5),
    axisAngle(1, 0, 0, -1.5),
    axisAngle(1, 0, 0, -1.5),
    axisAngle(1, 0, 0, 0.0),
  ]),
  Interpolation.LINEAR,
);

// Forearm flaps at elbow
const waveElbowRot = new AnimationTrack(
  'lArmRJoint', 'rotation',
  waveTimes3,
  rotKeys([
    axisAngle(1, 0, 0, 0.0),
    axisAngle(1, 0, 0, 0.6),
    axisAngle(1, 0, 0, -0.3),
    axisAngle(1, 0, 0, 0.6),
    axisAngle(1, 0, 0, 0.0),
  ]),
  Interpolation.LINEAR,
);

// Torso stays centred
const waveTorsoPos = new AnimationTrack(
  'torsoJoint', 'position',
  new Float32Array([0.0, 1.2]),
  posKeys([[0, 0, 0], [0, 0, 0]]),
  Interpolation.STEP,
);

const waveClip = new AnimationClip('wave', [
  waveShoulderRot,
  waveElbowRot,
  waveTorsoPos,
], waveDuration);

// -----------------------------------------------------------------------
// Mixer
// -----------------------------------------------------------------------
const robotMixer = new AnimationMixer(robotRoot);
const idleAction = robotMixer.play(idleClip, { loop: true, weight: 1 });
const waveAction = robotMixer.play(waveClip, { loop: true, weight: 0 });
waveAction.pause();  // starts dormant; crossFadeTo will resume it

let robotAnimMode: 'idle' | 'wave' = 'idle';

// Tab key to crossfade between idle ↔ wave
window.addEventListener('keydown', (e) => {
  if (e.code === 'Tab') {
    e.preventDefault();
    if (robotAnimMode === 'idle') {
      robotMixer.crossFadeTo(idleAction, waveAction, 0.4);
      robotAnimMode = 'wave';
    } else {
      robotMixer.crossFadeTo(waveAction, idleAction, 0.4);
      robotAnimMode = 'idle';
    }
  }
});

// Label above robot (using existing settings panel pattern - small overlay)
const robotLabel = document.createElement('div');
robotLabel.style.cssText =
  'position:fixed;bottom:8px;left:8px;background:rgba(0,0,0,0.65);color:#fff;' +
  'padding:8px 12px;border-radius:6px;font:12px monospace;z-index:1000;';
robotLabel.innerHTML =
  '<b>Robot (Phase 13 — Animation)</b><br>' +
  'Press <b>Tab</b> to crossfade: Idle ↔ Wave';
document.body.appendChild(robotLabel);

// --- Phase 12: Frustum culling, BVH, Render queue ---
const frustum      = new Frustum();
const bvh          = new BVH();
const renderQueue  = new RenderQueue();

// Physics worker host — initialised after all bodies are created; starts engine when ready.
let physicsHost: PhysicsWorkerHost | null = null;
let cameraBodyIdx = -1;

// --- Settings UI ---
const panel = document.createElement('div');
panel.style.cssText =
  'position:fixed;top:8px;right:8px;background:rgba(0,0,0,0.7);color:#fff;' +
  'padding:12px;border-radius:6px;font:13px monospace;z-index:1000;display:flex;flex-direction:column;gap:8px;';

function addSlider(label: string, min: number, max: number, step: number, value: number, onChange: (v: number) => void) {
  const row = document.createElement('label');
  row.style.cssText = 'display:flex;align-items:center;gap:8px;';
  const span = document.createElement('span');
  span.style.minWidth = '110px';
  span.textContent = `${label}: ${value}`;
  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  input.style.width = '120px';
  input.addEventListener('input', () => {
    const v = parseFloat(input.value);
    span.textContent = `${label}: ${v}`;
    onChange(v);
  });
  row.appendChild(span);
  row.appendChild(input);
  panel.appendChild(row);
}

addSlider('FOV', 30, 120, 1, camera.fov, (v) => { camera.fov = v; });
addSlider('Sensitivity', 0.05, 1, 0.05, controller.lookSensitivity, (v) => { controller.lookSensitivity = v; });
addSlider('Exposure', 0.1, 3, 0.1, postProcess.exposure, (v) => { postProcess.exposure = v; });
addSlider('Bloom', 0, 1, 0.05, postProcess.bloomStrength, (v) => { postProcess.bloomStrength = v; });
addSlider('Vignette', 0, 1, 0.05, postProcess.vignetteStrength, (v) => { postProcess.vignetteStrength = v; });

// --- Debug mode toggle ---
let debugMode = false;
const debugRow = document.createElement('label');
debugRow.style.cssText = 'display:flex;align-items:center;gap:8px;cursor:pointer;';
const debugCheckbox = document.createElement('input');
debugCheckbox.type = 'checkbox';
debugCheckbox.checked = debugMode;
function setDebugMode(on: boolean) {
  debugMode = on;
  debugCheckbox.checked = on;
  stats.setVisible(on);
  debugRenderer.enabled = on;
  inspector.setVisible(on);
}
debugCheckbox.addEventListener('change', () => setDebugMode(debugCheckbox.checked));

// F3 keybinding to toggle debug mode
window.addEventListener('keydown', (e) => {
  if (e.code === 'F3') {
    e.preventDefault();
    setDebugMode(!debugMode);
  }
});
const debugLabel = document.createElement('span');
debugLabel.textContent = 'Debug Mode';
debugRow.appendChild(debugCheckbox);
debugRow.appendChild(debugLabel);
panel.appendChild(debugRow);

document.body.appendChild(panel);

// Apply initial debug state
setDebugMode(debugMode);

// Handle resize
engine.on('resize', () => {
  camera.aspect = engine.canvas.width / engine.canvas.height;
  postProcess.resize(engine.canvas.width, engine.canvas.height);
});

/**
 * Helper: compute the 3×3 normal matrix (inverse transpose of upper-left 3×3 of model).
 * Returns a Float32Array(9) suitable for uniform3fv.
 */
function getNormalMatrix(model: Matrix4): Float32Array {
  const m = model.data;
  // Compute the upper-left 3×3 inverse transpose
  const a00 = m[0], a01 = m[1], a02 = m[2];
  const a10 = m[4], a11 = m[5], a12 = m[6];
  const a20 = m[8], a21 = m[9], a22 = m[10];

  const det = a00 * (a11 * a22 - a12 * a21)
            - a01 * (a10 * a22 - a12 * a20)
            + a02 * (a10 * a21 - a11 * a20);

  const invDet = 1.0 / det;

  // Inverse (transposed) — columns of the inverse become rows
  return new Float32Array([
    (a11 * a22 - a12 * a21) * invDet,
    (a02 * a21 - a01 * a22) * invDet,
    (a01 * a12 - a02 * a11) * invDet,
    (a12 * a20 - a10 * a22) * invDet,
    (a00 * a22 - a02 * a20) * invDet,
    (a02 * a10 - a00 * a12) * invDet,
    (a10 * a21 - a11 * a20) * invDet,
    (a01 * a20 - a00 * a21) * invDet,
    (a00 * a11 - a01 * a10) * invDet,
  ]);
}

/**
 * Upload light uniforms to the phong shader.
 */
function setLightUniforms(shader: ShaderProgram, lights: Light[]): void {
  shader.setInt('u_numLights', lights.length);
  for (let i = 0; i < lights.length && i < 8; i++) {
    const l = lights[i];
    const prefix = `u_lights[${i}]`;
    shader.setInt(`${prefix}.type`, l.lightType);
    shader.setVec3(`${prefix}.color`, l.color[0], l.color[1], l.color[2]);
    shader.setFloat(`${prefix}.intensity`, l.intensity);

    if (l.lightType === LightType.DIRECTIONAL) {
      const dl = l as DirectionalLight;
      shader.setVec3(`${prefix}.direction`, dl.direction.x, dl.direction.y, dl.direction.z);
      shader.setVec3(`${prefix}.position`, 0, 0, 0);
      shader.setFloat(`${prefix}.range`, 0);
      shader.setFloat(`${prefix}.innerAngle`, 0);
      shader.setFloat(`${prefix}.outerAngle`, 0);
    } else if (l.lightType === LightType.POINT) {
      const pl = l as PointLight;
      const pos = pl.getWorldPosition();
      shader.setVec3(`${prefix}.position`, pos.x, pos.y, pos.z);
      shader.setVec3(`${prefix}.direction`, 0, 0, 0);
      shader.setFloat(`${prefix}.range`, pl.range);
      shader.setFloat(`${prefix}.innerAngle`, 0);
      shader.setFloat(`${prefix}.outerAngle`, 0);
    }
  }
}

// --- Physics update on fixed timestep (runs in web worker) ---
engine.on('fixedUpdate', (fixedDt: number) => {
  // Lock camera body rotation — zeroed state is pushed to worker via kinematicUpdates
  cameraBody.angularVelocity.set(0, 0, 0);
  cameraBody.rotation = Quaternion.identity();
  // Fire-and-forget: transforms are applied asynchronously when the worker responds.
  physicsHost?.step(fixedDt, [cameraBodyIdx]);
  stats.setPhysicsTime(physicsHost?.lastStepTime ?? 0);
});

// --- Per-frame stats & inspector ---
engine.on('update', (dt: number) => {
  stats.update(dt);
  inspector.update(dt);
  particles.update(dt);
  // Phase 13 — advance robot animation mixer
  robotMixer.update(dt);
  // Update world matrices immediately after animation so transforms are current
  scene.updateMatrixWorld();
});

engine.on('render', () => {
  // Update camera controller
  controller.update(engine.clock.getDelta());

  // World matrices already updated in 'update' event (after animation);
  // re-run only for camera changes this frame.
  scene.updateMatrixWorld();

  // --- Shadow pass ---
  const lightSpaceMatrix = sun.getLightSpaceMatrix(new Vector3(0, 0, 0));
  shadowMap.render(lightSpaceMatrix, scene.meshes, renderer);

  // --- Restore viewport to canvas size ---
  gl.viewport(0, 0, engine.canvas.width, engine.canvas.height);

  // --- Begin post-processing ---
  postProcess.begin();

  // --- Main render pass ---
  renderer.clear();
  renderer.resetStats();

  const viewMatrix = camera.viewMatrix;
  const projMatrix = camera.projectionMatrix;
  const camPos = camera.transform.worldMatrix.getTranslation();

  // Collect lights
  const lights = scene.lights.map(n => n as Light);

  // --- Frustum culling via BVH ---
  frustum.fromViewProjection(camera.viewProjectionMatrix);
  const meshNodes = scene.meshes as Mesh[];
  const allBounds = meshNodes.map(m => m.getWorldBVHBounds());
  bvh.refit(allBounds);
  const visibleIdxs: number[] = [];
  bvh.query(frustum, visibleIdxs);

  // Build sorted render queue (minimises shader + material switches)
  renderQueue.clear();
  for (const idx of visibleIdxs) {
    const m = meshNodes[idx];
    if (m.visible) renderQueue.add(m);
  }
  renderQueue.sort();

  for (const { mesh } of renderQueue.items) {

    // SkinnedMesh: use skin VAO and upload joint matrices
    const isSkinned = mesh instanceof SkinnedMesh && (mesh as SkinnedMesh).skeleton;
    const vao = isSkinned
      ? (mesh as SkinnedMesh).ensureSkinVAO(gl)
      : mesh.ensureGPUBuffers(gl);

    mesh.material.bind(gl);
    const shader = mesh.material.shader;

    // Transform uniforms
    shader.setMat4('u_model', mesh.transform.worldMatrix.data);
    shader.setMat4('u_view', viewMatrix.data);
    shader.setMat4('u_projection', projMatrix.data);

    // Normal matrix
    const normalMat = getNormalMatrix(mesh.transform.worldMatrix);
    const loc = shader.getUniformLocation('u_normalMatrix');
    if (loc) gl.uniformMatrix3fv(loc, false, normalMat);

    // Camera
    shader.setVec3('u_viewPos', camPos.x, camPos.y, camPos.z);

    // Material maps to phong uniform names
    shader.setVec4('u_diffuseColor', mesh.material.color[0], mesh.material.color[1], mesh.material.color[2], mesh.material.color[3]);

    // Ambient
    shader.setVec3('u_ambientColor', 0.15, 0.15, 0.18);

    // Lights
    setLightUniforms(shader, lights);

    // Shadow map
    shader.setMat4('u_lightSpaceMatrix', lightSpaceMatrix.data);
    shader.setInt('u_useShadowMap', 1);
    shader.setFloat('u_shadowBias', 0.001);
    shadowMap.depthTexture.bind(4);
    shader.setInt('u_shadowMap', 4);

    // Upload joint matrices for skinned meshes
    if (isSkinned) {
      const sm = mesh as SkinnedMesh;
      sm.skeleton!.update();
      const jointLoc = shader.getUniformLocation('u_jointMatrices');
      if (jointLoc) {
        gl.uniformMatrix4fv(jointLoc, false, sm.skeleton!.jointMatrices);
      }
    }

    renderer.drawElements(vao);
  }

  // --- Skybox ---
  skybox.render(camera);

  // --- Instanced mesh field ---
  instancedMesh.render(camera);

  // --- Particles ---
  particles.render(camera);

  // --- End post-processing ---
  postProcess.end();

  // --- Debug overlay pass ---
  debugRenderer.render(camera, physicsWorld);
});

// ---------------------------------------------------------------------------
// Phase 12: Physics Web Worker — initialise and start
// ---------------------------------------------------------------------------
// Build attachment list from the physicsWorld body registry.
// Order matches physicsWorld.bodies, so body indices are stable.
const physicsAttachments = physicsWorld.bodies.map(b => ({ body: b, sceneNode: b.sceneNode }));
cameraBodyIdx = physicsWorld.bodies.indexOf(cameraBody);

physicsHost = new PhysicsWorkerHost();
physicsHost.init(physicsAttachments, physicsWorld.gravity, physicsWorld.iterations).then(() => {
  // Build the initial BVH once all world matrices are settled.
  scene.updateMatrixWorld();
  const initialBounds = (scene.meshes as Mesh[]).map(m => m.getWorldBVHBounds());
  bvh.build(initialBounds);

  engine.start();
});
