"""Shared helpers for exporting the paper's content into site/data.

Reads the survey's LaTeX sources (read only): the bibliography for references,
main.aux for section and table numbers, and plain-text conversion of short LaTeX
passages (\\secref and \\secrefs become § and §§ numbers). Standard library only.
"""
import os
import re
from pathlib import Path

PAPER = Path(os.environ.get('PAPER_DIR', '/Users/bytedance/Desktop/code/proactive_survey'))
SITE = Path(__file__).resolve().parents[2]
BIBS = ('custom.bib', 'position_refs.bib')


# ---------- bibliography ----------

def _value(text, i):
    while text[i].isspace():
        i += 1
    if text[i] == '{':
        depth, j = 0, i
        while True:
            depth += {'{': 1, '}': -1}.get(text[j], 0)
            if depth == 0:
                return text[i + 1:j], j + 1
            j += 1
    if text[i] == '"':
        j, depth = i + 1, 0
        while not (text[j] == '"' and depth == 0):
            depth += {'{': 1, '}': -1}.get(text[j], 0)
            j += 1
        return text[i + 1:j], j + 1
    m = re.match(r'[^,}\s]+', text[i:])
    return m.group(0), i + m.end()


def parse_bib(text):
    out = {}
    for m in re.finditer(r'@(\w+)\s*\{\s*([^,\s]+)\s*,', text):
        kind = m.group(1).lower()
        if kind in ('comment', 'string', 'preamble'):
            continue
        fields, i = {'_type': kind}, m.end()
        while i < len(text):
            f = re.match(r'\s*([A-Za-z][\w-]*)\s*=\s*', text[i:])
            if not f:
                break
            value, i = _value(text, i + f.end())
            fields[f.group(1).lower()] = value
            sep = re.match(r'\s*,?', text[i:])
            i += sep.end()
            if re.match(r'\s*\}', text[i:]):
                break
        out.setdefault(m.group(2), fields)
    return out


_BIB = None


def bib():
    global _BIB
    if _BIB is None:
        _BIB = {}
        for name in BIBS:
            for key, entry in parse_bib((PAPER / name).read_text()).items():
                _BIB.setdefault(key, entry)
    return _BIB


# ---------- LaTeX to plain text ----------

GREEK = {'pi': 'π', 'mu': 'μ', 'alpha': 'α', 'beta': 'β', 'tau': 'τ', 'theta': 'θ', 'omega': 'ω',
         'Sigma': 'Σ', 'lambda': 'λ', 'infty': '∞', 'psi': 'ψ', 'phi': 'φ'}
SUP = str.maketrans('0123456789n', '⁰¹²³⁴⁵⁶⁷⁸⁹ⁿ')
SUB = str.maketrans('0123456789', '₀₁₂₃₄₅₆₇₈₉')
CHANNEL_MACROS = {f'\\ch{a}{b}': f'{a}→{b}' for a in 'SMA' for b in 'SMA' if a != b}


def clean(text):
    """Bib fields and short LaTeX fragments to plain text."""
    text = re.sub(r'\\url\{([^}]*)\}', r'\1', text or '')
    text = re.sub(r'\\PIcon\{[^}]*\}', '', text)  # product icon before a name in Table 21
    text = re.sub(r'\\"\{?([a-zA-Z])\}?', lambda m: {'o': 'ö', 'u': 'ü', 'a': 'ä', 'O': 'Ö', 'U': 'Ü', 'A': 'Ä'}.get(m.group(1), m.group(1)), text)
    text = re.sub(r"\\`\{?([a-zA-Z])\}?", lambda m: {'e': 'è', 'a': 'à'}.get(m.group(1), m.group(1)), text)
    text = re.sub(r"\\'\{?([a-zA-Z])\}?", lambda m: {'e': 'é', 'a': 'á', 'o': 'ó', 'i': 'í'}.get(m.group(1), m.group(1)), text)
    text = re.sub(r'\\v\{?([a-zA-Z])\}?', lambda m: {'s': 'š', 'c': 'č', 'z': 'ž', 'S': 'Š'}.get(m.group(1), m.group(1)), text)
    for macro, arrow in CHANNEL_MACROS.items():
        text = re.sub(re.escape(macro) + r'(\{\})?', arrow, text)
    text = text.replace('\\&', '&').replace('\\%', '%').replace('\\_', '_').replace('\\#', '#')
    text = text.replace('---', '–').replace('--', '–').replace('``', '“').replace("''", '”')
    text = text.replace('~', ' ').replace('\\,', ' ').replace('\\ ', ' ')
    text = re.sub(r'\\textsuperscript\{\\dag\}', '†', text)
    text = re.sub(r'\\textsuperscript\{\\S\}', '§', text)
    text = re.sub(r'\\(' + '|'.join(GREEK) + r')(?![a-zA-Z])', lambda m: GREEK[m.group(1)], text)
    text = re.sub(r'\^\{?([0-9n]+)\}?', lambda m: m.group(1).translate(SUP), text)
    text = re.sub(r'_\{?([0-9]+)\}?', lambda m: m.group(1).translate(SUB), text)
    text = re.sub(r'\$([^$]*)\$', r'\1', text)
    text = re.sub(r'\\(?:emph|textbf|textit|mbox|text|mathrm)\{', '{', text)
    text = re.sub(r'\\[a-zA-Z]+\*?\s*', '', text)
    return ' '.join(text.replace('{', '').replace('}', '').split())


