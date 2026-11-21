/**
 * Game Engine & Coordinator
 * Manages the 60fps requestAnimationFrame game loop, state, entities, scoring, and UI synchronization.
 */
import { PITCH, PHYSICS, TEAMS } from './constants.js';
import { Camera } from './camera.js';
import { Pitch } from './pitch.js';
import { Ball } from './ball.js';
import { Player } from './player.js';
import { PhysicsSystem } from './physics.js';
import { InputManager } from './input.js';
import { AudioManager } from './audio.js';

export class GameEngine {
  constructor(canvas, uiHooks = {}, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.uiHooks = uiHooks;

    // Audio & Components
    const isSilent = !!(options.isSilent || options.isMenuIdle);
    const silentAudio = {
      playKick() {},
      playPass() {},
      playShoot() {},
      playPostClank() {},
      playTackle() {},
      playTap() {},
      playWhistle() {},
      playFullTimeWhistle() {},
      playGoalChime() {},
      playClick() {},
      startCrowdAmbience() {},
      stopCrowdAmbience() {},
      swellCrowd() {},
      updateCrowdExcitement() {},
      setCrowdPaused() {},
      playGoalCelebration() {},
      playCrowdCheer() {},
      playCrowdMiss() {},
      playFinalWhistleCrowd() {},
    };
    this.audio = isSilent ? silentAudio : (options.audio || new AudioManager());
    this.isMenuIdle = !!options.isMenuIdle;
    this.isLocalMultiplayer = !!options.isLocalMultiplayer;
    this.isTournamentFinal = !!options.isTournamentFinal;
    this.camera = new Camera(canvas);
    this.pitch = new Pitch();
    this.ball = new Ball();
    this.input = new InputManager(canvas, this.isLocalMultiplayer);

    // Team Setup
    this.homeTeam = Object.assign({}, options.homeTeam || TEAMS.waves, {
      direction: 1,
      targetGoalX: PITCH.WIDTH / 2,
      ownGoalX: -PITCH.WIDTH / 2,
    });

    this.awayTeam = Object.assign({}, options.awayTeam || TEAMS.strikers, {
      direction: -1,
      targetGoalX: -PITCH.WIDTH / 2,
      ownGoalX: PITCH.WIDTH / 2,
    });
    const loadLogoImage = (src) => {
      if (!src || typeof Image === 'undefined') return null;
      const img = new Image();
      img.src = src;
      return img;
    };
    this.homeLogoImg = loadLogoImage(this.homeTeam.logo);
    this.awayLogoImg = loadLogoImage(this.awayTeam.logo);
    if (this.pitch.setTeamColors) {
      this.pitch.setTeamColors(this.homeTeam, this.awayTeam);
    }

    // Match Rules
    this.isKnockout = !!options.isKnockout;
    this.difficulty = this.isLocalMultiplayer ? 'normal' : (options.difficulty || 'normal');
    this.isGoldenGoal = false;
    this.goldenGoalBannerTimer = 0;

    // Match State
    this.score = { blue: 0, red: 0 };
    this.matchDuration = options.duration || 180;
    this.halfDuration = this.matchDuration / 2;
    this.matchTime = this.matchDuration;
    this.currentHalf = 1;
    this.hasHadHalfTime = false;
    this.isHalfTime = false;
    this.isPaused = false;
    this.isFullTime = false;
    this.touchHudActive = false;
    this.possessionTime = { blue: 0, red: 0 };

    // Presentation States
    this.isKickoff = true;
    this.kickoffTimer = 1.8; // 1.8s pre-kickoff ready countdown
    this.kickoffTeam = 'blue';
    this.restartProtection = null;
    this.goalCelebrationTimer = 0;
    this.scoringTeam = null;
    this.lastScorer = null;
    this.lastAssister = null;

    // Shooting & Passing Power Bar State (P1 + P2)
    this.shotCharge = 0;
    this.isChargingShot = false;
    this.passCharge = 0;
    this.isChargingPass = false;
    this.p2ShotCharge = 0;
    this.p2IsChargingShot = false;
    this.p2PassCharge = 0;
    this.p2IsChargingPass = false;

    // Initialize 6 players (3v3)
    this.players = [];
    this.setupPlayers();
    this.applyKickoffSetup(true);

    // Resize handler
    this.resize = this.resize.bind(this);
    window.addEventListener('resize', this.resize);
    this.resize();

    // Game loop timing
    this.lastTime = performance.now();
    this.isRunning = false;
    this.loop = this.loop.bind(this);
  }

  setupPlayers() {
    const homeRoster = this.homeTeam.roster || {
      gk: { name: 'Casillas', number: 1 },
      df: { name: 'Maldini', number: 4 },
      fw: { name: 'Messi', number: 10 }
    };

    const awayRoster = this.awayTeam.roster || {
      gk: { name: 'Buffon', number: 1 },
      df: { name: 'Nesta', number: 3 },
      fw: { name: 'Ronaldo', number: 9 }
    };

    this.players = [
      // --- HOME TEAM (Blue slot, left to right attacking) ---
      new Player({
        id: 'home_gk',
        name: homeRoster.gk.name,
        number: homeRoster.gk.number,
        team: 'blue',
        teamConfig: this.homeTeam,
        role: 'GK',
        x: -PITCH.WIDTH / 2 + 55,
        y: 0,
        isControlled: false,
      }),
      new Player({
        id: 'home_df',
        name: homeRoster.df.name,
        number: homeRoster.df.number,
        team: 'blue',
        teamConfig: this.homeTeam,
        role: 'DF',
        x: -260,
        y: 110,
        isControlled: false,
      }),
      new Player({
        id: 'home_fw',
        name: homeRoster.fw.name,
        number: homeRoster.fw.number,
        team: 'blue',
        teamConfig: this.homeTeam,
        role: 'FW',
        x: -90,
        y: -40,
        isControlled: true, // User starts controlling Home FW
      }),

      // --- AWAY TEAM (Red slot, right to left attacking) ---
      new Player({
        id: 'away_gk',
        name: awayRoster.gk.name,
        number: awayRoster.gk.number,
        team: 'red',
        teamConfig: this.awayTeam,
        role: 'GK',
        difficulty: this.difficulty,
        x: PITCH.WIDTH / 2 - 55,
        y: 0,
        isControlled: false,
      }),
      new Player({
        id: 'away_df',
        name: awayRoster.df.name,
        number: awayRoster.df.number,
        team: 'red',
        teamConfig: this.awayTeam,
        role: 'DF',
        difficulty: this.difficulty,
        x: 260,
        y: -110,
        isControlled: false,
      }),
      new Player({
        id: 'away_fw',
        name: awayRoster.fw.name,
        number: awayRoster.fw.number,
        team: 'red',
        teamConfig: this.awayTeam,
        role: 'FW',
        difficulty: this.difficulty,
        x: 90,
        y: 40,
        isControlled: this.isLocalMultiplayer,
        controlledBy: this.isLocalMultiplayer ? 'p2' : null,
      }),
    ];
  }

  setDifficulty(difficulty) {
    this.difficulty = this.isLocalMultiplayer ? 'normal' : (difficulty || 'normal');
    this.players.forEach((p) => {
      if (p.team === 'red') {
        p.difficulty = this.difficulty;
      }
    });
  }

  setControlledForSlot(slot, targetPlayer, notify = true) {
    if (!targetPlayer) return;
    const team = slot === 'p2' ? 'red' : 'blue';
    this.players.forEach((p) => {
      if (p.team === team) {
        const active = (p === targetPlayer);
        p.isControlled = active;
        p.controlledBy = active ? slot : null;
      }
    });
    if (notify && this.uiHooks.onControlledPlayerChanged) {
      this.uiHooks.onControlledPlayerChanged(targetPlayer, slot);
    }
  }

  getControlledPlayer(slot = 'p1') {
    if (slot === 'p2') {
      if (!this.isLocalMultiplayer) return null;
      return (
        this.players.find((p) => p.controlledBy === 'p2') ||
        this.players.find((p) => p.team === 'red' && p.role === 'FW') ||
        null
      );
    }
    return (
      this.players.find((p) => p.controlledBy === 'p1') ||
      this.players.find((p) => p.team === 'blue' && p.isControlled) ||
      this.players[2]
    );
  }

  switchControlledPlayer(slot = 'p1') {
    const team = slot === 'p2' ? 'red' : 'blue';
    const outfield = this.players.filter((p) => p.team === team && p.role !== 'GK');
    if (outfield.length === 0) return;
    const currentIdx = outfield.findIndex((p) => p.controlledBy === slot || (slot === 'p1' && p.isControlled));
    const nextIdx = (currentIdx + 1) % outfield.length;
    this.setControlledForSlot(slot, outfield[nextIdx], true);
  }

