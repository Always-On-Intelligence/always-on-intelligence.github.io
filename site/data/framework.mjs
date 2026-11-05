// Framework content for the interactive loop. Text follows Section 2 of the paper
// (sec/02_foundations.tex), Table 2 and Figure 2, and the module chapters' opening,
// space, conditions, and takeaway paragraphs (sec/04_sensing.tex, sec/05_memory.tex,
// sec/06_action.tex). Keep them in sync with the paper. Each takeaway is the chapter box's three bold points.

export const modules = {
  S: {
    id: 'S',
    takeawayTitle: 'What Sensing misses is rarely evaluated',
    takeaway: [
      ["Always-on sensing cannot yet afford high frame rates, and what it misses is lost.", "Power limits keep always-on wearables at low frame rates, yet many everyday actions last under a second and can fall between frames. Unlike a misread frame, an uncaptured action leaves no record and no error signal, and the assistant cannot replay the user’s day to recover it."],
      ["Stale memory hides the evidence that would correct it.", "When the world changes without notice, an outdated record can keep the assistant from looking where the change happened, and no reviewed test counts the observations it skipped."],
      ["No reviewed work shows that a revised sensing policy misses fewer events.", "Showing this needs an independent record of what happened and a comparison before and after the revision."],
    ],
    example: 'If the calendar indicates an ongoing meeting while the call application has closed, the state needs to keep both readings with their source, time, and uncertainty, so later decisions can handle the discrepancy.',
    name: 'Sensing',
    section: '§3',
    spaceShort: 'current observations',
    policyShort: 'observation selection & timing',
    role: 'Sensing takes in observations and feedback from the user and the world, forming the current context and the state of ongoing tasks. In an always-on assistant, sensing continues between requests, so the assistant decides for itself when to switch observation on and what to look at.',
    detail: 'Sensing is classified by how it starts. Continuous sensing stays active, triggered sensing starts on a cue, timer, or event, and on-demand sensing starts when a user request or pending decision needs fresh information. All three draw on sensors, user input, application events, and tool responses within and between requests, and they preserve the time, source, and uncertainty of what they observe.',
    space: 'Continuous, triggered, and on-demand observations',
    examples: ['Continuous', 'Triggered', 'On-demand'],
    policy: ['trigger', 'allocate', 'set windows', 'segment', 'compress', 'check readiness', 'place computation', 'route'],
    challenge: 'Missed events are hard to check. Resource and privacy limits also make policy improvements hard to verify.',
    incoming: ['MS', 'AS']
  },
  M: {
    id: 'M',
    takeawayTitle: 'Faulty memory can trap the system in repeated mistakes',
    takeaway: [
      ["A wrong belief can spread before anyone notices.", "Methods that mark outdated records need new evidence, so a belief that turns wrong silently keeps being reused in summaries and commitments."],
      ["Keeping records valid is harder than retrieving them.", "An update can be missed, and even a successful one may not reach the summaries and cached reads built on the old value."],
      ["Commitments need a store of their own.", "Whether they come from a request, a conversation, or the assistant’s own promise, pending commitments must come back on their own when their condition holds and must record whether they are still pending, done, or cancelled. Retrieved history does neither."],
    ],
    example: 'Retrospective memory keeps observed events, conversations, and the assistant’s own actions together with the responses they drew. Profile memory keeps what holds now about the user, their world, and their ongoing tasks, and prospective memory keeps commitments that wait for a time, an event, or a condition, such as a reminder to send the report after the meeting.',
    name: 'Memory',
    section: '§4',
    spaceShort: 'persistent context',
    policyShort: 'retrieval & maintenance',
    role: 'Memory keeps what the assistant learns about the user and hands it back when a decision needs it or a commitment falls due. It also holds commitments until their moment arrives, and it records who supplied each item and who is allowed to use it.',
    detail: 'Records are classified by the time they describe. Retrospective memory records the past: events, interactions, and the assistant’s actions and outcomes. Profile memory describes current facts, preferences, goals, plans, and task progress. Prospective memory looks ahead and retains unfulfilled commitments.',
    space: 'Retrospective, profile, and prospective records',
    examples: ['Retrospective', 'Profile', 'Prospective'],
    policy: ['admit', 'encode', 'index', 'retrieve and deliver', 'consolidate', 'correct', 'retire'],
    challenge: 'Wrong or outdated records are hard to detect. Even after correction, their effects on decisions and policy revisions need checking.',
    incoming: ['SM', 'AM']
  },
  A: {
    id: 'A',
    takeawayTitle: 'Action outcomes are delayed and sparse',
    takeaway: [
      ["Assistance that helps today can become a burden later.", "Interruptions add up and the effect of repeated suggestions can fade, so immediate acceptance does not show lasting benefit."],
      ["Pending work must survive restarts without repeating.", "Models often repeat a write when a request is still in flight or arrives twice, and no reviewed evaluation tests whether personal commitments are missed or repeated after a restart or a change of permission."],
      ["Revising the Action policy needs attribution first.", "Outcomes arrive late and several interventions can precede one, so the assistant must attribute each outcome to the decision behind it and judge a revision across all of its ongoing responsibilities."],
    ],
    example: 'For a reminder assistant, notifying the user, preparing the report email, and sending it require different evidence and permissions and create different commitments.',
    name: 'Action',
    section: '§5',
    spaceShort: 'available behaviors',
    policyShort: 'response selection & timing',
    role: 'Action decides whether, when, and how the assistant acts on the external world, for example by sending a message, editing a file, or speaking aloud. In real use, opportunities to act arise continuously without a request, and staying silent is often the right choice.',
    detail: 'Actions are classified by what starts them. Reactive action responds to a current request, and deferred action carries out an earlier commitment without a new request. Proactive action addresses a need not covered by an existing request or commitment. Across all three classes, Action can remain silent or act.',
    space: 'Reactive, deferred, and proactive actions',
    examples: ['Reactive', 'Deferred', 'Proactive'],
    policy: ['gate, wait, or ask', 'retain control', 'choose effector', 'check authority'],
    challenge: 'Repeated help burdens the user, while service pauses risk missed or repeated work. Late or limited feedback makes lasting benefits and policy improvements hard to judge.',
    incoming: ['SA', 'MA']
  }
};

