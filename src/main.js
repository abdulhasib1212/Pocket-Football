/**
 * Main Entry Point for Pocket Football League
 * Coordinates UI Overlays, Match Presentation, Procedural Audio, and Game Modes
 * Pure Vanilla JavaScript & HTML5 Canvas 2D
 */
import { GameEngine } from './game/engine.js';
import { TEAMS, TEAMS_LIST } from './game/constants.js';
import { AudioManager } from './game/audio.js';
import { TournamentManager } from './game/tournament.js';
import { CrazyGamesBridge } from './game/crazygames.js';

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('gameCanvas');
  if (!canvas) {
    console.error('Canvas element #gameCanvas not found.');
    return;
  }

  // --- Shared Audio, Tournament & CrazyGames SDK Systems ---
  const audio = new AudioManager();
  const tournament = new TournamentManager();
  const crazyGames = new CrazyGamesBridge();
  crazyGames.init();

  // Unlock Web Audio API on first user interaction
  const unlockAudioOnGesture = () => {
    audio.init();
    window.removeEventListener('pointerdown', unlockAudioOnGesture);
    window.removeEventListener('keydown', unlockAudioOnGesture);
  };
  window.addEventListener('pointerdown', unlockAudioOnGesture);
  window.addEventListener('keydown', unlockAudioOnGesture);

  // Helper to play tactile UI click
  const clickSound = () => audio.playClick();

  // --- DOM Elements ---
  // Overlays
  const mainMenuOverlay = document.getElementById('mainMenuOverlay');
  const quickMatchModal = document.getElementById('quickMatchModal');
  const preMatchOverlay = document.getElementById('preMatchOverlay');
  const tournamentModal = document.getElementById('tournamentModal');
  const halfTimeModal = document.getElementById('halfTimeModal');
  const fullTimeModal = document.getElementById('fullTimeModal');
  const matchMvpModal = document.getElementById('matchMvpModal');
  const championModal = document.getElementById('championModal');
  const settingsModal = document.getElementById('settingsModal');
  const helpModal = document.getElementById('helpModal');

  // In-game HUD
  const inGameHeader = document.getElementById('inGameHeader');
  const scoreBlueEl = document.getElementById('scoreBlue');
  const scoreRedEl = document.getElementById('scoreRed');
  const homeShortNameEl = document.getElementById('homeShortName');
  const awayShortNameEl = document.getElementById('awayShortName');
  const homeBadgeIconEl = document.getElementById('homeBadgeIcon');
  const awayBadgeIconEl = document.getElementById('awayBadgeIcon');
  const matchClockEl = document.getElementById('matchClock');
  const matchHalfBadgeEl = document.getElementById('matchHalfBadge');
  const playerTagEl = document.getElementById('playerTag');
  const player2TagEl = document.getElementById('player2Tag');
  const arcadeFooterTextEl = document.getElementById('arcadeFooterText');
  const quickHomeColTitle = document.getElementById('quickHomeColTitle');
  const quickAwayColTitle = document.getElementById('quickAwayColTitle');
  const quickDifficultyBox = document.getElementById('quickDifficultyBox');
  const preHomeMeta = document.getElementById('preHomeMeta');
  const preAwayMeta = document.getElementById('preAwayMeta');
  const cameraBtn = document.getElementById('cameraBtn');
  const soundQuickBtn = document.getElementById('soundQuickBtn');
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  const menuFullscreenBtn = document.getElementById('menuFullscreenBtn');
  const inGameMenuBtn = document.getElementById('inGameMenuBtn');
  const headerSettingsBtn = document.getElementById('headerSettingsBtn');
  const settingsPausedBadge = document.getElementById('settingsPausedBadge');
  const pauseMatchActions = document.getElementById('pauseMatchActions');
  const pauseRestartBtn = document.getElementById('pauseRestartBtn');
  const pauseMainMenuBtn = document.getElementById('pauseMainMenuBtn');
  const doneSettingsBtn = document.getElementById('doneSettingsBtn');
  const penaltyShootoutNote = document.getElementById('penaltyShootoutNote');
  const ftGoldenGoalBtn = document.getElementById('ftGoldenGoalBtn');
  const menuControlsHint = document.getElementById('menuControlsHint');

  // Mobile Touch Controls DOM
  const touchControlsOverlay = document.getElementById('touchControlsOverlay');
  const touchJoystickZone = document.getElementById('touchJoystickZone');
  const touchJoystickBase = document.getElementById('touchJoystickBase');
  const touchJoystickKnob = document.getElementById('touchJoystickKnob');
  const touchPassBtn = document.getElementById('touchPassBtn');
  const touchShootBtn = document.getElementById('touchShootBtn');
  const touchSwitchBtn = document.getElementById('touchSwitchBtn');

  // Format time mm:ss
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // --- Game State Tracking ---
  let appState = 'MENU'; // 'MENU' | 'PLAYING'
  let settingsReturnState = 'MENU';
  let activeEngine = null;
  let currentMode = 'NONE'; // 'QUICK_MATCH' | 'TOURNAMENT'

  let quickMatchHomeTeamId = 'waves';
  let quickMatchAwayTeamId = 'strikers';
  let quickMatchDuration = 180;
  let selectedQuickPlayersMode = '1p'; // '1p' | '2p'
  let isLocalMultiplayerMatch = false;
  let lastActiveIsLocal2p = false;
  const DIFFICULTY_KEY = 'pocket_football_difficulty';
  let selectedDifficulty = 'normal';
  try {
    const savedDiff = localStorage.getItem(DIFFICULTY_KEY);
    if (savedDiff === 'easy' || savedDiff === 'normal' || savedDiff === 'hard') {
      selectedDifficulty = savedDiff;
    }
  } catch (e) {}
  let lastActiveHomeTeam = null;
  let lastActiveAwayTeam = null;
  let lastActiveDuration = 180;
  let lastMatchMvp = null;

  // Tournament specific setup
  let selectedTournamentTeamId = 'waves';

  const updateFooterControlsHint = (is2p) => {
    if (!arcadeFooterTextEl) return;
    if (is2p) {
      arcadeFooterTextEl.innerHTML = `
        <span><strong>P1:</strong> <span class="key-badge">WASD</span> Move <span class="sep">·</span> <span class="key-badge">X</span> Pass <span class="sep">·</span> <span class="key-badge">Space</span> Shoot <span class="sep">·</span> <span class="key-badge">Q</span> Switch</span>
        <span class="sep">|</span>
        <span><strong>P2:</strong> <span class="key-badge">Arrows</span> Move <span class="sep">·</span> <span class="key-badge">K</span> Pass <span class="sep">·</span> <span class="key-badge">J</span> Shoot <span class="sep">·</span> <span class="key-badge">L</span> Switch</span>
        <span class="sep">|</span>
        <span><span class="key-badge">C</span> Cam <span class="sep">·</span> <span class="key-badge">Esc</span> Pause</span>
      `;
    } else {
      arcadeFooterTextEl.innerHTML = `
        <span>Controls: </span>
        <span class="key-badge">WASD</span> Move
        <span class="sep">·</span>
        <span class="key-badge">X</span> Pass
        <span class="sep">·</span>
        <span class="key-badge">Space</span> Shoot / Tackle
        <span class="sep">·</span>
        <span class="key-badge">Q</span> Switch
        <span class="sep">·</span>
        <span class="key-badge">C</span> Camera
        <span class="sep">·</span>
        <span class="key-badge">Esc</span> Pause
      `;
    }
  };

  // --- Screen State Manager ---
  const allOverlays = [
    mainMenuOverlay,
    quickMatchModal,
    preMatchOverlay,
    tournamentModal,
    halfTimeModal,
    fullTimeModal,
    matchMvpModal,
    championModal,
    settingsModal,
    helpModal
  ];

  const hideAllOverlays = () => {
    allOverlays.forEach((overlay) => {
      if (overlay) overlay.classList.remove('active');
    });
  };

  const showScreen = (overlayElement) => {
    hideAllOverlays();
    if (overlayElement) {
      overlayElement.classList.add('active');
    }
  };

  // Update Tournament Active Badge on Main Menu
  const updateTournamentBadge = () => {
    const badge = document.getElementById('tournamentBadgeIndicator');
    if (badge) {
      if (tournament.hasActiveTournament()) {
        badge.classList.remove('hidden');
        badge.textContent = tournament.roundNames[tournament.currentRoundIndex].toUpperCase();
      } else {
        badge.classList.add('hidden');
      }
    }
  };

  // --- Touch Controls Visibility & Fullscreen State ---
  const TOUCH_MODE_KEY = 'pocket_football_touch_mode';
  let touchControlsPref = 'auto';
  try {
    const savedTouchPref = localStorage.getItem(TOUCH_MODE_KEY);
    if (savedTouchPref === 'auto' || savedTouchPref === 'on' || savedTouchPref === 'off') {
      touchControlsPref = savedTouchPref;
    }
  } catch (e) {}

  const isCoarsePointer = () =>
    (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0;

  let hasDetectedTouch = isCoarsePointer();

  let resetTouchJoystickVisual = () => {};

  const shouldShowTouchControls = () => {
    if (appState !== 'PLAYING') return false;
    if (isLocalMultiplayerMatch) return false;
    if (!activeEngine || activeEngine.isPaused || activeEngine.isFullTime) return false;
    const anyOverlayOpen = allOverlays.some((o) => o && o.classList.contains('active'));
    if (anyOverlayOpen) return false;
    if (touchControlsPref === 'on') return true;
    if (touchControlsPref === 'off') return false;
    return hasDetectedTouch || isCoarsePointer();
  };

  const updateTouchControlsVisibility = () => {
    const show = shouldShowTouchControls();
    if (touchControlsOverlay) {
      touchControlsOverlay.classList.toggle('hidden', !show);
    }
    if (!show) {
      resetTouchJoystickVisual();
    }
    if (activeEngine && activeEngine.setTouchHudActive) {
      activeEngine.setTouchHudActive(show);
    }
  };

  window.addEventListener('touchstart', () => {
    if (!hasDetectedTouch) {
      hasDetectedTouch = true;
      updateTouchControlsVisibility();
    }
  }, { passive: true });

  // Helper to run a transition through a CrazyGames midgame ad with audio/pause safety
  const runWithMidgameAd = (onComplete) => {
    const wasMuted = audio.isMuted;
    const wasPaused = activeEngine ? activeEngine.isPaused : false;
    crazyGames.requestAd('midgame', {
      onAdStart: () => {
        audio.setMuted(true);
        if (activeEngine && appState === 'PLAYING') {
          activeEngine.setPaused(true);
        }
      },
      onAdEnd: () => {
        audio.setMuted(wasMuted);
        if (activeEngine && appState === 'PLAYING' && !wasPaused && !activeEngine.isHalfTime && !activeEngine.isFullTime) {
          activeEngine.setPaused(false);
        }
        if (onComplete) onComplete();
      }
    });
  };

  // Transition back to Main Menu
  const returnToMainMenu = () => {
    appState = 'MENU';
    isLocalMultiplayerMatch = false;
    crazyGames.gameplayStop();
    audio.stopCrowdAmbience();
    audio.setMusicDucked(false);
    audio.setMusicTrack('menu');
    if (activeEngine) {
      activeEngine.setPaused(false);
      activeEngine.stop();
    }
    if (inGameHeader) {
      inGameHeader.classList.add('hidden');
    }
    if (player2TagEl) {
      player2TagEl.classList.add('hidden');
    }
    updateFooterControlsHint(false);
    updateTouchControlsVisibility();
    updateTournamentBadge();
    showScreen(mainMenuOverlay);

    // Warm up idle stadium background
    setupIdleMenuBackground();
  };

  // Render Match Stats Comparison Bars inside Half-Time Modal
  const showHalfTimeModal = ({ score, homeTeam, awayTeam, stats }) => {
    crazyGames.gameplayStop();
    audio.stopCrowdAmbience();
    audio.setMusicDucked(false);
    audio.setMusicTrack('halftime');
    const htHomeBadge = document.getElementById('htHomeBadge');
    const htHomeName = document.getElementById('htHomeName');
    const htHomeScore = document.getElementById('htHomeScore');
    const htAwayBadge = document.getElementById('htAwayBadge');
    const htAwayName = document.getElementById('htAwayName');
    const htAwayScore = document.getElementById('htAwayScore');
    const htStatsList = document.getElementById('htStatsList');

    if (htHomeBadge) htHomeBadge.textContent = homeTeam.badge;
    if (htHomeName) htHomeName.textContent = homeTeam.name;
    if (htHomeScore) htHomeScore.textContent = score.blue;
    if (htAwayBadge) htAwayBadge.textContent = awayTeam.badge;
    if (htAwayName) htAwayName.textContent = awayTeam.name;
    if (htAwayScore) htAwayScore.textContent = score.red;

    if (htStatsList && stats) {
      const homeColor = homeTeam.accentColor || '#38BDF8';
      const awayColor = awayTeam.accentColor || '#F87171';
      const rows = [
        { label: 'Possession', blue: stats.possession?.blue ?? 50, red: stats.possession?.red ?? 50, suffix: '%' },
        { label: 'Shots', blue: stats.shots?.blue ?? 0, red: stats.shots?.red ?? 0, suffix: '' },
        { label: 'Assists', blue: stats.assists?.blue ?? 0, red: stats.assists?.red ?? 0, suffix: '' },
        { label: 'Passes', blue: stats.passes?.blue ?? 0, red: stats.passes?.red ?? 0, suffix: '' },
        { label: 'Tackles', blue: stats.tackles?.blue ?? 0, red: stats.tackles?.red ?? 0, suffix: '' },
      ];

      htStatsList.innerHTML = rows.map((row) => {
        const total = row.blue + row.red;
        const bluePct = total > 0 ? Math.round((row.blue / total) * 100) : 50;
        const redPct = 100 - bluePct;
        return `
          <div class="stat-compare-row">
            <div class="stat-compare-values">
              <span class="stat-val-home" style="color: ${homeColor}">${row.blue}${row.suffix}</span>
              <span class="stat-val-label">${row.label}</span>
              <span class="stat-val-away" style="color: ${awayColor}">${row.red}${row.suffix}</span>
            </div>
            <div class="stat-compare-bar">
              <div class="stat-bar-home" style="width: ${bluePct}%; background: ${homeColor};"></div>
              <div class="stat-bar-away" style="width: ${redPct}%; background: ${awayColor};"></div>
            </div>
          </div>
        `;
      }).join('');
    }

    showScreen(halfTimeModal);
    updateTouchControlsVisibility();
  };

  // --- Launch A Match (Quick Match, Local 2P, or Tournament) ---
  const startMatch = (homeTeamConfig, awayTeamConfig, durationSecs, isLocal2p = false) => {
    const isTournamentFinal = (currentMode === 'TOURNAMENT' && tournament.currentRoundIndex === 2);
    appState = 'PLAYING';
    isLocalMultiplayerMatch = !!isLocal2p;
    lastActiveIsLocal2p = isLocalMultiplayerMatch;
    hideAllOverlays();

    lastActiveHomeTeam = homeTeamConfig;
    lastActiveAwayTeam = awayTeamConfig;
    lastActiveDuration = durationSecs;
    lastMatchMvp = null;

    // Show in-game HUD header
    if (inGameHeader) {
      inGameHeader.classList.remove('hidden');
    }

    // Clean up previous engine if active
    if (activeEngine) {
      activeEngine.stop();
    }

    // Update HUD with team metadata & high-contrast accent colors
    if (homeShortNameEl) {
      homeShortNameEl.textContent = homeTeamConfig.shortName || 'BLU';
      homeShortNameEl.style.color = homeTeamConfig.accentColor || '#38BDF8';
    }
    if (awayShortNameEl) {
      awayShortNameEl.textContent = awayTeamConfig.shortName || 'RED';
      awayShortNameEl.style.color = awayTeamConfig.accentColor || '#F87171';
    }
    if (homeBadgeIconEl) homeBadgeIconEl.textContent = homeTeamConfig.badge || '⚽';
    if (awayBadgeIconEl) awayBadgeIconEl.textContent = awayTeamConfig.badge || '⚽';

    if (scoreBlueEl) {
      scoreBlueEl.textContent = '0';
      scoreBlueEl.style.color = '#FFFFFF';
    }
    if (scoreRedEl) {
      scoreRedEl.textContent = '0';
      scoreRedEl.style.color = '#FFFFFF';
    }
    if (matchClockEl) matchClockEl.textContent = formatTime(durationSecs);
    if (matchHalfBadgeEl) matchHalfBadgeEl.textContent = '1H';
    if (playerTagEl && homeTeamConfig.roster?.fw) {
      playerTagEl.textContent = `P1 · #${homeTeamConfig.roster.fw.number} FW`;
    }
    if (player2TagEl) {
      player2TagEl.classList.toggle('hidden', !isLocalMultiplayerMatch);
      if (awayTeamConfig.roster?.fw) {
        player2TagEl.textContent = `P2 · #${awayTeamConfig.roster.fw.number} FW`;
      }
    }
    updateFooterControlsHint(isLocalMultiplayerMatch);

    // Create New Engine instance
    activeEngine = new GameEngine(
      canvas,
      {
        onScoreChanged: (score) => {
          if (scoreBlueEl) scoreBlueEl.textContent = score.blue;
          if (scoreRedEl) scoreRedEl.textContent = score.red;
        },
        onTimeUpdated: (remainingSeconds, halfInfo) => {
          if (matchClockEl) {
            matchClockEl.textContent = formatTime(remainingSeconds);
          }
          if (matchHalfBadgeEl) {
            if (halfInfo?.isGoldenGoal || (activeEngine && activeEngine.isGoldenGoal)) {
              matchHalfBadgeEl.textContent = 'ET';
            } else if (halfInfo?.half === 2 || (activeEngine && activeEngine.currentHalf === 2)) {
              matchHalfBadgeEl.textContent = '2H';
            } else {
              matchHalfBadgeEl.textContent = '1H';
            }
          }
        },
        onHalfTime: (htPayload) => {
          showHalfTimeModal(htPayload);
        },
        onSecondHalfStarted: () => {
          if (matchHalfBadgeEl) matchHalfBadgeEl.textContent = '2H';
        },
        onControlledPlayerChanged: (player, slot = 'p1') => {
          if (slot === 'p2') {
            if (player2TagEl) player2TagEl.textContent = `P2 · #${player.number} ${player.role}`;
          } else {
            if (playerTagEl) playerTagEl.textContent = `P1 · #${player.number} ${player.role}`;
          }
        },
        onCameraModeChanged: (mode) => {
          if (cameraBtn) {
            cameraBtn.textContent = mode === 'FOLLOW' ? 'Cam: Dynamic' : 'Cam: Overview';
          }
        },
        onGoldenGoalStarted: () => {
          if (matchHalfBadgeEl) matchHalfBadgeEl.textContent = 'ET';
          if (playerTagEl) {
            playerTagEl.textContent = isLocalMultiplayerMatch
              ? 'GOLDEN GOAL · NEXT SCORES'
              : 'GOLDEN GOAL · NEXT SCORES WINS';
          }
          audio.setMusicDucked(false);
          audio.setMusicTrack(null);
          audio.startCrowdAmbience({ isTournamentFinal });
          crazyGames.gameplayStart();
        },
        onMatchEnd: (results) => {
          handleMatchFinished(results);
        }
      },
      {
        homeTeam: homeTeamConfig,
        awayTeam: awayTeamConfig,
        duration: durationSecs,
        isKnockout: (currentMode === 'TOURNAMENT'),
        isTournamentFinal,
        isLocalMultiplayer: isLocalMultiplayerMatch,
        difficulty: selectedDifficulty,
        audio: audio
      }
    );

    activeEngine.start();
    audio.setMusicDucked(false);
    audio.setMusicTrack(null);
    audio.startCrowdAmbience({ isTournamentFinal });
    updateTouchControlsVisibility();
    crazyGames.gameplayStart();
  };

  // --- Show Pre-Match Broadcast Intro Screen ---
  const showPreMatchIntro = (homeTeamConfig, awayTeamConfig, durationSecs, isLocal2p = false) => {
    audio.stopCrowdAmbience();
    audio.setMusicDucked(false);
    audio.setMusicTrack('menu');
    // Populate Left Card
    const preHomeBadge = document.getElementById('preHomeBadge');
    const preHomeName = document.getElementById('preHomeName');
    const preHomeLineup = document.getElementById('preHomeLineup');
    const preHomeCard = document.getElementById('preMatchHomeCard');

    if (preHomeBadge) preHomeBadge.textContent = homeTeamConfig.badge;
    if (preHomeName) preHomeName.textContent = homeTeamConfig.name;
    if (preHomeCard) preHomeCard.style.borderColor = homeTeamConfig.accentColor || homeTeamConfig.shirtColor;
    if (preHomeMeta) {
      preHomeMeta.textContent = isLocal2p
        ? 'Player 1 · WASD + Space / X / Q'
        : 'Formation 1-1-1 · Home';
    }

    if (preHomeLineup && homeTeamConfig.roster) {
      preHomeLineup.innerHTML = `
        <div class="lineup-item"><span class="lineup-role">GK</span> <span>#${homeTeamConfig.roster.gk.number} ${homeTeamConfig.roster.gk.name}</span></div>
        <div class="lineup-item"><span class="lineup-role">DF</span> <span>#${homeTeamConfig.roster.df.number} ${homeTeamConfig.roster.df.name}</span></div>
        <div class="lineup-item"><span class="lineup-role">FW</span> <span>#${homeTeamConfig.roster.fw.number} ${homeTeamConfig.roster.fw.name}</span></div>
      `;
    }

    // Populate Right Card
    const preAwayBadge = document.getElementById('preAwayBadge');
    const preAwayName = document.getElementById('preAwayName');
    const preAwayLineup = document.getElementById('preAwayLineup');
    const preAwayCard = document.getElementById('preMatchAwayCard');

    if (preAwayBadge) preAwayBadge.textContent = awayTeamConfig.badge;
    if (preAwayName) preAwayName.textContent = awayTeamConfig.name;
    if (preAwayCard) preAwayCard.style.borderColor = awayTeamConfig.accentColor || awayTeamConfig.shirtColor;
    if (preAwayMeta) {
      preAwayMeta.textContent = isLocal2p
        ? 'Player 2 · Arrows + J / K / L'
        : 'Formation 1-1-1 · Away';
    }

    if (preAwayLineup && awayTeamConfig.roster) {
      preAwayLineup.innerHTML = `
        <div class="lineup-item"><span class="lineup-role">GK</span> <span>#${awayTeamConfig.roster.gk.number} ${awayTeamConfig.roster.gk.name}</span></div>
        <div class="lineup-item"><span class="lineup-role">DF</span> <span>#${awayTeamConfig.roster.df.number} ${awayTeamConfig.roster.df.name}</span></div>
        <div class="lineup-item"><span class="lineup-role">FW</span> <span>#${awayTeamConfig.roster.fw.number} ${awayTeamConfig.roster.fw.name}</span></div>
      `;
    }

    const preDurationText = document.getElementById('preDurationText');
    if (preDurationText) {
      if (isLocal2p) {
        preDurationText.textContent = `${Math.floor(durationSecs / 60)}:00 LOCAL 2P VERSUS`;
      } else {
        const diffLabel = selectedDifficulty.toUpperCase();
        preDurationText.textContent = `${Math.floor(durationSecs / 60)}:00 ${currentMode === 'TOURNAMENT' ? 'CUP KNOCKOUT' : 'MATCH'} · ${diffLabel}`;
      }
    }

    showScreen(preMatchOverlay);

    // Setup Kickoff button handler
    const kickoffBtn = document.getElementById('preMatchKickoffBtn');
    if (kickoffBtn) {
      kickoffBtn.onclick = () => {
        clickSound();
        startMatch(homeTeamConfig, awayTeamConfig, durationSecs, isLocal2p);
      };
    }
  };

  // --- Match Finished / Results Presentation with Comprehensive Tie Logic ---
  const handleMatchFinished = ({ score, homeTeam, awayTeam, winner, isDraw, isGoldenGoalWin, isPenaltyShootout, penalties, mvp }) => {
    crazyGames.gameplayStop();
    audio.stopCrowdAmbience();
    audio.setMusicDucked(false);
    audio.setMusicTrack('fulltime');
    lastMatchMvp = mvp || null;

    // Populate Results Screen
    const ftHomeBadge = document.getElementById('ftHomeBadge');
    const ftHomeName = document.getElementById('ftHomeName');
    const ftHomeScore = document.getElementById('ftHomeScore');
    const ftAwayBadge = document.getElementById('ftAwayBadge');
    const ftAwayName = document.getElementById('ftAwayName');
    const ftAwayScore = document.getElementById('ftAwayScore');
    const ftOutcome = document.getElementById('fullTimeOutcomeMsg');
    const ftRematchBtn = document.getElementById('ftRematchBtn');
    const ftContinueTournamentBtn = document.getElementById('ftContinueTournamentBtn');

    if (ftHomeBadge) ftHomeBadge.textContent = homeTeam.badge;
    if (ftHomeName) ftHomeName.textContent = homeTeam.name;
    if (ftHomeScore) ftHomeScore.textContent = score.blue;
    if (ftAwayBadge) ftAwayBadge.textContent = awayTeam.badge;
    if (ftAwayName) ftAwayName.textContent = awayTeam.name;
    if (ftAwayScore) ftAwayScore.textContent = score.red;

    // Reset optional notes and buttons
    if (penaltyShootoutNote) penaltyShootoutNote.classList.add('hidden');
    if (ftGoldenGoalBtn) ftGoldenGoalBtn.classList.add('hidden');

    if (currentMode === 'TOURNAMENT') {
      // Record Tournament Match with verified winner (Blue is player)
      const tResult = tournament.recordPlayerMatchResult(score.blue, score.red, winner, penalties);

      if (ftRematchBtn) ftRematchBtn.classList.add('hidden');
      if (ftContinueTournamentBtn) ftContinueTournamentBtn.classList.remove('hidden');

      if (isPenaltyShootout && penaltyShootoutNote) {
        penaltyShootoutNote.classList.remove('hidden');
        penaltyShootoutNote.textContent = `PENALTIES: ${homeTeam.shortName} (${penalties.home}) - (${penalties.away}) ${awayTeam.shortName}`;
      }

      if (tResult.champion) {
        // Player's team won the Grand Final: Tournament Champions!
        ftOutcome.textContent = `🏆 ${homeTeam.name.toUpperCase()} LIFT THE POCKET CUP!`;
        crazyGames.happytime();
        setTimeout(() => {
          showChampionScreen(homeTeam);
        }, 2200);
      } else if (tResult.isEliminated) {
        if (tResult.isFinal) {
          if (isPenaltyShootout) {
            ftOutcome.textContent = `🥈 RUNNERS UP! ${awayTeam.name.toUpperCase()} WINS ON PENALTIES & LIFTS THE CUP! 🏆`;
          } else if (isGoldenGoalWin) {
            ftOutcome.textContent = `🥈 RUNNERS UP! ${awayTeam.name.toUpperCase()} SCORES GOLDEN GOAL & LIFTS THE CUP! 🏆`;
          } else {
            ftOutcome.textContent = `🥈 RUNNERS UP! ${awayTeam.name.toUpperCase()} WINS THE FINAL & LIFTS THE CUP! 🏆`;
          }
        } else {
          if (isPenaltyShootout) {
            ftOutcome.textContent = `❌ ELIMINATED ON PENALTIES! ${awayTeam.name.toUpperCase()} ADVANCES.`;
          } else if (isGoldenGoalWin) {
            ftOutcome.textContent = `❌ GOLDEN GOAL DEFEAT! ${awayTeam.name.toUpperCase()} ADVANCES.`;
          } else {
            ftOutcome.textContent = `❌ ELIMINATED! ${awayTeam.name.toUpperCase()} ADVANCES.`;
          }
        }
        if (ftContinueTournamentBtn) {
          ftContinueTournamentBtn.textContent = 'View Bracket Tree';
        }
      } else {
        // Player won Quarter-Final or Semi-Final!
        if (isGoldenGoalWin || isPenaltyShootout) {
          crazyGames.happytime();
        }
        const nextRoundName = tournament.roundNames[tournament.currentRoundIndex] || 'Next Round';
        if (isPenaltyShootout) {
          ftOutcome.textContent = `🎉 VICTORY ON PENALTIES! ADVANCING TO ${nextRoundName.toUpperCase()}!`;
        } else if (isGoldenGoalWin) {
          ftOutcome.textContent = `⚡ GOLDEN GOAL VICTORY! ADVANCING TO ${nextRoundName.toUpperCase()}!`;
        } else {
          ftOutcome.textContent = `🎉 VICTORY! ADVANCING TO ${nextRoundName.toUpperCase()}!`;
        }
        if (ftContinueTournamentBtn) {
          ftContinueTournamentBtn.textContent = 'Continue Tournament 🏆';
        }
      }
    } else {
      // --- Quick Match Mode ---
      if (ftRematchBtn) ftRematchBtn.classList.remove('hidden');
      if (ftContinueTournamentBtn) ftContinueTournamentBtn.classList.add('hidden');

      if (isDraw || (!winner && score.blue === score.red)) {
        ftOutcome.textContent = `🤝 STALEMATE · MATCH DRAWN ${score.blue} - ${score.red}`;
        if (ftGoldenGoalBtn) {
          ftGoldenGoalBtn.classList.remove('hidden');
          ftGoldenGoalBtn.onclick = () => {
            clickSound();
            hideAllOverlays();
            if (activeEngine) {
              activeEngine.startGoldenGoalExtraTime();
            }
            updateTouchControlsVisibility();
          };
        }
      } else if (winner === 'blue') {
        if (isGoldenGoalWin) crazyGames.happytime();
        ftOutcome.textContent = isGoldenGoalWin
          ? `⚡ GOLDEN GOAL! ${homeTeam.name.toUpperCase()} WINS!`
          : `🎉 ${homeTeam.name.toUpperCase()} WINS!`;
      } else if (winner === 'red') {
        ftOutcome.textContent = isGoldenGoalWin
          ? `⚡ GOLDEN GOAL! ${awayTeam.name.toUpperCase()} WINS!`
          : `⚡ ${awayTeam.name.toUpperCase()} WINS!`;
      }
    }

    showScreen(fullTimeModal);
    updateTouchControlsVisibility();
  };

  // --- Match MVP Screen ---
  const showMatchMvpScreen = () => {
    const mvp = lastMatchMvp;
    if (!mvp) return;

    const roleNames = { GK: 'GOALKEEPER', DF: 'DEFENDER', FW: 'FORWARD' };
    const badgeRole = document.getElementById('mvpBadgeRole');
    const badgeRating = document.getElementById('mvpBadgeRating');
    const jerseyCircle = document.getElementById('mvpJerseyCircle');
    const numberDisplay = document.getElementById('mvpNumberDisplay');
    const playerName = document.getElementById('mvpPlayerName');
    const clubBadge = document.getElementById('mvpClubBadge');
    const clubName = document.getElementById('mvpClubName');
    const statGoals = document.getElementById('mvpStatGoals');
    const statAssists = document.getElementById('mvpStatAssists');
    const statTackles = document.getElementById('mvpStatTackles');
    const statPasses = document.getElementById('mvpStatPasses');
    const commentary = document.getElementById('mvpCommentary');
    const mvpRematchBtn = document.getElementById('mvpRematchBtn');
    const mvpContinueTournBtn = document.getElementById('mvpContinueTournBtn');

    if (badgeRole) badgeRole.textContent = roleNames[mvp.role] || mvp.role || 'PLAYER';
    if (badgeRating) badgeRating.textContent = `★ ${Number(mvp.rating || 8.0).toFixed(1)}`;
    if (jerseyCircle && mvp.teamConfig) {
      jerseyCircle.style.backgroundColor = mvp.role === 'GK'
        ? (mvp.teamConfig.gkColor || '#F59E0B')
        : (mvp.teamConfig.shirtColor || '#2563EB');
    }
    if (numberDisplay) numberDisplay.textContent = `#${mvp.number || 10}`;
    if (playerName) playerName.textContent = mvp.name || 'MVP';
    if (clubBadge) clubBadge.textContent = mvp.teamConfig?.badge || '⚽';
    if (clubName) {
      clubName.textContent = mvp.teamConfig?.name || 'Club';
      clubName.style.color = mvp.teamConfig?.accentColor || '#38BDF8';
    }
    if (statGoals) statGoals.textContent = mvp.stats?.goals ?? 0;
    if (statAssists) statAssists.textContent = mvp.stats?.assists ?? 0;
    if (statTackles) statTackles.textContent = mvp.stats?.tackles ?? 0;
    if (statPasses) statPasses.textContent = mvp.stats?.passes ?? 0;
    if (commentary) commentary.textContent = mvp.narrative || '';

    if (currentMode === 'TOURNAMENT') {
      if (mvpRematchBtn) mvpRematchBtn.classList.add('hidden');
      if (mvpContinueTournBtn) mvpContinueTournBtn.classList.remove('hidden');
    } else {
      if (mvpRematchBtn) mvpRematchBtn.classList.remove('hidden');
      if (mvpContinueTournBtn) mvpContinueTournBtn.classList.add('hidden');
    }

    showScreen(matchMvpModal);
  };

  // --- Champion Screen ---
  const showChampionScreen = (champTeam) => {
    const banner = document.getElementById('championTeamBanner');
    if (banner) {
      banner.textContent = `${champTeam.badge} ${champTeam.name.toUpperCase()} LIFTS THE POCKET CUP! ${champTeam.badge}`;
    }
    audio.playGoalChime();
    audio.swellCrowd(1.0, 4.0);
    crazyGames.happytime();
    showScreen(championModal);
  };

  // --- Quick Match Modal Setup ---
  const setupQuickMatchView = () => {
    const homePicker = document.getElementById('homeTeamPicker');
    const awayPicker = document.getElementById('awayTeamPicker');

    if (homePicker && awayPicker) {
      homePicker.innerHTML = '';
      awayPicker.innerHTML = '';

      TEAMS_LIST.forEach((team) => {
        // Home Card
        const hCard = document.createElement('div');
        hCard.className = `team-select-card ${team.id === quickMatchHomeTeamId ? 'selected' : ''}`;
        hCard.innerHTML = `
          <div class="team-card-badge">${team.badge}</div>
          <div class="team-card-info">
            <div class="team-card-name">${team.name}</div>
            <div class="team-card-meta">Rating: ${team.rating} · 1-1-1</div>
          </div>
          <div class="kit-swatch" style="background-color: ${team.shirtColor};"></div>
        `;
        hCard.onclick = () => {
          clickSound();
          quickMatchHomeTeamId = team.id;
          setupQuickMatchView();
        };
        homePicker.appendChild(hCard);

        // Away Card
        const aCard = document.createElement('div');
        aCard.className = `team-select-card ${team.id === quickMatchAwayTeamId ? 'selected-red' : ''}`;
        aCard.innerHTML = `
          <div class="team-card-badge">${team.badge}</div>
          <div class="team-card-info">
            <div class="team-card-name">${team.name}</div>
            <div class="team-card-meta">Rating: ${team.rating} · 1-1-1</div>
          </div>
          <div class="kit-swatch" style="background-color: ${team.shirtColor};"></div>
        `;
        aCard.onclick = () => {
          clickSound();
          quickMatchAwayTeamId = team.id;
          setupQuickMatchView();
        };
        awayPicker.appendChild(aCard);
      });
    }

    // Mode Pills (1P vs AI / 2P Local)
    const syncQuickModeUI = () => {
      const is2p = selectedQuickPlayersMode === '2p';
      document.querySelectorAll('#quickModePills .pill-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.playersMode === selectedQuickPlayersMode);
      });
      if (quickHomeColTitle) {
        quickHomeColTitle.textContent = is2p ? 'Player 1 · Home (WASD + Space)' : 'Your Team · Home';
      }
      if (quickAwayColTitle) {
        quickAwayColTitle.textContent = is2p ? 'Player 2 · Away (Arrows + J)' : 'Opponent · Away';
      }
      if (quickDifficultyBox) {
        quickDifficultyBox.classList.toggle('hidden', is2p);
      }
    };

    document.querySelectorAll('#quickModePills .pill-btn').forEach((btn) => {
      btn.onclick = () => {
        clickSound();
        const mode = btn.dataset.playersMode;
        if (mode === '1p' || mode === '2p') {
          selectedQuickPlayersMode = mode;
          syncQuickModeUI();
        }
      };
    });
    syncQuickModeUI();

    // Duration Pills
    const durationPills = document.querySelectorAll('#durationPills .pill-btn');
    durationPills.forEach((btn) => {
      const dur = parseInt(btn.dataset.duration, 10);
      btn.classList.toggle('active', dur === quickMatchDuration);
      btn.onclick = () => {
        clickSound();
        quickMatchDuration = dur;
        durationPills.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
      };
    });
  };

  // --- Tournament View Setup ---
  const renderTournamentBracket = () => {
    const teamSelectView = document.getElementById('tournamentTeamSelectView');
    const bracketView = document.getElementById('tournamentBracketView');
    const subtitle = document.getElementById('tournamentStatusSubtitle');

    if (!tournament.hasActiveTournament() && !tournament.isComplete) {
      // Need to select team and start tournament
      if (teamSelectView) teamSelectView.classList.remove('hidden');
      if (bracketView) bracketView.classList.add('hidden');
      if (subtitle) subtitle.textContent = 'Select Your Club';

      const grid = document.getElementById('tournamentTeamGrid');
      if (grid) {
        grid.innerHTML = '';
        TEAMS_LIST.forEach((team) => {
          const card = document.createElement('div');
          card.className = `team-select-card ${team.id === selectedTournamentTeamId ? 'selected' : ''}`;
          card.innerHTML = `
            <div class="team-card-badge">${team.badge}</div>
            <div class="team-card-info">
              <div class="team-card-name">${team.name}</div>
              <div class="team-card-meta">OVR ${team.rating}</div>
            </div>
            <div class="kit-swatch" style="background-color: ${team.shirtColor};"></div>
          `;
          card.onclick = () => {
            clickSound();
            selectedTournamentTeamId = team.id;
            renderTournamentBracket();
          };
          grid.appendChild(card);
        });
      }
      return;
    }

    // Active tournament exists: Render Bracket Tree
    if (teamSelectView) teamSelectView.classList.add('hidden');
    if (bracketView) bracketView.classList.remove('hidden');

    if (subtitle) {
      if (tournament.isComplete && tournament.championTeamId) {
        const champ = TEAMS[tournament.championTeamId] || { name: 'Champion', badge: '🏆' };
        subtitle.textContent = `Tournament Complete · ${champ.badge} ${champ.name.toUpperCase()} WON THE CUP! 🏆`;
      } else if (tournament.isEliminated) {
        subtitle.textContent = `Tournament Over · Eliminated in ${tournament.roundNames[tournament.currentRoundIndex]}`;
      } else {
        subtitle.textContent = `Current Stage: ${tournament.roundNames[tournament.currentRoundIndex]}`;
      }
    }

    const qfList = document.getElementById('qfFixturesList');
    const sfList = document.getElementById('sfFixturesList');
    const finalList = document.getElementById('finalFixturesList');

    const renderFixtures = (container, fixtures) => {
      if (!container) return;
      container.innerHTML = '';

      fixtures.forEach((f) => {
        const home = TEAMS[f.homeTeamId] || { name: 'TBD', badge: '⏳', shortName: 'TBD' };
        const away = TEAMS[f.awayTeamId] || { name: 'TBD', badge: '⏳', shortName: 'TBD' };

        const isPlayerMatch = f.homeTeamId === tournament.playerTeamId || f.awayTeamId === tournament.playerTeamId;
        const isActiveUpcoming = isPlayerMatch && !f.played;

        const card = document.createElement('div');
        card.className = `fixture-card ${isPlayerMatch ? 'player-fixture' : ''} ${isActiveUpcoming ? 'active-match' : ''}`;

        const homeWinner = f.winnerId === f.homeTeamId;
        const awayWinner = f.winnerId === f.awayTeamId;

        const homeShootout = f.shootout ? ` (${f.shootout.home})` : '';
        const awayShootout = f.shootout ? ` (${f.shootout.away})` : '';

        card.innerHTML = `
          <div class="fixture-team-row ${f.played ? (homeWinner ? 'winner' : 'loser') : ''}">
            <div class="fixture-team-left">
              <span>${home.badge}</span>
              <span>${home.name}</span>
            </div>
            <div class="fixture-score">${f.homeScore !== null ? f.homeScore + homeShootout : '-'}</div>
          </div>
          <div class="fixture-team-row ${f.played ? (awayWinner ? 'winner' : 'loser') : ''}">
            <div class="fixture-team-left">
              <span>${away.badge}</span>
              <span>${away.name}</span>
            </div>
            <div class="fixture-score">${f.awayScore !== null ? f.awayScore + awayShootout : '-'}</div>
          </div>
        `;
        container.appendChild(card);
      });
    };

    if (tournament.rounds[0]) renderFixtures(qfList, tournament.rounds[0].fixtures);
    if (tournament.rounds[1]) renderFixtures(sfList, tournament.rounds[1].fixtures);
    if (tournament.rounds[2]) renderFixtures(finalList, tournament.rounds[2].fixtures);

    const playBtn = document.getElementById('playTournamentMatchBtn');
    if (playBtn) {
      if (tournament.isComplete) {
        if (tournament.playerTeamId === tournament.championTeamId) {
          playBtn.textContent = '🏆 Champions (Cup Won!)';
        } else {
          const champ = TEAMS[tournament.championTeamId] || { name: 'Champion' };
          playBtn.textContent = `🏆 ${champ.name} Won The Cup`;
        }
        playBtn.disabled = true;
      } else if (tournament.isEliminated) {
        playBtn.textContent = '❌ You Were Eliminated';
        playBtn.disabled = true;
      } else {
        playBtn.textContent = `⚽ Play ${tournament.roundNames[tournament.currentRoundIndex]}`;
        playBtn.disabled = false;
      }
    }
  };

  // --- UI Event Handlers ---

  // Main Menu Buttons
  const startQuickMatchBtn = document.getElementById('startQuickMatchBtn');
  if (startQuickMatchBtn) {
    startQuickMatchBtn.addEventListener('click', () => {
      clickSound();
      currentMode = 'QUICK_MATCH';
      selectedQuickPlayersMode = '1p';
      setupQuickMatchView();
      showScreen(quickMatchModal);
    });
  }

  const startLocal2pBtn = document.getElementById('startLocal2pBtn');
  if (startLocal2pBtn) {
    startLocal2pBtn.addEventListener('click', () => {
      clickSound();
      currentMode = 'QUICK_MATCH';
      selectedQuickPlayersMode = '2p';
      setupQuickMatchView();
      showScreen(quickMatchModal);
    });
  }

  const openTournamentBtn = document.getElementById('openTournamentBtn');
  if (openTournamentBtn) {
    openTournamentBtn.addEventListener('click', () => {
      clickSound();
      currentMode = 'TOURNAMENT';
      renderTournamentBracket();
      showScreen(tournamentModal);
    });
  }

  const openSettingsBtn = document.getElementById('openSettingsBtn');
  if (openSettingsBtn) {
    openSettingsBtn.addEventListener('click', () => {
      clickSound();
      settingsReturnState = 'MENU';
      if (settingsPausedBadge) settingsPausedBadge.classList.add('hidden');
      if (pauseMatchActions) pauseMatchActions.classList.add('hidden');
      if (doneSettingsBtn) doneSettingsBtn.textContent = 'Done';
      showScreen(settingsModal);
    });
  }

  const openHelpBtn = document.getElementById('openHelpBtn');
  if (openHelpBtn) {
    openHelpBtn.addEventListener('click', () => {
      clickSound();
      showScreen(helpModal);
    });
  }

  // Quick Match Launch & Cancel
  const launchQuickMatchBtn = document.getElementById('launchQuickMatchBtn');
  if (launchQuickMatchBtn) {
    launchQuickMatchBtn.addEventListener('click', () => {
      clickSound();
      const homeTeam = TEAMS[quickMatchHomeTeamId] || TEAMS.waves;
      const awayTeam = TEAMS[quickMatchAwayTeamId] || TEAMS.strikers;
      showPreMatchIntro(homeTeam, awayTeam, quickMatchDuration, selectedQuickPlayersMode === '2p');
    });
  }

  const closeQuickMatchBtn = document.getElementById('closeQuickMatchBtn');
  const cancelQuickMatchBtn = document.getElementById('cancelQuickMatchBtn');
  [closeQuickMatchBtn, cancelQuickMatchBtn].forEach((btn) => {
    if (btn) {
      btn.addEventListener('click', () => {
        clickSound();
        returnToMainMenu();
      });
    }
  });

  // Tournament Actions
  const startTournamentCampaignBtn = document.getElementById('startTournamentCampaignBtn');
  if (startTournamentCampaignBtn) {
    startTournamentCampaignBtn.addEventListener('click', () => {
      clickSound();
      tournament.startNewTournament(selectedTournamentTeamId);
      updateTournamentBadge();
      renderTournamentBracket();
    });
  }

  const playTournamentMatchBtn = document.getElementById('playTournamentMatchBtn');
  if (playTournamentMatchBtn) {
    playTournamentMatchBtn.addEventListener('click', () => {
      clickSound();
      const fixture = tournament.getCurrentPlayerFixture();
      if (!fixture) return;

      const playerTeam = TEAMS[tournament.playerTeamId];
      const opponentId = fixture.homeTeamId === tournament.playerTeamId ? fixture.awayTeamId : fixture.homeTeamId;
      const opponentTeam = TEAMS[opponentId];

      showPreMatchIntro(playerTeam, opponentTeam, 120); // 2 minute cup match
    });
  }

  const abandonTournamentBtn = document.getElementById('abandonTournamentBtn');
  if (abandonTournamentBtn) {
    abandonTournamentBtn.addEventListener('click', () => {
      clickSound();
      tournament.clear();
      updateTournamentBadge();
      renderTournamentBracket();
    });
  }

  const closeTournamentBtn = document.getElementById('closeTournamentBtn');
  if (closeTournamentBtn) {
    closeTournamentBtn.addEventListener('click', () => {
      clickSound();
      returnToMainMenu();
    });
  }

  // Half-Time Actions
  const startSecondHalfBtn = document.getElementById('startSecondHalfBtn');
  if (startSecondHalfBtn) {
    startSecondHalfBtn.addEventListener('click', () => {
      clickSound();
      hideAllOverlays();
      runWithMidgameAd(() => {
        if (activeEngine) {
          activeEngine.startSecondHalf();
        }
        audio.setMusicDucked(false);
        audio.setMusicTrack(null);
        audio.startCrowdAmbience({ isTournamentFinal: !!(activeEngine && activeEngine.isTournamentFinal) });
        crazyGames.gameplayStart();
        updateTouchControlsVisibility();
      });
    });
  }

  const htReturnMenuBtn = document.getElementById('htReturnMenuBtn');
  if (htReturnMenuBtn) {
    htReturnMenuBtn.addEventListener('click', () => {
      clickSound();
      returnToMainMenu();
    });
  }

  // Full-time Actions
  const triggerRematch = () => {
    const homeTeam = lastActiveHomeTeam || TEAMS[quickMatchHomeTeamId] || TEAMS.waves;
    const awayTeam = lastActiveAwayTeam || TEAMS[quickMatchAwayTeamId] || TEAMS.strikers;
    const dur = lastActiveDuration || quickMatchDuration;
    const is2p = lastActiveIsLocal2p;
    runWithMidgameAd(() => {
      showPreMatchIntro(homeTeam, awayTeam, dur, is2p);
    });
  };

  const ftViewMvpBtn = document.getElementById('ftViewMvpBtn');
  if (ftViewMvpBtn) {
    ftViewMvpBtn.addEventListener('click', () => {
      clickSound();
      showMatchMvpScreen();
    });
  }

  const ftRematchBtn = document.getElementById('ftRematchBtn');
  if (ftRematchBtn) {
    ftRematchBtn.addEventListener('click', () => {
      clickSound();
      triggerRematch();
    });
  }

  const ftContinueTournamentBtn = document.getElementById('ftContinueTournamentBtn');
  if (ftContinueTournamentBtn) {
    ftContinueTournamentBtn.addEventListener('click', () => {
      clickSound();
      runWithMidgameAd(() => {
        audio.setMusicTrack('menu');
        updateTournamentBadge();
        renderTournamentBracket();
        showScreen(tournamentModal);
      });
    });
  }

  const ftReturnMenuBtn = document.getElementById('ftReturnMenuBtn');
  if (ftReturnMenuBtn) {
    ftReturnMenuBtn.addEventListener('click', () => {
      clickSound();
      returnToMainMenu();
    });
  }

  // Match MVP Modal Actions
  const mvpBackToScoreBtn = document.getElementById('mvpBackToScoreBtn');
  if (mvpBackToScoreBtn) {
    mvpBackToScoreBtn.addEventListener('click', () => {
      clickSound();
      showScreen(fullTimeModal);
    });
  }

  const mvpRematchBtn = document.getElementById('mvpRematchBtn');
  if (mvpRematchBtn) {
    mvpRematchBtn.addEventListener('click', () => {
      clickSound();
      triggerRematch();
    });
  }

  const mvpContinueTournBtn = document.getElementById('mvpContinueTournBtn');
  if (mvpContinueTournBtn) {
    mvpContinueTournBtn.addEventListener('click', () => {
      clickSound();
      runWithMidgameAd(() => {
        audio.setMusicTrack('menu');
        updateTournamentBadge();
        renderTournamentBracket();
        showScreen(tournamentModal);
      });
    });
  }

  const mvpReturnMenuBtn = document.getElementById('mvpReturnMenuBtn');
  if (mvpReturnMenuBtn) {
    mvpReturnMenuBtn.addEventListener('click', () => {
      clickSound();
      returnToMainMenu();
    });
  }

  const championReturnMenuBtn = document.getElementById('championReturnMenuBtn');
  if (championReturnMenuBtn) {
    championReturnMenuBtn.addEventListener('click', () => {
      clickSound();
      returnToMainMenu();
    });
  }

  // --- Fullscreen Toggle Logic ---
  const getFullscreenElement = () =>
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement;

  const updateFullscreenButtons = () => {
    const active = !!getFullscreenElement();
    if (fullscreenBtn) {
      fullscreenBtn.textContent = active ? '⛶ Exit' : '⛶ Full';
      fullscreenBtn.title = active ? 'Exit Full Screen' : 'Enter Full Screen';
    }
    if (menuFullscreenBtn) {
      menuFullscreenBtn.textContent = active ? '⛶ Exit Full Screen' : '⛶ Full Screen';
      menuFullscreenBtn.title = active ? 'Exit Full Screen' : 'Enter Full Screen';
    }
  };

  const toggleFullscreen = async () => {
    const target = document.documentElement;
    try {
      if (!getFullscreenElement()) {
        if (target.requestFullscreen) {
          await target.requestFullscreen();
        } else if (target.webkitRequestFullscreen) {
          await target.webkitRequestFullscreen();
        } else if (target.msRequestFullscreen) {
          await target.msRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
          await document.msExitFullscreen();
        }
      }
    } catch (e) {
      // Gracefully ignore if browser or embedded context restricts fullscreen
    }
  };

  [fullscreenBtn, menuFullscreenBtn].forEach((btn) => {
    if (btn) {
      btn.addEventListener('click', () => {
        clickSound();
        toggleFullscreen();
      });
    }
  });

  ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'].forEach((evt) => {
    document.addEventListener(evt, () => {
      updateFullscreenButtons();
      if (activeEngine) {
        setTimeout(() => activeEngine.resize(), 60);
      }
    });
  });

  window.addEventListener('orientationchange', () => {
    if (activeEngine) {
      setTimeout(() => activeEngine.resize(), 120);
    }
    updateTouchControlsVisibility();
  });

  window.addEventListener('resize', () => {
    updateTouchControlsVisibility();
  });

  updateFullscreenButtons();

  // --- Mobile On-Screen Touch Controls (Multi-Touch Pointer Events) ---
  if (touchControlsOverlay) {
    touchControlsOverlay.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  if (touchJoystickZone && touchJoystickBase && touchJoystickKnob) {
    let activeJoystickPointerId = null;
    let anchorX = 0;
    let anchorY = 0;
    const maxRadius = 44;

    resetTouchJoystickVisual = () => {
      activeJoystickPointerId = null;
      touchJoystickBase.classList.remove('active');
      touchJoystickBase.style.transform = 'translate(0px, 0px)';
      touchJoystickKnob.style.transform = 'translate(0px, 0px)';
      if (activeEngine && activeEngine.input) {
        activeEngine.input.setTouchJoystick(false, 0, 0);
      }
    };

    const updateJoystickFromPoint = (clientX, clientY) => {
      const rect = touchJoystickZone.getBoundingClientRect();
      const localX = clientX - rect.left;
      const localY = clientY - rect.top;

      const dx = localX - anchorX;
      const dy = localY - anchorY;
      const dist = Math.hypot(dx, dy);

      if (dist <= 5) {
        touchJoystickKnob.style.transform = 'translate(0px, 0px)';
        if (activeEngine && activeEngine.input) {
          activeEngine.input.setTouchJoystick(true, 0, 0);
        }
        return;
      }

      const clamped = Math.min(dist, maxRadius);
      const nx = dx / dist;
      const ny = dy / dist;
      const ratio = clamped / maxRadius;

      const knobX = nx * clamped;
      const knobY = ny * clamped;
      touchJoystickKnob.style.transform = `translate(${knobX}px, ${knobY}px)`;

      if (activeEngine && activeEngine.input) {
        activeEngine.input.setTouchJoystick(true, nx * ratio, ny * ratio);
      }
    };

    touchJoystickZone.addEventListener('pointerdown', (e) => {
      if (activeJoystickPointerId !== null) return;
      e.preventDefault();
      hasDetectedTouch = true;
      activeJoystickPointerId = e.pointerId;
      try {
        touchJoystickZone.setPointerCapture(e.pointerId);
      } catch (err) {}

      const rect = touchJoystickZone.getBoundingClientRect();
      const localX = e.clientX - rect.left;
      const localY = e.clientY - rect.top;
      const pad = 42;
      anchorX = Math.max(pad, Math.min(rect.width - pad, localX));
      anchorY = Math.max(pad, Math.min(rect.height - pad, localY));

      touchJoystickBase.classList.add('active');
      touchJoystickBase.style.transform = `translate(${anchorX - rect.width / 2}px, ${anchorY - rect.height / 2}px)`;
      updateJoystickFromPoint(e.clientX, e.clientY);
    });

    touchJoystickZone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== activeJoystickPointerId) return;
      e.preventDefault();
      updateJoystickFromPoint(e.clientX, e.clientY);
    });

    const endJoystickPointer = (e) => {
      if (e.pointerId !== activeJoystickPointerId) return;
      e.preventDefault();
      try {
        touchJoystickZone.releasePointerCapture(e.pointerId);
      } catch (err) {}
      resetTouchJoystickVisual();
    };

    touchJoystickZone.addEventListener('pointerup', endJoystickPointer);
    touchJoystickZone.addEventListener('pointercancel', endJoystickPointer);
    touchJoystickZone.addEventListener('lostpointercapture', endJoystickPointer);
  }

  const bindTouchHoldButton = (btnEl, onStart, onEnd) => {
    if (!btnEl) return;
    let activePointerId = null;

    btnEl.addEventListener('pointerdown', (e) => {
      if (activePointerId !== null) return;
      e.preventDefault();
      hasDetectedTouch = true;
      activePointerId = e.pointerId;
      btnEl.classList.add('pressed');
      try {
        btnEl.setPointerCapture(e.pointerId);
      } catch (err) {}
      onStart();
    });

    const release = (e) => {
      if (e.pointerId !== activePointerId) return;
      e.preventDefault();
      activePointerId = null;
      btnEl.classList.remove('pressed');
      try {
        btnEl.releasePointerCapture(e.pointerId);
      } catch (err) {}
      onEnd();
    };

    btnEl.addEventListener('pointerup', release);
    btnEl.addEventListener('pointercancel', release);
    btnEl.addEventListener('lostpointercapture', release);
  };

  bindTouchHoldButton(
    touchShootBtn,
    () => activeEngine?.input?.startTouchKick(),
    () => activeEngine?.input?.endTouchKick()
  );

  bindTouchHoldButton(
    touchPassBtn,
    () => activeEngine?.input?.startTouchPass(),
    () => activeEngine?.input?.endTouchPass()
  );

  if (touchSwitchBtn) {
    touchSwitchBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      hasDetectedTouch = true;
      touchSwitchBtn.classList.add('pressed');
      activeEngine?.input?.requestTouchSwitch();
    });
    const releaseSwitch = () => touchSwitchBtn.classList.remove('pressed');
    touchSwitchBtn.addEventListener('pointerup', releaseSwitch);
    touchSwitchBtn.addEventListener('pointercancel', releaseSwitch);
    touchSwitchBtn.addEventListener('pointerleave', releaseSwitch);
  }

  // Touch Controls Mode Pills in Settings (Auto / On / Off)
  const touchModePills = document.querySelectorAll('#touchModePills .pill-btn');
  const syncTouchModePills = () => {
    touchModePills.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.touchMode === touchControlsPref);
    });
  };
  syncTouchModePills();
  touchModePills.forEach((btn) => {
    btn.addEventListener('click', () => {
      clickSound();
      const mode = btn.dataset.touchMode;
      if (mode === 'auto' || mode === 'on' || mode === 'off') {
        touchControlsPref = mode;
        try {
          localStorage.setItem(TOUCH_MODE_KEY, mode);
        } catch (e) {}
        syncTouchModePills();
        updateTouchControlsVisibility();
      }
    });
  });

  // AI Difficulty Pills (synced across Quick Match, Tournament, and Settings)
  const difficultyGroups = document.querySelectorAll('[data-difficulty-group]');
  const syncDifficultyPills = () => {
    difficultyGroups.forEach((group) => {
      group.querySelectorAll('[data-difficulty]').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.difficulty === selectedDifficulty);
      });
    });
  };
  syncDifficultyPills();
  difficultyGroups.forEach((group) => {
    group.querySelectorAll('[data-difficulty]').forEach((btn) => {
      btn.addEventListener('click', () => {
        clickSound();
        const diff = btn.dataset.difficulty;
        if (diff === 'easy' || diff === 'normal' || diff === 'hard') {
          selectedDifficulty = diff;
          try {
            localStorage.setItem(DIFFICULTY_KEY, diff);
          } catch (e) {}
          syncDifficultyPills();
          if (activeEngine && !activeEngine.isMenuIdle && activeEngine.setDifficulty) {
            activeEngine.setDifficulty(diff);
          }
        }
      });
    });
  });

  if (cameraBtn) {
    cameraBtn.addEventListener('click', () => {
      clickSound();
      if (activeEngine) {
        const mode = activeEngine.camera.toggleMode();
        cameraBtn.textContent = mode === 'FOLLOW' ? 'Cam: Dynamic' : 'Cam: Overview';
      }
    });
  }

  if (soundQuickBtn) {
    soundQuickBtn.addEventListener('click', () => {
      clickSound();
      const unmuted = audio.toggleSound();
      soundQuickBtn.textContent = unmuted ? '🔊 Sound' : '🔇 Muted';
      const muteBtn = document.getElementById('muteToggleBtn');
      if (muteBtn) muteBtn.textContent = unmuted ? 'Mute Audio' : 'Unmute Audio';
    });
  }

  if (inGameMenuBtn) {
    inGameMenuBtn.addEventListener('click', () => {
      clickSound();
      returnToMainMenu();
    });
  }

  const openPauseMenu = () => {
    if (appState !== 'PLAYING' || !activeEngine || activeEngine.isFullTime || activeEngine.isHalfTime) return;
    settingsReturnState = 'PLAYING';
    activeEngine.setPaused(true);
    audio.setMusicDucked(true);
    audio.setCrowdPaused(true);
    crazyGames.gameplayStop();
    if (settingsPausedBadge) settingsPausedBadge.classList.remove('hidden');
    if (pauseMatchActions) pauseMatchActions.classList.remove('hidden');
    if (doneSettingsBtn) doneSettingsBtn.textContent = 'Resume Match';
    showScreen(settingsModal);
    updateTouchControlsVisibility();
  };

  const closePauseAndResume = () => {
    if (settingsPausedBadge) settingsPausedBadge.classList.add('hidden');
    if (pauseMatchActions) pauseMatchActions.classList.add('hidden');
    if (doneSettingsBtn) doneSettingsBtn.textContent = 'Done';
    if (settingsReturnState === 'PLAYING' && appState === 'PLAYING') {
      hideAllOverlays();
      audio.setMusicDucked(false);
      audio.setCrowdPaused(false);
      if (activeEngine) {
        activeEngine.setPaused(false);
      }
      crazyGames.gameplayStart();
      updateTouchControlsVisibility();
    } else {
      audio.setMusicDucked(false);
      audio.setCrowdPaused(false);
      showScreen(mainMenuOverlay);
    }
  };

  if (headerSettingsBtn) {
    headerSettingsBtn.addEventListener('click', () => {
      clickSound();
      if (settingsModal && settingsModal.classList.contains('active') && settingsReturnState === 'PLAYING') {
        closePauseAndResume();
      } else {
        openPauseMenu();
      }
    });
  }

  if (pauseRestartBtn) {
    pauseRestartBtn.addEventListener('click', () => {
      clickSound();
      if (settingsPausedBadge) settingsPausedBadge.classList.add('hidden');
      if (pauseMatchActions) pauseMatchActions.classList.add('hidden');
      const home = lastActiveHomeTeam || TEAMS[quickMatchHomeTeamId] || TEAMS.waves;
      const away = lastActiveAwayTeam || TEAMS[quickMatchAwayTeamId] || TEAMS.strikers;
      startMatch(home, away, lastActiveDuration || quickMatchDuration, lastActiveIsLocal2p);
    });
  }

  if (pauseMainMenuBtn) {
    pauseMainMenuBtn.addEventListener('click', () => {
      clickSound();
      if (settingsPausedBadge) settingsPausedBadge.classList.add('hidden');
      if (pauseMatchActions) pauseMatchActions.classList.add('hidden');
      returnToMainMenu();
    });
  }

  // Keyboard Escape / P Pause Toggle during Match
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Escape' && e.code !== 'KeyP') return;
    if (appState !== 'PLAYING' || !activeEngine || activeEngine.isFullTime || activeEngine.isHalfTime) return;
    if (settingsModal && settingsModal.classList.contains('active') && settingsReturnState === 'PLAYING') {
      e.preventDefault();
      closePauseAndResume();
    } else if (!allOverlays.some((o) => o && o.classList.contains('active'))) {
      e.preventDefault();
      openPauseMenu();
    }
  });

  // Mouse wheel zoom on canvas
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (activeEngine) {
      const delta = e.deltaY < 0 ? 0.05 : -0.05;
      activeEngine.camera.adjustZoom(delta);
    }
  }, { passive: false });

  // Settings Sliders (persisted in localStorage)
  const AUDIO_PREFS_KEY = 'pocket_football_audio_prefs';
  const masterSlider = document.getElementById('masterVolumeSlider');
  const masterVal = document.getElementById('masterVolumeVal');
  const musicSlider = document.getElementById('musicVolumeSlider');
  const musicVal = document.getElementById('musicVolumeVal');
  const sfxSlider = document.getElementById('sfxVolumeSlider');
  const sfxVal = document.getElementById('sfxVolumeVal');

  const saveAudioPrefs = () => {
    try {
      localStorage.setItem(AUDIO_PREFS_KEY, JSON.stringify({
        master: Math.round(audio.masterVolume * 100),
        music: Math.round(audio.musicVolume * 100),
        sfx: Math.round(audio.sfxVolume * 100),
      }));
    } catch (e) {}
  };

  try {
    const rawPrefs = localStorage.getItem(AUDIO_PREFS_KEY);
    if (rawPrefs) {
      const parsed = JSON.parse(rawPrefs);
      if (Number.isFinite(parsed.master)) {
        const m = Math.max(0, Math.min(100, parsed.master));
        audio.setMasterVolume(m / 100);
        if (masterSlider) masterSlider.value = String(m);
        if (masterVal) masterVal.textContent = `${m}%`;
      }
      if (Number.isFinite(parsed.music)) {
        const mu = Math.max(0, Math.min(100, parsed.music));
        audio.setMusicVolume(mu / 100);
        if (musicSlider) musicSlider.value = String(mu);
        if (musicVal) musicVal.textContent = `${mu}%`;
      }
      if (Number.isFinite(parsed.sfx)) {
        const sx = Math.max(0, Math.min(100, parsed.sfx));
        audio.setSfxVolume(sx / 100);
        if (sfxSlider) sfxSlider.value = String(sx);
        if (sfxVal) sfxVal.textContent = `${sx}%`;
      }
    }
  } catch (e) {}

  if (masterSlider) {
    masterSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      if (masterVal) masterVal.textContent = `${val}%`;
      audio.setMasterVolume(val / 100);
      saveAudioPrefs();
    });
  }

  if (musicSlider) {
    musicSlider.addEventListener('input', (e) => {
      audio.init();
      const val = parseInt(e.target.value, 10);
      if (musicVal) musicVal.textContent = `${val}%`;
      audio.setMusicVolume(val / 100);
      saveAudioPrefs();
    });
  }

  if (sfxSlider) {
    sfxSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      if (sfxVal) sfxVal.textContent = `${val}%`;
      audio.setSfxVolume(val / 100);
      saveAudioPrefs();
    });
  }

  const muteToggleBtn = document.getElementById('muteToggleBtn');
  if (muteToggleBtn) {
    muteToggleBtn.addEventListener('click', () => {
      clickSound();
      const unmuted = audio.toggleSound();
      muteToggleBtn.textContent = unmuted ? 'Mute Audio' : 'Unmute Audio';
      if (soundQuickBtn) soundQuickBtn.textContent = unmuted ? '🔊 Sound' : '🔇 Muted';
    });
  }

  // Close Settings Modal: Always returns to where you opened it & unpauses!
  const closeSettingsBtn = document.getElementById('closeSettingsBtn');
  [closeSettingsBtn, doneSettingsBtn].forEach((btn) => {
    if (btn) {
      btn.addEventListener('click', () => {
        clickSound();
        closePauseAndResume();
      });
    }
  });

  // Close How to Play: ALWAYS returns to Main Menu!
  const closeHelpBtn = document.getElementById('closeHelpBtn');
  const doneHelpBtn = document.getElementById('doneHelpBtn');
  [closeHelpBtn, doneHelpBtn].forEach((btn) => {
    if (btn) {
      btn.addEventListener('click', () => {
        clickSound();
        showScreen(mainMenuOverlay);
      });
    }
  });

  // Adaptive menu footer hint for touch vs desktop devices
  if (menuControlsHint && isCoarsePointer()) {
    menuControlsHint.textContent = 'Touch Controls Ready · Left thumb moves · Right buttons Pass, Shoot & Tackle';
  }

  // --- Background Ambience for Menu ---
  const setupIdleMenuBackground = () => {
    if (activeEngine) activeEngine.stop();
    activeEngine = new GameEngine(
      canvas,
      {},
      {
        homeTeam: TEAMS.waves,
        awayTeam: TEAMS.strikers,
        duration: 99999,
        isSilent: true,
        isMenuIdle: true
      }
    );
    activeEngine.start();
  };

  // Initial State: Main Menu
  returnToMainMenu();
  console.log('Pocket Football League - Tie logic, menu presentation & modals initialized successfully!');
});
