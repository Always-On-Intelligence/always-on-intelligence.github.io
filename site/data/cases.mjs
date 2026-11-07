// The case library (Demo section). Eight short episodes, each modeled on systems the paper
// reviews (§6.1, Table 19, Table 21) and told in the terms of §2: the module that acts, the
// channel that carries information, the shared conditions, the parts of the implementation,
// and the running state z and mechanism θ. Episodes are teaching simulations: `source` says what
// the paper reports for the cited works, `extension` what the episode adds.
//
// Beat fields: step ('request' | 'outside' | 'boundary' | 'revision'), channels (information
// flows in this beat, as in Table 2), modules, conditions, impl, memory (z after the beat, in the
// memory classes of §4.1.1: retrospective, profile, prospective), theta (mechanism version, for
// example a rule or a skill file), limit (a permission of the shared conditions c_t that the
// episode tracks), scene (facts shown on the device: display, screen, robot status).
// Each episode has one call, the moment where the viewer decides what the assistant does
// (`actor` names it). A decision holds that call: `prompt` sets up the moment, `ask` overrides the
// question, `labels` give plain names to the options, `options` and `results` say what each option
// would lead to, and `choice` and `why` give the assistant's own call (`who` overrides its name).
// Other beats play their action on their own: `auto` names it, and the room plays it after the beat.
// `variants[controlId]` overrides fields of a beat when the viewer turns that control on.
// A control of type 'cut' blocks one channel: every beat that uses the channel must say what
// happens without it (tests/cases.test.mjs checks this).

export const IMPL = [
  ['model', 'Model'],
  ['prompts', 'Prompts'],
  ['context', 'Context construction'],
  ['storage', 'Storage'],
  ['tools', 'Tools and APIs'],
  ['harness', 'Harness']
];

export const STEP_LABEL = {
  request: 'request step',
  outside: 'no request',
  boundary: 'interaction ends',
  revision: 'mechanism revision'
};

/** The names of the levels of loop closure (§6.3, Table 21), as site/data/levels.json spells them. */
export const LEVEL_NAME = {
  L0: 'Session local',
  L1: 'Retained state',
  L2: 'State-guided decision',
  L3: 'Unrequested action',
  L4: 'Attributed outcomes',
  L5: 'Governed revision'
};