// Order follows Table 2 of the paper: the basic S→A path first, then the five additional channels.
// The short labels are those of Figure 2.
export const channels = [
  {
    id: 'SA', from: 'S', to: 'A', side: 'inner',
    short: 'Current observation for action',
    difficulty: 'Basic',
    flow: 'Current context and observed execution state that inform Action’s decisions.',
    challenge: 'Context must reach Action in time and remain current when used.',
    example: 'Sensing returns the current context, such as whether the user is free, to Action.',
  },
  {
    id: 'SM', from: 'S', to: 'M', side: 'outer',
    short: 'New evidence for retention',
    difficulty: 'Moderate',
    flow: 'Observations that Memory uses to create or update records.',
    challenge: 'Future needs are hard to predict. Losing the original evidence also makes records harder to check and correct.',
    example: 'Sensing passes the interpreted request to Memory, where the pending reminder is retained.',
  },
  {
    id: 'MA', from: 'M', to: 'A', side: 'outer',
    short: 'Preference & commitment for action',
    difficulty: 'Moderate',
    flow: 'Retained personal information and pending commitments that inform Action’s decisions.',
    challenge: 'Records must be relevant and up to date. Their use must also respect current permissions.',
    example: 'Memory supplies the reminder and relevant preferences, which help Action decide whether to remind the user or wait.',
  },
  {
    id: 'AS', from: 'A', to: 'S', side: 'outer',
    short: 'Execution state for checks',
    difficulty: 'Moderate',
    flow: 'Action plans and execution state that guide what Sensing observes and checks.',
    challenge: 'Delayed or partly visible effects are hard to check. Checks must also follow plan changes.',
    example: 'Around the expected end time, Action requests a fresh check of the user’s availability.',
  },
  {
    id: 'MS', from: 'M', to: 'S', side: 'inner',
    short: 'Personal priors guide observation',
    difficulty: 'High',
    flow: 'Retained information that guides what Sensing observes and how it interprets new observations.',
    challenge: 'When outdated records guide Sensing, evidence needed to correct them is harder to collect.',
    example: 'During the meeting, retained meeting information guides Sensing, helping it decide when to check whether the meeting has ended.',
  },
  {
    id: 'AM', from: 'A', to: 'M', side: 'inner',
    short: 'Trajectory and feedback for retention',
    difficulty: 'High',
    flow: 'Action context and immediate results that Memory uses to maintain task history.',
    challenge: 'When several actions affect an outcome, linking late feedback to the right one requires earlier decision records.',
    example: 'Action sends the decision and execution context to Memory, so that the task and its history reflect what happened.',
  }
];

export const channelIntro = 'A coupling channel is a directed information flow at the functional level: one module supplies information as context for another module’s decisions or state updates. It identifies the source, the supplied context, and how the receiving module uses it. Three modules give six possible directed channels.';

