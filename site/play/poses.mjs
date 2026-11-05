// Joint angles for the people in the dioramas, and a small turning helper shared with the robots.
// Angles are radians. A limb hangs along -y; a negative x rotation swings it forward (towards +z),
// a positive z rotation swings it towards +x (the person's left).

export const Z = { pelvisY: 0.92, lean: 0, neckX: 0, neckY: 0, lShX: -0.04, lShZ: 0.08, lEl: -0.14, rShX: -0.04, rShZ: -0.08, rEl: -0.14, lHip: 0, lKnee: 0, rHip: 0, rKnee: 0 };
export const SEAT = 0.47;
const SIT = { pelvisY: SEAT + 0.07, lHip: -1.5, lKnee: 1.5, rHip: -1.5, rKnee: 1.5 };

export const POSES = {
  stand: {},
  standTalk: { rShX: -0.5, rShZ: -0.15, rEl: -1.1, neckX: -0.05 },
  standThink: { rShX: -0.75, rShZ: -0.25, rEl: -2.25, neckX: 0.12, lShX: -0.35, lEl: -1.1, lShZ: 0.3 },
  standPoint: { rShX: -1.25, rShZ: -0.05, rEl: -0.1 },
  standReach: { rShX: -1.0, rEl: -0.3, lean: 0.12, neckX: 0.25 },
  standCall: { rShX: -0.5, rShZ: -0.3, rEl: -2.4, neckY: 0.2 },
  standHold: { rShX: -0.35, rEl: -1.4, lShX: -0.3, lEl: -1.3 },
  lean: { lean: 0.3, neckX: 0.25, rShX: -0.8, rEl: -1.9, rShZ: -0.3, lShX: -0.2 },
  sit: { ...SIT, lShX: -0.3, lEl: -0.8, rShX: -0.3, rEl: -0.8, lean: -0.06 },
  sitTalk: { ...SIT, lShX: -0.3, lEl: -0.8, rShX: -0.55, rShZ: -0.35, rEl: -1.35, neckX: -0.08 },
  sitType: { ...SIT, lShX: -0.5, lEl: -1.05, rShX: -0.5, rEl: -1.05, lean: 0.12, neckX: 0.18 },
  sitThink: { ...SIT, lShX: -0.45, lEl: -1.1, rShX: -0.85, rShZ: -0.2, rEl: -2.35, lean: 0.14, neckX: 0.12 },
  sitCall: { ...SIT, lShX: -0.3, lEl: -0.8, rShX: -0.4, rShZ: -0.4, rEl: -2.3, lean: -0.05, neckY: 0.45 },
  sitReach: { ...SIT, lShX: -0.3, lEl: -0.8, rShX: -0.7, rShZ: -0.75, rEl: -0.25, lean: 0.05, neckY: -0.45, neckX: 0.15 },
  sitHold: { ...SIT, lShX: -0.45, lEl: -1.25, rShX: -0.5, rEl: -1.5, lean: -0.04 },
  sitCover: { ...SIT, lShX: -0.5, lEl: -1.05, rShX: -0.95, rShZ: 0.12, rEl: -0.55, lean: 0.24, neckX: 0.3 },
  sitWork: { ...SIT, lShX: -0.62, lEl: -1.15, rShX: -0.62, rEl: -1.15, lean: 0.22, neckX: 0.35 }
};

export function poseValues(name) {
  const p = typeof name === 'string' ? POSES[name] || {} : name || {};
  return { ...Z, ...p };
}

export async function turnTo(obj, yaw, view, ms = 400) {
  const y0 = obj.rotation.y;
  const d = Math.atan2(Math.sin(yaw - y0), Math.cos(yaw - y0));
  await view.animate(ms, k => { obj.rotation.y = y0 + d * k; });
}