  clearRestartProtection() {
    this.restartProtection = null;
    this.ball.isRestartProtected = false;
  }

  activateKickoffProtection(taker = null) {
    const kickoffTaker = taker || this.players.find((p) => p.team === this.kickoffTeam && p.role === 'FW');
    if (kickoffTaker && !kickoffTaker.isControlled) {
      kickoffTaker.aiRestartTimer = 0.35;
    }
    this.restartProtection = {
      type: 'KICKOFF',
      team: this.kickoffTeam,
      taker: kickoffTaker || null,
      timer: 2.0,
      centerRadius: PITCH.CENTER_CIRCLE_RADIUS + 14,
    };
    this.ball.isRestartProtected = true;
  }

  applyKickoffSetup(isInitial = false) {
    const isBlueKickoff = this.kickoffTeam === 'blue';
    const kickoffTaker = this.players.find((p) => p.team === this.kickoffTeam && p.role === 'FW');
    const defendingFw = this.players.find((p) => p.team !== this.kickoffTeam && p.role === 'FW');

    if (defendingFw) {
      const minCenterX = PITCH.CENTER_CIRCLE_RADIUS + 26;
      defendingFw.x = isBlueKickoff ? minCenterX : -minCenterX;
      defendingFw.y = 0;
      defendingFw.vx = 0;
      defendingFw.vy = 0;
    }

    if (kickoffTaker) {
      kickoffTaker.x = isBlueKickoff ? -16 : 16;
      kickoffTaker.y = 0;
      kickoffTaker.vx = 0;
      kickoffTaker.vy = 0;
      kickoffTaker.facingAngle = isBlueKickoff ? 0 : Math.PI;
      this.ball.carrier = kickoffTaker;
    }

    if (!this.isMenuIdle) {
      const blueFw = this.players.find((p) => p.team === 'blue' && p.role === 'FW');
      if (blueFw) {
        this.setControlledForSlot('p1', blueFw, !isInitial);
      }
      if (this.isLocalMultiplayer) {
        const redFw = this.players.find((p) => p.team === 'red' && p.role === 'FW');
        if (redFw) {
          this.setControlledForSlot('p2', redFw, !isInitial);
        }
      }
    }

    if (this.isMenuIdle) {
      this.isKickoff = false;
      this.kickoffTimer = 0;
      this.activateKickoffProtection(kickoffTaker);
      if (kickoffTaker) {
        kickoffTaker.aiRestartTimer = 0.25;
      }
    } else {
      this.ball.isRestartProtected = true;
    }

    return kickoffTaker;
  }

  enforceRestartProtection(dt) {
    const p = this.restartProtection;
    if (!p) return;

    const ballLeftTaker = this.ball.carrier === null || (p.taker && this.ball.carrier !== p.taker);
    const dribbledAway =
      (p.type === 'KICKOFF' && Math.hypot(this.ball.x, this.ball.y) > 85) ||
      (p.type === 'GOAL_KICK' &&
        p.taker &&
        (p.isBlue
          ? p.taker.x > -PITCH.WIDTH / 2 + PITCH.PENALTY_AREA_DEPTH
          : p.taker.x < PITCH.WIDTH / 2 - PITCH.PENALTY_AREA_DEPTH));
    p.timer -= dt;

    if (ballLeftTaker || dribbledAway || p.timer <= 0) {
      this.clearRestartProtection();
      return;
    }

    this.ball.isRestartProtected = true;

    this.players.forEach((op) => {
      if (op.team === p.team) return;

      if (p.type === 'KICKOFF') {
        const d = Math.hypot(op.x, op.y);
        if (d < p.centerRadius) {
          const nx = d > 0.001 ? op.x / d : (p.team === 'blue' ? 1 : -1);
          const ny = d > 0.001 ? op.y / d : 0;
          op.x = nx * p.centerRadius;
          op.y = ny * p.centerRadius;
          const radialVel = op.vx * nx + op.vy * ny;
          if (radialVel < 0) {
            op.vx -= radialVel * nx;
            op.vy -= radialVel * ny;
          }
        }
      } else if (p.type === 'GOAL_KICK') {
        if (p.isBlue && op.x < p.minOpX) {
          op.x = p.minOpX;
          if (op.vx < 0) op.vx = 0;
        } else if (!p.isBlue && op.x > p.minOpX) {
          op.x = p.minOpX;
          if (op.vx > 0) op.vx = 0;
        }
      }
    });
  }

  resetPositions(isNewKickoff = true) {
    this.clearRestartProtection();
    this.ball.reset(0, 0, 0);
    this.players.forEach((p) => p.reset());
    this.lastAssister = null;
    this.isChargingShot = false;
    this.shotCharge = 0;
    this.isChargingPass = false;
    this.passCharge = 0;
    this.p2IsChargingShot = false;
    this.p2ShotCharge = 0;
    this.p2IsChargingPass = false;
    this.p2PassCharge = 0;

    const kickoffTaker = this.applyKickoffSetup(false);
    if (this.isMenuIdle) {
      return;
    }

    if (isNewKickoff) {
      this.isKickoff = true;
      this.kickoffTimer = 1.2;
      this.ball.isRestartProtected = true;
    } else {
      this.activateKickoffProtection(kickoffTaker);
    }
    this.audio.playWhistle();
  }

  getMatchStatsSummary() {
    const shots = { blue: 0, red: 0 };
    const passes = { blue: 0, red: 0 };
    const assists = { blue: 0, red: 0 };
    const tackles = { blue: 0, red: 0 };

    this.players.forEach((p) => {
      if (!p.stats) return;
      if (p.team === 'blue' || p.team === 'red') {
        shots[p.team] += p.stats.shots || 0;
        passes[p.team] += p.stats.passes || 0;
        assists[p.team] += p.stats.assists || 0;
        tackles[p.team] += p.stats.tackles || 0;
      }
    });

    const totalPoss = (this.possessionTime.blue || 0) + (this.possessionTime.red || 0);
    const bluePossPct = totalPoss > 0.2 ? Math.round((this.possessionTime.blue / totalPoss) * 100) : 50;
    const redPossPct = 100 - bluePossPct;

    return {
      shots,
      passes,
      assists,
      tackles,
      possession: { blue: bluePossPct, red: redPossPct },
    };
  }

  startSecondHalf() {
    this.isHalfTime = false;
    this.currentHalf = 2;
    this.kickoffTeam = 'red';
    this.setPaused(false);
    this.resetPositions(true);

    if (this.uiHooks.onTimeUpdated) {
      this.uiHooks.onTimeUpdated(this.matchTime, { half: this.currentHalf, isGoldenGoal: false });
    }
    if (this.uiHooks.onSecondHalfStarted) {
      this.uiHooks.onSecondHalfStarted();
    }
  }

  startGoldenGoalExtraTime() {
    this.isGoldenGoal = true;
    this.hasHadHalfTime = true;
    this.isHalfTime = false;
    this.currentHalf = 3;
    this.goldenGoalBannerTimer = 3.0;
    this.matchTime = 60; // 1 minute of Golden Goal
    this.isFullTime = false;
    this.kickoffTeam = 'blue';
    this.audio.playWhistle();
    this.resetPositions(true);

    if (this.uiHooks.onTimeUpdated) {
      this.uiHooks.onTimeUpdated(this.matchTime, { half: this.currentHalf, isGoldenGoal: true });
    }
    if (this.uiHooks.onGoldenGoalStarted) {
      this.uiHooks.onGoldenGoalStarted();
    }
  }

