import { Engine } from './core/Engine';
import { Renderer } from './renderer/Renderer';
import { ShaderProgram } from './renderer/ShaderProgram';
import { CubeTexture } from './renderer/CubeTexture';
import { Skybox } from './renderer/Skybox';
import { Vector3 } from './math/Vector3';
import { Matrix4 } from './math/Matrix4';
import { Scene } from './scene/Scene';
import { Geometry } from './scene/Geometry';
import { Material } from './scene/Material';
import { Mesh } from './scene/Mesh';
import { PerspectiveCamera } from './camera/PerspectiveCamera';
import { DirectionalLight } from './lighting/DirectionalLight';
import { PointLight } from './lighting/PointLight';
import { Light, LightType } from './lighting/Light';
import { phongVert, phongFrag } from './renderer/shaders';
import { RigidBody, BodyType } from './physics/RigidBody';
import { BoxCollider } from './physics/BoxCollider';
import { ShipFlightController, type ShipHudState } from './gameplay/ShipFlightController';
import { CockpitHUD, OffscreenEnemyIndicator, type TargetingOverlay } from './gameplay/CockpitHUD';
import { ShipCombatSystem, type TargetingSolution } from './gameplay/ShipCombatSystem';

const engine = new Engine('#engine-canvas');
engine.init();

const gl = engine.gl;
const renderer = new Renderer(gl);
renderer.configure();

const program = ShaderProgram.create(gl, phongVert, phongFrag);
const scene = new Scene();

const skyboxCube = CubeTexture.createSolid(gl, 0.015, 0.02, 0.045);
const skybox = new Skybox(gl, skyboxCube);

const shipGeo = Geometry.createBox(1.2, 0.4, 2.4);
const shipMat = new Material(program, {
  color: [0.7, 0.78, 0.9, 1.0],
  specular: 0.9,
  shininess: 96,
});
const shipMesh = new Mesh(shipGeo, shipMat, 'player-ship');
shipMesh.transform.setPosition(0, 2, 8);
scene.add(shipMesh);

const shipBody = new RigidBody(BodyType.KINEMATIC);
shipBody.position = new Vector3(0, 2, 8);
shipBody.collider = new BoxCollider(new Vector3(0.6, 0.2, 1.2));
shipBody.computeInertia();
shipBody.restitution = 0.0;
shipBody.friction = 0.35;
shipBody.sceneNode = shipMesh;

const camera = new PerspectiveCamera(90, engine.canvas.width / engine.canvas.height, 0.1, 7000);
shipMesh.add(camera);
camera.transform.setPosition(0, 0.18, 0.52);

const shipController = new ShipFlightController(engine.input, shipBody, {
  lookSensitivity: 0.09,
  maxForwardSpeed: 74,
  maxReverseSpeed: 21,
  boostMultiplier: 1.45,
  acceleration: 30,
  brakeDamping: 2.9,
  lateralDamping: 3.9,
  strafeResponse: 7.2,
  strafeDriftDamping: 1.35,
  throttleChangeRate: 0.9,
  throttleSmoothing: 3.4,
  angularResponse: 8.8,
  maxPitchRate: 88,
  maxYawRate: 92,
  maxRollRate: 122,
});

const cockpitHud = new CockpitHUD();
const combatSystem = new ShipCombatSystem(engine.input, scene, program, shipBody, {
  fireCooldown: 0.11,
  projectileSpeed: 220,
  projectileLifetime: 2.3,
  shieldDamage: 30,
  hullDamage: 14,
  enemyProjectileSpeed: 95,
});

let sfxContext: AudioContext | null = null;
let lastHitConfirm = 0;
let lastIncomingHit = 0;
let lastEnemiesAlive = Number.POSITIVE_INFINITY;

let engineLowOsc: OscillatorNode | null = null;
let engineHighOsc: OscillatorNode | null = null;
let engineMasterGain: GainNode | null = null;
let engineLowGain: GainNode | null = null;
let engineHighGain: GainNode | null = null;
let engineLowFilter: BiquadFilterNode | null = null;
let enginePresenceFilter: BiquadFilterNode | null = null;
let engineWarpPhase = 0;
const ENGINE_LOUDNESS = 2.6;

