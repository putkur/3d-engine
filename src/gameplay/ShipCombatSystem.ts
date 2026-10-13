import { InputManager } from '../input/InputManager';
import { ShaderProgram } from '../renderer/ShaderProgram';
import { Quaternion } from '../math/Quaternion';
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
  weaponMode: string;
  weaponHeat01: number;
  weaponEnergy01: number;
  weaponOverheated: boolean;
  cooldown01: number;
  cooldownMs: number;
  projectiles: number;
  enemiesAlive: number;
  targetLocked: boolean;
  targetName: string;
  targetDistance: number;
  targetShield01: number;
  targetHull01: number;
  hitConfirm: number;
  playerShield01: number;
  playerHull01: number;
  incomingHit: number;
}

export interface TargetingSolution {
  target: EnemyTrackTarget;
  lead: EnemyTrackTarget;
  locked: boolean;
}

type WeaponMode = 'pulse' | 'plasma';

interface WeaponProfile {
  label: string;
  cooldown: number;
  projectileSpeed: number;
  projectileLifetime: number;
  radius: number;
  shieldDamage: number;
  hullDamage: number;
  energyCost: number;
  heatPerShot: number;
  color: [number, number, number, number];
}

export interface EnemyTrackTarget {
  x: number;
  y: number;
  z: number;
}

interface EnemyShip {
  id: number;
  name: string;
  mesh: Mesh;
  material: Material;
  noseMaterial: Material;
  halfExtents: Vector3;
  maxShield: number;
  shield: number;
  maxHull: number;
  hull: number;
  hitFlash: number;
  alive: boolean;
  velocity: Vector3;
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
  shieldDamage: number;
  hullDamage: number;
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

const WEAPON_PROFILES: Record<WeaponMode, WeaponProfile> = {
  pulse: {
    label: 'PULSE',
    cooldown: 0.11,
    projectileSpeed: 220,
    projectileLifetime: 2.3,
    radius: 0.09,
    shieldDamage: 30,
    hullDamage: 14,
    energyCost: 0.075,
    heatPerShot: 0.08,
    color: [1.0, 0.85, 0.25, 1.0],
  },
  plasma: {
    label: 'PLASMA',
    cooldown: 0.42,
    projectileSpeed: 125,
    projectileLifetime: 2.8,
    radius: 0.16,
    shieldDamage: 58,
    hullDamage: 34,
    energyCost: 0.24,
    heatPerShot: 0.24,
    color: [0.42, 0.95, 1.0, 1.0],
  },
};

export class ShipCombatSystem {
  private readonly input: InputManager;
  private readonly scene: Scene;
  private readonly shipBody: RigidBody;
  private readonly opts: Required<ShipCombatOptions>;

  private readonly projectileGeo: Geometry;
  private readonly enemyGeo: Geometry;
  private readonly enemyNoseGeo: Geometry;
  private readonly enemyFinGeo: Geometry;

  private readonly projectiles: Projectile[] = [];
  private readonly enemies: EnemyShip[] = [];

  private cooldownRemaining = 0;
  private hitConfirmRemaining = 0;
  private incomingHitRemaining = 0;
  private weaponMode: WeaponMode = 'pulse';
  private weaponHeat = 0;
  private weaponEnergy = 1;
  private weaponOverheated = false;
  private targetLockEnabled = false;
  private lockedTargetId: number | null = null;

  private readonly playerHalfExtents = new Vector3(0.6, 0.2, 1.2);
  private readonly playerMaxShield = 160;
  private readonly playerMaxHull = 140;
  private playerShield = this.playerMaxShield;
  private playerHull = this.playerMaxHull;

  private aimOrigin: Vector3;
  private aimDirection: Vector3;
  private muzzleVelocity: Vector3;
  private lastMuzzlePosition: Vector3 | null = null;
  private readonly targetAimPrevRel = new Map<number, Vector3>();
  private readonly targetAimRelVel = new Map<number, Vector3>();
  private readonly targetLeadRelSmoothed = new Map<number, Vector3>();

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
    this.enemyNoseGeo = Geometry.createBox(0.22, 0.14, 0.52);
    this.enemyFinGeo = Geometry.createBox(0.08, 0.12, 0.5);

