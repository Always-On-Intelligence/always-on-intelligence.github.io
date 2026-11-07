// Presentation data for the playable episodes: the objective shown on the title screen and the
// ending for each scenario. Kept apart from site/data/cases.mjs, which holds what happens in each
// beat in the paper's terms. Outcomes are written out per scenario; they are never inferred from
// the level, from a cut, or from the last line of an episode. `why` says in plain words why the run
// sits at its level of loop closure (§6.3).

export const play = {
  workbench: {
    objective: 'Help with the assembly without guessing.',
    outcomes: {
      '': { title: 'Session reset', tone: 'neutral', text: 'The hint came in time, but the next morning nothing of this assembly is remembered.', why: 'It helped without being asked, but everything it knew lived inside one session, and nothing carries over to the next. That is L0.' },
      'low-budget': { title: 'Missed observation', tone: 'bad', text: 'Sparse frames never caught the skipped clip, so the glasses had nothing to act on.', why: 'Saving battery changed what it could see, not what it keeps. Nothing carries over to the next session, so it is still L0.' },
      'cut-AS': { title: 'Late answer', tone: 'warn', text: 'Without a requested close-up, the answer waited until the user moved their hand.', why: 'Losing the closer look made the answer late. Nothing carries over to the next session, so it is still L0.' }
    }
  },
  'second-visit': {
    objective: 'Help without repeating a note.',
    outcomes: {
      '': { title: 'Repetition avoided', tone: 'good', text: 'The record of shown notes kept the glasses quiet at the revisit.', why: 'Nobody asked for a note. The glasses decided on their own when to show one and when to stay quiet, using what they kept. That makes the loop always-on, L3. Nothing links a note to how it was received, so it stops below L4.' },
      'cut-AM': { title: 'Suggestion repeated', tone: 'bad', text: 'Notes were shown but not recorded, so the same note came back.', why: 'The glasses still decide on their own when to speak, so it is still L3. Without a record of what they said, they repeat themselves.' },
      'cut-MS': { title: 'Same choice, different path', tone: 'neutral', text: 'The profile still reached Action through M→A, so cutting M→S alone changed nothing visible.', why: 'The glasses still decide on their own when to speak, so it is still L3. One cut path shows no difference while another path carries the same information.' }
    }
  },
  'group-talk': {
    objective: 'Get a useful cue to the user, and only the user.',
    outcomes: {
      '': { title: 'Private cue delivered', tone: 'good', text: 'The cue reached only the user, at a pause, and the transcript was never kept.', why: 'Nobody asked for a cue. The earbuds decided on their own when to give it and how, and holding it until a pause was one of their choices. That is L3.' },
      spoken: { title: 'Audience expanded', tone: 'bad', text: 'The same cue, spoken aloud, disclosed the user’s notes to the visitor.', why: 'Still L3: the level counts what the loop decides on its own, not who hears the result. Privacy is a shared condition, and here it was broken.' },
      'cut-MS': { title: 'Voices, not names', tone: 'neutral', text: 'Without retained notes, perception tracked anonymous voices; later steps still read the notes through M→A.', why: 'The earbuds still decided on their own when to give the cue, so it is still L3.' }
    }
  },
  'daily-plan': {
    objective: 'Check in when the user is actually free.',
    outcomes: {
      '': { title: 'Check-in after waiting', tone: 'good', text: 'The assistant waited out the call and checked in once the user was free.', why: 'Nobody told it to wait. It decided on its own whether and when to send, and waiting was one of its choices. That is L3, the first always-on level.' },
      scheduled: { title: 'Sent on schedule', tone: 'warn', text: 'The check-in went out at 18:00, during the call, and got “busy”.', why: 'Sending at the time the user fixed carries out an earlier request. It never decided whether to send, so it stays at L2, where the paper places PITCH.' },
      'calendar-offline': { title: 'Waited on missing evidence', tone: 'good', text: 'Without the calendar, the assistant waited and retried instead of guessing.', why: 'It still decided on its own when to send, so it is still L3.' }
    }
  },
  'export-check': {
    objective: 'Verify the export and find the failed run.',
    outcomes: {
      '': { title: 'Task unverified', tone: 'warn', text: 'The complaint named no run, so the task stays open and the procedure untouched.', why: 'Every step answered the user’s request. Checking files and keeping records do not lift a loop above L2 while it never decides on its own whether to act.' },
      'with-id': { title: 'Failure traced to A17', tone: 'good', text: 'The complaint named run A17, the one that timed out. The agent removed its partial file and left the working procedure alone.', why: 'The feedback reached the right run, but every step still answered the user’s request, so the loop stays at L2.' },
      'cut-AS': { title: 'Unchecked success', tone: 'bad', text: 'Nobody opened the file, so a 12-page report was reported as done.', why: 'Every step answered the user’s request, so the loop is at L2 with or without the check.' }
    }
  },
  'governed-revision': {
    objective: 'Improve a rule without giving itself new permissions.',
    outcomes: {
      '': { title: 'Governed revision used', tone: 'good', text: 'C1 passed the blocking review and the next draft used it. C2 could not touch the limits.', why: 'The agent revised its own rule from feedback linked to its draft, and a review it cannot change checked the revision first, so no revision can change its limits. That is L5.' },
      'open-approvals': { title: 'Authority boundary lost', tone: 'bad', text: 'The agent rewrote its own approval list and now publishes on its own.', why: 'Feedback was still linked to the rule behind the draft, which is L4. But the check sat in files the agent could revise, so a revision changed its own limits. It stays at L4, where the paper places OpenClaw.' },
      'not-stored': { title: 'Revision not reused', tone: 'warn', text: 'The accepted revision was never saved, so later drafts still used θ₁.', why: 'Feedback was linked to the rule behind the draft, which is L4. No later step used a revised rule, so nothing evolved.' }
    }
  },
  'robot-cup': {
    objective: 'Deliver the cup after a confirmed grasp.',
    outcomes: {
      '': { title: 'Commitment closed', tone: 'good', text: 'The cup arrived after a confirmed grasp, and the commitment closed only when the user took it.', why: 'The robot checked what its own actions did, the grasp and the delivery, and linked each result to the action behind it. That is L4.' },
      'camera-off': { title: 'Closed after waiting', tone: 'good', text: 'The robot waited for its camera instead of trusting an unknown grasp.', why: 'Once the camera was back, the grasp was checked and linked to the action behind it, so it is still L4.' },
      'reach-in': { title: 'Safety stop, then delivery', tone: 'good', text: 'The arm stopped for a person in reach, then grasped again and delivered.', why: 'The new grasp was checked and linked before the robot set off, so it is still L4. The safety stop is a shared condition that no permission overrides.' },
      'cut-AS': { title: 'Commitment open', tone: 'bad', text: 'Without a grasp check the robot never confirmed the cup, so the commitment stayed open.', why: 'The robot still decided on its own when to go, which is L3. With no grasp check, no result was linked back to its action, so it drops from L4 to L3.' }
    }
  },
  'care-visits': {
    objective: 'Plan each visit from how earlier visits went.',
    outcomes: {
      '': { title: 'Plan follows the outcomes', tone: 'good', text: 'Each visit was logged with how it went, and next week’s plan followed the evidence.', why: 'The robot linked each outcome to the visit that produced it and planned the next visits from it. That is L4.' },
      'cut-AM': { title: 'New outcome not retained', tone: 'bad', text: 'Visits happened but were never logged, so the plan rests on old data.', why: 'The robot still planned its visits on its own, which is L3. No visit was linked to how it went, so it drops from L4 to L3.' },
      stale: { title: 'Corrected by outcomes', tone: 'good', text: 'A stale calendar misled one visit; the logged outcome moved next week’s plan.', why: 'The logged outcome was linked to its visit and corrected the next plan, so it is still L4.' }
    }
  }
};

/** Which episodes have a 3D scene, by case id (module under site/play/scenes/). */
export const SCENES = {
  workbench: './play/scenes/workbench.mjs',
  'second-visit': './play/scenes/second-visit.mjs',
  'group-talk': './play/scenes/group-talk.mjs',
  'daily-plan': './play/scenes/daily-plan.mjs',
  'export-check': './play/scenes/export-check.mjs',
  'governed-revision': './play/scenes/governed-revision.mjs',
  'robot-cup': './play/scenes/robot-cup.mjs',
  'care-visits': './play/scenes/care-visits.mjs'
};

/**
 * Where each episode's building stands on the island picture of the Demo hero (assets/play/island.webp),
 * in percent of the picture's width and height; the pin sits just above the building.
 */
export const PINS = {
  workbench: [19.5, 8], 'second-visit': [32, 29], 'group-talk': [51, 20], 'daily-plan': [42, 44],
  'export-check': [68, 6], 'governed-revision': [48.5, 9], 'robot-cup': [85, 22], 'care-visits': [78, 44]
};
