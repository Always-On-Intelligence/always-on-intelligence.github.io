// Case library logic, kept free of the DOM so tests can check it: resolving a case under one
// viewer control, and the coverage of the framework across all cases.

export const CHANNELS = ['SA', 'SM', 'MA', 'AS', 'MS', 'AM'];
export const CONDITIONS = ['privacy', 'authority', 'safety', 'resources', 'availability', 'uncertainty'];
export const arrow = id => `${id[0]}→${id[1]}`;

/**
 * Resolve every beat of a case with one control turned on (or none).
 * A control's variant overrides fields of the beats it names. A 'cut' control also removes its
 * channel from every beat that used it and lists it under `cut`, so nothing crosses that channel.
 */
export function resolveCase(caseDef, controlId = null) {
  const control = caseDef.controls?.find(c => c.id === controlId) || null;
  const beats = caseDef.beats.map((beat, index) => {
    const variant = control && beat.variants?.[control.id];
    const out = { ...beat, ...(variant || {}), index, varied: Boolean(variant) };
    delete out.variants;
    out.channels = [...(out.channels || [])];
    out.cut = [];
    if (control?.type === 'cut' && (beat.channels || []).includes(control.channel)) {
      out.cut = [control.channel];
      out.channels = out.channels.filter(ch => ch !== control.channel);
    }
    return out;
  });
  return { control, level: (controlId && caseDef.levelBy?.[controlId]) || caseDef.level, beats };
}

/** Which parts of the framework the cases cover, as plain sets. */
export function coverage(cases) {
  const add = (set, values) => (values || []).forEach(v => set.add(v));
  const cov = { channels: new Set(), conditions: new Set(), impl: new Set(), domains: new Set(), scopes: new Set(), horizons: new Set(), levels: new Set(), steps: new Set(), S: new Set(), M: new Set(), A: new Set(), evidence: new Set(), cuts: new Set() };
  for (const c of cases) {
    cov.domains.add(c.domain); cov.scopes.add(c.scope); cov.horizons.add(c.horizon); cov.levels.add(c.level);
    Object.values(c.levelBy || {}).forEach(l => cov.levels.add(l));
    for (const m of ['S', 'M', 'A']) add(cov[m], c.classes?.[m]);
    for (const control of c.controls || []) if (control.type === 'cut') cov.cuts.add(control.channel);
    for (const b of c.beats) {
      add(cov.channels, b.channels); add(cov.conditions, b.conditions); add(cov.impl, b.impl);
      cov.steps.add(b.step);
      if (b.evidence) cov.evidence.add(b.evidence);
    }
  }
  return cov;
}
