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
    if (!ball) return;

    const dx = ball.x - player.x;
    const dy = ball.y - player.y;
    const dist = Math.hypot(dx, dy);
    const contactDist = player.radius + ball.radius + 6;

    // 1. If ball is already carried by another player:
    if (ball.carrier && ball.carrier !== player) {
      // Check for opponent tackling / dispossessing
      if (ball.carrier.team !== player.team) {
        const distToCarrier = Math.hypot(player.x - ball.carrier.x, player.y - ball.carrier.y);
        const tacklerSpeed = Math.hypot(player.vx, player.vy);

        // Check facing direction towards carrier
        const toCarrierAngle = Math.atan2(ball.carrier.y - player.y, ball.carrier.x - player.x);
        let angleDiff = Math.abs(player.facingAngle - toCarrierAngle);
        if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;

        // Challenge condition: close distance, active movement, and facing opponent
        if (distToCarrier <= PHYSICS.TACKLE_RANGE && tacklerSpeed > 35 && angleDiff < 1.45) {
          const victim = ball.carrier;
          ball.carrier = null;
          victim.isStumbled = true;
          victim.stumbleTimer = 0.35;
          victim.vx *= 0.25;
          victim.vy *= 0.25;

          // Dislodge ball in tackle direction
          const tackleAngle = Math.atan2(ball.y - player.y, ball.x - player.x);
          ball.vx = Math.cos(tackleAngle) * 180;
          ball.vy = Math.sin(tackleAngle) * 180;
          ball.lastKickedBy = player;

          // If close enough or tackler moving aggressively, tackler wins possession
          if (dist <= player.radius + ball.radius + 8) {
            ball.carrier = player;
          }

          if (player.stats) {
            player.stats.tackles = (player.stats.tackles || 0) + 1;
          }

          if (audio) audio.playTackle();
        }
      }
      return;
    }

    // 2. Loose ball pickup: take sticky possession when in contact
    if (!ball.carrier && ball.z <= 26 && dist <= contactDist) {
      ball.carrier = player;
      ball.lastKickedBy = player;
      if (audio) audio.playTap();
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
