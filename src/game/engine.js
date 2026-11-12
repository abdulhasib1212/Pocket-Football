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
    };
    this.audio = isSilent ? silentAudio : (options.audio || new AudioManager());
    this.isMenuIdle = !!options.isMenuIdle;
    this.camera = new Camera(canvas);
    this.pitch = new Pitch();
    this.ball = new Ball();
    this.input = new InputManager(canvas);

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

    // Match Rules
    this.isKnockout = !!options.isKnockout;
    this.isGoldenGoal = false;
    this.goldenGoalBannerTimer = 0;

    // Match State
    this.score = { blue: 0, red: 0 };
    this.matchDuration = options.duration || 180;
    this.matchTime = this.matchDuration;
    this.isPaused = false;
    this.isFullTime = false;

    // Presentation States
    this.isKickoff = true;
    this.kickoffTimer = 1.8; // 1.8s pre-kickoff ready countdown
    this.goalCelebrationTimer = 0;
    this.scoringTeam = null;
    this.lastScorer = null;

    // Shooting & Passing Power Bar State
    this.shotCharge = 0;
    this.isChargingShot = false;
    this.passCharge = 0;
    this.isChargingPass = false;

    // Initialize 6 players (3v3)
    this.players = [];
    this.setupPlayers();

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
        x: 90,
        y: 40,
        isControlled: false,
      }),
    ];
  }

  getControlledPlayer() {
    return this.players.find((p) => p.isControlled) || this.players[2];
  }

  switchControlledPlayer() {
    // Switch between blue outfield players (DF and FW)
    const blueOutfield = this.players.filter((p) => p.team === 'blue' && p.role !== 'GK');
    const currentIdx = blueOutfield.findIndex((p) => p.isControlled);
    const nextIdx = (currentIdx + 1) % blueOutfield.length;

    this.players.forEach((p) => {
      p.isControlled = false;
    });
    blueOutfield[nextIdx].isControlled = true;

    if (this.uiHooks.onControlledPlayerChanged) {
      this.uiHooks.onControlledPlayerChanged(blueOutfield[nextIdx]);
    }
  }

  resetPositions(isNewKickoff = true) {
    this.ball.reset(0, 0, 0);
    this.players.forEach((p) => p.reset());
    this.isChargingShot = false;
    this.shotCharge = 0;
    this.isChargingPass = false;
    this.passCharge = 0;

    if (this.isMenuIdle) {
      this.isKickoff = false;
      this.kickoffTimer = 0;
      return;
    }

    if (isNewKickoff) {
      this.isKickoff = true;
      this.kickoffTimer = 1.2;
    }
    this.audio.playWhistle();
  }

  startGoldenGoalExtraTime() {
    this.isGoldenGoal = true;
    this.goldenGoalBannerTimer = 3.0;
    this.matchTime = 60; // 1 minute of Golden Goal
    this.isFullTime = false;
    this.audio.playWhistle();
    this.resetPositions(true);

    if (this.uiHooks.onGoldenGoalStarted) {
      this.uiHooks.onGoldenGoalStarted();
    }
  }

  handleGoal(scoringTeamId) {
    if (this.isMenuIdle) {
      // Menu background: seamless ball reset, completely silent, no popups or freezes
      this.ball.reset(0, 0, 0);
      this.players.forEach((p) => p.reset());
      return;
    }

    if (this.goalCelebrationTimer > 0 || this.isFullTime) return; // Prevent multiple counts
    this.score[scoringTeamId] += 1;
    this.scoringTeam = scoringTeamId;
    this.goalCelebrationTimer = 2.8; // 2.8 seconds celebratory replay pause

    // Reset power charging
    this.isChargingShot = false;
    this.shotCharge = 0;
    this.isChargingPass = false;
    this.passCharge = 0;

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

    this.audio.playGoalChime();
    this.audio.playWhistle();

    if (this.uiHooks.onScoreChanged) {
      this.uiHooks.onScoreChanged(this.score, scoringTeamId, scorer);
    }
    if (this.uiHooks.onGoal) {
      this.uiHooks.onGoal({
        scoringTeam: scoringTeamId,
        teamInfo: scoringTeamId === 'blue' ? this.homeTeam : this.awayTeam,
        scorer: scorer,
        score: Object.assign({}, this.score)
      });
    }

    // If in Golden Goal: this goal wins the match immediately!
    if (this.isGoldenGoal) {
      this.isFullTime = true;
      this.audio.playFullTimeWhistle();
      if (this.uiHooks.onMatchEnd) {
        setTimeout(() => {
          this.uiHooks.onMatchEnd({
            score: Object.assign({}, this.score),
            homeTeam: this.homeTeam,
            awayTeam: this.awayTeam,
            winner: scoringTeamId,
            isGoldenGoalWin: true,
            scorer: scorer,
            players: this.players,
            mvp: this.calculateMatchMVP(scoringTeamId)
          });
        }, 2800);
      }
    }
  }

  handleGoalKick(defendingTeam) {
    if (this.goalCelebrationTimer > 0 || this.isFullTime) return;
    const isBlue = defendingTeam === 'blue';
    const restartX = isBlue ? -PITCH.WIDTH / 2 + 100 : PITCH.WIDTH / 2 - 100;
    this.ball.reset(restartX, 0, 0);
    if (!this.isMenuIdle) {
      this.audio.playWhistle();
    }

    // Position defending GK to restart play
    const gk = this.players.find((p) => p.team === defendingTeam && p.role === 'GK');
    if (gk) {
      gk.x = restartX + (isBlue ? -30 : 30);
      gk.y = 0;
      gk.vx = 0;
      gk.vy = 0;
    }
  }

  calculateMatchMVP(winnerKey) {
    if (!this.players || this.players.length === 0) return null;

    let bestPlayer = null;
    let highestScoreWeight = -999999;

    this.players.forEach((p) => {
      const isWinner = winnerKey ? p.team === winnerKey : false;
      const goals = p.stats ? p.stats.goals || 0 : 0;
      const tackles = p.stats ? p.stats.tackles || 0 : 0;
      const passes = p.stats ? p.stats.passes || 0 : 0;
      const shots = p.stats ? p.stats.shots || 0 : 0;

      // Base rating
      let rating = 6.2;
      // High-impact goals (+1.5 per goal)
      rating += goals * 1.5;
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
      if (p.isControlled && (goals > 0 || tackles > 0)) {
        rating += 0.2;
      }

      // Clamp rating between 6.0 and 10.0 with 1 decimal place
      rating = Math.min(10.0, Math.max(6.0, Math.round(rating * 10) / 10));
      p.rating = rating;

      // Selection weight prioritizing: Goals, Tackles, Rating, Winner
      const weight = (goals * 200) + (tackles * 90) + (rating * 20) + (passes * 5) + (isWinner ? 25 : 0);
      if (weight > highestScoreWeight) {
        highestScoreWeight = weight;
        bestPlayer = p;
      }
    });

    const chosen = bestPlayer || this.players[0];

    // Generate narrative summary based on actual goals & tackles
    let narrative = '';
    const g = chosen.stats ? chosen.stats.goals || 0 : 0;
    const t = chosen.stats ? chosen.stats.tackles || 0 : 0;
    const p = chosen.stats ? chosen.stats.passes || 0 : 0;

    if (g >= 2 && t >= 2) {
      narrative = `Sensational all-round masterclass: bagged ${g} goals and executed ${t} clutch tackles!`;
    } else if (g >= 2) {
      narrative = `Lethal finishing display with ${g} match-defining goals to lead the attack.`;
    } else if (g === 1 && t >= 2) {
      narrative = `Decisive matchwinner: scored the crucial goal while winning ${t} vital tackles.`;
    } else if (g === 1) {
      narrative = `Clinched the breakthrough goal with dynamic forward pressure and ${p} passes.`;
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

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this.loop);
  }

  stop() {
    this.isRunning = false;
  }

  loop(currentTime) {
    if (!this.isRunning) return;

    let dt = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    // Clamp dt to avoid huge simulation jumps when tab is in background
    if (dt > 0.1) dt = 0.1;

    this.update(dt);
    this.render();

    requestAnimationFrame(this.loop);
  }

  update(dt) {
    // 0. Kick-off countdown
    if (this.isKickoff) {
      this.kickoffTimer -= dt;
      if (this.kickoffTimer <= 0) {
        this.isKickoff = false;
        this.audio.playWhistle();
      }
    }

    if (this.goldenGoalBannerTimer > 0) {
      this.goldenGoalBannerTimer -= dt;
    }

    // Check manual utility inputs
    if (this.input.consumeSwitch()) {
      this.switchControlledPlayer();
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

    const controlled = this.getControlledPlayer();
    const moveDir = (!this.isKickoff && !this.isFullTime) ? this.input.getMovementVector() : { x: 0, y: 0 };
    const hasBall = (this.ball.carrier === controlled);

    // --- SHOOTING POWER CHARGE LOGIC (Space / Key J) ---
    if (!this.isKickoff && !this.isFullTime && controlled) {
      if (hasBall) {
        // Player possesses the ball: hold to charge shot power, release to fire!
        if (this.input.isKickHeld()) {
          this.isChargingShot = true;
          this.shotCharge = Math.min(1.0, this.shotCharge + dt * 1.5); // Charges 0 to 100% in ~0.66s
        } else if (this.isChargingShot) {
          // Key released! Execute driven shot with power scaled by charge!
          const kickX = moveDir.x !== 0 ? moveDir.x : Math.cos(controlled.facingAngle);
          const kickY = moveDir.y !== 0 ? moveDir.y : Math.sin(controlled.facingAngle);

          const minPower = 340;
          const maxPower = 640;
          const power = minPower + this.shotCharge * (maxPower - minPower);
          const height = 15 + this.shotCharge * 30;

          const success = controlled.performKick(this.ball, kickX, kickY, power, height);
          if (success) {
            this.audio.playShoot(this.shotCharge);
          }
          this.isChargingShot = false;
          this.shotCharge = 0;
        }
      } else {
        // Defending: Instant standing tackle upon pressing Space/J!
        this.isChargingShot = false;
        this.shotCharge = 0;
        if (this.input.consumeKick()) {
          const success = controlled.performTackle(this.ball, this.players, this.audio);
          if (!success) {
            this.audio.playTackle();
          }
        }
      }

      // --- PASSING POWER CHARGE LOGIC (Key X / Key K) ---
      if (hasBall) {
        if (this.input.isPassHeld()) {
          this.isChargingPass = true;
          this.passCharge = Math.min(1.0, this.passCharge + dt * 2.2); // Charges in ~0.45s
        } else if (this.isChargingPass) {
          // Key released! Execute pass with power scaled by charge!
          const minPass = 280;
          const maxPass = 540;
          const power = minPass + this.passCharge * (maxPass - minPass);

          const passTarget = controlled.findBestPassTarget(this.players, moveDir);
          if (passTarget) {
            const passed = controlled.performPass(this.ball, passTarget, power);
            if (passed) {
              this.audio.playPass();
              if (passTarget.role !== 'GK') {
                this.players.forEach((p) => {
                  p.isControlled = false;
                });
                passTarget.isControlled = true;
                if (this.uiHooks.onControlledPlayerChanged) {
                  this.uiHooks.onControlledPlayerChanged(passTarget);
                }
              }
            }
          }
          this.isChargingPass = false;
          this.passCharge = 0;
        }
      } else {
        this.isChargingPass = false;
        this.passCharge = 0;
      }
    }

    // Goal celebration cooldown
    if (this.goalCelebrationTimer > 0) {
      this.goalCelebrationTimer -= dt;
      if (this.goalCelebrationTimer <= 0) {
        this.resetPositions(true);
      }
    } else if (!this.isFullTime && !this.isMenuIdle) {
      // Match clock ticking
      this.matchTime = Math.max(0, this.matchTime - dt);
      if (this.uiHooks.onTimeUpdated) {
        this.uiHooks.onTimeUpdated(this.matchTime);
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

              if (this.uiHooks.onMatchEnd) {
                this.uiHooks.onMatchEnd({
                  score: Object.assign({}, this.score),
                  homeTeam: this.homeTeam,
                  awayTeam: this.awayTeam,
                  winner: winnerKey,
                  isPenaltyShootout: true,
                  penalties: { home: pHome, away: pAway },
                  players: this.players,
                  mvp: this.calculateMatchMVP(winnerKey)
                });
              }
            }
          } else {
            // Quick Match: Genuine Fair Draw!
            this.isFullTime = true;
            this.audio.playFullTimeWhistle();

            if (this.uiHooks.onMatchEnd) {
              this.uiHooks.onMatchEnd({
                score: Object.assign({}, this.score),
                homeTeam: this.homeTeam,
                awayTeam: this.awayTeam,
                winner: null,
                isDraw: true,
                players: this.players,
                mvp: this.calculateMatchMVP(null)
              });
            }
          }
        } else {
          // Decisive winner
          this.isFullTime = true;
          this.audio.playFullTimeWhistle();

          let winner = this.score.blue > this.score.red ? 'blue' : 'red';
          if (this.uiHooks.onMatchEnd) {
            this.uiHooks.onMatchEnd({
              score: Object.assign({}, this.score),
              homeTeam: this.homeTeam,
              awayTeam: this.awayTeam,
              winner: winner,
              isDraw: false,
              players: this.players,
              mvp: this.calculateMatchMVP(winner)
            });
          }
        }
      }
    }

    // 1. Update pitch flags & ambient elements
    this.pitch.update(dt);

    // 2. Update all 6 players (frozen during kickoff countdown)
    const effectiveMoveDir = this.isKickoff ? { x: 0, y: 0 } : moveDir;
    this.players.forEach((player) => {
      player.update(
        dt,
        player.isControlled ? effectiveMoveDir : null,
        this.isKickoff ? null : this.ball,
        this.players
      );
    });

    // 3. Update football
    if (!this.isKickoff) {
      this.ball.update(
        dt,
        (scoringTeam) => this.handleGoal(scoringTeam),
        (defendingTeam) => this.handleGoalKick(defendingTeam),
        this.audio
      );

      // 4. Resolve physics & collisions
      PhysicsSystem.resolveCollisions(this.players, this.ball, this.audio);
    }

    // 5. Update 2.5D camera smoothly tracking action
    this.camera.update(controlled, this.ball, dt);

    // 6. EAFC Auto-Switch to closest teammate when defending or ball is loose
    if (!this.isKickoff && !this.isFullTime) {
      this.checkAutoSwitch();
    }
  }

  checkAutoSwitch() {
    const controlled = this.getControlledPlayer();
    if (!controlled || controlled.isStumbled) return;

    // Do NOT auto-switch if user is actively carrying/dribbling the ball
    if (this.ball.carrier === controlled) return;

    const blueOutfield = this.players.filter((p) => p.team === 'blue' && p.role !== 'GK');
    if (blueOutfield.length === 0) return;

    // If another blue teammate intercepted or won the ball, immediately give control to that teammate!
    if (this.ball.carrier && this.ball.carrier.team === 'blue' && this.ball.carrier !== controlled) {
      this.players.forEach((p) => {
        p.isControlled = false;
      });
      this.ball.carrier.isControlled = true;
      if (this.uiHooks.onControlledPlayerChanged) {
        this.uiHooks.onControlledPlayerChanged(this.ball.carrier);
      }
      return;
    }

    // When defending or ball is loose, auto-switch to closest blue player
    let closest = controlled;
    let minDist = Math.hypot(controlled.x - this.ball.x, controlled.y - this.ball.y);

    blueOutfield.forEach((p) => {
      const dist = Math.hypot(p.x - this.ball.x, p.y - this.ball.y);
      if (dist < minDist) {
        minDist = dist;
        closest = p;
      }
    });

    const currentDist = Math.hypot(controlled.x - this.ball.x, controlled.y - this.ball.y);
    if (closest !== controlled && minDist < currentDist - 65) {
      this.players.forEach((p) => {
        p.isControlled = false;
      });
      closest.isControlled = true;
      if (this.uiHooks.onControlledPlayerChanged) {
        this.uiHooks.onControlledPlayerChanged(closest);
      }
    }
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

    // Pass Target Indicator on ground (shows who will receive pass when pressing X)
    const controlled = this.getControlledPlayer();
    if (controlled && !this.isKickoff && !this.isFullTime) {
      const distToBall = Math.hypot(this.ball.x - controlled.x, this.ball.y - controlled.y);
      if (distToBall < controlled.radius + this.ball.radius + 35 && this.ball.z <= 35) {
        const moveDir = this.input.getMovementVector();
        const target = controlled.findBestPassTarget(this.players, moveDir);
        if (target && target.role !== 'GK') {
          const tPos = this.camera.worldToScreen(target.x, target.y, 0);
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
          ctx.strokeStyle = 'rgba(45, 212, 191, 0.85)';
          ctx.lineWidth = 1.8 * this.camera.zoom;
          ctx.setLineDash([5, 4]);
          ctx.stroke();

          if (this.camera.zoom > 0.7) {
            ctx.fillStyle = '#2DD4BF';
            ctx.font = `bold ${Math.round(8.5 * this.camera.zoom)}px 'Trebuchet MS', sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText('PASS [X]', tPos.x, tPos.y + 15 * this.camera.zoom);
          }
          ctx.restore();
        }
      }
    }

    // 2. Render 2.5D Depth-Sorted Entities (Players & Ball)
    const sortedEntities = PhysicsSystem.getDepthSortedEntities(this.players, this.ball);
    sortedEntities.forEach((entity) => {
      entity.render(ctx, this.camera);
    });

    // 3. Render Shooting or Passing Power Bar above player's head
    if (controlled && (this.isChargingShot || this.isChargingPass)) {
      this.renderPlayerPowerBar(ctx, controlled);
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
   * EAFC Arcade Style Floating Power Bar
   */
  renderPlayerPowerBar(ctx, player) {
    const isShot = this.isChargingShot;
    const charge = isShot ? this.shotCharge : this.passCharge;
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

    // Fill bar with colors:
    // Shot: Green -> Yellow -> Orange -> Fiery Red
    // Pass: Sky Blue -> Vivid Turquoise
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

    ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
    ctx.fillRect(0, cy - 40, width, 80);

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, cy - 40);
    ctx.lineTo(width, cy - 40);
    ctx.moveTo(0, cy + 40);
    ctx.lineTo(width, cy + 40);
    ctx.stroke();

    ctx.fillStyle = '#FACC15';
    ctx.font = "900 32px 'Trebuchet MS', sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚡ MATCH KICK-OFF ⚡', cx, cy - 8);

    ctx.font = "600 15px 'Trebuchet MS', sans-serif";
    ctx.fillStyle = '#E2E8F0';
    ctx.fillText('GET READY!', cx, cy + 20);

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
    const teamColor = scoringTeamInfo.accentColor || scoringTeamInfo.shirtColor || (this.scoringTeam === 'blue' ? '#38BDF8' : '#F87171');
    const teamName = scoringTeamInfo.name.toUpperCase();
    const teamBadge = scoringTeamInfo.badge || '⚽';
    const scorerName = this.lastScorer ? `${this.lastScorer.name.toUpperCase()} (#${this.lastScorer.number})` : 'GOAL!';

    const cardW = Math.min(width * 0.9, 560);
    const cardH = 120;
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
    const bannerTitle = this.isGoldenGoal ? `⚡ GOLDEN GOAL! · ${teamBadge} ${teamName}` : `⚽ GOOOAL! · ${teamBadge} ${teamName}`;
    ctx.fillText(bannerTitle, cx, ry + 18);

    ctx.fillStyle = '#FACC15';
    ctx.font = "800 28px 'Trebuchet MS', sans-serif";
    ctx.fillText(scorerName, cx, ry + 64);

    ctx.font = "700 16px 'Trebuchet MS', sans-serif";
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(
      `${this.homeTeam.shortName || 'BLU'} ${this.score.blue}  -  ${this.score.red} ${this.awayTeam.shortName || 'RED'}`,
      cx,
      ry + 96
    );

    ctx.restore();
  }

  renderMiniRadar(ctx, width, height) {
    const radarW = 140;
    const radarH = 84;
    const pad = 16;
    const rx = width - radarW - pad;
    const ry = height - radarH - pad;

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
    ctx.arc(midX, midY, 12, 0, Math.PI * 2);
    ctx.stroke();

    const toRadar = (wx, wy) => {
      const px = midX + (wx / (PITCH.WIDTH / 2)) * (radarW / 2 - 6);
      const py = midY + (wy / (PITCH.HEIGHT / 2)) * (radarH / 2 - 6);
      return { x: px, y: py };
    };

    this.players.forEach((p) => {
      const pt = toRadar(p.x, p.y);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, p.isControlled ? 4 : 3, 0, Math.PI * 2);
      ctx.fillStyle = p.team === 'blue' ? (this.homeTeam.accentColor || '#38BDF8') : (this.awayTeam.accentColor || '#F87171');
      ctx.fill();

      if (p.isControlled) {
        ctx.strokeStyle = '#FACC15';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    });

    const bPt = toRadar(this.ball.x, this.ball.y);
    ctx.beginPath();
    ctx.arc(bPt.x, bPt.y, 2.8, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();

    ctx.restore();
  }

  renderTouchJoystick(ctx) {
    if (!this.input.touchJoystick.active) return;
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
