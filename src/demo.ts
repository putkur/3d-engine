import { Engine } from './core/Engine';
import { Renderer } from './renderer/Renderer';
import { ShaderProgram } from './renderer/ShaderProgram';
import { Vector3 } from './math/Vector3';
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

// --- Debug tools ---
const stats = new Stats();
stats.setRenderer(renderer);

const debugRenderer = new DebugRenderer(gl);

const inspector = new Inspector();
inspector.attach(scene, debugRenderer);

// --- Camera ---
const aspect = engine.canvas.width / engine.canvas.height;
const camera = new PerspectiveCamera(60, aspect, 0.1, 100);
scene.add(camera);

camera.transform.setPosition(0, 2, 8);
const controller = new CameraController(camera, engine.input, {
  mode: CameraMode.FIRST_PERSON,
  moveSpeed: 5,
  lookSensitivity: 0.1,
  damping: 0.05,
});

// Click canvas to lock pointer for mouse look
engine.canvas.addEventListener('click', () => {
  controller.requestPointerLock();
});

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

// --- Debug mode toggle ---
let debugMode = true;
const debugRow = document.createElement('label');
debugRow.style.cssText = 'display:flex;align-items:center;gap:8px;cursor:pointer;';
const debugCheckbox = document.createElement('input');
debugCheckbox.type = 'checkbox';
debugCheckbox.checked = debugMode;
debugCheckbox.addEventListener('change', () => {
  debugMode = debugCheckbox.checked;
  stats.setVisible(debugMode);
  debugRenderer.enabled = debugMode;
  inspector.setVisible(debugMode);
});
const debugLabel = document.createElement('span');
debugLabel.textContent = 'Debug Mode';
debugRow.appendChild(debugCheckbox);
debugRow.appendChild(debugLabel);
panel.appendChild(debugRow);

document.body.appendChild(panel);

// Handle resize
engine.on('resize', () => {
  camera.aspect = engine.canvas.width / engine.canvas.height;
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

// --- Physics update on fixed timestep ---
engine.on('fixedUpdate', (fixedDt: number) => {
  const t0 = performance.now();
  physicsWorld.step(fixedDt);
  stats.setPhysicsTime((performance.now() - t0) / 1000);
});

// --- Per-frame stats & inspector ---
engine.on('update', (dt: number) => {
  stats.update(dt);
  inspector.update(dt);
});

engine.on('render', () => {
  // Interpolate physics bodies for smooth rendering
  const alpha = engine.clock.accumulator / engine.clock.fixedDeltaTime;
  physicsWorld.syncToScene(alpha);

  // Update camera controller
  controller.update(engine.clock.getDelta());

  // Update all world matrices (includes camera)
  scene.updateMatrixWorld();

  // --- Shadow pass ---
  const lightSpaceMatrix = sun.getLightSpaceMatrix(new Vector3(0, 0, 0));
  shadowMap.render(lightSpaceMatrix, scene.meshes, renderer);

  // --- Restore viewport to canvas size ---
  gl.viewport(0, 0, engine.canvas.width, engine.canvas.height);

  // --- Main render pass ---
  renderer.clear();
  renderer.resetStats();

  const viewMatrix = camera.viewMatrix;
  const projMatrix = camera.projectionMatrix;
  const camPos = camera.transform.worldMatrix.getTranslation();

  // Collect lights
  const lights = scene.lights.map(n => n as Light);

  for (const node of scene.meshes) {
    const mesh = node as Mesh;
    if (!mesh.visible) continue;

    const vao = mesh.ensureGPUBuffers(gl);

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

    renderer.drawElements(vao);
  }

  // --- Debug overlay pass ---
  debugRenderer.render(camera, physicsWorld);
});

engine.start();
