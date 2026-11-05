"""Export Section 6.3 (levels of loop closure) into site/data/levels.json.

Sources in the paper: the Levels of Loop Closure subsection of
sec/07_integrated_systems.tex, the level checklist (sec/table_level_checklist.tex),
the closure table (sec/table_closure_worked.tex), and the sentences on recursive
self-improvement in sec/02_foundations.tex.

    python3 tools/paper/export_levels.py [--check]
"""
import json
import re
import sys

from paper_common import PAPER, SITE, cite_keys, clean, labels, prose, ref, split_cells

OUT = SITE / 'site/data/levels.json'
LEVELS = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5']

# One sentence of the checklist caption per level: what the level requires. build() stops
# when a sentence is no longer in the caption, so the site never drifts from the paper's wording.
CRITERIA = {
    'L0': 'L0 lacks state durability.',
    'L1': 'L1 adds retention in Memory, which its mini loop draws as S→M.',
    'L2': 'L2 lets retained state guide decisions through at least one of the two edges from Memory, but like L1 it acts only as requested.',
    'L3': 'L3 adds no new channel but decides between requests whether to act, so from L3 on both properties of the continuing loop hold, and the shaded header over L3–L5 marks these always-on levels.',
    'L4': 'L4 adds attribution, which needs at least one of the two edges from Action.',
    'L5': 'L5 further requires governed self-evolution.',
}
# The mini loop of each level in the checklist: the channels it draws. The checklist's
# \levelloop{k} adds S→A for k=0, then S→M, then M→A and M→S, then A→S and A→M.
LOOPS = {
    'L0': ['SA'], 'L1': ['SA', 'SM'], 'L2': ['SA', 'SM', 'MA', 'MS'], 'L3': ['SA', 'SM', 'MA', 'MS'],
    'L4': ['SA', 'SM', 'MA', 'MS', 'AS', 'AM'], 'L5': ['SA', 'SM', 'MA', 'MS', 'AS', 'AM'],
}
LOOP_STAGES = [['SA'], ['SM'], ['MA', 'MS'], ['AS', 'AM']]


def section_text():
    text = (PAPER / 'sec/07_integrated_systems.tex').read_text()
    start = text.index('\\subsection{Levels of Loop Closure}')
    end = text.index('\\subsection{', start + 10)
    return text[start:end]


def paragraphs(text):
    """Top-level prose paragraphs of the subsection, without floats and inputs."""
    text = re.sub(r'\\begin\{figure\*?\}.*?\\end\{figure\*?\}', '', text, flags=re.S)
    text = re.sub(r'\\input\{[^}]*\}', '', text)
    text = re.sub(r'^\\(subsection|label)\{[^\n]*$', '', text, flags=re.M)
    return [p.strip() for p in re.split(r'\n\s*\n', text) if p.strip() and not p.strip().startswith('%')]


def sentences(text):
    # A period followed by a digit (§6.1) stays inside the sentence.
    return re.findall(r'(?:[^.!?]|\.(?=\d))+(?:\.(?!\d)|[!?])+(?:\s+|$)', text)


def checklist():
    """Level -> {durability, continuity, attribution, governed}, and the caption."""
    text = (PAPER / 'sec/table_level_checklist.tex').read_text()
    caption = re.search(r'\\caption\{(.*?)\}\n\\label', text, re.S).group(1)
    caption = caption.replace('\\Yes{}', '✓').replace('\\No{}', '✗')  # \ding{51} and \ding{55}
    rows = {}
    for name, key in [('State durability', 'durability'), ('Operational continuity', 'continuity'),
                      ('Attribution', 'attribution'), ('Governed self-evolution', 'governed')]:
        line = next(l for l in text.splitlines() if name in l and '&' in l and '\\levelloop' not in l)
        cells = split_cells(line.rstrip().rstrip('\\').rstrip())[1:]
        rows[key] = ['\\Yes' in c for c in cells]
    stages = [int(k) for k in re.findall(r'\\levelloop\{(\d)\}', next(l for l in text.splitlines()
                                                                        if l.startswith('\\textbf{Modules and channels}')))]
    drawn = {lv: sum(LOOP_STAGES[:k + 1], []) for lv, k in zip(LEVELS, stages)}
    assert drawn == LOOPS, ('the checklist draws other mini loops', stages)
    out = {lv: {k: rows[k][i] for k in rows} for i, lv in enumerate(LEVELS)}
    return out, prose(caption)


