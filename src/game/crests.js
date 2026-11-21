/**
 * Pure Vector Club Crests (Inline SVG + Canvas 2D)
 * Draws sharp, zero-latency geometric club shields using chevrons, arrows,
 * stripes, crowns, tridents, diamonds, cannons, and stars — no images or emojis.
 */

const SHIELD_PATH = 'M32 6 L54 13 V31 C54 45 43.5 54.5 32 59 C20.5 54.5 10 45 10 31 V13 Z';
const INNER_SHIELD_PATH = 'M32 9.5 L50.5 15.5 V31 C50.5 42.8 41.6 51 32 55 C22.4 51 13.5 42.8 13.5 31 V15.5 Z';

export function getClubCrestSvg(teamOrId, className = 'club-crest-svg') {
  const id = typeof teamOrId === 'string' ? teamOrId : teamOrId?.id;
  let body = '';

  switch (id) {
    case 'waves': // Blue City: Sky-blue & white shield with wave chevrons & gold upward arrow/crown
      body = `
        <path d="${SHIELD_PATH}" fill="#1C2C5B" stroke="#93C5FD" stroke-width="2.2"/>
        <path d="${INNER_SHIELD_PATH}" fill="#6CABDD"/>
        <path d="M13.5 35 L32 25 L50.5 35 L50.5 41 L32 31 L13.5 41 Z" fill="#FFFFFF" opacity="0.95"/>
        <path d="M16 44 L32 35 L48 44 L32 55 Z" fill="#1C2C5B"/>
        <path d="M32 13 L40 23 H35 V28 H29 V23 H24 Z" fill="#FACC15"/>
      `;
      break;

    case 'strikers': // Red United: Crimson & black shield with gold trident arrows & twin stars
      body = `
        <path d="${SHIELD_PATH}" fill="#111827" stroke="#FBBF24" stroke-width="2.2"/>
        <path d="${INNER_SHIELD_PATH}" fill="#DA291C"/>
        <path d="M13.5 18 H50.5 V25 H13.5 Z" fill="#111827" opacity="0.78"/>
        <path d="M32 15 L36 22 H33.5 V45 H30.5 V22 H28 Z" fill="#FBBF24"/>
        <path d="M21 23 L25.5 26 V34 L30.5 36.5 V39.5 L22.5 36 V26.5 L20 26.5 Z" fill="#FBBF24"/>
        <path d="M43 23 L38.5 26 V34 L33.5 36.5 V39.5 L41.5 36 V26.5 L44 26.5 Z" fill="#FBBF24"/>
        <polygon points="21,19 22,21 24,21 22.4,22.3 23,24.3 21,23.1 19,24.3 19.6,22.3 18,21 20,21" fill="#FBBF24"/>
        <polygon points="43,19 44,21 46,21 44.4,22.3 45,24.3 43,23.1 41,24.3 41.6,22.3 40,21 42,21" fill="#FBBF24"/>
      `;
      break;

    case 'blancos': // Madrid Blancos: Pearl-white & gold circle with royal-blue sash & crown
      body = `
        <circle cx="32" cy="34" r="23" fill="#F8FAFC" stroke="#FACC15" stroke-width="3"/>
        <path d="M15 47 L43 17 L49 23 L21 53 Z" fill="#1D4ED8"/>
        <circle cx="32" cy="34" r="20" fill="none" stroke="#1E293B" stroke-width="1.2" opacity="0.25"/>
        <path d="M21 15 L24 7 L29 12 L32 5 L35 12 L40 7 L43 15 Z" fill="#FACC15" stroke="#B45309" stroke-width="1.2" stroke-linejoin="round"/>
      `;
      break;

    case 'blau': // Barcelona Blaugrana: Garnet & blue shield with gold border & top cross
      body = `
        <path d="${SHIELD_PATH}" fill="#FBBF24"/>
        <path d="${INNER_SHIELD_PATH}" fill="#1D4ED8"/>
        <path d="M13.5 15.5 L32 9.5 L50.5 15.5 V29 H13.5 Z" fill="#F8FAFC"/>
        <rect x="29" y="10.5" width="6" height="18.5" fill="#DC2626"/>
        <rect x="13.5" y="18" width="37" height="5" fill="#DC2626"/>
        <path d="M18 32 H24.5 V50.5 L18 46.5 Z" fill="#800020"/>
        <path d="M29 32 H35 V53.5 L32 55 L29 53.5 Z" fill="#800020"/>
        <path d="M39.5 32 H46 V46.5 L39.5 50.5 Z" fill="#800020"/>
        <rect x="13.5" y="28.5" width="37" height="3.8" fill="#FBBF24"/>
        <circle cx="32" cy="43" r="6" fill="#FBBF24" stroke="#111827" stroke-width="1.4"/>
      `;
      break;

    case 'devils': // Milan Devils: Red & black oval shield with devil horn chevrons & gold star
      body = `
        <ellipse cx="32" cy="34" rx="20" ry="24" fill="#18181B" stroke="#E2E8F0" stroke-width="2.4"/>
        <path d="M20 15 V53 M28 11 V57 M36 11 V57 M44 15 V53" stroke="#DC2626" stroke-width="4.5"/>
        <ellipse cx="32" cy="34" rx="18.5" ry="22.5" fill="none" stroke="#18181B" stroke-width="2"/>
        <path d="M18 22 L27 33 L18 42 L22 33 Z" fill="#FACC15"/>
        <path d="M46 22 L37 33 L46 42 L42 33 Z" fill="#FACC15"/>
        <polygon points="32,4 34,9 39,9 35,12 36.5,17 32,14 27.5,17 29,12 25,9 30,9" fill="#FACC15"/>
      `;
      break;

    case 'titans': // Munich Titans: Crimson outer ring + Bavarian blue & white diamond grid
      body = `
        <circle cx="32" cy="32" r="25" fill="#B91C1C" stroke="#FCA5A5" stroke-width="2"/>
        <circle cx="32" cy="32" r="18.5" fill="#FFFFFF" stroke="#1E3A8A" stroke-width="1.5"/>
        <polygon points="32,16 39,24 32,32 25,24" fill="#1E3A8A"/>
        <polygon points="32,32 39,40 32,48 25,40" fill="#1E3A8A"/>
        <polygon points="21,24 28,32 21,40 14,32" fill="#1E3A8A"/>
        <polygon points="43,24 50,32 43,40 36,32" fill="#1E3A8A"/>
      `;
      break;

    case 'gunners': // London Gunners: Bright red shield with golden cannon & forward arrow
      body = `
        <path d="${SHIELD_PATH}" fill="#FFFFFF" stroke="#FBBF24" stroke-width="2.2"/>
        <path d="${INNER_SHIELD_PATH}" fill="#EF4444"/>
        <path d="M17 30 L45 25 L47 32 L18 35 Z" fill="#FBBF24" stroke="#78350F" stroke-width="1.2"/>
        <polygon points="45,23 52,27.5 46,34" fill="#FDE047"/>
        <circle cx="26" cy="37" r="6.5" fill="#1E293B" stroke="#FBBF24" stroke-width="2"/>
        <circle cx="26" cy="37" r="2" fill="#FBBF24"/>
      `;
      break;

    case 'stars': // Paris Stars: Midnight navy circle, red center pillar, white spire & gold star
      body = `
        <circle cx="32" cy="32" r="25" fill="#1E293B" stroke="#FB7185" stroke-width="2.2"/>
        <rect x="26" y="10" width="12" height="44" rx="2" fill="#F43F5E"/>
        <path d="M32 13 L43 49 H37 L35 41 H29 L27 49 H21 Z" fill="#FFFFFF"/>
        <polygon points="32,20 34,25.5 39.5,25.5 35,29 36.8,34.5 32,31 27.2,34.5 29,29 24.5,25.5 30,25.5" fill="#FACC15"/>
      `;
      break;

    default: // Generic crisp arcade shield
      body = `
        <path d="${SHIELD_PATH}" fill="#1E293B" stroke="#64748B" stroke-width="2.2"/>
        <path d="M23 30 L32 21 L41 30 L37 34 L32 29 L27 34 Z" fill="#94A3B8"/>
      `;
      break;
  }

  return `<svg viewBox="0 0 64 64" class="${className}" aria-hidden="true">${body}</svg>`;
}

