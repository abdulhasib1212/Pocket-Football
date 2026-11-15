/**
 * Player Entity & 2.5D Visuals
 * Handles 3v3 player models, movement, role positioning, animation strides, and subtle shadows.
 */
import { PITCH, PHYSICS, TEAMS, DIFFICULTIES } from './constants.js';

export class Player {
  constructor(config) {
    this.id = config.id;
    this.name = config.name || 'Player';
    this.team = config.team; // 'blue' or 'red'
    this.teamConfig = config.teamConfig || (config.team === 'blue' ? TEAMS.BLUE : TEAMS.RED);
    this.role = config.role; // 'GK', 'DF', 'FW'
    this.number = config.number || 10;
    this.difficulty = config.difficulty || 'normal';
    
    // World coordinates
    this.startX = config.x || 0;
    this.startY = config.y || 0;
    this.x = this.startX;
    this.y = this.startY;
    this.z = 0;

    this.vx = 0;
    this.vy = 0;
    this.vz = 0;

    this.facingAngle = config.team === 'blue' ? 0 : Math.PI; // Blue faces right (+X), Red faces left (-X)
    this.isControlled = !!config.isControlled;
    this.controlledBy = config.controlledBy || (this.isControlled ? 'p1' : null);

    // Movement attributes
    this.radius = PHYSICS.PLAYER_RADIUS;
    this.maxSpeed = PHYSICS.PLAYER_MAX_SPEED;
    this.kickCooldown = 0;
    this.isKicking = false;
    this.kickAnimTimer = 0;

    // Tackling and possession states
    this.isStumbled = false;
    this.stumbleTimer = 0;
    this.possessionTimer = 0;
    this.isTackling = false;
    this.tackleTimer = 0;
    this.tackleCooldown = 0;
    this.aiTackleCooldown = 0;
    this.aiTackleDelay = 0;
    this.aiRestartTimer = 0;

    // Match Performance Stats (tracked for Match MVP award)
    this.stats = {
      goals: 0,
      assists: 0,
      tackles: 0,
      passes: 0,
      shots: 0
    };

    // Animation states
    this.stridePhase = 0;
    this.idleBreathing = Math.random() * Math.PI * 2;
  }

  reset(x = this.startX, y = this.startY) {
    this.x = x;
    this.y = y;
    this.z = 0;
    this.vx = 0;
    this.vy = 0;
    this.facingAngle = this.team === 'blue' ? 0 : Math.PI;
    this.kickCooldown = 0;
    this.isKicking = false;
    this.kickAnimTimer = 0;
    this.isTackling = false;
    this.tackleTimer = 0;
    this.tackleCooldown = 0;
    this.aiTackleCooldown = 0;
    this.aiTackleDelay = 0;
    this.aiRestartTimer = 0;
    this.isStumbled = false;
    this.stumbleTimer = 0;
    this.possessionTimer = 0;
  }

  update(dt, inputDir, ball, allPlayers) {
    this.idleBreathing += dt * 3;
    if (this.kickCooldown > 0) this.kickCooldown -= dt;
    if (this.tackleCooldown > 0) this.tackleCooldown -= dt;
    if (this.aiTackleCooldown > 0) this.aiTackleCooldown -= dt;
    if (this.aiRestartTimer > 0) this.aiRestartTimer -= dt;
    if (this.kickAnimTimer > 0) {
      this.kickAnimTimer -= dt;
      if (this.kickAnimTimer <= 0) this.isKicking = false;
    }
    if (this.tackleTimer > 0) {
      this.tackleTimer -= dt;
      if (this.tackleTimer <= 0) this.isTackling = false;
    }

    // Stumble recovery
    if (this.isStumbled) {
      this.stumbleTimer -= dt;
      if (this.stumbleTimer <= 0) {
        this.isStumbled = false;
      }
    }

    if (this.isControlled && inputDir) {
      // 1. Human Player Control
      this.handleInput(dt, inputDir);
    } else {
      // 2. Cooperative teammate/opponent AI with high pass urgency
      this.handleAI(dt, ball, allPlayers);
    }

    // Integrate velocity
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Running animation cycle
    const speed = Math.hypot(this.vx, this.vy);
    if (speed > 10) {
      this.stridePhase += speed * dt * 0.045;
      this.facingAngle = Math.atan2(this.vy, this.vx);
    }

    // Boundary constraints (stay within pitch boundaries)
    const halfW = PITCH.WIDTH / 2 - 12;
    const halfH = PITCH.HEIGHT / 2 - 12;
    this.x = Math.max(-halfW, Math.min(halfW, this.x));
    this.y = Math.max(-halfH, Math.min(halfH, this.y));
  }

  handleInput(dt, inputDir) {
    const len = Math.hypot(inputDir.x, inputDir.y);
    if (len > 0.05) {
      const dirX = inputDir.x / len;
      const dirY = inputDir.y / len;

      const targetVx = dirX * this.maxSpeed;
      const targetVy = dirY * this.maxSpeed;

      const accel = PHYSICS.PLAYER_ACCEL * dt;
      this.vx += (targetVx - this.vx) * Math.min(1, accel / this.maxSpeed);
      this.vy += (targetVy - this.vy) * Math.min(1, accel / this.maxSpeed);
    } else {
      // Smooth deceleration
      const friction = Math.pow(0.005, dt);
      this.vx *= friction;
      this.vy *= friction;
      if (Math.hypot(this.vx, this.vy) < 4) {
        this.vx = 0;
        this.vy = 0;
      }
    }
  }

