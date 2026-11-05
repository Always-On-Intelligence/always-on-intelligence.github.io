import * as THREE from 'three';
import { canvasTexture, hashString, seeded, wrapLines } from '../engine/textures.mjs';

// ECCV 2026 main-conference posters are landscape, 140 cm x 100 cm.
export const POSTER_W = 1.4;
export const POSTER_H = 1.0;
export const POSTER_Y = 1.62;
export const PANEL_H = 2.36;
export const PANEL_T = 0.06;

const THEMES = ['#1f3a68', '#8c2432', '#1f5b45', '#0f5f6b', '#4b2e6e', '#a2501f', '#2f3439', '#1f4fa0'];
const FONT = '"IBM Plex Sans", "Helvetica Neue", Arial, sans-serif';
const DETAIL_W = 1024;
const DETAIL_H = Math.round(DETAIL_W * POSTER_H / POSTER_W);

function themeFor(number) { return THEMES[hashString('theme' + number) % THEMES.length]; }
function layoutFor(number) { return hashString('layout' + number) % 5; }

function figureKind(paper) {
  const text = ((paper?.t || '') + ' ' + (paper?.k || '')).toLowerCase();
  if (/\bmap|geo|city|urban|navigat|localiz/.test(text)) return 'map';
  if (/lidar|point cloud|3d|gaussian|splat|mesh|depth|scene reconstruct/.test(text)) return 'points';
  if (/video|action|embodied|robot|driving|egocentric|temporal/.test(text)) return 'frames';
  if (/diffusion|generat|edit|image synthesis|avatar/.test(text)) return 'tiles';
  return 'chart';
}

function fakeText(ctx, x, y, width, lines, random, color = 'rgba(40,44,50,0.26)') {
  ctx.fillStyle = color;
  for (let i = 0; i < lines; i++) {
    const w = width * (i === lines - 1 ? 0.35 + random() * 0.35 : 0.78 + random() * 0.22);
    ctx.fillRect(x, y + i * 11, w, 5);
  }
  return y + lines * 11;
}

function drawFigure(ctx, kind, x, y, w, h, theme, random) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  if (kind === 'map') {
    ctx.fillStyle = '#e9ece6';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(2, w / 60);
    for (let i = 0; i < 9; i++) {
      ctx.beginPath();
      ctx.moveTo(x + random() * w, y);
      ctx.bezierCurveTo(x + random() * w, y + h * 0.3, x + random() * w, y + h * 0.7, x + random() * w, y + h);
      ctx.stroke();
    }
    ctx.fillStyle = '#bcd3c1';
    for (let i = 0; i < 5; i++) ctx.fillRect(x + random() * w, y + random() * h, w * 0.12, h * 0.1);
    ctx.fillStyle = theme;
    for (let i = 0; i < 4; i++) {
      const px = x + w * (0.15 + random() * 0.7), py = y + h * (0.15 + random() * 0.7);
      ctx.beginPath(); ctx.arc(px, py, Math.max(3, w / 40), 0, Math.PI * 2); ctx.fill();
    }
  } else if (kind === 'points') {
    ctx.fillStyle = '#12161c';
    ctx.fillRect(x, y, w, h);
    for (let i = 0; i < 900; i++) {
      const u = random(), v = Math.pow(random(), 1.6);
      const px = x + w * (0.5 + (u - 0.5) * (0.4 + v * 1.4));
      const py = y + h * (0.25 + v * 0.7);
      const hue = 180 + v * 140;
      ctx.fillStyle = `hsla(${hue},70%,${55 + v * 15}%,0.9)`;
      ctx.fillRect(px, py, 1.6, 1.6);
    }
  } else if (kind === 'frames') {
    const n = 4, gap = w * 0.02, fw = (w - gap * (n - 1)) / n;
    for (let i = 0; i < n; i++) {
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      const base = 30 + random() * 60;
      g.addColorStop(0, `hsl(${base + 170},25%,${55 + random() * 15}%)`);
      g.addColorStop(1, `hsl(${base + 20},18%,${30 + random() * 15}%)`);
      ctx.fillStyle = g;
      ctx.fillRect(x + i * (fw + gap), y, fw, h);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(x + i * (fw + gap) + fw * 0.35, y + h * 0.45, fw * 0.18, h * 0.4);
      ctx.strokeStyle = theme;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + i * (fw + gap) + fw * 0.25, y + h * 0.3, fw * 0.4, h * 0.6);
    }
  } else if (kind === 'tiles') {
    const cols = 4, rows = 2, gw = w / cols, gh = h / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const g = ctx.createLinearGradient(x + c * gw, y + r * gh, x + (c + 1) * gw, y + (r + 1) * gh);
        g.addColorStop(0, `hsl(${random() * 360},45%,${55 + random() * 20}%)`);
        g.addColorStop(1, `hsl(${random() * 360},40%,${35 + random() * 20}%)`);
        ctx.fillStyle = g;
        ctx.fillRect(x + c * gw + 1, y + r * gh + 1, gw - 2, gh - 2);
      }
    }
  } else {
    ctx.fillStyle = '#f2f3ef';
    ctx.fillRect(x, y, w, h);
    const bars = 6;
    for (let i = 0; i < bars; i++) {
      const bh = h * (0.25 + random() * 0.6);
      ctx.fillStyle = i === bars - 1 ? theme : 'rgba(80,90,100,0.45)';
      ctx.fillRect(x + w * 0.08 + i * (w * 0.84 / bars), y + h - bh - h * 0.06, w * 0.84 / bars * 0.62, bh);
    }
  }
  ctx.restore();
}

