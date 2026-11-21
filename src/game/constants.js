/**
 * Pocket Football League - Constants & Configuration
 */

export const PITCH = {
  // World coordinates (centered at 0, 0)
  WIDTH: 1300,      // X: -650 to +650 (Pitch length)
  HEIGHT: 780,      // Y: -390 to +390 (Pitch width)
  MARGIN_X: 130,    // Runoff area outside touchlines
  MARGIN_Y: 100,
  
  // Goal dimensions
  GOAL_WIDTH: 190,  // Opening along Y: -95 to +95
  GOAL_DEPTH: 60,   // Depth behind goal line
  GOAL_HEIGHT: 70,  // Height along Z (crossbar)
  POST_RADIUS: 4,
  
  // Markings
  LINE_WIDTH: 3,
  CENTER_CIRCLE_RADIUS: 110,
  CENTER_SPOT_RADIUS: 4,
  PENALTY_AREA_WIDTH: 360,
  PENALTY_AREA_DEPTH: 170,
  GOAL_AREA_WIDTH: 220,
  GOAL_AREA_DEPTH: 70,
  PENALTY_SPOT_DIST: 120,
  CORNER_ARC_RADIUS: 24,
  STRIPE_COUNT: 12, // Mown grass stripes
};

export const PHYSICS = {
  TILT_Y: 0.72,       // 2.5D Isometric vertical compression factor
  GRAVITY: 780,       // Z-axis gravity (units / s^2)
  BALL_FRICTION_GROUND: 0.984, // Rolling friction per frame (at 60fps)
  BALL_DRAG_AIR: 0.993,
  BALL_RESTITUTION_GROUND: 0.58, // Bounciness
  BALL_RESTITUTION_POST: 0.75,
  BALL_RADIUS: 9,
  BALL_MAX_Z: 82,     // Hard ceiling: ball never flies to the moon (crossbar is 70)
  
  PLAYER_RADIUS: 16,
  PLAYER_HEIGHT: 38,
  PLAYER_MAX_SPEED: 290,
  PLAYER_ACCEL: 2000,
  PLAYER_FRICTION: 14,
  PLAYER_SPRINT_MULT: 1.25,
  
  // Shooting, Passing & Tackling
  SHOT_POWER: 540,
  SHOT_HEIGHT: 155,   // Driven shot arc (~15 units peak Z, well under 70 crossbar)
  PASS_POWER: 410,    // Crisp ground pass
  PASS_HEIGHT: 0,     // Strictly ground roll
  DRIBBLE_DIST: 24,   // Distance from player center to ball while dribbling
  DRIBBLE_LERP: 0.32, // Sticky control response
  TACKLE_RANGE: 44,   // Distance to dispossess opponent
  TACKLE_COOLDOWN: 0.35,
};

/**
 * 8 Selectable Teams with Distinct Colors, High-Contrast UI Accents, Rosters and Kits
 */
