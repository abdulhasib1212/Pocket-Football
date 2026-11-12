/**
 * Pitch & Miniature Stadium Renderer
 * Renders the 2.5D football pitch, markings, realistic 3D goals, perimeter boards, and stadium stands.
 */
import { PITCH } from './constants.js';

export class Pitch {
  constructor() {
    this.stripeColors = ['#2f8f48', '#287d3e'];
    this.flagSwing = 0;
  }

  update(dt) {
    this.flagSwing += dt * 3.5;
  }

  render(ctx, camera) {
    const halfW = PITCH.WIDTH / 2;
    const halfH = PITCH.HEIGHT / 2;

    // 1. Stadium Grandstands & Miniature Surrounds
    this.renderStadium(ctx, camera, halfW, halfH);

    // 2. Outer grass apron / runoff
    this.renderRunoff(ctx, camera, halfW, halfH);

    // 3. Striped Mown Grass Pitch
    this.renderTurf(ctx, camera, halfW, halfH);

    // 4. White Pitch Markings
    this.renderMarkings(ctx, camera, halfW, halfH);

    // 5. Perimeter Advertising Boards
    this.renderAdBoards(ctx, camera, halfW, halfH);

    // 6. Corner Flags
    this.renderCornerFlags(ctx, camera, halfW, halfH);

    // 7. Goals (Back nets and frames)
    this.renderGoals(ctx, camera, halfW, halfH);
  }

