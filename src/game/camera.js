/**
 * 2.5D Isometric/Oblique Camera System
 * Handles coordinate projection, smooth player tracking, and wide pitch registration.
 */
import { PITCH, PHYSICS } from './constants.js';

export class Camera {
  constructor(canvas) {
    this.canvas = canvas;
    this.viewportWidth = 1200;
    this.viewportHeight = 700;

    this.x = 0;
    this.y = 0;
    this.targetX = 0;
    this.targetY = 0;

    this.zoom = 0.88;
    this.targetZoom = 0.88;
    this.userZoomMultiplier = 1.0; // Can be adjusted with +/- or mouse wheel

    this.mode = 'FOLLOW'; // 'FOLLOW' (tracks player widely) or 'OVERVIEW' (full pitch)
    this.smoothing = 0.16; // Fluid, responsive tracking
  }

  setViewportSize(w, h) {
    this.viewportWidth = w;
    this.viewportHeight = h;
  }

  setMode(mode) {
    this.mode = mode;
  }

  toggleMode() {
    this.mode = this.mode === 'FOLLOW' ? 'OVERVIEW' : 'FOLLOW';
    return this.mode;
  }

  adjustZoom(delta) {
    this.userZoomMultiplier = Math.max(0.7, Math.min(1.4, this.userZoomMultiplier + delta));
  }

  update(controlledPlayer, ball, dt, secondPlayer = null) {
    const vw = this.viewportWidth;
    const vh = this.viewportHeight;

    // Calculate base fit scales
    const pitchTotalW = PITCH.WIDTH + PITCH.MARGIN_X * 2;
    const pitchTotalH = (PITCH.HEIGHT + PITCH.MARGIN_Y * 2) * PHYSICS.TILT_Y;

    const fitScaleW = vw / pitchTotalW;
    const fitScaleH = vh / pitchTotalH;
    const fullFitScale = Math.min(fitScaleW, fitScaleH);

    const minOverviewZoom = vh < 520 ? 0.34 : 0.55;
    const minFollowZoom = vh < 520 ? 0.42 : 0.65;

    if (this.mode === 'OVERVIEW') {
      // OVERVIEW: Centers pitch and frames entire stadium
      this.targetX = 0;
      this.targetY = 0;
      this.targetZoom = Math.max(minOverviewZoom, fullFitScale * 0.98);
    } else if (controlledPlayer && secondPlayer) {
      // LOCAL 2P FOLLOW MODE: Keep both human players and the ball in view
      const bX = ball ? ball.x : (controlledPlayer.x + secondPlayer.x) * 0.5;
      const bY = ball ? ball.y : (controlledPlayer.y + secondPlayer.y) * 0.5;
      const minX = Math.min(controlledPlayer.x, secondPlayer.x, bX);
      const maxX = Math.max(controlledPlayer.x, secondPlayer.x, bX);
      const minY = Math.min(controlledPlayer.y, secondPlayer.y, bY);
      const maxY = Math.max(controlledPlayer.y, secondPlayer.y, bY);

      this.targetX = (minX + maxX) * 0.32 + bX * 0.36;
      this.targetY = (minY + maxY) * 0.32 + bY * 0.36;

      const spanW = Math.max(420, (maxX - minX) + 320);
      const spanH = Math.max(300, (maxY - minY + 240) * PHYSICS.TILT_Y);
      const fit2P = Math.min(vw / spanW, vh / spanH) * this.userZoomMultiplier;
      const baseWide = Math.min(1.02, Math.max(minFollowZoom, fitScaleH * 1.05)) * this.userZoomMultiplier;
      this.targetZoom = Math.max(Math.max(minOverviewZoom, fullFitScale * 0.96), Math.min(baseWide, fit2P));
    } else {
      // FOLLOW MODE: Wide, dynamic arcade camera that always moves with the player
      if (controlledPlayer) {
        if (ball) {
          // Primarily follow controlled player (75%) with slight lead toward ball (25%)
          this.targetX = controlledPlayer.x * 0.75 + ball.x * 0.25;
          this.targetY = controlledPlayer.y * 0.75 + ball.y * 0.25;
        } else {
          this.targetX = controlledPlayer.x;
          this.targetY = controlledPlayer.y;
        }

        // Add small velocity lead in the direction player is moving
        this.targetX += (controlledPlayer.vx || 0) * 0.18;
        this.targetY += (controlledPlayer.vy || 0) * 0.18;
      } else if (ball) {
        this.targetX = ball.x;
        this.targetY = ball.y;
      }

      // Calculate wide, readable arcade zoom:
      // Wide enough so you can see plenty of pitch, teammates, and opponents without feeling claustrophobic
      const wideZoom = Math.min(1.05, Math.max(minFollowZoom, fitScaleH * 1.08)) * this.userZoomMultiplier;
      this.targetZoom = wideZoom;
    }

    if (this.mode !== 'OVERVIEW') {

      // Smart dynamic camera boundary clamping:
      // Prevents showing infinite void outside stadium while guaranteeing the player is never cut off
      const visibleHalfW = (vw * 0.5) / this.targetZoom;
      const visibleHalfH = (vh * 0.5) / (this.targetZoom * PHYSICS.TILT_Y);

      const maxAllowedX = (PITCH.WIDTH * 0.5) + PITCH.MARGIN_X * 0.6;
      const maxAllowedY = (PITCH.HEIGHT * 0.5) + PITCH.MARGIN_Y * 0.5;

      if (maxAllowedX > visibleHalfW) {
        const clampX = maxAllowedX - visibleHalfW;
        this.targetX = Math.max(-clampX, Math.min(clampX, this.targetX));
      } else {
        // Entire pitch fits horizontally
        this.targetX = 0;
      }

      if (maxAllowedY > visibleHalfH) {
        const clampY = maxAllowedY - visibleHalfH;
        this.targetY = Math.max(-clampY, Math.min(clampY, this.targetY));
      } else {
        // Entire pitch fits vertically
        this.targetY = 0;
      }
    }

    // Responsive camera interpolation
    const t = 1 - Math.pow(1 - this.smoothing, dt * 60);
    this.x += (this.targetX - this.x) * t;
    this.y += (this.targetY - this.y) * t;
    this.zoom += (this.targetZoom - this.zoom) * t;
  }

  /**
   * Projects World (wx, wy, wz) to Screen (sx, sy) in CSS logical pixels
   */
  worldToScreen(wx, wy, wz = 0) {
    const cx = this.viewportWidth / 2;
    const cy = this.viewportHeight / 2;

    const sx = cx + (wx - this.x) * this.zoom;
    const sy = cy + ((wy - this.y) * PHYSICS.TILT_Y - wz) * this.zoom;

    return { x: sx, y: sy };
  }

  /**
   * Projects Screen (sx, sy) in CSS logical pixels back to World Ground (wx, wy)
   */
  screenToWorld(sx, sy) {
    const cx = this.viewportWidth / 2;
    const cy = this.viewportHeight / 2;

    const wx = this.x + (sx - cx) / this.zoom;
    const wy = this.y + (sy - cy) / (this.zoom * PHYSICS.TILT_Y);

    return { x: wx, y: wy };
  }
}