def closure_table():
    text = (PAPER / 'sec/table_closure_worked.tex').read_text()
    caption = prose(re.search(r'\\caption\{(.*?)\}\n\\label', text, re.S).group(1))
    heads = re.findall(r'\\ClosureHead\{(L\d)\}\{([^}]*?)(?:\\par.*?)?\}', text)
    shorts = {lv: clean(name) for lv, name in heads}
    note = re.search(r'\\TableNote\{(.*?)\}\n\\end\{table\}', text, re.S).group(1)
    notes = []
    for part in note.split('\\\\')[1:]:
        name, body = part.split(':', 1)
        notes.append({'systems': clean(name).strip(), 'text': prose(body).strip()})
    placements = {lv: [] for lv in LEVELS}
    domain, kind = None, 'Research systems'
    for line in text.splitlines():
        band = re.search(r'\\textbf\{(Wearable|Digital|Physical)\}\}', line)
        if band and 'multicolumn' in line:
            domain, kind = band.group(1), 'Research systems'
            continue
        if '\\ClosureKind{Products}' in line:
            kind = 'Products'
            continue
        if not line.startswith('\\ClosureCell'):
            continue
        cells = split_cells(line.rstrip().rstrip('\\').rstrip())
        assert len(cells) == 6, line[:80]
        for lv, cell in zip(LEVELS, cells):
            body = re.sub(r'^\\ClosureCell\{|\}$', '', cell.strip())
            pending = ''
            for item in re.split(r'\\par', body):
                item = item.strip()
                if not item or item == '---':
                    continue
                keys = cite_keys(item)
                name = clean(re.sub(r'~?\\cite[pt]?\{[^}]*\}', '', item).replace('\\LFive', '').replace('\\LowEv', ''))
                if not keys:
                    pending = f'{pending} {name}'.strip()
                    continue
                name = f'{pending} {name}'.strip()
                pending = ''
                entry = {'name': name, 'key': keys[0], 'domain': domain, 'kind': kind, 'ref': ref(keys[0])}
                icon = re.search(r'\\PIcon\{([^}]*)\}', item)
                if icon:  # the product's official icon, shown before its name as in the paper
                    entry['icon'] = f'assets/products/{icon.group(1)}.webp'
                if len(keys) > 1:
                    entry['keys'] = keys
                if '\\LFive' in item:
                    entry['conditional'] = True
                placements[lv].append(entry)
    return placements, shorts, caption, notes


def recursive_text():
    """The paper's sentences on recursive self-improvement (Section 2, the third adjacent question)."""
    foundations = (PAPER / 'sec/02_foundations.tex').read_text()
    m = re.search(r'In its strong sense, recursive self-improvement goes a step further:.*?'
                  r'\\secref\{sec:trends:beyond\}\.', foundations, re.S)
    assert m, 'the recursive self-improvement sentences are no longer in sec/02_foundations.tex'
    return prose(m.group(0))


def build():
    paras = paragraphs(section_text())
    intro = prose(paras[0])
    by_level = {}
    for p in paras:
        m = re.match(r'\\paragraph\{(L\d)(?::| ---) ([^}]*?)\.\}\s*(.*)', p, re.S)
        if m:
            by_level[m.group(1)] = (m.group(2), prose(m.group(3)))
    assert sorted(by_level) == LEVELS[1:], sorted(by_level)
    l2_extra = next(prose(p) for p in paras if p.startswith('Two kinds of assistant look always-on'))
    variants = next(prose(p) for p in paras if p.startswith('Table~\\ref{tab:closure-worked} applies'))
    checks, check_caption = checklist()
    placements, shorts, caption, notes = closure_table()
    for lv, text in CRITERIA.items():
        assert text in check_caption, (lv, text)

    # The site shows the levels without the paper's figure and table numbers: the figure sentence
    # is reworded without its number, and the sentence that points to the checklist table is left out.
    assert re.search(r'Figure \d+ summarizes the levels, and Table \d+ lists what each one requires\.', intro), intro
    variants = re.sub(r'^Table \d+ applies these criteria', 'The placements apply these criteria', variants)
    lede = ''.join(s for s in sentences(intro) if not re.match(r'\s*Figure \d+ summarizes the levels', s)).strip()
    l0_clause = 'a system that acts proactively within one session but keeps nothing across sessions stays at L0'
    assert l0_clause in caption, caption
    l0_extra = l0_clause[0].upper() + l0_clause[1:] + '.'
    levels = []
    for lv in LEVELS:
        if lv == 'L0':
            name = 'Session local'
            tagline, adds = 'L0 is a session-local baseline that keeps nothing across interactions.', None
            explanation = f'{tagline} {l0_extra}'
        else:
            name, body = by_level[lv]
            parts = sentences(body)
            tagline = parts[0].strip()
            adds = next((s.strip() for s in parts if s.startswith('Compared with')), None)
            explanation = body + ('\n\n' + l2_extra if lv == 'L2' else '')
        levels.append({
            'id': lv, 'name': name, 'short': shorts[lv],
            'mark': '(always-on)' if lv == 'L3' else None,
            'tagline': tagline, 'adds': adds, 'criterion': CRITERIA[lv],
            'explanation': explanation, 'checklist': checks[lv], 'loop': LOOPS[lv],
        })

    recursive = recursive_text()
    return {
        'source': 'Paper §' + labels()['sec:systems:levels'] + ', Table ' + labels()['tab:level-checklist'] + ' and Table ' + labels()['tab:closure-worked'],
        'intro': lede,
        'caption': caption,
        'checklistCaption': check_caption,
        'levels': levels,
        'placements': placements,
        'conditions': notes,
        'rules': [next(s.strip() for s in sentences(caption) if s.startswith('Each system is placed')), variants],
        'recursive': recursive,
    }


def main():
    data = json.dumps(build(), ensure_ascii=False, indent=2) + '\n'
    if '--check' in sys.argv:
        sys.exit(0 if OUT.read_text() == data else 1)
    OUT.write_text(data)
    d = json.loads(data)
    print({lv: len(v) for lv, v in d['placements'].items()}, 'conditional:', [p['name'] for p in d['placements']['L5'] if p.get('conditional')])


if __name__ == '__main__':
    main()
