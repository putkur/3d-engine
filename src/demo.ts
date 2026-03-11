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

const engine = new Engine('#engine-canvas');
engine.init();

const gl = engine.gl;
const renderer = new Renderer(gl);
renderer.configure();

// --- Shader ---
const program = ShaderProgram.create(gl, phongVert, phongFrag);

// --- Scene setup ---
const scene = new Scene();

// Create a box
const boxGeo = Geometry.createBox(1, 1, 1);
const boxMat = new Material(program, { color: [0.2, 0.6, 1.0, 1.0], specular: 0.5, shininess: 64 });
const box = new Mesh(boxGeo, boxMat, 'box');
box.transform.setPosition(0, 1.0, 0);
scene.add(box);

// Create a sphere
const sphereGeo = Geometry.createSphere(0.4, 24, 16);
const sphereMat = new Material(program, { color: [1.0, 0.3, 0.2, 1.0], specular: 0.8, shininess: 128 });
const sphere = new Mesh(sphereGeo, sphereMat, 'sphere');
sphere.transform.setPosition(2, 0.5, 0);
scene.add(sphere);

// Create a second box to cast/receive shadows
const box2Geo = Geometry.createBox(0.6, 2, 0.6);
const box2Mat = new Material(program, { color: [0.8, 0.8, 0.2, 1.0], specular: 0.3, shininess: 32 });
const box2 = new Mesh(box2Geo, box2Mat, 'tall-box');
box2.transform.setPosition(-3, 1, -1.5);
scene.add(box2);

// Create a ground plane
const planeGeo = Geometry.createPlane(12, 12);
const planeMat = new Material(program, {
  color: [0.4, 0.7, 0.4, 1.0],
  cullFace: false,
  specular: 0.1,
  shininess: 8,
});
const plane = new Mesh(planeGeo, planeMat, 'ground');
plane.transform.setPosition(0, 0, 0);
scene.add(plane);

// --- Lights ---
const sunDir = new Vector3(-0.5, -1, -0.3);
const sun = new DirectionalLight(sunDir, [1.0, 0.95, 0.85], 1.2);
sun.castShadow = true;
sun.shadowOrthoSize = 8;
sun.shadowFar = 30;
scene.add(sun);

const pointLight = new PointLight([0.3, 0.5, 1.0], 1.5, 8);
pointLight.transform.setPosition(2, 2, 2);
scene.add(pointLight);

// --- Shadow map ---
const shadowMap = new ShadowMap(gl, 2048);

// --- Camera ---
const aspect = engine.canvas.width / engine.canvas.height;
const camera = new PerspectiveCamera(60, aspect, 0.1, 100);
scene.add(camera);

const controller = new CameraController(camera, engine.canvas, {
  mode: CameraMode.ORBIT,
  target: new Vector3(0, 0.5, 0),
  distance: 8,
  damping: 0.08,
});

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

let time = 0;

engine.on('render', () => {
  time += engine.clock.getDelta();

  // Rotate the box
  box.transform.setRotationFromEuler(time * 30, time * 45, 0);

  // Orbit the sphere around the box
  sphere.transform.setPosition(Math.cos(time) * 2, 0.5, Math.sin(time) * 2);

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
});

engine.start();
