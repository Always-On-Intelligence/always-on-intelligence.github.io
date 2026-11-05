// The HUD map: a small player-centred map and a full map you can click to walk.
// Each scene supplies drawView(ctx, view), which paints the ground plan for a view
// {scale (px per metre), ox, oz (world at the canvas origin), w, h}; the minimap adds
// the route, markers and the player on top.

export class Minimap {
  constructor({ bounds, drawView, small, full, onPick, smallView = 46 }) {
    this.b = { x0: bounds.x0 - 2, z0: bounds.z0 - 2, x1: bounds.x1 + 2, z1: bounds.z1 + 2 };
    this.drawView = drawView;
    this.small = small;
    this.full = full;
    this.onPick = onPick;
    this.smallView = smallView;
    this.route = null;
    this.markers = [];
    full.addEventListener('click', (e) => {
      if (!this.fullView) return;
      const r = full.getBoundingClientRect();
      const { scale, ox, oz } = this.fullView;
      const x = (e.clientX - r.left) * (full.width / r.width) / scale + ox;
      const z = (e.clientY - r.top) * (full.height / r.height) / scale + oz;
      this.onPick?.(x, z);
    });
  }

  setRoute(points) { this.route = points; }
  setMarkers(markers) { this.markers = markers; }

  drawOverlay(ctx, scale, ox, oz, player, { labels = false } = {}) {
    const S = (x, z) => [(x - ox) * scale, (z - oz) * scale];
    const px = Math.max(1, ctx.canvas.width / 360);
    if (this.route?.length > 1) {
      ctx.strokeStyle = '#e2c07f';
      ctx.lineWidth = Math.max(2 * px, scale * 0.35);
      ctx.setLineDash([Math.max(4 * px, scale * 0.9), Math.max(3 * px, scale * 0.6)]);
      ctx.beginPath();
      this.route.forEach(([x, z], i) => { const [sx, sy] = S(x, z); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); });
      ctx.stroke();
      ctx.setLineDash([]);
    }
    for (const m of this.markers) {
      const [sx, sy] = S(m.x, m.z);
      if (sx < -20 || sy < -20 || sx > ctx.canvas.width + 20 || sy > ctx.canvas.height + 20) continue;
      const r = Math.max(5 * px, Math.min(9 * px, scale * 0.9));
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fillStyle = m.state === 'visited' ? '#9cc3ae' : m.state === 'next' ? '#e2c07f' : m.state === 'place' ? 'rgba(244,246,248,0.85)' : 'rgba(159,184,224,0.9)';
      ctx.fill();
      ctx.lineWidth = 1.5 * px; ctx.strokeStyle = '#11151a'; ctx.stroke();
      if (m.label) {
        ctx.fillStyle = '#11151a';
        ctx.font = `700 ${Math.round(r * 1.05)}px "IBM Plex Sans", Arial, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(m.label, sx, sy + 0.5);
      }
      if (labels && m.title) {
        ctx.fillStyle = '#eef2f5';
        ctx.font = `500 ${Math.round(12 * px)}px "IBM Plex Sans", Arial, sans-serif`;
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(m.title, sx + r + 4 * px, sy);
      }
    }
    if (player) {
      const [sx, sy] = S(player.x, player.z);
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(-player.yaw);
      const s = Math.max(7 * px, Math.min(12 * px, scale * 1.4));
      ctx.beginPath();
      ctx.moveTo(0, -s * 1.25); ctx.lineTo(s * 0.8, s * 0.7); ctx.lineTo(0, s * 0.35); ctx.lineTo(-s * 0.8, s * 0.7);
      ctx.closePath();
      ctx.fillStyle = '#ffffff'; ctx.fill();
      ctx.lineWidth = 2 * px; ctx.strokeStyle = '#4f7bd9'; ctx.stroke();
      ctx.restore();
    }
  }

  drawSmall(player) {
    const c = this.small, ctx = c.getContext('2d');
    const scale = c.width / this.smallView;
    const ox = player.x - this.smallView / 2, oz = player.z - this.smallView / 2;
    ctx.fillStyle = '#12161b';
    ctx.fillRect(0, 0, c.width, c.height);
    this.drawView(ctx, { scale, ox, oz, w: c.width, h: c.height, small: true });
    this.drawOverlay(ctx, scale, ox, oz, player);
  }

  drawFull(player) {
    const c = this.full;
    const rect = c.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (c.width !== Math.round(rect.width * dpr)) { c.width = Math.round(rect.width * dpr); c.height = Math.round(rect.height * dpr); }
    const ctx = c.getContext('2d');
    const bw = this.b.x1 - this.b.x0, bh = this.b.z1 - this.b.z0;
    const scale = Math.min(c.width / bw, c.height / bh);
    const ox = this.b.x0 - (c.width / scale - bw) / 2, oz = this.b.z0 - (c.height / scale - bh) / 2;
    this.fullView = { scale, ox, oz };
    // The ground plan does not change: paint it once per canvas size, then only the overlay.
    if (!this.fullBase || this.fullBase.width !== c.width || this.fullBase.height !== c.height) {
      this.fullBase = document.createElement('canvas');
      this.fullBase.width = c.width;
      this.fullBase.height = c.height;
      const b = this.fullBase.getContext('2d');
      b.fillStyle = '#0f1318';
      b.fillRect(0, 0, c.width, c.height);
      this.drawView(b, { scale, ox, oz, w: c.width, h: c.height, small: false });
    }
    ctx.drawImage(this.fullBase, 0, 0);
    this.drawOverlay(ctx, scale, ox, oz, player, { labels: true });
  }
}
