// Ground plan of the hall for the HUD map: drawn once at 4 px per metre, then cropped per view.

const PX = 4;

export function eccvMapView(venue, bounds) {
  const b = { x0: bounds.x0 - 2, z0: bounds.z0 - 2, x1: bounds.x1 + 2, z1: bounds.z1 + 2 };
  const base = document.createElement('canvas');
  base.width = Math.ceil((b.x1 - b.x0) * PX);
  base.height = Math.ceil((b.z1 - b.z0) * PX);
  const ctx = base.getContext('2d');
  const P = (p) => [(p[0] - b.x0) * PX, (p[1] - b.z0) * PX];
  const poly = (points, fill, stroke, lw = 1) => {
    ctx.beginPath();
    points.forEach((p, i) => { const [x, y] = P(p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  };
  poly(venue.envelope, '#232a32', '#8994a0', 3);
  for (const block of venue.blocks) poly(block.poly, '#343d47', '#56616d', 1.5);
  for (const room of venue.rooms) poly(room.poly, '#2d353f', '#56616d', 1.5);
  ctx.fillStyle = 'rgba(210,218,226,0.65)';
  ctx.font = '600 22px "IBM Plex Sans", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const room of venue.rooms) {
    const xs = room.poly.map(p => p[0]), zs = room.poly.map(p => p[1]);
    const [x, y] = P([(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2]);
    ctx.fillText(room.id, x, y);
  }
  ctx.lineCap = 'round';
  for (const [x1, z1, x2, z2, , t, kind] of venue.walls) {
    ctx.strokeStyle = kind === 'drape' ? '#5d6773' : '#8994a0';
    ctx.lineWidth = Math.max(2, t * PX);
    const [p, q] = [P([x1, z1]), P([x2, z2])];
    ctx.beginPath(); ctx.moveTo(...p); ctx.lineTo(...q); ctx.stroke();
  }
  for (const booth of venue.booths) poly(booth.poly, booth.id === '44' ? '#4f7bd9' : '#3d4855', '#6d7a88', 1);
  for (const [x, z, r] of venue.coffee) {
    const [cx, cy] = P([x, z]);
    ctx.fillStyle = '#5a4a36'; ctx.beginPath(); ctx.arc(cx, cy, r * PX * 0.62, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = '#c9d1d9';
  ctx.lineWidth = 2.4;
  for (const row of venue.rows) {
    for (const [x0, x1] of row.segments) {
      const [p, q] = [P([x0, row.z]), P([x1, row.z])];
      ctx.beginPath(); ctx.moveTo(...p); ctx.lineTo(...q); ctx.stroke();
    }
  }
  for (const [x, z] of venue.columns) {
    const [cx, cy] = P([x, z]);
    ctx.fillStyle = '#76818d'; ctx.fillRect(cx - 2, cy - 2, 4, 4);
  }
  return (c, view) => {
    c.drawImage(base, (view.ox - b.x0) * PX, (view.oz - b.z0) * PX, view.w / view.scale * PX, view.h / view.scale * PX, 0, 0, view.w, view.h);
  };
}
