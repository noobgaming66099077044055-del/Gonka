/**
 * Track Definitions and Spline Generator for Turbo Poyga
 */

// Catmull-Rom closed spline interpolation
function generateClosedSpline(points, segmentsPerCurve = 30) {
  const n = points.length;
  const spline = [];

  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];

    for (let t = 0; t < segmentsPerCurve; t++) {
      const u = t / segmentsPerCurve;
      const u2 = u * u;
      const u3 = u2 * u;

      // Catmull-Rom formula
      const x = 0.5 * (
        (2 * p1.x) +
        (-p0.x + p2.x) * u +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * u2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * u3
      );

      const y = 0.5 * (
        (2 * p1.y) +
        (-p0.y + p2.y) * u +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * u2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * u3
      );

      spline.push({ x, y });
    }
  }

  // Calculate tangents, normals, and cumulative distance
  let totalLength = 0;
  for (let i = 0; i < spline.length; i++) {
    const next = spline[(i + 1) % spline.length];
    const prev = spline[(i - 1 + spline.length) % spline.length];

    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;

    // Unit tangent
    const tx = dx / len;
    const ty = dy / len;

    // Normal (perpendicular to tangent)
    const nx = -ty;
    const ny = tx;

    spline[i].tx = tx;
    spline[i].ty = ty;
    spline[i].nx = nx;
    spline[i].ny = ny;
    spline[i].angle = Math.atan2(ty, tx);

    const stepDist = Math.hypot(next.x - spline[i].x, next.y - spline[i].y);
    spline[i].dist = totalLength;
    totalLength += stepDist;
  }

  return { spline, totalLength };
}

// Find closest point on spline to a given (x, y)
function getClosestSplinePoint(spline, x, y, searchHintIndex = 0, searchRadius = 40) {
  let bestIdx = searchHintIndex;
  let minDistSq = Infinity;
  const n = spline.length;

  // Search within window around searchHintIndex if specified
  const range = searchRadius > 0 ? searchRadius : n;
  for (let offset = -range; offset <= range; offset++) {
    const idx = (searchHintIndex + offset + n) % n;
    const pt = spline[idx];
    const distSq = (pt.x - x) ** 2 + (pt.y - y) ** 2;
    if (distSq < minDistSq) {
      minDistSq = distSq;
      bestIdx = idx;
    }
  }

  // Fallback: if nearest point in window is too far, do a full scan
  if (minDistSq > 250 * 250 && searchRadius > 0) {
    for (let i = 0; i < n; i++) {
      const pt = spline[i];
      const distSq = (pt.x - x) ** 2 + (pt.y - y) ** 2;
      if (distSq < minDistSq) {
        minDistSq = distSq;
        bestIdx = i;
      }
    }
  }

  return {
    index: bestIdx,
    point: spline[bestIdx],
    distance: Math.sqrt(minDistSq)
  };
}