export const TEAMS = {
  waves: {
    id: 'waves',
    name: 'Blue City',
    shortName: 'CTY',
    badge: '⛵',
    rating: 93,
    shirtColor: '#6CABDD',
    accentColor: '#38BDF8',
    shirtTrim: '#FFFFFF',
    shortsColor: '#FFFFFF',
    socksColor: '#6CABDD',
    numberColor: '#1C2C5B',
    gkColor: '#FDE047',
    gkShorts: '#0F172A',
    roster: {
      gk: { name: 'Edersan', number: 31 },
      df: { name: 'Kampany', number: 4 },
      fw: { name: 'Haalond', number: 9 }
    }
  },
  strikers: {
    id: 'strikers',
    name: 'Red United',
    shortName: 'UTD',
    badge: '🔱',
    rating: 91,
    shirtColor: '#DA291C',
    accentColor: '#FBBF24',
    shirtTrim: '#111827',
    shortsColor: '#FFFFFF',
    socksColor: '#111827',
    numberColor: '#FFFFFF',
    gkColor: '#10B981',
    gkShorts: '#111827',
    roster: {
      gk: { name: 'De Gea', number: 1 },
      df: { name: 'Ferdinend', number: 5 },
      fw: { name: 'Ronaldo', number: 7 }
    }
  },
  blancos: {
    id: 'blancos',
    name: 'Madrid Blancos',
    shortName: 'MAD',
    badge: '👑',
    rating: 94,
    shirtColor: '#F8FAFC',
    accentColor: '#FACC15',
    shirtTrim: '#F59E0B',
    shortsColor: '#FFFFFF',
    socksColor: '#F8FAFC',
    numberColor: '#1E293B',
    gkColor: '#0284C7',
    gkShorts: '#0F172A',
    roster: {
      gk: { name: 'Courtoas', number: 1 },
      df: { name: 'Ramas', number: 4 },
      fw: { name: 'Mbeppe', number: 7 }
    }
  },
  blau: {
    id: 'blau',
    name: 'Barcelona Blaugrana',
    shortName: 'BAR',
    badge: '🟣',
    rating: 93,
    shirtColor: '#800020',
    accentColor: '#FBBF24',
    shirtTrim: '#1D4ED8',
    shortsColor: '#1D4ED8',
    socksColor: '#800020',
    numberColor: '#FACC15',
    gkColor: '#10B981',
    gkShorts: '#064E3B',
    roster: {
      gk: { name: 'Ter Stagen', number: 1 },
      df: { name: 'Puyal', number: 5 },
      fw: { name: 'Massi', number: 10 }
    }
  },
  devils: {
    id: 'devils',
    name: 'Milan Devils',
    shortName: 'MIL',
    badge: '😈',
    rating: 89,
    shirtColor: '#DC2626',
    accentColor: '#EF4444',
    shirtTrim: '#18181B',
    shortsColor: '#18181B',
    socksColor: '#DC2626',
    numberColor: '#FFFFFF',
    gkColor: '#EAB308',
    gkShorts: '#18181B',
    roster: {
      gk: { name: 'Deda', number: 1 },
      df: { name: 'Bareso', number: 6 },
      fw: { name: 'Keka', number: 22 }
    }
  },
  titans: {
    id: 'titans',
    name: 'Munich Titans',
    shortName: 'MUN',
    badge: '🛡️',
    rating: 93,
    shirtColor: '#B91C1C',
    accentColor: '#F87171',
    shirtTrim: '#FFFFFF',
    shortsColor: '#1E3A8A',
    socksColor: '#B91C1C',
    numberColor: '#FFFFFF',
    gkColor: '#6366F1',
    gkShorts: '#1E1B4B',
    roster: {
      gk: { name: 'Neuar', number: 1 },
      df: { name: 'Lehm', number: 21 },
      fw: { name: 'Mullor', number: 25 }
    }
  },
  gunners: {
    id: 'gunners',
    name: 'London Gunners',
    shortName: 'LON',
    badge: '🎯',
    rating: 88,
    shirtColor: '#EF4444',
    accentColor: '#F87171',
    shirtTrim: '#FFFFFF',
    shortsColor: '#FFFFFF',
    socksColor: '#EF4444',
    numberColor: '#FFFFFF',
    gkColor: '#14B8A6',
    gkShorts: '#134E4A',
    roster: {
      gk: { name: 'Seamon', number: 1 },
      df: { name: 'Adems', number: 6 },
      fw: { name: 'Hanry', number: 14 }
    }
  },
  stars: {
    id: 'stars',
    name: 'Paris Stars',
    shortName: 'PAR',
    badge: '⭐',
    rating: 90,
    shirtColor: '#1E293B',
    accentColor: '#FB7185',
    shirtTrim: '#F43F5E',
    shortsColor: '#1E293B',
    socksColor: '#1E293B',
    numberColor: '#FB7185',
    gkColor: '#F59E0B',
    gkShorts: '#0F172A',
    roster: {
      gk: { name: 'Donnaromma', number: 99 },
      df: { name: 'Marquinhas', number: 5 },
      fw: { name: 'Neymor', number: 11 }
    }
  }
};

// Array of all 8 teams for easy iteration in UI
export const TEAMS_LIST = Object.values(TEAMS);

// Match Duration Presets in seconds
export const MATCH_DURATIONS = [
  { label: '1 Min', value: 60, desc: 'Blitz' },
  { label: '2 Min', value: 120, desc: 'Arcade' },
  { label: '3 Min', value: 180, desc: 'Standard' },
  { label: '5 Min', value: 300, desc: 'Pro' }
];

// AI Difficulty Profiles (applied to opponent team)
export const DIFFICULTIES = {
  easy: {
    id: 'easy',
    label: 'Easy',
    aiSpeedMult: 0.78,
    aiAccelMult: 0.72,
    aiPassDelay: 0.62,
    aiShootRange: 215,
    aiShotSpeedMult: 0.85,
    aiTackleRangeMult: 0.88,
    aiTackleReaction: 0.28,
    aiTackleCooldownMin: 2.4,
    aiTackleCooldownMax: 3.4,
    aiPressRange: 230,
    aiGkTrackMult: 0.52,
    aiGkBoxThreatRange: 115,
    aiPredictShots: false,
  },
  normal: {
    id: 'normal',
    label: 'Normal',
    aiSpeedMult: 1.0,
    aiAccelMult: 1.0,
    aiPassDelay: 0.34,
    aiShootRange: 270,
    aiShotSpeedMult: 1.0,
    aiTackleRangeMult: 1.0,
    aiTackleReaction: 0.16,
    aiTackleCooldownMin: 1.7,
    aiTackleCooldownMax: 2.5,
    aiPressRange: 320,
    aiGkTrackMult: 0.82,
    aiGkBoxThreatRange: 165,
    aiPredictShots: false,
  },
  hard: {
    id: 'hard',
    label: 'Hard',
    aiSpeedMult: 1.08,
    aiAccelMult: 1.15,
    aiPassDelay: 0.22,
    aiShootRange: 335,
    aiShotSpeedMult: 1.12,
    aiTackleRangeMult: 1.04,
    aiTackleReaction: 0.10,
    aiTackleCooldownMin: 1.15,
    aiTackleCooldownMax: 1.75,
    aiPressRange: 420,
    aiGkTrackMult: 1.05,
    aiGkBoxThreatRange: 195,
    aiPredictShots: true,
  },
};

// Fallback legacy team references for backward compatibility
TEAMS.BLUE = TEAMS.waves;
TEAMS.RED = TEAMS.strikers;