// Section 2.4 and the "Shared Conditions for ..." subsections of Sections 3 to 5.
export const conditions = [
  {
    id: 'privacy', name: 'Privacy',
    text: 'Privacy requirements limit the use of personal information: a confidential meeting can permit transient speech processing while prohibiting transcript retention or disclosure through tools.',
    perModule: {
      S: 'Continuous and triggered sensing record whoever is present, not only the user. As people enter or leave, the assistant reassesses which signals and inferences it captures, processes, or retains.',
      M: 'Privacy requirements and retention permissions decide which content is allowed to become a record and how long it can stay. A user’s request to be reminded to send a report after the meeting can be kept, but what colleagues said in that meeting is their information, and the user’s consent does not cover it.',
      A: 'Privacy limits what an action is allowed to disclose and to whom. The same information can be fine on the user’s phone but not read aloud in a shared room or delivered days later to a different audience. Because a disclosure cannot be undone, this limit applies before the action takes effect.'
    }
  },
  {
    id: 'authority', name: 'Authority',
    text: 'User authority means the permissions that the user has granted and that are still in force, as when a calendar grant permits reading but not editing.',
    perModule: {
      S: 'On phones, the operating system also limits sensing between requests. Since Android 9, an app in the background cannot use the microphone or camera, and its sensors stop delivering events unless it runs as a foreground service, which keeps a notification visible to the user.',
      M: 'Three parties set the limits on what Memory keeps. The user grants or withdraws permission and can ask for deletion, the provider’s terms fix how long data is held and where it is processed, and other people involved have expectations about being recorded.',
      A: 'User authority limits which resources an action is allowed to affect, for which audience, at what time, and with what lasting effect. A typical grant permits drafting but requires confirmation before a message is sent, so the reminder assistant can draft the report email but not send it.'
    }
  },
  {
    id: 'safety', name: 'Safety',
    text: 'Safety bounds harm that no grant makes acceptable, such as a robot arm moving while a person is within reach or health advice that could injure the user.',
    perModule: {
      A: 'Safety limits the harm an action can cause, and no grant can widen that limit. Because an injury cannot be corrected afterwards, the limit applies before the action takes effect, which matters most while the user is away and no one reviews the action.'
    }
  },
  {
    id: 'resources', name: 'Resources',
    text: 'Resource budgets limit the battery, computation, storage, and user attention that the assistant can spend.',
    perModule: {
      S: 'An always-on assistant needs enough energy to sustain observation under its declared operating schedule, alongside memory access and action. Lower sampling can extend recording time but miss short events.',
      M: 'Even content that the assistant is allowed to keep has a cost, because an always-on assistant adds records for months and each record keeps costing after it is written. Memory’s resource budget therefore covers storage, maintenance work, search time, and room in each model call.',
      A: 'A permitted intervention still draws on the user’s attention, a limited resource. For an assistant that runs all day, these costs add up, and its own earlier reminders count among them.'
    }
  },
  {
    id: 'availability', name: 'Availability',
    text: 'Availability concerns whether the devices, stores, and interfaces a decision needs can be reached at that moment.',
    perModule: {
      S: 'Offloading sends work to another device and trades local computation for communication. This communication depends on a network, whose delay and disconnection affect when observations become usable.',
      M: 'A record helps only if it can be read when a decision needs it, which depends on where the record is kept. When the user carries several devices, for example, a reminder set on the phone helps only if the smart glasses that deliver it can read it.',
      A: 'An interface can be unavailable because a calendar service is offline or the user is away from the device that would show the reminder.'
    }
  },
  {
    id: 'uncertainty', name: 'Uncertainty',
    text: 'Uncertainty concerns how far the assistant can trust its current evidence, such as whether the meeting has really ended.',
    perModule: {
      S: 'Readiness decides whether the evidence at hand is enough for the next decision. A query can arrive before its answer is observable.',
      A: 'The assistant does not always know whether the meeting has ended or the report was already sent.'
    }
  }
];

export const conditionsIntro = 'Shared conditions are the limits set by the user and the world, and they span privacy requirements, user authority, safety, resource budgets, availability, and uncertainty. Such a condition holds only when every module it constrains meets it, and a limit or failure in one module carries over to the others.';