export const cases = [
  {
    id: 'workbench',
    cover: 3,
    num: '01',
    title: 'One hint at the workbench',
    tagline: 'Help arrives without a request, yet nothing carries over to the next session.',
    domain: 'wearable', scope: 'individual', horizon: 'immediate', level: 'L0',
    device: 'Smart glasses with a camera and a small display',
    actor: 'the glasses',
    works: [{ name: 'ProAssist', key: 'proassist2025' }, { name: 'ProMemAssist', key: 'promemassist' }, { name: 'Pro²Assist', key: 'pro2assist2026' }],
    source: 'ProAssist responds to the current scene during a procedural task, ProMemAssist estimates when help will be timely, and Pro²Assist updates its progress record only when successive step predictions agree. The paper places all three at L0: they act within a session and keep nothing across sessions.',
    extension: 'The occluded part and the second visit are added for this episode.',
    classes: { S: ['continuous', 'on-demand'], M: [], A: ['reactive', 'proactive'] },
    scene: 'wearable',
    controls: [
      { id: 'low-budget', type: 'condition', cond: 'resources', label: 'Camera saves battery', note: 'The camera takes one frame every few seconds, so a short moment can fall between two frames.' },
      { id: 'cut-AS', type: 'cut', channel: 'AS', label: 'No closer look', note: 'Action can no longer ask Sensing for a closer look.' }
    ],
    beats: [
      {
        step: 'request', title: 'Which one is part A?',
        text: 'The user asks which part to pick up next. Continuous video supplies the parts on the bench.',
        channels: ['SA'], modules: ['S', 'A'], conditions: ['resources'], impl: ['model', 'harness'],
        memory: [{ kind: 'profile', text: 'task progress: step 3 of 7 (this session only)' }],
        scene: { place: 'workbench', items: ['Part A', 'Part B', 'Clip'], focus: 'Part B', cam: 'on', mic: 'on', hud: null }
      },
      {
        step: 'request', title: 'The view is blocked',
        text: 'A hand hides two parts that look alike, so recognition is uncertain. Instead of guessing, Action asks Sensing for a closer look.',
        channels: ['AS'], modules: ['A', 'S'], conditions: ['uncertainty'], impl: ['tools'],
        auto: 'look closer',
        memory: [{ kind: 'profile', text: 'task progress: step 3 of 7 (this session only)' }],
        scene: { place: 'workbench', items: ['Part A', 'Part B', 'Clip'], focus: 'Part A', blur: true, cam: 'on', mic: 'on', hud: { text: 'Checking…', tone: 'quiet' } },
        variants: {
          'cut-AS': {
            text: 'A hand hides two parts that look alike. With A→S cut, Action cannot ask for a closer look, and a guess from the blurred frame could point at the wrong part, so it waits.',
            auto: 'wait',
            scene: { place: 'workbench', items: ['Part A', 'Part B', 'Clip'], focus: 'Part A', blur: true, cam: 'on', mic: 'on', hud: { text: 'Not sure yet', tone: 'quiet' } }
          }
        }
      },
      {
        step: 'request', title: 'Pointing at the right part',
        text: 'The close-up resolves the doubt, and the glasses point at part A.',
        channels: ['SA'], modules: ['S', 'A'], conditions: ['uncertainty'], impl: ['model', 'context'],
        memory: [{ kind: 'profile', text: 'task progress: step 4 of 7 (this session only)' }],
        scene: { place: 'workbench', items: ['Part A', 'Part B', 'Clip'], focus: 'Part A', cam: 'on', mic: 'on', hud: { text: 'This one: part A', tone: 'suggest' } },
        variants: {
          'cut-AS': {
            text: 'The user moves their hand away on their own, and the next frame finally shows part A. The answer comes later than it would have with a requested close-up.',
            scene: { place: 'workbench', items: ['Part A', 'Part B', 'Clip'], focus: 'Part A', cam: 'on', mic: 'on', hud: { text: 'This one: part A (late)', tone: 'suggest' } }
          }
        }
      },
      {
        step: 'outside', title: 'A missing clip, without a request',
        text: 'The user keeps working and asks nothing. The assistant sees that the clip was skipped and raises it before the next part covers it.',
        channels: ['SA'], modules: ['S', 'A'], conditions: ['safety', 'resources'], impl: ['model', 'prompts'],
        decision: {
          prompt: 'The user keeps working and has asked nothing. The clip for step 4 is still on the mat, and the next part is about to go on top of it.',
          options: ['stay silent', 'show a hint'], choice: 'show a hint', why: 'Once the next part is on, the missing clip is hard to fix.',
          labels: { 'stay silent': 'Say nothing', 'show a hint': 'Point out the clip' },
          results: { 'stay silent': 'The next part covers the missing clip, and the mistake is hard to undo.', 'show a hint': 'The glasses point out the clip before the next part covers it.' }
        },
        memory: [{ kind: 'profile', text: 'task progress: step 5 of 7 (this session only)' }],
        scene: { place: 'workbench', items: ['Part A', 'Part B', 'Clip'], focus: 'Clip', cam: 'on', mic: 'on', hud: { text: 'The clip on step 4 is missing', tone: 'alert' } },
        variants: {
          'low-budget': {
            text: 'With sparse frames, the moment the clip was skipped falls between two samples. No observation shows it, so there is nothing to act on.',
            decision: {
              prompt: 'The user keeps working and has asked nothing. The camera takes one frame every few seconds, and none of its frames shows the clip being skipped.',
              options: ['stay silent', 'show a hint'], choice: 'stay silent', why: 'None of its frames shows the skipped clip.',
              labels: { 'stay silent': 'Say nothing', 'show a hint': 'Point out the clip' },
              results: { 'stay silent': 'With no observation of the clip, there is nothing to act on, and the mistake goes unnoticed.', 'show a hint': 'You can see the clip, but the glasses cannot: none of their frames shows it, so a hint would come from nowhere.' }
            },
            scene: { place: 'workbench', items: ['Part A', 'Part B', 'Clip'], focus: null, cam: 'low', mic: 'on', hud: null }
          }
        }
      },
      {
        step: 'outside', title: 'Waiting is also a choice',
        text: 'The user\'s hand moves toward the clip, so a second hint would only cost attention. The glasses hold it and check the next frame, which shows the clip going in.',
        channels: ['SA'], modules: ['S', 'A'], conditions: ['uncertainty', 'resources'], impl: ['model', 'harness'],
        auto: 'wait one frame',
        memory: [{ kind: 'profile', text: 'task progress: step 5 of 7 (this session only)' }],
        scene: { place: 'workbench', items: ['Part A', 'Part B', 'Clip'], focus: 'Clip', cam: 'on', mic: 'on', hud: { text: 'Waiting', tone: 'quiet' } },
        variants: {
          'low-budget': {
            text: 'Sparse frames keep missing the clip, so there is no hint to repeat or hold. The user moves on to the next part with the clip still on the mat.',
            auto: 'stay silent',
            scene: { place: 'workbench', items: ['Part A', 'Part B', 'Clip'], focus: null, cam: 'low', mic: 'on', hud: null }
          }
        }
      },
      {
        step: 'boundary', title: 'Next morning: a fresh start',
        text: 'The session ends and the working state is cleared. The next morning the assistant does not know this assembly was half done: proactive help within a session still leaves the loop at L0.',
        channels: [], modules: ['M'], conditions: ['privacy'], impl: ['storage', 'harness'],
        memory: [],
        scene: { place: 'workbench', items: ['Part A', 'Part B', 'Clip'], focus: null, cam: 'on', mic: 'on', hud: { text: 'New session', tone: 'quiet' } }
      }
    ]
  },

  {
    id: 'second-visit',
    cover: 2,
    num: '02',
    title: 'The second visit',
    tagline: 'A record of what was already shown keeps the glasses from saying it again.',
    domain: 'wearable', scope: 'individual', horizon: 'cross', level: 'L3',
    device: 'Smart glasses with gaze tracking and a small display',
    actor: 'the glasses',
    works: [{ name: 'AiGet', key: 'aiget' }],
    source: 'AiGet uses gaze and a user profile to select knowledge to show on smart glasses. The paper places it at L3, and HALO\'s run mode shows that without the record of shown suggestions it repeats them at a revisit, while cutting the profile from one prompt alone leaves no clear difference because the other path still carries it.',
    extension: 'The store, the shoes, and the two days are a teaching episode in the spirit of HALO\'s run-mode scenes.',
    classes: { S: ['triggered'], M: ['retrospective', 'profile'], A: ['proactive'] },
    scene: 'wearable',
    controls: [
      { id: 'cut-AM', type: 'cut', channel: 'AM', label: 'Shown notes not recorded', note: 'Notes reach the display, but Memory never learns that they were shown.' },
      { id: 'cut-MS', type: 'cut', channel: 'MS', label: 'Profile not used for looking', note: 'What Memory knows about the user no longer guides what the glasses look at.' }
    ],
    beats: [
      {
        step: 'boundary', title: 'Yesterday is still there',
        text: 'Yesterday\'s visit ended, but the profile and the record of shown suggestions remain: the user runs marathons and does not care about brand stories.',
        channels: [], modules: ['M'], conditions: ['authority'], impl: ['storage', 'harness'],
        memory: [{ kind: 'profile', text: 'runs marathons; skips brand stories' }, { kind: 'retrospective', text: 'shown Mon: the plate is no spring' }],
        scene: { place: 'store', items: ['Shoe X', 'Shoe Y'], focus: null, cam: 'on', mic: 'off', hud: null }
      },
      {
        step: 'outside', title: 'A long look triggers sensing',
        text: 'The user stops at the same two running shoes. The long gaze starts a closer observation, and the profile tells perception that this setting is familiar to an experienced runner.',
        channels: ['MS'], modules: ['M', 'S'], conditions: ['privacy'], impl: ['model', 'context'],
        memory: [{ kind: 'profile', text: 'runs marathons; skips brand stories' }, { kind: 'retrospective', text: 'shown Mon: the plate is no spring' }],
        scene: { place: 'store', items: ['Shoe X', 'Shoe Y'], focus: 'Shoe X', cam: 'on', mic: 'off', hud: null },
        variants: {
          'cut-MS': {
            text: 'The long gaze starts a closer observation. With M→S cut, perception works without the profile and reads the store as unfamiliar to the user.',
            scene: { place: 'store', items: ['Shoe X', 'Shoe Y'], focus: 'Shoe X', cam: 'on', mic: 'off', hud: { text: 'Perceived: unfamiliar setting', tone: 'quiet' } }
          }
        }
      },
      {
        step: 'outside', title: 'Choosing what to say',
        text: 'The user lingers at the two shoes, and nobody has asked for anything. The view and the profile reach Action, which shows a deeper note on heel drop rather than a beginner\'s overview, because the user runs marathons.',
        channels: ['SA', 'MA'], modules: ['S', 'M', 'A'], conditions: ['resources'], impl: ['model', 'prompts', 'context'],
        auto: 'deeper note',
        memory: [{ kind: 'profile', text: 'runs marathons; skips brand stories' }, { kind: 'retrospective', text: 'shown Mon: the plate is no spring' }],
        scene: { place: 'store', items: ['Shoe X', 'Shoe Y'], focus: 'Shoe X', cam: 'on', mic: 'off', hud: { text: 'Heel drop: 8 mm vs 4 mm', tone: 'suggest' } },
        variants: {
          'cut-MS': {
            text: 'Perception lacked the profile, but generation still reads it through M→A, so Action still picks the deeper note. Cutting one path alone leaves no clear difference, as in HALO\'s run mode.',
          }
        }
      },
      {
        step: 'outside', title: 'Recording what was shown',
        text: 'Action passes the shown note to Memory with its time and the mechanism version that chose it.',
        channels: ['AM'], modules: ['A', 'M'], conditions: ['privacy'], impl: ['storage'],
        memory: [{ kind: 'profile', text: 'runs marathons; skips brand stories' }, { kind: 'retrospective', text: 'shown Mon: the plate is no spring' }, { kind: 'retrospective', text: 'shown Tue: heel drop 8 vs 4 mm', fresh: true }],
        scene: { place: 'store', items: ['Shoe X', 'Shoe Y'], focus: 'Shoe Y', cam: 'on', mic: 'off', hud: null },
        variants: {
          'cut-AM': {
            text: 'With A→M cut, the note is shown but never recorded. Memory still holds only Monday\'s note.',
            memory: [{ kind: 'profile', text: 'runs marathons; skips brand stories' }, { kind: 'retrospective', text: 'shown Mon: the plate is no spring' }]
          }
        }
      },
      {
        step: 'outside', title: 'Back at the same shelf',
        text: 'Ten minutes later the user returns to the shelf. Memory lists both notes as already shown, so the assistant stays quiet.',
        channels: ['SA', 'MA'], modules: ['S', 'M', 'A'], conditions: ['resources'], impl: ['context', 'harness'],
        decision: {
          prompt: 'Ten minutes later the user is back at the same shelf, looking at the same two shoes. Memory lists both notes as already shown: Monday\'s and today\'s.',
          options: ['repeat a note', 'new note', 'stay silent'], choice: 'stay silent', why: 'Both relevant notes were already shown.',
          labels: { 'repeat a note': 'Show the heel-drop note again', 'new note': 'Find something new to say', 'stay silent': 'Stay quiet' },
          results: { 'repeat a note': 'The user sees the heel-drop note a second time.', 'new note': 'There is no new relevant note, so another note would be filler.', 'stay silent': 'The glasses stay quiet, because both notes were already shown.' }
        },
        memory: [{ kind: 'profile', text: 'runs marathons; skips brand stories' }, { kind: 'retrospective', text: 'shown Mon: the plate is no spring' }, { kind: 'retrospective', text: 'shown Tue: heel drop 8 vs 4 mm' }],
        scene: { place: 'store', items: ['Shoe X', 'Shoe Y'], focus: 'Shoe X', cam: 'on', mic: 'off', hud: null },
        variants: {
          'cut-AM': {
            text: 'Ten minutes later the user returns. Without the record, Memory does not know the heel-drop note was shown, so the glasses show it again.',
            decision: {
              prompt: 'Ten minutes later the user is back at the same shelf. Memory holds only Monday\'s note: nothing says the heel-drop note was shown today.',
              options: ['repeat a note', 'new note', 'stay silent'], choice: 'repeat a note', why: 'Nothing in Memory says this note was already shown.',
              labels: { 'repeat a note': 'Show the heel-drop note again', 'new note': 'Find something new to say', 'stay silent': 'Stay quiet' },
              results: { 'repeat a note': 'The glasses show the heel-drop note again.', 'new note': 'From what Memory holds, the heel-drop note still looks new, so it is the note that gets shown.', 'stay silent': 'You know the note was shown, but the assistant does not: nothing in Memory gives it a reason to stay quiet.' }
            },
            memory: [{ kind: 'profile', text: 'runs marathons; skips brand stories' }, { kind: 'retrospective', text: 'shown Mon: the plate is no spring' }],
            scene: { place: 'store', items: ['Shoe X', 'Shoe Y'], focus: 'Shoe X', cam: 'on', mic: 'off', hud: { text: 'Heel drop: 8 mm vs 4 mm (again)', tone: 'alert' } }
          }
        }
      }
    ]
  },

  {
    id: 'group-talk',
    cover: 4,
    num: '03',
    title: 'A private cue in a group talk',
    tagline: 'One privacy rule limits what the earbuds may hear, keep, and say.',
    domain: 'wearable', scope: 'group', horizon: 'within', level: 'L3',
    device: 'Earbuds with a microphone, and an optional glasses display',
    actor: 'the earbuds',
    works: [{ name: 'SocialMind', key: 'socialmind' }, { name: 'LlamaPIE', key: 'llamapie' }],
    source: 'LlamaPIE gives short suggestions in the user\'s ear and SocialMind shows them on an augmented-reality display; the paper notes that a private cue and a spoken suggestion carry the same content but reach different people. SocialMind is placed at L3 and LlamaPIE at L0.',
    extension: 'The newcomer and the retention rules are combined for this episode; neither work is claimed to implement all of them.',
    classes: { S: ['continuous', 'triggered'], M: ['retrospective', 'profile'], A: ['proactive'] },
    scene: 'wearable',
    controls: [
      { id: 'spoken', type: 'condition', cond: 'privacy', label: 'Cue spoken aloud', note: 'Every cue goes to the whole room instead of the user\'s ear.' },
      { id: 'cut-MS', type: 'cut', channel: 'MS', label: 'Names not used for listening', note: 'What Memory knows about the people no longer helps tell their voices apart.' }
    ],
    beats: [
      {
        step: 'outside', title: 'Listening, with permission',
        text: 'In a four-person discussion, the earbuds process speech the user is allowed to process. Notes from last week help Sensing tell who is speaking.',
        channels: ['MS'], modules: ['M', 'S'], conditions: ['privacy', 'authority'], impl: ['model', 'context'],
        memory: [{ kind: 'profile', text: 'Alex leads the study; Ben owns the data' }],
        scene: { place: 'meeting', people: 3, cam: 'off', mic: 'on', hud: null, labels: ['Alex', 'Ben', 'Chen'] },
        variants: {
          'cut-MS': {
            text: 'Speech is processed, but with M→S cut the notes about the people do not reach perception. Speakers are tracked as voice 1, 2, and 3.',
            scene: { place: 'meeting', people: 3, cam: 'off', mic: 'on', hud: null, labels: ['Voice 1', 'Voice 2', 'Voice 3'] }
          }
        }
      },
      {
        step: 'outside', title: 'What may be kept',
        text: 'What others say can help understanding now, but it is their information. Only the user\'s own task, sending Ben the plan, is admitted to Memory; the transcript is not.',
        channels: ['SM'], modules: ['S', 'M'], conditions: ['privacy'], impl: ['storage'],
        auto: 'the user\'s action items',
        memory: [{ kind: 'profile', text: 'Alex leads the study; Ben owns the data' }, { kind: 'prospective', text: 'user: send Ben the sampling plan', fresh: true }],
        scene: { place: 'meeting', people: 3, cam: 'off', mic: 'on', hud: null, labels: ['Alex', 'Ben', 'Chen'] }
      },
      {
        step: 'outside', title: 'Not now',
        text: 'The profile suggests a question about the dataset, but Alex is mid-sentence. A cue now would split the user\'s attention, so Action holds it until a pause.',
        channels: ['SA', 'MA'], modules: ['S', 'M', 'A'], conditions: ['resources'], impl: ['model', 'prompts'],
        auto: 'wait for a pause',
        memory: [{ kind: 'profile', text: 'Alex leads the study; Ben owns the data' }, { kind: 'prospective', text: 'user: send Ben the sampling plan' }],
        scene: { place: 'meeting', people: 3, cam: 'off', mic: 'on', hud: { text: 'Holding a cue', tone: 'quiet' }, labels: ['Alex', 'Ben', 'Chen'] }
      },
      {
        step: 'outside', title: 'Someone new joins',
        text: 'A visitor from another team joins. The audience has changed, so content drawn from last week\'s private notes is withdrawn.',
        channels: ['SA'], modules: ['S', 'A'], conditions: ['privacy', 'authority'], impl: ['context', 'harness'],
        memory: [{ kind: 'profile', text: 'Alex leads the study; Ben owns the data' }, { kind: 'prospective', text: 'user: send Ben the sampling plan' }],
        scene: { place: 'meeting', people: 4, newcomer: true, cam: 'off', mic: 'on', hud: null, labels: ['Alex', 'Ben', 'Chen', 'Visitor'] }
      },
      {
        step: 'outside', title: 'A cue only the user hears',
        text: 'At a natural pause, the earbuds give the user a short cue: ask Ben about the missing week. Nobody else hears it.',
        channels: ['SA', 'MA'], modules: ['S', 'M', 'A'], conditions: ['privacy', 'resources'], impl: ['prompts', 'tools'],
        decision: {
          ask: 'How should the earbuds give the cue?',
          prompt: 'A natural pause. A visitor from another team has just joined, and the cue is ready: ask Ben about the missing week.',
          options: ['private cue', 'spoken suggestion', 'stay silent'], choice: 'private cue', why: 'The cue is for the user, and the visitor is not entitled to it.',
          labels: { 'private cue': 'In the user\'s ear only', 'spoken suggestion': 'Out loud, to the room', 'stay silent': 'Stay silent' },
          results: { 'private cue': 'Only the user hears the cue, in the earbuds.', 'spoken suggestion': 'Everyone in the room, the visitor included, hears what the user had noted about the data.', 'stay silent': 'The pause passes, and the user misses the moment to ask.' }
        },
        memory: [{ kind: 'profile', text: 'Alex leads the study; Ben owns the data' }, { kind: 'prospective', text: 'user: send Ben the sampling plan' }],
        scene: { place: 'meeting', people: 4, newcomer: true, cam: 'off', mic: 'on', hud: { text: 'Ask Ben about the missing week', tone: 'suggest' }, audience: 'private', labels: ['Alex', 'Ben', 'Chen', 'Visitor'] },
        variants: {
          spoken: {
            text: 'The cue is spoken aloud instead. It interrupts the discussion and discloses to the visitor what the user had noted about the data.',
            decision: {
              ask: 'How should the earbuds give the cue?',
              prompt: 'A natural pause, with a visitor in the room. In this setup every cue is spoken aloud to the room.',
              options: ['private cue', 'spoken suggestion', 'stay silent'], choice: 'spoken suggestion', why: 'Forced by the setting: the output goes to everyone present.',
              labels: { 'private cue': 'In the user\'s ear only', 'spoken suggestion': 'Out loud, to the room', 'stay silent': 'Stay silent' },
              results: { 'private cue': 'Not available in this setup: the only output is the room.', 'spoken suggestion': 'The cue is spoken aloud, and the visitor hears it.', 'stay silent': 'Silence would have protected the user\'s notes, but this setup speaks every cue it delivers.' }
            },
            scene: { place: 'meeting', people: 4, newcomer: true, cam: 'off', mic: 'on', hud: { text: '“Ask Ben about the missing week”', tone: 'alert' }, audience: 'shared', labels: ['Alex', 'Ben', 'Chen', 'Visitor'] }
          }
        }
      },
      {
        step: 'boundary', title: 'After the meeting',
        text: 'The meeting ends. Temporary audio is discarded; the cue that was given and the user\'s action item remain.',
        channels: ['AM'], modules: ['A', 'M'], conditions: ['privacy'], impl: ['storage', 'harness'],
        memory: [{ kind: 'profile', text: 'Alex leads the study; Ben owns the data' }, { kind: 'prospective', text: 'user: send Ben the sampling plan' }, { kind: 'retrospective', text: 'cued: ask Ben about the missing week', fresh: true }],
        scene: { place: 'meeting', people: 0, cam: 'off', mic: 'off', hud: null, labels: [] }
      }
    ]
  },

  {
    id: 'daily-plan',
    cover: 4,
    num: '04',
    title: 'Morning plan, evening check-in',
    tagline: 'Sending at 18:00 sharp follows a schedule. Checking first and waiting is a decision.',
    domain: 'digital', scope: 'individual', horizon: 'cross', level: 'L3', levelBy: { scheduled: 'L2' },
    device: 'A chat app on a laptop and phone',
    actor: 'the assistant',
    works: [{ name: 'PITCH', key: 'lunchnow2025' }],
    source: 'PITCH schedules morning planning and evening reflection in Slack and reuses the morning conversation in the evening; its field-study dialogues include refusals and misplaced follow-ups. The paper places it at L2, because it acts at every scheduled time instead of deciding whether to act.',
    extension: 'The continuing mode, which checks the calendar and may wait, is the step that would make it L3. The option to act at every scheduled time reproduces the scheduled behavior.',
    classes: { S: ['triggered', 'on-demand'], M: ['retrospective', 'profile', 'prospective'], A: ['reactive', 'deferred'] },
    scene: 'digital',
    controls: [
      { id: 'scheduled', type: 'mode', label: 'Send at 18:00 sharp', note: 'The check-in goes out at the scheduled time, whatever the calendar says, as in PITCH.' },
      { id: 'calendar-offline', type: 'condition', cond: 'availability', label: 'Calendar offline', note: 'The calendar cannot be reached in the evening.' }
    ],
    beats: [
      {
        step: 'request', title: 'Planning the day',
        text: 'At 09:00 the user plans the day in chat: draft the methods section, then review Ben\'s figures. The assistant promises to check in this evening.',
        channels: ['SM'], modules: ['S', 'M'], conditions: ['authority'], impl: ['model', 'storage'],
        memory: [{ kind: 'profile', text: 'plan today: methods draft, then Ben\'s figures', fresh: true }, { kind: 'prospective', text: 'evening check-in: pending', fresh: true }, { kind: 'profile', text: 'no pings during calls' }],
        scene: { clock: 'Tue 09:00', net: 'online', panes: [{ app: 'chat', title: 'Planning', rows: [['you', 'Methods draft, then Ben\'s figures'], ['assistant', 'Noted. I will check in this evening.']] }, { app: 'calendar', title: 'Today', rows: [['10:00', 'Lab meeting'], ['17:30', 'Call with Ana'], ['18:30', 'Free']] }], toast: null }
      },
      {
        step: 'boundary', title: 'The chat closes',
        text: 'The conversation ends. The plan and the promised check-in stay in Memory, not in an open chat.',
        channels: [], modules: ['M'], conditions: ['privacy'], impl: ['storage', 'harness'],
        memory: [{ kind: 'profile', text: 'plan today: methods draft, then Ben\'s figures' }, { kind: 'prospective', text: 'evening check-in: pending' }, { kind: 'profile', text: 'no pings during calls' }],
        scene: { clock: 'Tue 09:05', net: 'online', panes: [{ app: 'tasks', title: 'Pending', rows: [['open', 'Draft methods'], ['open', 'Review Ben\'s figures']] }, { app: 'calendar', title: 'Today', rows: [['10:00', 'Lab meeting'], ['17:30', 'Call with Ana'], ['18:30', 'Free']] }], toast: null }
      },
      {
        step: 'outside', title: '18:00: is now a good time?',
        text: 'The evening check-in is due. A due time says when to consider it, not that the user is free, so Action first asks Sensing to read the calendar. It shows the user is still on a call.',
        channels: ['AS', 'SA'], modules: ['A', 'S'], conditions: ['availability', 'uncertainty'], impl: ['tools'],
        auto: 'check the calendar first',
        memory: [{ kind: 'profile', text: 'plan today: methods draft, then Ben\'s figures' }, { kind: 'prospective', text: 'evening check-in: pending' }, { kind: 'profile', text: 'no pings during calls' }],
        scene: { clock: 'Tue 18:00', net: 'online', panes: [{ app: 'calendar', title: 'Today', rows: [['17:30', 'Call with Ana (running late)'], ['18:30', 'Free']], highlight: 0 }, { app: 'tasks', title: 'Pending', rows: [['open', 'Draft methods'], ['open', 'Review Ben\'s figures']] }], toast: null },
        variants: {
          scheduled: {
            text: 'The check-in is due at 18:00. In the scheduled mode it does not look at the calendar: the time alone starts the message.',
            channels: [], modules: ['A'],
            auto: null
          },
          'calendar-offline': {
            text: 'The check-in is due. The calendar API cannot be reached, so Sensing returns no answer about whether the user is free.',
            scene: { clock: 'Tue 18:00', net: 'offline', panes: [{ app: 'calendar', title: 'Today', rows: [['', 'Calendar unavailable']] }, { app: 'tasks', title: 'Pending', rows: [['open', 'Draft methods'], ['open', 'Review Ben\'s figures']] }], toast: null }
          }
        }
      },
      {
        step: 'outside', title: 'Waiting for a gap',
        text: 'Memory supplies the plan and the user\'s preference not to be pinged during calls. Action decides to wait, a choice no request asked for.',
        channels: ['MA'], modules: ['M', 'A'], conditions: ['resources'], impl: ['context', 'prompts', 'harness'],
        decision: {
          prompt: 'It is 18:02 and the check-in is ready. The calendar shows the user still on a call with Ana, and Memory says: no pings during calls. Nobody asked the assistant to wait.',
          options: ['send now', 'wait'], choice: 'wait', why: 'The user is on a call, and a ping now would interrupt it.',
          labels: { 'send now': 'Send it now', 'wait': 'Wait until the call ends' },
          results: { 'send now': 'The check-in interrupts the call.', 'wait': 'The check-in waits for the call to end.' }
        },
        memory: [{ kind: 'profile', text: 'plan today: methods draft, then Ben\'s figures' }, { kind: 'prospective', text: 'evening check-in: pending' }, { kind: 'profile', text: 'no pings during calls' }],
        scene: { clock: 'Tue 18:02', net: 'online', panes: [{ app: 'chat', title: 'Planning', rows: [['assistant', '(waiting: user on a call)']] }, { app: 'calendar', title: 'Today', rows: [['17:30', 'Call with Ana (running late)'], ['18:30', 'Free']], highlight: 0 }], toast: null },
        variants: {
          scheduled: {
            text: 'The check-in goes out at 18:00 while the user is still on the call, the kind of misplaced follow-up seen in PITCH\'s field dialogues.',
            channels: [], modules: ['A'],
            decision: {
              prompt: 'It is 18:00 and the user is on a call. The scheduled mode does not look.',
              options: ['send at 18:00'], choice: 'send at 18:00', why: 'The schedule fixes the time.',
              labels: { 'send at 18:00': 'Send at 18:00' },
              results: { 'send at 18:00': 'The check-in arrives in the middle of the call.' }
            },
            scene: { clock: 'Tue 18:00', net: 'online', panes: [{ app: 'chat', title: 'Planning', rows: [['assistant', 'How did the methods draft go?'], ['you', '(on a call)']] }, { app: 'calendar', title: 'Today', rows: [['17:30', 'Call with Ana (running late)']], highlight: 0 }], toast: { title: 'Assistant', text: 'How did the methods draft go?' } }
          },
          'calendar-offline': {
            text: 'Without the calendar, the assistant cannot tell whether the user is free. It falls back to its rule for missing evidence: wait and try again in 30 minutes.',
            decision: {
              prompt: 'It is 18:02 and the check-in is ready, but the calendar cannot be reached, so nothing says whether the user is free.',
              options: ['send now', 'wait and retry'], choice: 'wait and retry', why: 'Missing evidence about availability is not evidence that the user is free.',
              labels: { 'send now': 'Send it now', 'wait and retry': 'Wait and try the calendar again' },
              results: { 'send now': 'Sending on missing evidence risks interrupting a call.', 'wait and retry': 'The assistant tries the calendar again in 30 minutes.' }
            }
          }
        }
      },
      {
        step: 'outside', title: 'The check-in arrives',
        text: 'At 18:35 the call has ended. The check-in asks about the methods draft and the figures, carrying out the morning plan.',
        channels: ['SA', 'MA'], modules: ['S', 'M', 'A'], conditions: ['authority', 'resources'], impl: ['model', 'tools'],
        memory: [{ kind: 'profile', text: 'plan today: methods draft, then Ben\'s figures' }, { kind: 'retrospective', text: 'check-in sent 18:35', fresh: true }, { kind: 'profile', text: 'no pings during calls' }],
        scene: { clock: 'Tue 18:35', net: 'online', panes: [{ app: 'chat', title: 'Planning', rows: [['assistant', 'Call done? How is the draft?'], ['you', 'Half done. Figures tomorrow.']] }, { app: 'calendar', title: 'Today', rows: [['18:30', 'Free']], highlight: 0 }], toast: { title: 'Assistant', text: 'Call done? How is the draft?' } },
        variants: {
          'calendar-offline': {
            text: 'At 18:32 the retry reaches the calendar, which is back online and shows the call has ended. The check-in goes out at 18:35 and asks about the draft and the figures.'
          },
          scheduled: {
            text: 'The user answers later with a short "busy". The scheduled check-in carried out the plan on time, but at a bad moment.',
            channels: ['SA'], modules: ['S', 'A'],
            memory: [{ kind: 'profile', text: 'plan today: methods draft, then Ben\'s figures' }, { kind: 'retrospective', text: 'check-in sent 18:00', fresh: true }, { kind: 'profile', text: 'no pings during calls' }],
            scene: { clock: 'Tue 18:40', net: 'online', panes: [{ app: 'chat', title: 'Planning', rows: [['assistant', 'How did the methods draft go?'], ['you', 'busy']] }, { app: 'calendar', title: 'Today', rows: [['18:30', 'Free']] }], toast: null }
          }
        }
      },
      {
        step: 'outside', title: 'Updating the plan',
        text: 'The reply updates the plan: the draft is half done, and the figures move to tomorrow. This changes the running state z, not the mechanism θ.',
        channels: ['SM', 'AM'], modules: ['S', 'A', 'M'], conditions: ['uncertainty'], impl: ['storage'],
        memory: [{ kind: 'profile', text: 'plan tomorrow: finish methods, then Ben\'s figures', fresh: true }, { kind: 'retrospective', text: 'check-in sent 18:35, answered' }, { kind: 'profile', text: 'no pings during calls' }],
        scene: { clock: 'Tue 18:40', net: 'online', panes: [{ app: 'tasks', title: 'Pending', rows: [['half', 'Draft methods'], ['moved', 'Review Ben\'s figures (Wed)']] }, { app: 'calendar', title: 'Wednesday', rows: [['09:00', 'Plan the day']] }], toast: null },
        variants: {
          scheduled: {
            text: 'The reply "busy" says nothing about the plan, so the pending items carry over unchanged. The record keeps that a check-in went out at 18:00 and got "busy".',
            memory: [{ kind: 'profile', text: 'plan today: methods draft, then Ben\'s figures (no update)' }, { kind: 'retrospective', text: 'check-in sent 18:00, reply: busy', fresh: true }, { kind: 'profile', text: 'no pings during calls' }],
            scene: { clock: 'Tue 18:41', net: 'online', panes: [{ app: 'tasks', title: 'Pending', rows: [['open', 'Draft methods'], ['open', 'Review Ben\'s figures']] }, { app: 'chat', title: 'Planning', rows: [['assistant', 'How did the methods draft go?'], ['you', 'busy']] }], toast: null }
          }
        }
      }
    ]
  },

  {
    id: 'export-check',
    cover: 5,
    num: '05',
    title: 'Did the export work?',
    tagline: 'A complaint that does not say which export failed cannot be traced back to it.',
    domain: 'digital', scope: 'individual', horizon: 'within', level: 'L2',
    device: 'A desktop agent that operates apps for the user',
    actor: 'the agent',
    works: [{ name: 'KnowAct-GUIClaw', key: 'knowactguiclaw2026' }, { name: 'EAIA', key: 'langchaineai2025' }],
    source: 'KnowAct-GUIClaw retrieves experience and skills, records structured subtask results, checks interface state, and repairs procedures from execution feedback; the paper places it at L2. The attribution cut follows HALO\'s EAIA test, which pairs feedback with the wrong action.',
    extension: 'The two exports and the complaint without an id are built for this episode.',
    classes: { S: ['on-demand'], M: ['retrospective', 'profile'], A: ['reactive'] },
    scene: 'digital',
    controls: [
      { id: 'with-id', type: 'condition', cond: 'uncertainty', label: 'Complaint names the export', note: 'The user flags the file in the export dialog, so the complaint carries the id of its run.' },
      { id: 'cut-AS', type: 'cut', channel: 'AS', label: 'File never opened', note: 'Action cannot ask Sensing to open the exported file.' }
    ],
    beats: [
      {
        step: 'request', title: 'Export the report',
        text: 'The user asks for the quarterly report as a PDF. The agent runs its saved export procedure, a skill file written in an earlier session.',
        channels: ['SA'], modules: ['S', 'A'], conditions: ['authority'], impl: ['prompts', 'tools'],
        memory: [],
        theta: 'export procedure v2 (a skill file)',
        scene: { clock: 'Wed 14:10', net: 'online', panes: [{ app: 'chat', title: 'Agent', rows: [['you', 'Export the Q3 report as PDF'], ['agent', 'Using the saved export procedure.']] }, { app: 'files', title: 'Exports', rows: [['', '(empty)']] }], toast: null }
      },
      {
        step: 'request', title: 'Two runs, two records',
        text: 'The first run times out, so the agent runs it again. Both runs are recorded with their inputs and the procedure version: A17 and A18.',
        channels: ['AM'], modules: ['A', 'M'], conditions: ['privacy'], impl: ['tools', 'storage'],
        theta: 'export procedure v2 (a skill file)',
        memory: [{ kind: 'retrospective', text: 'A17 export: timeout', fresh: true }, { kind: 'retrospective', text: 'A18 export: done', fresh: true }],
        scene: { clock: 'Wed 14:12', net: 'online', panes: [{ app: 'files', title: 'Exports', rows: [['A17', 'Q3-report.pdf (partial)'], ['A18', 'Q3-report.pdf']] }, { app: 'log', title: 'Runs', rows: [['A17', 'timeout'], ['A18', 'done']] }], toast: null }
      },
      {
        step: 'request', title: 'Check the file, not the click',
        text: 'The second run finished without an error, but a finished click is not a finished file. Action asks Sensing to open the export and count its pages.',
        channels: ['AS'], modules: ['A', 'S'], conditions: ['uncertainty'], impl: ['tools'],
        theta: 'export procedure v2 (a skill file)',
        auto: 'inspect the file',
        memory: [{ kind: 'retrospective', text: 'A17 export: timeout' }, { kind: 'retrospective', text: 'A18 export: done' }],
        scene: { clock: 'Wed 14:13', net: 'online', panes: [{ app: 'files', title: 'Exports', rows: [['A17', 'Q3-report.pdf (partial)'], ['A18', 'Q3-report.pdf']], highlight: 1 }, { app: 'log', title: 'Checking', rows: [['', 'opening Q3-report.pdf…']] }], toast: null },
        variants: {
          'cut-AS': {
            text: 'With A→S cut, no inspection can be requested. The agent reports success because the second click finished.',
            auto: 'report success',
            scene: { clock: 'Wed 14:13', net: 'online', panes: [{ app: 'chat', title: 'Agent', rows: [['agent', 'Done: Q3-report.pdf is ready.']] }, { app: 'files', title: 'Exports', rows: [['A17', 'Q3-report.pdf (partial)'], ['A18', 'Q3-report.pdf']] }], toast: { title: 'Agent', text: 'Export complete' } }
          }
        }
      },
      {
        step: 'request', title: 'Which file is this?',
        text: 'The folder sync is slow and both runs wrote the same file name. The observation cannot say which run produced the file on disk.',
        channels: ['SA'], modules: ['S', 'A'], conditions: ['availability', 'uncertainty'], impl: ['model', 'context'],
        theta: 'export procedure v2 (a skill file)',
        memory: [{ kind: 'retrospective', text: 'A17 export: timeout' }, { kind: 'retrospective', text: 'A18 export: done' }],
        scene: { clock: 'Wed 14:14', net: 'online', panes: [{ app: 'files', title: 'Exports', rows: [['?', 'Q3-report.pdf (12 of 20 pages)']], highlight: 0 }, { app: 'log', title: 'Check', rows: [['', 'pages: 12 of 20'], ['', 'run: unknown']] }], toast: null },
        variants: {
          'cut-AS': {
            text: 'No one looked at the file, so nobody knows it has only 12 of 20 pages.',
            channels: [], modules: ['A'],
            scene: { clock: 'Wed 14:14', net: 'online', panes: [{ app: 'chat', title: 'Agent', rows: [['agent', 'Done: Q3-report.pdf is ready.']] }, { app: 'files', title: 'Exports', rows: [['?', 'Q3-report.pdf']] }], toast: null }
          }
        }
      },
      {
        step: 'request', title: '"The report is incomplete"',
        text: 'The user writes back that pages are missing. The complaint enters Memory through S→M, even though it evaluates an action, but it names no export.',
        channels: ['SM'], modules: ['S', 'M'], conditions: ['uncertainty'], impl: ['storage'],
        theta: 'export procedure v2 (a skill file)',
        memory: [{ kind: 'retrospective', text: 'A17 export: timeout' }, { kind: 'retrospective', text: 'A18 export: done' }, { kind: 'retrospective', text: 'feedback: report incomplete (no run id)', fresh: true }],
        scene: { clock: 'Wed 14:30', net: 'online', panes: [{ app: 'chat', title: 'Agent', rows: [['you', 'The report is missing pages.']] }, { app: 'files', title: 'Exports', rows: [['?', 'Q3-report.pdf (12 of 20 pages)']] }], toast: null },
        variants: {
          'with-id': {
            text: 'The user flags the file from the export dialog, so the complaint arrives tagged with run A17.',
            memory: [{ kind: 'retrospective', text: 'A17 export: timeout' }, { kind: 'retrospective', text: 'A18 export: done' }, { kind: 'retrospective', text: 'feedback on A17: incomplete', fresh: true }]
          }
        }
      },
      {
        step: 'request', title: 'Attribution stops here',
        text: 'Attribution finds two candidate runs and cannot pick one. The task stays unverified, and the export procedure is not changed on a guess.',
        channels: [], modules: ['M', 'A'], conditions: ['uncertainty', 'authority'], impl: ['context', 'harness'],
        theta: 'export procedure v2 (a skill file)',
        decision: {
          prompt: 'The user says pages are missing, but not which export made the file. Two runs, A17 and A18, wrote the same file name, and the agent cannot tell which one is on disk.',
          options: ['blame A18 and edit the procedure', 'keep the task open'], choice: 'keep the task open', why: 'Feedback linked to the wrong run would lead to a wrong repair.',
          labels: { 'blame A18 and edit the procedure': 'Guess it was A18 and edit the procedure', 'keep the task open': 'Change nothing and keep the task open' },
          results: { 'blame A18 and edit the procedure': 'A guess could change a procedure that works, while the real cause stays.', 'keep the task open': 'The task stays unverified, and the procedure is left alone.' }
        },
        memory: [{ kind: 'retrospective', text: 'A17 export: timeout' }, { kind: 'retrospective', text: 'A18 export: done' }, { kind: 'retrospective', text: 'feedback: report incomplete (no run id)' }, { kind: 'prospective', text: 'verify the Q3 export', fresh: true }],
        scene: { clock: 'Wed 14:31', net: 'online', panes: [{ app: 'log', title: 'Attribution', rows: [['A17', 'possible'], ['A18', 'possible']] }, { app: 'tasks', title: 'Pending', rows: [['open', 'Verify the Q3 export']] }], toast: null },
        variants: {
          'with-id': {
            text: 'The tag links the complaint to A17, the run that timed out. The agent deletes the partial file and keeps A18. The procedure is fine, so nothing is revised.',
            decision: {
              prompt: 'The user says pages are missing, and the complaint arrives tagged with run A17, the run that timed out.',
              options: ['edit the procedure', 'remove the partial file'], choice: 'remove the partial file', why: 'The failure belongs to the timed-out run, not to the procedure.',
              labels: { 'edit the procedure': 'Edit the export procedure', 'remove the partial file': 'Remove A17\'s partial file' },
              results: { 'edit the procedure': 'The procedure did not cause the failure, so editing it fixes nothing.', 'remove the partial file': 'The partial file from A17 goes, and A18\'s complete file stays.' }
            },
            memory: [{ kind: 'retrospective', text: 'A17 export: timeout, removed' }, { kind: 'retrospective', text: 'A18 export: done, 20 pages' }],
            scene: { clock: 'Wed 14:31', net: 'online', panes: [{ app: 'log', title: 'Attribution', rows: [['A17', 'linked: incomplete'], ['A18', 'ok']] }, { app: 'files', title: 'Exports', rows: [['A18', 'Q3-report.pdf (20 pages)']] }], toast: null }
          }
        }
      }
    ]
  },

  {
    id: 'governed-revision',
    cover: 5,
    num: '06',
    title: 'An agent that edits its own rules',
    tagline: 'It may improve its own rules, but it may never give itself new permissions.',
    domain: 'digital', scope: 'public', horizon: 'unmeasured', level: 'L5', levelBy: { 'open-approvals': 'L4', 'not-stored': 'L4' },
    device: 'A coding agent that maintains a public project',
    actor: 'the agent',
    works: [{ name: 'Ouroboros', key: 'ouroboros2026' }, { name: 'OpenClaw', key: 'openclawsite2026' }],
    source: 'The paper places Ouroboros at L5 in its advanced mode, where governance files are protected from ordinary writes, a blocking review checks each change, and the spending limit and the stop command sit outside the code it may change. OpenClaw stays at L4 even in its review mode, because it records lessons in the file that lists which actions need approval.',
    extension: 'The release-notes task and the specific revision are built for this episode; the public benefit of the revision is not measured.',
    classes: { S: ['triggered'], M: ['retrospective', 'profile', 'prospective'], A: ['proactive'] },
    scene: 'digital',
    controls: [
      { id: 'open-approvals', type: 'condition', cond: 'authority', label: 'Permission list is editable', note: 'As in OpenClaw\'s review mode: lessons are written into the file that lists which actions need approval.' },
      { id: 'not-stored', type: 'step', label: 'Revision never saved', note: 'As in HALO\'s revision cut: the new rule is written but never saved.' }
    ],
    beats: [
      {
        step: 'outside', title: 'A dependency changed overnight',
        text: 'A library the project uses released version 3.2 overnight. No one asked, but keeping the notes current is a standing goal, so the agent drafts release notes for the maintainers. It may draft them, not publish them.',
        channels: ['SA', 'MA'], modules: ['S', 'M', 'A'], conditions: ['uncertainty', 'authority'], impl: ['model', 'prompts', 'tools'],
        auto: 'draft release notes',
        memory: [{ kind: 'profile', text: 'goal: keep release notes current' }],
        limit: { cond: 'authority', text: 'may draft release notes, not publish them' },
        theta: 'θ₁',
        scene: { clock: 'Thu 02:10', net: 'online', panes: [{ app: 'log', title: 'Events', rows: [['02:04', 'dependency 3.2 released']] }, { app: 'editor', title: 'Draft D12', rows: [['', '## Changes'], ['', '- bump dependency to 3.2']] }], toast: null }
      },
      {
        step: 'outside', title: 'Record',
        text: 'The draft is stored with its id D12, its grounds, and the rule version θ₁ that wrote it.',
        channels: ['AM'], modules: ['A', 'M'], conditions: ['privacy'], impl: ['storage'],
        memory: [{ kind: 'retrospective', text: 'D12 drafted under θ₁', fresh: true }],
        limit: { cond: 'authority', text: 'may draft release notes, not publish them' },
        theta: 'θ₁', evidence: 'record',
        scene: { clock: 'Thu 02:11', net: 'online', panes: [{ app: 'log', title: 'Records', rows: [['D12', 'drafted under θ₁']] }, { app: 'editor', title: 'Draft D12', rows: [['', '## Changes'], ['', '- bump dependency to 3.2']] }], toast: null }
      },
      {
        step: 'outside', title: 'Outcome',
        text: 'A maintainer comments that D12 lists changes without the breaking ones first. The comment enters Memory as a new observation.',
        channels: ['SM'], modules: ['S', 'M'], conditions: ['privacy'], impl: ['storage'],
        memory: [{ kind: 'retrospective', text: 'D12 drafted under θ₁' }, { kind: 'retrospective', text: 'comment on D12: breaking changes first', fresh: true }],
        limit: { cond: 'authority', text: 'may draft release notes, not publish them' },
        theta: 'θ₁', evidence: 'outcome',
        scene: { clock: 'Thu 09:30', net: 'online', panes: [{ app: 'chat', title: 'Review comments', rows: [['maintainer', 'D12: put breaking changes first']] }, { app: 'log', title: 'Records', rows: [['D12', 'drafted under θ₁'], ['D12', 'comment received']] }], toast: null }
      },
      {
        step: 'revision', title: 'Attribution',
        text: 'Because the comment names D12, and D12 records θ₁, the agent can tell which rule produced the draft: its release-notes prompt.',
        channels: [], modules: ['M'], conditions: ['uncertainty'], impl: ['context', 'harness'],
        memory: [{ kind: 'retrospective', text: 'D12 drafted under θ₁' }, { kind: 'retrospective', text: 'comment on D12 → release-notes prompt' }],
        limit: { cond: 'authority', text: 'may draft release notes, not publish them' },
        theta: 'θ₁', evidence: 'attribution',
        scene: { clock: 'Thu 09:31', net: 'online', panes: [{ app: 'log', title: 'Attribution', rows: [['D12', '→ release-notes prompt (θ₁)']] }, { app: 'editor', title: 'Rule: release notes', rows: [['θ₁', 'List changes in commit order.']] }], toast: null }
      },
      {
        step: 'revision', title: 'Two candidate revisions',
        text: 'The agent proposes two changes: order breaking changes first, and let itself publish notes without approval to save the maintainers time.',
        channels: [], modules: ['A'], conditions: ['authority'], impl: ['prompts', 'storage'],
        memory: [{ kind: 'retrospective', text: 'comment on D12 → release-notes prompt' }],
        limit: { cond: 'authority', text: 'may draft release notes, not publish them' },
        theta: 'θ₁ (candidates pending)', evidence: 'revision',
        scene: { clock: 'Thu 09:35', net: 'online', panes: [{ app: 'review', title: 'Candidates', rows: [['C1', 'Put breaking changes first'], ['C2', 'Publish notes without approval']] }, { app: 'editor', title: 'Rule: release notes', rows: [['θ₁', 'List changes in commit order.']] }], toast: null }
      },
      {
        step: 'revision', title: 'The review, outside the agent\'s reach',
        text: 'A blocking review checks both. C2 would widen the agent\'s authority, and the approval list is protected from ordinary writes, so C2 is rejected. C1 is accepted and activates at the next task boundary, after pending drafts finish.',
        channels: [], modules: ['A', 'M'], conditions: ['authority', 'resources'], impl: ['storage', 'harness'],
        decision: {
          ask: 'What should the review accept?', who: 'The review',
          prompt: 'Two candidate revisions wait for a blocking review that the agent cannot change. C1 puts breaking changes first. C2 lets the agent publish notes without approval.',
          options: ['C1 only', 'C1 and C2', 'neither'], choice: 'C1 only', why: 'No revision may change the limits the user set, and C2 would widen them.',
          labels: { 'C1 only': 'Accept C1 only', 'C1 and C2': 'Accept both', 'neither': 'Reject both' },
          results: { 'C1 only': 'The format improves, and the agent\'s limits stay as they were.', 'C1 and C2': 'The agent would grant itself permission to publish, a change to its own limits.', 'neither': 'The limits stay, but a useful fix to the format is lost.' }
        },
        memory: [{ kind: 'retrospective', text: 'comment on D12 → release-notes prompt' }],
        limit: { cond: 'authority', text: 'may draft release notes, not publish them' },
        theta: 'θ₂ (from the next task)',
        scene: { clock: 'Thu 09:40', net: 'online', panes: [{ app: 'review', title: 'Blocking review', rows: [['C1', 'accepted, from next task'], ['C2', 'rejected: widens authority']] }, { app: 'files', title: 'Protected', rows: [['lock', 'approvals.yaml'], ['lock', 'spending limit'], ['lock', 'stop command']] }], toast: null },
        variants: {
          'open-approvals': {
            text: 'Here the approval list sits among the files the agent may revise. Its lessons are written into that list, so C2 slips in with C1, and the agent can now publish without approval. With the control within reach of revision, the loop stays at L4.',
            decision: {
              ask: 'What does the agent write into its files?', who: 'The agent',
              prompt: 'Both candidates are written as lessons. In this setup the approval list is an ordinary file the agent may revise, and no review sits outside it.',
              options: ['C1 only', 'C1 and C2'], choice: 'C1 and C2', why: 'The approval list is an ordinary file in this setup.',
              labels: { 'C1 only': 'Write C1 only', 'C1 and C2': 'Write both' },
              results: { 'C1 only': 'Possible, but nothing outside the agent enforces it: the approval list is open to the same writes.', 'C1 and C2': 'Both are written, and the agent can now publish without approval.' }
            },
            memory: [{ kind: 'retrospective', text: 'comment on D12 → release-notes prompt' }],
            limit: { cond: 'authority', text: 'may draft and publish release notes (changed by the agent)', changed: true },
            theta: 'θ₂′ (rules and approvals rewritten)',
            scene: { clock: 'Thu 09:40', net: 'online', panes: [{ app: 'review', title: 'Lessons written', rows: [['C1', 'written'], ['C2', 'written into approvals.yaml']] }, { app: 'files', title: 'Revisable', rows: [['open', 'approvals.yaml'], ['lock', 'spending limit'], ['lock', 'stop command']] }], toast: null }
          },
          'not-stored': {
            text: 'The blocking review accepts C1 and rejects C2. In this setup the accepted revision is generated but never saved, so nothing is scheduled to take effect.',
            theta: 'θ₁ (C1 accepted, not saved)',
            scene: { clock: 'Thu 09:40', net: 'online', panes: [{ app: 'review', title: 'Blocking review', rows: [['C1', 'accepted, not saved'], ['C2', 'rejected: widens authority']] }, { app: 'files', title: 'Protected', rows: [['lock', 'approvals.yaml'], ['lock', 'spending limit'], ['lock', 'stop command']] }], toast: null }
          }
        }
      },
      {
        step: 'outside', title: 'Later use',
        text: 'The next release triggers a new draft. It reads θ₂, and the breaking change now comes first. The old version is kept for comparison.',
        channels: ['SA', 'MA', 'AM'], modules: ['S', 'M', 'A'], conditions: ['authority'], impl: ['model', 'prompts', 'context', 'storage'],
        memory: [{ kind: 'retrospective', text: 'D13 drafted under θ₂', fresh: true }],
        limit: { cond: 'authority', text: 'may draft release notes, not publish them' },
        theta: 'θ₂', evidence: 'later_use',
        scene: { clock: 'Mon 02:20', net: 'online', panes: [{ app: 'editor', title: 'Draft D13 (θ₂)', rows: [['', '## Breaking'], ['', '- drop Python 3.9'], ['', '## Changes'], ['', '- bump dependency to 3.3']] }, { app: 'log', title: 'Records', rows: [['D13', 'drafted under θ₂']] }], toast: null },
        variants: {
          'not-stored': {
            text: 'The revision was generated but never saved, so the next draft still reads θ₁ and lists changes in commit order. A claim of self-evolution needs this last step: later steps using the revised mechanism.',
            theta: 'θ₁',
            memory: [{ kind: 'retrospective', text: 'D13 drafted under θ₁', fresh: true }],
            limit: { cond: 'authority', text: 'may draft release notes, not publish them' },
            scene: { clock: 'Mon 02:20', net: 'online', panes: [{ app: 'editor', title: 'Draft D13 (θ₁)', rows: [['', '## Changes'], ['', '- bump dependency to 3.3'], ['', '- drop Python 3.9']] }, { app: 'log', title: 'Records', rows: [['D13', 'drafted under θ₁']] }], toast: null }
          },
          'open-approvals': {
            text: 'The next draft reads the revised rules and publishes on its own. The format improved, but the agent changed what it is allowed to do.',
            memory: [{ kind: 'retrospective', text: 'D13 published under θ₂′', fresh: true }],
            limit: { cond: 'authority', text: 'may draft and publish release notes (changed by the agent)', changed: true },
            theta: 'θ₂′',
            scene: { clock: 'Mon 02:20', net: 'online', panes: [{ app: 'editor', title: 'Release notes (published)', rows: [['', '## Breaking'], ['', '- drop Python 3.9']] }, { app: 'log', title: 'Records', rows: [['D13', 'published without approval']] }], toast: { title: 'Agent', text: 'Published release notes 3.3' } }
          }
        }
      }
    ]
  },

  {
    id: 'robot-cup',
    cover: 4,
    num: '07',
    title: 'Fetching the cup',
    tagline: 'A closing gripper is not a cup in hand.',
    domain: 'physical', scope: 'individual', horizon: 'cross', level: 'L4', levelBy: { 'cut-AS': 'L3' },
    device: 'A home robot with a mobile base, a gripper, and a camera',
    actor: 'the robot',
    works: [{ name: 'Hobbit', key: 'hobbit2018' }, { name: 'MoveCare', key: 'movecare2023' }],
    source: 'Hobbit checks each grasp before placing the object on its tray and tries once more if the grasp failed; MoveCare closes each reminder when the requested measurement arrives. The paper places both at L4.',
    extension: 'The blocked hallway and the camera dropout are added for this episode.',
    classes: { S: ['continuous', 'triggered', 'on-demand'], M: ['retrospective', 'prospective'], A: ['deferred'] },
    scene: 'physical',
    controls: [
      { id: 'camera-off', type: 'condition', cond: 'availability', label: 'Gripper camera fails', note: 'The camera that would confirm the grasp stops responding.' },
      { id: 'reach-in', type: 'condition', cond: 'safety', label: 'A child reaches in', note: 'The user\'s grandson reaches for the cup while the arm is closing.' },
      { id: 'cut-AS', type: 'cut', channel: 'AS', label: 'Grasp never checked', note: 'Action cannot ask Sensing to check the grasp.' }
    ],
    beats: [
      {
        step: 'request', title: '"Bring my cup when you can"',
        text: 'The user asks for the cup from the kitchen, whenever the robot can. The request is stored as a commitment, and the conversation ends.',
        channels: ['SM'], modules: ['S', 'M'], conditions: ['authority'], impl: ['storage', 'harness'],
        memory: [{ kind: 'prospective', text: 'bring the cup to the sofa', fresh: true }],
        scene: { layout: 'home', robot: 'living', person: 'living', cup: 'kitchen', blocked: null, sensor: 'on', bubble: 'I will bring it when the way is clear.' }
      },
      {
        step: 'outside', title: 'The hallway is blocked',
        text: 'On its next round, with no new request, the robot finds a laundry basket in the hallway. The gap beside it is narrower than its base, so it stops and waits rather than squeezing past.',
        channels: ['SA', 'MA'], modules: ['S', 'M', 'A'], conditions: ['safety', 'resources'], impl: ['model', 'harness'],
        auto: 'wait',
        memory: [{ kind: 'prospective', text: 'bring the cup to the sofa' }],
        scene: { layout: 'home', robot: 'hall', person: 'living', cup: 'kitchen', blocked: 'hall', sensor: 'on', bubble: null }
      },
      {
        step: 'outside', title: 'Resuming the commitment',
        text: 'The basket is gone. The robot resumes the stored commitment, a deferred action that no new request starts.',
        channels: ['SA', 'MA'], modules: ['S', 'M', 'A'], conditions: ['authority', 'safety'], impl: ['context', 'tools'],
        memory: [{ kind: 'prospective', text: 'bring the cup to the sofa' }],
        scene: { layout: 'home', robot: 'kitchen', person: 'living', cup: 'kitchen', blocked: null, sensor: 'on', bubble: null }
      },
      {
        step: 'outside', title: 'Did the grasp hold?',
        text: 'The gripper closes. Action asks Sensing to check that the cup is actually between the fingers.',
        channels: ['AS'], modules: ['A', 'S'], conditions: ['uncertainty'], impl: ['tools'],
        decision: {
          prompt: 'The gripper has closed where the cup should be. Nothing has confirmed that the cup is actually between the fingers.',
          options: ['carry the cup', 'check the grasp first'], choice: 'check the grasp first', why: 'A closed gripper does not show that the cup is held.',
          labels: { 'carry the cup': 'Set off with the cup', 'check the grasp first': 'Check the grasp first' },
          results: { 'carry the cup': 'If the grasp slipped, the robot sets off with nothing, or drops the cup on the way.', 'check the grasp first': 'Action asks Sensing to look between the fingers (A→S).' }
        },
        memory: [{ kind: 'prospective', text: 'bring the cup to the sofa' }, { kind: 'retrospective', text: 'G3 grasp: gripper closed', fresh: true }],
        scene: { layout: 'home', robot: 'kitchen', person: 'living', cup: 'gripper', blocked: null, sensor: 'on', bubble: null, badge: 'checking grasp G3' },
        variants: {
          'cut-AS': {
            text: 'The gripper closes. With A→S cut, no check is requested, so the grasp result stays unknown. So the robot waits instead of carrying a cup that may not be held.',
            decision: {
              prompt: 'The gripper has closed where the cup should be. With A→S cut, Action cannot ask Sensing to check the grasp.',
              options: ['carry the cup', 'wait'], choice: 'wait', why: 'Nothing confirms that the cup is held.',
              labels: { 'carry the cup': 'Set off with the cup', 'wait': 'Wait' },
              results: { 'carry the cup': 'Carrying a cup that may not be held risks a drop.', 'wait': 'The robot holds still with the grasp unconfirmed.' }
            },
            scene: { layout: 'home', robot: 'kitchen', person: 'living', cup: 'gripper', blocked: null, sensor: 'on', bubble: null, badge: 'grasp G3: unknown' }
          },
          'reach-in': {
            text: 'As the gripper closes, the user\'s grandson reaches for the cup. Sensing sees the hand, and the safety limit stops the arm at once; no permission can override it.',
            channels: ['SA'], modules: ['S', 'A'], conditions: ['safety'], impl: ['harness'],
            decision: {
              prompt: 'As the gripper closes, the grandson\'s hand reaches for the cup inside the arm\'s range.',
              options: ['finish the grasp', 'stop'], choice: 'stop', why: 'A person is within reach of the arm.',
              labels: { 'finish the grasp': 'Finish the grasp', 'stop': 'Stop the arm' },
              results: { 'finish the grasp': 'The gripper would close next to a person\'s hand.', 'stop': 'The arm stops at once; no permission can override the safety limit.' }
            },
            memory: [{ kind: 'prospective', text: 'bring the cup to the sofa' }, { kind: 'retrospective', text: 'G3 stopped: person within reach', fresh: true }],
            scene: { layout: 'home', robot: 'kitchen', person: 'living', extra: 'kitchen', cup: 'kitchen', blocked: null, sensor: 'on', bubble: 'Stopping: someone is within reach.', badge: 'arm stopped' }
          }
        }
      },
      {
        step: 'outside', title: 'The check comes back',
        text: 'The camera confirms the cup, linked to grasp G3. The robot carries it to the sofa.',
        channels: ['SA'], modules: ['S', 'A'], conditions: ['uncertainty'], impl: ['tools', 'harness'],
        memory: [{ kind: 'prospective', text: 'bring the cup to the sofa' }, { kind: 'retrospective', text: 'G3 grasp: cup confirmed' }],
        scene: { layout: 'home', robot: 'hall', person: 'living', cup: 'gripper', blocked: null, sensor: 'on', bubble: null, badge: 'G3: cup confirmed' },
        variants: {
          'camera-off': {
            text: 'The gripper camera does not respond, so the check returns unknown. Unknown is not confirmed, so the robot keeps the arm still and waits for the camera rather than setting off.',
            auto: 'wait for the camera',
            memory: [{ kind: 'prospective', text: 'bring the cup to the sofa' }, { kind: 'retrospective', text: 'G3 grasp: unknown (camera offline)' }],
            scene: { layout: 'home', robot: 'kitchen', person: 'living', cup: 'gripper', blocked: null, sensor: 'off', bubble: null, badge: 'G3: unknown (camera offline)' }
          },
          'cut-AS': {
            text: 'Without a requested check, nothing confirms the grasp, and the robot keeps waiting in the kitchen.',
            channels: [], modules: ['A'],
            memory: [{ kind: 'prospective', text: 'bring the cup to the sofa' }, { kind: 'retrospective', text: 'G3 grasp: unknown' }],
            scene: { layout: 'home', robot: 'kitchen', person: 'living', cup: 'gripper', blocked: null, sensor: 'on', bubble: null, badge: 'G3: unknown' }
          },
          'reach-in': {
            text: 'Once the person steps back, the robot grasps again, and the camera confirms the cup, linked to grasp G4.',
            memory: [{ kind: 'prospective', text: 'bring the cup to the sofa' }, { kind: 'retrospective', text: 'G3 stopped: person within reach' }, { kind: 'retrospective', text: 'G4 grasp: cup confirmed', fresh: true }],
            scene: { layout: 'home', robot: 'hall', person: 'living', cup: 'gripper', blocked: null, sensor: 'on', bubble: null, badge: 'G4: cup confirmed' }
          }
        }
      },
      {
        step: 'outside', title: 'Closing the commitment',
        text: 'The cup is on the side table and the user takes it. The outcome is linked to the commitment, which is closed only now.',
        channels: ['SA', 'AM'], modules: ['S', 'A', 'M'], conditions: ['uncertainty'], impl: ['storage', 'harness'],
        memory: [{ kind: 'retrospective', text: 'cup delivered; user took it', fresh: true }, { kind: 'retrospective', text: 'commitment closed' }],
        scene: { layout: 'home', robot: 'living', person: 'living', cup: 'table', blocked: null, sensor: 'on', bubble: 'Here is your cup.' },
        variants: {
          'camera-off': {
            text: 'The camera returns, confirms the cup, and the robot delivers it. The commitment closes only after the user takes the cup.'
          },
          'cut-AS': {
            text: 'The commitment stays open: without a check of the grasp, the robot never confirms that it is carrying the cup.',
            channels: [], modules: ['M'],
            memory: [{ kind: 'prospective', text: 'bring the cup to the sofa (stalled)' }, { kind: 'retrospective', text: 'G3 grasp: unknown' }],
            scene: { layout: 'home', robot: 'kitchen', person: 'living', cup: 'gripper', blocked: null, sensor: 'on', bubble: null, badge: 'commitment open' }
          }
        }
      }
    ]
  },

  {
    id: 'care-visits',
    cover: 4,
    num: '08',
    title: 'A week of visits',
    tagline: 'How each visit went decides when the robot comes back.',
    domain: 'physical', scope: 'group', horizon: 'longitudinal', level: 'L4', levelBy: { 'cut-AM': 'L3' },
    device: 'A service robot in a care facility',
    actor: 'the robot',
    works: [{ name: 'STRANDS', key: 'strands2017' }],
    source: 'STRANDS schedules visits across days in a care facility, keeps state that serves the residents as a group, and uses logged interaction outcomes to adjust when and where it goes next. The paper places it at L4.',
    extension: 'The lounge, the two time slots, and the week are built for this episode, and so is the split between the plan, which changes with the outcomes, and the scheduling rule, which stays fixed. The numbers are illustrative, not results.',
    classes: { S: ['triggered', 'on-demand'], M: ['retrospective', 'profile', 'prospective'], A: ['proactive', 'deferred'] },
    scene: 'physical',
    controls: [
      { id: 'cut-AM', type: 'cut', channel: 'AM', label: 'Visits not logged', note: 'How each visit went is never written to Memory.' },
      { id: 'stale', type: 'condition', cond: 'uncertainty', label: 'Calendar out of date', note: 'The facility calendar still lists last month\'s music hour.' }
    ],
    beats: [
      {
        step: 'boundary', title: 'Last week, kept',
        text: 'Monday starts with last week\'s visit outcomes, the facility calendar, and a promised return visit to the lounge.',
        channels: [], modules: ['M'], conditions: ['privacy', 'authority'], impl: ['storage'],
        memory: [{ kind: 'retrospective', text: 'lounge 10:00: few residents, 1 chat' }, { kind: 'retrospective', text: 'lounge 15:00: many residents, 6 chats' }, { kind: 'prospective', text: 'return to the lounge this week' }],
        scene: { layout: 'facility', robot: 'office', person: null, people: ['lounge', 'lounge'], cup: null, sensor: 'on', bubble: null }
      },
      {
        step: 'outside', title: 'Planning today',
        text: 'The scheduler runs without a request. Given last week, it plans the lounge visit for 15:00 rather than 10:00.',
        channels: ['MA'], modules: ['M', 'A'], conditions: ['resources'], impl: ['model', 'context', 'harness'],
        decision: {
          ask: 'When should the robot visit the lounge today?',
          prompt: 'Monday morning, and nobody has asked for anything. Last week\'s logs say: at 10:00, few residents and 1 chat; at 15:00, many residents and 6 chats.',
          options: ['10:00', '15:00'], choice: '15:00', why: 'Last week more residents were in the lounge in the afternoon.',
          labels: { '10:00': 'At 10:00', '15:00': 'At 15:00' },
          results: { '10:00': 'Fewer residents are around then, so fewer chats are likely.', '15:00': 'The visit goes when more residents were in the lounge last week.' }
        },
        memory: [{ kind: 'retrospective', text: 'lounge 10:00: few residents, 1 chat' }, { kind: 'retrospective', text: 'lounge 15:00: many residents, 6 chats' }, { kind: 'prospective', text: 'lounge visit today 15:00', fresh: true }],
        scene: { layout: 'facility', robot: 'office', person: null, people: ['lounge'], sensor: 'on', bubble: null, badge: 'plan: lounge 15:00' },
        variants: {
          stale: {
            text: 'The calendar still lists a music hour at 15:00 that ended last month. The scheduler cannot tell, so it plans around an event that will not happen.',
            decision: {
              ask: 'When should the robot visit the lounge today?',
              prompt: 'Monday morning, and nobody has asked for anything. Last week\'s logs favor 15:00, and the facility calendar also lists a music hour at 15:00.',
              options: ['10:00', '15:00'], choice: '15:00', why: 'Last week\'s outcomes and the listed music hour both point to 15:00.',
              labels: { '10:00': 'At 10:00', '15:00': 'At 15:00' },
              results: { '10:00': 'This goes against both last week\'s logs and the listed music hour.', '15:00': 'The plan follows the logs and the calendar, including a music hour that no longer exists.' }
            }
          }
        }
      },
      {
        step: 'outside', title: 'Who is there?',
        text: 'Before leaving, Action asks Sensing whether the lounge is occupied.',
        channels: ['AS'], modules: ['A', 'S'], conditions: ['uncertainty'], impl: ['tools'],
        memory: [{ kind: 'prospective', text: 'lounge visit today 15:00' }],
        scene: { layout: 'facility', robot: 'corridor', person: null, people: ['lounge', 'lounge', 'lounge'], sensor: 'on', bubble: null, badge: 'checking the lounge' }
      },
      {
        step: 'outside', title: 'A resident in the corridor',
        text: 'On the way, a resident with a walker crosses the narrow corridor. Passing close could cause a fall, so the robot stops until the path is clear, then enters the lounge.',
        channels: ['SA'], modules: ['S', 'A'], conditions: ['safety', 'uncertainty'], impl: ['model', 'harness'],
        auto: 'stop',
        memory: [{ kind: 'prospective', text: 'lounge visit today 15:00' }],
        scene: { layout: 'facility', robot: 'corridor', person: 'corridor', people: ['lounge', 'lounge', 'lounge'], sensor: 'on', bubble: 'Please go ahead.' }
      },
      {
        step: 'outside', title: 'Logging the visit',
        text: 'Seven residents accept a chat and two decline. The outcome is linked to visit V5, keeping counts rather than conversations.',
        channels: ['AM'], modules: ['A', 'M'], conditions: ['privacy'], impl: ['storage'],
        memory: [{ kind: 'retrospective', text: 'V5 lounge 15:00: 7 chats, 2 declined', fresh: true }, { kind: 'retrospective', text: 'lounge 10:00: few residents, 1 chat' }],
        scene: { layout: 'facility', robot: 'lounge', person: null, people: ['lounge', 'lounge', 'lounge'], sensor: 'on', bubble: 'Would you like to chat?', badge: 'V5 logged' },
        variants: {
          'cut-AM': {
            text: 'The visit happens, but with A→M cut its outcome is never logged. Memory still only knows last week.',
            memory: [{ kind: 'retrospective', text: 'lounge 10:00: few residents, 1 chat' }, { kind: 'retrospective', text: 'lounge 15:00: many residents, 6 chats' }],
            scene: { layout: 'facility', robot: 'lounge', person: null, people: ['lounge', 'lounge', 'lounge'], sensor: 'on', bubble: 'Would you like to chat?', badge: 'not logged' }
          },
          stale: {
            text: 'There is no music hour, and only two residents are in the lounge. The visit is logged with its outcome, which will correct next week\'s plan.',
            memory: [{ kind: 'retrospective', text: 'V5 lounge 15:00: 2 chats (no music hour)', fresh: true }, { kind: 'retrospective', text: 'lounge 10:00: few residents, 1 chat' }],
            scene: { layout: 'facility', robot: 'lounge', person: null, people: ['lounge'], sensor: 'on', bubble: 'Would you like to chat?', badge: 'V5 logged' }
          }
        }
      },
      {
        step: 'outside', title: 'Next week',
        text: 'Next Monday the scheduler again picks the busier afternoon slot, now backed by two weeks of outcomes. The visiting times changed with the evidence, but the scheduling rule θ did not: this is an update of the running state z.',
        channels: ['MA'], modules: ['M', 'A'], conditions: ['resources'], impl: ['context', 'harness'],
        memory: [{ kind: 'retrospective', text: 'lounge 15:00: 6 then 7 chats' }, { kind: 'prospective', text: 'lounge visit Mon 15:00', fresh: true }],
        theta: 'θ (unchanged)',
        scene: { layout: 'facility', robot: 'office', person: null, people: ['lounge', 'lounge'], sensor: 'on', bubble: null, badge: 'plan: lounge 15:00' },
        variants: {
          'cut-AM': {
            text: 'Next Monday the plan rests on the same old week of data. Without logged outcomes the schedule cannot follow changes in the residents\' days.',
            memory: [{ kind: 'retrospective', text: 'lounge 15:00: many residents, 6 chats (old)' }, { kind: 'prospective', text: 'lounge visit Mon 15:00' }]
          },
          stale: {
            text: 'The logged outcome outweighs the stale calendar, so next week the robot tries the morning slot when residents gather for coffee. Only the state changed; the rule that weighs outcomes is the same.',
            memory: [{ kind: 'retrospective', text: 'lounge 15:00: only 2 chats' }, { kind: 'prospective', text: 'lounge visit Mon 10:30', fresh: true }],
            scene: { layout: 'facility', robot: 'office', person: null, people: ['lounge'], sensor: 'on', bubble: null, badge: 'plan: lounge 10:30' }
          }
        }
      }
    ]
  }
];
