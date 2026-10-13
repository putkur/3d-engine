import { InputManager } from '../input/InputManager';
import { ShaderProgram } from '../renderer/ShaderProgram';
import { Vector3 } from '../math/Vector3';
import { Scene } from '../scene/Scene';
import { Geometry } from '../scene/Geometry';
import { Material } from '../scene/Material';
import { Mesh } from '../scene/Mesh';
import { RigidBody } from '../physics/RigidBody';

export interface ShipCombatOptions {
  fireCooldown?: number;
  projectileSpeed?: number;
  projectileLifetime?: number;
  shieldDamage?: number;
  hullDamage?: number;
  enemyFireCooldown?: number;
  enemyProjectileSpeed?: number;
  enemyProjectileDamage?: number;
}

export interface CombatHudState {
  weaponReady: boolean;
  cooldown01: number;
  cooldownMs: number;
  projectiles: number;
  enemiesAlive: number;
  targetShield01: number;
  targetHull01: number;
  hitConfirm: number;
  playerShield01: number;
  playerHull01: number;
  incomingHit: number;
}

export interface EnemyTrackTarget {
  x: number;
  y: number;
  z: number;
}

interface EnemyShip {
  mesh: Mesh;
  material: Material;
  halfExtents: Vector3;
  maxShield: number;
  shield: number;
  maxHull: number;
  hull: number;
  hitFlash: number;
  alive: boolean;
  orbitPhase: number;
  orbitRadius: number;
  attackCooldown: number;
}

interface Projectile {
  mesh: Mesh;
  position: Vector3;
  velocity: Vector3;
  life: number;
  radius: number;
  fromEnemy: boolean;
  damage: number;
}

const DEFAULTS: Required<ShipCombatOptions> = {
  fireCooldown: 0.11,
  projectileSpeed: 220,
  projectileLifetime: 2.2,
  shieldDamage: 30,
  hullDamage: 14,
  enemyFireCooldown: 0.75,
  enemyProjectileSpeed: 95,
  enemyProjectileDamage: 12,
};

export class ShipCombatSystem {
  private readonly input: InputManager;
  private readonly scene: Scene;
  private readonly shipBody: RigidBody;
  private readonly opts: Required<ShipCombatOptions>;

  private readonly projectileGeo: Geometry;
  private readonly enemyGeo: Geometry;

  private readonly projectiles: Projectile[] = [];
  private readonly enemies: EnemyShip[] = [];

  private cooldownRemaining = 0;
  private hitConfirmRemaining = 0;
  private incomingHitRemaining = 0;

  private readonly playerHalfExtents = new Vector3(0.6, 0.2, 1.2);
  private readonly playerMaxShield = 160;
  private readonly playerMaxHull = 140;
  private playerShield = this.playerMaxShield;
  private playerHull = this.playerMaxHull;

  private aimOrigin: Vector3;
  private aimDirection: Vector3;

  constructor(
    input: InputManager,
    scene: Scene,
    shader: ShaderProgram,
    shipBody: RigidBody,
    options?: ShipCombatOptions,
  ) {
    this.input = input;
    this.scene = scene;
    this.shipBody = shipBody;
    this.opts = { ...DEFAULTS, ...(options ?? {}) };

    this.projectileGeo = Geometry.createSphere(0.09, 10, 8);
    this.enemyGeo = Geometry.createBox(1.4, 0.5, 1.8);

    this.aimOrigin = shipBody.position.clone();
    this.aimDirection = shipBody.rotation.rotateVector(Vector3.forward()).normalizeSelf();

    this.seedEnemies(shader);
  }

  setAimRay(origin: Vector3, direction: Vector3): void {
    this.aimOrigin.copy(origin);
    this.aimDirection.copy(direction).normalizeSelf();
  }

  update(dt: number): void {
    this.cooldownRemaining = Math.max(0, this.cooldownRemaining - dt);
    this.hitConfirmRemaining = Math.max(0, this.hitConfirmRemaining - dt);
    this.incomingHitRemaining = Math.max(0, this.incomingHitRemaining - dt);

    // Move and resolve existing rounds first so newly spawned rounds do not
    // jump forward and register hits in the same frame they are fired.
    this.updateProjectiles(dt);

    const fireHeld = this.input.mouse.isDown(0) || this.input.keyboard.isDown('Space');
    if (fireHeld && this.cooldownRemaining <= 0) {
      this.firePrimary();
      this.cooldownRemaining = this.opts.fireCooldown;
    }

    this.updateEnemies(dt);
  }

