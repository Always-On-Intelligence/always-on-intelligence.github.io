import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

import { modules, channels, reminderSteps, evolveSteps, adjacentKinds, conditions } from '../site/data/framework.mjs';
import { channelGeometry, VB } from '../site/framework.mjs';
import { domains, participants, horizons, cases, tableHorizon } from '../site/data/regimes.mjs';
import { buildIndex } from '../site/systems.mjs';
import { systemsIn } from '../site/applications.mjs';

const json = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const applications = json('../site/data/applications.json');
const levels = json('../site/data/levels.json');
const read = json('../site/data/halo-read.json');
const halo = json('../site/data/halo-results.json');

test('framework: three modules and six directed channels with the paper’s difficulty ratings', () => {
  assert.deepEqual(Object.keys(modules), ['S', 'M', 'A']);
  const ids = channels.map(c => c.id).sort();
  assert.deepEqual(ids, ['AM', 'AS', 'MA', 'MS', 'SA', 'SM']);
  const difficulty = Object.fromEntries(channels.map(c => [c.id, c.difficulty]));
  assert.deepEqual(difficulty, { SA: 'Basic', SM: 'Moderate', MA: 'Moderate', AS: 'Moderate', MS: 'High', AM: 'High' });
  for (const [id, mod] of Object.entries(modules)) {
    const incoming = channels.filter(c => c.to === id).map(c => c.id).sort();
    assert.deepEqual([...mod.incoming].sort(), incoming, `incoming channels of ${id}`);
  }
  assert.equal(conditions.length, 6);
});

test('framework: the reminder walkthrough uses each channel once, and adjacent kinds are complete', () => {
  const used = reminderSteps.map(s => s.channel).filter(Boolean).sort();
  assert.deepEqual(used, ['AM', 'AS', 'MA', 'MS', 'SA', 'SM']);
  assert.equal(reminderSteps.filter(s => s.kind === 'request').length, 1);
  assert.equal(reminderSteps.filter(s => s.kind === 'boundary').length, 1);
  // The self-evolving walkthrough follows the five steps of the chain of evidence (§2.1).
  const chain = evolveSteps.map(s => s.id).filter(id => ['record', 'outcome', 'attribution', 'revision', 'later'].includes(id));
  assert.deepEqual(chain, ['record', 'outcome', 'attribution', 'revision', 'later']);
  assert.ok(evolveSteps.every(s => ['old', 'new'].includes(s.theta)));
  assert.equal(adjacentKinds.length, 8);
  for (const k of adjacentKinds) assert.ok(k.v.every(v => ['yes', 'no', 'opt'].includes(v)));
});

test('framework: channel geometry stays inside the figure and paired labels do not overlap', () => {
  const g = Object.fromEntries(channels.map(c => [c.id, channelGeometry(c)]));
  for (const [id, geo] of Object.entries(g)) {
    for (const p of [geo.start, geo.end, geo.label]) {
      assert.ok(p.x > 0 && p.x < VB.w && p.y > 0 && p.y < VB.h, `${id} point inside the view box`);
    }
  }
  for (const [a, b] of [['SM', 'MS'], ['MA', 'AM'], ['SA', 'AS']]) {
    const d = Math.hypot(g[a].label.x - g[b].label.x, g[a].label.y - g[b].label.y);
    assert.ok(d > 30, `${a} and ${b} labels are ${d.toFixed(1)} apart`);
  }
});

test('regimes: nine settings with three example cases each', () => {
  const horizonIds = new Set(horizons.map(h => h.id));
  for (const d of domains) {
    for (const p of participants) {
      const id = `${d.id}-${p.id}`;
      assert.equal(cases[id]?.length, 3, id);
      assert.ok(cases[id].every(([, h]) => horizonIds.has(h)), id);
      assert.ok(existsSync(new URL(`../assets/applications/${id}.webp`, import.meta.url)), `${id} illustration`);
    }
  }
});

test('applications: every domain has a short version with a gist, three points and a bottleneck', async () => {
  const { briefs } = await import('../site/data/applications-brief.mjs');
  for (const g of applications.groups) {
    const b = briefs[g.domain];
    assert.ok(b?.gist && b.bottleneck, `${g.domain}: gist and bottleneck`);
    assert.equal(b.points.length, 3, `${g.domain}: three points`);
  }
  // §6.1 no longer has a subsubsection of patterns across domains, so there are no short patterns.
  const all = Object.values(briefs).flatMap(b => [b.gist, b.bottleneck, ...b.points]).join(' ');
  assert.ok(!/[—;]/.test(all), 'no em dashes or semicolons in the short versions');
});

