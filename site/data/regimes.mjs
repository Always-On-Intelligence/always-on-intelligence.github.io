// Operating regimes from Section 2.5 and Figure 4 of the paper (the Scope column of Table 19):
// interaction domain × participant scope, with example cases coloured by outcome horizon.

export const domains = [
  { id: 'physical', name: 'Physical', table: 'Physical' },
  { id: 'wearable', name: 'Wearable', table: 'Wearable' },
  { id: 'digital', name: 'Digital', table: 'Digital' }
];

export const participants = [
  { id: 'individual', name: 'Individual', table: 'Individual' },
  { id: 'group', name: 'Bounded group', table: 'Bounded group' },
  { id: 'public', name: 'Public', table: 'Public' }
];

export const horizons = [
  { id: 'immediate', name: 'Immediate' },
  { id: 'within', name: 'Within-session' },
  { id: 'cross', name: 'Cross-session' },
  { id: 'longitudinal', name: 'Longitudinal' },
  { id: 'unmeasured', name: 'Unmeasured' }
];

// Figure 4: three example cases per setting.
export const cases = {
  'physical-individual': [['Fall alert', 'immediate'], ['Cooking assistance', 'within'], ['Health tracking', 'longitudinal']],
  'wearable-individual': [['Item reminder', 'immediate'], ['Routine continuity', 'cross'], ['Lifestyle adaptation', 'longitudinal']],
  'digital-individual': [['File suggestion', 'immediate'], ['Coding assistant', 'within'], ['Preference extraction', 'longitudinal']],
  'physical-group': [['Mobility aid', 'immediate'], ['Care handoff', 'cross'], ['Household adaptation', 'longitudinal']],
  'wearable-group': [['Meeting cue', 'immediate'], ['Group coordination', 'within'], ['Meeting follow-up', 'cross']],
  'digital-group': [['Comment alert', 'immediate'], ['Joint editing', 'within'], ['Project continuity', 'cross']],
  'physical-public': [['Crowd warning', 'immediate'], ['Safe detour', 'within'], ['Public impact', 'unmeasured']],
  'wearable-public': [['Crowd alert', 'immediate'], ['Shared routing', 'within'], ['Commute helper', 'cross']],
  'digital-public': [['Content alert', 'immediate'], ['Live discussion', 'within'], ['Footprint manager', 'longitudinal']]
};

export const regimeIntro = 'We describe each application case by an operating regime with three coordinates. The interaction domain is physical, wearable, or digital, though an assistant can span several. The participant scope is an individual, a bounded group, or the public. The outcome horizon marks when the evaluated consequence becomes observable: immediately, within a session, across sessions, or over a longitudinal study, with missing measurements marked unmeasured.';

export const regimeNote = 'Domain points to resource, sensing, and safety constraints, and participant scope to whose privacy, consent, and authority matter. Outcome horizon points to how long the system may wait for evidence before it can verify an effect or justify an update.';

// Table 19 codes the horizon of each row's selected case. Its "s" pools immediate and within-session
// endpoints, and its "–" (not reported) marks rows without a reported outcome, which Section 2.5 and
// the figure call unmeasured.
export const tableHorizon = {
  'Within-session': ['immediate', 'within'],
  'Cross-session': ['cross'],
  'Longitudinal': ['longitudinal'],
  'Not reported': ['unmeasured']
};