function drawPipeline(ctx, x, y, w, h, theme, random) {
  const n = 3 + Math.floor(random() * 2);
  const bw = w / (n * 1.45), bh = h * 0.42;
  for (let i = 0; i < n; i++) {
    const bx = x + i * bw * 1.45, by = y + h * 0.29 + (i % 2) * h * 0.08;
    ctx.fillStyle = i === n - 1 ? theme : '#e6e9ee';
    ctx.strokeStyle = 'rgba(40,44,50,0.4)';
    ctx.lineWidth = 1.5;
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeRect(bx, by, bw, bh);
    if (i < n - 1) {
      ctx.strokeStyle = 'rgba(40,44,50,0.55)';
      ctx.beginPath();
      ctx.moveTo(bx + bw + 3, by + bh / 2);
      ctx.lineTo(bx + bw * 1.45 - 4, by + bh / 2);
      ctx.stroke();
    }
  }
}

function drawTable(ctx, x, y, w, h, theme, random) {
  const rows = 5, cols = 4;
  ctx.fillStyle = theme;
  ctx.fillRect(x, y, w, h / rows);
  for (let r = 1; r < rows; r++) {
    ctx.fillStyle = r % 2 ? '#f3f4f1' : '#ffffff';
    ctx.fillRect(x, y + r * h / rows, w, h / rows);
    for (let c = 0; c < cols; c++) {
      ctx.fillStyle = r === rows - 1 && c === cols - 1 ? theme : 'rgba(40,44,50,0.35)';
      ctx.fillRect(x + c * w / cols + 6, y + r * h / rows + h / rows * 0.4, w / cols * (0.4 + random() * 0.4), 4);
    }
  }
}

function qr(ctx, x, y, size, random) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, size, size);
  const n = 17, c = size / n;
  ctx.fillStyle = '#111';
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (random() > 0.55) ctx.fillRect(x + i * c, y + j * c, c, c);
  for (const [fx, fy] of [[0, 0], [n - 5, 0], [0, n - 5]]) {
    ctx.fillRect(x + fx * c, y + fy * c, c * 5, c * 5);
    ctx.fillStyle = '#fff'; ctx.fillRect(x + (fx + 1) * c, y + (fy + 1) * c, c * 3, c * 3);
    ctx.fillStyle = '#111'; ctx.fillRect(x + (fx + 2) * c, y + (fy + 2) * c, c, c);
  }
}