test('applications: the systems table has three domain groups and every row places in the grid', () => {
  assert.deepEqual(applications.groups.map(g => g.domain), ['Wearable', 'Digital', 'Physical']);
  const works = applications.groups.flatMap(g => g.works);
  assert.equal(works.length, 45);
  for (const w of works) {
    assert.ok(w.key && w.name, 'key and name');
    assert.ok(w.domains.every(d => domains.some(x => x.table === d)), `${w.name} domain`);
    assert.ok(w.participants.every(p => participants.some(x => x.table === p)), `${w.name} participants`);
    assert.ok(tableHorizon[w.horizon], `${w.name} horizon ${w.horizon}`);
    const placed = domains.some(d => participants.some(p => systemsIn(applications.groups, d, p, '').some(x => x.key === w.key)));
    assert.ok(placed, `${w.name} appears in at least one tile`);
  }
});

test('systems index joins the three tables on cite keys', () => {
  const index = buildIndex(applications, levels, read);
  for (const w of applications.groups.flatMap(g => g.works)) assert.ok(index.get(w.key)?.app, w.name);
  assert.deepEqual(levels.levels.map(l => l.id), ['L0', 'L1', 'L2', 'L3', 'L4', 'L5']);
  for (const list of Object.values(levels.placements)) for (const p of list) assert.ok(index.get(p.key)?.level, p.name);
  assert.deepEqual(read.columns, ['S→M', 'M→A', 'A→S', 'M→S', 'A→M']);
  for (const r of read.rows) assert.ok(Object.values(r.cells).every(m => ['●', '○', '◐'].includes(m)), r.name);
  assert.deepEqual(read.chain.map(s => s.id), ['record', 'outcome', 'attribution', 'revision', 'later_use']);
  for (const r of read.rows) assert.deepEqual(Object.keys(r.chain), read.chain.map(s => s.id), r.name);
  for (const r of read.rows) assert.ok(index.get(r.key)?.audit, r.name);
});

test('levels: cumulative checklist, and every L5 placement holds only under a stated condition', () => {
  const order = ['durability', 'continuity', 'attribution', 'governed'];
  for (const [i, l] of levels.levels.entries()) {
    if (i === 0) continue;
    const before = levels.levels[i - 1].checklist;
    for (const k of order) assert.ok(!before[k] || l.checklist[k], `${l.id} keeps ${k}`);
  }
  assert.deepEqual(levels.levels.filter(l => l.checklist.durability && l.checklist.continuity).map(l => l.id), ['L3', 'L4', 'L5']);
  assert.ok(levels.placements.L5.length > 0 && levels.placements.L5.every(p => p.conditional), 'L5 entries are conditional');
  for (const p of levels.placements.L5) assert.ok(levels.conditions.some(c => c.systems.includes(p.name)), `${p.name} has a condition`);
  // Every product carries its official icon from the paper's Table 21; research systems carry none.
  const placed = Object.values(levels.placements).flat();
  for (const p of placed) {
    if (p.kind === 'Products') {
      assert.match(p.icon || '', /^assets\/products\/[a-z0-9-]+\.webp$/, `${p.name}: icon`);
      assert.ok(existsSync(new URL(`../${p.icon}`, import.meta.url)), `${p.name}: icon file`);
    } else assert.equal(p.icon, undefined, `${p.name}: research systems have no icon`);
  }
});

test('HALO: read mode is the paper\'s Table 22, and every run test adds up', () => {
  assert.equal(read.counts.works, 40);
  assert.equal(read.rows.length, 40);
  for (const ch of read.columns) assert.equal(read.rows.filter(r => r.cells[ch] === '●').length, read.counts.reported[ch], ch);
  for (const s of read.chain) assert.equal(read.rows.filter(r => r.chain[s.id]).length, read.counts.stated[s.id], s.id);
  // the counts the paper quotes in §7.1 and §8.1
  assert.deepEqual(read.counts.reported, { 'S→M': 37, 'M→A': 37, 'A→S': 28, 'M→S': 17, 'A→M': 25 });
  assert.deepEqual(read.counts.stated, { record: 24, outcome: 16, attribution: 18, revision: 5, later_use: 4 });
  const run = halo.run;
  assert.equal(run.cases.length, 20);
  for (const c of run.cases) {
    assert.ok(c.tests.length > 0, c.name);
    assert.ok(read.rows.some(r => r.key === halo.works[c.id]), `${c.name} is one of the 40 works of Table 22`);
    for (const t of c.tests) assert.equal(t.original + t.cut_wins + t.tie, t.pairs, `${c.name}: ${t.cut}`);
  }
});

