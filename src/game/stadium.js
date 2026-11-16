/**
 * Stadium Architecture, Spectator Crowd & Atmosphere Renderer
 * Pure 2.5D Canvas renderer designed for 60fps desktop & mobile performance.
 *
 * Features:
 * - Full 360° stadium bowl (North Grandstand, West/East Goal Stands, South Stand, 4 Corner Sections)
 * - Stepped tiers, concrete concourses, stair aisles, individual molded seat rows, barriers & railings
 * - Recessed 3D vomitory entrance tunnels & touchline team dugouts
 * - Pre-rendered offscreen crowd sprite atlas with team colors, varied outfits, caps/scarves & subtle animation
 * - Corner floodlight towers & segmented perimeter LED advertising boards
 */
import { PITCH, PHYSICS } from './constants.js';

const STADIUM_RUNOFF_X = 88;
const STADIUM_RUNOFF_Y = 46;
const CROWD_SPRITE_W = 24;
const CROWD_SPRITE_H = 30;
const CROWD_POSES = 3; // 0: idle, 1: clap/cheer, 2: raised arms / scarf

const NEUTRAL_SHIRTS = [
  '#F8FAFC', // Crisp white
  '#334155', // Charcoal slate
  '#F59E0B', // Warm amber
  '#0F766E', // Deep teal
  '#E2E8F0', // Off-white
  '#475569', // Cool grey
  '#D97706', // Gold ochre
  '#1E293B', // Dark navy
];

const SKIN_TONES = ['#F6D0B1', '#E4B18D', '#C98E64', '#9E6642', '#6C4229'];
const HAIR_TONES = ['#1E1B18', '#4A3222', '#8B5A2B', '#C99E58', '#94A3B8'];