  renderStadium(ctx, camera, halfW, halfH) {
    const marginX = PITCH.MARGIN_X + 180;
    const marginY = PITCH.MARGIN_Y + 140;

    const topLeft = camera.worldToScreen(-halfW - marginX, -halfH - marginY, 0);
    const topRight = camera.worldToScreen(halfW + marginX, -halfH - marginY, 0);
    const botRight = camera.worldToScreen(halfW + marginX, halfH + marginY, 0);
    const botLeft = camera.worldToScreen(-halfW - marginX, halfH + marginY, 0);

    // Deep stadium floor
    ctx.beginPath();
    ctx.moveTo(topLeft.x, topLeft.y);
    ctx.lineTo(topRight.x, topRight.y);
    ctx.lineTo(botRight.x, botRight.y);
    ctx.lineTo(botLeft.x, botLeft.y);
    ctx.closePath();
    ctx.fillStyle = '#111827'; // Dark stadium concrete
    ctx.fill();

    // Stadium stand tiers (top & bottom)
    const standColors = ['#1e293b', '#334155', '#475569'];
    const crowdPalette = ['#e63946', '#1d3557', '#f1faee', '#a8dadc', '#457b9d', '#e9c46a'];

    // Top Grandstand
    for (let tier = 0; tier < 3; tier++) {
      const yOffset = -halfH - PITCH.MARGIN_Y - (tier * 35) - 10;
      const tZ = tier * 18;
      const p1 = camera.worldToScreen(-halfW - 120, yOffset, tZ);
      const p2 = camera.worldToScreen(halfW + 120, yOffset, tZ);
      const p3 = camera.worldToScreen(halfW + 120, yOffset - 32, tZ + 12);
      const p4 = camera.worldToScreen(-halfW - 120, yOffset - 32, tZ + 12);

      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(p3.x, p3.y);
      ctx.lineTo(p4.x, p4.y);
      ctx.closePath();
      ctx.fillStyle = standColors[tier];
      ctx.fill();

      // Stylized miniature crowd spectators
      const step = 28 * camera.zoom;
      if (step > 6) {
        ctx.save();
        for (let x = p1.x + 10; x < p2.x - 10; x += step) {
          const colorIdx = Math.floor((Math.sin(x * 123.45) * 0.5 + 0.5) * crowdPalette.length);
          ctx.fillStyle = crowdPalette[colorIdx];
          const headY = (p1.y + p3.y) / 2;
          ctx.beginPath();
          ctx.arc(x, headY, 2.5 * camera.zoom, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }
  }

  renderRunoff(ctx, camera, halfW, halfH) {
    const mx = PITCH.MARGIN_X;
    const my = PITCH.MARGIN_Y;

    const p1 = camera.worldToScreen(-halfW - mx, -halfH - my, 0);
    const p2 = camera.worldToScreen(halfW + mx, -halfH - my, 0);
    const p3 = camera.worldToScreen(halfW + mx, halfH + my, 0);
    const p4 = camera.worldToScreen(-halfW - mx, halfH + my, 0);

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.lineTo(p4.x, p4.y);
    ctx.closePath();

    // Lush fringe grass
    ctx.fillStyle = '#226934';
    ctx.fill();
  }

  renderTurf(ctx, camera, halfW, halfH) {
    const stripes = PITCH.STRIPE_COUNT;
    const stripeWidth = PITCH.WIDTH / stripes;

    for (let i = 0; i < stripes; i++) {
      const sx1 = -halfW + i * stripeWidth;
      const sx2 = sx1 + stripeWidth;

      const p1 = camera.worldToScreen(sx1, -halfH, 0);
      const p2 = camera.worldToScreen(sx2, -halfH, 0);
      const p3 = camera.worldToScreen(sx2, halfH, 0);
      const p4 = camera.worldToScreen(sx1, halfH, 0);

      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(p3.x, p3.y);
      ctx.lineTo(p4.x, p4.y);
      ctx.closePath();

      ctx.fillStyle = this.stripeColors[i % 2];
      ctx.fill();
    }
  }

  renderMarkings(ctx, camera, halfW, halfH) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.88)';
    ctx.lineWidth = Math.max(1.8, PITCH.LINE_WIDTH * camera.zoom);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 1. Boundary Touchlines and Goal Lines
    const tl = camera.worldToScreen(-halfW, -halfH, 0);
    const tr = camera.worldToScreen(halfW, -halfH, 0);
    const br = camera.worldToScreen(halfW, halfH, 0);
    const bl = camera.worldToScreen(-halfW, halfH, 0);

    ctx.beginPath();
    ctx.moveTo(tl.x, tl.y);
    ctx.lineTo(tr.x, tr.y);
    ctx.lineTo(br.x, br.y);
    ctx.lineTo(bl.x, bl.y);
    ctx.closePath();
    ctx.stroke();

    // 2. Halfway Line
    const midTop = camera.worldToScreen(0, -halfH, 0);
    const midBot = camera.worldToScreen(0, halfH, 0);
    ctx.beginPath();
    ctx.moveTo(midTop.x, midTop.y);
    ctx.lineTo(midBot.x, midBot.y);
    ctx.stroke();

    // 3. Center Circle (projected circle/ellipse)
    const center = camera.worldToScreen(0, 0, 0);
    const rX = PITCH.CENTER_CIRCLE_RADIUS * camera.zoom;
    const rY = PITCH.CENTER_CIRCLE_RADIUS * camera.zoom * 0.72; // Isometric tilt
    ctx.beginPath();
    ctx.ellipse(center.x, center.y, rX, rY, 0, 0, Math.PI * 2);
    ctx.stroke();

    // 4. Center Spot
    ctx.beginPath();
    ctx.arc(center.x, center.y, PITCH.CENTER_SPOT_RADIUS * camera.zoom, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();

    // 5. Penalty Areas (Left & Right)
    this.renderBox(ctx, camera, -halfW, 0, PITCH.PENALTY_AREA_DEPTH, PITCH.PENALTY_AREA_WIDTH, 1);
    this.renderBox(ctx, camera, halfW, 0, PITCH.PENALTY_AREA_DEPTH, PITCH.PENALTY_AREA_WIDTH, -1);

    // 6. Goal Areas (6-yard box)
    this.renderBox(ctx, camera, -halfW, 0, PITCH.GOAL_AREA_DEPTH, PITCH.GOAL_AREA_WIDTH, 1);
    this.renderBox(ctx, camera, halfW, 0, PITCH.GOAL_AREA_DEPTH, PITCH.GOAL_AREA_WIDTH, -1);

    // 7. Penalty Spots
    const spotLeft = camera.worldToScreen(-halfW + PITCH.PENALTY_SPOT_DIST, 0, 0);
    const spotRight = camera.worldToScreen(halfW - PITCH.PENALTY_SPOT_DIST, 0, 0);
    ctx.beginPath();
    ctx.arc(spotLeft.x, spotLeft.y, 3 * camera.zoom, 0, Math.PI * 2);
    ctx.arc(spotRight.x, spotRight.y, 3 * camera.zoom, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();

    // 8. Penalty D Arcs
    const dRadiusX = 65 * camera.zoom;
    const dRadiusY = 65 * camera.zoom * 0.72;
    ctx.beginPath();
    ctx.ellipse(spotLeft.x, spotLeft.y, dRadiusX, dRadiusY, 0, -Math.PI * 0.35, Math.PI * 0.35);
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(spotRight.x, spotRight.y, dRadiusX, dRadiusY, 0, Math.PI * 0.65, Math.PI * 1.35);
    ctx.stroke();

    // 9. Corner Arcs
    const cR = PITCH.CORNER_ARC_RADIUS * camera.zoom;
    const cRy = cR * 0.72;
    // Top-Left
    ctx.beginPath();
    ctx.ellipse(tl.x, tl.y, cR, cRy, 0, 0, Math.PI * 0.5);
    ctx.stroke();
    // Top-Right
    ctx.beginPath();
    ctx.ellipse(tr.x, tr.y, cR, cRy, 0, Math.PI * 0.5, Math.PI);
    ctx.stroke();
    // Bottom-Right
    ctx.beginPath();
    ctx.ellipse(br.x, br.y, cR, cRy, 0, Math.PI, Math.PI * 1.5);
    ctx.stroke();
    // Bottom-Left
    ctx.beginPath();
    ctx.ellipse(bl.x, bl.y, cR, cRy, 0, Math.PI * 1.5, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  renderBox(ctx, camera, goalLineX, centerY, depth, width, dir) {
    const halfBoxW = width / 2;
    const xEdge = goalLineX + depth * dir;

    const p1 = camera.worldToScreen(goalLineX, centerY - halfBoxW, 0);
    const p2 = camera.worldToScreen(xEdge, centerY - halfBoxW, 0);
    const p3 = camera.worldToScreen(xEdge, centerY + halfBoxW, 0);
    const p4 = camera.worldToScreen(goalLineX, centerY + halfBoxW, 0);

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.lineTo(p4.x, p4.y);
    ctx.stroke();
  }

  renderAdBoards(ctx, camera, halfW, halfH) {
    const boardH = 26; // Height off ground
    const yMargin = PITCH.MARGIN_Y - 25;
    const xMargin = PITCH.MARGIN_X - 25;

    // Top ad board ribbon
    const pTopL_ground = camera.worldToScreen(-halfW - 40, -halfH - yMargin, 0);
    const pTopR_ground = camera.worldToScreen(halfW + 40, -halfH - yMargin, 0);
    const pTopL_top = camera.worldToScreen(-halfW - 40, -halfH - yMargin, boardH);
    const pTopR_top = camera.worldToScreen(halfW + 40, -halfH - yMargin, boardH);

    ctx.save();
    // Front face
    ctx.beginPath();
    ctx.moveTo(pTopL_ground.x, pTopL_ground.y);
    ctx.lineTo(pTopR_ground.x, pTopR_ground.y);
    ctx.lineTo(pTopR_top.x, pTopR_top.y);
    ctx.lineTo(pTopL_top.x, pTopL_top.y);
    ctx.closePath();

    const adGradient = ctx.createLinearGradient(pTopL_top.x, pTopL_top.y, pTopR_top.x, pTopR_top.y);
    adGradient.addColorStop(0, '#1E3A8A');
    adGradient.addColorStop(0.35, '#2563EB');
    adGradient.addColorStop(0.7, '#DC2626');
    adGradient.addColorStop(1, '#991B1B');
    ctx.fillStyle = adGradient;
    ctx.fill();

    // Border bevel
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.2 * camera.zoom;
    ctx.stroke();

    // LED text
    if (camera.zoom > 0.65) {
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `bold ${Math.round(11 * camera.zoom)}px 'Trebuchet MS', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const textX = (pTopL_top.x + pTopR_top.x) / 2;
      const textY = (pTopL_top.y + pTopL_ground.y) / 2;
      ctx.fillText('★ POCKET FOOTBALL LEAGUE ★ ARCADE CHAMPIONSHIP 2026 ★', textX, textY);
    }

    ctx.restore();
  }

  renderCornerFlags(ctx, camera, halfW, halfH) {
    const corners = [
      { x: -halfW, y: -halfH, color: '#FFD700' },
      { x: halfW, y: -halfH, color: '#FFD700' },
      { x: -halfW, y: halfH, color: '#FFD700' },
      { x: halfW, y: halfH, color: '#FFD700' },
    ];

    ctx.save();
    corners.forEach((c) => {
      const base = camera.worldToScreen(c.x, c.y, 0);
      const top = camera.worldToScreen(c.x, c.y, 30);

      // Flag pole
      ctx.beginPath();
      ctx.moveTo(base.x, base.y);
      ctx.lineTo(top.x, top.y);
      ctx.strokeStyle = '#F8FAFC';
      ctx.lineWidth = 2 * camera.zoom;
      ctx.stroke();

      // Flag pennant
      const wave = Math.sin(this.flagSwing + c.x) * 3 * camera.zoom;
      ctx.beginPath();
      ctx.moveTo(top.x, top.y);
      ctx.lineTo(top.x + 10 * camera.zoom + wave, top.y + 4 * camera.zoom);
      ctx.lineTo(top.x, top.y + 9 * camera.zoom);
      ctx.closePath();
      ctx.fillStyle = c.color;
      ctx.fill();
    });
    ctx.restore();
  }

  renderGoals(ctx, camera, halfW, halfH) {
    // Render Left Goal (Blue team defends)
    this.renderSingleGoal(ctx, camera, -halfW, -1);
    // Render Right Goal (Red team defends)
    this.renderSingleGoal(ctx, camera, halfW, 1);
  }

  renderSingleGoal(ctx, camera, goalLineX, dir) {
    const halfGW = PITCH.GOAL_WIDTH / 2;
    const depth = PITCH.GOAL_DEPTH * dir;
    const gh = PITCH.GOAL_HEIGHT;

    // Ground posts
    const postTopGround = camera.worldToScreen(goalLineX, -halfGW, 0);
    const postBotGround = camera.worldToScreen(goalLineX, halfGW, 0);

    // Crossbar top points
    const postTopZ = camera.worldToScreen(goalLineX, -halfGW, gh);
    const postBotZ = camera.worldToScreen(goalLineX, halfGW, gh);

    // Rear ground points
    const backTopGround = camera.worldToScreen(goalLineX + depth, -halfGW, 0);
    const backBotGround = camera.worldToScreen(goalLineX + depth, halfGW, 0);

    // Rear top points
    const backTopZ = camera.worldToScreen(goalLineX + depth, -halfGW, gh * 0.85);
    const backBotZ = camera.worldToScreen(goalLineX + depth, halfGW, gh * 0.85);

    ctx.save();

    // 1. Goal Netting (hexagonal / grid look with subtle white grid)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1 * camera.zoom;

    // Back Net plane
    ctx.beginPath();
    ctx.moveTo(backTopGround.x, backTopGround.y);
    ctx.lineTo(backBotGround.x, backBotGround.y);
    ctx.lineTo(backBotZ.x, backBotZ.y);
    ctx.lineTo(backTopZ.x, backTopZ.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Roof Net plane
    ctx.beginPath();
    ctx.moveTo(postTopZ.x, postTopZ.y);
    ctx.lineTo(postBotZ.x, postBotZ.y);
    ctx.lineTo(backBotZ.x, backBotZ.y);
    ctx.lineTo(backTopZ.x, backTopZ.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Side Net top
    ctx.beginPath();
    ctx.moveTo(postTopGround.x, postTopGround.y);
    ctx.lineTo(postTopZ.x, postTopZ.y);
    ctx.lineTo(backTopZ.x, backTopZ.y);
    ctx.lineTo(backTopGround.x, backTopGround.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Side Net bottom
    ctx.beginPath();
    ctx.moveTo(postBotGround.x, postBotGround.y);
    ctx.lineTo(postBotZ.x, postBotZ.y);
    ctx.lineTo(backBotZ.x, backBotZ.y);
    ctx.lineTo(backBotGround.x, backBotGround.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 2. Goal Stanchions & Ground Frame
    ctx.strokeStyle = 'rgba(200, 210, 225, 0.8)';
    ctx.lineWidth = 2.5 * camera.zoom;
    ctx.beginPath();
    ctx.moveTo(backTopGround.x, backTopGround.y);
    ctx.lineTo(backBotGround.x, backBotGround.y);
    ctx.moveTo(postTopGround.x, postTopGround.y);
    ctx.lineTo(backTopGround.x, backTopGround.y);
    ctx.moveTo(postBotGround.x, postBotGround.y);
    ctx.lineTo(backBotGround.x, backBotGround.y);
    ctx.stroke();

    // 3. Front White Posts and Crossbar (Solid metallic white with specular highlight)
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = Math.max(2.5, 4.5 * camera.zoom);
    ctx.lineCap = 'round';

    // Top vertical post
    ctx.beginPath();
    ctx.moveTo(postTopGround.x, postTopGround.y);
    ctx.lineTo(postTopZ.x, postTopZ.y);
    ctx.stroke();

    // Bottom vertical post
    ctx.beginPath();
    ctx.moveTo(postBotGround.x, postBotGround.y);
    ctx.lineTo(postBotZ.x, postBotZ.y);
    ctx.stroke();

    // Crossbar
    ctx.beginPath();
    ctx.moveTo(postTopZ.x, postTopZ.y);
    ctx.lineTo(postBotZ.x, postBotZ.y);
    ctx.stroke();

    ctx.restore();
  }
}
