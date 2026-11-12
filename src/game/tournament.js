/**
 * Tournament Mode Manager
 * Handles 8-team knockout bracket, AI match simulation, round progression,
 * and localStorage persistence for continuing tournaments across browser sessions.
 */
import { TEAMS } from './constants.js';

const STORAGE_KEY = 'pocket_football_tournament_v1';

export class TournamentManager {
  constructor() {
    this.playerTeamId = null;
    this.currentRoundIndex = 0; // 0: Quarter-Finals, 1: Semi-Finals, 2: Final
    this.rounds = [];
    this.isComplete = false;
    this.isEliminated = false;
    this.championTeamId = null;

    this.roundNames = ['Quarter-Finals', 'Semi-Finals', 'The Grand Final'];
    this.load();
  }

  hasActiveTournament() {
    return !!(this.playerTeamId && !this.isComplete && !this.isEliminated);
  }

  getSavedTournament() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return null;
  }

  load() {
    const data = this.getSavedTournament();
    if (!data) return false;

    this.playerTeamId = data.playerTeamId;
    this.currentRoundIndex = data.currentRoundIndex || 0;
    this.rounds = data.rounds || [];
    this.isComplete = !!data.isComplete;
    this.isEliminated = !!data.isEliminated;
    this.championTeamId = data.championTeamId || null;
    return true;
  }

  save() {
    try {
      const data = {
        playerTeamId: this.playerTeamId,
        currentRoundIndex: this.currentRoundIndex,
        rounds: this.rounds,
        isComplete: this.isComplete,
        isEliminated: this.isEliminated,
        championTeamId: this.championTeamId,
        savedAt: Date.now()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {}
  }

  clear() {
    this.playerTeamId = null;
    this.currentRoundIndex = 0;
    this.rounds = [];
    this.isComplete = false;
    this.isEliminated = false;
    this.championTeamId = null;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
  }

  /**
   * Initializes a brand-new 8-team knockout bracket
   */
  startNewTournament(playerTeamId) {
    this.clear();
    this.playerTeamId = playerTeamId;
    this.currentRoundIndex = 0;
    this.isComplete = false;
    this.isEliminated = false;
    this.championTeamId = null;

    // Pool of all team IDs
    const allTeamIds = Object.keys(TEAMS).filter(
      (id) => id !== 'BLUE' && id !== 'RED' // skip legacy aliases
    );

    // Ensure player's team is in the list
    const otherTeams = allTeamIds.filter((id) => id !== playerTeamId);
    
    // Shuffle other teams
    for (let i = otherTeams.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [otherTeams[i], otherTeams[j]] = [otherTeams[j], otherTeams[i]];
    }

    // Seed 4 Quarter-Final fixtures
    // Player is Home in Fixture 1
    const qfFixtures = [
      {
        id: 'qf_1',
        homeTeamId: playerTeamId,
        awayTeamId: otherTeams[0],
        homeScore: null,
        awayScore: null,
        winnerId: null,
        isPlayerMatch: true,
        played: false,
        shootout: null
      },
      {
        id: 'qf_2',
        homeTeamId: otherTeams[1],
        awayTeamId: otherTeams[2],
        homeScore: null,
        awayScore: null,
        winnerId: null,
        isPlayerMatch: false,
        played: false,
        shootout: null
      },
      {
        id: 'qf_3',
        homeTeamId: otherTeams[3],
        awayTeamId: otherTeams[4],
        homeScore: null,
        awayScore: null,
        winnerId: null,
        isPlayerMatch: false,
        played: false,
        shootout: null
      },
      {
        id: 'qf_4',
        homeTeamId: otherTeams[5],
        awayTeamId: otherTeams[6],
        homeScore: null,
        awayScore: null,
        winnerId: null,
        isPlayerMatch: false,
        played: false,
        shootout: null
      }
    ];

    // Placeholder Semi-Finals (2 fixtures)
    const sfFixtures = [
      {
        id: 'sf_1',
        homeTeamId: null,
        awayTeamId: null,
        homeScore: null,
        awayScore: null,
        winnerId: null,
        isPlayerMatch: false,
        played: false,
        shootout: null
      },
      {
        id: 'sf_2',
        homeTeamId: null,
        awayTeamId: null,
        homeScore: null,
        awayScore: null,
        winnerId: null,
        isPlayerMatch: false,
        played: false,
        shootout: null
      }
    ];

    // Placeholder Final (1 fixture)
    const finalFixtures = [
      {
        id: 'final_1',
        homeTeamId: null,
        awayTeamId: null,
        homeScore: null,
        awayScore: null,
        winnerId: null,
        isPlayerMatch: false,
        played: false,
        shootout: null
      }
    ];

    this.rounds = [
      { name: 'Quarter-Finals', fixtures: qfFixtures },
      { name: 'Semi-Finals', fixtures: sfFixtures },
      { name: 'The Grand Final', fixtures: finalFixtures }
    ];

    this.save();
    return this;
  }

  getCurrentRound() {
    return this.rounds[this.currentRoundIndex] || null;
  }

  getCurrentPlayerFixture() {
    const round = this.getCurrentRound();
    if (!round) return null;
    return round.fixtures.find(
      (f) => (f.homeTeamId === this.playerTeamId || f.awayTeamId === this.playerTeamId) && !f.played
    );
  }

  /**
   * Simulates non-player fixtures with realistic scorelines
   */
  simulateMatch(homeTeamId, awayTeamId) {
    const homeTeam = TEAMS[homeTeamId] || { rating: 90 };
    const awayTeam = TEAMS[awayTeamId] || { rating: 90 };

    // Goal distribution based on rating differential
    const ratingDiff = (homeTeam.rating || 90) - (awayTeam.rating || 90);
    let homeGoals = Math.floor(Math.random() * 3) + (ratingDiff > 0 ? 1 : 0);
    let awayGoals = Math.floor(Math.random() * 3) + (ratingDiff < 0 ? 1 : 0);

    let shootout = null;
    let winnerId = null;

    if (homeGoals === awayGoals) {
      // Tied at full-time: decide via penalties
      const homePens = Math.random() + (ratingDiff * 0.05) > 0.5 ? 5 : 4;
      const awayPens = homePens === 5 ? 4 : 5;
      shootout = { home: homePens, away: awayPens };
      winnerId = homePens > awayPens ? homeTeamId : awayTeamId;
    } else {
      winnerId = homeGoals > awayGoals ? homeTeamId : awayTeamId;
    }

    return { homeGoals, awayGoals, winnerId, shootout };
  }

  /**
   * Records the outcome of the player's active match using the genuine winner,
   * simulates CPU matches in current round, and prepares advancement to next round.
   */
  recordPlayerMatchResult(homeScore, awayScore, winnerTeamKey, shootoutDetails = null) {
    const round = this.getCurrentRound();
    if (!round) return null;

    const fixture = round.fixtures.find(
      (f) => f.homeTeamId === this.playerTeamId || f.awayTeamId === this.playerTeamId
    );

    if (!fixture) return null;

    fixture.homeScore = homeScore;
    fixture.awayScore = awayScore;
    fixture.played = true;
    fixture.shootout = shootoutDetails;

    // Determine actual winner ID based on winnerTeamKey ('blue' = home, 'red' = away)
    let winnerId = null;
    if (winnerTeamKey === 'blue') {
      winnerId = fixture.homeTeamId;
    } else if (winnerTeamKey === 'red') {
      winnerId = fixture.awayTeamId;
    } else {
      // Fallback tie-breaker only if somehow completely unspecified
      winnerId = homeScore > awayScore ? fixture.homeTeamId : fixture.awayTeamId;
    }

    fixture.winnerId = winnerId;
    const playerWon = winnerId === this.playerTeamId;
    const isFinal = this.currentRoundIndex === 2;

    if (!playerWon) {
      this.isEliminated = true;

      if (isFinal) {
        // Player was defeated in The Grand Final!
        // The opponent won the championship and lifts the Cup!
        this.isComplete = true;
        this.championTeamId = winnerId;
      } else {
        // Player eliminated in earlier round (QF or SF):
        // Simulate rest of current round and subsequent rounds so bracket resolves to a champion
        round.fixtures.forEach((f) => {
          if (!f.played && f.homeTeamId && f.awayTeamId) {
            const sim = this.simulateMatch(f.homeTeamId, f.awayTeamId);
            f.homeScore = sim.homeGoals;
            f.awayScore = sim.awayGoals;
            f.winnerId = sim.winnerId;
            f.shootout = sim.shootout;
            f.played = true;
          }
        });

        while (this.currentRoundIndex < 2) {
          this.advanceWinnersToNextRound();
          const nextRound = this.getCurrentRound();
          if (nextRound) {
            nextRound.fixtures.forEach((f) => {
              if (!f.played && f.homeTeamId && f.awayTeamId) {
                const sim = this.simulateMatch(f.homeTeamId, f.awayTeamId);
                f.homeScore = sim.homeGoals;
                f.awayScore = sim.awayGoals;
                f.winnerId = sim.winnerId;
                f.shootout = sim.shootout;
                f.played = true;
              }
            });
          }
        }
        this.isComplete = true;
        const finalFixture = this.rounds[2]?.fixtures[0];
        if (finalFixture?.winnerId) {
          this.championTeamId = finalFixture.winnerId;
        }
      }

      this.save();
      return {
        playerWon: false,
        champion: false,
        isEliminated: true,
        isFinal: isFinal,
        winningTeamId: winnerId
      };
    }

    // Player won! Simulate the remaining non-player fixtures in this round
    round.fixtures.forEach((f) => {
      if (!f.played && f.homeTeamId && f.awayTeamId) {
        const sim = this.simulateMatch(f.homeTeamId, f.awayTeamId);
        f.homeScore = sim.homeGoals;
        f.awayScore = sim.awayGoals;
        f.winnerId = sim.winnerId;
        f.shootout = sim.shootout;
        f.played = true;
      }
    });

    // Check if this was the Final
    if (this.currentRoundIndex === 2) {
      this.isComplete = true;
      this.championTeamId = this.playerTeamId;
      this.save();
      return { playerWon: true, champion: true, isEliminated: false };
    }

    // Advance winners to the next round bracket
    this.advanceWinnersToNextRound();
    this.save();
    return { playerWon: true, champion: false, isEliminated: false };
  }

  advanceWinnersToNextRound() {
    if (this.currentRoundIndex === 0) {
      // Quarter-Finals -> Semi-Finals
      const qf = this.rounds[0].fixtures;
      const sf = this.rounds[1].fixtures;

      sf[0].homeTeamId = qf[0].winnerId;
      sf[0].awayTeamId = qf[1].winnerId;
      sf[0].isPlayerMatch =
        sf[0].homeTeamId === this.playerTeamId || sf[0].awayTeamId === this.playerTeamId;

      sf[1].homeTeamId = qf[2].winnerId;
      sf[1].awayTeamId = qf[3].winnerId;
      sf[1].isPlayerMatch =
        sf[1].homeTeamId === this.playerTeamId || sf[1].awayTeamId === this.playerTeamId;

      this.currentRoundIndex = 1;
    } else if (this.currentRoundIndex === 1) {
      // Semi-Finals -> Final
      const sf = this.rounds[1].fixtures;
      const final = this.rounds[2].fixtures;

      final[0].homeTeamId = sf[0].winnerId;
      final[0].awayTeamId = sf[1].winnerId;
      final[0].isPlayerMatch =
        final[0].homeTeamId === this.playerTeamId || final[0].awayTeamId === this.playerTeamId;

      this.currentRoundIndex = 2;
    }
  }
}
