import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { cases, IMPL, STEP_LABEL, LEVEL_NAME } from '../site/data/cases.mjs';
import { resolveCase, coverage, CHANNELS, CONDITIONS } from '../site/case-core.mjs';
import { domains, participants, horizons } from '../site/data/regimes.mjs';

const works = JSON.parse(readFileSync(new URL('../site/data/works.json', import.meta.url), 'utf8'));
const levels = JSON.parse(readFileSync(new URL('../site/data/levels.json', import.meta.url), 'utf8'));
const workKeys = new Set(works.works.map(w => w.key));
const implIds = new Set(IMPL.map(i => i[0]));

test('cases: every beat uses the paper\'s vocabulary', () => {
  assert.equal(cases.length, 8);
  assert.equal(new Set(cases.map(c => c.id)).size, cases.length);
  for (const c of cases) {
    assert.ok(c.beats.length >= 5 && c.beats.length <= 8, `${c.id}: 5 to 8 beats`);
    assert.ok(['wearable', 'digital', 'physical'].includes(c.domain), c.id);
    assert.ok(c.source && c.extension, `${c.id}: source and extension stated`);
    for (const w of c.works) assert.ok(workKeys.has(w.key), `${c.id}: ${w.key} is in the works index`);
    for (const b of c.beats) {
      assert.ok(STEP_LABEL[b.step], `${c.id}: step ${b.step}`);
      assert.ok((b.channels || []).every(ch => CHANNELS.includes(ch)), `${c.id}/${b.title}: channels`);
      assert.ok((b.conditions || []).every(x => CONDITIONS.includes(x)), `${c.id}/${b.title}: conditions`);
      assert.ok((b.impl || []).every(x => implIds.has(x)), `${c.id}/${b.title}: implementation`);
      for (const [id] of Object.entries(b.variants || {})) assert.ok(c.controls.some(k => k.id === id), `${c.id}: variant ${id} has a control`);
      // memory items use the memory classes of §4.1.1; a tracked permission is a shared condition
      for (const v of [b, ...Object.values(b.variants || {})]) {
        for (const m of v.memory || []) assert.ok(['retrospective', 'profile', 'prospective'].includes(m.kind), `${c.id}/${b.title}: memory class ${m.kind}`);
        if (v.limit) assert.ok(CONDITIONS.includes(v.limit.cond) && v.limit.text, `${c.id}/${b.title}: limit`);
      }
    }
  }
});

test('cases: a skill file is part of the mechanism and a permission is a shared condition', () => {
  // §2.1: a rule, a prompt, a skill file or model weights belong to θ, not to the running state z.
  const exportCase = cases.find(c => c.id === 'export-check');
  for (const id of ['', ...exportCase.controls.map(k => k.id)]) {
    for (const b of resolveCase(exportCase, id || null).beats) {
      assert.ok(!(b.memory || []).some(m => /procedure/.test(m.text)), `export-check/${b.title}: the procedure is not in z`);
      assert.match(b.theta || '', /skill file/, `export-check/${b.title}: the procedure is shown as θ`);
    }
  }
  // §2.4: what the user has permitted is user authority, a shared condition, so it never sits in z.
  for (const c of cases) for (const b of c.beats) for (const v of [b, ...Object.values(b.variants || {})]) {
    assert.ok(!(v.memory || []).some(m => /\bmay (draft|publish)/.test(m.text)), `${c.id}/${b.title}: permissions are not memory`);
  }
  const governed = cases.find(c => c.id === 'governed-revision');
  for (const b of governed.beats) assert.equal(b.limit?.cond, 'authority', `governed-revision/${b.title}: the permission is shown`);
  assert.ok(resolveCase(governed, 'open-approvals').beats.at(-1).limit.changed, 'a revisable approval list changes the permission');
});

test('cases: a cut channel never delivers, and every beat that used it says what happens instead', () => {
  for (const c of cases) {
    for (const control of c.controls.filter(k => k.type === 'cut')) {
      const resolved = resolveCase(c, control.id);
      resolved.beats.forEach((b, i) => {
        assert.ok(!b.channels.includes(control.channel), `${c.id}: ${control.channel} still delivers in beat ${i + 1}`);
        if ((c.beats[i].channels || []).includes(control.channel)) {
          assert.ok(c.beats[i].variants?.[control.id], `${c.id}: beat ${i + 1} uses ${control.channel} but has no ${control.id} variant`);
          assert.deepEqual(b.cut, [control.channel]);
        }
      });
    }
  }
});

