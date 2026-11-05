"""Export the evidence behind the paper's Table 22 for the HALO cards on the page.

Source in the paper (read only): analysis/evidence/channel-judgements-v3.json, the review records from
which sec/table_channel_audit.tex (Table 22) is generated. For each of the 40 works it gives every
coupling channel's status with the section of the work's paper where the flow is described, and every
step of the chain of evidence with its status. Writes site/data/halo-evidence.json, keyed by the row ids
of site/data/halo-read.json; the cards on the page combine it with the short lines in
site/data/halo-lines.mjs.

Section locators are kept as the paper's own references (§, Section, Table, Figure, Appendix); line
numbers and the reviewers' local file paths are left out.

    python3 tools/paper/export_halo_evidence.py [--check]
"""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from paper_common import PAPER, SITE  # noqa: E402

SOURCE = PAPER / 'analysis/evidence/channel-judgements-v3.json'
OUT = SITE / 'site/data/halo-evidence.json'
CHANNEL = {'SM': 'S→M', 'MA': 'M→A', 'AS': 'A→S', 'MS': 'M→S', 'AM': 'A→M'}
STATUS = {'reported': '●', 'unreported': '◐', 'absent': '○'}
STEPS = ['record', 'outcome', 'attribution', 'revision', 'later_use']
INTERNAL = re.compile(r'\.txt|tmp/|snapshot|sha256|File:|source lines?|numbered|cache', re.I)


def clean_locator(text):
    """Keep the paper's own section references, drop line numbers and local file paths."""
    if not text:
        return ''
    parts = []
    for part in re.split(r';\s*', text):
        part = re.sub(r'\s*\((?:source )?lines? [^)]*\)', '', part)
        part = re.sub(r',?\s*\blines? \d[\d–\-, ]*', '', part)
        part = part.strip(' ,.')
        if not part or INTERNAL.search(part):
            continue
        parts.append(part)
    return '; '.join(dict.fromkeys(parts))


def build():
    data = json.loads(SOURCE.read_text())
    rows = {r['id'] for r in json.loads((SITE / 'site/data/halo-read.json').read_text())['rows']}
    out = {}
    for rec in data['records']:
        if rec['id'] not in rows:
            raise SystemExit(f"{rec['id']}: not a row of Table 22 (site/data/halo-read.json)")
        cells = {}
        for c in rec['cells']:
            cells[CHANNEL[c['channel']]] = {
                'mark': STATUS[c['status']],
                'where': clean_locator(c.get('source_locator')),
                'url': c.get('source_url') or ''
            }
        chain = {s: (rec.get('evidence_chain') or {}).get(s, {}).get('status') == 'shown' for s in STEPS}
        out[rec['id']] = {'name': rec['name'], 'summary': rec.get('original_contribution', ''), 'cells': cells, 'chain': chain}
    missing = rows - set(out)
    if missing:
        raise SystemExit(f'no evidence record for {sorted(missing)}')
    return out


def main():
    text = json.dumps(build(), ensure_ascii=False, indent=1) + '\n'
    if '--check' in sys.argv:
        stale = not OUT.exists() or OUT.read_text() != text
        print('stale' if stale else 'up to date')
        sys.exit(1 if stale else 0)
    OUT.write_text(text)
    print(f'wrote {OUT} ({len(text) // 1024} KB)')


if __name__ == '__main__':
    main()
