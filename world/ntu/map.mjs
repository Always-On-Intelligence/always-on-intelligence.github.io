// Vector campus map for the HUD, drawn per view so it stays sharp at any zoom.

const AREA = { grass: '#2b3a2d', park: '#2e4230', forest: '#243528', water: '#274656', pitch: '#2f4a33', track: '#4a3530', parking: '#343a40', plaza: '#3a3d40', bare: '#3b352b' };
const WALK = new Set(['footway', 'path', 'pedestrian', 'steps', 'cycleway', 'corridor']);
const LANDMARKS = new Set(['UOB Innovation Hub', 'North Spine', 'South Spine', 'Academic Block North', 'The Arc - Learning Hub North', 'School of Art, Design and Media', 'Lee Wee Nam Library', 'Nanyang Auditorium', 'Chinese Heritage Centre']);

const boxOf = (p) => {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < p.length; i += 2) { x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]); z0 = Math.min(z0, p[i + 1]); z1 = Math.max(z1, p[i + 1]); }
  return [x0, z0, x1, z1];
};

export function ntuMapView(campus, { labels = [] } = {}) {
  const areas = campus.areas.map(a => ({ k: a.k, p: a.p, box: boxOf(a.p) }));
  const roads = campus.roads.map(r => ({ walk: WALK.has(r.k), w: r.w, p: r.p, box: boxOf(r.p) }));
  const buildings = campus.buildings.map(b => ({ p: b.p, box: boxOf(b.p), landmark: LANDMARKS.has(b.n), hall: /Hall|Block/.test(b.n) || b.k === 'dormitory' }));
  const loop = campus.loop.p;

  return (ctx, view) => {
    const { scale, ox, oz, w, h, small } = view;
    const vx1 = ox + w / scale, vz1 = oz + h / scale;
    const visible = (b) => b[2] >= ox && b[0] <= vx1 && b[3] >= oz && b[1] <= vz1;
    const path = (p, close) => {
      ctx.beginPath();
      for (let i = 0; i < p.length; i += 2) {
        const x = (p[i] - ox) * scale, y = (p[i + 1] - oz) * scale;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      if (close) ctx.closePath();
    };
    ctx.fillStyle = '#212b24';
    ctx.fillRect(0, 0, w, h);
    for (const a of areas) {
      if (!visible(a.box)) continue;
      path(a.p, true);
      ctx.fillStyle = AREA[a.k] || '#2b3a2d';
      ctx.fill();
    }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const walk of [false, true]) {
      ctx.strokeStyle = walk ? '#7d817c' : '#9aa1a6';
      for (const r of roads) {
        if (r.walk !== walk || !visible(r.box)) continue;
        path(r.p, false);
        ctx.lineWidth = Math.max(walk ? 0.8 : 1.2, r.w * scale * (walk ? 0.8 : 1));
        ctx.stroke();
      }
    }
    if (!small) {
      ctx.strokeStyle = 'rgba(192,57,43,0.75)';
      ctx.lineWidth = Math.max(1.5, 2.2 * scale);
      path(loop, false);
      ctx.stroke();
    }
    for (const b of buildings) {
      if (!visible(b.box)) continue;
      path(b.p, true);
      ctx.fillStyle = b.landmark ? '#8595ab' : b.hall ? '#56606c' : '#4b5561';
      ctx.fill();
      if (scale > 1.5) { ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1; ctx.stroke(); }
    }
    if (!small || scale > 1.2) {
      ctx.fillStyle = 'rgba(235,240,244,0.9)';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const px = Math.max(1, ctx.canvas.width / 900);
      ctx.font = `600 ${Math.round((small ? 10 : 12) * px)}px "IBM Plex Sans", Arial, sans-serif`;
      for (const l of labels) {
        if (!small && l.minor && scale < 0.6) continue;
        const x = (l.x - ox) * scale, y = (l.z - oz) * scale;
        if (x < -40 || y < -20 || x > w + 40 || y > h + 20) continue;
        ctx.fillText(l.text, x, y);
      }
    }
  };
}
