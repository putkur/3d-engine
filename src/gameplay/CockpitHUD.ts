import { clamp } from '../math/MathUtils';
import type { ShipHudState } from './ShipFlightController';

export interface CockpitCombatHudState {
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

export interface OffscreenEnemyIndicator {
  nx: number;
  ny: number;
  behind: boolean;
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
    const cx = w * 0.5;
    const cy = h * 0.5;

    this.drawReticle(ctx, cx, cy, state);
    this.drawThrottleTape(ctx, w * 0.11, h * 0.2, h * 0.6, state.throttle, state.throttleTarget);
    this.drawSpeedTape(ctx, w * 0.89, h * 0.2, h * 0.6, state.speed);
    this.drawModeBadges(ctx, w, h, state);
    if (combat) {
      this.drawCombat(ctx, w, h, combat);
    }
    if (indicators && indicators.length > 0) {
      this.drawEnemyIndicators(ctx, w, h, indicators);
    }

    ctx.restore();
  }

  dispose(): void {
    if (this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  }

  private drawReticle(ctx: CanvasRenderingContext2D, cx: number, cy: number, state: ShipHudState): void {
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

    // Horizon cue based on roll and pitch.
    const rollRad = state.rollDeg * (Math.PI / 180);
    const pitchOffset = clamp(state.pitchDeg, -30, 30) * 2.2;
    const hx = cx;
    const hy = cy + pitchOffset;
    const half = 90;

    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(-rollRad);
    ctx.strokeStyle = 'rgba(105, 255, 225, 0.6)';
    ctx.lineWidth = 1.5;
    this.line(ctx, -half, 0, -26, 0);
    this.line(ctx, 26, 0, half, 0);
    this.line(ctx, 0, -8, 0, 8);
    ctx.restore();
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

    ctx.font = '18px monospace';
    ctx.fillText(`${Math.round(speed).toString().padStart(3, '0')}`, x, y + height * 0.5 + 6);

    ctx.font = '11px monospace';
    ctx.fillStyle = 'rgba(160, 245, 225, 0.85)';
    ctx.fillText('m/s', x, y + height * 0.5 + 24);
  }

  private drawModeBadges(ctx: CanvasRenderingContext2D, w: number, h: number, state: ShipHudState): void {
    const left = w * 0.5 - 180;
    const top = h * 0.12;

    this.badge(ctx, left, top, 100, 28, `FA ${state.flightAssist ? 'ON' : 'OFF'}`, state.flightAssist);
    this.badge(ctx, left + 120, top, 110, 28, `BOOST ${state.boostActive ? 'ON' : 'OFF'}`, state.boostActive);

    ctx.fillStyle = 'rgba(140, 250, 220, 0.95)';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(
      `P ${state.pitchRate.toFixed(0)}  Y ${state.yawRate.toFixed(0)}  R ${state.rollRate.toFixed(0)} deg/s`,
      w * 0.5,
      top + 46,
    );
  }

  private drawCombat(ctx: CanvasRenderingContext2D, w: number, h: number, combat: CockpitCombatHudState): void {
    const panelW = 250;
    const panelH = 98;
    const x = w * 0.5 - panelW * 0.5;
    const y = h * 0.81;

    this.panel(ctx, x, y, panelW, panelH);

    const weaponText = combat.weaponReady ? 'PRIMARY READY' : `PRIMARY CD ${Math.ceil(combat.cooldownMs)}ms`;
    ctx.fillStyle = combat.weaponReady ? 'rgba(165, 255, 190, 0.95)' : 'rgba(255, 215, 130, 0.95)';
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

    const targetShield = Math.round(clamp(combat.targetShield01, 0, 1) * 100);
    const targetHull = Math.round(clamp(combat.targetHull01, 0, 1) * 100);
    ctx.fillStyle = 'rgba(170, 240, 255, 0.9)';
    ctx.fillText(`TARGET SHD ${targetShield}%  HULL ${targetHull}%`, x + 10, y + 51);

    const playerShield = Math.round(clamp(combat.playerShield01, 0, 1) * 100);
    const playerHull = Math.round(clamp(combat.playerHull01, 0, 1) * 100);
    ctx.fillStyle = 'rgba(255, 210, 170, 0.9)';
    ctx.fillText(`PLAYER SHD ${playerShield}%  HULL ${playerHull}%`, x + 10, y + 67);

    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(205, 255, 245, 0.9)';
    ctx.fillText(`ENM ${combat.enemiesAlive}  RND ${combat.projectiles}`, x + panelW - 10, y + 18);

    if (combat.incomingHit > 0) {
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255, 120, 120, 0.95)';
      ctx.font = 'bold 12px monospace';
      ctx.fillText('INCOMING HIT', x + panelW * 0.5, y + 85);
    }

    if (combat.hitConfirm > 0) {
      ctx.strokeStyle = 'rgba(255, 240, 120, 0.95)';
      ctx.lineWidth = 2;
      const cx = w * 0.5;
      const cy = h * 0.5;
      this.line(ctx, cx - 10, cy - 10, cx - 2, cy - 2);
      this.line(ctx, cx + 10, cy - 10, cx + 2, cy - 2);
      this.line(ctx, cx - 10, cy + 10, cx - 2, cy + 2);
      this.line(ctx, cx + 10, cy + 10, cx + 2, cy + 2);
    }
  }

  private drawEnemyIndicators(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    indicators: OffscreenEnemyIndicator[],
  ): void {
    const radiusX = w * 0.44;
    const radiusY = h * 0.44;
    const cx = w * 0.5;
    const cy = h * 0.5;

    for (const ind of indicators) {
      const x = cx + clamp(ind.nx, -1, 1) * radiusX;
      const y = cy - clamp(ind.ny, -1, 1) * radiusY;

      const toCenterX = cx - x;
      const toCenterY = cy - y;
      const angle = Math.atan2(toCenterY, toCenterX);

      // Arrow points toward center (toward target direction from edge marker).
      const size = ind.behind ? 7 : 9;
      const color = ind.behind ? 'rgba(255, 170, 100, 0.88)' : 'rgba(255, 95, 95, 0.95)';
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
      ctx.fillStyle = ind.behind ? 'rgba(255, 210, 120, 0.95)' : 'rgba(255, 120, 120, 0.9)';
      ctx.arc(-size * 1.45, 0, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
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