// Tracks repository
const TRACKS = [
  {
    id: 'city',
    name: 'Shahar Halqasi',
    theme: 'city',
    difficulty: 'Oson',
    diffClass: 'diff-easy',
    description: 'Keng ko\'chalar, yumshoq burilishlar va yuqori tezlik.',
    trackWidth: 155,
    groundColor: '#2b5a2b',
    roadColor: '#252930',
    curbColor1: '#ff2a2a',
    curbColor2: '#ffffff',
    ambientColor: 'rgba(255, 255, 255, 0.05)',
    waypoints: [
      { x: 300, y: 700 },
      { x: 750, y: 700 },
      { x: 1200, y: 650 },
      { x: 1550, y: 500 },
      { x: 1700, y: 250 },
      { x: 1550, y: -50 },
      { x: 1200, y: -200 },
      { x: 800, y: -100 },
      { x: 500, y: 150 },
      { x: 200, y: 150 },
      { x: -50, y: -100 },
      { x: -350, y: 100 },
      { x: -300, y: 450 },
      { x: -50, y: 700 }
    ],
    generateScenery: function(spline, width) {
      const items = [];
      // Trees, lamp posts, grandstands
      for (let i = 0; i < spline.length; i += 18) {
        const pt = spline[i];
        // Left side
        items.push({
          type: (i % 36 === 0) ? 'lamp' : 'tree',
          x: pt.x + pt.nx * (width / 2 + 55 + (i % 7) * 8),
          y: pt.y + pt.ny * (width / 2 + 55 + (i % 7) * 8),
          scale: 0.9 + (i % 5) * 0.1
        });
        // Right side
        if (i % 24 === 0) {
          items.push({
            type: 'tree',
            x: pt.x - pt.nx * (width / 2 + 65 + (i % 6) * 10),
            y: pt.y - pt.ny * (width / 2 + 65 + (i % 6) * 10),
            scale: 1.0 + (i % 4) * 0.1
          });
        }
      }
      // Grandstands near start line
      items.push({ type: 'grandstand', x: 450, y: 820, angle: 0 });
      items.push({ type: 'grandstand', x: 600, y: 820, angle: 0 });
      return items;
    }
  },
  {
    id: 'desert',
    name: "Cho'l Shamoli",
    theme: 'desert',
    difficulty: "O'rta",
    diffClass: 'diff-med',
    description: "Issiq qum barxanlari, uzun drift burilishlari va toshlar.",
    trackWidth: 165,
    groundColor: '#d69d4c',
    roadColor: '#3c352d',
    curbColor1: '#ff8800',
    curbColor2: '#ffffff',
    ambientColor: 'rgba(255, 180, 50, 0.08)',
    waypoints: [
      { x: 400, y: 800 },
      { x: 1000, y: 820 },
      { x: 1600, y: 700 },
      { x: 1850, y: 350 },
      { x: 1600, y: 0 },
      { x: 1100, y: 50 },
      { x: 800, y: -250 },
      { x: 1150, y: -600 },
      { x: 950, y: -850 },
      { x: 400, y: -800 },
      { x: -50, y: -550 },
      { x: -300, y: -150 },
      { x: -50, y: 250 },
      { x: -250, y: 600 }
    ],
    generateScenery: function(spline, width) {
      const items = [];
      for (let i = 0; i < spline.length; i += 22) {
        const pt = spline[i];
        const side = (i % 2 === 0) ? 1 : -1;
        const dist = width / 2 + 45 + (i % 9) * 12;
        items.push({
          type: (i % 4 === 0) ? 'cactus' : 'rock',
          x: pt.x + pt.nx * side * dist,
          y: pt.y + pt.ny * side * dist,
          scale: 0.8 + (i % 5) * 0.15
        });
      }
      return items;
    }
  },
  {
    id: 'cyber',
    name: 'Neon Megapolis',
    theme: 'cyber',
    difficulty: 'Qiyin',
    diffClass: 'diff-hard',
    description: 'Tungi shahar, neon chiroqlar, kutilmagan keskin burilishlar.',
    trackWidth: 145,
    groundColor: '#0a0d18',
    roadColor: '#161a29',
    curbColor1: '#00f0ff',
    curbColor2: '#ff0055',
    ambientColor: 'rgba(0, 240, 255, 0.08)',
    waypoints: [
      { x: 200, y: 600 },
      { x: 700, y: 600 },
      { x: 1100, y: 400 },
      { x: 1400, y: 700 },
      { x: 1800, y: 500 },
      { x: 1650, y: 100 },
      { x: 1250, y: -150 },
      { x: 800, y: -50 },
      { x: 500, y: -400 },
      { x: 50, y: -500 },
      { x: -300, y: -300 },
      { x: -450, y: 0 },
      { x: -200, y: 350 }
    ],
    generateScenery: function(spline, width) {
      const items = [];
      for (let i = 0; i < spline.length; i += 16) {
        const pt = spline[i];
        items.push({
          type: 'neonPillar',
          x: pt.x + pt.nx * (width / 2 + 35),
          y: pt.y + pt.ny * (width / 2 + 35),
          color: (i % 32 === 0) ? '#ff0055' : '#00f0ff'
        });
        items.push({
          type: 'neonPillar',
          x: pt.x - pt.nx * (width / 2 + 35),
          y: pt.y - pt.ny * (width / 2 + 35),
          color: (i % 32 === 0) ? '#00f0ff' : '#ff0055'
        });
      }
      return items;
    }
  },
  {
    id: 'mountain',
    name: "Tog' Dovoni",
    theme: 'mountain',
    difficulty: 'Ekstremal',
    diffClass: 'diff-hard',
    description: 'Serpentine burilishlar, qoyalar va qattiq tormoz zonasi.',
    trackWidth: 135,
    groundColor: '#1d3420',
    roadColor: '#282a30',
    curbColor1: '#ff0000',
    curbColor2: '#ffffff',
    ambientColor: 'rgba(255, 255, 255, 0.04)',
    waypoints: [
      { x: 100, y: 500 },
      { x: 550, y: 500 },
      { x: 900, y: 350 },
      { x: 600, y: 100 },
      { x: 950, y: -150 },
      { x: 1350, y: -50 },
      { x: 1600, y: -350 },
      { x: 1300, y: -650 },
      { x: 800, y: -600 },
      { x: 400, y: -800 },
      { x: -100, y: -650 },
      { x: 150, y: -350 },
      { x: -250, y: -100 },
      { x: -350, y: 250 }
    ],
    generateScenery: function(spline, width) {
      const items = [];
      for (let i = 0; i < spline.length; i += 18) {
        const pt = spline[i];
        const side = (i % 2 === 0) ? 1 : -1;
        items.push({
          type: (i % 3 === 0) ? 'pine' : 'boulder',
          x: pt.x + pt.nx * side * (width / 2 + 40 + (i % 5) * 12),
          y: pt.y + pt.ny * side * (width / 2 + 40 + (i % 5) * 12),
          scale: 0.9 + (i % 4) * 0.15
        });
      }
      return items;
    }
  }
];

