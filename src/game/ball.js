/**
 * Football Entity & Physics
 * Handles 3D ball coordinates (x, y, z), realistic bouncing, spin, shadows, and net collisions.
 */
import { PITCH, PHYSICS } from './constants.js';

export class Ball {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.z = 0;

    this.vx = 0;
    this.vy = 0;
    this.vz = 0;

    this.radius = PHYSICS.BALL_RADIUS;
    this.rotationAngle = 0;
    this.spinAxisX = 1;
    this.spinAxisY = 0;

    this.lastKickedBy = null;
    this.carrier = null; // Currently controlling dribbler
    this.trail = [];
  }

  reset(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;
    this.lastKickedBy = null;
    this.carrier = null;
    this.trail = [];
  }

  update(dt, onGoalScored, onGoalKick, audio) {
    // A. Close-control sticky dribbling (EAFC style)
    if (this.carrier) {
      if (this.carrier.isStumbled || this.carrier.kickCooldown > 0.05) {
        this.carrier = null;
      } else {
        const offset = PHYSICS.DRIBBLE_DIST;
        const targetX = this.carrier.x + Math.cos(this.carrier.facingAngle) * offset;
        const targetY = this.carrier.y + Math.sin(this.carrier.facingAngle) * offset;

        const lerpFactor = 1 - Math.pow(1 - PHYSICS.DRIBBLE_LERP, dt * 60);
        this.x += (targetX - this.x) * Math.min(1, lerpFactor * 2.5);
        this.y += (targetY - this.y) * Math.min(1, lerpFactor * 2.5);
        this.z = 0;
        this.vx = this.carrier.vx;
        this.vy = this.carrier.vy;
        this.vz = 0;

        const speed = Math.hypot(this.vx, this.vy);
        if (speed > 5) {
          this.rotationAngle += (speed / this.radius) * dt;
          this.spinAxisX = -this.vy / speed;
          this.spinAxisY = this.vx / speed;
        }

        this.handleBoundaries(onGoalScored, onGoalKick, audio);
        return;
      }
    }

    // B. Free ball projectile & rolling physics
    // 1. Apply gravity to vertical axis (Z)
    if (this.z > 0 || this.vz !== 0) {
      this.vz -= PHYSICS.GRAVITY * dt;
    }

    // 2. Integrate positions
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.z += this.vz * dt;

    // Hard vertical ceiling cap: ball NEVER flies into the moon
    if (this.z >= PHYSICS.BALL_MAX_Z) {
      this.z = PHYSICS.BALL_MAX_Z;
      if (this.vz > 0) {
        this.vz = -this.vz * 0.35;
      }
    }

    // 3. Ground collision and bouncing
    if (this.z <= 0) {
      this.z = 0;
      if (Math.abs(this.vz) > 20) {
        this.vz = -this.vz * PHYSICS.BALL_RESTITUTION_GROUND;
      } else {
        this.vz = 0;
      }

      // Rolling friction
      const frictionFactor = Math.pow(PHYSICS.BALL_FRICTION_GROUND, dt * 60);
      this.vx *= frictionFactor;
      this.vy *= frictionFactor;
    } else {
      // Air drag
      const dragFactor = Math.pow(PHYSICS.BALL_DRAG_AIR, dt * 60);
      this.vx *= dragFactor;
      this.vy *= dragFactor;
    }

    // 4. Ball spin / roll animation
    const speed = Math.hypot(this.vx, this.vy);
    if (speed > 1) {
      this.rotationAngle += (speed / this.radius) * dt;
      this.spinAxisX = -this.vy / speed;
      this.spinAxisY = this.vx / speed;
    }

    // Stop micro-jitters
    if (speed < 0.8 && this.z <= 0) {
      this.vx = 0;
      this.vy = 0;
    }

    // 5. Pitch boundary collisions, Crossbar, Posts, and Goal Detection
    this.handleBoundaries(onGoalScored, onGoalKick, audio);

    // 6. Ball speed trail for powerful shots
    if (speed > 350) {
      this.trail.push({ x: this.x, y: this.y, z: this.z, alpha: 0.6 });
      if (this.trail.length > 6) this.trail.shift();
    } else if (this.trail.length > 0) {
      this.trail.shift();
    }
  }

  handleBoundaries(onGoalScored, onGoalKick, audio) {
    const halfW = PITCH.WIDTH / 2;
    const halfH = PITCH.HEIGHT / 2;
    const halfGoalW = PITCH.GOAL_WIDTH / 2;
    const goalDepth = PITCH.GOAL_DEPTH;
    const goalH = PITCH.GOAL_HEIGHT;

    // A. Touchline boundaries (Top & Bottom Y)
    if (this.y < -halfH + this.radius) {
      this.y = -halfH + this.radius;
      this.vy = -this.vy * 0.6;
    } else if (this.y > halfH - this.radius) {
      this.y = halfH - this.radius;
      this.vy = -this.vy * 0.6;
    }

    // B. Check 3D Crossbar Collision (Left & Right Goals)
    this.checkCrossbarCollision(-halfW, audio);
    this.checkCrossbarCollision(halfW, audio);

    // C. Check Goal Posts (Left & Right Goals)
    this.checkPostCollision(-halfW, -halfGoalW, audio);
    this.checkPostCollision(-halfW, halfGoalW, audio);
    this.checkPostCollision(halfW, -halfGoalW, audio);
    this.checkPostCollision(halfW, halfGoalW, audio);

    // D. Goal Lines & Nets vs Out of Bounds
    const inGoalMouthY = Math.abs(this.y) <= halfGoalW - this.radius;

    // LEFT GOAL LINE (x <= -halfW)
    if (this.x < -halfW) {
      if (inGoalMouthY && this.z <= goalH) {
        // Legitimate goal entry inside the mouth!
        if (this.x < -halfW - goalDepth + this.radius) {
          this.x = -halfW - goalDepth + this.radius;
          this.vx = -this.vx * 0.25; // Cushioned by back net
          this.vy *= 0.7;
          if (onGoalScored) onGoalScored('red'); // Red scored in Blue's goal
        }
        if (Math.abs(this.y) > halfGoalW - this.radius - 2) {
          this.vy = -this.vy * 0.3; // Cushioned by side net
        }
      } else {
        // Over the crossbar or wide! Out of bounds behind goal
        if (this.x < -halfW - 35) {
          this.vx *= 0.5;
          this.vy *= 0.5;
          if (onGoalKick) onGoalKick('blue'); // Blue gets goal kick
        }
        // Keep within reasonable stadium boundary
        if (this.x < -halfW - 80) {
          this.x = -halfW - 80;
          this.vx = 0;
        }
      }
    }

    // RIGHT GOAL LINE (x >= halfW)
    if (this.x > halfW) {
      if (inGoalMouthY && this.z <= goalH) {
        // Inside right goal!
        if (this.x > halfW + goalDepth - this.radius) {
          this.x = halfW + goalDepth - this.radius;
          this.vx = -this.vx * 0.25;
          this.vy *= 0.7;
          if (onGoalScored) onGoalScored('blue'); // Blue scored in Red's goal
        }
        if (Math.abs(this.y) > halfGoalW - this.radius - 2) {
          this.vy = -this.vy * 0.3;
        }
      } else {
        // Over the crossbar or wide! Out of bounds behind goal
        if (this.x > halfW + 35) {
          this.vx *= 0.5;
          this.vy *= 0.5;
          if (onGoalKick) onGoalKick('red'); // Red gets goal kick
        }
        if (this.x > halfW + 80) {
          this.x = halfW + 80;
          this.vx = 0;
        }
      }
    }
  }

  checkCrossbarCollision(goalLineX, audio) {
    const halfGoalW = PITCH.GOAL_WIDTH / 2;
    const goalH = PITCH.GOAL_HEIGHT;
    const barR = PITCH.POST_RADIUS;

    if (Math.abs(this.y) <= halfGoalW + this.radius) {
      const dx = Math.abs(this.x - goalLineX);
      const dz = Math.abs(this.z - goalH);
      const distXZ = Math.hypot(dx, dz);
      const minDist = this.radius + barR;

      if (distXZ < minDist) {
        const dirX = Math.sign(this.x - goalLineX) || 1;
        this.x = goalLineX + dirX * minDist;
        this.vx = dirX * Math.abs(this.vx) * 0.7 + dirX * 60;
        this.vz = -Math.abs(this.vz) * 0.65;
        if (audio) audio.playPostClank();
      }
    }
  }

  checkPostCollision(postX, postY, audio) {
    const postR = PITCH.POST_RADIUS;
    const dx = this.x - postX;
    const dy = this.y - postY;
    const dist = Math.hypot(dx, dy);
    const minDist = this.radius + postR;

    if (dist < minDist && this.z <= PITCH.GOAL_HEIGHT) {
      const nx = dx / (dist || 1);
      const ny = dy / (dist || 1);
      this.x = postX + nx * minDist;
      this.y = postY + ny * minDist;

      // Elastic reflection
      const dot = this.vx * nx + this.vy * ny;
      if (dot < 0) {
        this.vx = (this.vx - 2 * dot * nx) * PHYSICS.BALL_RESTITUTION_POST;
        this.vy = (this.vy - 2 * dot * ny) * PHYSICS.BALL_RESTITUTION_POST;
        if (audio) audio.playPostClank();
      }
    }
  }

  render(ctx, camera) {
    // 1. Ball Shadow on ground (x, y, 0)
    const shadowPos = camera.worldToScreen(this.x, this.y, 0);
    const shadowScale = Math.max(0.4, 1 - this.z / 180);
    const shadowAlpha = Math.max(0.12, 0.42 * (1 - this.z / 160));

    ctx.save();
    ctx.beginPath();
    const sRx = this.radius * camera.zoom * shadowScale * 1.1;
    const sRy = this.radius * camera.zoom * shadowScale * 0.7;
    ctx.ellipse(shadowPos.x, shadowPos.y, sRx, sRy, 0, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(15, 23, 42, ${shadowAlpha})`;
    ctx.fill();
    ctx.restore();

    // 2. High-speed Motion Trail
    if (this.trail.length > 0) {
      ctx.save();
      for (let i = 0; i < this.trail.length; i++) {
        const pt = this.trail[i];
        const screenPt = camera.worldToScreen(pt.x, pt.y, pt.z);
        const r = this.radius * camera.zoom * (0.6 + 0.4 * (i / this.trail.length));
        ctx.beginPath();
        ctx.arc(screenPt.x, screenPt.y, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${pt.alpha * (i / this.trail.length) * 0.4})`;
        ctx.fill();
      }
      ctx.restore();
    }

    // 3. Ball Body at (x, y, z)
    const screenPos = camera.worldToScreen(this.x, this.y, this.z);
    const screenR = Math.max(4, this.radius * camera.zoom);

    ctx.save();
    ctx.translate(screenPos.x, screenPos.y);

    // Ball 3D Gradient Sphere
    const ballGradient = ctx.createRadialGradient(
      -screenR * 0.35,
      -screenR * 0.4,
      screenR * 0.15,
      0,
      0,
      screenR
    );
    ballGradient.addColorStop(0, '#FFFFFF');
    ballGradient.addColorStop(0.7, '#E2E8F0');
    ballGradient.addColorStop(1, '#94A3B8');

    ctx.beginPath();
    ctx.arc(0, 0, screenR, 0, Math.PI * 2);
    ctx.fillStyle = ballGradient;
    ctx.fill();

    // Pentagons & Seams (Arcade Telstar soccer ball pattern rotating with roll)
    ctx.save();
    ctx.rotate(this.rotationAngle);
    ctx.fillStyle = '#0F172A';

    // Center pentagon
    const pR = screenR * 0.38;
    ctx.beginPath();
    for (let k = 0; k < 5; k++) {
      const angle = (k * 2 * Math.PI) / 5;
      const px = Math.cos(angle) * pR;
      const py = Math.sin(angle) * pR;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    // Outer pentagon patches
    for (let k = 0; k < 5; k++) {
      const angle = (k * 2 * Math.PI) / 5 + Math.PI / 5;
      const ox = Math.cos(angle) * screenR * 0.78;
      const oy = Math.sin(angle) * screenR * 0.78;
      ctx.beginPath();
      ctx.arc(ox, oy, screenR * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Outer spherical outline & rim light
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.4)';
    ctx.lineWidth = 1.2 * camera.zoom;
    ctx.beginPath();
    ctx.arc(0, 0, screenR, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }
}