test('HALO cards: every cell of Table 22 has its own line of evidence', () => {
  const lines = json('../site/data/halo-lines.json');
  const evidence = json('../site/data/halo-evidence.json');
  const keys = ['work', ...read.columns, ...read.chain.map(s => s.id)];
  for (const r of read.rows) {
    assert.ok(evidence[r.id], `${r.name}: evidence record`);
    for (const k of keys) {
      const line = lines[r.id]?.[k];
      assert.ok(line, `${r.name} ${k}: line`);
      assert.ok(line.split(/\s+/).length <= 30, `${r.name} ${k}: at most 30 words`);
      assert.doesNotMatch(line, /—|;|rather than/, `${r.name} ${k}: style`);
    }
  }
});

test('the paper page points to the Demo page with one link, and keeps the BibTeX in sync', () => {
  const play = readFileSync(new URL('../play.html', import.meta.url), 'utf8');
  assert.match(play, /data-cases/, 'play.html holds the island, the library and the player');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /id="live-demo"/, 'the staging script checks the paper page for id="live-demo"');
  assert.equal((html.match(/href="play\.html[^"]*"/g) || []).length, 2, 'the nav and Open the demo are the only links to the Demo page');
  assert.doesNotMatch(html, /data-cases|play\.html#case-/, 'episodes open only on the Demo page');
  assert.match(html, /\^#case-\[a-z0-9-\]\+\$\/\.test\(h\)\) location\.replace\('play\.html' \+ h\)/, 'old episode links move to the Demo page');
  const items = [...html.matchAll(/<li data-preview="([a-z-]+)">/g)].map(m => m[1]);
  assert.equal(items.length, 8, 'eight episodes in the teaser');
  for (const id of items) {
    assert.ok(existsSync(new URL(`../assets/play/preview/${id}.mp4`, import.meta.url)), `${id}: preview loop`);
    assert.ok(existsSync(new URL(`../assets/play/preview/${id}.webp`, import.meta.url)), `${id}: preview still`);
  }
  const pre = html.match(/<pre id="bibtex">([\s\S]*?)<\/pre>/)[1];
  const bib = readFileSync(new URL('../citation.bib', import.meta.url), 'utf8');
  const norm = s => s.replace(/\s+/g, ' ').trim();
  assert.equal(norm(pre), norm(bib));
});

test('the survey video sits right under the title, before the banner and the overview, and plays only when asked', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const order = ['class="res-tiles"', 'id="video"', 'class="hero"', 'data-stats', 'class="overview"'].map(s => html.indexOf(s));
  assert.ok(order.every((at, i) => at > 0 && (i === 0 || at > order[i - 1])), 'title, video, banner, numbers, overview');
  assert.doesNotMatch(html, /data-video-jump/, 'no Video tile under the title (removed 2026-11-04)');
  const figure = html.match(/<figure class="teaser teaser--video" id="video">[\s\S]*?<\/figure>/)[0];
  assert.doesNotMatch(figure, /autoplay/);
  const files = [...figure.matchAll(/(?:src|poster)="(assets\/video\/[^"]+)"/g)].map(m => m[1]);
  assert.equal(files.length, 3, 'poster, phone encode, full encode');
  for (const file of files) assert.ok(existsSync(new URL(`../${file}`, import.meta.url)), file);
});

test('takeaways: the paper’s twelve as short cards that explain themselves in place', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const box = html.match(/<section class="section" id="takeaways">[\s\S]*?<\/section>/)[0];
  assert.doesNotMatch(box, /href=/, 'the cards explain in place and never send the reader elsewhere');
  const cards = [...box.matchAll(/<li class="tk-card[^"]*">([\s\S]*?)<\/li>/g)];
  assert.equal(cards.length, 12);
  assert.equal(cards.filter(c => /is-key/.test(c[0])).length, 1, 'one card marks the main finding');
  const words = t => t.replace(/<[^>]+>/g, '').trim().split(/\s+/).length;
  cards.forEach(([, body], i) => {
    assert.match(body, new RegExp(`<span class="tk-n">${String(i + 1).padStart(2, '0')}</span>`), 'numbered in order');
    const claim = body.match(/<h3 class="tk-claim">([\s\S]*?)<\/h3>/)[1], ev = body.match(/<p class="tk-ev">([\s\S]*?)<\/p>/)[1];
    assert.ok(words(claim) <= 12, `card ${i + 1}: the claim fits a slide`);
    assert.ok(words(ev) >= 8 && words(ev) <= 28, `card ${i + 1}: one line of evidence`);
    const more = body.match(/<details class="tk-more"><summary>Why and evidence<\/summary>([\s\S]*?)<\/details>/)[1];
    assert.match(more, /<p class="tk-label">Why<\/p><p>[^]{80,}?<\/p>/, `card ${i + 1} explains why`);
    assert.match(more, /<p class="tk-label">Evidence<\/p><p>[^]{80,}?<\/p><p class="tk-where">Paper §[\d.–, §]+<\/p>/, `card ${i + 1} gives its evidence and section`);
    const text = (claim + ev + more).replace(/<[^>]+>/g, '');
    assert.doesNotMatch(text, /—|;/, `no em dash or semicolon on card ${i + 1}`);
    assert.doesNotMatch(text, /\bservices?\b/i, 'the paper calls the object an assistant');
  });
  for (const id of ['S', 'M', 'A']) assert.ok(modules[id].takeaway.length === 3, `${id}: the chapter box has three points`);
});

test('open problems: the paper’s 15 in four parts, each with why it is open and its question', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const cards = [...html.matchAll(/<article class="open-card">([\s\S]*?)<\/article>/g)].map(m => m[1]);
  assert.deepEqual(cards.map(c => [...c.matchAll(/<details>/g)].length), [5, 4, 4, 2]);
  for (const card of cards) {
    for (const d of card.matchAll(/<details>([\s\S]*?)<\/details>/g)) {
      assert.match(d[1], /<p class="op-why">[^<]+<\/p><p class="op-q">[^<]+\?<\/p>/);
      assert.doesNotMatch(d[1], /—|;/);
    }
  }
  assert.equal([...html.matchAll(/class="op-tag">Main finding/g)].length, 2);
});

test('works index: one entry per cite key, each placed in a table of the paper', async () => {
  const { filterWorks } = await import('../site/works.mjs');
  const index = json('../site/data/works.json');
  const keys = index.works.map(w => w.key);
  assert.equal(new Set(keys).size, keys.length, 'unique keys');
  const labels = new Set(index.tables.map(t => t.label));
  for (const w of index.works) {
    assert.ok(w.placements.length > 0, `${w.key} has a placement`);
    assert.ok(w.placements.every(p => labels.has(p.table)), `${w.key} tables exist`);
  }
  for (const k of applications.groups.flatMap(g => g.works).map(w => w.key)) assert.ok(keys.includes(k), `${k} in works`);
  const high = filterWorks(index.works, { channel: 'M→S' });
  assert.ok(high.length > 0 && high.every(w => w.channels.includes('M→S')));
  const byName = filterWorks(index.works, { query: 'aiget' });
  assert.ok(byName.some(w => w.key === 'aiget'));
});

test('loop cards: every audited system shows its Table 22 marks, each with its own line', async () => {
  const { loopModel } = await import('../site/loopcard.mjs');
  const { works } = json('../site/data/works.json');
  const data = { read, lines: json('../site/data/halo-lines.json'), evidence: json('../site/data/halo-evidence.json') };
  const state = { '●': 'yes', '◐': 'na', '○': 'no' };
  const audited = works.filter(w => w.audit);
  assert.equal(audited.length, 41);
  for (const w of audited) {
    const m = loopModel(w, data);
    assert.equal(m.kind, 'audit', w.key);
    const row = read.rows.find(r => r.name === m.name);
    for (const c of m.channels) {
      if (c.id === 'SA') { assert.equal(c.state, 'basic'); continue; }
      assert.equal(c.state, state[row.cells[`${c.id[0]}→${c.id[1]}`]], `${w.key} ${c.id}`);
      assert.ok(c.text && c.text === data.lines[row.id][`${c.id[0]}→${c.id[1]}`], `${w.key} ${c.id} has its line`);
    }
  }
  // a system whose source rules out every Memory channel is drawn without Memory
  assert.equal(loopModel(works.find(w => w.key === 'sensibleagent2025'), data).modules.M.state, 'absent');
});

test('loop cards: works outside the audit never show a channel as missing', async () => {
  const { loopModel, frameworkParts } = await import('../site/loopcard.mjs');
  const { works } = json('../site/data/works.json');
  const data = { read, lines: json('../site/data/halo-lines.json'), evidence: json('../site/data/halo-evidence.json') };
  for (const w of works.filter(w => !w.audit)) {
    const m = loopModel(w, data);
    if (!m) continue;
    assert.ok(m.channels.every(c => !['na', 'no'].includes(c.state)), `${w.key} marks no channel as missing`);
  }
  const p = frameworkParts('S→A, c_t: auth., res., ∉R, B');
  assert.deepEqual([...p.channels], ['SA']);
  assert.deepEqual(p.conditions, ['authority', 'resources']);
  assert.ok(p.outside && p.retained && !p.revision);
  assert.deepEqual([...frameworkParts('π_M, M→A; c_t').modules], ['M']);
});