  handleGoal(scoringTeamId) {
    if (this.isMenuIdle) {
      // Menu background: seamless kickoff reset for conceding team, completely silent
      this.kickoffTeam = scoringTeamId === 'blue' ? 'red' : 'blue';
      this.resetPositions(false);
      return;
    }

    if (this.goalCelebrationTimer > 0 || this.isFullTime) return; // Prevent multiple counts
    this.score[scoringTeamId] += 1;
    this.scoringTeam = scoringTeamId;
    this.kickoffTeam = scoringTeamId === 'blue' ? 'red' : 'blue';
    this.goalCelebrationTimer = 2.8; // 2.8 seconds celebratory replay pause

    // Reset power charging
    this.isChargingShot = false;
    this.shotCharge = 0;
    this.isChargingPass = false;
    this.passCharge = 0;
    this.p2IsChargingShot = false;
    this.p2ShotCharge = 0;
    this.p2IsChargingPass = false;
    this.p2PassCharge = 0;

    // Determine scorer
    let scorer = null;
    if (this.ball.lastKickedBy && this.ball.lastKickedBy.team === scoringTeamId) {
      scorer = this.ball.lastKickedBy;
    } else {
      // Default to that team's striker
      scorer = this.players.find((p) => p.team === scoringTeamId && p.role === 'FW');
    }
    this.lastScorer = scorer;
    if (scorer && scorer.stats) {
      scorer.stats.goals = (scorer.stats.goals || 0) + 1;
    }

    // Determine assister from recent completed pass by teammate
    let assister = null;
    if (
      this.ball.lastPassInfo &&
      this.ball.lastPassInfo.team === scoringTeamId &&
      this.ball.lastPassInfo.passer &&
      this.ball.lastPassInfo.passer !== scorer
    ) {
      assister = this.ball.lastPassInfo.passer;
      if (assister.stats) {
        assister.stats.assists = (assister.stats.assists || 0) + 1;
      }
    }
    this.lastAssister = assister;
    this.ball.lastPassInfo = null;

    this.audio.playGoalChime();
    if (this.audio.playGoalCelebration) {
      this.audio.playGoalCelebration(scoringTeamId);
    }
    this.audio.playWhistle();

    if (this.uiHooks.onScoreChanged) {
      this.uiHooks.onScoreChanged(this.score, scoringTeamId, scorer, assister);
    }
    if (this.uiHooks.onGoal) {
      this.uiHooks.onGoal({
        scoringTeam: scoringTeamId,
        teamInfo: scoringTeamId === 'blue' ? this.homeTeam : this.awayTeam,
        scorer: scorer,
        assister: assister,
        score: Object.assign({}, this.score)
      });
    }

    // If in Golden Goal: this goal wins the match immediately!
    if (this.isGoldenGoal) {
      this.isFullTime = true;
      this.audio.playFullTimeWhistle();
      if (this.audio.playFinalWhistleCrowd) {
        const outcome = (scoringTeamId === 'blue' || this.isLocalMultiplayer) ? 'celebration' : 'disappointment';
        this.audio.playFinalWhistleCrowd(outcome);
      }
      if (this.uiHooks.onMatchEnd) {
        if (this.goldenGoalEndTimeoutId) {
          clearTimeout(this.goldenGoalEndTimeoutId);
        }
        this.goldenGoalEndTimeoutId = setTimeout(() => {
          this.goldenGoalEndTimeoutId = null;
          this.uiHooks.onMatchEnd({
            score: Object.assign({}, this.score),
            homeTeam: this.homeTeam,
            awayTeam: this.awayTeam,
            winner: scoringTeamId,
            isGoldenGoalWin: true,
            scorer: scorer,
            assister: assister,
            players: this.players,
            stats: this.getMatchStatsSummary(),
            mvp: this.calculateMatchMVP(scoringTeamId)
          });
        }, 2800);
      }
    }
  }

  handleGoalKick(defendingTeam, wasMissedShot = false) {
    if (this.goalCelebrationTimer > 0 || this.isFullTime) return;
    this.clearRestartProtection();
    this.isChargingShot = false;
    this.shotCharge = 0;
    this.isChargingPass = false;
    this.passCharge = 0;
    this.p2IsChargingShot = false;
    this.p2ShotCharge = 0;
    this.p2IsChargingPass = false;
    this.p2PassCharge = 0;

    const isBlue = defendingTeam === 'blue';
    const isHumanKick = !this.isMenuIdle && (isBlue || this.isLocalMultiplayer);
    const restartX = isBlue ? -PITCH.WIDTH / 2 + 80 : PITCH.WIDTH / 2 - 80;
    this.ball.reset(restartX, 0, 0);
    if (!this.isMenuIdle) {
      this.audio.playWhistle();
      if (wasMissedShot && this.audio.playCrowdMiss) {
        this.audio.playCrowdMiss();
      }
    }

    // Position defending GK cleanly with the ball to take the goal kick
    const gk = this.players.find((p) => p.team === defendingTeam && p.role === 'GK');
    if (gk) {
      gk.x = restartX + (isBlue ? -18 : 18);
      gk.y = 0;
      gk.vx = 0;
      gk.vy = 0;
      gk.facingAngle = isBlue ? 0 : Math.PI;
      gk.isStumbled = false;
      gk.stumbleTimer = 0;
      gk.kickCooldown = 0;
      gk.isTackling = false;
      gk.tackleTimer = 0;
      gk.possessionTimer = 0;
      gk.aiRestartTimer = isHumanKick ? 0 : (this.isMenuIdle ? 0.2 : 0.48);
      this.ball.carrier = gk;

      // Hand control to P1 (Blue GK) or P2 (Red GK in 2P mode) on their goal kick!
      if (isHumanKick) {
        this.setControlledForSlot(isBlue ? 'p1' : 'p2', gk, true);
      }
    }

    // Give teammates open lanes outside the 6-yard box and force opponents outside the penalty box
    const minMateX = isBlue ? -PITCH.WIDTH / 2 + 205 : PITCH.WIDTH / 2 - 205;
    const minOpX = isBlue
      ? -PITCH.WIDTH / 2 + PITCH.PENALTY_AREA_DEPTH + 45
      : PITCH.WIDTH / 2 - PITCH.PENALTY_AREA_DEPTH - 45;

    this.players.forEach((p) => {
      if (p.role === 'GK') return;
      p.isTackling = false;
      p.tackleTimer = 0;
      p.vx = 0;
      p.vy = 0;

      if (p.team === defendingTeam) {
        if ((isBlue && p.x < minMateX) || (!isBlue && p.x > minMateX)) {
          p.x = minMateX;
        }
      } else {
        if ((isBlue && p.x < minOpX) || (!isBlue && p.x > minOpX)) {
          p.x = minOpX;
        }
      }
    });

    this.restartProtection = {
      type: 'GOAL_KICK',
      team: defendingTeam,
      taker: gk || null,
      timer: this.isMenuIdle ? 0.9 : (isHumanKick ? 4.0 : 1.8),
      minOpX,
      isBlue,
    };
    this.ball.isRestartProtected = true;
  }

  calculateMatchMVP(winnerKey) {
    if (!this.players || this.players.length === 0) return null;

    let bestPlayer = null;
    let highestScoreWeight = -999999;

    this.players.forEach((p) => {
      const isWinner = winnerKey ? p.team === winnerKey : false;
      const goals = p.stats ? p.stats.goals || 0 : 0;
      const assists = p.stats ? p.stats.assists || 0 : 0;
      const tackles = p.stats ? p.stats.tackles || 0 : 0;
      const passes = p.stats ? p.stats.passes || 0 : 0;
      const shots = p.stats ? p.stats.shots || 0 : 0;

      // Base rating
      let rating = 6.2;
      // High-impact goals (+1.5 per goal) & assists (+1.1 per assist)
      rating += goals * 1.5;
      rating += assists * 1.1;
      // High-impact tackles won (+0.8 per tackle)
      rating += tackles * 0.8;
      // Passes completed (+0.12 per pass)
      rating += passes * 0.12;
      // Shots (+0.1 per shot)
      rating += shots * 0.1;

      // Clean sheet defense bonus
      const oppTeam = p.team === 'blue' ? 'red' : 'blue';
      if (this.score[oppTeam] === 0) {
        if (p.role === 'GK') rating += 1.4;
        if (p.role === 'DF') rating += 0.8;
      }

      // Winner team bonus
      if (isWinner) rating += 0.6;

      // Human user controlled subtle pride boost if contributed
      if (p.isControlled && (goals > 0 || assists > 0 || tackles > 0)) {
        rating += 0.2;
      }

      // Clamp rating between 6.0 and 10.0 with 1 decimal place
      rating = Math.min(10.0, Math.max(6.0, Math.round(rating * 10) / 10));
      p.rating = rating;

      // Selection weight prioritizing: Goals, Assists, Tackles, Rating, Winner
      const weight = (goals * 200) + (assists * 130) + (tackles * 90) + (rating * 20) + (passes * 5) + (isWinner ? 25 : 0);
      if (weight > highestScoreWeight) {
        highestScoreWeight = weight;
        bestPlayer = p;
      }
    });

    const chosen = bestPlayer || this.players[0];

    // Generate narrative summary based on actual goals, assists & tackles
    let narrative = '';
    const g = chosen.stats ? chosen.stats.goals || 0 : 0;
    const a = chosen.stats ? chosen.stats.assists || 0 : 0;
    const t = chosen.stats ? chosen.stats.tackles || 0 : 0;
    const p = chosen.stats ? chosen.stats.passes || 0 : 0;

    if (g >= 1 && a >= 1) {
      narrative = `Complete attacking maestro: contributed ${g} goal${g > 1 ? 's' : ''} and ${a} assist${a > 1 ? 's' : ''} in a standout display!`;
    } else if (g >= 2 && t >= 2) {
      narrative = `Sensational all-round masterclass: bagged ${g} goals and executed ${t} clutch tackles!`;
    } else if (g >= 2) {
      narrative = `Lethal finishing display with ${g} match-defining goals to lead the attack.`;
    } else if (a >= 2) {
      narrative = `Visionary playmaker: unlocked the defense with ${a} decisive assists and ${p} passes!`;
    } else if (g === 1 && t >= 2) {
      narrative = `Decisive matchwinner: scored the crucial goal while winning ${t} vital tackles.`;
    } else if (g === 1) {
      narrative = `Clinched the breakthrough goal with dynamic forward pressure and ${p} passes.`;
    } else if (a === 1) {
      narrative = `Engineered the breakthrough with 1 key assist, ${p} passes, and sharp off-ball vision.`;
    } else if (t >= 3) {
      narrative = `Defensive colossus: shut down opponents with ${t} bone-crunching tackles!`;
    } else if (t >= 1) {
      narrative = `Commanded the pitch with ${t} timely defensive interventions and sharp ball distribution.`;
    } else {
      narrative = `Controlled the midfield tempo with disciplined movement and ${p} accurate passes.`;
    }

    return {
      player: chosen,
      name: chosen.name,
      number: chosen.number,
      role: chosen.role,
      team: chosen.team,
      teamConfig: chosen.teamConfig,
      rating: chosen.rating,
      stats: Object.assign({}, chosen.stats),
      narrative: narrative
    };
  }

