import { clamp } from '../math/MathUtils';
import type { ShipHudState } from './ShipFlightController';

export interface CockpitCombatHudState {
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

export interface TargetingOverlay {
  targetVisible: boolean;
  targetNx: number;
  targetNy: number;
  targetDistance: number;
  leadVisible: boolean;
  leadNx: number;
  leadNy: number;
  targetLocked: boolean;
}

export interface OffscreenEnemyIndicator {
  nx: number;
  ny: number;
  behind: boolean;
  targeted?: boolean;
}

export class CockpitHUD {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;

  constructor() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('2D canvas context is unavailable for CockpitHUD.');
    }

    this.canvas = canvas;
    this.ctx = ctx;

    this.canvas.style.position = 'fixed';
    this.canvas.style.left = '0';
    this.canvas.style.top = '0';
    this.canvas.style.width = '100vw';
    this.canvas.style.height = '100vh';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '999';

    document.body.appendChild(this.canvas);
    this.resize();
  }

  resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(window.innerWidth * dpr));
    const height = Math.max(1, Math.floor(window.innerHeight * dpr));
    this.canvas.width = width;
    this.canvas.height = height;
  }

  render(
    state: ShipHudState,
    combat?: CockpitCombatHudState,
    indicators?: OffscreenEnemyIndicator[],
    targeting?: TargetingOverlay,
  ): void {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;
    const dpr = window.devicePixelRatio || 1;

    ctx.clearRect(0, 0, width, height);

    // Work in CSS-space units for easier layout.
    ctx.save();
    ctx.scale(dpr, dpr);

    const w = width / dpr;
    const h = height / dpr;

    // Keep HUD inside a centered 16:9-safe region while allowing wider 3D render.
    const uiWidth = Math.min(w, h * (16 / 9));
    const uiLeft = (w - uiWidth) * 0.5;

    const cx = uiLeft + uiWidth * 0.5;
    const cy = h * 0.5;

    this.drawReticle(ctx, cx, cy);
    this.drawThrottleTape(ctx, uiLeft + uiWidth * 0.11, h * 0.2, h * 0.6, state.throttle, state.throttleTarget);
    this.drawSpeedTape(ctx, uiLeft + uiWidth * 0.89, h * 0.2, h * 0.6, state.speed);
    this.drawModeBadges(ctx, uiLeft, uiWidth, h, state);
    if (combat) {
      this.drawCombat(ctx, uiLeft, uiWidth, h, combat);
    }
    if (indicators && indicators.length > 0) {
      this.drawEnemyIndicators(ctx, uiLeft, uiWidth, h, indicators);
    }
    if (targeting) {
      this.drawTargetingOverlay(ctx, uiLeft, uiWidth, h, targeting);
    }

    ctx.restore();
  }

  dispose(): void {
    if (this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  }

  private drawReticle(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    ctx.strokeStyle = 'rgba(105, 255, 225, 0.95)';
    ctx.lineWidth = 2;

    // Main ring
    ctx.beginPath();
    ctx.arc(cx, cy, 20, 0, Math.PI * 2);
    ctx.stroke();

    // Cardinal brackets
    this.line(ctx, cx - 38, cy, cx - 22, cy);
    this.line(ctx, cx + 22, cy, cx + 38, cy);
    this.line(ctx, cx, cy - 38, cx, cy - 22);
    this.line(ctx, cx, cy + 22, cx, cy + 38);

    // Center aim reference dot.
    ctx.fillStyle = 'rgba(170, 255, 235, 0.98)';
    ctx.beginPath();
    ctx.arc(cx, cy, 1.9, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawThrottleTape(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    height: number,
    throttle: number,
    throttleTarget: number,
  ): void {
    const width = 24;
    this.panel(ctx, x - width * 0.5 - 16, y - 20, width + 32, height + 40);

    ctx.strokeStyle = 'rgba(105, 255, 225, 0.75)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - width * 0.5, y, width, height);

    const mapY = (value: number) => y + (1 - (value + 1) * 0.5) * height;
    const currentY = mapY(clamp(throttle, -1, 1));
    const targetY = mapY(clamp(throttleTarget, -1, 1));

    ctx.fillStyle = 'rgba(105, 255, 225, 0.35)';
    ctx.fillRect(x - width * 0.5 + 2, currentY, width - 4, y + height - currentY);

    ctx.strokeStyle = 'rgba(255, 240, 120, 0.95)';
    this.line(ctx, x - width * 0.65, targetY, x + width * 0.65, targetY);

    ctx.fillStyle = 'rgba(190, 255, 240, 0.95)';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('THR', x, y - 8);
  }

  private drawSpeedTape(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    height: number,
    speed: number,
  ): void {
    const width = 84;
    this.panel(ctx, x - width * 0.5 - 10, y - 20, width + 20, height + 40);

    ctx.strokeStyle = 'rgba(105, 255, 225, 0.75)';
    ctx.strokeRect(x - width * 0.5, y, width, height);

    ctx.fillStyle = 'rgba(190, 255, 240, 0.95)';
    ctx.font = '13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SPD', x, y - 8);

    const roundedSpeed = Math.round(speed);
    const speedAbsText = Math.abs(roundedSpeed).toString().padStart(3, '0');
    const speedText = roundedSpeed < 0 ? `-${speedAbsText}` : speedAbsText;

    ctx.font = '18px monospace';
    ctx.fillText(speedText, x, y + height * 0.5 + 6);

    ctx.font = '11px monospace';
    ctx.fillStyle = 'rgba(160, 245, 225, 0.85)';
    ctx.fillText('m/s', x, y + height * 0.5 + 24);
  }

  private drawModeBadges(ctx: CanvasRenderingContext2D, uiLeft: number, uiWidth: number, h: number, state: ShipHudState): void {
    const left = uiLeft + uiWidth * 0.5 - 180;
    const top = h * 0.12;

    this.badge(ctx, left, top, 100, 28, `FA ${state.flightAssist ? 'ON' : 'OFF'}`, state.flightAssist);
    this.badge(ctx, left + 120, top, 110, 28, `BOOST ${state.boostActive ? 'ON' : 'OFF'}`, state.boostActive);

    ctx.fillStyle = 'rgba(140, 250, 220, 0.95)';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(
      `P ${state.pitchRate.toFixed(0)}  Y ${state.yawRate.toFixed(0)}  R ${state.rollRate.toFixed(0)} deg/s`,
      uiLeft + uiWidth * 0.5,
      top + 46,
    );
  }

  private drawCombat(ctx: CanvasRenderingContext2D, uiLeft: number, uiWidth: number, h: number, combat: CockpitCombatHudState): void {
    const panelW = 250;
    const panelH = 128;
    const x = uiLeft + uiWidth * 0.5 - panelW * 0.5;
    const y = h * 0.77;

    this.panel(ctx, x, y, panelW, panelH);

    const weaponText = combat.weaponOverheated
      ? `${combat.weaponMode} OVERHEAT`
      : combat.weaponReady
        ? `${combat.weaponMode} READY`
        : `${combat.weaponMode} CD ${Math.ceil(combat.cooldownMs)}ms`;
    ctx.fillStyle = combat.weaponReady ? 'rgba(165, 255, 190, 0.95)' : 'rgba(255, 215, 130, 0.95)';
    if (combat.weaponOverheated) {
      ctx.fillStyle = 'rgba(255, 125, 95, 0.95)';
    }
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(weaponText, x + 10, y + 18);

    const barX = x + 10;
    const barY = y + 26;
    const barW = panelW - 20;
    const barH = 10;
    ctx.strokeStyle = 'rgba(120, 255, 225, 0.6)';
    ctx.strokeRect(barX, barY, barW, barH);
    ctx.fillStyle = 'rgba(120, 255, 225, 0.5)';
    ctx.fillRect(barX + 1, barY + 1, (1 - clamp(combat.cooldown01, 0, 1)) * (barW - 2), barH - 2);

    const meterW = (panelW - 34) * 0.5;
    const meterY = y + 42;
    ctx.strokeStyle = 'rgba(120, 255, 225, 0.58)';
    ctx.strokeRect(x + 10, meterY, meterW, 8);
    ctx.fillStyle = 'rgba(120, 240, 255, 0.6)';
    ctx.fillRect(x + 11, meterY + 1, (meterW - 2) * clamp(combat.weaponEnergy01, 0, 1), 6);
    ctx.fillStyle = 'rgba(170, 240, 255, 0.9)';
    ctx.font = '10px monospace';
    ctx.fillText('ENG', x + 10, meterY - 3);

    ctx.strokeStyle = 'rgba(255, 180, 120, 0.58)';
    ctx.strokeRect(x + 20 + meterW, meterY, meterW, 8);
    ctx.fillStyle = 'rgba(255, 145, 110, 0.62)';
    ctx.fillRect(x + 21 + meterW, meterY + 1, (meterW - 2) * clamp(combat.weaponHeat01, 0, 1), 6);
    ctx.fillStyle = 'rgba(255, 210, 170, 0.9)';
    ctx.fillText('HEAT', x + 20 + meterW, meterY - 3);

    const targetShield = Math.round(clamp(combat.targetShield01, 0, 1) * 100);
    const targetHull = Math.round(clamp(combat.targetHull01, 0, 1) * 100);
    ctx.fillStyle = 'rgba(170, 240, 255, 0.9)';
    ctx.font = '12px monospace';
    ctx.fillText(`TARGET SHD ${targetShield}%  HULL ${targetHull}%`, x + 10, y + 67);

    const lockTag = combat.targetLocked ? 'LOCK' : 'SCAN';
    const lockDistance = Math.round(combat.targetDistance);
    ctx.fillStyle = combat.targetLocked ? 'rgba(255, 245, 150, 0.92)' : 'rgba(170, 220, 255, 0.82)';
    ctx.fillText(`${lockTag} ${combat.targetName} ${lockDistance}m`, x + 10, y + 83);

    const playerShield = Math.round(clamp(combat.playerShield01, 0, 1) * 100);
    const playerHull = Math.round(clamp(combat.playerHull01, 0, 1) * 100);
    ctx.fillStyle = 'rgba(255, 210, 170, 0.9)';
    ctx.fillText(`PLAYER SHD ${playerShield}%  HULL ${playerHull}%`, x + 10, y + 99);

    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(205, 255, 245, 0.9)';
    ctx.fillText(`ENM ${combat.enemiesAlive}  RND ${combat.projectiles}`, x + panelW - 10, y + 18);

    if (combat.incomingHit > 0) {
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255, 120, 120, 0.95)';
      ctx.font = 'bold 12px monospace';
      ctx.fillText('INCOMING HIT', x + panelW * 0.5, y + 114);
    }

    if (combat.hitConfirm > 0) {
      ctx.strokeStyle = 'rgba(255, 240, 120, 0.95)';
      ctx.lineWidth = 2;
      const cx = uiLeft + uiWidth * 0.5;
      const cy = h * 0.5;
      this.line(ctx, cx - 10, cy - 10, cx - 2, cy - 2);
      this.line(ctx, cx + 10, cy - 10, cx + 2, cy - 2);
      this.line(ctx, cx - 10, cy + 10, cx - 2, cy + 2);
      this.line(ctx, cx + 10, cy + 10, cx + 2, cy + 2);
    }
  }

  private drawEnemyIndicators(
    ctx: CanvasRenderingContext2D,
    uiLeft: number,
    uiWidth: number,
    h: number,
    indicators: OffscreenEnemyIndicator[],
  ): void {
    const radiusX = uiWidth * 0.44;
    const radiusY = h * 0.44;
    const cx = uiLeft + uiWidth * 0.5;
    const cy = h * 0.5;

    for (const ind of indicators) {
      const x = cx + clamp(ind.nx, -1, 1) * radiusX;
      const y = cy - clamp(ind.ny, -1, 1) * radiusY;

      const toCenterX = cx - x;
      const toCenterY = cy - y;
      const angle = Math.atan2(toCenterY, toCenterX);

      // Arrow points toward center (toward target direction from edge marker).
      const size = ind.behind ? 7 : 9;
      const color = ind.targeted
        ? 'rgba(255, 235, 120, 0.96)'
        : ind.behind
          ? 'rgba(255, 170, 100, 0.88)'
          : 'rgba(255, 95, 95, 0.95)';
      ctx.fillStyle = color;
      ctx.strokeStyle = 'rgba(15, 25, 25, 0.65)';
      ctx.lineWidth = 1;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(size, 0);
      ctx.lineTo(-size * 0.75, size * 0.65);
      ctx.lineTo(-size * 0.75, -size * 0.65);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.fillStyle = ind.targeted
        ? 'rgba(255, 245, 170, 0.96)'
        : ind.behind
          ? 'rgba(255, 210, 120, 0.95)'
          : 'rgba(255, 120, 120, 0.9)';
      ctx.arc(-size * 1.45, 0, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawTargetingOverlay(
    ctx: CanvasRenderingContext2D,
    uiLeft: number,
    uiWidth: number,
    h: number,
    targeting: TargetingOverlay,
  ): void {
    const cx = uiLeft + uiWidth * 0.5;
    const cy = h * 0.5;
    const radiusX = uiWidth * 0.44;
    const radiusY = h * 0.44;

    if (targeting.targetVisible) {
      const tx = cx + clamp(targeting.targetNx, -1, 1) * radiusX;
      const ty = cy - clamp(targeting.targetNy, -1, 1) * radiusY;

      ctx.strokeStyle = targeting.targetLocked ? 'rgba(255, 240, 120, 0.92)' : 'rgba(130, 220, 255, 0.82)';
      ctx.lineWidth = targeting.targetLocked ? 2 : 1.5;
      const distance = Math.max(1, targeting.targetDistance);
      const distanceScale = clamp(115 / distance, 0.55, 2.1);
      const baseBox = targeting.targetLocked ? 17 : 12;
      const box = baseBox * distanceScale;
      ctx.strokeRect(tx - box * 0.5, ty - box * 0.5, box, box);
    }

    if (targeting.leadVisible) {
      const lx = cx + clamp(targeting.leadNx, -1, 1) * radiusX;
      const ly = cy - clamp(targeting.leadNy, -1, 1) * radiusY;

      ctx.strokeStyle = 'rgba(110, 255, 220, 0.94)';
      ctx.lineWidth = 2;
      this.line(ctx, lx - 10, ly, lx - 3, ly);
      this.line(ctx, lx + 3, ly, lx + 10, ly);
      this.line(ctx, lx, ly - 10, lx, ly - 3);
      this.line(ctx, lx, ly + 3, lx, ly + 10);
      ctx.beginPath();
      ctx.arc(lx, ly, 3, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private badge(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    text: string,
    active: boolean,
  ): void {
    ctx.fillStyle = active ? 'rgba(40, 150, 120, 0.35)' : 'rgba(65, 70, 80, 0.35)';
    ctx.strokeStyle = active ? 'rgba(110, 255, 210, 0.95)' : 'rgba(150, 160, 175, 0.85)';
    ctx.lineWidth = 1;
    ctx.fillRect(x, y, width, height);
    ctx.strokeRect(x, y, width, height);

    ctx.fillStyle = 'rgba(215, 255, 245, 0.95)';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(text, x + width * 0.5, y + 18);
  }

  private panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
    ctx.fillStyle = 'rgba(7, 20, 26, 0.28)';
    ctx.strokeStyle = 'rgba(90, 205, 180, 0.18)';
    ctx.lineWidth = 1;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
  }

  private line(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number): void {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
}
