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
    this.pendingPassFrom = null;
    this.lastPassInfo = null;
    this.shotAtGoalTeam = null;
    this.curveSpin = 0; // Lateral Magnus swerve (rad/s) for curled shots
    this.carrier = null; // Currently controlling dribbler
    this.isRestartProtected = false;
    this.inGoalSide = null; // 'left' | 'right' when ball entered goal mouth inside woodwork
    this.hasScoredInNet = false; // Prevents double goal/post-clank/goal-kick once goal is scored
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
    this.pendingPassFrom = null;
    this.lastPassInfo = null;
    this.shotAtGoalTeam = null;
    this.curveSpin = 0;
    this.carrier = null;
    this.isRestartProtected = false;
    this.inGoalSide = null;
    this.hasScoredInNet = false;
    this.trail = [];
  }

  update(dt, onGoalScored, onGoalKick, audio) {
    if (this.lastPassInfo) {
      this.lastPassInfo.ttl -= dt;
      if (
        this.lastPassInfo.ttl <= 0 ||
        (this.carrier && this.carrier.team !== this.lastPassInfo.team)
      ) {
        this.lastPassInfo = null;
      }
    }
    // A. Close-control sticky dribbling (EAFC style)
    if (this.carrier) {
      if (this.carrier.isStumbled || this.carrier.kickCooldown > 0.05) {
        this.carrier = null;
      } else {
        const prevX = this.x;
        const prevY = this.y;
        const prevZ = this.z;
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
        this.curveSpin = 0;

        const speed = Math.hypot(this.vx, this.vy);
        if (speed > 5) {
          this.rotationAngle += (speed / this.radius) * dt;
          this.spinAxisX = -this.vy / speed;
          this.spinAxisY = this.vx / speed;
        }

        this.handleBoundaries(onGoalScored, onGoalKick, audio, prevX, prevY, prevZ);
        return;
      }
    }

    // B. Free ball projectile & rolling physics (sub-stepped to prevent post/crossbar/net tunneling)
    const estMove = Math.hypot(this.vx, this.vy, this.vz) * dt;
    const subSteps = Math.max(1, Math.min(24, Math.ceil(estMove / 3.5)));
    const subDt = dt / subSteps;

    for (let step = 0; step < subSteps; step++) {
      const prevX = this.x;
      const prevY = this.y;
      const prevZ = this.z;

      // 1. Apply gravity to vertical axis (Z)
      if (this.z > 0 || this.vz !== 0) {
        this.vz -= PHYSICS.GRAVITY * subDt;
      }

      // Apply lateral Magnus curve spin during fast flight
      const preSpeed = Math.hypot(this.vx, this.vy);
      if (Math.abs(this.curveSpin) > 0.01 && preSpeed > 85) {
        const spinFactor = Math.min(1.15, preSpeed / 520);
        const dAngle = this.curveSpin * spinFactor * subDt;
        const cosA = Math.cos(dAngle);
        const sinA = Math.sin(dAngle);
        const nvx = this.vx * cosA - this.vy * sinA;
        const nvy = this.vx * sinA + this.vy * cosA;
        this.vx = nvx;
        this.vy = nvy;
        this.curveSpin *= Math.pow(0.988, subDt * 60);
      } else if (preSpeed <= 85) {
        this.curveSpin = 0;
      }

      // 2. Integrate positions
      this.x += this.vx * subDt;
      this.y += this.vy * subDt;
      this.z += this.vz * subDt;

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
        const frictionFactor = Math.pow(PHYSICS.BALL_FRICTION_GROUND, subDt * 60);
        this.vx *= frictionFactor;
        this.vy *= frictionFactor;
      } else {
        // Air drag
        const dragFactor = Math.pow(PHYSICS.BALL_DRAG_AIR, subDt * 60);
        this.vx *= dragFactor;
        this.vy *= dragFactor;
      }

      // 4. Pitch boundary collisions, Crossbar, Posts, and Goal Detection
      const boundaryEvent = this.handleBoundaries(
        onGoalScored,
        onGoalKick,
        audio,
        prevX,
        prevY,
        prevZ
      );
      if (boundaryEvent === 'goal_kick' || this.carrier) {
        break;
      }
    }

    // 5. Ball spin / roll animation
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

    // Clear active shot tracking if ball slowed down or rebounded away from target goal
    if (this.shotAtGoalTeam === 'blue' && (this.vx > 20 || speed < 55)) {
      this.shotAtGoalTeam = null;
    } else if (this.shotAtGoalTeam === 'red' && (this.vx < -20 || speed < 55)) {
      this.shotAtGoalTeam = null;
    }

    // 6. Ball speed trail for powerful & curving shots
    if (speed > 330 && !this.hasScoredInNet) {
      const isCurving = Math.abs(this.curveSpin) > 0.15;
      this.trail.push({ x: this.x, y: this.y, z: this.z, alpha: isCurving ? 0.72 : 0.6, curved: isCurving });
      const maxTrail = isCurving ? 10 : 6;
      while (this.trail.length > maxTrail) this.trail.shift();
    } else if (this.trail.length > 0) {
      this.trail.shift();
    }
  }

  handleBoundaries(
    onGoalScored,
    onGoalKick,
    audio,
    prevX = this.x,
    prevY = this.y,
    prevZ = this.z
  ) {
    const halfW = PITCH.WIDTH / 2;
    const halfH = PITCH.HEIGHT / 2;
    const halfGoalW = PITCH.GOAL_WIDTH / 2;

    // A. Touchline boundaries (Top & Bottom Y)
    if (this.y < -halfH + this.radius) {
      this.y = -halfH + this.radius;
      this.vy = -this.vy * 0.6;
      this.curveSpin = 0;
    } else if (this.y > halfH - this.radius) {
      this.y = halfH - this.radius;
      this.vy = -this.vy * 0.6;
      this.curveSpin = 0;
    }

    // B. Check 3D Crossbar & Goal Posts (skipped once goal is already scored in net)
    if (!this.hasScoredInNet) {
      this.checkCrossbarCollision(-halfW, audio);
      this.checkCrossbarCollision(halfW, audio);

      this.checkPostCollision(-halfW, -halfGoalW, audio);
      this.checkPostCollision(-halfW, halfGoalW, audio);
      this.checkPostCollision(halfW, -halfGoalW, audio);
      this.checkPostCollision(halfW, halfGoalW, audio);
    }

    // C. Left & Right Goal Lines, Nets & Out of Bounds
    const leftEvent = this.resolveGoalEnd(
      'left',
      -halfW,
      -1,
      'red',
      'blue',
      onGoalScored,
      onGoalKick,
      prevX,
      prevY,
      prevZ
    );
    if (leftEvent) return leftEvent;

    const rightEvent = this.resolveGoalEnd(
      'right',
      halfW,
      1,
      'blue',
      'red',
      onGoalScored,
      onGoalKick,
      prevX,
      prevY,
      prevZ
    );
    if (rightEvent) return rightEvent;

    return null;
  }

  resolveGoalEnd(
    side,
    goalLineX,
    dirOut,
    scoringTeam,
    defendingTeam,
    onGoalScored,
    onGoalKick,
    prevX,
    prevY,
    prevZ
  ) {
    const halfGoalW = PITCH.GOAL_WIDTH / 2;
    const goalDepth = PITCH.GOAL_DEPTH;
    const goalH = PITCH.GOAL_HEIGHT;

    const prevDepthBeyond = (prevX - goalLineX) * dirOut;
    const depthBeyond = (this.x - goalLineX) * dirOut;

    // Detect crossing from pitch side into the goal mouth between posts & under crossbar
    if (this.inGoalSide !== side && prevDepthBeyond <= 0 && depthBeyond > 0) {
      const denom = depthBeyond - prevDepthBeyond;
      const t = denom > 1e-6 ? Math.max(0, Math.min(1, -prevDepthBeyond / denom)) : 1;
      const crossY = prevY + (this.y - prevY) * t;
      const crossZ = prevZ + (this.z - prevZ) * t;

      if (Math.abs(crossY) < halfGoalW && crossZ < goalH) {
        this.inGoalSide = side;
      }
    }

    // Case 1: Ball is inside this goal mouth / net
    if (this.inGoalSide === side) {
      // Saved or rebounded back out onto the pitch before whole ball crossed the line
      if (!this.hasScoredInNet && depthBeyond <= 0) {
        this.inGoalSide = null;
        return null;
      }

      // Constrain inside side nets
      const maxNetY = halfGoalW - this.radius;
      if (this.y < -maxNetY) {
        this.y = -maxNetY;
        if (this.vy < 0) this.vy = -this.vy * 0.28;
      } else if (this.y > maxNetY) {
        this.y = maxNetY;
        if (this.vy > 0) this.vy = -this.vy * 0.28;
      }

      // Constrain under sloped roof net
      const depthFrac = Math.max(0, Math.min(1, depthBeyond / goalDepth));
      const roofZ = goalH * (1 - 0.15 * depthFrac) - this.radius;
      if (this.z > roofZ) {
        this.z = roofZ;
        if (this.vz > 0) this.vz = -this.vz * 0.25;
      }

      // Constrain against back net
      const maxDepth = goalDepth - this.radius;
      if (depthBeyond > maxDepth) {
        this.x = goalLineX + dirOut * maxDepth;
        if (this.vx * dirOut > 0) {
          this.vx = -this.vx * 0.22;
          this.vy *= 0.7;
        }
      }

      // Keep already-scored ball settled inside the net during celebration
      if (this.hasScoredInNet && depthBeyond < this.radius * 0.5) {
        this.x = goalLineX + dirOut * (this.radius * 0.5);
        if (this.vx * dirOut < 0) {
          this.vx = -this.vx * 0.2;
        }
      }

      // Award goal the moment the WHOLE ball crosses the goal line!
      if (!this.hasScoredInNet && depthBeyond >= this.radius) {
        this.hasScoredInNet = true;
        if (this.carrier) {
          this.lastKickedBy = this.carrier;
          this.carrier = null;
        }
        this.pendingPassFrom = null;
        this.shotAtGoalTeam = null;
        if (onGoalScored) {
          onGoalScored(scoringTeam);
          return 'goal';
        }
      }

      return null;
    }

    // Case 2: Ball is past goal line OUTSIDE the goal mouth (wide or over crossbar)
    if (depthBeyond > 0) {
      // Prevent ball from phasing into goal cage through exterior side/roof nets
      if (depthBeyond < goalDepth + this.radius) {
        if (this.z <= goalH) {
          if (prevY <= -halfGoalW && this.y > -halfGoalW - this.radius) {
            this.y = -halfGoalW - this.radius;
            if (this.vy > 0) this.vy = -this.vy * 0.35;
          } else if (prevY >= halfGoalW && this.y < halfGoalW + this.radius) {
            this.y = halfGoalW + this.radius;
            if (this.vy < 0) this.vy = -this.vy * 0.35;
          }
        }
        if (Math.abs(this.y) < halfGoalW + this.radius) {
          const depthFrac = Math.max(0, Math.min(1, depthBeyond / goalDepth));
          const extRoofZ = goalH * (1 - 0.15 * depthFrac) + this.radius;
          if (prevZ >= extRoofZ - 4 && this.z < extRoofZ) {
            this.z = extRoofZ;
            if (this.vz < 0) this.vz = -this.vz * 0.35;
          }
        }
      }

      const ballSpeed = Math.hypot(this.vx, this.vy);
      if (
        depthBeyond > this.radius * 1.25 ||
        (depthBeyond > this.radius && ballSpeed < 30)
      ) {
        const wasMissedShot = !!(this.shotAtGoalTeam || ballSpeed > 420);
        this.vx *= 0.5;
        this.vy *= 0.5;
        this.pendingPassFrom = null;
        this.lastPassInfo = null;
        this.shotAtGoalTeam = null;
        if (onGoalKick) {
          onGoalKick(defendingTeam, wasMissedShot);
          return 'goal_kick';
        }
      }

      if (depthBeyond > 80) {
        this.x = goalLineX + dirOut * 80;
        if (this.vx * dirOut > 0) this.vx = 0;
      }
    }

    return null;
  }

  checkCrossbarCollision(goalLineX, audio) {
    const halfGoalW = PITCH.GOAL_WIDTH / 2;
    const goalH = PITCH.GOAL_HEIGHT;
    const barR = PITCH.POST_RADIUS;

    const clampedY = Math.max(-halfGoalW, Math.min(halfGoalW, this.y));
    const dx = this.x - goalLineX;
    const dy = this.y - clampedY;
    const dz = this.z - goalH;
    const dist = Math.hypot(dx, dy, dz);
    const minDist = this.radius + barR;

    if (dist < minDist) {
      const nx = dist > 0.0001 ? dx / dist : (-Math.sign(goalLineX) || 1);
      const ny = dist > 0.0001 ? dy / dist : 0;
      const nz = dist > 0.0001 ? dz / dist : 1;

      this.x = goalLineX + nx * minDist;
      this.y = clampedY + ny * minDist;
      this.z = goalH + nz * minDist;

      const dot = this.vx * nx + this.vy * ny + this.vz * nz;
      if (dot < 0) {
        this.vx = (this.vx - 2 * dot * nx) * PHYSICS.BALL_RESTITUTION_POST;
        this.vy = (this.vy - 2 * dot * ny) * PHYSICS.BALL_RESTITUTION_POST;
        this.vz = (this.vz - 2 * dot * nz) * PHYSICS.BALL_RESTITUTION_POST;

        if (audio) {
          audio.playPostClank();
          const dirIntoGoal = Math.sign(goalLineX) || 1;
          if (this.vx * dirIntoGoal <= 40 && audio.playCrowdMiss) {
            audio.playCrowdMiss();
          }
        }
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
        if (audio) {
          audio.playPostClank();
          const dirIntoGoal = Math.sign(postX) || 1;
          if (this.vx * dirIntoGoal <= 40 && audio.playCrowdMiss) {
            audio.playCrowdMiss();
          }
        }
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
        const frac = i / this.trail.length;
        const r = this.radius * camera.zoom * (0.55 + 0.45 * frac);
        ctx.beginPath();
        ctx.arc(screenPt.x, screenPt.y, r, 0, Math.PI * 2);
        ctx.fillStyle = pt.curved
          ? `rgba(253, 224, 71, ${pt.alpha * frac * 0.42})`
          : `rgba(255, 255, 255, ${pt.alpha * frac * 0.4})`;
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