// Initialize and process track geometry
function buildTrack(trackDef) {
  const { spline, totalLength } = generateClosedSpline(trackDef.waypoints, 28);
  const width = trackDef.trackWidth;
  const scenery = trackDef.generateScenery(spline, width);

  // Generate 12 checkpoints around the circuit
  const numCheckpoints = 12;
  const checkpoints = [];
  const step = Math.floor(spline.length / numCheckpoints);
  for (let i = 0; i < numCheckpoints; i++) {
    const idx = (i * step) % spline.length;
    checkpoints.push({
      index: i,
      splineIndex: idx,
      point: spline[idx],
      x: spline[idx].x,
      y: spline[idx].y,
      angle: spline[idx].angle
    });
  }

  // Calculate starting grid positions behind finish line (idx = 0)
  // Finish line is at spline[0]
  const startGrid = [];
  const startOffsetSpline = spline.length;
  for (let rank = 0; rank < 6; rank++) {
    const backDist = 55 + rank * 65;
    // Step backwards along spline
    const backIdx = (Math.floor(startOffsetSpline - (backDist / totalLength) * spline.length) + spline.length) % spline.length;
    const pt = spline[backIdx];
    // Alternate left and right pole positions
    const sideOffset = (rank % 2 === 0 ? 1 : -1) * (width * 0.22);
    startGrid.push({
      x: pt.x + pt.nx * sideOffset,
      y: pt.y + pt.ny * sideOffset,
      angle: pt.angle
    });
  }

  // Pre-calculate bounding box for minimap and camera clamps
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let pt of spline) {
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.y > maxY) maxY = pt.y;
  }
  const padding = width + 100;
  minX -= padding;
  maxX += padding;
  minY -= padding;
  maxY += padding;

  return {
    ...trackDef,
    spline,
    totalLength,
    scenery,
    checkpoints,
    startGrid,
    bounds: { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY }
  };
}