    this.aimOrigin = shipBody.position.clone();
    this.aimDirection = shipBody.rotation.rotateVector(Vector3.forward()).normalizeSelf();
    this.muzzleVelocity = shipBody.linearVelocity.clone();

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

    if (this.input.keyboard.wasPressed('Digit1')) {
      this.weaponMode = 'pulse';
    }
    if (this.input.keyboard.wasPressed('Digit2')) {
      this.weaponMode = 'plasma';
    }
    if (this.input.keyboard.wasPressed('KeyL')) {
      this.targetLockEnabled = !this.targetLockEnabled;
      if (this.targetLockEnabled && this.lockedTargetId === null) {
        const nearest = this.findNearestLivingEnemy();
        this.lockedTargetId = nearest ? nearest.id : null;
      }
    }
    if (this.input.keyboard.wasPressed('KeyC')) {
      this.cycleTarget(1);
    }

    if (this.targetLockEnabled) {
      this.ensureValidLock();
    }

    this.sampleMuzzleVelocity(dt);

    this.weaponEnergy = Math.min(1, this.weaponEnergy + dt * 0.26);
    this.weaponHeat = Math.max(0, this.weaponHeat - dt * 0.34);
    if (this.weaponOverheated && this.weaponHeat <= 0.33) {
      this.weaponOverheated = false;
    }

    // Move and resolve existing rounds first so newly spawned rounds do not
    // jump forward and register hits in the same frame they are fired.
    this.updateProjectiles(dt);

    const profile = this.getWeaponProfile();
    const fireHeld = this.input.mouse.isDown(0) || this.input.keyboard.isDown('Space');
    if (fireHeld && this.cooldownRemaining <= 0 && this.canFire(profile)) {
      this.firePrimary(profile);
      this.cooldownRemaining = profile.cooldown;
      this.weaponEnergy = Math.max(0, this.weaponEnergy - profile.energyCost);
      this.weaponHeat = Math.min(1.2, this.weaponHeat + profile.heatPerShot);
      if (this.weaponHeat >= 1) {
        this.weaponOverheated = true;
      }
    }

    this.updateEnemies(dt);
    this.updateTargetAimFrameMotion(dt);
  }

  getHudState(): CombatHudState {
    const target = this.getActiveTarget();
    const targetShield01 = target ? target.shield / target.maxShield : 0;
    const targetHull01 = target ? target.hull / target.maxHull : 0;
    const targetDistance = target ? target.mesh.transform.position.distance(this.shipBody.position) : 0;
    const profile = this.getWeaponProfile();

    return {
      weaponReady: this.cooldownRemaining <= 0 && this.canFire(profile),
      weaponMode: profile.label,
      weaponHeat01: Math.max(0, Math.min(1, this.weaponHeat)),
      weaponEnergy01: this.weaponEnergy,
      weaponOverheated: this.weaponOverheated,
      cooldown01: profile.cooldown > 0 ? this.cooldownRemaining / profile.cooldown : 0,
      cooldownMs: this.cooldownRemaining * 1000,
      projectiles: this.projectiles.length,
      enemiesAlive: this.countLivingEnemies(),
      targetLocked: this.targetLockEnabled && target !== null,
      targetName: target ? target.name : 'NONE',
      targetDistance,
      targetShield01,
      targetHull01,
      hitConfirm: this.hitConfirmRemaining,
      playerShield01: this.playerShield / this.playerMaxShield,
      playerHull01: this.playerHull / this.playerMaxHull,
      incomingHit: this.incomingHitRemaining,
    };
  }