def clean_url(text):
    text = re.sub(r'\\url\{([^}]*)\}', r'\1', text or '')
    text = re.sub(r'\\([_%&#~])', r'\1', text)
    return text.replace('{', '').replace('}', '').strip()


def _person(name):
    corporate = name.strip().startswith('{') and name.strip().endswith('}')
    name = clean(name)
    if ',' in name and not corporate:
        last, first = [p.strip() for p in name.split(',', 1)]
        return f'{first} {last}'.strip()
    return name


def authors_short(field):
    people = [p for p in re.split(r'\s+and\s+', field or '') if p.strip() and p.strip() != 'others']
    names = [_person(p) for p in people]
    more = len(names) > 3 or re.search(r'\band\s+others\b', field or '')
    return ', '.join(names[:3]) + (' et al.' if more else '')


ARXIV = re.compile(r'(?:arxiv\.org/(?:abs|pdf)/|arXiv:?\s*)(\d{4}\.\d{4,5})', re.I)
_TABLE_URLS = None


def table_urls():
    """cite key -> the source link that a paper table prints for it (the URL columns of
    the tables in sec/ and the read-mode table's report link), used when the bib entry has none."""
    global _TABLE_URLS
    if _TABLE_URLS is None:
        _TABLE_URLS = {}
        sources = [(path, r'\\TableURL\{([^}]*)\}') for path in sorted((PAPER / 'sec').glob('*.tex'))]
        sources.append((PAPER / 'sec/table_channel_audit.tex', r'\\HaloReportLink\{([^}]*)\}'))
        for path, pattern in sources:
            for line in path.read_text().splitlines():
                m = re.search(pattern, line)
                if m:
                    for key in cite_keys(line):
                        _TABLE_URLS.setdefault(key, m.group(1))
    return _TABLE_URLS


def ref(key):
    """{title, all_authors_short, year, venue, url} for a cite key, as the site's data files use it."""
    entry = bib().get(key)
    if not entry:
        return {}
    out = {'title': clean(entry.get('title', ''))}
    who = authors_short(entry.get('author', ''))
    if who:
        out['all_authors_short'] = who
    if re.fullmatch(r'\d{4}', entry.get('year', '').strip()):
        out['year'] = int(entry['year'])
    howpublished = entry.get('howpublished', '')
    linked = re.search(r'\\url\{([^}]*)\}', howpublished)
    place = entry.get('booktitle') or entry.get('journal') or ('' if linked else howpublished)
    arxiv = ARXIV.search(' '.join(entry.get(f, '') for f in ('eprint', 'journal', 'url', 'note')))
    if place:
        out['venue'] = 'arXiv preprint' if re.match(r'\s*arxiv', place, re.I) else clean(place)
    elif arxiv and entry.get('_type') in ('article', 'misc', 'unpublished'):
        out['venue'] = 'arXiv preprint'
    url = clean_url(entry.get('url', '')) or (clean_url(linked.group(1)) if linked else '')
    if not url and entry.get('doi'):
        url = 'https://doi.org/' + clean_url(entry['doi'])
    if not url and arxiv:
        url = f'https://arxiv.org/abs/{arxiv.group(1)}'
    if not url:
        url = table_urls().get(key, '')
    if url:
        out['url'] = url
    return out