function seededNoise(i, salt = 1) {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

export class StadiumRenderer {
  constructor() {
    this.homeShirt = '#1E60FF';
    this.homeAccent = '#38BDF8';
    this.homeName = 'BLUE WAVES';
    this.awayShirt = '#E63946';
    this.awayAccent = '#F87171';
    this.awayName = 'RED STRIKERS';

    this.time = 0;
    this.excitement = 0;
    this.goalCelebration = 0;
    this.scoringTeam = null;
    this.isTournamentFinal = false;

    // Pre-rendered crowd sprite sheet
    this.atlasCanvas = null;
    this.variantCount = 14; // 0..2 home, 3..5 away, 6..13 neutral

    // Pre-computed static geometry & spectator lists
    this.stands = [];
    this.tunnels = [];
    this.dugouts = [];
    this.adSegments = [];
    this.floodlights = [];
    this.spectatorsBack = [];
    this.spectatorsFront = [];

    this.buildStadiumLayout();
    this.buildCrowdAtlas();
  }

  setTeamColors(homeTeam, awayTeam) {
    const hShirt = homeTeam?.shirtColor || '#1E60FF';
    const hAccent = homeTeam?.accentColor || '#38BDF8';
    const hName = (homeTeam?.name || 'BLUE WAVES').toUpperCase();
    const aShirt = awayTeam?.shirtColor || '#E63946';
    const aAccent = awayTeam?.accentColor || '#F87171';
    const aName = (awayTeam?.name || 'RED STRIKERS').toUpperCase();

    const changed =
      hShirt !== this.homeShirt ||
      hAccent !== this.homeAccent ||
      aShirt !== this.awayShirt ||
      aAccent !== this.awayAccent;

    this.homeShirt = hShirt;
    this.homeAccent = hAccent;
    this.homeName = hName;
    this.awayShirt = aShirt;
    this.awayAccent = aAccent;
    this.awayName = aName;

    if (changed) {
      this.buildCrowdAtlas();
    }
  }

  update(dt, state = {}) {
    this.time += dt;
    const targetExcitement = Math.max(0, Math.min(1, Number(state.dangerNorm) || 0));
    const lerp = targetExcitement > this.excitement ? 4.5 : 1.6;
    this.excitement += (targetExcitement - this.excitement) * Math.min(1, dt * lerp);

    const targetGoal = state.isGoalCelebration ? 1 : 0;
    if (targetGoal > this.goalCelebration) {
      this.goalCelebration = 1;
    } else {
      this.goalCelebration = Math.max(0, this.goalCelebration - dt * 1.35);
    }
    this.scoringTeam = state.scoringTeam || null;
    this.isTournamentFinal = !!state.isTournamentFinal;
  }

  /**
   * Builds offscreen sprite atlas for varied spectator outfits & cheering poses.
   * Safe no-op in headless Node environments without DOM.
   */
  buildCrowdAtlas() {
    if (typeof document === 'undefined') return;

    const palette = [
      { shirt: this.homeShirt, trim: this.homeAccent, scarf: true },
      { shirt: this.homeShirt, trim: '#FFFFFF', scarf: false },
      { shirt: this.homeAccent, trim: this.homeShirt, scarf: true },
      { shirt: this.awayShirt, trim: this.awayAccent, scarf: true },
      { shirt: this.awayShirt, trim: '#FFFFFF', scarf: false },
      { shirt: this.awayAccent, trim: this.awayShirt, scarf: true },
      ...NEUTRAL_SHIRTS.map((c, idx) => ({
        shirt: c,
        trim: idx % 2 === 0 ? '#94A3B8' : '#F8FAFC',
        scarf: idx % 3 === 0,
      })),
    ];

    this.variantCount = palette.length;
    const canvas = document.createElement('canvas');
    canvas.width = CROWD_SPRITE_W * CROWD_POSES;
    canvas.height = CROWD_SPRITE_H * this.variantCount;
    const g = canvas.getContext('2d');
    if (!g) return;

    for (let v = 0; v < this.variantCount; v++) {
      const style = palette[v];
      const skin = SKIN_TONES[v % SKIN_TONES.length];
      const hair = HAIR_TONES[(v * 3) % HAIR_TONES.length];
      const hasCap = v % 4 === 1;

      for (let p = 0; p < CROWD_POSES; p++) {
        const ox = p * CROWD_SPRITE_W;
        const oy = v * CROWD_SPRITE_H;
        const cx = ox + CROWD_SPRITE_W * 0.5;
        const bodyTop = oy + 11;

        // Subtle seat contact shadow
        g.fillStyle = 'rgba(2, 6, 23, 0.36)';
        g.beginPath();
        g.ellipse(cx, oy + 26, 7.2, 2.5, 0, 0, Math.PI * 2);
        g.fill();

        // Arms (behind/beside torso)
        g.strokeStyle = style.shirt;
        g.lineWidth = 2.6;
        g.lineCap = 'round';
        if (p === 0) {
          // Idle: arms resting down
          g.beginPath();
          g.moveTo(cx - 5.2, bodyTop + 3);
          g.lineTo(cx - 6.6, bodyTop + 10);
          g.moveTo(cx + 5.2, bodyTop + 3);
          g.lineTo(cx + 6.6, bodyTop + 10);
          g.stroke();
        } else if (p === 1) {
          // One arm raised cheering
          g.beginPath();
          g.moveTo(cx - 5.2, bodyTop + 3);
          g.lineTo(cx - 7.5, bodyTop - 3);
          g.moveTo(cx + 5.2, bodyTop + 3);
          g.lineTo(cx + 6.8, bodyTop + 9);
          g.stroke();
          g.fillStyle = skin;
          g.beginPath();
          g.arc(cx - 7.6, bodyTop - 3.6, 1.5, 0, Math.PI * 2);
          g.fill();
        } else {
          // Both arms raised! Optional team scarf held overhead
          g.beginPath();
          g.moveTo(cx - 5.2, bodyTop + 3);
          g.lineTo(cx - 7.8, bodyTop - 4);
          g.moveTo(cx + 5.2, bodyTop + 3);
          g.lineTo(cx + 7.8, bodyTop - 4);
          g.stroke();
          if (style.scarf) {
            g.strokeStyle = style.trim;
            g.lineWidth = 2.2;
            g.beginPath();
            g.moveTo(cx - 7.8, bodyTop - 5.2);
            g.lineTo(cx + 7.8, bodyTop - 5.2);
            g.stroke();
          }
          g.fillStyle = skin;
          g.beginPath();
          g.arc(cx - 7.8, bodyTop - 4.5, 1.4, 0, Math.PI * 2);
          g.arc(cx + 7.8, bodyTop - 4.5, 1.4, 0, Math.PI * 2);
          g.fill();
        }

        // Torso jersey
        g.fillStyle = style.shirt;
        g.beginPath();
        g.roundRect(cx - 5.4, bodyTop + 1, 10.8, 13.5, [4, 4, 2, 2]);
        g.fill();

        // Jersey vertical trim / collar detail
        g.fillStyle = style.trim;
        g.fillRect(cx - 1.3, bodyTop + 1.5, 2.6, 11.5);

        // Neck & Head
        g.fillStyle = skin;
        g.beginPath();
        g.arc(cx, bodyTop - 1.5, 3.9, 0, Math.PI * 2);
        g.fill();

        // Hair or Cap
        if (hasCap) {
          g.fillStyle = style.trim;
          g.beginPath();
          g.arc(cx, bodyTop - 2.3, 4.1, Math.PI, Math.PI * 2);
          g.fill();
          g.fillRect(cx - 3.8, bodyTop - 2.8, 8.2, 1.5);
        } else {
          g.fillStyle = hair;
          g.beginPath();
          g.arc(cx, bodyTop - 2.5, 3.85, Math.PI * 0.92, Math.PI * 2.08);
          g.fill();
        }
      }
    }

    this.atlasCanvas = canvas;
  }

  /**
   * Builds all stadium stand tiers, aisles, seat strips, tunnels, dugouts, ad boards & spectators.
   */
  buildStadiumLayout() {
    const halfW = PITCH.WIDTH / 2;   // 650
    const halfH = PITCH.HEIGHT / 2;  // 390
    const runoffW = halfW + STADIUM_RUNOFF_X; // 738
    const runoffH = halfH + STADIUM_RUNOFF_Y; // 436

    this.spectatorsBack = [];
    this.spectatorsFront = [];
    let seedCounter = 1;

    const pickTeamBias = (wx, wy) => {
      if (wx < -220) return 'home';
      if (wx > 220) return 'away';
      return wy < 0 ? 'home' : 'neutral';
    };

    const pickVariant = (bias, idx) => {
      const r = seededNoise(idx, 17);
      if (bias === 'home') {
        if (r < 0.62) return Math.floor(seededNoise(idx, 31) * 3); // 0..2 Home
        return 6 + Math.floor(seededNoise(idx, 43) * 8);          // Neutral
      }
      if (bias === 'away') {
        if (r < 0.62) return 3 + Math.floor(seededNoise(idx, 37) * 3); // 3..5 Away
        return 6 + Math.floor(seededNoise(idx, 47) * 8);              // Neutral
      }
      if (r < 0.24) return Math.floor(seededNoise(idx, 53) * 3);
      if (r < 0.48) return 3 + Math.floor(seededNoise(idx, 59) * 3);
      return 6 + Math.floor(seededNoise(idx, 61) * 8);
    };

    const addSpectator = (list, wx, wy, wz, stand, section, row) => {
      const idx = seedCounter++;
      // ~89% occupancy so individual empty molded seats remain visible in rows
      if (seededNoise(idx, 3) > 0.89) return;
      const bias = pickTeamBias(wx, wy);
      const variant = pickVariant(bias, idx);
      const scale = 0.90 + seededNoise(idx, 7) * 0.20;
      const phase = seededNoise(idx, 11) * Math.PI * 2;
      const waver = seededNoise(idx, 13) > 0.64; // 36% avid fans wave often
      const fanTeam = variant < 3 ? 'blue' : variant < 6 ? 'red' : 'neutral';

      list.push({
        wx,
        wy,
        wz,
        stand,
        section,
        row,
        variant,
        scale,
        phase,
        waver,
        fanTeam,
      });
    };

    // --- 1. NORTH GRANDSTAND (Top, 2 tiers, 6 sections, 5 stair aisles, 3 vomitories) ---
    const northLowerRows = 4;
    const northUpperRows = 3;
    const northStartX = -runoffW + 10;
    const northEndX = runoffW - 10;
    const northAisleXs = [-520, -260, 0, 260, 520];
    const isNearNorthAisle = (x) => northAisleXs.some((ax) => Math.abs(x - ax) < 18);
    const isInNorthTunnel = (x, row) =>
      row <= 1 && (Math.abs(x) < 34 || Math.abs(x + 390) < 26 || Math.abs(x - 390) < 26);

    for (let r = 0; r < northLowerRows; r++) {
      const wy = -runoffH - 18 - r * 26;
      const wz = 14 + r * 14;
      for (let x = northStartX + 18; x <= northEndX - 18; x += 22) {
        if (isNearNorthAisle(x) || isInNorthTunnel(x, r)) continue;
        const jx = x + (seededNoise(seedCounter, 2) - 0.5) * 4;
        addSpectator(this.spectatorsBack, jx, wy - 4, wz, 'north', 0, r);
      }
    }
    // Upper Tier (separated by concourse walkway at wy = -runoffH - 134)
    for (let r = 0; r < northUpperRows; r++) {
      const wy = -runoffH - 150 - r * 26;
      const wz = 76 + r * 15;
      for (let x = northStartX + 18; x <= northEndX - 18; x += 22) {
        if (isNearNorthAisle(x)) continue;
        const jx = x + (seededNoise(seedCounter, 5) - 0.5) * 4;
        addSpectator(this.spectatorsBack, jx, wy - 4, wz, 'north', 1, r);
      }
    }

    // --- 2. WEST & EAST GOAL-END STANDS (Behind Goals, 5 rows each, 3 sections, 2 aisles + tunnel) ---
    const sideAisleYs = [-170, 170];
    const isNearSideAisle = (y) => sideAisleYs.some((ay) => Math.abs(y - ay) < 18);
    const isInSideTunnel = (y, row) => row <= 1 && Math.abs(y) < 30;

    for (const side of ['west', 'east']) {
      const sign = side === 'west' ? -1 : 1;
      for (let r = 0; r < 5; r++) {
        const wx = sign * (runoffW + 24 + r * 28);
        const wz = 12 + r * 14;
        for (let y = -halfH - 25; y <= halfH + 25; y += 22) {
          if (isNearSideAisle(y) || isInSideTunnel(y, r)) continue;
          const jy = y + (seededNoise(seedCounter, 19) - 0.5) * 4;
          addSpectator(this.spectatorsBack, wx, jy, wz, side, 0, r);
        }
      }
    }

    // --- 3. CORNER BOWL QUADRANTS (Connecting North/South to West/East) ---
    const cornerSpecs = [
      { cx: -runoffW - 18, cy: -runoffH - 16, sx: -1, sy: -1, list: 'back' },
      { cx: runoffW + 18, cy: -runoffH - 16, sx: 1, sy: -1, list: 'back' },
      { cx: -runoffW - 18, cy: runoffH + 16, sx: -1, sy: 1, list: 'front' },
      { cx: runoffW + 18, cy: runoffH + 16, sx: 1, sy: 1, list: 'front' },
    ];
    cornerSpecs.forEach((c) => {
      const targetList = c.list === 'back' ? this.spectatorsBack : this.spectatorsFront;
      for (let r = 0; r < 4; r++) {
        const rad = 28 + r * 26;
        const wz = 14 + r * 13;
        for (let step = 0; step <= 4; step++) {
          const ang = 0.22 + (step / 4) * (Math.PI * 0.5 - 0.44);
          const wx = c.cx + c.sx * Math.cos(ang) * rad;
          const wy = c.cy + c.sy * Math.sin(ang) * rad;
          addSpectator(targetList, wx, wy, wz, 'corner', 0, r);
        }
      }
    });

    // --- 4. SOUTH FOREGROUND STAND (Bottom Touchline, 4 low-profile stepped rows) ---
    const southAisleXs = [-520, -260, 0, 260, 520];
    const isNearSouthAisle = (x) => southAisleXs.some((ax) => Math.abs(x - ax) < 18);
    for (let r = 0; r < 4; r++) {
      const wy = runoffH + 22 + r * 26;
      const wz = 10 + r * 11;
      for (let x = northStartX + 18; x <= northEndX - 18; x += 23) {
        if (isNearSouthAisle(x)) continue;
        const jx = x + (seededNoise(seedCounter, 23) - 0.5) * 4;
        addSpectator(this.spectatorsFront, jx, wy, wz, 'south', 0, r);
      }
    }

    // Sort back & front spectator lists by screen-Y depth order (ascending wy*TILT_Y - wz)
    const depthKey = (s) => s.wy * PHYSICS.TILT_Y - s.wz;
    this.spectatorsBack.sort((a, b) => depthKey(a) - depthKey(b));
    this.spectatorsFront.sort((a, b) => depthKey(a) - depthKey(b));

    // --- 5. CORNER FLOODLIGHT TOWERS ---
    this.floodlights = [
      { x: -runoffW - 45, y: -runoffH - 25, h: 108, dirX: 1, dirY: 1 },
      { x: runoffW + 45, y: -runoffH - 25, h: 108, dirX: -1, dirY: 1 },
      { x: -runoffW - 45, y: runoffH + 49, h: 115, dirX: 1, dirY: -1 },
      { x: runoffW + 45, y: runoffH + 49, h: 115, dirX: -1, dirY: -1 },
    ];
  }

  /**
   * Helper: draws a world-space 3D quad projected via camera.
   */
  drawQuad(ctx, camera, pts, fillStyle, strokeStyle = null, lineWidth = 1) {
    const s0 = camera.worldToScreen(pts[0][0], pts[0][1], pts[0][2] || 0);
    const s1 = camera.worldToScreen(pts[1][0], pts[1][1], pts[1][2] || 0);
    const s2 = camera.worldToScreen(pts[2][0], pts[2][1], pts[2][2] || 0);
    const s3 = camera.worldToScreen(pts[3][0], pts[3][1], pts[3][2] || 0);

    ctx.beginPath();
    ctx.moveTo(s0.x, s0.y);
    ctx.lineTo(s1.x, s1.y);
    ctx.lineTo(s2.x, s2.y);
    ctx.lineTo(s3.x, s3.y);
    ctx.closePath();

    if (fillStyle) {
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }
    if (strokeStyle) {
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  }

  /**
   * Renders stadium floor, North/West/East/Corner stands, seat rows, aisles, tunnels, dugouts & crowd.
   * Called BEFORE the playable turf and entities so everything sits naturally behind the pitch.
   */
  renderBackground(ctx, camera, halfW, halfH) {
    const runoffW = halfW + STADIUM_RUNOFF_X;
    const runoffH = halfH + STADIUM_RUNOFF_Y;
    const outerW = runoffW + 300;
    const outerH = runoffH + 320;

    // 1. Deep stadium concourse apron surrounding entire arena
    this.drawQuad(
      ctx,
      camera,
      [
        [-outerW, -outerH, 0],
        [outerW, -outerH, 0],
        [outerW, outerH, 0],
        [-outerW, outerH, 0],
      ],
      '#0B1120'
    );

    // Inner track / concrete pitch surround
    this.drawQuad(
      ctx,
      camera,
      [
        [-runoffW - 22, -runoffH - 20, 0],
        [runoffW + 22, -runoffH - 20, 0],
        [runoffW + 22, runoffH + 20, 0],
        [-runoffW - 22, runoffH + 20, 0],
      ],
      '#1E293B',
      '#334155',
      Math.max(1, 1.5 * camera.zoom)
    );

    // 2. Corner Stadium Bowls (back two corners first)
    this.renderCornerStand(ctx, camera, -runoffW - 14, -runoffH - 12, -1, -1);
    this.renderCornerStand(ctx, camera, runoffW + 14, -runoffH - 12, 1, -1);

    // 3. North Grandstand (Upper Tier -> Concourse Walkway -> Lower Tier -> Front Wall)
    this.renderNorthGrandstand(ctx, camera, runoffW, runoffH);

    // 4. West & East Goal-End Stands
    this.renderGoalEndStand(ctx, camera, -runoffW, -1, halfH);
    this.renderGoalEndStand(ctx, camera, runoffW, 1, halfH);

    // 5. Spectators in North, West, East, and back Corners (culled & atlas-batched)
    this.renderSpectatorBatch(ctx, camera, this.spectatorsBack);

    // 6. North Touchline Team Dugouts (Player benches flanking center tunnel)
    this.renderDugouts(ctx, camera, runoffH);

    // 7. Rear Floodlight Masts (behind pitch)
    this.renderFloodlightStructure(ctx, camera, this.floodlights[0], false);
    this.renderFloodlightStructure(ctx, camera, this.floodlights[1], false);
  }

  renderNorthGrandstand(ctx, camera, runoffW, runoffH) {
    const xL = -runoffW + 4;
    const xR = runoffW - 4;
    const aisleXs = [-520, -260, 0, 260, 520];
    const zoom = camera.zoom;

    // Upper Tier Structure (3 stepped rows)
    const upperFrontY = -runoffH - 134;
    const upperBackY = -runoffH - 222;
    this.drawQuad(
      ctx,
      camera,
      [
        [xL, upperBackY, 122],
        [xR, upperBackY, 122],
        [xR, upperFrontY, 72],
        [xL, upperFrontY, 72],
      ],
      '#1E293B',
      '#334155',
      Math.max(1, 1.2 * zoom)
    );

    // Upper Tier Roof Shadow / Canopy Fascia
    this.drawQuad(
      ctx,
      camera,
      [
        [xL - 8, upperBackY - 26, 140],
        [xR + 8, upperBackY - 26, 140],
        [xR + 8, upperBackY, 122],
        [xL - 8, upperBackY, 122],
      ],
      '#0F172A',
      '#475569',
      Math.max(1, 1.5 * zoom)
    );

    // Upper Tier Individual Seat Rows
    for (let r = 2; r >= 0; r--) {
      const ry1 = -runoffH - 144 - r * 26;
      const ry2 = ry1 - 16;
      const rz1 = 74 + r * 15;
      const rz2 = rz1 + 10;
      this.drawQuad(
        ctx,
        camera,
        [
          [xL + 8, ry2, rz2],
          [xR - 8, ry2, rz2],
          [xR - 8, ry1, rz1],
          [xL + 8, ry1, rz1],
        ],
        r % 2 === 0 ? '#273549' : '#314158'
      );
      this.renderSeatBlocks(ctx, camera, xL + 16, xR - 16, ry1 - 3, rz1 + 2, aisleXs, zoom);
    }

    // Mid-Tier Concourse Walkway + Safety Rail
    this.drawQuad(
      ctx,
      camera,
      [
        [xL, upperFrontY, 72],
        [xR, upperFrontY, 72],
        [xR, -runoffH - 114, 62],
        [xL, -runoffH - 114, 62],
      ],
      '#334155'
    );
    this.renderHorizontalRailing(ctx, camera, xL, xR, -runoffH - 114, 62, 8, zoom);

    // Lower Tier Structure (4 stepped rows)
    const lowerFrontY = -runoffH - 8;
    const lowerBackY = -runoffH - 114;
    this.drawQuad(
      ctx,
      camera,
      [
        [xL, lowerBackY, 62],
        [xR, lowerBackY, 62],
        [xR, lowerFrontY, 10],
        [xL, lowerFrontY, 10],
      ],
      '#1E293B',
      '#334155',
      Math.max(1, 1.2 * zoom)
    );

    // Lower Tier Individual Seat Rows
    for (let r = 3; r >= 0; r--) {
      const ry1 = -runoffH - 16 - r * 26;
      const ry2 = ry1 - 16;
      const rz1 = 12 + r * 14;
      const rz2 = rz1 + 9;
      this.drawQuad(
        ctx,
        camera,
        [
          [xL + 8, ry2, rz2],
          [xR - 8, ry2, rz2],
          [xR - 8, ry1, rz1],
          [xL + 8, ry1, rz1],
        ],
        r % 2 === 0 ? '#253347' : '#2E3D54'
      );
      this.renderSeatBlocks(ctx, camera, xL + 16, xR - 16, ry1 - 3, rz1 + 2, aisleXs, zoom);
    }

    // Concrete Stair Aisles (upper & lower)
    aisleXs.forEach((ax) => {
      this.drawQuad(
        ctx,
        camera,
        [
          [ax - 12, upperBackY, 122],
          [ax + 12, upperBackY, 122],
          [ax + 12, upperFrontY, 72],
          [ax - 12, upperFrontY, 72],
        ],
        '#475569'
      );
      this.drawQuad(
        ctx,
        camera,
        [
          [ax - 12, lowerBackY, 62],
          [ax + 12, lowerBackY, 62],
          [ax + 12, lowerFrontY, 10],
          [ax - 12, lowerFrontY, 10],
        ],
        '#475569'
      );
      // Yellow step trim lines
      if (zoom > 0.55) {
        const sTop = camera.worldToScreen(ax, lowerBackY, 62);
        const sBot = camera.worldToScreen(ax, lowerFrontY, 10);
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.35)';
        ctx.lineWidth = Math.max(1, 2 * zoom);
        ctx.setLineDash([3 * zoom, 5 * zoom]);
        ctx.beginPath();
        ctx.moveTo(sTop.x, sTop.y);
        ctx.lineTo(sBot.x, sBot.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });

    // Recessed Vomitory Entrance Tunnels (Center player tunnel + Left/Right fan tunnels)
    this.renderNorthTunnel(ctx, camera, 0, lowerFrontY, 30, 32, zoom, true);
    this.renderNorthTunnel(ctx, camera, -390, lowerFrontY, 22, 26, zoom, false);
    this.renderNorthTunnel(ctx, camera, 390, lowerFrontY, 22, 26, zoom, false);

    // Front Pitchside Retaining Wall + Safety Railing
    this.drawQuad(
      ctx,
      camera,
      [
        [xL, lowerFrontY, 10],
        [xR, lowerFrontY, 10],
        [xR, lowerFrontY, 0],
        [xL, lowerFrontY, 0],
      ],
      '#0F172A',
      '#475569',
      Math.max(1, 1.2 * zoom)
    );
    this.renderHorizontalRailing(ctx, camera, xL, xR, lowerFrontY, 10, 7, zoom);
  }

  renderNorthTunnel(ctx, camera, cx, frontY, halfWidth, heightZ, zoom, isPlayerTunnel) {
    const backY = frontY - 46;
    const zBack = 28;
    // Recessed dark archway
    this.drawQuad(
      ctx,
      camera,
      [
        [cx - halfWidth, backY, zBack + heightZ * 0.5],
        [cx + halfWidth, backY, zBack + heightZ * 0.5],
        [cx + halfWidth, frontY, 0],
        [cx - halfWidth, frontY, 0],
      ],
      '#050811',
      '#64748B',
      Math.max(1, 1.4 * zoom)
    );
    // Warm stadium interior tunnel glow at bottom entrance
    this.drawQuad(
      ctx,
      camera,
      [
        [cx - halfWidth + 4, backY + 12, 4],
        [cx + halfWidth - 4, backY + 12, 4],
        [cx + halfWidth - 4, frontY, 0],
        [cx - halfWidth + 4, frontY, 0],
      ],
      isPlayerTunnel ? 'rgba(250, 204, 21, 0.16)' : 'rgba(148, 163, 184, 0.14)'
    );
    // Concrete wing walls
    this.drawQuad(
      ctx,
      camera,
      [
        [cx - halfWidth - 5, backY, zBack + heightZ * 0.55],
        [cx - halfWidth, backY, zBack + heightZ * 0.55],
        [cx - halfWidth, frontY, 10],
        [cx - halfWidth - 5, frontY, 10],
      ],
      '#475569'
    );
    this.drawQuad(
      ctx,
      camera,
      [
        [cx + halfWidth, backY, zBack + heightZ * 0.55],
        [cx + halfWidth + 5, backY, zBack + heightZ * 0.55],
        [cx + halfWidth + 5, frontY, 10],
        [cx + halfWidth, frontY, 10],
      ],
      '#475569'
    );
  }

  renderGoalEndStand(ctx, camera, baseEdgeX, dirX, halfH) {
    const yT = -halfH - 42;
    const yB = halfH + 42;
    const innerX = baseEdgeX + dirX * 14;
    const outerX = baseEdgeX + dirX * 158;
    const zoom = camera.zoom;

    // Concrete sloped tier shell
    this.drawQuad(
      ctx,
      camera,
      [
        [outerX, yT, 76],
        [outerX, yB, 76],
        [innerX, yB, 8],
        [innerX, yT, 8],
      ],
      '#1E293B',
      '#334155',
      Math.max(1, 1.2 * zoom)
    );

    // Individual seating rows along East/West
    for (let r = 4; r >= 0; r--) {
      const rx1 = baseEdgeX + dirX * (16 + r * 28);
      const rx2 = baseEdgeX + dirX * (16 + r * 28 + 18);
      const rz1 = 10 + r * 14;
      const rz2 = rz1 + 8;

      this.drawQuad(
        ctx,
        camera,
        [
          [rx2, yT + 8, rz2],
          [rx2, yB - 8, rz2],
          [rx1, yB - 8, rz1],
          [rx1, yT + 8, rz1],
        ],
        r % 2 === 0 ? '#273549' : '#314158'
      );

      // Molded individual seats along Y (vertical row)
      if (zoom > 0.52) {
        const seatColor = dirX < 0 ? 'rgba(56, 189, 248, 0.35)' : 'rgba(248, 113, 113, 0.35)';
        ctx.fillStyle = seatColor;
        const w = Math.max(3, 8 * zoom);
        const h = Math.max(2, 5 * zoom);
        for (let y = yT + 18; y <= yB - 18; y += 22) {
          if (Math.abs(y + 170) < 18 || Math.abs(y - 170) < 18) continue;
          if (r <= 1 && Math.abs(y) < 30) continue;
          const pt = camera.worldToScreen((rx1 + rx2) * 0.5, y, rz1 + 2);
          ctx.fillRect(pt.x - w * 0.5, pt.y - h * 0.5, w, h);
        }
      }
    }

    // Stair aisles at Y = -170, +170
    [-170, 170].forEach((ay) => {
      this.drawQuad(
        ctx,
        camera,
        [
          [outerX, ay - 11, 76],
          [outerX, ay + 11, 76],
          [innerX, ay + 11, 8],
          [innerX, ay - 11, 8],
        ],
        '#475569'
      );
    });

    // Recessed fan vomitory tunnel at center Y = 0
    this.drawQuad(
      ctx,
      camera,
      [
        [innerX + dirX * 42, -22, 32],
        [innerX + dirX * 42, 22, 32],
        [innerX, 22, 0],
        [innerX, -22, 0],
      ],
      '#050811',
      '#64748B',
      Math.max(1, 1.2 * zoom)
    );

    // Front wall & safety railing
    this.drawQuad(
      ctx,
      camera,
      [
        [innerX, yT, 8],
        [innerX, yB, 8],
        [innerX, yB, 0],
        [innerX, yT, 0],
      ],
      '#0F172A'
    );
    const rBot1 = camera.worldToScreen(innerX, yT, 14);
    const rBot2 = camera.worldToScreen(innerX, yB, 14);
    ctx.strokeStyle = 'rgba(203, 213, 225, 0.55)';
    ctx.lineWidth = Math.max(1, 1.5 * zoom);
    ctx.beginPath();
    ctx.moveTo(rBot1.x, rBot1.y);
    ctx.lineTo(rBot2.x, rBot2.y);
    ctx.stroke();
  }

  renderCornerStand(ctx, camera, cx, cy, sx, sy) {
    // Stepped octagonal corner infill tying North/South and West/East tiers together
    const innerR = 14;
    const outerR = 148;
    const steps = 4;
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI * 0.5;
      pts.push([cx + sx * Math.cos(a) * outerR, cy + sy * Math.sin(a) * outerR, 72]);
    }
    for (let i = steps; i >= 0; i--) {
      const a = (i / steps) * Math.PI * 0.5;
      pts.push([cx + sx * Math.cos(a) * innerR, cy + sy * Math.sin(a) * innerR, 10]);
    }

    ctx.beginPath();
    pts.forEach((pt, idx) => {
      const sp = camera.worldToScreen(pt[0], pt[1], pt[2]);
      if (idx === 0) ctx.moveTo(sp.x, sp.y);
      else ctx.lineTo(sp.x, sp.y);
    });
    ctx.closePath();
    ctx.fillStyle = '#182234';
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = Math.max(1, camera.zoom);
    ctx.stroke();

    // Subtle concentric seat tier arcs inside corner
    for (let r = 1; r <= 3; r++) {
      const rad = 28 + r * 26;
      const wz = 14 + r * 13;
      ctx.beginPath();
      for (let i = 0; i <= 6; i++) {
        const a = 0.08 + (i / 6) * (Math.PI * 0.5 - 0.16);
        const sp = camera.worldToScreen(cx + sx * Math.cos(a) * rad, cy + sy * Math.sin(a) * rad, wz);
        if (i === 0) ctx.moveTo(sp.x, sp.y);
        else ctx.lineTo(sp.x, sp.y);
      }
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = Math.max(1.5, 3 * camera.zoom);
      ctx.stroke();
    }
  }

  /**
   * Renders individual molded seats along a horizontal row (visible in empty spots & around spectators)
   */
  renderSeatBlocks(ctx, camera, xStart, xEnd, wy, wz, aisleXs, zoom) {
    if (zoom < 0.52) return;
    const seatW = Math.max(3, 9.5 * zoom);
    const seatH = Math.max(2, 6 * zoom);

    ctx.fillStyle = '#1D4ED8'; // Classic stadium navy-blue molded seats
    for (let x = xStart; x <= xEnd; x += 22) {
      let skip = false;
      for (let i = 0; i < aisleXs.length; i++) {
        if (Math.abs(x - aisleXs[i]) < 18) {
          skip = true;
          break;
        }
      }
      if (skip) continue;
      const pt = camera.worldToScreen(x, wy, wz);
      // Fast frustum skip
      if (pt.x < -30 || pt.x > camera.viewportWidth + 30) continue;
      ctx.fillRect(pt.x - seatW * 0.5, pt.y - seatH * 0.5, seatW, seatH);
    }
  }

  renderHorizontalRailing(ctx, camera, xL, xR, wy, baseZ, railH, zoom) {
    const b1 = camera.worldToScreen(xL, wy, baseZ + railH);
    const b2 = camera.worldToScreen(xR, wy, baseZ + railH);
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.65)';
    ctx.lineWidth = Math.max(1, 1.8 * zoom);
    ctx.beginPath();
    ctx.moveTo(b1.x, b1.y);
    ctx.lineTo(b2.x, b2.y);
    ctx.stroke();

    // Vertical stanchion posts every 130 units
    if (zoom > 0.55) {
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.55)';
      ctx.lineWidth = Math.max(1, 1.4 * zoom);
      ctx.beginPath();
      for (let x = xL; x <= xR; x += 130) {
        const pBot = camera.worldToScreen(x, wy, baseZ);
        const pTop = camera.worldToScreen(x, wy, baseZ + railH);
        ctx.moveTo(pBot.x, pBot.y);
        ctx.lineTo(pTop.x, pTop.y);
      }
      ctx.stroke();
    }
  }

  /**
   * Renders home & away technical dugouts flanking the center tunnel
   */
  renderDugouts(ctx, camera, runoffH) {
    const dugoutY = -runoffH + 10;
    const zoom = camera.zoom;
    const specs = [
      { cx: -115, color: this.homeShirt, accent: this.homeAccent },
      { cx: 115, color: this.awayShirt, accent: this.awayAccent },
    ];

    specs.forEach((d) => {
      const x1 = d.cx - 52;
      const x2 = d.cx + 52;
      // Floor pad
      this.drawQuad(
        ctx,
        camera,
        [
          [x1, dugoutY - 18, 0],
          [x2, dugoutY - 18, 0],
          [x2, dugoutY + 6, 0],
          [x1, dugoutY + 6, 0],
        ],
        '#0F172A',
        '#475569',
        Math.max(1, zoom)
      );

      // Row of 4 team bucket seats inside dugout
      for (let s = 0; s < 4; s++) {
        const sx = x1 + 16 + s * 23;
        const pt = camera.worldToScreen(sx, dugoutY - 8, 6);
        ctx.fillStyle = d.color;
        ctx.fillRect(pt.x - 5 * zoom, pt.y - 6 * zoom, 10 * zoom, 8 * zoom);
        ctx.fillStyle = d.accent;
        ctx.fillRect(pt.x - 4 * zoom, pt.y - 7 * zoom, 8 * zoom, 2 * zoom);
      }

      // Smoked polycarbonate canopy roof
      this.drawQuad(
        ctx,
        camera,
        [
          [x1 - 2, dugoutY - 20, 22],
          [x2 + 2, dugoutY - 20, 22],
          [x2 + 2, dugoutY + 2, 18],
          [x1 - 2, dugoutY + 2, 18],
        ],
        'rgba(148, 163, 184, 0.24)',
        'rgba(226, 232, 240, 0.55)',
        Math.max(1, 1.3 * zoom)
      );
    });
  }

  /**
   * High-performance batched spectator renderer using viewport culling and pre-rendered atlas sprites.
   */
  renderSpectatorBatch(ctx, camera, list) {
    const zoom = camera.zoom;
    const vw = camera.viewportWidth;
    const vh = camera.viewportHeight;
    const pad = 40;

    const t = this.time;
    const goalBoost = this.goalCelebration;
    const exc = Math.max(this.excitement, goalBoost);
    const atlas = this.atlasCanvas;
    const useSimpleLod = zoom < 0.56 || !atlas;

    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      const baseScreen = camera.worldToScreen(s.wx, s.wy, s.wz);

      // Frustum cull off-screen spectators immediately
      if (
        baseScreen.x < -pad ||
        baseScreen.x > vw + pad ||
        baseScreen.y < -pad ||
        baseScreen.y > vh + pad
      ) {
        continue;
      }

      // Team-biased celebration wave on goal
      let teamWave = 0;
      if (goalBoost > 0.05) {
        const isScoringFan =
          (this.scoringTeam === 'blue' && s.fanTeam === 'blue') ||
          (this.scoringTeam === 'red' && s.fanTeam === 'red') ||
          s.fanTeam === 'neutral';
        teamWave = isScoringFan ? goalBoost : goalBoost * 0.35;
      }

      const activeEnergy = Math.max(exc * (s.waver ? 0.95 : 0.45), teamWave);
      const bobSpeed = 2.6 + activeEnergy * 8.5;
      const bobAmp = (0.4 + activeEnergy * 4.4) * zoom;
      const bobY = Math.abs(Math.sin(t * bobSpeed + s.phase)) * bobAmp;

      // Choose animation pose frame (0 idle, 1 one-arm cheer, 2 two-arm scarf wave)
      let pose = 0;
      if (teamWave > 0.35) {
        pose = Math.sin(t * 10 + s.phase) > -0.2 ? 2 : 1;
      } else if (activeEnergy > 0.45 && s.waver) {
        pose = Math.sin(t * 5.2 + s.phase) > 0.1 ? 2 : 1;
      } else if (s.waver && Math.sin(t * 1.4 + s.phase) > 0.72) {
        pose = 1;
      }

      const drawW = CROWD_SPRITE_W * zoom * s.scale;
      const drawH = CROWD_SPRITE_H * zoom * s.scale;

      if (useSimpleLod) {
        // Ultra-fast LOD primitive for wide mobile overview zoom or headless fallback
        const r = Math.max(1.8, 3.2 * zoom * s.scale);
        ctx.fillStyle = s.variant < 3 ? this.homeShirt : s.variant < 6 ? this.awayShirt : '#CBD5E1';
        ctx.fillRect(baseScreen.x - r, baseScreen.y - r * 1.6 - bobY, r * 2, r * 2);
      } else {
        ctx.drawImage(
          atlas,
          pose * CROWD_SPRITE_W,
          s.variant * CROWD_SPRITE_H,
          CROWD_SPRITE_W,
          CROWD_SPRITE_H,
          baseScreen.x - drawW * 0.5,
          baseScreen.y - drawH * 0.85 - bobY,
          drawW,
          drawH
        );
      }
    }
  }

  /**
   * Segmented perimeter LED advertising boards along North, West, and East (clear of goal mouths!)
   */
  renderAdBoards(ctx, camera, halfW, halfH) {
    const boardH = 22;
    const yMargin = STADIUM_RUNOFF_Y - 16;
    const xMargin = STADIUM_RUNOFF_X - 4;
    const zoom = camera.zoom;

    const isGoal = this.goalCelebration > 0.1;
    const goalColor = this.scoringTeam === 'red' ? '#DC2626' : '#2563EB';
    const cycleIdx = Math.floor(this.time * 0.18) % 3;

    const messages = [
      `POCKET FOOTBALL LEAGUE ★ 2026`,
      this.isTournamentFinal
        ? 'POCKET CUP FINAL ★ LIVE'
        : 'ARCADE CHAMPIONSHIP ★ LIVE',
      'FAIR PLAY · RESPECT · ARENA',
    ];

    // 1. North Touchline LED Ribbons (split cleanly around technical dugouts & center tunnel)
    const northSegments = [
      { x1: -halfW - 45, x2: -185, text: isGoal ? '⚽ GOOOOOAL! ⚽' : `${this.homeName} ★ POCKET LEAGUE` },
      {
        x1: 185,
        x2: halfW + 45,
        text: isGoal
          ? '⚽ STADIUM ERUPTS! ⚽'
          : this.isTournamentFinal
            ? '🏆 POCKET CUP FINAL ★ LIVE'
            : `${this.awayName} ★ ${messages[cycleIdx]}`,
      },
    ];

    ctx.save();
    northSegments.forEach((seg, idx) => {
      const pL_g = camera.worldToScreen(seg.x1, -halfH - yMargin, 0);
      const pR_g = camera.worldToScreen(seg.x2, -halfH - yMargin, 0);
      const pL_t = camera.worldToScreen(seg.x1, -halfH - yMargin, boardH);
      const pR_t = camera.worldToScreen(seg.x2, -halfH - yMargin, boardH);

      ctx.beginPath();
      ctx.moveTo(pL_g.x, pL_g.y);
      ctx.lineTo(pR_g.x, pR_g.y);
      ctx.lineTo(pR_t.x, pR_t.y);
      ctx.lineTo(pL_t.x, pL_t.y);
      ctx.closePath();

      const grad = ctx.createLinearGradient(pL_t.x, pL_t.y, pR_t.x, pR_t.y);
      if (isGoal) {
        grad.addColorStop(0, goalColor);
        grad.addColorStop(0.5, '#F59E0B');
        grad.addColorStop(1, goalColor);
      } else if (idx === 0) {
        grad.addColorStop(0, '#0F172A');
        grad.addColorStop(0.5, this.homeShirt);
        grad.addColorStop(1, '#1E293B');
      } else {
        grad.addColorStop(0, '#1E293B');
        grad.addColorStop(0.5, this.awayShirt);
        grad.addColorStop(1, '#0F172A');
      }
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = 'rgba(248, 250, 252, 0.78)';
      ctx.lineWidth = Math.max(1, 1.2 * zoom);
      ctx.stroke();

      if (zoom > 0.62) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `bold ${Math.round(10 * zoom)}px 'Trebuchet MS', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(seg.text, (pL_t.x + pR_t.x) * 0.5, (pL_t.y + pL_g.y) * 0.5);
      }
    });

    // 2. West & East Endline LED Boards (flanking left & right of goal mouths so goals stay uncluttered)
    const halfGoalGap = PITCH.GOAL_WIDTH * 0.5 + 34;
    const endSegments = [
      { y1: -halfH - 25, y2: -halfGoalGap },
      { y1: halfGoalGap, y2: halfH + 25 },
    ];
    for (const side of [-1, 1]) {
      const bx = side * (halfW + xMargin);
      const col = isGoal ? goalColor : side < 0 ? this.homeShirt : this.awayShirt;
      endSegments.forEach((seg) => {
        this.drawQuad(
          ctx,
          camera,
          [
            [bx, seg.y1, boardH],
            [bx, seg.y2, boardH],
            [bx, seg.y2, 0],
            [bx, seg.y1, 0],
          ],
          col,
          'rgba(248, 250, 252, 0.72)',
          Math.max(1, 1.1 * zoom)
        );
      });
    }

    ctx.restore();
  }

  /**
   * Renders South Foreground Stand, bottom concrete barrier, corner floodlight towers,
   * and subtle atmospheric floodlight glow AFTER players/ball for accurate 2.5D occlusion.
   */
  renderForeground(ctx, camera, halfW, halfH) {
    const runoffW = halfW + STADIUM_RUNOFF_X;
    const runoffH = halfH + STADIUM_RUNOFF_Y;
    const xL = -runoffW + 4;
    const xR = runoffW - 4;
    const aisleXs = [-520, -260, 0, 260, 520];
    const zoom = camera.zoom;

    // 1. South Corners (lower corners)
    this.renderCornerStand(ctx, camera, -runoffW - 14, runoffH + 12, -1, 1);
    this.renderCornerStand(ctx, camera, runoffW + 14, runoffH + 12, 1, 1);

    // 2. South Touchline Stand (steep low-profile foreground tiers below runoff)
    const frontY = runoffH + 8;
    const backY = runoffH + 120;

    // Outer low concrete barrier wall along bottom runoff edge
    this.drawQuad(
      ctx,
      camera,
      [
        [xL, frontY, 10],
        [xR, frontY, 10],
        [xR, frontY, 0],
        [xL, frontY, 0],
      ],
      '#0F172A',
      '#475569',
      Math.max(1, zoom)
    );

    // South Stand Tier Deck
    this.drawQuad(
      ctx,
      camera,
      [
        [xL, frontY, 10],
        [xR, frontY, 10],
        [xR, backY, 54],
        [xL, backY, 54],
      ],
      '#1E293B',
      '#334155',
      Math.max(1, zoom)
    );

    // South Seat Rows (rendered front-to-back = ascending screen Y!)
    for (let r = 0; r < 4; r++) {
      const ry1 = runoffH + 14 + r * 26;
      const ry2 = ry1 + 16;
      const rz1 = 10 + r * 11;
      const rz2 = rz1 + 6;
      this.drawQuad(
        ctx,
        camera,
        [
          [xL + 8, ry1, rz1],
          [xR - 8, ry1, rz1],
          [xR - 8, ry2, rz2],
          [xL + 8, ry2, rz2],
        ],
        r % 2 === 0 ? '#263449' : '#2F3F57'
      );
      this.renderSeatBlocks(ctx, camera, xL + 16, xR - 16, ry1 + 6, rz1 + 2, aisleXs, zoom);
    }

    // South Stair Aisles
    aisleXs.forEach((ax) => {
      this.drawQuad(
        ctx,
        camera,
        [
          [ax - 12, frontY, 10],
          [ax + 12, frontY, 10],
          [ax + 12, backY, 54],
          [ax - 12, backY, 54],
        ],
        '#475569'
      );
    });

    // Front Safety Rail
    this.renderHorizontalRailing(ctx, camera, xL, xR, frontY, 10, 6, zoom);

    // 3. South & Lower-Corner Spectators
    this.renderSpectatorBatch(ctx, camera, this.spectatorsFront);

    // 4. Front Floodlight Towers & Overhead Floodlight Glow Halos
    this.renderFloodlightStructure(ctx, camera, this.floodlights[2], false);
    this.renderFloodlightStructure(ctx, camera, this.floodlights[3], false);
    this.floodlights.forEach((fl) => this.renderFloodlightStructure(ctx, camera, fl, true));
  }

  /**
   * Draws either a corner floodlight pylon mast or its elevated LED head + subtle soft light halo
   */
  renderFloodlightStructure(ctx, camera, fl, headOnly) {
    const base = camera.worldToScreen(fl.x, fl.y, 40);
    const top = camera.worldToScreen(fl.x, fl.y, fl.h);
    const zoom = camera.zoom;

    // Cull far off-screen towers
    const pad = 160;
    if (
      top.x < -pad ||
      top.x > camera.viewportWidth + pad ||
      top.y < -pad ||
      base.y > camera.viewportHeight + pad
    ) {
      return;
    }

    ctx.save();
    if (!headOnly) {
      // Steel lattice pylon mast
      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = Math.max(2, 5 * zoom);
      ctx.beginPath();
      ctx.moveTo(base.x, base.y);
      ctx.lineTo(top.x, top.y);
      ctx.stroke();

      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = Math.max(1, 2 * zoom);
      ctx.beginPath();
      ctx.moveTo(base.x - 4 * zoom, base.y);
      ctx.lineTo(top.x - 2 * zoom, top.y);
      ctx.moveTo(base.x + 4 * zoom, base.y);
      ctx.lineTo(top.x + 2 * zoom, top.y);
      ctx.stroke();
    } else {
      // Elevated LED Floodlight Lamp Bank angled toward pitch
      const tilt = fl.dirX * 0.25;
      const bankW = 34 * zoom;
      const bankH = 18 * zoom;

      // Soft warm-white atmospheric glow halo around the floodlight bank (subtle, non-blinding)
      const glowRadius = 85 * zoom;
      const halo = ctx.createRadialGradient(top.x, top.y, 4 * zoom, top.x, top.y, glowRadius);
      halo.addColorStop(0, 'rgba(255, 252, 235, 0.34)');
      halo.addColorStop(0.35, 'rgba(224, 242, 254, 0.11)');
      halo.addColorStop(1, 'rgba(224, 242, 254, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(top.x, top.y, glowRadius, 0, Math.PI * 2);
      ctx.fill();

      // Lamp housing frame
      ctx.translate(top.x, top.y);
      ctx.rotate(tilt);
      ctx.fillStyle = '#1E293B';
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = Math.max(1, 1.5 * zoom);
      ctx.beginPath();
      ctx.roundRect(-bankW * 0.5, -bankH * 0.5, bankW, bankH, 3 * zoom);
      ctx.fill();
      ctx.stroke();

      // 2x4 LED lamp cells
      const cols = 4;
      const rows = 2;
      const cellW = (bankW - 8 * zoom) / cols;
      const cellH = (bankH - 6 * zoom) / rows;
      ctx.fillStyle = '#FEFCE8';
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          ctx.fillRect(
            -bankW * 0.5 + 4 * zoom + c * cellW + 1,
            -bankH * 0.5 + 3 * zoom + r * cellH + 1,
            Math.max(1.5, cellW - 2),
            Math.max(1.5, cellH - 2)
          );
        }
      }
    }
    ctx.restore();
  }
}