  resize() {
    if (!this.canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.parentElement ? this.canvas.parentElement.getBoundingClientRect() : { width: window.innerWidth, height: window.innerHeight };

    const w = Math.floor(rect.width || window.innerWidth);
    const h = Math.floor(rect.height || window.innerHeight);

    this.camera.setViewportSize(w, h);

    const targetPxW = Math.floor(w * dpr);
    const targetPxH = Math.floor(h * dpr);

    if (this.canvas.width !== targetPxW || this.canvas.height !== targetPxH) {
      this.canvas.width = targetPxW;
      this.canvas.height = targetPxH;
      this.canvas.style.width = `${w}px`;
      this.canvas.style.height = `${h}px`;
    }
  }

  setPaused(paused) {
    this.isPaused = !!paused;
    if (this.isPaused) {
      this.isChargingShot = false;
      this.shotCharge = 0;
      this.isChargingPass = false;
      this.passCharge = 0;
      this.p2IsChargingShot = false;
      this.p2ShotCharge = 0;
      this.p2IsChargingPass = false;
      this.p2PassCharge = 0;
      if (this.input && this.input.clearActiveInputs) {
        this.input.clearActiveInputs();
      }
    } else {
      this.lastTime = performance.now();
    }
  }

  setTouchHudActive(active) {
    this.touchHudActive = !!active;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this.loop);
  }

  stop() {
    this.isRunning = false;
    if (this.goldenGoalEndTimeoutId) {
      clearTimeout(this.goldenGoalEndTimeoutId);
      this.goldenGoalEndTimeoutId = null;
    }
    window.removeEventListener('resize', this.resize);
    if (this.input && this.input.destroy) {
      this.input.destroy();
    }
  }

  loop(currentTime) {
    if (!this.isRunning) return;

    let dt = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    // Clamp dt to avoid huge simulation jumps when tab is in background
    if (dt > 0.1) dt = 0.1;

    if (!this.isPaused) {
      this.update(dt);
    }
    this.render();

    requestAnimationFrame(this.loop);
  }

  update(dt) {
    // 0. Kick-off countdown
    if (this.isKickoff) {
      this.ball.isRestartProtected = true;
      this.kickoffTimer -= dt;
      if (this.kickoffTimer <= 0) {
        this.isKickoff = false;
        this.activateKickoffProtection();
        this.audio.playWhistle();
      }
    }

    if (this.goldenGoalBannerTimer > 0) {
      this.goldenGoalBannerTimer -= dt;
    }

    // Check manual utility inputs
    if (this.input.consumeSwitch('p1')) {
      this.switchControlledPlayer('p1');
    }
    if (this.isLocalMultiplayer && this.input.consumeSwitch('p2')) {
      this.switchControlledPlayer('p2');
    }
    if (this.input.consumeReset()) {
      this.resetPositions(true);
    }
    if (this.input.consumeCameraToggle()) {
      const mode = this.camera.toggleMode();
      if (this.uiHooks.onCameraModeChanged) {
        this.uiHooks.onCameraModeChanged(mode);
      }
    }

    const controlled = this.getControlledPlayer('p1');
    const controlledP2 = this.isLocalMultiplayer ? this.getControlledPlayer('p2') : null;
    const moveDir = (!this.isKickoff && !this.isFullTime && !this.isMenuIdle)
      ? this.input.getMovementVector('p1')
      : { x: 0, y: 0 };
    const moveDirP2 = (!this.isKickoff && !this.isFullTime && !this.isMenuIdle && this.isLocalMultiplayer)
      ? this.input.getMovementVector('p2')
      : { x: 0, y: 0 };

    if (!this.isKickoff && !this.isFullTime && !this.isMenuIdle) {
      if (controlled) {
        this.processHumanPlayerActions(controlled, 'p1', moveDir, dt);
      }
      if (controlledP2) {
        this.processHumanPlayerActions(controlledP2, 'p2', moveDirP2, dt);
      }
    }

    // Track live possession share across open play (carried ball + in-flight passes/kicks)
    if (!this.isKickoff && !this.isFullTime && !this.isHalfTime && !this.isMenuIdle && this.goalCelebrationTimer <= 0) {
      const activeTeam =
        this.ball.carrier?.team ||
        (!this.ball.isRestartProtected ? this.ball.lastKickedBy?.team : null);
      if (activeTeam === 'blue' || activeTeam === 'red') {
        this.possessionTime[activeTeam] += dt;
      }
    }

    // Goal celebration cooldown
    if (this.goalCelebrationTimer > 0) {
      this.goalCelebrationTimer -= dt;
      if (this.goalCelebrationTimer <= 0 && !this.isFullTime) {
        this.resetPositions(true);
      }
    } else if (!this.isFullTime && !this.isHalfTime && !this.isMenuIdle) {
      // Match clock ticking
      this.matchTime = Math.max(0, this.matchTime - dt);

      // Check Half Time at 50% match duration
      if (!this.hasHadHalfTime && !this.isGoldenGoal && this.currentHalf === 1 && this.matchTime <= this.halfDuration) {
        this.matchTime = this.halfDuration;
        this.hasHadHalfTime = true;
        this.isHalfTime = true;
        this.setPaused(true);
        this.audio.playWhistle();
        if (this.uiHooks.onTimeUpdated) {
          this.uiHooks.onTimeUpdated(this.matchTime, { half: this.currentHalf, isGoldenGoal: false });
        }
        if (this.uiHooks.onHalfTime) {
          this.uiHooks.onHalfTime({
            score: Object.assign({}, this.score),
            homeTeam: this.homeTeam,
            awayTeam: this.awayTeam,
            matchTime: this.matchTime,
            stats: this.getMatchStatsSummary(),
          });
        }
        return;
      }

      if (this.uiHooks.onTimeUpdated) {
        this.uiHooks.onTimeUpdated(this.matchTime, { half: this.currentHalf, isGoldenGoal: this.isGoldenGoal });
      }

      // Check Full Time (when clock reaches 00:00)
      if (this.matchTime <= 0) {
        if (this.score.blue === this.score.red) {
          // --- MATCH IS TIED ---
          if (this.isKnockout) {
            if (!this.isGoldenGoal) {
              // 1. Enter Golden Goal Extra Time!
              this.startGoldenGoalExtraTime();
              return;
            } else {
              // 2. Still tied after Golden Goal! Settle via Penalty Shootout!
              this.isFullTime = true;
              this.audio.playFullTimeWhistle();

              const diff = (this.homeTeam.rating || 90) - (this.awayTeam.rating || 90);
              const pHome = Math.random() + (diff * 0.05) > 0.48 ? 5 : 4;
              const pAway = pHome === 5 ? 4 : 5;
              const winnerKey = pHome > pAway ? 'blue' : 'red';
              if (this.audio.playFinalWhistleCrowd) {
                const outcome = (winnerKey === 'blue' || this.isLocalMultiplayer) ? 'celebration' : 'disappointment';
                this.audio.playFinalWhistleCrowd(outcome);
              }

              if (this.uiHooks.onMatchEnd) {
                this.uiHooks.onMatchEnd({
                  score: Object.assign({}, this.score),
                  homeTeam: this.homeTeam,
                  awayTeam: this.awayTeam,
                  winner: winnerKey,
                  isPenaltyShootout: true,
                  penalties: { home: pHome, away: pAway },
                  players: this.players,
                  stats: this.getMatchStatsSummary(),
                  mvp: this.calculateMatchMVP(winnerKey)
                });
              }
            }
          } else {
            // Quick Match: Genuine Fair Draw!
            this.isFullTime = true;
            this.audio.playFullTimeWhistle();
            if (this.audio.playFinalWhistleCrowd) {
              this.audio.playFinalWhistleCrowd('draw');
            }

            if (this.uiHooks.onMatchEnd) {
              this.uiHooks.onMatchEnd({
                score: Object.assign({}, this.score),
                homeTeam: this.homeTeam,
                awayTeam: this.awayTeam,
                winner: null,
                isDraw: true,
                players: this.players,
                stats: this.getMatchStatsSummary(),
                mvp: this.calculateMatchMVP(null)
              });
            }
          }
        } else {
          // Decisive winner
          this.isFullTime = true;
          this.audio.playFullTimeWhistle();

          let winner = this.score.blue > this.score.red ? 'blue' : 'red';
          if (this.audio.playFinalWhistleCrowd) {
            const outcome = (winner === 'blue' || this.isLocalMultiplayer) ? 'celebration' : 'disappointment';
            this.audio.playFinalWhistleCrowd(outcome);
          }
          if (this.uiHooks.onMatchEnd) {
            this.uiHooks.onMatchEnd({
              score: Object.assign({}, this.score),
              homeTeam: this.homeTeam,
              awayTeam: this.awayTeam,
              winner: winner,
              isDraw: false,
              players: this.players,
              stats: this.getMatchStatsSummary(),
              mvp: this.calculateMatchMVP(winner)
            });
          }
        }
      }
    }

    // 1. Update pitch flags & dynamic stadium crowd excitement
    const liveDangerNorm = (!this.isMenuIdle && !this.isKickoff)
      ? Math.max(
          Math.max(0, Math.min(1, (Math.abs(this.ball.x) - 180) / (PITCH.WIDTH / 2 - 210))),
          this.ball.shotAtGoalTeam ? 0.85 : 0
        )
      : 0;
    this.pitch.update(dt, {
      dangerNorm: liveDangerNorm,
      isGoalCelebration: this.goalCelebrationTimer > 0,
      scoringTeam: this.scoringTeam,
      isTournamentFinal: this.isTournamentFinal,
    });

    // 2. Update all 6 players (frozen during kickoff countdown)
    const effectiveMoveP1 = this.isKickoff ? { x: 0, y: 0 } : moveDir;
    const effectiveMoveP2 = this.isKickoff ? { x: 0, y: 0 } : moveDirP2;
    this.players.forEach((player) => {
      let playerInput = null;
      if (!this.isMenuIdle) {
        if (player.controlledBy === 'p1' || (!this.isLocalMultiplayer && player.isControlled)) {
          playerInput = effectiveMoveP1;
        } else if (this.isLocalMultiplayer && player.controlledBy === 'p2') {
          playerInput = effectiveMoveP2;
        }
      }
      player.update(
        dt,
        playerInput,
        this.isKickoff ? null : this.ball,
        this.players
      );
    });

    // Enforce restart exclusion & possession protection before ball & collision resolution
    if (!this.isKickoff && this.restartProtection) {
      this.enforceRestartProtection(dt);
    }

    // 3. Update football
    if (!this.isKickoff) {
      this.ball.update(
        dt,
        (scoringTeam) => this.handleGoal(scoringTeam),
        (defendingTeam, wasMissedShot) => this.handleGoalKick(defendingTeam, wasMissedShot),
        this.audio
      );

      // 4. Resolve physics & collisions
      PhysicsSystem.resolveCollisions(this.players, this.ball, this.audio);
    }

    // 5. Update 2.5D camera smoothly tracking action (frames both P1 & P2 in Local 2P)
    this.camera.update(controlled, this.ball, dt, controlledP2);

    // 6. Auto-Switch to closest teammate / GK on incoming shots
    if (!this.isKickoff && !this.isFullTime && !this.isMenuIdle) {
      this.checkAutoSwitch();
    }

    // 7. Dynamic stadium crowd excitement & occasional chants
    if (!this.isMenuIdle && !this.isFullTime && !this.isHalfTime && this.audio.updateCrowdExcitement) {
      let dangerNorm = 0;
      if (!this.isKickoff) {
        const goalProx = Math.max(0, Math.min(1, (Math.abs(this.ball.x) - 180) / (PITCH.WIDTH / 2 - 210)));
        dangerNorm = this.ball.shotAtGoalTeam ? Math.max(goalProx, 0.85) : goalProx;
      }
      this.audio.updateCrowdExcitement(dangerNorm, dt);
    }
  }