/** Full-resolution poster with the real title, authors and first abstract sentence. */
export function drawPoster(ctx, number, paper, w = DETAIL_W, h = DETAIL_H) {
  const random = seeded(hashString('poster' + number));
  const theme = themeFor(number);
  const layout = layoutFor(number);
  const s = w / 1024;
  ctx.fillStyle = '#fbfbf8';
  ctx.fillRect(0, 0, w, h);
  const headerH = 150 * s;
  ctx.fillStyle = theme;
  ctx.fillRect(0, 0, w, headerH);
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.fillRect(0, headerH - 6 * s, w, 6 * s);

  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  let size = 40 * s;
  const titleW = w - 40 * s - 190 * s;
  let lines;
  for (;;) {
    ctx.font = `700 ${size}px ${FONT}`;
    lines = wrapLines(ctx, paper?.t || 'Poster', titleW, 3);
    if (lines.length <= 2 || size <= 30 * s) break;
    size -= 2 * s;
  }
  let y = 22 * s;
  for (const line of lines) { ctx.fillText(line, 36 * s, y); y += size * 1.12; }
  ctx.font = `500 ${18 * s}px ${FONT}`;
  ctx.globalAlpha = 0.86;
  ctx.fillText(wrapLines(ctx, paper?.a || '', titleW, 1)[0] || '', 36 * s, y + 4 * s);
  if (paper?.f) {
    ctx.font = `400 ${15 * s}px ${FONT}`;
    ctx.globalAlpha = 0.7;
    ctx.fillText(wrapLines(ctx, paper.f, titleW, 1)[0] || '', 36 * s, y + 28 * s);
  }
  ctx.globalAlpha = 1;
  qr(ctx, w - 118 * s, 26 * s, 92 * s, random);
  ctx.font = `600 ${13 * s}px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText('ECCV 2026', w - 118 * s, 124 * s);

  const margin = 34 * s, gutter = 26 * s;
  const colW = (w - margin * 2 - gutter * 2) / 3;
  const top = headerH + 26 * s;
  const kind = figureKind(paper);
  const heads = [['Motivation', 'Method'], ['Approach', 'Experiments'], ['Results', 'Conclusion']];
  for (let c = 0; c < 3; c++) {
    const x = margin + c * (colW + gutter);
    let cy = top;
    ctx.fillStyle = theme;
    ctx.fillRect(x, cy, 4 * s, 22 * s);
    ctx.font = `700 ${20 * s}px ${FONT}`;
    ctx.fillText(heads[c][0], x + 12 * s, cy);
    cy += 34 * s;
    if (c === 0 && paper?.s) {
      ctx.font = `400 ${15 * s}px ${FONT}`;
      ctx.fillStyle = '#2b3036';
      for (const line of wrapLines(ctx, paper.s, colW, 6)) { ctx.fillText(line, x, cy); cy += 19 * s; }
      cy += 8 * s;
    } else {
      cy = fakeText(ctx, x, cy, colW, 4 + Math.floor(random() * 3), random) + 10 * s;
    }
    const figH = (c === 1 ? 150 : 170) * s * (0.85 + (layout % 3) * 0.1);
    if (c === 0) drawFigure(ctx, kind, x, cy, colW, figH, theme, random);
    else if (c === 1) drawPipeline(ctx, x, cy, colW, figH, theme, random);
    else drawTable(ctx, x, cy, colW, figH * 0.72, theme, random);
    cy += figH + 14 * s;
    ctx.fillStyle = theme;
    ctx.font = `700 ${18 * s}px ${FONT}`;
    ctx.fillText(heads[c][1], x + 12 * s, cy);
    ctx.fillRect(x, cy, 4 * s, 20 * s);
    cy += 30 * s;
    cy = fakeText(ctx, x, cy, colW, 5 + Math.floor(random() * 4), random);
    if (c === 2 || layout > 2) {
      cy += 10 * s;
      if (cy + 110 * s < h - 40 * s) drawFigure(ctx, c === 2 ? 'chart' : kind, x, cy, colW, Math.min(120 * s, h - 46 * s - cy), theme, random);
    }
  }
  ctx.fillStyle = 'rgba(40,44,50,0.5)';
  ctx.font = `500 ${12 * s}px ${FONT}`;
  ctx.fillText(`Poster Session 6 · ExHall #${number}`, margin, h - 24 * s);
  ctx.fillStyle = theme;
  ctx.fillRect(0, h - 8 * s, w, 8 * s);
}