// Section 2.4 and Section 6.2: implementation, written as the mechanism θ_t = (ω_t, Σ_t) in Section 2.1.
export const implementation = {
  model: { name: 'Model', text: 'The model, typically a large language or multimodal model, interprets the input and makes decisions. One foundation model often carries several modules, so its parameters are shared by the whole assistant.' },
  scaffolding: {
    name: 'Scaffolding',
    parts: ['Prompts', 'Context construction', 'Storage', 'Tools and APIs', 'Harness'],
    text: 'The scaffolding orchestrates the model and carries its outputs through interfaces to the user’s devices, applications, and databases. The harness runs the loop: it decides when a step happens, what runs in it, and which version of the mechanism is in effect.'
  },
  intro: 'The model and the scaffolding act on every module: they take in the information a module receives and process it into a form the next module can use. The modules are therefore functional divisions, not separate models or tools.',
  mechanism: 'In the definitions, the implementation appears as the mechanism θₜ = (ωₜ, Σₜ), the parameter of STEP that REVISE changes: ωₜ holds the model parameters and Σₜ the scaffolding. The running state zₜ holds all other information the assistant carries into a step.'
};

// Sections 2.1 and 2.3: one reminder that uses each of the six channels.
// kind: 'request' (t in R), 'boundary' (t in B), 'outside' (t outside R).
export const reminderSteps = [
  {
    kind: 'request', channel: 'SM', active: ['S', 'M'],
    title: 'The user asks for a reminder',
    text: 'A user asks the assistant to remind them to send a report after a meeting. Sensing passes the interpreted request to Memory, where the pending reminder is retained.',
    state: { s: 'request: remind me to send the report after the meeting', m: ['pending: send the report after the meeting'] }
  },
  {
    kind: 'boundary', channel: null, active: ['M'],
    title: 'The conversation ends',
    text: 'The conversation has ended, but the reminder remains a pending commitment that the user requested. The user left its timing to the assistant.',
    state: { s: 'nothing new', m: ['pending: send the report after the meeting'] }
  },
  {
    kind: 'outside', channel: 'MS', active: ['M', 'S'],
    title: 'Memory guides observation',
    text: 'During the meeting, retained meeting information guides Sensing, helping it decide when to check whether the meeting has ended.',
    state: { s: 'checks timed to the expected end of the meeting', m: ['pending: send the report after the meeting'] }
  },
  {
    kind: 'outside', channel: 'AS', active: ['A', 'S'],
    title: 'The meeting ends, and nobody asks anything',
    text: 'The assistant detects the end of the meeting, for example from a calendar event. This detection only tests the condition the user set, so it is still a request step. Deciding on an appropriate time to remind takes place outside the request steps, and Action requests a fresh check of the user’s availability.',
    state: { s: 'calendar: the meeting has ended · checking: is the user free?', m: ['pending: send the report after the meeting'] }
  },
  {
    kind: 'outside', channel: 'SA', active: ['S', 'A'], choice: true,
    title: 'Sensing reports the result',
    text: 'Sensing returns the current context to Action.',
    state: { s: 'availability: {free}', m: ['pending: send the report after the meeting'] }
  },
  {
    kind: 'outside', channel: 'MA', active: ['M', 'A'], choice: true,
    title: 'Action chooses to remind or to wait',
    text: 'Memory supplies the reminder and relevant preferences. Together, these inputs help Action decide whether to remind the user or wait. Doing nothing is also a valid choice for each module: Sensing can skip an observation, Memory can leave the records unchanged, and Action can stay silent.',
    state: { s: 'availability: {free}', m: ['pending: send the report after the meeting'], a: '{decision}' }
  },
  {
    kind: 'outside', channel: 'AM', active: ['A', 'M'], choice: true,
    title: 'Memory keeps the task and its history',
    text: 'Action then sends the decision and execution context to Memory, so that the task and its history reflect what happened.',
    state: { s: 'nothing new', m: ['{task}', 'history: {history}'] }
  }
];

export const reminderVariants = {
  continuing: {
    name: 'Continuing loop',
    note: 'Both properties hold: the assistant decides whether and when to act at steps outside the request steps, and the pending reminder remains after the conversation ends.'
  },
  request: {
    name: 'Request-only',
    note: 'In a request-only assistant, every step carries out a request as asked, so it can keep the reminder, but nothing happens until the user returns.'
  },
  session: {
    name: 'Session-local',
    note: 'A session-local assistant resets its running state to the initial state z₀ whenever an interaction ends, so it starts each interaction without the earlier commitment.'
  }
};

export const reminderClosing = 'Suppose the user later reports that the reminder came too soon. Sensing passes this feedback to Memory through S→M, where attribution links it to the recorded reminder decision. With this link, the assistant can use the feedback to revise Action’s policy for deciding when to send reminders, not only to add a record in Memory.';