  processHumanPlayerActions(player, slot, moveDir, dt) {
    const isP2 = slot === 'p2';
    const hasBall = (this.ball.carrier === player);
    const distToBall = Math.hypot(this.ball.x - player.x, this.ball.y - player.y);
    const canOneTouchShoot =
      !this.ball.carrier &&
      !this.ball.isRestartProtected &&
      distToBall <= player.radius + this.ball.radius + 20 &&
      this.ball.z <= PHYSICS.PLAYER_HEIGHT + 10;
    const canShoot = hasBall || canOneTouchShoot;

    const getShotCharging = () => (isP2 ? this.p2IsChargingShot : this.isChargingShot);
    const setShotCharging = (v) => {
      if (isP2) this.p2IsChargingShot = v;
      else this.isChargingShot = v;
    };
    const getShotCharge = () => (isP2 ? this.p2ShotCharge : this.shotCharge);
    const setShotCharge = (v) => {
      if (isP2) this.p2ShotCharge = v;
      else this.shotCharge = v;
    };

    const getPassCharging = () => (isP2 ? this.p2IsChargingPass : this.isChargingPass);
    const setPassCharging = (v) => {
      if (isP2) this.p2IsChargingPass = v;
      else this.isChargingPass = v;
    };
    const getPassCharge = () => (isP2 ? this.p2PassCharge : this.passCharge);
    const setPassCharge = (v) => {
      if (isP2) this.p2PassCharge = v;
      else this.passCharge = v;
    };

    // --- HYBRID TAP-TO-SHOOT + OPTIONAL HOLD POWER GAUGE / TACKLE ---
    if (canShoot) {
      if (this.input.isKickHeld(slot)) {
        if (!getShotCharging()) {
          setShotCharging(true);
          setShotCharge(0.60); // Fast baseline charge so quick taps always fire powerfully
        } else {
          setShotCharge(Math.min(1.0, getShotCharge() + dt * 1.65));
        }
        this.input.consumeKick(slot);
      } else if (getShotCharging() || this.input.consumeKick(slot)) {
        const effectiveCharge = getShotCharging() ? Math.max(0.60, getShotCharge()) : 0.64;
        const shotDir = this.computeAssistedShotDirection(player, moveDir);

        const minPower = 440;
        const maxPower = 710;
        const power = minPower + effectiveCharge * (maxPower - minPower);
        const height = 110 + effectiveCharge * 75;

        const success = player.performKick(
          this.ball,
          shotDir.x,
          shotDir.y,
          power,
          height,
          shotDir.isAssisted ? true : null,
          shotDir.curveSpin || 0
        );
        if (success) {
          this.audio.playShoot(effectiveCharge);
        }
        setShotCharging(false);
        setShotCharge(0);
      }
    } else {
      setShotCharging(false);
      setShotCharge(0);
      if (this.input.consumeKick(slot)) {
        const success = player.performTackle(this.ball, this.players, this.audio);
        if (!success) {
          this.audio.playTackle();
        }
      }
    }

    // --- SNAPPY PASSING ---
    if (hasBall) {
      if (this.input.isPassHeld(slot)) {
        setPassCharging(true);
        setPassCharge(Math.min(1.0, Math.max(0.45, getPassCharge()) + dt * 2.4));
        this.input.consumePass(slot);
      } else if (getPassCharging() || this.input.consumePass(slot)) {
        const effectivePassCharge = getPassCharging() ? Math.max(0.45, getPassCharge()) : 0.52;
        const minPass = 290;
        const maxPass = 540;
        const power = minPass + effectivePassCharge * (maxPass - minPass);

        const passTarget = player.findBestPassTarget(this.players, moveDir);
        if (passTarget) {
          const passed = player.performPass(this.ball, passTarget, power);
          if (passed) {
            this.audio.playPass();
            if (passTarget.role !== 'GK') {
              this.setControlledForSlot(slot, passTarget, true);
            }
          }
        }
        setPassCharging(false);
        setPassCharge(0);
      }
    } else {
      setPassCharging(false);
      setPassCharge(0);
    }
  }