  getTargetingSolution(): TargetingSolution | null {
    const target = this.getActiveTarget();
    if (!target) return null;

    const profile = this.getWeaponProfile();
    const muzzlePosition = this.getMuzzlePosition();
    const basis = this.getAimBasis();
    const toTarget = target.mesh.transform.position.subtract(muzzlePosition);
    const relPosAim = new Vector3(
      toTarget.dot(basis.right),
      toTarget.dot(basis.up),
      toTarget.dot(basis.forward),
    );
    const relVelAim = this.targetAimRelVel.get(target.id)?.clone() ?? Vector3.zero();
    const leadRelAimRaw = solveRelativeIntercept(relPosAim, relVelAim, profile.projectileSpeed);
    const leadRelAim = this.getSmoothedLeadRel(target.id, leadRelAimRaw);
    const leadPoint = muzzlePosition
      .add(basis.right.scale(leadRelAim.x))
      .add(basis.up.scale(leadRelAim.y))
      .add(basis.forward.scale(leadRelAim.z));

    return {
      target: {
        x: target.mesh.transform.position.x,
        y: target.mesh.transform.position.y,
        z: target.mesh.transform.position.z,
      },
      lead: {
        x: leadPoint.x,
        y: leadPoint.y,
        z: leadPoint.z,
      },
      locked: this.targetLockEnabled,
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

  private firePrimary(profile: WeaponProfile): void {
    const shipUp = this.shipBody.rotation.rotateVector(Vector3.up()).normalizeSelf();
    const muzzlePosition = this.aimOrigin
      .add(this.aimDirection.scale(1.1))
      .add(shipUp.scale(-0.08));

    // No auto-aim: projectile always follows player crosshair direction.
    const farAimPoint = this.aimOrigin.add(this.aimDirection.scale(2000));
    const shotDirection = farAimPoint.subtract(muzzlePosition).normalizeSelf();
    const velocity = this.muzzleVelocity.add(shotDirection.scale(profile.projectileSpeed));

    const mat = new Material(this.getSharedShader(), {
      color: profile.color,
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
      life: profile.projectileLifetime,
      radius: profile.radius,
      fromEnemy: false,
      shieldDamage: profile.shieldDamage,
      hullDamage: profile.hullDamage,
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
      shieldDamage: 0,
      hullDamage: this.opts.enemyProjectileDamage,
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
          this.applyPlayerDamage(p.hullDamage);
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
            this.applyDamage(enemy, p);
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

  private applyDamage(enemy: EnemyShip, projectile: Projectile): void {
    let shieldDamage = projectile.shieldDamage;
    if (enemy.shield > 0) {
      const absorbed = Math.min(enemy.shield, shieldDamage);
      enemy.shield -= absorbed;
      shieldDamage -= absorbed;
    }

    const hullDamage = projectile.hullDamage + shieldDamage * 0.6;
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
      const prevPos = enemyPos.clone();
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
      enemy.velocity = dt > 1e-6 ? enemyPos.subtract(prevPos).scale(1 / dt) : Vector3.zero();

      // Steer the enemy nose toward the player with smooth turning.
      const desiredRotation = Quaternion.lookRotation(toShipDir);
      const currentRotation = enemy.mesh.transform.rotation;
      enemy.mesh.transform.rotation = currentRotation.slerp(desiredRotation, Math.min(1, dt * 2.4));
      enemy.mesh.transform.markDirty();

      const facingForward = enemy.mesh.transform.rotation.rotateVector(Vector3.forward()).normalizeSelf();
      const facingDot = facingForward.dot(toShipDir);

      enemy.attackCooldown -= dt;
      if (enemy.attackCooldown <= 0 && dist < 68 && facingDot > 0.92) {
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

      enemy.noseMaterial.color = [
        1.0,
        Math.min(1.0, 0.24 + flash * 0.8),
        Math.min(1.0, 0.2 + flash * 0.6),
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

      const noseMaterial = new Material(shader, {
        color: [1.0, 0.24, 0.2, 1.0],
        specular: 0.04,
        shininess: 2,
        cullFace: false,
      });
      const noseMesh = new Mesh(this.enemyNoseGeo, noseMaterial, `enemy-${i}-nose`);
      noseMesh.transform.setPosition(0, 0, -1.05);
      mesh.add(noseMesh);

      const finL = new Mesh(this.enemyFinGeo, noseMaterial, `enemy-${i}-finL`);
      finL.transform.setPosition(-0.34, 0, -0.84);
      finL.transform.setRotationFromEuler(0, 8, 0);
      mesh.add(finL);

      const finR = new Mesh(this.enemyFinGeo, noseMaterial, `enemy-${i}-finR`);
      finR.transform.setPosition(0.34, 0, -0.84);
      finR.transform.setRotationFromEuler(0, -8, 0);
      mesh.add(finR);

      this.scene.add(mesh);

      this.enemies.push({
        id: i,
        name: `BANDIT-${i + 1}`,
        mesh,
        material,
        noseMaterial,
        halfExtents: new Vector3(0.7, 0.25, 0.9),
        maxShield: 100,
        shield: 100,
        maxHull: 80,
        hull: 80,
        hitFlash: 0,
        alive: true,
        velocity: Vector3.zero(),
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

  private getWeaponProfile(): WeaponProfile {
    return WEAPON_PROFILES[this.weaponMode];
  }

  private canFire(profile: WeaponProfile): boolean {
    return !this.weaponOverheated && this.weaponEnergy >= profile.energyCost;
  }

  private getLivingEnemies(): EnemyShip[] {
    return this.enemies.filter((enemy) => enemy.alive);
  }

  private getEnemyById(id: number): EnemyShip | null {
    for (const enemy of this.enemies) {
      if (enemy.id === id) return enemy;
    }
    return null;
  }

  private ensureValidLock(): void {
    if (this.lockedTargetId === null) {
      const nearest = this.findNearestLivingEnemy();
      this.lockedTargetId = nearest ? nearest.id : null;
      return;
    }

    const current = this.getEnemyById(this.lockedTargetId);
    if (!current || !current.alive) {
      const nearest = this.findNearestLivingEnemy();
      this.lockedTargetId = nearest ? nearest.id : null;
    }
  }

  private cycleTarget(step: 1 | -1): void {
    const living = this.getLivingEnemies();
    if (living.length === 0) {
      this.lockedTargetId = null;
      return;
    }

    this.targetLockEnabled = true;

    if (this.lockedTargetId === null) {
      this.lockedTargetId = living[0].id;
      return;
    }

    const currentIndex = living.findIndex((e) => e.id === this.lockedTargetId);
    const base = currentIndex >= 0 ? currentIndex : 0;
    const next = (base + step + living.length) % living.length;
    this.lockedTargetId = living[next].id;
  }

  private getActiveTarget(): EnemyShip | null {
    if (this.targetLockEnabled) {
      this.ensureValidLock();
      if (this.lockedTargetId !== null) {
        const locked = this.getEnemyById(this.lockedTargetId);
        if (locked && locked.alive) {
          return locked;
        }
      }
    }

    return this.findNearestLivingEnemy();
  }

  private getMuzzlePosition(): Vector3 {
    const shipUp = this.shipBody.rotation.rotateVector(Vector3.up()).normalizeSelf();
    return this.aimOrigin
      .add(this.aimDirection.scale(1.1))
      .add(shipUp.scale(-0.08));
  }

  private getAimBasis(): { right: Vector3; up: Vector3; forward: Vector3 } {
    const forward = this.aimDirection.clone().normalizeSelf();
    const shipUp = this.shipBody.rotation.rotateVector(Vector3.up()).normalizeSelf();
    const right = forward.cross(shipUp).normalizeSelf();
    const up = right.cross(forward).normalizeSelf();
    return { right, up, forward };
  }

  private sampleMuzzleVelocity(dt: number): void {
    const muzzlePosition = this.getMuzzlePosition();

    if (!this.lastMuzzlePosition || dt <= 1e-6) {
      this.muzzleVelocity.copy(this.shipBody.linearVelocity);
      this.lastMuzzlePosition = muzzlePosition;
      return;
    }

    this.muzzleVelocity = muzzlePosition.subtract(this.lastMuzzlePosition).scale(1 / dt);
    this.lastMuzzlePosition = muzzlePosition;
  }

  private updateTargetAimFrameMotion(dt: number): void {
    if (dt <= 1e-6) return;

    const muzzlePosition = this.getMuzzlePosition();
    const basis = this.getAimBasis();
    const aliveIds = new Set<number>();

    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      aliveIds.add(enemy.id);

      const toTarget = enemy.mesh.transform.position.subtract(muzzlePosition);
      const relPosAim = new Vector3(
        toTarget.dot(basis.right),
        toTarget.dot(basis.up),
        toTarget.dot(basis.forward),
      );

      const prev = this.targetAimPrevRel.get(enemy.id);
      if (prev) {
        const rawVel = relPosAim.subtract(prev).scale(1 / dt);
        const clampedRawVel = clampVectorMagnitude(rawVel, 900);
        const prevVel = this.targetAimRelVel.get(enemy.id);
        const smoothing = 1 - Math.exp(-Math.max(0, dt) * 8.5);
        const filtered = prevVel
          ? prevVel.lerp(clampedRawVel, smoothing)
          : clampedRawVel;
        this.targetAimRelVel.set(enemy.id, filtered);
      } else {
        this.targetAimRelVel.set(enemy.id, Vector3.zero());
      }
      this.targetAimPrevRel.set(enemy.id, relPosAim);
    }

    for (const id of Array.from(this.targetAimPrevRel.keys())) {
      if (!aliveIds.has(id)) {
        this.targetAimPrevRel.delete(id);
        this.targetAimRelVel.delete(id);
        this.targetLeadRelSmoothed.delete(id);
      }
    }
  }

  private getSmoothedLeadRel(targetId: number, rawLeadRel: Vector3): Vector3 {
    const clampedRawLead = clampVectorMagnitude(rawLeadRel, 2200);
    const prev = this.targetLeadRelSmoothed.get(targetId);
    const smoothing = 0.1;
    const smoothed = prev
      ? prev.lerp(clampedRawLead, smoothing)
      : clampedRawLead;
    this.targetLeadRelSmoothed.set(targetId, smoothed);
    return smoothed;
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

function solveRelativeIntercept(
  relPos: Vector3,
  relVel: Vector3,
  projectileSpeed: number,
): Vector3 {
  const a = relVel.dot(relVel) - projectileSpeed * projectileSpeed;
  const b = 2 * relPos.dot(relVel);
  const c = relPos.dot(relPos);

  let t = Number.NaN;
  if (Math.abs(a) < 1e-6) {
    if (Math.abs(b) > 1e-6) {
      t = -c / b;
    }
  } else {
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const sqrtDisc = Math.sqrt(disc);
      const t0 = (-b - sqrtDisc) / (2 * a);
      const t1 = (-b + sqrtDisc) / (2 * a);
      t = pickSmallestPositive(t0, t1);
    }
  }

  if (!Number.isFinite(t) || t < 0) {
    const fallbackT = computeFallbackInterceptTime(relPos, relVel, projectileSpeed);
    return relPos.add(relVel.scale(fallbackT));
  }

  return relPos.add(relVel.scale(t));
}

function computeFallbackInterceptTime(relPos: Vector3, relVel: Vector3, projectileSpeed: number): number {
  const speed = Math.max(1e-3, projectileSpeed);
  let t = Math.max(0, relPos.length() / speed);
  const p1 = relPos.add(relVel.scale(t));
  t = Math.max(0, p1.length() / speed);
  return Math.min(6, t);
}

function pickSmallestPositive(a: number, b: number): number {
  const aOk = Number.isFinite(a) && a >= 0;
  const bOk = Number.isFinite(b) && b >= 0;
  if (aOk && bOk) return Math.min(a, b);
  if (aOk) return a;
  if (bOk) return b;
  return Number.NaN;
}

function clampVectorMagnitude(v: Vector3, maxMagnitude: number): Vector3 {
  const len = v.length();
  if (len <= maxMagnitude || len < 1e-6) {
    return v;
  }
  return v.scale(maxMagnitude / len);
}
