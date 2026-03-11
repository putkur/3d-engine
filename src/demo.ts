import { Engine } from './core/Engine';
import { Renderer } from './renderer/Renderer';
import { ShaderProgram } from './renderer/ShaderProgram';
import { Vector3 } from './math/Vector3';
import { Scene } from './scene/Scene';
import { Geometry } from './scene/Geometry';
import { Material } from './scene/Material';
import { Mesh } from './scene/Mesh';
import { PerspectiveCamera } from './camera/PerspectiveCamera';
import { CameraController, CameraMode } from './camera/CameraController';
import { standardVert, standardFrag } from './renderer/shaders';

const engine = new Engine('#engine-canvas');
engine.init();

const gl = engine.gl;
const renderer = new Renderer(gl);
renderer.configure();

// --- Shader ---
const program = ShaderProgram.create(gl, standardVert, standardFrag);

// --- Scene setup ---
const scene = new Scene();

// Create a box
const boxGeo = Geometry.createBox(1, 1, 1);
const boxMat = new Material(program, { color: [0.2, 0.6, 1.0, 1.0] });
const box = new Mesh(boxGeo, boxMat, 'box');
scene.add(box);

// Create a sphere
const sphereGeo = Geometry.createSphere(0.4, 24, 16);
const sphereMat = new Material(program, { color: [1.0, 0.3, 0.2, 1.0] });
const sphere = new Mesh(sphereGeo, sphereMat, 'sphere');
sphere.transform.setPosition(2, 0, 0);
scene.add(sphere);

// Create a ground plane
const planeGeo = Geometry.createPlane(8, 8);
const planeMat = new Material(program, {
  color: [0.3, 0.8, 0.3, 1.0],
  cullFace: false,
});
const plane = new Mesh(planeGeo, planeMat, 'ground');
plane.transform.setPosition(0, -1, 0);
scene.add(plane);

// --- Camera ---
const aspect = engine.canvas.width / engine.canvas.height;
const camera = new PerspectiveCamera(60, aspect, 0.1, 100);
scene.add(camera);

const controller = new CameraController(camera, engine.canvas, {
  mode: CameraMode.ORBIT,
  target: Vector3.zero(),
  distance: 7,
  damping: 0.08,
});

// Handle resize
engine.on('resize', () => {
  camera.aspect = engine.canvas.width / engine.canvas.height;
});

let time = 0;

engine.on('render', () => {
  time += engine.clock.getDelta();

  // Rotate the box
  box.transform.setRotationFromEuler(time * 30, time * 45, 0);

  // Orbit the sphere around the box
  sphere.transform.setPosition(Math.cos(time) * 2, 0, Math.sin(time) * 2);

  // Update camera controller
  controller.update(engine.clock.getDelta());

  // Update all world matrices (includes camera)
  scene.updateMatrixWorld();

  // Get the view-projection from the camera
  const viewProjection = camera.viewProjectionMatrix;

  // --- Render ---
  renderer.clear();
  renderer.resetStats();

  // Draw each mesh in the scene
  for (const node of scene.meshes) {
    const mesh = node as Mesh;
    if (!mesh.visible) continue;

    const vao = mesh.ensureGPUBuffers(gl);

    mesh.material.bind(gl);
    mesh.material.shader.setMat4('u_model', mesh.transform.worldMatrix.data);
    mesh.material.shader.setMat4('u_viewProjection', viewProjection.data);

    renderer.drawElements(vao);
  }
});

engine.start();