/**
 * Draws a vector club crest directly onto an HTML5 Canvas 2D context (for Goal Banner).
 */
export function drawClubCrestCanvas(ctx, teamOrId, cx, cy, size = 26) {
  const id = typeof teamOrId === 'string' ? teamOrId : teamOrId?.id;
  const r = size / 2;

  ctx.save();
  ctx.translate(cx, cy);

  const traceShield = (s) => {
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.92);
    ctx.lineTo(s * 0.78, -s * 0.65);
    ctx.lineTo(s * 0.78, s * 0.05);
    ctx.quadraticCurveTo(s * 0.78, s * 0.65, 0, s * 0.95);
    ctx.quadraticCurveTo(-s * 0.78, s * 0.65, -s * 0.78, s * 0.05);
    ctx.lineTo(-s * 0.78, -s * 0.65);
    ctx.closePath();
  };

  if (id === 'blancos' || id === 'titans' || id === 'stars') {
    const bg = id === 'blancos' ? '#F8FAFC' : id === 'titans' ? '#B91C1C' : '#1E293B';
    const rim = id === 'blancos' ? '#FACC15' : id === 'titans' ? '#FFFFFF' : '#FB7185';
    ctx.fillStyle = bg;
    ctx.strokeStyle = rim;
    ctx.lineWidth = Math.max(1.8, size * 0.1);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if (id === 'blancos') {
      ctx.strokeStyle = '#1D4ED8';
      ctx.lineWidth = Math.max(2, size * 0.16);
      ctx.beginPath();
      ctx.moveTo(-r * 0.52, r * 0.52);
      ctx.lineTo(r * 0.52, -r * 0.52);
      ctx.stroke();
    } else if (id === 'titans') {
      ctx.fillStyle = '#1E3A8A';
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.48);
      ctx.lineTo(r * 0.48, 0);
      ctx.lineTo(0, r * 0.48);
      ctx.lineTo(-r * 0.48, 0);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = '#F43F5E';
      ctx.fillRect(-r * 0.22, -r * 0.72, r * 0.44, r * 1.44);
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.55);
      ctx.lineTo(r * 0.38, r * 0.55);
      ctx.lineTo(-r * 0.38, r * 0.55);
      ctx.closePath();
      ctx.fill();
    }
  } else {
    const fillMap = {
      waves: '#6CABDD',
      strikers: '#DA291C',
      blau: '#800020',
      devils: '#DC2626',
      gunners: '#EF4444',
    };
    const rimMap = {
      waves: '#1C2C5B',
      strikers: '#FBBF24',
      blau: '#FBBF24',
      devils: '#18181B',
      gunners: '#FBBF24',
    };

    traceShield(r);
    ctx.fillStyle = fillMap[id] || '#1E293B';
    ctx.strokeStyle = rimMap[id] || '#94A3B8';
    ctx.lineWidth = Math.max(1.8, size * 0.1);
    ctx.fill();
    ctx.stroke();

    // Inner chevron / arrow detail
    ctx.fillStyle = id === 'waves' ? '#FFFFFF' : id === 'blau' ? '#1D4ED8' : '#FBBF24';
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.42);
    ctx.lineTo(r * 0.42, r * 0.18);
    ctx.lineTo(0, 0);
    ctx.lineTo(-r * 0.42, r * 0.18);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}
