"""Export HALO's run-mode results for the HALO section of the page.

Read mode on the page is the paper's Table 22 (site/data/halo-read.json, tools/paper/export_halo.py),
so only run mode comes from the HALO codebase (default ~/Desktop/code/HALO, or HALO_DIR):
  results/run/<case>/report.json, config.json
  cases/<case>/case.yaml (name, domain, report link)
  results/read/votes.json, only to find each run case's cite key, the key of its Table 22 row
Writes site/data/halo-results.json: {run, works}, where works maps a run case to its cite key.

Usage: python3 tools/halo/export_results.py [--check]
"""
import json, os, re, sys
from pathlib import Path

HALO = Path(os.environ.get('HALO_DIR', Path.home() / 'Desktop/code/HALO'))
SITE = Path(__file__).resolve().parents[2] / 'site' / 'data'
CHANNELS = ['S->M', 'M->A', 'A->S', 'M->S', 'A->M']
STEPS = ['record', 'outcome', 'attribution', 'revision', 'later_use']
AGENTS = {
    'codex_gpt-6-astra': 'GPT-6-Astra',
    'claude_claude-opus-5-5': 'Claude Opus 5.5',
    'claude_claude-fable-5-1': 'Claude Fable 5.1',
}
def arrow(c):
    return c.replace('->', '→')


def case_yaml(case):
    """The few flat fields we need from cases/<case>/case.yaml (no YAML dependency)."""
    out = {}
    path = HALO / 'cases' / case / 'case.yaml'
    if not path.exists():
        return out
    for line in path.read_text().splitlines():
        m = re.match(r'^(name|domain|kind|report):\s*"?(.*?)"?\s*$', line)
        if m:
            out[m.group(1)] = m.group(2)
        m = re.match(r'^\s+repo:\s*(\S+)', line)
        if m:
            out['code'] = m.group(1)
    return out


def label_of(key, v):
    if key.endswith('-claude-code'):
        return f"{v['label']} (Claude Code)"
    if key.endswith('-codex'):
        return f"{v['label']} (Codex)"
    return v['label']


def read_mode():
    votes = json.loads((HALO / 'results/read/votes.json').read_text())
    counts = json.loads((HALO / 'results/read/counts.json').read_text())
    agents = [a for a in AGENTS if a in votes['agents']]
    # the paper's cite key for each reviewed configuration, so the page can join HALO's results with
    # the systems and closure tables (the paper's read-mode export uses the same configuration ids)
    paper = {r['id']: r for r in json.loads((SITE / 'halo-read.json').read_text())['rows']}
    # a configuration the paper's table leaves out (since 23 Oct, VisualClaw's Codex backend) joins on
    # the paper row of another configuration of the same work, so it keeps the work's cite key
    paper_of_work = {}
    for key, v in votes['variants'].items():
        if key in paper:
            paper_of_work.setdefault(v['work'], paper[key])
    rows, notes = [], {}
    for key, v in votes['variants'].items():
        meta = case_yaml(v['work'])
        prow = paper.get(key) or paper_of_work.get(v['work'], {})
        row = {
            'key': key, 'paperKey': prow.get('key', key), 'work': v['work'], 'name': label_of(key, v), 'domain': v['domain'], 'kind': v['kind'],
            'configuration': v['configuration'], 'report': meta.get('report', '') or prow.get('links', {}).get('report', ''),
            'code': meta.get('code', '') or prow.get('links', {}).get('code', ''), 'ref': prow.get('ref', {}),
            'channels': {}, 'steps': {}
        }
        for group, ids in (('channels', CHANNELS), ('steps', STEPS)):
            for cid in ids:
                cell = v[group][cid]
                # HALO records a three-way split on a channel as insufficient ('no majority')
                row[group][cid] = {'label': cell['label'], 'split': cell['rule'] != 'unanimous', 'nomajority': cell['rule'] == 'no majority', 'votes': [cell['votes'].get(a) for a in agents]}
        rows.append(row)
        # every agent's reasons for this configuration
        per = {}
        for a in agents:
            path = HALO / 'results/read/reviews' / a / f'{key}.json'
            if not path.exists():
                continue
            r = json.loads(path.read_text())
            for group, ids in (('channels', CHANNELS), ('steps', STEPS)):
                for cid in ids:
                    c = r.get(group, {}).get(cid)
                    if not c:
                        continue
                    per.setdefault(cid, []).append({
                        'agent': AGENTS[a], 'label': c.get('label'), 'why': c.get('rationale', ''),
                        'quote': c.get('quote', ''), 'where': c.get('locator', '')
                    })
        notes[key] = per
    order = {'wearable': 0, 'physical': 1, 'digital': 2}
    rows.sort(key=lambda r: (order.get(r['domain'], 9), r['name'].lower()))
    return {
        'agents': [AGENTS[a] for a in agents],
        'works': counts['works'],
        'configurations': len(rows),
        'counts': {
            'channels': {arrow(k): v for k, v in counts['channels'].items()},
            'steps': counts['steps'],
            'amWithOutcome': counts.get('A->M with outcome')
        },
        'rows': rows
    }, notes


def run_mode():
    cases = []
    for case in sorted(p.name for p in (HALO / 'results/run').iterdir() if p.is_dir()):
        rep = json.loads((HALO / 'results/run' / case / 'report.json').read_text())
        cfg = json.loads((HALO / 'results/run' / case / 'config.json').read_text())
        meta = case_yaml(case)
        run = cfg.get('run', {})
        items = None
        md = (HALO / 'results/run' / case / 'report.md')
        if md.exists():
            m = re.search(r'(\d+) items x (\d+) samples', md.read_text())
            if m:
                items = int(m.group(1))
        sites = {arrow(k): v for k, v in rep.get('channels', {}).items()}
        sites.update(rep.get('steps', {}))
        tests = []
        for t in rep['tests']:
            tests.append({
                'cut': [arrow(c) for c in t['cut']], 'field': t['field'], 'pairs': t['pairs'],
                'original': t['original'], 'cut_wins': t['modified'], 'tie': t['tie'],
                'metrics': {k: [m['original'], m['modified']] for k, m in t.get('metrics', {}).items()}
            })
        cases.append({
            'id': case, 'name': meta.get('name', case), 'domain': meta.get('domain', ''),
            'report': meta.get('report', ''), 'code': meta.get('code', ''),
            'items': items, 'samples': run.get('samples'), 'sites': sites, 'tests': tests
        })
    first = json.loads((HALO / 'results/run' / cases[0]['id'] / 'config.json').read_text())['run']['models']
    def model(m):
        return f"{m['backend'].split(':', 1)[1].replace('gpt-6-astra', 'GPT-6-Astra')} ({m.get('effort', '')} effort)"
    return {'backbone': model(first['backbone']), 'judge': model(first['judge']), 'cases': cases}


def main():
    read, _ = read_mode()
    works = {}
    for row in read['rows']:
        works.setdefault(row['work'], row['paperKey'])
    data = {'run': run_mode(), 'works': works}
    out = json.dumps(data, ensure_ascii=False, indent=1)
    targets = [(SITE / 'halo-results.json', out + '\n')]
    if '--check' in sys.argv:
        stale = [p.name for p, text in targets if not p.exists() or p.read_text() != text]
        print('up to date' if not stale else f'stale: {", ".join(stale)}')
        sys.exit(1 if stale else 0)
    for p, text in targets:
        p.write_text(text)
        print(f'wrote {p} ({len(text) // 1024} KB)')


if __name__ == '__main__':
    main()