// Render Track onto the Canvas
function renderTrack(ctx, track, camera, viewportWidth, viewportHeight) {
  const { spline, trackWidth, scenery } = track;
  const halfW = trackWidth / 2;

  // 1. Draw Asphalt Road Ribbon
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Road Outer border (curbs / edges)
  ctx.strokeStyle = track.curbColor1;
  ctx.lineWidth = trackWidth + 24;
  ctx.beginPath();
  ctx.moveTo(spline[0].x, spline[0].y);
  for (let i = 1; i < spline.length; i++) {
    ctx.lineTo(spline[i].x, spline[i].y);
  }
  ctx.closePath();
  ctx.stroke();

  // Curbs pattern (alternating white curbs)
  ctx.strokeStyle = track.curbColor2;
  ctx.lineWidth = trackWidth + 24;
  ctx.setLineDash([20, 20]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Asphalt Main Road
  ctx.strokeStyle = track.roadColor;
  ctx.lineWidth = trackWidth;
  ctx.stroke();

  // Center dashed line
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.lineWidth = 3;
  ctx.setLineDash([25, 25]);
  ctx.beginPath();
  ctx.moveTo(spline[0].x, spline[0].y);
  for (let i = 1; i < spline.length; i++) {
    ctx.lineTo(spline[i].x, spline[i].y);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);

  // 2. Start / Finish Line (Chequered Pattern)
  const finishPt = spline[0];
  ctx.save();
  ctx.translate(finishPt.x, finishPt.y);
  ctx.rotate(finishPt.angle);
  const numChecks = 10;
  const checkSize = trackWidth / numChecks;
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < numChecks; col++) {
      ctx.fillStyle = (row + col) % 2 === 0 ? '#ffffff' : '#111111';
      ctx.fillRect(-15 + row * 15, -halfW + col * checkSize, 15, checkSize);
    }
  }
  ctx.restore();

  // 3. Scenery Props (Trees, lampposts, rocks, etc.)
  for (let i = 0; i < scenery.length; i++) {
    const item = scenery[i];
    // Simple frustum culling
    if (Math.abs(item.x - camera.x) > viewportWidth + 100 ||
        Math.abs(item.y - camera.y) > viewportHeight + 100) {
      continue;
    }
    renderSceneryItem(ctx, item);
  }

  ctx.restore();
}