/** Atlas of anonymous posters for distance rendering: 8 themes x 5 layouts. */
function makeFarAtlas() {
  const cellW = 256, cellH = 204, drawH = 183;
  const texture = canvasTexture(2048, 1024, (ctx) => {
    for (let t = 0; t < THEMES.length; t++) {
      for (let l = 0; l < 5; l++) {
        const x0 = t * cellW, y0 = l * cellH + 10;
        ctx.save();
        ctx.translate(x0, y0);
        const random = seeded(t * 31 + l * 7 + 1);
        ctx.fillStyle = '#fbfbf8';
        ctx.fillRect(0, 0, cellW, drawH);
        ctx.fillStyle = THEMES[t];
        ctx.fillRect(0, 0, cellW, 38);
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillRect(9, 9, 150 + random() * 60, 7);
        ctx.fillRect(9, 20, 90 + random() * 80, 7);
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fillRect(9, 30, 110, 3);
        ctx.fillStyle = '#fff';
        ctx.fillRect(cellW - 30, 7, 22, 22);
        const colW = (cellW - 24) / 3;
        const kinds = ['map', 'points', 'frames', 'tiles', 'chart'];
        for (let c = 0; c < 3; c++) {
          const x = 8 + c * (colW + 4);
          ctx.fillStyle = THEMES[t];
          ctx.fillRect(x, 45, colW * 0.5, 5);
          ctx.fillStyle = 'rgba(40,44,50,0.25)';
          for (let i = 0; i < 4; i++) ctx.fillRect(x, 55 + i * 5, colW * (0.7 + random() * 0.3), 2);
          drawFigure(ctx, c === 0 ? kinds[l] : (c === 1 ? 'tiles' : 'chart'), x, 80, colW, 44 + random() * 16, THEMES[t], random);
          ctx.fillStyle = 'rgba(40,44,50,0.25)';
          for (let i = 0; i < 6; i++) ctx.fillRect(x, 135 + i * 6, colW * (0.6 + random() * 0.4), 2);
        }
        ctx.fillStyle = THEMES[t];
        ctx.fillRect(0, drawH - 3, cellW, 3);
        ctx.restore();
      }
    }
  }, { anisotropy: 8 });
  texture.generateMipmaps = true;
  const rect = (number) => {
    const t = THEMES.indexOf(themeFor(number)), l = layoutFor(number);
    return [t * cellW / 2048, 1 - (l * cellH + 10 + drawH) / 1024, cellW / 2048, drawH / 1024];
  };
  return { texture, rect };
}

