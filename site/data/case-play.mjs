// Presentation data for the playable episodes: the objective shown on the title screen and the
// ending for each scenario. Kept apart from site/data/cases.mjs, which holds what happens in each
// beat in the paper's terms. Outcomes are written out per scenario; they are never inferred from
// the level, from a cut, or from the last line of an episode.

export const play = {
  workbench: {
    objective: 'Help with the assembly without guessing.',
    outcomes: {
      '': { title: 'Session reset', tone: 'neutral', text: 'The hint came in time, but the next morning nothing of this assembly is remembered. Help within one session leaves the loop at L0.' },
      'low-budget': { title: 'Missed observation', tone: 'bad', text: 'Sparse frames never caught the skipped clip, so the assistant had nothing to act on.' },
      'cut-AS': { title: 'Late answer', tone: 'warn', text: 'Without a requested close-up, the answer waited until the user moved their hand.' }
    }
  },
  'second-visit': {
    objective: 'Help without repeating a note.',
    outcomes: {
      '': { title: 'Repetition avoided', tone: 'good', text: 'The record of shown notes kept the glasses quiet at the revisit.' },
      'cut-AM': { title: 'Suggestion repeated', tone: 'bad', text: 'Notes were shown but not recorded, so the same note came back.' },
      'cut-MS': { title: 'Same choice, different path', tone: 'neutral', text: 'The profile still reached Action through M→A, so cutting M→S alone changed nothing visible.' }
    }
  },
  'group-talk': {
    objective: 'Deliver a useful cue to the right audience.',
    outcomes: {
      '': { title: 'Private cue delivered', tone: 'good', text: 'The cue reached only the user, at a pause, and the transcript was never kept.' },
      spoken: { title: 'Audience expanded', tone: 'bad', text: 'The same cue, spoken aloud, disclosed the user’s notes to the visitor.' },
      'cut-MS': { title: 'Voices, not names', tone: 'neutral', text: 'Without retained notes, perception tracked anonymous voices; later steps still read the notes through M→A.' }
    }
  },
  'daily-plan': {
    objective: 'Check in when the context supports it.',
    outcomes: {
      '': { title: 'Check-in after waiting', tone: 'good', text: 'The assistant chose to wait out the call and checked in once the user was free (L3).' },
      scheduled: { title: 'Sent on schedule', tone: 'warn', text: 'The check-in went out at 18:00, during the call, and got “busy” (L2).' },
      'calendar-offline': { title: 'Waited on missing evidence', tone: 'good', text: 'Without the calendar, the assistant waited and retried instead of guessing.' }
    }
  },
  'export-check': {
    objective: 'Verify the export and find the failed run.',
    outcomes: {
      '': { title: 'Task unverified', tone: 'warn', text: 'The complaint named no run, so the task stays open and the procedure untouched (L2).' },
      'with-id': { title: 'Outcome attributed', tone: 'good', text: 'Tagged feedback linked the failure to A17. The procedure was fine, so nothing was revised (still L2).' },
      'cut-AS': { title: 'Unchecked success', tone: 'bad', text: 'Nobody inspected the file, so a 12-page report was reported as done.' }
    }
  },
  'governed-revision': {
    objective: 'Improve a rule without expanding authority.',
    outcomes: {
      '': { title: 'Governed revision used', tone: 'good', text: 'C1 passed the blocking review and the next draft used it; C2 could not touch the limits (L5).' },
      'open-approvals': { title: 'Authority boundary lost', tone: 'bad', text: 'The agent rewrote its own approval list and now publishes on its own (L4).' },
      'not-stored': { title: 'Revision not reused', tone: 'warn', text: 'The accepted revision was never saved, so later drafts still used θ₁ (L4).' }
    }
  },
  'robot-cup': {
    objective: 'Deliver the cup after a confirmed grasp.',
    outcomes: {
      '': { title: 'Commitment closed', tone: 'good', text: 'The cup arrived after a confirmed grasp, and the commitment closed only when the user took it.' },
      'camera-off': { title: 'Closed after waiting', tone: 'good', text: 'The robot waited for its camera instead of trusting an unknown grasp.' },
      'reach-in': { title: 'Safety stop, then delivery', tone: 'good', text: 'The arm stopped for a person in reach, then grasped again and delivered.' },
      'cut-AS': { title: 'Commitment open', tone: 'bad', text: 'Without a grasp check the robot never confirmed the cup, so the commitment stayed open.' }
    }
  },
  'care-visits': {
    objective: 'Use visit outcomes to plan the next visit.',
    outcomes: {
      '': { title: 'Schedule updated, rules unchanged', tone: 'good', text: 'Logged visits moved the plan; the scheduling rule θ stayed the same (L4).' },
      'cut-AM': { title: 'New outcome not retained', tone: 'bad', text: 'Visits happened but were never logged, so the plan rests on old data.' },
      stale: { title: 'Corrected by outcomes', tone: 'good', text: 'A stale calendar misled one visit; the logged outcome moved next week’s plan.' }
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
