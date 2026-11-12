/**
 * Main Entry Point for Pocket Football League
 * Coordinates UI Overlays, Match Presentation, Procedural Audio, and Game Modes
 * Pure Vanilla JavaScript & HTML5 Canvas 2D
 */
import { GameEngine } from './game/engine.js';
import { TEAMS, TEAMS_LIST } from './game/constants.js';
import { AudioManager } from './game/audio.js';
import { TournamentManager } from './game/tournament.js';

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('gameCanvas');
  if (!canvas) {
    console.error('Canvas element #gameCanvas not found.');
    return;
  }

  // --- Shared Audio & Tournament Systems ---
  const audio = new AudioManager();
  const tournament = new TournamentManager();

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
  const fullTimeModal = document.getElementById('fullTimeModal');
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
  const playerTagEl = document.getElementById('playerTag');
  const cameraBtn = document.getElementById('cameraBtn');
  const soundQuickBtn = document.getElementById('soundQuickBtn');
  const passBtn = document.getElementById('passBtn');
  const shootBtn = document.getElementById('shootBtn');
  const switchPlayerBtn = document.getElementById('switchPlayerBtn');
  const inGameMenuBtn = document.getElementById('inGameMenuBtn');
  const headerSettingsBtn = document.getElementById('headerSettingsBtn');
  const penaltyShootoutNote = document.getElementById('penaltyShootoutNote');
  const ftGoldenGoalBtn = document.getElementById('ftGoldenGoalBtn');

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
  let lastActiveHomeTeam = null;
  let lastActiveAwayTeam = null;

  // Tournament specific setup
  let selectedTournamentTeamId = 'waves';

  // --- Screen State Manager ---
  const allOverlays = [
    mainMenuOverlay,
    quickMatchModal,
    preMatchOverlay,
    tournamentModal,
    fullTimeModal,
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

  // Transition back to Main Menu
  const returnToMainMenu = () => {
    appState = 'MENU';
    if (activeEngine) {
      activeEngine.stop();
    }
    if (inGameHeader) {
      inGameHeader.classList.add('hidden');
    }
    updateTournamentBadge();
    showScreen(mainMenuOverlay);

    // Warm up idle stadium background
    setupIdleMenuBackground();
  };

  // --- Launch A Match (Quick Match or Tournament) ---
  const startMatch = (homeTeamConfig, awayTeamConfig, durationSecs) => {
    appState = 'PLAYING';
    hideAllOverlays();

    lastActiveHomeTeam = homeTeamConfig;
    lastActiveAwayTeam = awayTeamConfig;

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

    // Create New Engine instance
    activeEngine = new GameEngine(
      canvas,
      {
        onScoreChanged: (score, scoringTeam) => {
          if (scoreBlueEl) scoreBlueEl.textContent = score.blue;
          if (scoreRedEl) scoreRedEl.textContent = score.red;
        },
        onTimeUpdated: (remainingSeconds) => {
          if (matchClockEl) {
            matchClockEl.textContent = formatTime(remainingSeconds);
            if (activeEngine && activeEngine.isGoldenGoal) {
              matchClockEl.textContent = `ET ${formatTime(remainingSeconds)}`;
            }
          }
        },
        onControlledPlayerChanged: (player) => {
          if (playerTagEl) playerTagEl.textContent = `P1: #${player.number} (${player.role})`;
        },
        onCameraModeChanged: (mode) => {
          if (cameraBtn) {
            cameraBtn.textContent = mode === 'FOLLOW' ? 'Cam: Dynamic' : 'Cam: Overview';
          }
        },
        onGoldenGoalStarted: () => {
          if (playerTagEl) playerTagEl.textContent = '⚡ GOLDEN GOAL: NEXT GOAL WINS! ⚡';
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
        audio: audio
      }
    );

    activeEngine.start();
  };

  // --- Show Pre-Match Broadcast Intro Screen ---
  const showPreMatchIntro = (homeTeamConfig, awayTeamConfig, durationSecs) => {
    // Populate Left Card
    const preHomeBadge = document.getElementById('preHomeBadge');
    const preHomeName = document.getElementById('preHomeName');
    const preHomeLineup = document.getElementById('preHomeLineup');
    const preHomeCard = document.getElementById('preMatchHomeCard');

    if (preHomeBadge) preHomeBadge.textContent = homeTeamConfig.badge;
    if (preHomeName) preHomeName.textContent = homeTeamConfig.name;
    if (preHomeCard) preHomeCard.style.borderColor = homeTeamConfig.accentColor || homeTeamConfig.shirtColor;

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

    if (preAwayLineup && awayTeamConfig.roster) {
      preAwayLineup.innerHTML = `
        <div class="lineup-item"><span class="lineup-role">GK</span> <span>#${awayTeamConfig.roster.gk.number} ${awayTeamConfig.roster.gk.name}</span></div>
        <div class="lineup-item"><span class="lineup-role">DF</span> <span>#${awayTeamConfig.roster.df.number} ${awayTeamConfig.roster.df.name}</span></div>
        <div class="lineup-item"><span class="lineup-role">FW</span> <span>#${awayTeamConfig.roster.fw.number} ${awayTeamConfig.roster.fw.name}</span></div>
      `;
    }

    const preDurationText = document.getElementById('preDurationText');
    if (preDurationText) {
      preDurationText.textContent = `${Math.floor(durationSecs / 60)}:00 ${currentMode === 'TOURNAMENT' ? 'CUP KNOCKOUT' : 'MATCH'}`;
    }

    showScreen(preMatchOverlay);

    // Setup Kickoff button handler
    const kickoffBtn = document.getElementById('preMatchKickoffBtn');
    if (kickoffBtn) {
      kickoffBtn.onclick = () => {
        clickSound();
        startMatch(homeTeamConfig, awayTeamConfig, durationSecs);
      };
    }
  };

  // --- Match Finished / Results Presentation with Comprehensive Tie Logic ---
  const handleMatchFinished = ({ score, homeTeam, awayTeam, winner, isDraw, isGoldenGoalWin, isPenaltyShootout, penalties, scorer }) => {
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
        setTimeout(() => {
          showChampionScreen(homeTeam);
        }, 2200);
      } else if (tResult.isEliminated) {
        if (tResult.isFinal) {
          // Player reached the Grand Final but lost to awayTeam:
          // The opposing team won the tournament and lifts the cup!
          if (isPenaltyShootout) {
            ftOutcome.textContent = `🥈 RUNNERS UP! ${awayTeam.name.toUpperCase()} WINS ON PENALTIES & LIFTS THE CUP! 🏆`;
          } else if (isGoldenGoalWin) {
            ftOutcome.textContent = `🥈 RUNNERS UP! ${awayTeam.name.toUpperCase()} SCORES GOLDEN GOAL & LIFTS THE CUP! 🏆`;
          } else {
            ftOutcome.textContent = `🥈 RUNNERS UP! ${awayTeam.name.toUpperCase()} WINS THE FINAL & LIFTS THE CUP! 🏆`;
          }
        } else {
          // Earlier round defeat (Quarter-Finals or Semi-Finals)
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
        // Authentic Draw!
        ftOutcome.textContent = `🤝 STALEMATE · MATCH DRAWN ${score.blue} - ${score.red}`;
        // Show Golden Goal button for instant tie resolution
        if (ftGoldenGoalBtn) {
          ftGoldenGoalBtn.classList.remove('hidden');
          ftGoldenGoalBtn.onclick = () => {
            clickSound();
            hideAllOverlays();
            if (activeEngine) {
              activeEngine.startGoldenGoalExtraTime();
            }
          };
        }
      } else if (winner === 'blue') {
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
  };

  // --- Champion Screen ---
  const showChampionScreen = (champTeam) => {
    const banner = document.getElementById('championTeamBanner');
    if (banner) {
      banner.textContent = `${champTeam.badge} ${champTeam.name.toUpperCase()} LIFTS THE POCKET CUP! ${champTeam.badge}`;
    }
    audio.playGoalChime();
    audio.swellCrowd(1.0, 4.0);
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
      showPreMatchIntro(homeTeam, awayTeam, quickMatchDuration);
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

  // Full-time Actions
  const ftRematchBtn = document.getElementById('ftRematchBtn');
  if (ftRematchBtn) {
    ftRematchBtn.addEventListener('click', () => {
      clickSound();
      const homeTeam = lastActiveHomeTeam || TEAMS[quickMatchHomeTeamId] || TEAMS.waves;
      const awayTeam = lastActiveAwayTeam || TEAMS[quickMatchAwayTeamId] || TEAMS.strikers;
      showPreMatchIntro(homeTeam, awayTeam, quickMatchDuration);
    });
  }

  const ftContinueTournamentBtn = document.getElementById('ftContinueTournamentBtn');
  if (ftContinueTournamentBtn) {
    ftContinueTournamentBtn.addEventListener('click', () => {
      clickSound();
      updateTournamentBadge();
      renderTournamentBracket();
      showScreen(tournamentModal);
    });
  }

  const ftReturnMenuBtn = document.getElementById('ftReturnMenuBtn');
  if (ftReturnMenuBtn) {
    ftReturnMenuBtn.addEventListener('click', () => {
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

  // In-Game HUD Controls with Hold-to-Charge Power Support
  if (passBtn) {
    const startPass = (e) => {
      if (activeEngine) {
        activeEngine.input.touchPassHeld = true;
        activeEngine.input.passRequested = true;
      }
    };
    const endPass = () => {
      if (activeEngine) activeEngine.input.touchPassHeld = false;
    };
    passBtn.addEventListener('mousedown', startPass);
    window.addEventListener('mouseup', endPass);
    passBtn.addEventListener('touchstart', startPass, { passive: true });
    passBtn.addEventListener('touchend', endPass, { passive: true });
  }

  if (shootBtn) {
    const startShoot = (e) => {
      if (activeEngine) {
        activeEngine.input.touchKickHeld = true;
        activeEngine.input.kickRequested = true;
      }
    };
    const endShoot = () => {
      if (activeEngine) activeEngine.input.touchKickHeld = false;
    };
    shootBtn.addEventListener('mousedown', startShoot);
    window.addEventListener('mouseup', endShoot);
    shootBtn.addEventListener('touchstart', startShoot, { passive: true });
    shootBtn.addEventListener('touchend', endShoot, { passive: true });
  }

  if (switchPlayerBtn) {
    switchPlayerBtn.addEventListener('click', () => {
      if (activeEngine) activeEngine.switchControlledPlayer();
    });
  }

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

  if (headerSettingsBtn) {
    headerSettingsBtn.addEventListener('click', () => {
      clickSound();
      settingsReturnState = 'PLAYING';
      showScreen(settingsModal);
    });
  }

  // Mouse wheel zoom on canvas
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (activeEngine) {
      const delta = e.deltaY < 0 ? 0.05 : -0.05;
      activeEngine.camera.adjustZoom(delta);
    }
  }, { passive: false });

  // Settings Sliders
  const masterSlider = document.getElementById('masterVolumeSlider');
  const masterVal = document.getElementById('masterVolumeVal');
  if (masterSlider) {
    masterSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      if (masterVal) masterVal.textContent = `${val}%`;
      audio.setMasterVolume(val / 100);
    });
  }

  const sfxSlider = document.getElementById('sfxVolumeSlider');
  const sfxVal = document.getElementById('sfxVolumeVal');
  if (sfxSlider) {
    sfxSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      if (sfxVal) sfxVal.textContent = `${val}%`;
      audio.setSfxVolume(val / 100);
    });
  }

  const crowdSlider = document.getElementById('crowdVolumeSlider');
  const crowdVal = document.getElementById('crowdVolumeVal');
  if (crowdSlider) {
    crowdSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      if (crowdVal) crowdVal.textContent = `${val}%`;
      audio.setCrowdVolume(val / 100);
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

  // Close Settings Modal: Always returns to where you opened it!
  const closeSettingsBtn = document.getElementById('closeSettingsBtn');
  const doneSettingsBtn = document.getElementById('doneSettingsBtn');
  [closeSettingsBtn, doneSettingsBtn].forEach((btn) => {
    if (btn) {
      btn.addEventListener('click', () => {
        clickSound();
        if (settingsReturnState === 'PLAYING' && appState === 'PLAYING') {
          hideAllOverlays();
        } else {
          showScreen(mainMenuOverlay);
        }
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