test('cases: together they cover the framework', () => {
  const cov = coverage(cases);
  assert.deepEqual([...cov.channels].sort(), [...CHANNELS].sort(), 'all six channels');
  assert.deepEqual([...cov.conditions].sort(), [...CONDITIONS].sort(), 'all six shared conditions');
  assert.deepEqual([...cov.impl].sort(), [...implIds].sort(), 'every part of the implementation');
  assert.deepEqual([...cov.domains].sort(), ['digital', 'physical', 'wearable']);
  assert.deepEqual([...cov.scopes].sort(), ['group', 'individual', 'public']);
  for (const h of horizons) assert.ok(cov.horizons.has(h.id), `horizon ${h.id}`);
  assert.deepEqual([...cov.S].sort(), ['continuous', 'on-demand', 'triggered']);
  assert.deepEqual([...cov.M].sort(), ['profile', 'prospective', 'retrospective']);
  assert.deepEqual([...cov.A].sort(), ['deferred', 'proactive', 'reactive']);
  for (const l of ['L0', 'L2', 'L3', 'L4', 'L5']) assert.ok(cov.levels.has(l), `level ${l}`);
  assert.deepEqual([...cov.evidence].sort(), ['attribution', 'later_use', 'outcome', 'record', 'revision'], 'the five evidence steps');
  for (const s of ['request', 'outside', 'boundary', 'revision']) assert.ok(cov.steps.has(s), `step kind ${s}`);
  assert.ok(domains.length === 3 && participants.length === 3);
});

test('cases: claims about levels follow the paper', () => {
  const placed = new Map();
  for (const [level, list] of Object.entries(levels.placements)) for (const p of list) placed.set(p.key, level);
  // Each case's level is at most what the paper gives the most capable work it is modeled on, unless
  // the case says which added step raises it (daily-plan: the continuing mode that waits).
  const rank = l => Number(l.slice(1));
  for (const c of cases) {
    const best = Math.max(...c.works.map(w => rank(placed.get(w.key) || 'L0')));
    if (rank(c.level) > best) assert.ok(c.levelBy, `${c.id}: ${c.level} exceeds its sources; a mode must say why`);
  }
  const governed = cases.find(c => c.id === 'governed-revision');
  assert.equal(resolveCase(governed, 'open-approvals').level, 'L4', 'revisable approvals keep the loop at L4');
  const later = resolveCase(governed, 'not-stored').beats.at(-1);
  assert.equal(later.theta, 'θ₁', 'an unstored revision is not used later');
  const plan = cases.find(c => c.id === 'daily-plan');
  assert.equal(resolveCase(plan, 'scheduled').level, 'L2', 'acting at every scheduled time is L2');
  // L4 rests on the outcome evidence the paper cites (§6.3): Hobbit's grasp check through A→S and
  // STRANDS's logged visit outcomes through A→M. Cutting that channel leaves the loop at L3.
  assert.equal(resolveCase(cases.find(c => c.id === 'robot-cup'), 'cut-AS').level, 'L3', 'no grasp check, no attributed outcome');
  assert.equal(resolveCase(cases.find(c => c.id === 'care-visits'), 'cut-AM').level, 'L3', 'no logged visits, no attributed outcome');
  // the level names follow the paper's Table 21, as the levels data spells them
  for (const l of levels.levels) assert.equal(LEVEL_NAME[l.id], l.name, `name of ${l.id}`);
});