# ---------- labels and numbers from main.aux ----------

_AUX = None


def labels():
    """label -> number string, from the last build's main.aux."""
    global _AUX
    if _AUX is None:
        _AUX = {}
        for m in re.finditer(r'\\newlabel\{([^}]*)\}\{\{([^}]*)\}\{([^}]*)\}', (PAPER / 'main.aux').read_text()):
            _AUX.setdefault(m.group(1), m.group(2))
    return _AUX


def number(label):
    """The current number of a label, from main.aux; a missing label stops the export."""
    if label not in labels():
        raise KeyError(f'{label} is not in main.aux; compile the paper first')
    return labels()[label]


SECREF_RANGE = re.compile(r'\\secrefs\{([^}]*)\}\s*--\s*\\ref\*?\{([^}]*)\}')
SECREFS = re.compile(r'\\secrefs\{([^}]*)\}')
SECREF = re.compile(r'\\secref\{([^}]*)\}')


def resolve_secrefs(text, number_of=number):
    """main.tex defines \\secref{#1} as \\S\\ref*{#1} and \\secrefs{#1} as \\S\\S\\ref*{#1}:
    \\secref{a} becomes '§N' and \\secrefs{a}--\\ref{b} becomes '§§N–M'.
    number_of(label) gives a label's number (by default from main.aux)."""
    text = SECREF_RANGE.sub(lambda m: f'§§{number_of(m.group(1))}–{number_of(m.group(2))}', text)
    text = SECREFS.sub(lambda m: f'§§{number_of(m.group(1))}', text)
    return SECREF.sub(lambda m: f'§{number_of(m.group(1))}', text)


def drop_footnotes(text):
    """Remove each \\footnote{...} (balanced braces) with its content."""
    out, i = [], 0
    for m in re.finditer(r'\\footnote(?![A-Za-z])\s*', text):
        if m.start() < i:
            continue
        j = m.end()
        if j >= len(text) or text[j] != '{':
            continue
        depth = 0
        while j < len(text):
            depth += {'{': 1, '}': -1}.get(text[j], 0)
            if depth == 0:
                break
            j += 1
        out.append(text[i:m.start()])
        i = j + 1
    out.append(text[i:])
    return ''.join(out)


def prose(text):
    """A paragraph of the paper as plain text for the site: citations and footnotes dropped,
    cross-references resolved to the current numbers, LaTeX removed."""
    text = re.sub(r'%.*', '', text)
    text = re.sub(r'\\label\{[^}]*\}', '', text)
    text = drop_footnotes(text)
    text = re.sub(r'~?\\cite[pt]?\*?(\[[^\]]*\])?\{[^}]*\}', '', text)
    text = resolve_secrefs(text)
    def sec(m):
        number = labels().get(m.group(2), '?')
        return f'§{number}'
    text = re.sub(r'(Sections?|Section)~\\ref\{([^}]*)\}', sec, text)
    text = re.sub(r'(Table|Figure|Eq\.)~\\(?:eq)?ref\{([^}]*)\}', lambda m: f'{m.group(1)} {labels().get(m.group(2), "?")}', text)
    text = re.sub(r'\\eqref\{([^}]*)\}', lambda m: f'({labels().get(m.group(1), "?")})', text)
    out = clean(text)
    return re.sub(r'\s+([,.;:)])', r'\1', out)


def split_cells(row):
    """Split one tabular row on top-level &."""
    cells, depth, cur = [], 0, ''
    for ch in row:
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
        if ch == '&' and depth == 0 and not cur.endswith('\\'):
            cells.append(cur)
            cur = ''
        else:
            cur += ch
    cells.append(cur)
    return [c.strip() for c in cells]


def cite_keys(text):
    keys = []
    for m in re.finditer(r'\\cite[pt]?\*?(?:\[[^\]]*\])?\{([^}]*)\}', text):
        keys += [k.strip() for k in m.group(1).split(',') if k.strip()]
    return keys