/** Atlas of board number plates. */
function makePlateAtlas(numbers) {
  const cellW = 128, cellH = 48, cols = 16;
  const rows = Math.ceil(numbers.length / cols);
  const height = 2 ** Math.ceil(Math.log2(rows * cellH));
  const index = new Map();
  const texture = canvasTexture(2048, height, (ctx) => {
    ctx.fillStyle = '#1d2227';
    ctx.fillRect(0, 0, 2048, height);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 30px ${FONT}`;
    numbers.forEach((n, i) => {
      const cx = (i % cols) * cellW, cy = Math.floor(i / cols) * cellH;
      index.set(n, i);
      ctx.fillStyle = '#1d2227';
      ctx.fillRect(cx, cy, cellW, cellH);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(String(n), cx + cellW / 2, cy + cellH / 2 + 1);
    });
  });
  const rect = (n) => {
    const i = index.get(n);
    return [(i % cols) * cellW / 2048, 1 - (Math.floor(i / cols) + 1) * cellH / height, cellW / 2048, cellH / height];
  };
  return { texture, rect };
}

function atlasMaterial(texture, options = {}) {
  const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.62, metalness: 0, ...options });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aUvRect;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\n\tvMapUv = vMapUv * aUvRect.zw + aUvRect.xy;\n#endif');
  };
  material.customProgramCacheKey = () => 'atlas-uv-rect';
  return material;
}

/**
 * Posters and plates for every board. Far posters are one instanced mesh; the
 * nearest few are replaced by readable canvases drawn on demand.
 */
export function createPosters(boards, papers, { detailCount = 14, anisotropy = 8 } = {}) {
  const group = new THREE.Group();
  group.name = 'posters';
  const withPaper = boards.filter(b => papers[String(b.n)]);
  const far = makeFarAtlas();
  far.texture.anisotropy = anisotropy;
  const posterGeometry = new THREE.PlaneGeometry(POSTER_W, POSTER_H);
  const farMesh = new THREE.InstancedMesh(posterGeometry, atlasMaterial(far.texture), withPaper.length);
  const farRects = new Float32Array(withPaper.length * 4);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const one = new THREE.Vector3(1, 1, 1);
  withPaper.forEach((b, i) => {
    q.setFromAxisAngle(up, b.side > 0 ? 0 : Math.PI);
    m.compose(new THREE.Vector3(b.x, POSTER_Y, b.z + b.side * (PANEL_T / 2 + 0.004)), q, one);
    farMesh.setMatrixAt(i, m);
    farRects.set(far.rect(b.n), i * 4);
    b.instance = i;
  });
  posterGeometry.setAttribute('aUvRect', new THREE.InstancedBufferAttribute(farRects, 4));
  farMesh.receiveShadow = true;
  farMesh.frustumCulled = false;
  group.add(farMesh);

  const plates = makePlateAtlas(boards.map(b => b.n));
  const plateGeometry = new THREE.PlaneGeometry(0.3, 0.11);
  const plateMesh = new THREE.InstancedMesh(plateGeometry, atlasMaterial(plates.texture, { roughness: 0.5 }), boards.length);
  const plateRects = new Float32Array(boards.length * 4);
  boards.forEach((b, i) => {
    q.setFromAxisAngle(up, b.side > 0 ? 0 : Math.PI);
    const left = -b.side * (POSTER_W / 2 - 0.15);
    m.compose(new THREE.Vector3(b.x + left, POSTER_Y + POSTER_H / 2 + 0.12, b.z + b.side * (PANEL_T / 2 + 0.004)), q, one);
    plateMesh.setMatrixAt(i, m);
    plateRects.set(plates.rect(b.n), i * 4);
  });
  plateGeometry.setAttribute('aUvRect', new THREE.InstancedBufferAttribute(plateRects, 4));
  plateMesh.frustumCulled = false;
  group.add(plateMesh);

  // Readable posters near the viewer.
  const pool = [];
  for (let i = 0; i < detailCount; i++) {
    const canvas = document.createElement('canvas');
    canvas.width = DETAIL_W;
    canvas.height = DETAIL_H;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = anisotropy;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(POSTER_W, POSTER_H), new THREE.MeshStandardMaterial({ map: texture, roughness: 0.62 }));
    mesh.visible = false;
    mesh.receiveShadow = true;
    group.add(mesh);
    pool.push({ mesh, canvas, texture, board: null });
  }
  const hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
  const forward = new THREE.Vector3();
  let queue = [];
  let lastScan = 0;

  function restoreInstance(board) {
    if (board?.instance === undefined) return;
    q.setFromAxisAngle(up, board.side > 0 ? 0 : Math.PI);
    m.compose(new THREE.Vector3(board.x, POSTER_Y, board.z + board.side * (PANEL_T / 2 + 0.004)), q, one);
    farMesh.setMatrixAt(board.instance, m);
    farMesh.instanceMatrix.needsUpdate = true;
  }

  function assign(slot, board) {
    if (slot.board) restoreInstance(slot.board);
    slot.board = board;
    const ctx = slot.canvas.getContext('2d');
    drawPoster(ctx, board.n, papers[String(board.n)]);
    slot.texture.needsUpdate = true;
    slot.mesh.position.set(board.x, POSTER_Y, board.z + board.side * (PANEL_T / 2 + 0.006));
    slot.mesh.rotation.set(0, board.side > 0 ? 0 : Math.PI, 0);
    slot.mesh.visible = true;
    farMesh.setMatrixAt(board.instance, hiddenMatrix);
    farMesh.instanceMatrix.needsUpdate = true;
  }

  function update(camera, now) {
    if (now - lastScan > 180) {
      lastScan = now;
      camera.getWorldDirection(forward);
      const cx = camera.position.x, cz = camera.position.z;
      const candidates = [];
      for (const b of withPaper) {
        const dx = b.x - cx, dz = b.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 > 110) continue;
        if (-dz * b.side < -0.2) continue; // viewer must be on the poster's side
        const d = Math.sqrt(d2) || 1;
        if ((dx * forward.x + dz * forward.z) / d < -0.1 && d2 > 4) continue;
        candidates.push([d2, b]);
      }
      candidates.sort((a, b) => a[0] - b[0]);
      const wanted = candidates.slice(0, pool.length).map(c => c[1]);
      const wantedSet = new Set(wanted);
      const kept = new Set(pool.filter(s => s.board && wantedSet.has(s.board)).map(s => s.board));
      queue = wanted.filter(b => !kept.has(b));
      for (const slot of pool) {
        if (slot.board && !wantedSet.has(slot.board)) {
          restoreInstance(slot.board);
          slot.board = null;
          slot.mesh.visible = false;
        }
      }
    }
    // Draw at most two new canvases per frame.
    for (let k = 0; k < 2 && queue.length; k++) {
      const slot = pool.find(s => !s.board);
      if (!slot) break;
      assign(slot, queue.shift());
    }
  }

  return { group, update, farMesh, pool };
}
