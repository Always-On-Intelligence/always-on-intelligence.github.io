import * as THREE from 'three';

// Procedural textures drawn on canvases, so the scene ships no image assets.

export function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function hashString(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function canvasTexture(width, height, paint, { srgb = true, repeat = null, anisotropy = 4 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  paint(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;
  if (repeat) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeat[0], repeat[1]);
  }
  return texture;
}

/** Polished concrete: soft mottling, fine grain and saw-cut joints. */
export function concreteTexture(tileMetres = 8) {
  const random = seeded(20260912);
  return canvasTexture(1024, 1024, (ctx, w, h) => {
    ctx.fillStyle = '#a3a4a1';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      const x = random() * w, y = random() * h, r = 60 + random() * 220;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const tone = random() > 0.5 ? '255,255,250' : '60,62,60';
      g.addColorStop(0, `rgba(${tone},${0.03 + random() * 0.05})`);
      g.addColorStop(1, `rgba(${tone},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    const image = ctx.getImageData(0, 0, w, h);
    const d = image.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (random() - 0.5) * 14;
      d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
    ctx.putImageData(image, 0, 0);
    // Joints every 4 m.
    const step = w / (tileMetres / 4);
    ctx.strokeStyle = 'rgba(55,55,52,0.35)';
    ctx.lineWidth = 2;
    for (let x = 0; x <= w; x += step) { ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); ctx.stroke(); }
    for (let y = 0; y <= h; y += step) { ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    for (let x = 2; x <= w; x += step) { ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); ctx.stroke(); }
  }, { repeat: [1 / tileMetres, 1 / tileMetres], anisotropy: 8 });
}

/** Needle-punch exhibition carpet. */
export function carpetTexture(color = '#3d4654') {
  const random = seeded(hashString(color));
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
    const image = ctx.getImageData(0, 0, w, h);
    const d = image.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (random() - 0.5) * 26;
      d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
    ctx.putImageData(image, 0, 0);
  }, { repeat: [1, 1] });
}

export function wrapLines(ctx, text, maxWidth, maxLines = 3) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (let i = 0; i < words.length; i++) {
    const trial = line ? line + ' ' + words[i] : words[i];
    if (ctx.measureText(trial).width <= maxWidth || !line) {
      line = trial;
    } else {
      lines.push(line);
      line = words[i];
      if (lines.length === maxLines) break;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  const used = lines.join(' ').split(/\s+/).length;
  if (used < words.length && lines.length) {
    let last = lines[lines.length - 1];
    while (last && ctx.measureText(last + '…').width > maxWidth) last = last.slice(0, -1);
    lines[lines.length - 1] = last.replace(/[\s,.;:]+$/, '') + '…';
  }
  return lines;
}

/** Sign face: text centred on a solid background. */
export function signTexture(lines, {
  width = 1024, height = 256, background = '#f4f4f1', color = '#1f2429', accent = null,
  font = '600 {size}px "IBM Plex Sans", "Helvetica Neue", Arial, sans-serif', sizes = null, align = 'center', padding = 48,
} = {}) {
  const list = Array.isArray(lines) ? lines : [lines];
  return canvasTexture(width, height, (ctx, w, h) => {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, w, h);
    if (accent) {
      ctx.fillStyle = accent;
      ctx.fillRect(0, h - Math.max(6, h * 0.05), w, Math.max(6, h * 0.05));
    }
    const sz = sizes || list.map((_, i) => (i === 0 ? h * 0.42 : h * 0.2));
    const total = sz.reduce((a, b) => a + b * 1.18, 0);
    let y = (h - total) / 2;
    ctx.fillStyle = color;
    ctx.textBaseline = 'top';
    ctx.textAlign = align;
    list.forEach((text, i) => {
      const size = sz[i];
      let s = size;
      ctx.font = font.replace('{size}', String(Math.round(s)));
      while (ctx.measureText(text).width > w - padding * 2 && s > 10) {
        s -= 2;
        ctx.font = font.replace('{size}', String(Math.round(s)));
      }
      const x = align === 'center' ? w / 2 : padding;
      ctx.globalAlpha = i === 0 ? 1 : 0.78;
      ctx.fillText(text, x, y + (size - s) / 2);
      y += size * 1.18;
    });
    ctx.globalAlpha = 1;
  });
}

/** Soft round shadow used under people and furniture. */
export function blobTexture() {
  return canvasTexture(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(0,0,0,0.55)');
    g.addColorStop(0.55, 'rgba(0,0,0,0.22)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }, { srgb: false });
}