  getDifficultyConfig() {
    return DIFFICULTIES[this.difficulty] || DIFFICULTIES.normal;
  }

  handleAI(dt, ball, allPlayers) {
    if (!ball) return;

    const diff = this.getDifficultyConfig();
    let targetX = this.startX;
    let targetY = this.startY;
    let desiredSpeed = this.maxSpeed * 0.78 * diff.aiSpeedMult;

    const teamConfig = this.teamConfig || (this.team === 'blue' ? TEAMS.BLUE : TEAMS.RED);
    const isAttackingRight = teamConfig.direction === 1;
    const distToBall = Math.hypot(ball.x - this.x, ball.y - this.y);
    const hasBallPossession = (ball.carrier === this);

    // 1. IF AI PLAYER HAS POSSESSION:
    if (hasBallPossession) {
      this.possessionTimer += dt;
      this.aiTackleDelay = 0;
      const attackGoalX = teamConfig.targetGoalX;
      const distToGoal = Math.hypot(attackGoalX - this.x, 0 - this.y);

      // Hold position briefly during a set restart (goal kick / kickoff) before distributing
      if (this.aiRestartTimer > 0) {
        this.vx *= 0.65;
        this.vy *= 0.65;
        this.facingAngle = isAttackingRight ? 0 : Math.PI;
        return;
      }

      // Goalkeeper distribution: stay near goal/box and distribute cleanly to open teammate
      if (this.role === 'GK') {
        this.vx *= 0.72;
        this.vy *= 0.72;
        this.facingAngle = isAttackingRight ? 0 : Math.PI;
        if (this.possessionTimer >= 0.22 && this.kickCooldown <= 0) {
          const passTarget = this.findBestPassTarget(allPlayers);
          if (passTarget) {
            this.performPass(ball, passTarget, PHYSICS.PASS_POWER * 1.12);
          } else {
            this.performKick(
              ball,
              isAttackingRight ? 1 : -1,
              (Math.random() - 0.5) * 0.35,
              PHYSICS.SHOT_POWER * 0.9,
              18,
              false
            );
          }
          this.possessionTimer = 0;
        }
        return;
      }

      // Drive into attacking half, weaving around defenders directly ahead
      targetX = this.x + teamConfig.direction * 140;
      targetY = this.y * 0.75;
      if (allPlayers) {
        let blocker = null;
        let minBlockerDist = 135;
        for (const op of allPlayers) {
          if (op.team === this.team) continue;
          const aheadDist = (op.x - this.x) * teamConfig.direction;
          const lateralDist = Math.abs(op.y - this.y);
          if (aheadDist > -10 && aheadDist < minBlockerDist && lateralDist < 65) {
            minBlockerDist = aheadDist;
            blocker = op;
          }
        }
        if (blocker) {
          const evadeWeight = diff.id === 'easy' ? 0.25 : diff.id === 'hard' ? 1.15 : 0.75;
          const evadeDir = blocker.y === this.y ? (this.y >= 0 ? -1 : 1) : (this.y >= blocker.y ? 1 : -1);
          const maxLaneY = PITCH.HEIGHT / 2 - 70;
          targetY = Math.max(-maxLaneY, Math.min(maxLaneY, this.y + evadeDir * 115 * evadeWeight));
        }
      }
      desiredSpeed = this.maxSpeed * 0.95 * diff.aiSpeedMult;

      // STRIKER IN RANGE: SHOOT!
      if (this.role === 'FW' && distToGoal < diff.aiShootRange) {
        if (this.kickCooldown <= 0) {
          let cornerY = (Math.random() > 0.5 ? 1 : -1) * (PITCH.GOAL_WIDTH * 0.35);
          if (diff.id === 'easy') {
            cornerY = (Math.random() - 0.5) * (PITCH.GOAL_WIDTH * 0.55);
          } else if (diff.id === 'hard' && allPlayers) {
            const oppGk = allPlayers.find((p) => p.team !== this.team && p.role === 'GK');
            if (oppGk && Math.abs(oppGk.y) > 8) {
              cornerY = oppGk.y > 0 ? -PITCH.GOAL_WIDTH * 0.39 : PITCH.GOAL_WIDTH * 0.39;
            } else {
              cornerY = (this.y >= 0 ? -1 : 1) * (PITCH.GOAL_WIDTH * 0.38);
            }
          }
          const dy = cornerY - this.y;
          const dx = attackGoalX - this.x;
          const dist = Math.hypot(dx, dy) || 1;
          this.performKick(
            ball,
            dx / dist,
            dy / dist,
            PHYSICS.SHOT_POWER * diff.aiShotSpeedMult,
            PHYSICS.SHOT_HEIGHT,
            true
          );
          this.possessionTimer = 0;
          return;
        }
      }

      // SMART PASSING: Pass forward to open teammates or lay off under pressure (scaled by difficulty)
      if (this.possessionTimer >= diff.aiPassDelay && this.kickCooldown <= 0) {
        const passTarget = this.findBestPassTarget(allPlayers);
        if (passTarget) {
          const distToTarget = Math.hypot(passTarget.x - this.x, passTarget.y - this.y);
          const forwardGain = (passTarget.x - this.x) * teamConfig.direction;
          let nearestOppDist = 999;
          if (allPlayers) {
            for (const op of allPlayers) {
              if (op.team !== this.team) {
                const d = Math.hypot(op.x - this.x, op.y - this.y);
                if (d < nearestOppDist) nearestOppDist = d;
              }
            }
          }

          const shouldPass =
            this.role === 'DF'
              ? (distToTarget > 65 && (forwardGain > -30 || nearestOppDist < 95))
              : (passTarget.role !== 'GK' && distToTarget > 65 && (forwardGain > 15 || nearestOppDist < 54));

          if (shouldPass) {
            this.performPass(ball, passTarget);
            this.possessionTimer = 0;
            return;
          }
        }
      }

      // Clear/drive forward if held longer than 1.45s without options
      if (this.possessionTimer > 1.45 && this.kickCooldown <= 0) {
        this.performKick(
          ball,
          isAttackingRight ? 1 : -1,
          (Math.random() - 0.5) * 0.3,
          PHYSICS.SHOT_POWER * 0.85 * diff.aiShotSpeedMult,
          PHYSICS.SHOT_HEIGHT * 0.6,
          null
        );
        this.possessionTimer = 0;
        return;
      }
    } else {
      this.possessionTimer = 0;

      // Helper: determine if this AI outfield player is the closest teammate to press the ball
      let isClosestOutfieldPresser = true;
      if (this.role !== 'GK' && allPlayers) {
        for (const mate of allPlayers) {
          if (mate !== this && mate.team === this.team && mate.role !== 'GK') {
            const mateDist = Math.hypot(ball.x - mate.x, ball.y - mate.y);
            if (mateDist + 18 < distToBall) {
              isClosestOutfieldPresser = false;
              break;
            }
          }
        }
      }

      // 2. DEFENSIVE PRESSING & TIMED TACKLING (never during protected restarts!)
      if (ball.carrier && ball.carrier.team !== this.team && !ball.isRestartProtected) {
        const carrier = ball.carrier;
        const distToOpponent = Math.hypot(carrier.x - this.x, carrier.y - this.y);

        if (this.role === 'GK') {
          // GK guards the goal line and only challenges inside/near their own penalty box
          const inBoxThreat =
            Math.abs(carrier.x - teamConfig.ownGoalX) < diff.aiGkBoxThreatRange && Math.abs(carrier.y) < 145;
          if (inBoxThreat) {
            targetX = carrier.x;
            targetY = carrier.y;
            desiredSpeed = this.maxSpeed * 0.9 * diff.aiGkTrackMult;

            const toOppAngle = Math.atan2(carrier.y - this.y, carrier.x - this.x);
            let angleDiff = Math.abs(this.facingAngle - toOppAngle);
            if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;

            if (
              distToOpponent <= PHYSICS.TACKLE_RANGE * diff.aiTackleRangeMult + 2 &&
              angleDiff < 1.15 &&
              this.aiTackleCooldown <= 0 &&
              this.tackleCooldown <= 0 &&
              this.kickCooldown <= 0
            ) {
              this.aiTackleDelay += dt;
              if (this.aiTackleDelay >= diff.aiTackleReaction) {
                this.performTackle(ball, allPlayers, null);
                this.aiTackleCooldown =
                  diff.aiTackleCooldownMin + Math.random() * (diff.aiTackleCooldownMax - diff.aiTackleCooldownMin);
                this.aiTackleDelay = 0;
              }
            } else {
              this.aiTackleDelay = Math.max(0, this.aiTackleDelay - dt * 2.5);
            }
          } else {
            this.aiTackleDelay = 0;
            const goalX = teamConfig.ownGoalX + (isAttackingRight ? 35 : -35);
            targetX = goalX;
            const maxGkY = PITCH.GOAL_WIDTH * 0.42;
            const trackScale = diff.id === 'easy' ? 0.45 : diff.id === 'hard' ? 0.85 : 0.65;
            targetY = Math.max(-maxGkY, Math.min(maxGkY, ball.y * trackScale));
            desiredSpeed = this.maxSpeed * 0.8 * diff.aiGkTrackMult;
          }
        } else if (isClosestOutfieldPresser && distToOpponent < diff.aiPressRange) {
          // Primary outfield presser tracks the ball carrier and times a tackle
          targetX = carrier.x;
          targetY = carrier.y;
          desiredSpeed = this.maxSpeed * 0.94 * diff.aiSpeedMult;

          const toOppAngle = Math.atan2(carrier.y - this.y, carrier.x - this.x);
          let angleDiff = Math.abs(this.facingAngle - toOppAngle);
          if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;

          if (
            distToOpponent <= PHYSICS.TACKLE_RANGE * diff.aiTackleRangeMult + 2 &&
            angleDiff < 1.15 &&
            this.aiTackleCooldown <= 0 &&
            this.tackleCooldown <= 0 &&
            this.kickCooldown <= 0
          ) {
            this.aiTackleDelay += dt;
            if (this.aiTackleDelay >= diff.aiTackleReaction) {
              this.performTackle(ball, allPlayers, null);
              this.aiTackleCooldown =
                diff.aiTackleCooldownMin + Math.random() * (diff.aiTackleCooldownMax - diff.aiTackleCooldownMin);
              this.aiTackleDelay = 0;
            }
          } else {
            this.aiTackleDelay = Math.max(0, this.aiTackleDelay - dt * 2.5);
          }
        } else {
          // Supporting outfield AI drops into defensive cover instead of dogpiling/spam-tackling
          this.aiTackleDelay = 0;
          const coverX = ball.x * 0.52 + teamConfig.ownGoalX * 0.48;
          targetX = coverX;
          targetY = this.startY * 0.45 + ball.y * 0.38;
          desiredSpeed = this.maxSpeed * 0.84 * diff.aiSpeedMult;
        }
      } else if (!ball.carrier && !ball.isRestartProtected && distToBall < diff.aiPressRange && (this.role !== 'GK' || Math.abs(ball.x - teamConfig.ownGoalX) < diff.aiGkBoxThreatRange + 15)) {
        // Loose ball or incoming shot: GK predicts line on Hard, otherwise chases!
        this.aiTackleDelay = 0;
        if (this.role === 'GK' && diff.aiPredictShots && ball.shotAtGoalTeam === this.team && Math.abs(ball.vx) > 80) {
          const lineX = teamConfig.ownGoalX + (isAttackingRight ? 32 : -32);
          const t = (lineX - ball.x) / ball.vx;
          const maxGkY = PITCH.GOAL_WIDTH * 0.44;
          const predY = t > 0 ? ball.y + ball.vy * t : ball.y;
          targetX = lineX;
          targetY = Math.max(-maxGkY, Math.min(maxGkY, predY));
          desiredSpeed = this.maxSpeed * 1.05 * diff.aiGkTrackMult;
        } else if (this.role === 'GK' || isClosestOutfieldPresser || distToBall < 140) {
          targetX = ball.x;
          targetY = ball.y;
          desiredSpeed = this.maxSpeed * 0.94 * (this.role === 'GK' ? diff.aiGkTrackMult : diff.aiSpeedMult);
        } else {
          targetX = this.startX * 0.45 + ball.x * 0.35;
          targetY = this.startY * 0.4 + ball.y * 0.45;
          desiredSpeed = this.maxSpeed * 0.82 * diff.aiSpeedMult;
        }
      } else {
        // Positional shape (also used during protected restarts)
        this.aiTackleDelay = 0;
        if (this.role === 'GK') {
          const goalX = teamConfig.ownGoalX + (isAttackingRight ? 35 : -35);
          targetX = goalX;
          const maxGkY = PITCH.GOAL_WIDTH * 0.42;
          const trackScale = diff.id === 'easy' ? 0.45 : diff.id === 'hard' ? 0.85 : 0.65;
          targetY = Math.max(-maxGkY, Math.min(maxGkY, ball.y * trackScale));
          desiredSpeed = this.maxSpeed * 0.8 * diff.aiGkTrackMult;
        } else if (this.role === 'DF') {
          const defLineX = isAttackingRight ? -PITCH.WIDTH * 0.22 : PITCH.WIDTH * 0.22;
          targetX = defLineX + (ball.x * 0.28);
          targetY = this.startY * 0.4 + ball.y * 0.6;
        } else if (this.role === 'FW') {
          const attackX = isAttackingRight ? PITCH.WIDTH * 0.22 : -PITCH.WIDTH * 0.22;
          targetX = attackX + ball.x * 0.25;
          targetY = this.startY * 0.3 + ball.y * 0.6;
        }
      }
    }

    // Move towards target
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 8) {
      const dirX = dx / dist;
      const dirY = dy / dist;
      const targetVx = dirX * desiredSpeed;
      const targetVy = dy * (desiredSpeed / dist);

      const accel = PHYSICS.PLAYER_ACCEL * dt * 0.85 * diff.aiAccelMult;
      this.vx += (targetVx - this.vx) * Math.min(1, accel / Math.max(1, desiredSpeed));
      this.vy += (targetVy - this.vy) * Math.min(1, accel / Math.max(1, desiredSpeed));
      this.facingAngle = Math.atan2(this.vy, this.vx);
    } else {
      this.vx *= 0.8;
      this.vy *= 0.8;
      this.facingAngle = Math.atan2(ball.y - this.y, ball.x - this.x);
    }
  }

  performTackle(ball, allPlayers, audio) {
    if (this.tackleCooldown > 0 || this.kickCooldown > 0 || this.isStumbled) return false;
    if (ball.isRestartProtected && ball.carrier && ball.carrier.team !== this.team) return false;

    // Check if there is an opponent carrier within auto-target challenge range (65 units)
    let targetOpponent = null;
    let minOpponentDist = 65;

    if (ball.carrier && ball.carrier.team !== this.team) {
      const d = Math.hypot(ball.carrier.x - this.x, ball.carrier.y - this.y);
      if (d <= minOpponentDist) {
        targetOpponent = ball.carrier;
        minOpponentDist = d;
      }
    } else if (allPlayers) {
      for (const p of allPlayers) {
        if (p !== this && p.team !== this.team) {
          const d = Math.hypot(p.x - this.x, p.y - this.y);
          if (d <= minOpponentDist && ball.carrier === p) {
            targetOpponent = p;
            minOpponentDist = d;
          }
        }
      }
    }

    // Dynamic directional challenge snapping: bias facing towards the duel target
    if (targetOpponent) {
      const toTargetAngle = Math.atan2(targetOpponent.y - this.y, targetOpponent.x - this.x);
      let angleDiff = Math.abs(this.facingAngle - toTargetAngle);
      if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;
      if (angleDiff < 1.95) {
        this.facingAngle = toTargetAngle;
      }
    } else if (!ball.carrier && ball.z <= 32) {
      // Loose ball nearby: snap toward ball
      const toBallDist = Math.hypot(ball.x - this.x, ball.y - this.y);
      if (toBallDist <= 58) {
        this.facingAngle = Math.atan2(ball.y - this.y, ball.x - this.x);
      }
    }

    // Athletic slide/standing tackle lunge burst!
    const lungePower = 210;
    this.vx += Math.cos(this.facingAngle) * lungePower;
    this.vy += Math.sin(this.facingAngle) * lungePower;

    this.isTackling = true;
    this.tackleTimer = 0.28;
    this.tackleCooldown = 0.85; // Missed tackles incur clear recovery cooldown
    this.isKicking = true;
    this.kickAnimTimer = 0.22;
    this.kickCooldown = 0.45;

    // 1. Challenging opponent ball carrier
    if (ball.carrier && ball.carrier.team !== this.team) {
      const dist = Math.hypot(ball.carrier.x - this.x, ball.carrier.y - this.y);
      if (dist <= PHYSICS.TACKLE_RANGE + 10) {
        const victim = ball.carrier;
        ball.carrier = null;
        victim.isStumbled = true;
        victim.stumbleTimer = 0.42;
        victim.vx *= 0.15;
        victim.vy *= 0.15;

        if (dist <= 36) {
          // Clean takeaway: tackler sticks ball to feet!
          ball.carrier = this;
          ball.lastKickedBy = this;
          ball.pendingPassFrom = null;
          ball.lastPassInfo = null;
          ball.shotAtGoalTeam = null;
          ball.vx = this.vx * 0.4;
          ball.vy = this.vy * 0.4;
        } else {
          // Poke tackle: dislodge ball in challenge direction
          const pokeAngle = this.facingAngle;
          ball.vx = Math.cos(pokeAngle) * 200;
          ball.vy = Math.sin(pokeAngle) * 200;
          ball.lastKickedBy = this;
          ball.pendingPassFrom = null;
          ball.lastPassInfo = null;
          ball.shotAtGoalTeam = null;
        }

        this.tackleCooldown = 0.62;

        if (this.stats) {
          this.stats.tackles = (this.stats.tackles || 0) + 1;
        }

        if (audio) audio.playTackle();
        return true;
      }
    }

    // 2. Loose ball sliding interception / GK diving save
    const maxDiveZ = this.role === 'GK' ? 55 : 30;
    const diveRange = this.role === 'GK' ? PHYSICS.TACKLE_RANGE + 14 : PHYSICS.TACKLE_RANGE + 8;
    if (!ball.carrier && ball.z <= maxDiveZ) {
      const dist = Math.hypot(ball.x - this.x, ball.y - this.y);
      if (dist <= diveRange) {
        ball.carrier = this;
        ball.lastKickedBy = this;
        ball.pendingPassFrom = null;
        ball.lastPassInfo = null;
        ball.shotAtGoalTeam = null;
        this.tackleCooldown = 0.62;
        if (audio) audio.playTackle();
        return true;
      }
    }

    return false;
  }

  isShotTowardGoal(kx, ky) {
    if (this.role === 'GK') return false;
    const teamConfig = this.teamConfig || (this.team === 'blue' ? TEAMS.BLUE : TEAMS.RED);
    const dir = teamConfig.direction || 1;
    const attackGoalX = teamConfig.targetGoalX ?? (dir === 1 ? PITCH.WIDTH / 2 : -PITCH.WIDTH / 2);

    // Must be aimed toward the opponent's goal
    if (kx * dir <= 0.25) return false;

    // Must be within realistic attacking/shooting range
    const distToGoalLineX = (attackGoalX - this.x) * dir;
    if (distToGoalLineX < -10 || distToGoalLineX > PITCH.WIDTH * 0.58) return false;

    // Project trajectory onto the goal line to filter out wide clearances
    const t = (attackGoalX - this.x) / kx;
    if (t <= 0) return false;
    const projY = this.y + ky * t;
    return Math.abs(projY) <= PITCH.GOAL_WIDTH * 1.35;
  }

  performKick(ball, dirX, dirY, power = PHYSICS.SHOT_POWER, height = PHYSICS.SHOT_HEIGHT, isShot = null) {
    if (this.kickCooldown > 0 || this.isStumbled) return false;

    const dx = ball.x - this.x;
    const dy = ball.y - this.y;
    const dist = Math.hypot(dx, dy);

    // Can kick if in physical possession or nearby
    if (ball.carrier === this || (dist <= this.radius + ball.radius + 18 && ball.z <= PHYSICS.PLAYER_HEIGHT + 10)) {
      if (ball.carrier === this) {
        ball.carrier = null;
      }

      let kx = dirX;
      let ky = dirY;
      const len = Math.hypot(kx, ky);
      if (len > 0.01) {
        kx /= len;
        ky /= len;
      } else {
        kx = Math.cos(this.facingAngle);
        ky = Math.sin(this.facingAngle);
      }

      if (ball.pendingPassFrom && ball.pendingPassFrom !== this && ball.pendingPassFrom.team === this.team) {
        if (ball.pendingPassFrom.stats) {
          ball.pendingPassFrom.stats.passes = (ball.pendingPassFrom.stats.passes || 0) + 1;
        }
        ball.lastPassInfo = {
          passer: ball.pendingPassFrom,
          team: this.team,
          ttl: 6.0,
        };
      } else if (ball.lastPassInfo && ball.lastPassInfo.team !== this.team) {
        ball.lastPassInfo = null;
      }

      ball.vx = kx * power;
      ball.vy = ky * power;
      ball.vz = Math.min(220, height);
      ball.lastKickedBy = this;
      ball.pendingPassFrom = null;

      const countsAsShot = isShot === false ? false : (isShot === true || this.isShotTowardGoal(kx, ky));
      if (countsAsShot && this.stats) {
        this.stats.shots = (this.stats.shots || 0) + 1;
      }
      ball.shotAtGoalTeam = countsAsShot ? (this.team === 'red' ? 'blue' : 'red') : null;

      this.kickCooldown = 0.28;
      this.isKicking = true;
      this.kickAnimTimer = 0.18;
      this.facingAngle = Math.atan2(ky, kx);
      return true;
    }
    return false;
  }

  performPass(ball, targetPlayer, power = PHYSICS.PASS_POWER) {
    if (this.kickCooldown > 0 || !targetPlayer || this.isStumbled) return false;

    const dx = ball.x - this.x;
    const dy = ball.y - this.y;
    const dist = Math.hypot(dx, dy);

    if (ball.carrier === this || (dist <= this.radius + ball.radius + 20 && ball.z <= PHYSICS.PLAYER_HEIGHT + 10)) {
      if (ball.carrier === this) {
        ball.carrier = null;
      }

      const leadX = targetPlayer.x + (targetPlayer.vx || 0) * 0.32;
      const leadY = targetPlayer.y + (targetPlayer.vy || 0) * 0.32;
      const passDx = leadX - this.x;
      const passDy = leadY - this.y;
      const passDist = Math.hypot(passDx, passDy);

      if (passDist > 5) {
        if (ball.pendingPassFrom && ball.pendingPassFrom !== this && ball.pendingPassFrom.team === this.team && ball.pendingPassFrom.stats) {
          ball.pendingPassFrom.stats.passes = (ball.pendingPassFrom.stats.passes || 0) + 1;
        }
        ball.vx = (passDx / passDist) * power;
        ball.vy = (passDy / passDist) * power;
        ball.vz = 0; // Ground pass
        ball.lastKickedBy = this;
        ball.pendingPassFrom = this;
        ball.lastPassInfo = null;
        ball.shotAtGoalTeam = null;

        this.kickCooldown = 0.24;
        this.isKicking = true;
        this.kickAnimTimer = 0.15;
        this.facingAngle = Math.atan2(passDy, passDx);
        return true;
      }
    }
    return false;
  }

  findBestPassTarget(allPlayers, inputDir) {
    if (!allPlayers) return null;
    const teammates = allPlayers.filter((p) => p.team === this.team && p !== this);
    if (teammates.length === 0) return null;

    let bestTeammate = null;
    let highestScore = -999;

    teammates.forEach((teammate) => {
      const dx = teammate.x - this.x;
      const dy = teammate.y - this.y;
      const dist = Math.hypot(dx, dy);

      if (dist < 25 || dist > 650) return;

      const dirX = dx / dist;
      const dirY = dy / dist;

      let score = 0;

      // 1. Alignment with player's aim or facing angle
      if (inputDir && Math.hypot(inputDir.x, inputDir.y) > 0.1) {
        const inLen = Math.hypot(inputDir.x, inputDir.y);
        const inDirX = inputDir.x / inLen;
        const inDirY = inputDir.y / inLen;
        const dot = dirX * inDirX + dirY * inDirY;
        score += dot * 70; // High priority for player's aiming direction
      } else {
        const faceX = Math.cos(this.facingAngle);
        const faceY = Math.sin(this.facingAngle);
        const dot = dirX * faceX + dirY * faceY;
        score += dot * 40;
      }

      // 2. Upfield advantage (attacking direction)
      const teamConfig = this.teamConfig || (this.team === 'blue' ? TEAMS.BLUE : TEAMS.RED);
      const forwardDist = (teammate.x - this.x) * teamConfig.direction;
      score += forwardDist * 0.12;

      // 3. Outfield player preferred over GK
      if (teammate.role !== 'GK') score += 25;

      if (score > highestScore) {
        highestScore = score;
        bestTeammate = teammate;
      }
    });

    return bestTeammate || teammates[0];
  }

  render(ctx, camera) {
    const isGK = this.role === 'GK';
    const teamColors = this.teamConfig || (this.team === 'blue' ? TEAMS.BLUE : TEAMS.RED);
    const shirtColor = isGK ? teamColors.gkColor : teamColors.shirtColor;
    const shortsColor = isGK ? teamColors.gkShorts : teamColors.shortsColor;

    // 1. Soft Oval Ground Shadow at (x, y, 0)
    const shadowPos = camera.worldToScreen(this.x, this.y, 0);
    ctx.save();
    ctx.beginPath();
    const sRx = this.radius * camera.zoom * 1.05;
    const sRy = this.radius * camera.zoom * 0.65;
    ctx.ellipse(shadowPos.x, shadowPos.y, sRx, sRy, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.38)';
    ctx.fill();
    ctx.restore();

    // 1B. Slide Tackle Turf Spray & Dust Streak
    if (this.isTackling) {
      ctx.save();
      const slideBehindX = this.x - Math.cos(this.facingAngle) * 26;
      const slideBehindY = this.y - Math.sin(this.facingAngle) * 26;
      const slideStart = camera.worldToScreen(slideBehindX, slideBehindY, 0);
      const slideEnd = camera.worldToScreen(this.x, this.y, 0);

      const grad = ctx.createLinearGradient(slideStart.x, slideStart.y, slideEnd.x, slideEnd.y);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
      grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.4)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0.8)');

      ctx.strokeStyle = grad;
      ctx.lineWidth = 4.2 * camera.zoom;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(slideStart.x, slideStart.y);
      ctx.lineTo(slideEnd.x, slideEnd.y);
      ctx.stroke();

      // Turf grass specks
      ctx.fillStyle = 'rgba(74, 222, 128, 0.7)';
      ctx.beginPath();
      ctx.arc(slideEnd.x - 3 * camera.zoom, slideEnd.y + 2 * camera.zoom, 1.8 * camera.zoom, 0, Math.PI * 2);
      ctx.arc(slideEnd.x + 4 * camera.zoom, slideEnd.y - 2 * camera.zoom, 1.4 * camera.zoom, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 2. Selection Ring for Controlled Player (P1 Gold vs P2 Cyan)
    const ctrlSlot = this.controlledBy || (this.isControlled ? 'p1' : null);
    const ringColor = ctrlSlot === 'p2' ? '#22D3EE' : '#FACC15';
    const ptrBorder = ctrlSlot === 'p2' ? '#0E7490' : '#78350F';
    if (this.isControlled || ctrlSlot) {
      ctx.save();
      const ringPulse = Math.sin(this.idleBreathing * 2) * 2;
      ctx.beginPath();
      ctx.ellipse(
        shadowPos.x,
        shadowPos.y,
        (this.radius + 8) * camera.zoom + ringPulse,
        (this.radius + 4) * camera.zoom * 0.65 + ringPulse * 0.5,
        0,
        0,
        Math.PI * 2
      );
      ctx.strokeStyle = ringColor;
      ctx.lineWidth = 2.5 * camera.zoom;
      ctx.stroke();

      // Overhead Pointer Triangle
      const headZ = PHYSICS.PLAYER_HEIGHT + 14;
      const ptrPos = camera.worldToScreen(this.x, this.y, headZ);
      const bob = Math.sin(this.idleBreathing * 3) * 3 * camera.zoom;

      ctx.beginPath();
      ctx.moveTo(ptrPos.x, ptrPos.y - 12 * camera.zoom + bob);
      ctx.lineTo(ptrPos.x - 7 * camera.zoom, ptrPos.y - 20 * camera.zoom + bob);
      ctx.lineTo(ptrPos.x + 7 * camera.zoom, ptrPos.y - 20 * camera.zoom + bob);
      ctx.closePath();
      ctx.fillStyle = ringColor;
      ctx.fill();
      ctx.strokeStyle = ptrBorder;
      ctx.lineWidth = 1 * camera.zoom;
      ctx.stroke();

      ctx.restore();
    }

    // 3. 2.5D Athlete Model (Body, Legs, Torso, Head)
    const speed = Math.hypot(this.vx, this.vy);
    const legSwing = speed > 10 ? Math.sin(this.stridePhase) * 7 * camera.zoom : 0;
    const bodyBob = speed > 10 ? Math.abs(Math.cos(this.stridePhase)) * 2 * camera.zoom : Math.sin(this.idleBreathing) * 1;
    const stumbleWobble = this.isStumbled ? Math.sin(this.idleBreathing * 16) * 3.5 * camera.zoom : 0;

    const baseZ = 0;
    const hipZ = 16;
    const shoulderZ = 28;
    const headZ = 36;

    // A. Boots / Legs
    const hipPos = camera.worldToScreen(this.x, this.y, hipZ + bodyBob);
    const leftFootPos = camera.worldToScreen(
      this.x - Math.sin(this.facingAngle) * 5,
      this.y + Math.cos(this.facingAngle) * 5 + legSwing,
      baseZ
    );
    const rightFootPos = camera.worldToScreen(
      this.x + Math.sin(this.facingAngle) * 5,
      this.y - Math.cos(this.facingAngle) * 5 - legSwing,
      baseZ
    );

    ctx.save();

    // Legs / Socks
    ctx.strokeStyle = teamColors.socksColor;
    ctx.lineWidth = 4 * camera.zoom;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(hipPos.x - 3 * camera.zoom, hipPos.y);
    ctx.lineTo(leftFootPos.x, leftFootPos.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(hipPos.x + 3 * camera.zoom, hipPos.y);
    ctx.lineTo(rightFootPos.x, rightFootPos.y);
    ctx.stroke();

    // Boots (Black cleats)
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(leftFootPos.x, leftFootPos.y, 3 * camera.zoom, 0, Math.PI * 2);
    ctx.arc(rightFootPos.x, rightFootPos.y, 3 * camera.zoom, 0, Math.PI * 2);
    ctx.fill();

    // Shorts
    ctx.fillStyle = shortsColor;
    ctx.beginPath();
    ctx.ellipse(hipPos.x, hipPos.y, 7.5 * camera.zoom, 5.5 * camera.zoom, 0, 0, Math.PI * 2);
    ctx.fill();

    // B. Jersey / Torso
    const shoulderPos = camera.worldToScreen(this.x, this.y, shoulderZ + bodyBob);
    const torsoWidth = 8.5 * camera.zoom;
    const torsoHeight = 11 * camera.zoom;

    // Torso rounded rectangle
    ctx.fillStyle = shirtColor;
    ctx.beginPath();
    ctx.ellipse(
      (hipPos.x + shoulderPos.x) / 2,
      (hipPos.y + shoulderPos.y) / 2,
      torsoWidth,
      torsoHeight * 0.7,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // Collar / trim
    ctx.strokeStyle = teamColors.shirtTrim;
    ctx.lineWidth = 1.5 * camera.zoom;
    ctx.stroke();

    // C. Squad Number on Jersey
    if (camera.zoom > 0.7) {
      ctx.fillStyle = isGK ? '#1E293B' : teamColors.numberColor;
      ctx.font = `bold ${Math.round(8 * camera.zoom)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const numY = (hipPos.y + shoulderPos.y) / 2;
      ctx.fillText(this.number.toString(), (hipPos.x + shoulderPos.x) / 2, numY);
    }

    // D. Head & Hair
    const headPos = camera.worldToScreen(this.x, this.y, headZ + bodyBob);
    const headR = 5.5 * camera.zoom;

    // Head / Face (warm skin tone)
    ctx.fillStyle = '#FBBF24';
    ctx.beginPath();
    ctx.arc(headPos.x, headPos.y, headR, 0, Math.PI * 2);
    ctx.fill();

    // Hair cap / hairstyle with directional facing
    ctx.fillStyle = this.team === 'blue' ? '#3B2F2F' : '#1F2937'; // Brunette vs Black hair
    ctx.beginPath();
    const hairAngleOffset = this.facingAngle;
    ctx.arc(
      headPos.x - Math.cos(hairAngleOffset) * 1.8 * camera.zoom,
      headPos.y - 1.5 * camera.zoom,
      headR * 0.9,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // Subtle face orientation dot
    const eyeX = headPos.x + Math.cos(this.facingAngle) * 3 * camera.zoom;
    const eyeY = headPos.y + Math.sin(this.facingAngle) * 2 * camera.zoom;
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, 1.2 * camera.zoom, 0, Math.PI * 2);
    ctx.fill();

    // E. Overhead Player Name Label
    if (camera.zoom > 0.38) {
      const tagPos = camera.worldToScreen(this.x, this.y, headZ + 12 + bodyBob);
      const fontSize = Math.max(8, Math.round(9.5 * camera.zoom));
      ctx.font = `700 ${fontSize}px 'Plus Jakarta Sans', 'Trebuchet MS', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const activeSlot = this.controlledBy || (this.isControlled ? 'p1' : null);
      const label = activeSlot === 'p2'
        ? `P2 · ${this.name}`
        : activeSlot === 'p1'
          ? `P1 · ${this.name}`
          : this.name;

      ctx.lineWidth = Math.max(2, 2.4 * camera.zoom);
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(11, 17, 32, 0.8)';
      ctx.strokeText(label, tagPos.x, tagPos.y);

      ctx.fillStyle = activeSlot === 'p2'
        ? '#67E8F9'
        : activeSlot === 'p1'
          ? '#FEF08A'
          : 'rgba(255, 255, 255, 0.95)';
      ctx.fillText(label, tagPos.x, tagPos.y);
    }

    ctx.restore();
  }
}