const sun = new DirectionalLight(new Vector3(-0.45, -1, -0.3), [1.0, 0.95, 0.85], 1.8);
scene.add(sun);

const pointLight = new PointLight([0.4, 0.5, 1.0], 0.8, 26);
pointLight.transform.setPosition(5, 3, -10);
scene.add(pointLight);

const backdropAnimators = addSpaceBackdrop(scene, program);

const controlsHint = document.createElement('div');
controlsHint.style.cssText =
  'position:fixed;bottom:8px;left:8px;background:rgba(0,0,0,0.65);color:#fff;' +
  'padding:8px 12px;border-radius:6px;font:12px monospace;z-index:1000;';
controlsHint.innerHTML =
  '<b>Cockpit Controls</b><br>' +
  'Mouse: aim | W/S throttle | A/D strafe | Q/E roll<br>' +
  'LMB or Space: fire | 1/2 weapon | C cycle target | L select target<br>' +
  'Shift: boost | Ctrl: brake | T: FA toggle';
document.body.appendChild(controlsHint);

engine.canvas.addEventListener('click', () => {
  ensureAudioReady();
  shipController.requestPointerLock();
});

window.addEventListener('keydown', () => {
  ensureAudioReady();
}, { passive: true });

window.addEventListener('pointerdown', () => {
  ensureAudioReady();
}, { passive: true });

const panel = document.createElement('div');
panel.style.cssText =
  'position:fixed;top:8px;right:8px;background:rgba(0,0,0,0.7);color:#fff;' +
  'padding:12px;border-radius:6px;font:13px monospace;z-index:1000;display:flex;flex-direction:column;gap:8px;';
document.body.appendChild(panel);

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
addSlider('Sensitivity', 0.01, 0.35, 0.005, shipController.lookSensitivity, (v) => { shipController.lookSensitivity = v; });

engine.on('resize', () => {
  camera.aspect = engine.canvas.width / engine.canvas.height;
  cockpitHud.resize();
});

engine.on('update', (dt: number) => {
  shipController.update(dt);
  const shipHud = shipController.getHudState();

  for (const anim of backdropAnimators) {
    anim.yaw += anim.yawRate * dt;
    anim.pitch += anim.pitchRate * dt;
    anim.roll += anim.rollRate * dt;
    anim.mesh.transform.setRotationFromEuler(anim.pitch, anim.yaw, anim.roll);
  }

  scene.updateMatrixWorld();
  const aimOrigin = camera.transform.worldMatrix.getTranslation();
  const aimDirection = camera.transform.getForward().normalizeSelf();
  combatSystem.setAimRay(aimOrigin, aimDirection);

  combatSystem.update(dt);

  const combatHud = combatSystem.getHudState();
  if (combatHud.hitConfirm > 0 && lastHitConfirm <= 0) {
    playTone(980, 0.05, 'triangle', 0.03);
    playTone(1320, 0.032, 'sine', 0.016);
  }
  if (combatHud.incomingHit > 0 && lastIncomingHit <= 0) {
    playTone(180, 0.09, 'square', 0.04);
  }
  if (combatHud.enemiesAlive < lastEnemiesAlive) {
    playTargetDestroyedTone();
  }
  lastIncomingHit = combatHud.incomingHit;
  lastEnemiesAlive = combatHud.enemiesAlive;

  updateEngineAudio(shipHud, dt);

  const targetingSolution = combatSystem.getTargetingSolution();
  const indicators = buildOffscreenEnemyIndicators(camera, combatSystem.getEnemyTrackingTargets(), targetingSolution);
  const targetingOverlay = buildTargetingOverlay(camera, targetingSolution);
  cockpitHud.render(shipHud, combatHud, indicators, targetingOverlay);

  scene.updateMatrixWorld();
});