// Sections 1 and 2.1: a fixed mechanism, then the five steps of the chain of evidence for
// self-evolution (record, outcome, attribution, revision, later use), then governed revision.
// theta: 'old' (θ_t unchanged) or 'new' (θ_{t+1} in effect).
export const evolveSteps = [
  {
    id: 'content', channel: 'SM', theta: 'old',
    title: 'Only the running state changes',
    text: 'A continuing loop can retain information across interactions while its mechanism stays fixed. In a fixed-mechanism loop, REVISE returns the mechanism unchanged, so only the running state changes.',
    formula: String.raw`z_{t+1}\ne z_t\;\nRightarrow\;\theta_{t+1}\ne\theta_t`
  },
  {
    id: 'record', channel: 'AM', theta: 'old',
    title: 'Record',
    text: 'When a revision uses outcome feedback, the claim of self-evolution rests on a chain of evidence beginning with retained action records. Action sends each reminder decision with its execution context to Memory, so that the task and its history reflect what happened.'
  },
  {
    id: 'outcome', channel: 'SM', theta: 'old',
    title: 'Outcome',
    text: 'Suppose the user usually dismisses such reminders right after meetings and sends the report only once they are back at their workstation. The outcomes of the assistant’s decisions are often delayed, sparse, or even implicit. Feedback that arrives after the interaction reaches Memory through S→M.'
  },
  {
    id: 'attribution', channel: null, theta: 'old',
    title: 'Attribution',
    text: 'Attribution links the feedback to the decision it concerns. The assistant attributes each dismissal to the decision to send the reminder as soon as the meeting ends, and to the timing rule behind that decision. The decision and execution context retained through A→M helps make this link.'
  },
  {
    id: 'revision', channel: null, theta: 'new',
    title: 'Revision',
    text: 'REVISE uses this attributed feedback to change the mechanism for later steps. Based on this attribution, the assistant can revise the timing rule to wait until the user is back at their workstation, instead of simply sending fewer reminders.',
    formula: String.raw`\theta_{t+1}=\mathrm{REVISE}(\theta_t;\tau_t)\ne\theta_t`
  },
  {
    id: 'later', channel: null, theta: 'new',
    title: 'Later use',
    text: 'A revised mechanism stays in effect across interaction boundaries until a later revision replaces it. A claim of self-evolution requires evidence both that the mechanism changed durably and that later steps used the revised mechanism, five steps in all: record, outcome, attribution, revision, and later use.'
  },
  {
    id: 'governed', channel: null, theta: 'new',
    title: 'Governed revision',
    text: 'Self-evolution is governed when the shared conditions also constrain REVISE. A governed revision must work within the limits these conditions set without changing those limits itself. Privacy requirements restrict which records it is allowed to learn from, while the user’s authority determines what it is allowed to change and when it takes effect.',
    formula: String.raw`\theta_{t+1}=\mathrm{REVISE}(\theta_t;\tau_t,c_t)`
  }
];

// The definition box of Section 2.1 (not shown directly; the property cards quote it).
export const definitions = {
  alwaysOn: 'Always-on personal intelligence is personal assistance that maintains two core properties for the same user: operational continuity and state durability.',
  continuity: 'Operational continuity is the ability to keep operating between explicit requests and to decide when to act or wait.',
  durability: 'State durability is the ability to preserve user-specific state for later use and to carry unresolved commitments across interaction boundaries.',
  loop: 'We define the continuing loop as the foundation of always-on personal intelligence. The loop provides both properties through the recurring operation of Sensing, Memory, and Action.',
  evolving: 'A self-evolving extension goes a step further and uses operating experience to make durable revisions to this mechanism, which later steps then use.',
  steering: 'The user steers the loop instead of running it, setting only its direction and boundaries, while the assistant decides when to act, revises how it works, and asks for confirmation whenever an action needs authorization from the user.'
};

// Table 3 of the paper. yes / no / opt (not required).
export const adjacentProps = ['Operational continuity', 'State durability', 'Mechanism revision'];
export const adjacentKinds = [
  { name: 'Session-local conversational assistant', v: ['no', 'no', 'no'] },
  { name: 'Request-only assistant with durable memory', v: ['no', 'yes', 'no'] },
  { name: 'Long-horizon agent', v: ['opt', 'opt', 'opt'] },
  { name: 'Self-improving agent', v: ['opt', 'opt', 'yes'] },
  { name: 'Streaming assistant without durable user state', v: ['yes', 'no', 'no'] },
  { name: 'Scheduled or background assistant acting as set', v: ['no', 'opt', 'no'] },
  { name: 'Continuing loop', v: ['yes', 'yes', 'opt'], ours: true },
  { name: 'Self-evolving loop', v: ['yes', 'yes', 'yes'], ours: true }
];