  isIncomingShotToGoal(team) {
    if (this.ball.carrier) return false;
    if (this.ball.shotAtGoalTeam === team) return true;
    const isBlue = team === 'blue';
    const oppTeam = isBlue ? 'red' : 'blue';
    const goalX = isBlue ? -PITCH.WIDTH / 2 : PITCH.WIDTH / 2;
    const movingTowardGoal = isBlue ? (this.ball.vx < -160 && this.ball.x < -80) : (this.ball.vx > 160 && this.ball.x > 80);
    if (movingTowardGoal && this.ball.lastKickedBy?.team === oppTeam) {
      const t = (goalX - this.ball.x) / this.ball.vx;
      if (t > 0) {
        const projY = this.ball.y + this.ball.vy * t;
        if (Math.abs(projY) <= PITCH.GOAL_WIDTH * 1.15) {
          return true;
        }
      }
    }
    return false;
  }

  isIncomingShotToBlueGoal() {
    return this.isIncomingShotToGoal('blue');
  }

  checkTeamAutoSwitch(team, slot) {
    const controlled = this.getControlledPlayer(slot);
    if (!controlled || controlled.isStumbled) return;

    const isBlue = team === 'blue';
    const gk = this.players.find((p) => p.team === team && p.role === 'GK');
    const outfield = this.players.filter((p) => p.team === team && p.role !== 'GK');
    if (outfield.length === 0) return;

    const incomingShot = this.isIncomingShotToGoal(team);

    // 1. Give/keep control of GK on goal kicks, saves, or incoming shots
    if (gk && (this.ball.carrier === gk || incomingShot)) {
      if (controlled !== gk) {
        this.setControlledForSlot(slot, gk, true);
      }
      return;
    }

    // Do NOT auto-switch if actively carrying/dribbling
    if (this.ball.carrier === controlled) return;

    // 2. If another outfield teammate won/intercepted the ball, switch to them
    if (
      this.ball.carrier &&
      this.ball.carrier.team === team &&
      this.ball.carrier.role !== 'GK' &&
      this.ball.carrier !== controlled
    ) {
      this.setControlledForSlot(slot, this.ball.carrier, true);
      return;
    }

    // Closest outfield player to the ball
    let closest = outfield[0];
    let minDist = Math.hypot(closest.x - this.ball.x, closest.y - this.ball.y);
    outfield.forEach((p) => {
      const dist = Math.hypot(p.x - this.ball.x, p.y - this.ball.y);
      if (dist < minDist) {
        minDist = dist;
        closest = p;
      }
    });

    // 3. Return from GK to closest outfield player once threat/clearance resolves
    if (controlled.role === 'GK') {
      const distFromGk = Math.hypot(controlled.x - this.ball.x, controlled.y - this.ball.y);
      const clearedPenaltyBox = isBlue
        ? (this.ball.x > -PITCH.WIDTH / 2 + PITCH.PENALTY_AREA_DEPTH)
        : (this.ball.x < PITCH.WIDTH / 2 - PITCH.PENALTY_AREA_DEPTH);
      if (this.ball.carrier || clearedPenaltyBox || distFromGk > 130) {
        this.setControlledForSlot(slot, closest, true);
      }
      return;
    }

    // 4. Auto-switch when defending or loose ball
    const currentDist = Math.hypot(controlled.x - this.ball.x, controlled.y - this.ball.y);
    if (closest !== controlled && minDist < currentDist - 65) {
      this.setControlledForSlot(slot, closest, true);
    }
  }

  checkAutoSwitch() {
    this.checkTeamAutoSwitch('blue', 'p1');
    if (this.isLocalMultiplayer) {
      this.checkTeamAutoSwitch('red', 'p2');
    }
  }

