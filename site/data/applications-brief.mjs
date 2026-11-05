// Short versions of the paper's §6.1 domain texts, for the Applications sheets. Each domain has a gist,
// three points on what its systems do, and its bottlenecks, compressed from the paragraphs in
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
    bottleneck: '==The cost of capture==, ==the repair of wrong records==, and ==timing and audience== in conversation. No single module resolves them.'
  },
  Digital: {
    gist: 'Digital assistants carry ==plans and personal context== across applications, and some also ==revise the procedures or code== they use later.',
    points: [
      '**Check-ins**: PITCH plans with the user each morning and follows up each evening. Some follow-ups were refused or misplaced.',
      '**Background work**: Claude Cowork runs scheduled tasks, Muse adds event-driven work, Dot reaches out with results, and Claude Duet checks connected accounts every few hours.',
      '**Reusable procedures**: ReasoningBank keeps guidance from feedback, SkillHarness builds reusable GUI procedures, and KnowAct-GUIClaw repairs them from execution feedback.'
    ],
    bottleneck: '==Keeping the workspace available== draws on computation and bandwidth that all three modules share, and ==reused context can fail== when the interface, task or permission has changed.'
  },
  Physical: {
    gist: 'Physical assistance needs ==reliable execution== and coordination with people. A few deployed systems already ==sustain it between requests==.',
    points: [
      '**Deployed systems act unprompted**: ElliQ starts conversations, Hobbit patrols after long inactivity, and STRANDS schedules its visits from logged outcomes.',
      '**Health checks and routines**: MoveCare and PALRO remind older adults when a measurement is due or missing, and PAM revises a memory of one user’s routine after each day.',
      '**Robot agents** such as PHILIA, ABot-Claw, AssistantX and EgoMem keep personal memory, but mostly act on instruction.'
    ],
    bottleneck: '==Mistakes usually cost more==, because contact, collision and movement can hurt people. ==Checking results== takes time, and ==judging whether the assistance was useful== needs the user’s response and later task progress.'
  }
};