  getHudState(): CombatHudState {
    const target = this.findNearestLivingEnemy();
    const targetShield01 = target ? target.shield / target.maxShield : 0;
    const targetHull01 = target ? target.hull / target.maxHull : 0;

    return {
      weaponReady: this.cooldownRemaining <= 0,
      cooldown01: this.opts.fireCooldown > 0 ? this.cooldownRemaining / this.opts.fireCooldown : 0,
      cooldownMs: this.cooldownRemaining * 1000,
      projectiles: this.projectiles.length,
      enemiesAlive: this.countLivingEnemies(),
      targetShield01,
      targetHull01,
      hitConfirm: this.hitConfirmRemaining,
      playerShield01: this.playerShield / this.playerMaxShield,
      playerHull01: this.playerHull / this.playerMaxHull,
      incomingHit: this.incomingHitRemaining,
    };
  }

  getEnemyTrackingTargets(): EnemyTrackTarget[] {
    const out: EnemyTrackTarget[] = [];
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const p = enemy.mesh.transform.position;
      out.push({ x: p.x, y: p.y, z: p.z });
    }
    return out;
  }

  private firePrimary(): void {
    const shipUp = this.shipBody.rotation.rotateVector(Vector3.up()).normalizeSelf();
    const muzzlePosition = this.aimOrigin
      .add(this.aimDirection.scale(1.1))
      .add(shipUp.scale(-0.08));

    const farAimPoint = this.aimOrigin.add(this.aimDirection.scale(2000));
    const shotDirection = farAimPoint.subtract(muzzlePosition).normalizeSelf();
    const velocity = this.shipBody.linearVelocity.add(shotDirection.scale(this.opts.projectileSpeed));

    const mat = new Material(this.getSharedShader(), {
      color: [1.0, 0.85, 0.25, 1.0],
      specular: 0.2,
      shininess: 4,
      cullFace: false,
    });

    const mesh = new Mesh(this.projectileGeo, mat, `proj-${performance.now().toFixed(0)}`);
    mesh.transform.setPosition(muzzlePosition.x, muzzlePosition.y, muzzlePosition.z);
    this.scene.add(mesh);

    this.projectiles.push({
      mesh,
      position: muzzlePosition.clone(),
      velocity,
      life: this.opts.projectileLifetime,
      radius: 0.09,
      fromEnemy: false,
      damage: this.opts.hullDamage,
    });
  }

  private fireEnemy(enemy: EnemyShip): void {
    const enemyPos = enemy.mesh.transform.position;
    const toPlayer = this.shipBody.position.subtract(enemyPos);
    if (toPlayer.lengthSquared() < 1e-6) return;

    const dir = toPlayer.normalizeSelf();
    const muzzlePosition = enemyPos.add(dir.scale(1.0));
    const velocity = dir.scale(this.opts.enemyProjectileSpeed);

    const mat = new Material(this.getSharedShader(), {
      color: [1.0, 0.35, 0.25, 1.0],
      specular: 0.1,
      shininess: 2,
      cullFace: false,
    });

    const mesh = new Mesh(this.projectileGeo, mat, `enemy-proj-${performance.now().toFixed(0)}`);
    mesh.transform.setPosition(muzzlePosition.x, muzzlePosition.y, muzzlePosition.z);
    this.scene.add(mesh);

    this.projectiles.push({
      mesh,
      position: muzzlePosition.clone(),
      velocity,
      life: this.opts.projectileLifetime * 1.3,
      radius: 0.1,
      fromEnemy: true,
      damage: this.opts.enemyProjectileDamage,
    });
  }

  private updateProjectiles(dt: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      const start = p.position.clone();
      const step = p.velocity.scale(dt);
      const end = start.add(step);

      p.life -= dt;
      p.position.copy(end);
      p.mesh.transform.setPosition(end.x, end.y, end.z);

      let hit = false;
      if (p.fromEnemy) {
        const playerPos = this.shipBody.position;
        const minX = playerPos.x - this.playerHalfExtents.x - p.radius;
        const minY = playerPos.y - this.playerHalfExtents.y - p.radius;
        const minZ = playerPos.z - this.playerHalfExtents.z - p.radius;
        const maxX = playerPos.x + this.playerHalfExtents.x + p.radius;
        const maxY = playerPos.y + this.playerHalfExtents.y + p.radius;
        const maxZ = playerPos.z + this.playerHalfExtents.z + p.radius;
        if (segmentIntersectsAABB(start, end, minX, minY, minZ, maxX, maxY, maxZ)) {
          this.applyPlayerDamage(p.damage);
          hit = true;
        }
      } else {
        for (const enemy of this.enemies) {
          if (!enemy.alive) continue;
          const enemyPos = enemy.mesh.transform.position;
          const minX = enemyPos.x - enemy.halfExtents.x - p.radius;
          const minY = enemyPos.y - enemy.halfExtents.y - p.radius;
          const minZ = enemyPos.z - enemy.halfExtents.z - p.radius;
          const maxX = enemyPos.x + enemy.halfExtents.x + p.radius;
          const maxY = enemyPos.y + enemy.halfExtents.y + p.radius;
          const maxZ = enemyPos.z + enemy.halfExtents.z + p.radius;
          if (segmentIntersectsAABB(start, end, minX, minY, minZ, maxX, maxY, maxZ)) {
            this.applyDamage(enemy);
            hit = true;
            break;
          }
        }
      }

      if (hit || p.life <= 0) {
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }
  }

  private applyPlayerDamage(damage: number): void {
    let remaining = damage;
    if (this.playerShield > 0) {
      const absorbed = Math.min(this.playerShield, remaining);
      this.playerShield -= absorbed;
      remaining -= absorbed;
    }

    if (remaining > 0) {
      this.playerHull = Math.max(0, this.playerHull - remaining);
    }

    this.incomingHitRemaining = 0.16;
  }

  private applyDamage(enemy: EnemyShip): void {
    let shieldDamage = this.opts.shieldDamage;
    if (enemy.shield > 0) {
      const absorbed = Math.min(enemy.shield, shieldDamage);
      enemy.shield -= absorbed;
      shieldDamage -= absorbed;
    }

    const hullDamage = this.opts.hullDamage + shieldDamage * 0.6;
    enemy.hull -= hullDamage;
    enemy.hitFlash = 0.18;
    this.hitConfirmRemaining = 0.12;

    if (enemy.hull <= 0) {
      enemy.hull = 0;
      enemy.alive = false;
      this.scene.remove(enemy.mesh);
    }
  }

  private updateEnemies(dt: number): void {
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);

      const enemyPos = enemy.mesh.transform.position;
      const toShip = this.shipBody.position.subtract(enemyPos);
      const dist = Math.max(1e-6, toShip.length());
      const toShipDir = toShip.scale(1 / dist);

      let tangent = new Vector3(-toShipDir.z, 0, toShipDir.x);
      if (tangent.lengthSquared() < 1e-6) {
        tangent = new Vector3(1, 0, 0);
      } else {
        tangent.normalizeSelf();
      }

      enemy.orbitPhase += dt * (0.8 + enemy.orbitRadius * 0.01);
      const radialError = dist - enemy.orbitRadius;
      const radialSpeed = Math.max(-9, Math.min(9, radialError * 0.9));
      const verticalSpeed = Math.sin(enemy.orbitPhase) * 0.9;
      const desiredVelocity = tangent.scale(8.5)
        .add(toShipDir.scale(radialSpeed))
        .add(new Vector3(0, verticalSpeed, 0));

      enemyPos.addSelf(desiredVelocity.scale(dt));
      enemy.mesh.transform.markDirty();

      enemy.attackCooldown -= dt;
      if (enemy.attackCooldown <= 0 && dist < 68) {
        this.fireEnemy(enemy);
        enemy.attackCooldown = this.opts.enemyFireCooldown + Math.random() * 0.45;
      }

      const shield01 = enemy.shield / enemy.maxShield;
      const hull01 = enemy.hull / enemy.maxHull;
      const baseR = 0.2 + (1 - hull01) * 0.6;
      const baseG = 0.35 + shield01 * 0.45;
      const baseB = 0.95 * shield01;
      const flash = enemy.hitFlash > 0 ? 0.7 : 0;

      enemy.material.color = [
        Math.min(1, baseR + flash),
        Math.min(1, baseG + flash * 0.4),
        Math.min(1, baseB + flash * 0.2),
        1.0,
      ];
    }
  }

  private seedEnemies(shader: ShaderProgram): void {
    const positions: Array<[number, number, number]> = [
      [0, 2.3, -40],
      [-7, 3.0, -55],
      [8, 1.6, -63],
      [-2, 4.4, -78],
      [5, 2.2, -92],
    ];

    for (let i = 0; i < positions.length; i++) {
      const p = positions[i];
      const material = new Material(shader, {
        color: [0.2, 0.7, 0.9, 1.0],
        specular: 0.75,
        shininess: 48,
      });
      const mesh = new Mesh(this.enemyGeo, material, `enemy-${i}`);
      mesh.transform.setPosition(p[0], p[1], p[2]);
      this.scene.add(mesh);

      this.enemies.push({
        mesh,
        material,
        halfExtents: new Vector3(0.7, 0.25, 0.9),
        maxShield: 100,
        shield: 100,
        maxHull: 80,
        hull: 80,
        hitFlash: 0,
        alive: true,
        orbitPhase: Math.random() * Math.PI * 2,
        orbitRadius: 24 + i * 3.5,
        attackCooldown: this.opts.enemyFireCooldown * (0.6 + Math.random() * 0.8),
      });
    }
  }

  private countLivingEnemies(): number {
    let count = 0;
    for (const enemy of this.enemies) {
      if (enemy.alive) count++;
    }
    return count;
  }

  private findNearestLivingEnemy(): EnemyShip | null {
    let best: EnemyShip | null = null;
    let bestDistSq = Number.POSITIVE_INFINITY;
    const shipPos = this.shipBody.position;

    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const e = enemy.mesh.transform.position;
      const dx = e.x - shipPos.x;
      const dy = e.y - shipPos.y;
      const dz = e.z - shipPos.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < bestDistSq) {
        bestDistSq = d2;
        best = enemy;
      }
    }

    return best;
  }

  private getSharedShader(): ShaderProgram {
    // Enemies are guaranteed to exist after seedEnemies().
    return this.enemies[0].material.shader;
  }
}

