/**
 * Physics & Collision Coordinator
 * Resolves player-ball close control dribbling, clean standing tackles, player collisions, and 2.5D depth sorting.
 */
import { PHYSICS } from './constants.js';

export class PhysicsSystem {
  static resolveCollisions(players, ball, audio) {
    // 1. Player-to-Player Collisions
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        this.resolvePlayerPair(players[i], players[j]);
      }
    }

    // 2. Player-to-Ball Contact, Sticky Dribbling & Tackling
    if (ball) {
      for (const player of players) {
        this.resolvePlayerBall(player, ball, audio);
      }
    }
  }

  static resolvePlayerPair(p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dist = Math.hypot(dx, dy);
    const minDist = p1.radius + p2.radius;

    if (dist < minDist && dist > 0.001) {
      const overlap = (minDist - dist) * 0.5;
      const nx = dx / dist;
      const ny = dy / dist;

      p1.x -= nx * overlap;
      p1.y -= ny * overlap;
      p2.x += nx * overlap;
      p2.y += ny * overlap;

      // Soft push on contact
      const relVx = p2.vx - p1.vx;
      const relVy = p2.vy - p1.vy;
      const velAlongNormal = relVx * nx + relVy * ny;

      if (velAlongNormal < 0) {
        const impulse = velAlongNormal * 0.25;
        p1.vx += nx * impulse;
        p1.vy += ny * impulse;
        p2.vx -= nx * impulse;
        p2.vy -= ny * impulse;
      }
    }
  }

  static resolvePlayerBall(player, ball, audio) {
    if (!ball || ball.hasScoredInNet) return;

    // During protected kickoff / goal-kick restarts, opponents cannot steal or intercept the ball
    if (ball.isRestartProtected && ball.carrier && ball.carrier.team !== player.team) {
      return;
    }

    const dx = ball.x - player.x;
    const dy = ball.y - player.y;
    const dist = Math.hypot(dx, dy);
    const contactDist = player.radius + ball.radius + 6;

    // 1. If ball is already carried by another player:
    if (ball.carrier && ball.carrier !== player) {
      // Only allow passive physical dispossession on very close direct ball contact
      // (deliberate lunge tackles at TACKLE_RANGE are handled by timed performTackle)
      if (
        ball.carrier.team !== player.team &&
        !player.isStumbled &&
        player.tackleCooldown <= 0 &&
        player.kickCooldown <= 0
      ) {
        const directBallDist = player.radius + ball.radius + 1;
        const tacklerSpeed = Math.hypot(player.vx, player.vy);

        const toBallAngle = Math.atan2(ball.y - player.y, ball.x - player.x);
        let angleDiff = Math.abs(player.facingAngle - toBallAngle);
        if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;

        if (dist <= directBallDist && tacklerSpeed > 65 && angleDiff < 1.05) {
          const victim = ball.carrier;
          ball.carrier = player;
          ball.lastKickedBy = player;
          ball.pendingPassFrom = null;
          ball.lastPassInfo = null;
          ball.shotAtGoalTeam = null;

          victim.isStumbled = true;
          victim.stumbleTimer = 0.42;
          victim.tackleCooldown = 0.65;
          victim.vx *= 0.35;
          victim.vy *= 0.35;

          player.tackleCooldown = 0.75;

          if (player.stats) {
            player.stats.tackles = (player.stats.tackles || 0) + 1;
          }

          if (audio) {
            audio.playTackle();
            if (audio.playCrowdCheer) audio.playCrowdCheer(0.45);
          }
        }
      }
      return;
    }

    // 2. Loose ball pickup / GK save: take sticky possession when in contact
    const maxCatchZ = player.role === 'GK' ? 44 : 26;
    if (!ball.carrier && ball.z <= maxCatchZ && dist <= contactDist && !player.isStumbled && player.kickCooldown <= 0) {
      if (ball.isRestartProtected) return;
      if (ball.pendingPassFrom) {
        if (
          ball.pendingPassFrom !== player &&
          ball.pendingPassFrom.team === player.team
        ) {
          if (ball.pendingPassFrom.stats) {
            ball.pendingPassFrom.stats.passes = (ball.pendingPassFrom.stats.passes || 0) + 1;
          }
          ball.lastPassInfo = {
            passer: ball.pendingPassFrom,
            team: player.team,
            ttl: 6.0,
          };
        } else if (ball.pendingPassFrom.team !== player.team) {
          ball.lastPassInfo = null;
        }
        ball.pendingPassFrom = null;
      } else if (ball.lastPassInfo && ball.lastPassInfo.team !== player.team) {
        ball.lastPassInfo = null;
      }
      const wasShotSave = player.role === 'GK' && !!ball.shotAtGoalTeam;
      ball.shotAtGoalTeam = null;
      ball.carrier = player;
      ball.lastKickedBy = player;
      if (audio) {
        audio.playTap();
        if (wasShotSave && audio.playCrowdCheer) {
          audio.playCrowdCheer(0.8);
        }
      }
    }
  }

  /**
   * Sort entities (players + ball) from back to front (ascending Y) for correct 2.5D occlusion
   */
  static getDepthSortedEntities(players, ball) {
    const list = [...players];
    if (ball) list.push(ball);

    // Sort by ground Y coordinate
    list.sort((a, b) => a.y - b.y);
    return list;
  }
}