  renderPassTargetIndicator(ctx, controlled, slot) {
    if (!controlled || this.isKickoff || this.isFullTime) return;
    const distToBall = Math.hypot(this.ball.x - controlled.x, this.ball.y - controlled.y);
    if (distToBall >= controlled.radius + this.ball.radius + 35 || this.ball.z > 35) return;
    const moveDir = this.input.getMovementVector(slot);
    const target = controlled.findBestPassTarget(this.players, moveDir);
    if (!target || target.role === 'GK') return;

    const tPos = this.camera.worldToScreen(target.x, target.y, 0);
    const isP2 = slot === 'p2';
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(
      tPos.x,
      tPos.y,
      (target.radius + 7) * this.camera.zoom,
      (target.radius + 3.5) * this.camera.zoom * 0.72,
      0,
      0,
      Math.PI * 2
    );
    ctx.strokeStyle = isP2 ? 'rgba(34, 211, 238, 0.85)' : 'rgba(45, 212, 191, 0.85)';
    ctx.lineWidth = 1.8 * this.camera.zoom;
    ctx.setLineDash([5, 4]);
    ctx.stroke();

    if (this.camera.zoom > 0.7) {
      ctx.fillStyle = isP2 ? '#22D3EE' : '#2DD4BF';
      ctx.font = `bold ${Math.round(8.5 * this.camera.zoom)}px 'Trebuchet MS', sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(isP2 ? 'PASS [K]' : 'PASS [X]', tPos.x, tPos.y + 15 * this.camera.zoom);
    }
    ctx.restore();
  }

  renderShotAimGuide(ctx, controlled, slot) {
    const isCharging = slot === 'p2' ? this.p2IsChargingShot : this.isChargingShot;
    if (!controlled || !isCharging || this.isKickoff || this.isFullTime) return;
    const moveDir = this.input.getMovementVector(slot);
    const shotDir = this.computeAssistedShotDirection(controlled, moveDir);
    if (!shotDir.isAssisted) return;

    const startPos = this.camera.worldToScreen(this.ball.x, this.ball.y, 0);
    const targetPos = this.camera.worldToScreen(shotDir.targetX, shotDir.targetY, 0);
    const guideLen = 135;
    const curveSpin = shotDir.curveSpin || 0;
    const endX = this.ball.x + (shotDir.straightX ?? shotDir.x) * guideLen;
    const endY = this.ball.y + (shotDir.straightY ?? shotDir.y) * guideLen;
    // Control point bends along initial launch vector so the dotted guide previews the exact curl
    const ctrlX = this.ball.x + shotDir.x * (guideLen * 0.55);
    const ctrlY = this.ball.y + shotDir.y * (guideLen * 0.55);
    const ctrlPos = this.camera.worldToScreen(ctrlX, ctrlY, 0);
    const midPos = this.camera.worldToScreen(endX, endY, 0);
    const rgba0 = slot === 'p2' ? 'rgba(34, 211, 238, 0.85)' : 'rgba(250, 204, 21, 0.85)';
    const rgbaEnd = slot === 'p2' ? 'rgba(34, 211, 238, 0)' : 'rgba(250, 204, 21, 0)';

    ctx.save();
    const grad = ctx.createLinearGradient(startPos.x, startPos.y, midPos.x, midPos.y);
    grad.addColorStop(0, rgba0);
    grad.addColorStop(1, rgbaEnd);
    ctx.strokeStyle = grad;
    ctx.lineWidth = Math.max(2, 2.5 * this.camera.zoom);
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(startPos.x, startPos.y);
    if (Math.abs(curveSpin) > 0.05) {
      ctx.quadraticCurveTo(ctrlPos.x, ctrlPos.y, midPos.x, midPos.y);
    } else {
      ctx.lineTo(midPos.x, midPos.y);
    }
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.strokeStyle = rgba0;
    ctx.lineWidth = Math.max(1.5, 2 * this.camera.zoom);
    ctx.beginPath();
    ctx.arc(targetPos.x, targetPos.y, 7 * this.camera.zoom, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  render() {
    const ctx = this.ctx;
    const width = this.camera.viewportWidth;
    const height = this.camera.viewportHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    ctx.save();
    ctx.scale(dpr, dpr);

    // Clear background with rich stadium atmosphere color
    ctx.fillStyle = '#0B1120';
    ctx.fillRect(0, 0, width, height);

    // 1. Render Football Pitch & Miniature Stadium
    this.pitch.render(ctx, this.camera);

    // Pass Target Indicator on ground for active human player(s)
    const controlled = this.getControlledPlayer('p1');
    const controlledP2 = this.isLocalMultiplayer ? this.getControlledPlayer('p2') : null;
    if (!this.isMenuIdle) {
      this.renderPassTargetIndicator(ctx, controlled, 'p1');
      if (controlledP2) {
        this.renderPassTargetIndicator(ctx, controlledP2, 'p2');
      }
    }

    // 2. Render 2.5D Depth-Sorted Entities (Players & Ball)
    const sortedEntities = PhysicsSystem.getDepthSortedEntities(this.players, this.ball);
    sortedEntities.forEach((entity) => {
      entity.render(ctx, this.camera);
    });

    // 2A. Foreground Stadium Stand & Elevated Floodlight Halos (in front of bottom apron)
    if (this.pitch.renderForeground) {
      this.pitch.renderForeground(ctx, this.camera);
    }

    // 2B. Assisted Shot Aim Preview Line (shown while charging a shot)
    if (!this.isMenuIdle) {
      this.renderShotAimGuide(ctx, controlled, 'p1');
      if (controlledP2) {
        this.renderShotAimGuide(ctx, controlledP2, 'p2');
      }
    }

    // 3. Render Shooting or Passing Power Bar above player's head
    if (!this.isMenuIdle) {
      if (controlled && (this.isChargingShot || this.isChargingPass)) {
        this.renderPlayerPowerBar(ctx, controlled, 'p1');
      }
      if (controlledP2 && (this.p2IsChargingShot || this.p2IsChargingPass)) {
        this.renderPlayerPowerBar(ctx, controlledP2, 'p2');
      }
    }

    // 4. Render Kickoff Countdown Banner
    if (this.isKickoff && !this.isMenuIdle) {
      this.renderKickoffBanner(ctx, width, height);
    }

    // 5. Render Golden Goal Banner
    if (this.goldenGoalBannerTimer > 0 && !this.isMenuIdle) {
      this.renderGoldenGoalBanner(ctx, width, height);
    }

    // 6. Render Goal Celebration Splash (if just scored)
    if (this.goalCelebrationTimer > 0 && !this.isMenuIdle) {
      this.renderGoalBanner(ctx, width, height);
    }

    // 7. Render Mini Tactical Radar (Bottom Right)
    if (!this.isMenuIdle) {
      this.renderMiniRadar(ctx, width, height);
    }

    // 8. Render Virtual Touch Joystick (if active)
    if (!this.isMenuIdle) {
      this.renderTouchJoystick(ctx);
    }

    ctx.restore();
  }

  /**
   * FC Mobile-Style Assisted Shooting:
   * Automatically aims into the opponent's goal from the shooter's standing angle.
   * Up/Down directional input places the shot toward the top/bottom corner;
   * neutral vertical input picks the open corner away from the goalkeeper.
   */
  computeAssistedShotDirection(player, moveDir) {
    const teamConfig = player.teamConfig || (player.team === 'blue' ? this.homeTeam : this.awayTeam);
    const attackDir = teamConfig.direction || 1;
    const goalX = teamConfig.targetGoalX ?? (attackDir === 1 ? PITCH.WIDTH / 2 : -PITCH.WIDTH / 2);

    const hasMoveInput = moveDir && Math.hypot(moveDir.x, moveDir.y) > 0.1;

    // Goalkeeper punt/clearance always drives safely upfield, steered by vertical input
    if (player.role === 'GK') {
      const puntY = hasMoveInput ? moveDir.y * 0.75 : 0;
      const puntLen = Math.hypot(attackDir, puntY) || 1;
      const kx = attackDir / puntLen;
      const ky = puntY / puntLen;
      return {
        x: kx,
        y: ky,
        targetX: player.x + kx * 260,
        targetY: player.y + ky * 260,
        isAssisted: false,
      };
    }

    const inDefensiveHalf = player.x * attackDir < -80;
    const aimingBackwards = hasMoveInput && (moveDir.x * attackDir < -0.35);

    // If deep in own half and explicitly aiming back/away, allow manual directional clearance
    if (inDefensiveHalf && aimingBackwards) {
      const len = Math.hypot(moveDir.x, moveDir.y) || 1;
      return {
        x: moveDir.x / len,
        y: moveDir.y / len,
        targetX: player.x + (moveDir.x / len) * 200,
        targetY: player.y + (moveDir.y / len) * 200,
        isAssisted: false,
      };
    }

    // Safe target range inside the goal posts (halfGoalW = 95, keep inside woodwork)
    const maxCornerY = PITCH.GOAL_WIDTH * 0.5 - 21; // ~74 units inside posts
    let targetY = 0;

    if (hasMoveInput && Math.abs(moveDir.y) > 0.15) {
      // Player steers shot toward top or bottom corner based on vertical input
      targetY = Math.max(-1, Math.min(1, moveDir.y)) * maxCornerY;
    } else {
      // Neutral vertical input: smart placement away from opposing goalkeeper / toward far post
      const oppGk = this.players.find((p) => p.team !== player.team && p.role === 'GK');
      if (oppGk && Math.abs(oppGk.y) > 10) {
        targetY = oppGk.y > 0 ? -maxCornerY * 0.72 : maxCornerY * 0.72;
      } else {
        targetY = player.y >= 0 ? -maxCornerY * 0.68 : maxCornerY * 0.68;
      }
    }

    // Aim directly through the goal-line plane (only project past if already on/over the line)
    const targetX = player.x * attackDir >= goalX * attackDir - 4
      ? player.x + attackDir * 28
      : goalX;

    const dx = targetX - player.x;
    const dy = targetY - player.y;
    const dist = Math.hypot(dx, dy) || 1;
    const straightAngle = Math.atan2(dy, dx);

    // Compute natural Magnus curve spin for angled/wide shots and corner finesse bends
    const absDx = Math.max(95, Math.abs(dx));
    const angleSteepness = Math.min(1.0, Math.abs(dy) / absDx);
    let curveSpin = 0;

    if (angleSteepness > 0.20) {
      // Wide or acute ("weird") angle: whip an in-swinger bending cleanly into the goal mouth!
      const curveSign = -(Math.sign(dy) || 1) * attackDir;
      curveSpin = curveSign * (0.38 + angleSteepness * 0.92);
    } else if (Math.abs(targetY) > 18) {
      // Central finesse shot aimed toward a post: subtle curl away from keeper into corner
      const curveSign = Math.sign(targetY) * attackDir;
      curveSpin = curveSign * 0.48;
    }

    // Offset initial launch angle by half the expected arc turn so the curved flight still lands on target!
    const tFlightEst = Math.min(0.68, dist / 560);
    const estTurn = curveSpin * 0.82 * tFlightEst;
    let launchAngle = straightAngle - 0.5 * estTurn;

    // Guarantee forward launch component toward goal even from extreme near-byline positions
    if (Math.cos(launchAngle) * attackDir < 0.08) {
      launchAngle = Math.atan2(Math.sin(launchAngle), attackDir * 0.08);
    }

    return {
      x: Math.cos(launchAngle),
      y: Math.sin(launchAngle),
      straightX: dx / dist,
      straightY: dy / dist,
      targetX,
      targetY,
      curveSpin,
      isAssisted: true,
    };
  }

  /**
   * EAFC Arcade Style Floating Power Bar
   */
  renderPlayerPowerBar(ctx, player, slot = 'p1') {
    const isP2 = slot === 'p2';
    const isShot = isP2 ? this.p2IsChargingShot : this.isChargingShot;
    const charge = isShot
      ? (isP2 ? this.p2ShotCharge : this.shotCharge)
      : (isP2 ? this.p2PassCharge : this.passCharge);
    const headZ = PHYSICS.PLAYER_HEIGHT + 26;
    const pos = this.camera.worldToScreen(player.x, player.y, headZ);

    const barW = Math.round(44 * this.camera.zoom);
    const barH = Math.max(5, Math.round(6 * this.camera.zoom));
    const bx = Math.round(pos.x - barW / 2);
    const by = Math.round(pos.y - 14 * this.camera.zoom);

    ctx.save();
    // Container background
    ctx.fillStyle = 'rgba(11, 17, 32, 0.9)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(bx - 1, by - 1, barW + 2, barH + 2, 4);
    ctx.fill();
    ctx.stroke();

    // Fill bar with colors
    let fillCol = '#22C55E';
    if (isShot) {
      if (charge > 0.8) fillCol = '#EF4444';
      else if (charge > 0.5) fillCol = '#F97316';
      else if (charge > 0.25) fillCol = '#EAB308';
      else fillCol = '#22C55E';
    } else {
      fillCol = charge > 0.5 ? '#2DD4BF' : '#38BDF8';
    }

    const fillW = Math.max(2, Math.round(barW * charge));
    ctx.fillStyle = fillCol;
    ctx.beginPath();
    ctx.roundRect(bx, by, fillW, barH, 3);
    ctx.fill();

    // Broadcast label above bar
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${Math.round(8 * this.camera.zoom)}px 'Trebuchet MS', sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(isShot ? `PWR ${Math.round(charge * 100)}%` : `PASS ${Math.round(charge * 100)}%`, pos.x, by - 4);

    ctx.restore();
  }

  renderKickoffBanner(ctx, width, height) {
    ctx.save();
    const cx = width / 2;
    const cy = height / 2 - 25;

    ctx.fillStyle = 'rgba(11, 17, 32, 0.84)';
    ctx.fillRect(0, cy - 40, width, 80);

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, cy - 40);
    ctx.lineTo(width, cy - 40);
    ctx.moveTo(0, cy + 40);
    ctx.lineTo(width, cy + 40);
    ctx.stroke();

    const takerTeam = this.kickoffTeam === 'blue' ? this.homeTeam : this.awayTeam;
    const title = this.isGoldenGoal
      ? 'GOLDEN GOAL KICK-OFF'
      : this.currentHalf === 2
        ? '2ND HALF KICK-OFF'
        : 'MATCH KICK-OFF';

    ctx.fillStyle = '#FACC15';
    ctx.font = "800 30px 'Barlow Condensed', 'Trebuchet MS', sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, cx, cy - 9);

    ctx.font = "600 14px 'Plus Jakarta Sans', sans-serif";
    ctx.fillStyle = '#E2E8F0';
    ctx.fillText(`${(takerTeam?.name || 'Home').toUpperCase()} TO KICK OFF`, cx, cy + 19);

    ctx.restore();
  }

  renderGoldenGoalBanner(ctx, width, height) {
    ctx.save();
    const cx = width / 2;
    const cy = height / 2 - 25;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.fillRect(0, cy - 45, width, 90);

    ctx.strokeStyle = '#FACC15';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, cy - 45);
    ctx.lineTo(width, cy - 45);
    ctx.moveTo(0, cy + 45);
    ctx.lineTo(width, cy + 45);
    ctx.stroke();

    ctx.fillStyle = '#FACC15';
    ctx.font = "900 32px 'Trebuchet MS', sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚡ GOLDEN GOAL EXTRA TIME ⚡', cx, cy - 10);

    ctx.font = "800 16px 'Trebuchet MS', sans-serif";
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('NEXT GOAL WINS THE MATCH!', cx, cy + 20);

    ctx.restore();
  }

  renderGoalBanner(ctx, width, height) {
    ctx.save();
    const cx = width / 2;
    const cy = height / 2 - 25;

    const scoringTeamInfo = this.scoringTeam === 'blue' ? this.homeTeam : this.awayTeam;
    const scoringLogoImg = this.scoringTeam === 'blue' ? this.homeLogoImg : this.awayLogoImg;
    const teamColor = scoringTeamInfo.accentColor || scoringTeamInfo.shirtColor || (this.scoringTeam === 'blue' ? '#38BDF8' : '#F87171');
    const teamName = scoringTeamInfo.name.toUpperCase();
    const teamBadge = scoringTeamInfo.badge || '⚽';
    const scorerName = this.lastScorer ? `${this.lastScorer.name.toUpperCase()} (#${this.lastScorer.number})` : 'GOAL!';
    const hasAssist = !!(this.lastAssister && this.lastAssister !== this.lastScorer);

    const cardW = Math.min(width * 0.9, 560);
    const cardH = hasAssist ? 136 : 120;
    const rx = cx - cardW / 2;
    const ry = cy - cardH / 2;

    ctx.fillStyle = 'rgba(11, 17, 32, 0.92)';
    ctx.strokeStyle = teamColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(rx, ry, cardW, cardH, 12);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = teamColor;
    ctx.beginPath();
    ctx.roundRect(rx, ry, cardW, 36, [10, 10, 0, 0]);
    ctx.fill();

    ctx.fillStyle = '#0F172A';
    ctx.font = "900 22px 'Impact', 'Arial Black', sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const hasCrestImg = scoringLogoImg && scoringLogoImg.complete && scoringLogoImg.naturalWidth > 0;
    const bannerTitle = hasCrestImg
      ? (this.isGoldenGoal ? `GOLDEN GOAL! · ${teamName}` : `GOOOAL! · ${teamName}`)
      : (this.isGoldenGoal ? `⚡ GOLDEN GOAL! · ${teamBadge} ${teamName}` : `⚽ GOOOAL! · ${teamBadge} ${teamName}`);

    if (hasCrestImg) {
      const titleW = ctx.measureText(bannerTitle).width;
      const iconSize = 26;
      const gap = 10;
      const totalW = iconSize + gap + titleW;
      const startX = cx - totalW / 2;
      const iconCx = startX + iconSize / 2;
      const iconCy = ry + 18;
      ctx.save();
      ctx.beginPath();
      ctx.arc(iconCx, iconCy, iconSize / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(scoringLogoImg, iconCx - iconSize / 2 - 2, iconCy - iconSize / 2 - 2, iconSize + 4, iconSize + 4);
      ctx.restore();
      ctx.textAlign = 'left';
      ctx.fillText(bannerTitle, startX + iconSize + gap, ry + 18);
      ctx.textAlign = 'center';
    } else {
      ctx.fillText(bannerTitle, cx, ry + 18);
    }

    ctx.fillStyle = '#FACC15';
    ctx.font = "800 26px 'Trebuchet MS', sans-serif";
    ctx.fillText(scorerName, cx, ry + 62);

    if (hasAssist) {
      ctx.fillStyle = '#38BDF8';
      ctx.font = "700 13px 'Trebuchet MS', sans-serif";
      ctx.fillText(`ASSIST: ${this.lastAssister.name.toUpperCase()} (#${this.lastAssister.number})`, cx, ry + 86);
    }

    ctx.font = "700 16px 'Trebuchet MS', sans-serif";
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(
      `${this.homeTeam.shortName || 'BLU'} ${this.score.blue}  -  ${this.score.red} ${this.awayTeam.shortName || 'RED'}`,
      cx,
      ry + (hasAssist ? 112 : 96)
    );

    ctx.restore();
  }

  renderMiniRadar(ctx, width, height) {
    const isTouchOrNarrow = this.touchHudActive || width <= 640;
    let radarW = 140;
    let radarH = 84;
    let pad = 16;
    let rx = width - radarW - pad;
    let ry = height - radarH - pad;

    if (isTouchOrNarrow) {
      if (width >= 540) {
        // Landscape mobile/tablet: tuck neatly at bottom-center between left joystick and right action buttons
        radarW = Math.min(108, Math.floor(width * 0.18));
        radarH = Math.round(radarW * 0.58);
        pad = 8;
        rx = Math.round((width - radarW) / 2);
        ry = height - radarH - pad;
      } else {
        // Narrow portrait mobile: tuck in top-right corner clear of center circle & bottom controls
        radarW = Math.min(96, Math.floor(width * 0.26));
        radarH = Math.round(radarW * 0.58);
        pad = 8;
        rx = width - radarW - pad;
        ry = pad;
      }
    }
    const compact = isTouchOrNarrow;

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(rx, ry, radarW, radarH, 6);
    ctx.fill();
    ctx.stroke();

    const midX = rx + radarW / 2;
    const midY = ry + radarH / 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.beginPath();
    ctx.moveTo(midX, ry + 4);
    ctx.lineTo(midX, ry + radarH - 4);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(midX, midY, compact ? 9 : 12, 0, Math.PI * 2);
    ctx.stroke();

    const toRadar = (wx, wy) => {
      const px = midX + (wx / (PITCH.WIDTH / 2)) * (radarW / 2 - 6);
      const py = midY + (wy / (PITCH.HEIGHT / 2)) * (radarH / 2 - 6);
      return { x: px, y: py };
    };

    this.players.forEach((p) => {
      const pt = toRadar(p.x, p.y);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, p.isControlled ? (compact ? 3.5 : 4) : (compact ? 2.5 : 3), 0, Math.PI * 2);
      ctx.fillStyle = p.team === 'blue' ? (this.homeTeam.accentColor || '#38BDF8') : (this.awayTeam.accentColor || '#F87171');
      ctx.fill();

      if (p.isControlled || p.controlledBy) {
        ctx.strokeStyle = p.controlledBy === 'p2' ? '#22D3EE' : '#FACC15';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    });

    const bPt = toRadar(this.ball.x, this.ball.y);
    ctx.beginPath();
    ctx.arc(bPt.x, bPt.y, compact ? 2.4 : 2.8, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();

    ctx.restore();
  }

  renderTouchJoystick(ctx) {
    if (this.touchHudActive || !this.input.touchJoystick.active) return;
    const tj = this.input.touchJoystick;

    ctx.save();
    ctx.beginPath();
    ctx.arc(tj.startX, tj.startY, 45, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(
      tj.startX + tj.dirX * 35,
      tj.startY + tj.dirY * 35,
      20,
      0,
      Math.PI * 2
    );
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fill();
    ctx.restore();
  }
}