test('cases: the Demo page has no 3D world', () => {
  const html = readFileSync(new URL('../play.html', import.meta.url), 'utf8');
  assert.match(html, /data-cases/);
  assert.doesNotMatch(html, /minecraft-embed|id="world-stage"|id="village-demo"/, 'no 3D world on the Demo page');
  const lib = readFileSync(new URL('../site/cases.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(lib, /data-world|worldCardHtml/, 'no world cards in the library');
});

test('cases: each episode has one call in every scenario, and every other action plays on its own', async () => {
  for (const c of cases) {
    const src = readFileSync(new URL(`../site/play/scenes/${c.id}.mjs`, import.meta.url), 'utf8');
    const inScene = o => src.includes(`'${o.replace(/'/g, "\\'")}'`);
    for (const id of ['', ...c.controls.map(k => k.id)]) {
      const where = `${c.id}/${id || 'as built'}`;
      const beats = resolveCase(c, id || null).beats;
      const calls = beats.filter(b => b.decision);
      assert.equal(calls.length, 1, `${where}: exactly one call`);
      const d = calls[0].decision;
      assert.ok(d.prompt && d.prompt.length > 20, `${where}: a setup before the choice`);
      assert.ok(d.options.includes(d.choice), `${where}: the assistant's choice is one of the options`);
      assert.ok(d.why, `${where}: why the assistant chose it`);
      for (const o of d.options) {
        assert.ok(d.results?.[o], `${where}: a result for "${o}"`);
        assert.ok(inScene(o), `${where}: the room can play "${o}"`);
      }
      for (const o of Object.keys(d.labels || {})) assert.ok(d.options.includes(o), `${where}: label for an option`);
      for (const b of beats.filter(x => x.auto)) assert.ok(inScene(b.auto), `${where} · ${b.title}: the room can play "${b.auto}"`);
    }
  }
});

test('cases: each episode has an objective, an ending for every scenario, a 3D room and library art', async () => {
  const { play, SCENES } = await import('../site/data/case-play.mjs');
  const { existsSync } = await import('node:fs');
  for (const c of cases) {
    const p = play[c.id];
    assert.ok(p?.objective, `${c.id}: objective`);
    for (const id of ['', ...c.controls.map(k => k.id)]) {
      const out = p.outcomes[id];
      assert.ok(out?.title && out?.text && ['good', 'warn', 'bad', 'neutral'].includes(out.tone), `${c.id}: ending for "${id || 'baseline'}"`);
      assert.ok(out.why?.includes(resolveCase(c, id || null).level), `${c.id}: the ending for "${id || 'baseline'}" says why it sits at its level`);
    }
    const scene = SCENES[c.id];
    assert.ok(scene, `${c.id}: has a 3D room`);
    const src = readFileSync(new URL(`../site/${scene.replace('./', '')}`, import.meta.url), 'utf8');
    for (const fn of ['enter', 'act', 'inspect', 'visibleSpots', 'snapEnd']) assert.match(src, new RegExp(`\\b${fn}\\b`), `${c.id}: scene defines ${fn}`);
    assert.ok(existsSync(new URL(`../assets/play/${c.id}.webp`, import.meta.url)), `${c.id}: library art`);
  }
  const { PINS } = await import('../site/data/case-play.mjs');
  assert.ok(existsSync(new URL('../assets/play/island.webp', import.meta.url)), 'the island picture (fallback hero and the teaser)');
  for (const c of cases) assert.ok(PINS[c.id]?.every(v => v >= 0 && v <= 100), `${c.id}: a pin on the island picture`);
  const island = readFileSync(new URL('../site/play/island.mjs', import.meta.url), 'utf8');
  for (const c of cases) assert.match(island, new RegExp(`['"]?${c.id}['"]?: \\{ at: \\[`), `${c.id}: a building on the 3D island`);
  const html = readFileSync(new URL('../play.html', import.meta.url), 'utf8');
  assert.match(html, /"three": "\.\/world\/vendor\/three\/three\.module\.min\.js"/, 'the Demo page maps three.js for the 3D rooms');
});

test('cases: a cut channel never reaches the assistant in a call or action that depends on it', () => {
  // With A→S cut, no call or action may present a requested look as the assistant's choice.
  for (const c of cases) {
    for (const control of c.controls.filter(k => k.type === 'cut' && k.channel === 'AS')) {
      for (const b of resolveCase(c, control.id).beats) {
        const played = [b.decision?.choice, b.auto].filter(Boolean);
        for (const p of played) assert.doesNotMatch(p, /look closer|inspect the file|check the grasp/, `${c.id}/${control.id}: ${b.title}`);
      }
    }
  }
});