function segmentIntersectsAABB(
  start: Vector3,
  end: Vector3,
  minX: number,
  minY: number,
  minZ: number,
  maxX: number,
  maxY: number,
  maxZ: number,
): boolean {
  const sx = start.x;
  const sy = start.y;
  const sz = start.z;
  const dx = end.x - sx;
  const dy = end.y - sy;
  const dz = end.z - sz;

  let tMin = 0;
  let tMax = 1;

  if (!slabIntersect(sx, dx, minX, maxX, tMin, tMax)) return false;
  ({ tMin, tMax } = slabState(sx, dx, minX, maxX, tMin, tMax));
  if (!slabIntersect(sy, dy, minY, maxY, tMin, tMax)) return false;
  ({ tMin, tMax } = slabState(sy, dy, minY, maxY, tMin, tMax));
  if (!slabIntersect(sz, dz, minZ, maxZ, tMin, tMax)) return false;

  return true;
}

function slabIntersect(origin: number, delta: number, min: number, max: number, tMin: number, tMax: number): boolean {
  if (Math.abs(delta) < 1e-8) {
    return origin >= min && origin <= max;
  }

  const invD = 1 / delta;
  let t0 = (min - origin) * invD;
  let t1 = (max - origin) * invD;
  if (t0 > t1) {
    const tmp = t0;
    t0 = t1;
    t1 = tmp;
  }

  const nextMin = Math.max(tMin, t0);
  const nextMax = Math.min(tMax, t1);
  return nextMax >= nextMin;
}

function slabState(origin: number, delta: number, min: number, max: number, tMin: number, tMax: number): { tMin: number; tMax: number } {
  if (Math.abs(delta) < 1e-8) {
    return { tMin, tMax };
  }

  const invD = 1 / delta;
  let t0 = (min - origin) * invD;
  let t1 = (max - origin) * invD;
  if (t0 > t1) {
    const tmp = t0;
    t0 = t1;
    t1 = tmp;
  }

  return {
    tMin: Math.max(tMin, t0),
    tMax: Math.min(tMax, t1),
  };
}