engine.on('render', () => {
  scene.updateMatrixWorld();

  renderer.clear();
  renderer.resetStats();

  skybox.render(camera);

  const viewMatrix = camera.viewMatrix;
  const projMatrix = camera.projectionMatrix;
  const camPos = camera.transform.worldMatrix.getTranslation();
  const lights = scene.lights.map(n => n as Light);

  const meshNodes = scene.meshes as Mesh[];
  for (const mesh of meshNodes) {
    if (!mesh.visible) continue;

    const vao = mesh.ensureGPUBuffers(gl);
    mesh.material.bind(gl);
    const shader = mesh.material.shader;

    shader.setMat4('u_model', mesh.transform.worldMatrix.data);
    shader.setMat4('u_view', viewMatrix.data);
    shader.setMat4('u_projection', projMatrix.data);

    const normalMat = getNormalMatrix(mesh.transform.worldMatrix);
    const loc = shader.getUniformLocation('u_normalMatrix');
    if (loc) gl.uniformMatrix3fv(loc, false, normalMat);

    shader.setVec3('u_viewPos', camPos.x, camPos.y, camPos.z);
    shader.setVec4('u_diffuseColor', mesh.material.color[0], mesh.material.color[1], mesh.material.color[2], mesh.material.color[3]);
    shader.setVec3('u_ambientColor', 0.34, 0.34, 0.42);

    setLightUniforms(shader, lights);
    shader.setInt('u_useShadowMap', 0);

    renderer.drawElements(vao);
  }
});

engine.start();

function buildOffscreenEnemyIndicators(
  cam: PerspectiveCamera,
  targets: Array<{ x: number; y: number; z: number }>,
  targeting: TargetingSolution | null,
): OffscreenEnemyIndicator[] {
  const markers: OffscreenEnemyIndicator[] = [];
  const camPos = cam.transform.worldMatrix.getTranslation();
  const forward = cam.transform.getForward().normalizeSelf();
  const right = cam.transform.getRight().normalizeSelf();
  const up = cam.transform.getUp().normalizeSelf();

  const tanHalfV = Math.tan((cam.fov * Math.PI / 180) * 0.5);
  const tanHalfH = tanHalfV * cam.aspect;
  const edge = 0.88;

  for (const t of targets) {
    const toTarget = new Vector3(t.x - camPos.x, t.y - camPos.y, t.z - camPos.z);
    const z = toTarget.dot(forward);
    const x = toTarget.dot(right);
    const y = toTarget.dot(up);

    let nx = 0;
    let ny = 0;
    let behind = false;

    if (z > 0.001) {
      nx = x / (z * tanHalfH);
      ny = y / (z * tanHalfV);
      if (Math.abs(nx) <= 1 && Math.abs(ny) <= 1) {
        continue;
      }
    } else {
      const lateralLen = Math.max(1e-6, Math.hypot(x, y));
      nx = -x / lateralLen;
      ny = -y / lateralLen;
      behind = true;
    }

    const inv = edge / Math.max(1e-6, Math.max(Math.abs(nx), Math.abs(ny)));
    const isTargeted = targeting
      ? distance(t, targeting.target) < 0.001
      : false;
    markers.push({
      nx: nx * inv,
      ny: ny * inv,
      behind,
      targeted: isTargeted,
    });
  }

  return markers;
}

function buildTargetingOverlay(
  cam: PerspectiveCamera,
  solution: TargetingSolution | null,
): TargetingOverlay | undefined {
  if (!solution) return undefined;

  const target = projectWorldToHudNdc(cam, solution.target);
  const lead = projectWorldToHudNdc(cam, solution.lead);

  return {
    targetVisible: target.visible,
    targetNx: target.nx,
    targetNy: target.ny,
    targetDistance: Math.max(0, distance(cam.transform.worldMatrix.getTranslation(), solution.target)),
    leadVisible: lead.visible,
    leadNx: lead.nx,
    leadNy: lead.ny,
    targetLocked: solution.locked,
  };
}

function distance(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.hypot(dx, dy, dz);
}

