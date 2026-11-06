// Short versions of the paper's §6.1 domain texts, for the Applications sheets. Each domain has a gist,
// three points on what its systems do, and its bottlenecks (one line each, with a short reason), compressed from the paragraphs in
// applications.json (exported from the paper), which the domain sheet still offers in full behind a toggle.
// Markup: ==phrase== marks a key phrase, **label** starts a point.
export const briefs = {
  Wearable: {
    gist: 'Wearable assistants use what the user sees and hears. They ==guide a task as it happens== or ==recall it afterwards==, and the two need evidence at different times.',
    points: [
      '**Guidance** needs a stable estimate of the current step. Pro²Assist updates its progress only when successive step predictions agree.',
      '**Recall** can wait for better evidence. LightMem-Ego refines its event records later, from transcripts.',
      '**In conversation** the assistant decides when to speak and how. LlamaPIE gives suggestions in the user’s ear, SocialMind uses an augmented-reality display.'
    ],
    bottlenecks: [
      ['The cost of capture', 'What it captures now limits what Memory can recall later.'],
      ['Repairing wrong records', 'Capturing more does not fix a wrong record. The user or later observations must.'],
      ['Timing and audience', 'A response prepared in the background must still fit the topic and the people present.']
    ]
  },
  Digital: {
    gist: 'Digital assistants carry ==plans and personal context== across applications, and some also ==revise the procedures or code== they use later.',
    points: [
      '**Check-ins**: PITCH plans with the user each morning and follows up each evening. Some follow-ups were refused or misplaced.',
      '**Background work**: Claude Cowork runs scheduled tasks, Muse adds event-driven work, Dot reaches out with results, and Claude Duet checks connected accounts every few hours.',
      '**Reusable procedures**: ReasoningBank keeps guidance from feedback, SkillHarness builds reusable GUI procedures, and KnowAct-GUIClaw repairs them from execution feedback.'
    ],
    bottlenecks: [
      ['Keeping the workspace available', 'Background checks and memory upkeep compete with replies for the same computation.'],
      ['Reusing retained context', 'Reused context can fail when the interface, task, or permission has changed.']
    ]
  },
  Physical: {
    gist: 'Physical assistance needs ==reliable execution== and coordination with people. A few deployed systems already ==sustain it between requests==.',
    points: [
      '**Deployed systems act unprompted**: ElliQ starts conversations, Hobbit patrols after long inactivity, and STRANDS schedules its visits from logged outcomes.',
      '**Health checks and routines**: MoveCare and PALRO remind older adults when a measurement is due or missing, and PAM revises a memory of one user’s routine after each day.',
      '**Robot agents** such as PHILIA, ABot-Claw, AssistantX and EgoMem keep personal memory, but mostly act on instruction.'
    ],
    bottlenecks: [
      ['Checking results', 'Mistakes cost more here, so how much to check depends on the cost of an error.'],
      ['Judging whether the help was useful', 'Memory has to keep the user’s response and later task progress.']
    ]
  }
};
