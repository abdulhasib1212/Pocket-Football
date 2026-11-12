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
  SHOT_POWER: 520,
  SHOT_HEIGHT: 44,    // Driven shot under or kissing crossbar
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
    name: 'Blue Waves',
    shortName: 'BLU',
    badge: '🌊',
    rating: 91,
    shirtColor: '#1E60FF',
    accentColor: '#38BDF8',
    shirtTrim: '#FFFFFF',
    shortsColor: '#0E2E72',
    socksColor: '#1E60FF',
    numberColor: '#FFFFFF',
    gkColor: '#FFB703',
    gkShorts: '#212529',
    roster: {
      gk: { name: 'Casillas', number: 1 },
      df: { name: 'Maldini', number: 4 },
      fw: { name: 'Messi', number: 10 }
    }
  },
  strikers: {
    id: 'strikers',
    name: 'Red Strikers',
    shortName: 'RED',
    badge: '⚡',
    rating: 90,
    shirtColor: '#E63946',
    accentColor: '#F87171',
    shirtTrim: '#FFFFFF',
    shortsColor: '#590D14',
    socksColor: '#E63946',
    numberColor: '#FFFFFF',
    gkColor: '#06D6A0',
    gkShorts: '#114B3E',
    roster: {
      gk: { name: 'Buffon', number: 1 },
      df: { name: 'Nesta', number: 3 },
      fw: { name: 'Ronaldo', number: 9 }
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
      gk: { name: 'Courtois', number: 1 },
      df: { name: 'Ramos', number: 4 },
      fw: { name: 'Mbappe', number: 7 }
    }
  },
  blau: {
    id: 'blau',
    name: 'Barcelona Blau',
    shortName: 'BAR',
    badge: '🟣',
    rating: 92,
    shirtColor: '#800020',
    accentColor: '#FBBF24',
    shirtTrim: '#1D4ED8',
    shortsColor: '#1D4ED8',
    socksColor: '#800020',
    numberColor: '#FACC15',
    gkColor: '#10B981',
    gkShorts: '#064E3B',
    roster: {
      gk: { name: 'Ter Stegen', number: 1 },
      df: { name: 'Puyol', number: 5 },
      fw: { name: 'Ronaldinho', number: 10 }
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
      gk: { name: 'Dida', number: 1 },
      df: { name: 'Baresi', number: 6 },
      fw: { name: 'Kaka', number: 22 }
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
      gk: { name: 'Neuer', number: 1 },
      df: { name: 'Lahm', number: 21 },
      fw: { name: 'Muller', number: 25 }
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
      gk: { name: 'Seaman', number: 1 },
      df: { name: 'Adams', number: 6 },
      fw: { name: 'Henry', number: 14 }
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
      gk: { name: 'Donnarumma', number: 99 },
      df: { name: 'Marquinhos', number: 5 },
      fw: { name: 'Neymar', number: 11 }
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

// Fallback legacy team references for backward compatibility
TEAMS.BLUE = TEAMS.waves;
TEAMS.RED = TEAMS.strikers;