function projectWorldToHudNdc(
  cam: PerspectiveCamera,
  point: { x: number; y: number; z: number },
): { nx: number; ny: number; visible: boolean } {
  const camPos = cam.transform.worldMatrix.getTranslation();
  const to = new Vector3(point.x - camPos.x, point.y - camPos.y, point.z - camPos.z);
  const z = to.dot(cam.transform.getForward().normalizeSelf());
  if (z <= 0.001) {
    return { nx: 0, ny: 0, visible: false };
  }

  const x = to.dot(cam.transform.getRight().normalizeSelf());
  const y = to.dot(cam.transform.getUp().normalizeSelf());
  const tanHalfV = Math.tan((cam.fov * Math.PI / 180) * 0.5);
  const tanHalfH = tanHalfV * cam.aspect;
  const nx = x / (z * tanHalfH);
  const ny = y / (z * tanHalfV);
  const visible = Math.abs(nx) <= 1 && Math.abs(ny) <= 1;
  return { nx, ny, visible };
}

function getNormalMatrix(model: Matrix4): Float32Array {
  const m = model.data;
  const a00 = m[0], a01 = m[1], a02 = m[2];
  const a10 = m[4], a11 = m[5], a12 = m[6];
  const a20 = m[8], a21 = m[9], a22 = m[10];

  const det = a00 * (a11 * a22 - a12 * a21)
            - a01 * (a10 * a22 - a12 * a20)
            + a02 * (a10 * a21 - a11 * a20);

  const invDet = 1.0 / det;
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

function setLightUniforms(shader: ShaderProgram, lights: Light[]): void {
  const maxLights = Math.min(lights.length, 8);
  shader.setInt('u_numLights', maxLights);
  for (let i = 0; i < maxLights; i++) {
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

function playTone(freq: number, duration: number, type: OscillatorType, gainValue: number): void {
  if (!sfxContext || sfxContext.state !== 'running') return;

  const osc = sfxContext.createOscillator();
  const gain = sfxContext.createGain();
  const now = sfxContext.currentTime;

  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);

  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(gainValue, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(gain);
  gain.connect(sfxContext.destination);

  osc.start(now);
  osc.stop(now + duration);
}

function playTargetDestroyedTone(): void {
  if (!sfxContext || sfxContext.state !== 'running') return;

  const now = sfxContext.currentTime;
  const osc = sfxContext.createOscillator();
  const gain = sfxContext.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(420, now);
  osc.frequency.exponentialRampToValueAtTime(1040, now + 0.12);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.045, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

  osc.connect(gain);
  gain.connect(sfxContext.destination);
  osc.start(now);
  osc.stop(now + 0.24);
}

function ensureEngineAudioLoop(): void {
  if (!sfxContext || engineLowOsc) return;

  engineLowOsc = sfxContext.createOscillator();
  engineHighOsc = sfxContext.createOscillator();

  engineMasterGain = sfxContext.createGain();
  engineLowGain = sfxContext.createGain();
  engineHighGain = sfxContext.createGain();

  engineLowFilter = sfxContext.createBiquadFilter();
  enginePresenceFilter = sfxContext.createBiquadFilter();

  engineLowOsc.type = 'triangle';
  engineLowOsc.frequency.value = 62;
  engineHighOsc.type = 'sawtooth';
  engineHighOsc.frequency.value = 140;

  engineLowFilter.type = 'lowpass';
  engineLowFilter.frequency.value = 420;
  engineLowFilter.Q.value = 0.75;

  enginePresenceFilter.type = 'bandpass';
  enginePresenceFilter.frequency.value = 900;
  enginePresenceFilter.Q.value = 1.2;

  engineLowGain.gain.value = 0.0001;
  engineHighGain.gain.value = 0.0001;
  engineMasterGain.gain.value = 0.0001;

  engineLowOsc.connect(engineLowFilter);
  engineLowFilter.connect(engineLowGain);
  engineLowGain.connect(engineMasterGain);

  engineHighOsc.connect(enginePresenceFilter);
  enginePresenceFilter.connect(engineHighGain);
  engineHighGain.connect(engineMasterGain);

  engineMasterGain.connect(sfxContext.destination);

  engineLowOsc.start();
  engineHighOsc.start();
}

function ensureAudioReady(): void {
  if (!sfxContext) {
    sfxContext = new AudioContext();
  }
  if (sfxContext.state === 'suspended') {
    void sfxContext.resume();
  }
  ensureEngineAudioLoop();
}

function updateEngineAudio(hud: ShipHudState, dt: number): void {
  if (
    !sfxContext ||
    sfxContext.state !== 'running' ||
    !engineLowOsc ||
    !engineHighOsc ||
    !engineMasterGain ||
    !engineLowGain ||
    !engineHighGain ||
    !engineLowFilter ||
    !enginePresenceFilter
  ) {
    return;
  }

  if (!engineLowOsc) {
    ensureEngineAudioLoop();
    if (!engineLowOsc) {
      return;
    }
  }

  const absSpeed = Math.abs(hud.speed);
  const speedMagnitude01 = Math.min(1, hud.speedMagnitude / 90);
  const throttleIntent = Math.min(1, Math.abs(hud.throttle));
  const throttleTargetIntent = Math.min(1, Math.abs(hud.throttleTarget));
  const strafeIntent = Math.min(1, Math.abs(hud.strafeInput));
  const rotationIntent = Math.min(
    1,
    (Math.abs(hud.pitchRate) / 90 + Math.abs(hud.yawRate) / 90 + Math.abs(hud.rollRate) / 120) / 3,
  );
  const brakingIntent = hud.brakeActive ? 1 : 0;
  const boostIntent = hud.boostActive ? 1 : 0;

  const maneuverIntent = Math.min(1, strafeIntent * 0.7 + rotationIntent * 0.75 + brakingIntent * 0.45);
  const throttleResponse = Math.min(1, Math.max(throttleIntent, throttleTargetIntent * 0.85) * 1.25);
  const drive = Math.min(
    1,
    Math.max(
      throttleResponse * 0.84,
      throttleIntent * 0.45 + speedMagnitude01 * 0.78 + maneuverIntent * 0.72 + boostIntent * 0.18,
    ),
  );
  const reverse = hud.speed < -0.75 || hud.throttle < -0.08;

  // Fade out hard near idle so the engine settles when drifting/stopped.
  const idleFade = Math.max(0, Math.min(1, (drive - 0.012) / 0.17));

  engineWarpPhase += dt * (1.4 + drive * 4.8);
  const flutter = Math.sin(engineWarpPhase) * (1.8 + drive * 4.2);
  const microPitch = Math.sin(engineWarpPhase * 2.7) * 0.7 + Math.cos(engineWarpPhase * 1.9) * 0.45;
  const maneuverPitch = rotationIntent * 8 + strafeIntent * 5;

  const targetLowFreq = 52 + drive * 118 + flutter * 0.28 + microPitch * 0.45 + maneuverPitch * 0.22 + (reverse ? -6 : 0);
  const targetHighFreq = 118 + drive * 290 + flutter * 0.9 + microPitch * 1.05 + maneuverPitch * 0.55 + (reverse ? -16 : 0);

  const targetLowGain = (0.0001 + idleFade * (0.016 + drive * 0.024)) * ENGINE_LOUDNESS;
  const targetHighGain = (0.00008 + idleFade * (0.005 + drive * 0.016 + maneuverIntent * 0.006)) * ENGINE_LOUDNESS;
  const targetMasterGain = (0.0001 + idleFade * (0.016 + drive * 0.040)) * ENGINE_LOUDNESS;

  const targetLowFilter = 250 + drive * 950;
  const targetPresenceFilter = 720 + drive * 1850;

  const now = sfxContext.currentTime;
  const lerpTime = Math.max(0.012, Math.min(0.08, dt * 2.2));

  engineLowOsc.frequency.setTargetAtTime(targetLowFreq, now, lerpTime);
  engineHighOsc.frequency.setTargetAtTime(targetHighFreq, now, lerpTime);

  engineLowGain.gain.setTargetAtTime(targetLowGain, now, lerpTime);
  engineHighGain.gain.setTargetAtTime(targetHighGain, now, lerpTime);
  engineMasterGain.gain.setTargetAtTime(targetMasterGain, now, lerpTime);

  engineLowFilter.frequency.setTargetAtTime(targetLowFilter, now, lerpTime);
  enginePresenceFilter.frequency.setTargetAtTime(targetPresenceFilter, now, lerpTime);
}

type BackdropAnimator = {
  mesh: Mesh;
  yaw: number;
  pitch: number;
  roll: number;
  yawRate: number;
  pitchRate: number;
  rollRate: number;
};

function addSpaceBackdrop(spaceScene: Scene, shader: ShaderProgram): BackdropAnimator[] {
  const animators: BackdropAnimator[] = [];

  const planetPrimary = new Mesh(
    Geometry.createSphere(42, 36, 24),
    new Material(shader, {
      color: [0.18, 0.34, 0.62, 1],
      specular: 0.55,
      shininess: 28,
    }),
    'planet-primary',
  );
  planetPrimary.transform.setPosition(760, 210, -3100);
  spaceScene.add(planetPrimary);
  animators.push({ mesh: planetPrimary, yaw: 0, pitch: 0, roll: 0, yawRate: 1.6, pitchRate: 0.2, rollRate: 0 });

  const planetSecondary = new Mesh(
    Geometry.createSphere(24, 32, 20),
    new Material(shader, {
      color: [0.65, 0.48, 0.28, 1],
      specular: 0.35,
      shininess: 14,
    }),
    'planet-secondary',
  );
  planetSecondary.transform.setPosition(-680, -250, -2700);
  spaceScene.add(planetSecondary);
  animators.push({ mesh: planetSecondary, yaw: 0, pitch: 0, roll: 0, yawRate: -2.1, pitchRate: 0.1, rollRate: 0 });

  const moon = new Mesh(
    Geometry.createSphere(10, 24, 16),
    new Material(shader, {
      color: [0.78, 0.78, 0.82, 1],
      specular: 0.2,
      shininess: 6,
    }),
    'planet-moon',
  );
  moon.transform.setPosition(-735, -210, -2620);
  spaceScene.add(moon);
  animators.push({ mesh: moon, yaw: 0, pitch: 0, roll: 0, yawRate: 3.3, pitchRate: 0, rollRate: 0 });

  const nebulaColors: Array<[number, number, number, number]> = [
    [0.24, 0.14, 0.4, 0.18],
    [0.12, 0.2, 0.36, 0.16],
    [0.34, 0.2, 0.12, 0.14],
  ];
  for (let i = 0; i < 7; i++) {
    const color = nebulaColors[i % nebulaColors.length];
    const nebula = new Mesh(
      Geometry.createSphere(90 + Math.random() * 80, 18, 12),
      new Material(shader, {
        color,
        specular: 0.02,
        shininess: 1,
        cullFace: false,
        blending: true,
        depthWrite: false,
      }),
      `nebula-${i}`,
    );

    const radius = 1800 + Math.random() * 2400;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const nx = radius * Math.sin(phi) * Math.cos(theta);
    const ny = radius * Math.cos(phi) * 0.45;
    const nz = -radius * Math.sin(phi) * Math.sin(theta);
    nebula.transform.setPosition(nx, ny, nz);
    spaceScene.add(nebula);
  }

  const starGeo = Geometry.createSphere(1.25, 10, 8);
  for (let i = 0; i < 260; i++) {
    const star = new Mesh(
      starGeo,
      new Material(shader, {
        color: [0.95 + Math.random() * 0.05, 0.95 + Math.random() * 0.05, 0.92 + Math.random() * 0.08, 1],
        specular: 0.02,
        shininess: 2,
      }),
      `star-${i}`,
    );

    const radius = 1600 + Math.random() * 3800;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const sx = radius * Math.sin(phi) * Math.cos(theta);
    const sy = radius * Math.cos(phi);
    const sz = -radius * Math.sin(phi) * Math.sin(theta);

    star.transform.setPosition(sx, sy, sz);
    spaceScene.add(star);
  }

  const starLightA = new PointLight([0.72, 0.86, 1.0], 2.6, 3000);
  starLightA.transform.setPosition(940, 420, -2650);
  spaceScene.add(starLightA);

  const starLightB = new PointLight([1.0, 0.78, 0.55], 2.2, 2600);
  starLightB.transform.setPosition(-980, -280, -2200);
  spaceScene.add(starLightB);

  const starLightC = new PointLight([0.7, 0.92, 0.95], 1.9, 2400);
  starLightC.transform.setPosition(180, -520, -1900);
  spaceScene.add(starLightC);

  return animators;
}