// Render individual scenery prop
function renderSceneryItem(ctx, item) {
  ctx.save();
  ctx.translate(item.x, item.y);

  if (item.type === 'tree') {
    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath();
    ctx.ellipse(8, 8, 22 * item.scale, 16 * item.scale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Foliage
    ctx.fillStyle = '#216327';
    ctx.beginPath();
    ctx.arc(0, 0, 24 * item.scale, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#32963b';
    ctx.beginPath();
    ctx.arc(-4, -4, 18 * item.scale, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#55ba5e';
    ctx.beginPath();
    ctx.arc(-6, -6, 10 * item.scale, 0, Math.PI * 2);
    ctx.fill();
  } else if (item.type === 'cactus') {
    ctx.fillStyle = '#2d6a4f';
    ctx.beginPath();
    ctx.arc(0, 0, 14 * item.scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#40916c';
    ctx.beginPath();
    ctx.arc(-2, -2, 9 * item.scale, 0, Math.PI * 2);
    ctx.fill();
  } else if (item.type === 'rock' || item.type === 'boulder') {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath();
    ctx.ellipse(5, 5, 18 * item.scale, 14 * item.scale, 0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#6b705c';
    ctx.beginPath();
    ctx.arc(0, 0, 16 * item.scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#a5a58d';
    ctx.beginPath();
    ctx.arc(-3, -3, 10 * item.scale, 0, Math.PI * 2);
    ctx.fill();
  } else if (item.type === 'pine') {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath();
    ctx.ellipse(6, 6, 20 * item.scale, 15 * item.scale, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#14361b';
    ctx.beginPath();
    ctx.arc(0, 0, 22 * item.scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#20552b';
    ctx.beginPath();
    ctx.arc(-2, -2, 14 * item.scale, 0, Math.PI * 2);
    ctx.fill();
  } else if (item.type === 'neonPillar') {
    ctx.fillStyle = item.color;
    ctx.shadowColor = item.color;
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();
  } else if (item.type === 'lamp') {
    ctx.fillStyle = '#888';
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff7bc';
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fill();
  } else if (item.type === 'grandstand') {
    ctx.fillStyle = '#444c5c';
    ctx.fillRect(-70, -25, 140, 50);
    // Crowd colorful dots
    const colors = ['#f44336', '#e91e63', '#9c27b0', '#2196f3', '#ffeb3b', '#4caf50'];
    for (let r = -20; r <= 20; r += 10) {
      for (let c = -65; c <= 65; c += 10) {
        ctx.fillStyle = colors[Math.abs((r * 7 + c * 13)) % colors.length];
        ctx.beginPath();
        ctx.arc(c, r, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  ctx.restore();
}

// Draw Minimap helper
function renderMinimap(ctx, track, cars, playerCar, width, height) {
  ctx.clearRect(0, 0, width, height);

  const { spline, bounds } = track;
  const padding = 15;
  const scaleX = (width - padding * 2) / bounds.width;
  const scaleY = (height - padding * 2) / bounds.height;
  const scale = Math.min(scaleX, scaleY);

  const offsetX = (width - bounds.width * scale) / 2 - bounds.minX * scale;
  const offsetY = (height - bounds.height * scale) / 2 - bounds.minY * scale;

  // Draw Track Path
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = Math.max(3, track.trackWidth * scale);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(spline[0].x * scale + offsetX, spline[0].y * scale + offsetY);
  for (let i = 1; i < spline.length; i++) {
    ctx.lineTo(spline[i].x * scale + offsetX, spline[i].y * scale + offsetY);
  }
  ctx.closePath();
  ctx.stroke();

  // Start finish line blip
  const startPt = spline[0];
  ctx.fillStyle = '#ffff00';
  ctx.beginPath();
  ctx.arc(startPt.x * scale + offsetX, startPt.y * scale + offsetY, 3.5, 0, Math.PI * 2);
  ctx.fill();

  // Draw Bot Cars
  for (let car of cars) {
    if (car === playerCar) continue;
    const cx = car.x * scale + offsetX;
    const cy = car.y * scale + offsetY;
    ctx.fillStyle = car.color;
    ctx.beginPath();
    ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw Player Car (larger glowing blip)
  if (playerCar) {
    const px = playerCar.x * scale + offsetX;
    const py = playerCar.y * scale + offsetY;
    ctx.fillStyle = '#00f0ff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(px, py, 5.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// Generate thumbnail into small preview canvas
function drawTrackThumbnail(canvas, trackDef) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const { spline } = generateClosedSpline(trackDef.waypoints, 12);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let pt of spline) {
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.y > maxY) maxY = pt.y;
  }
  const bw = maxX - minX || 1;
  const bh = maxY - minY || 1;
  const pad = 12;
  const scale = Math.min((w - pad * 2) / bw, (h - pad * 2) / bh);
  const ox = (w - bw * scale) / 2 - minX * scale;
  const oy = (h - bh * scale) / 2 - minY * scale;

  // Background
  ctx.fillStyle = trackDef.groundColor;
  ctx.fillRect(0, 0, w, h);

  // Track path
  ctx.strokeStyle = trackDef.roadColor;
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(spline[0].x * scale + ox, spline[0].y * scale + oy);
  for (let i = 1; i < spline.length; i++) {
    ctx.lineTo(spline[i].x * scale + ox, spline[i].y * scale + oy);
  }
  ctx.closePath();
  ctx.stroke();

  // Curbs accent
  ctx.strokeStyle = trackDef.curbColor1;
  ctx.lineWidth = 2;
  ctx.stroke();
}
