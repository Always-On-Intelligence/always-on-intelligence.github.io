#!/usr/bin/env python3
"""Regenerate site/data/applications.json from the survey's systems table and Section 6.1.

Usage:
    python3 tools/paper/export_applications.py [PAPER_DIR] [-o OUTPUT]

PAPER_DIR defaults to /Users/bytedance/Desktop/code/proactive_survey and is only read.
OUTPUT defaults to site/data/applications.json in this repository; "-" writes to stdout.

Sources read from PAPER_DIR:
    sec/table_system_landscape.tex   systems table (tab:representative-systems): rows, caption, notes
    sec/07_integrated_systems.tex    Section 6.1: domain descriptions, bottlenecks, and patterns
                                     across domains when 6.1 has such a subsubsection (else empty)
    main.tex                         order of the bibliography files
    custom.bib, position_refs.bib    references (the first definition of a key wins, as in BibTeX)
    main.aux                         current section and table numbers (compile the paper first)

Standard library only, and the output is deterministic. Domain, participant and horizon
names are read from the table's legend note, capitalised. Any LaTeX the script cannot
convert stops the export with an error instead of leaking into the site data.
"""
import argparse
import json
import re
import sys
import unicodedata
from pathlib import Path

from paper_common import resolve_secrefs

DEFAULT_PAPER = Path('/Users/bytedance/Desktop/code/proactive_survey')
DEFAULT_OUTPUT = Path(__file__).resolve().parents[2] / 'site' / 'data' / 'applications.json'
TABLE_TEX = 'sec/table_system_landscape.tex'
SECTION_TEX = 'sec/07_integrated_systems.tex'
LANDSCAPE_SUBSECTION = 'Applications and Bottlenecks'
BOTTLENECK_PARAGRAPH = re.compile(r'\\paragraph\{Bottlenecks[^}]*\}')
EM_DASH = '\u2014'


class ExportError(Exception):
    pass


def fail(message):
    raise ExportError(message)


# ---------------------------------------------------------------- TeX structure

def read_group(text, i):
    """text[i] is '{'; return (content, index after the matching '}')."""
    if i >= len(text) or text[i] != '{':
        fail(f'expected a brace group at {text[i:i + 50]!r}')
    depth, j = 0, i
    while j < len(text):
        c = text[j]
        if c == '\\':
            j += 2
            continue
        if c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0:
                return text[i + 1:j], j + 1
        j += 1
    fail(f'unbalanced braces after {text[i:i + 50]!r}')


def command_groups(text, name):
    """Every argument of \\name{...} in text, in order."""
    out = []
    for m in re.finditer(r'\\' + name + r'(?![A-Za-z])\s*(?=\{)', text):
        out.append(read_group(text, m.end())[0])
    return out


def command_args(text, name, count):
    """The first count brace arguments of the first \\name in text."""
    m = re.search(r'\\' + name + r'(?![A-Za-z])', text)
    if not m:
        fail(f'no \\{name} in {text[:60]!r}')
    args, i = [], m.end()
    for _ in range(count):
        while text[i].isspace():
            i += 1
        arg, i = read_group(text, i)
        args.append(arg)
    return args


def unwrap(text, names):
    """Replace \\name{content} by content for the given commands, innermost last."""
    pattern = re.compile(r'\\(?:' + '|'.join(names) + r')(?![A-Za-z])\s*(?=\{)')
    while True:
        m = pattern.search(text)
        if not m:
            return text
        content, end = read_group(text, m.end())
        text = text[:m.start()] + content + text[end:]


def split_top(text, separator):
    """Split text on a regex separator that occurs outside braces (and is not escaped)."""
    parts, depth, start, i = [], 0, 0, 0
    while i < len(text):
        c = text[i]
        if c == '\\':
            i += 2
            continue
        if c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
        elif depth == 0:
            m = separator.match(text, i)
            if m and m.end() > i:
                parts.append(text[start:i])
                start = i = m.end()
                continue
        i += 1
    parts.append(text[start:])
    return parts


def strip_comments(text):
    """TeX drops a comment together with the line break after it."""
    return re.sub(r'(?<!\\)%[^\n]*\n?', '', text)


# ---------------------------------------------------------------- TeX to plain text

GREEK = {
    'alpha': 'α', 'beta': 'β', 'gamma': 'γ', 'delta': 'δ', 'Delta': 'Δ', 'epsilon': 'ε', 'eta': 'η',
    'theta': 'θ', 'kappa': 'κ', 'lambda': 'λ', 'mu': 'μ', 'pi': 'π', 'rho': 'ρ', 'sigma': 'σ',
    'Sigma': 'Σ', 'tau': 'τ', 'phi': 'φ', 'psi': 'ψ', 'omega': 'ω', 'Omega': 'Ω',
}
SYMBOLS = {
    'to': '→', 'rightarrow': '→', 'leftarrow': '←', 'times': '×', 'cdot': '·', 'dag': '†',
    'le': '≤', 'leq': '≤', 'ge': '≥', 'geq': '≥', 'infty': '∞', 'in': '∈',
}
SUPERSCRIPT = str.maketrans('0123456789+-n', '⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻ⁿ')
ACCENT_MARKS = {
    '"': '\u0308', "'": '\u0301', '`': '\u0300', '^': '\u0302', '~': '\u0303', '=': '\u0304',
    '.': '\u0307', 'u': '\u0306', 'v': '\u030c', 'H': '\u030b', 'c': '\u0327', 'k': '\u0328',
    'r': '\u030a',
}
LETTERS = {'o': 'ø', 'O': 'Ø', 'ss': 'ß', 'ae': 'æ', 'AE': 'Æ', 'oe': 'œ', 'OE': 'Œ', 'aa': 'å',
           'AA': 'Å', 'l': 'ł', 'L': 'Ł'}
NO_TEXT = ('FloatBarrier', 'noindent', 'par', 'medskip', 'smallskip', 'bigskip', 'newpage', 'clearpage')
# main.tex: \chSM ... \chAM are \chedge{X}{Y}, the channel X→Y, in text and in math.
CHANNEL = re.compile(r'\\ch([SMA])([SMA])(?![A-Za-z])(?:\s*\{\})?')


def channels(text):
    return CHANNEL.sub(r'\1→\2', text)


def math_text(math):
    """Inline math as the site writes it: π_S, M→A, θ_t; c_t, Pro²Assist."""
    math = channels(unwrap(math, ['text', 'textrm', 'mathrm', 'mathit', 'mathbf', 'boldsymbol', 'mbox']))

    def word(m):
        name = m.group(1)
        if name in GREEK:
            return GREEK[name]
        if name in SYMBOLS:
            return SYMBOLS[name]
        fail(f'unknown math command \\{name} in ${math}$')

    math = re.sub(r'\\([A-Za-z]+)', word, math)
    math = re.sub(r'\\[!,;: ]', lambda m: '' if m.group(0) == '\\!' else ' ', math)
    math = re.sub(r'\^\{?([0-9n+-]+)\}?', lambda m: m.group(1).translate(SUPERSCRIPT), math)
    math = re.sub(r'_\{([^{}]*)\}', r'_\1', math)
    math = re.sub(r'\s*([,;])\s*', r'\1 ', math)
    return ' '.join(math.split())


def accents(text):
    def accented(m):
        letter = 'i' if m.group(2) == '\\i' else m.group(2)
        return unicodedata.normalize('NFC', letter + ACCENT_MARKS[m.group(1)])

    text = re.sub(r'\\(["\'`^~=.])\s*\{?\s*(\\i(?![A-Za-z])|[A-Za-z])\s*\}?', accented, text)
    text = re.sub(r'\\([uvHckr])\{\s*(\\i(?![A-Za-z])|[A-Za-z])\s*\}', accented, text)
    return re.sub(r'\\(ss|ae|AE|oe|OE|aa|AA|o|O|l|L)(?![A-Za-z])\s*', lambda m: LETTERS[m.group(1)], text)


def drop_citations(text):
    """Remove \\citep{...} with the tie or space before it; the sentence keeps any system name."""
    def repl(m):
        if m.group(1) not in ('', 'p'):
            fail(f'\\cite{m.group(1)} prints words that would be lost: {m.group(0).strip()!r}')
        return ''
    return re.sub(r'(?:~|\s)*\\cite([a-z]*)\*?(?:\[[^\]]*\])*\{[^}]*\}', repl, text)


def resolve_refs(text, labels):
    def number(label):
        if label not in labels:
            fail(f'label {label} is not in main.aux; compile the paper first')
        return labels[label]

    text = resolve_secrefs(text, number)
    text = re.sub(r'Sections~\\ref\{([^}]+)\}--\\ref\{([^}]+)\}',
                  lambda m: f'§§{number(m.group(1))}–{number(m.group(2))}', text)
    text = re.sub(r'Section~\\ref\{([^}]+)\}', lambda m: '§' + number(m.group(1)), text)
    # The site shows these tables itself, so it names them instead of numbering them.
    text = re.sub(r'Table~\\ref\{(tab:representative-systems|tab:application-bottlenecks)\}', 'the systems table', text)
    text = re.sub(r'Table~\\ref\{tab:channel-evidence\}', lambda m: 'the HALO read-mode table (§' + number('sec:halo:results') + ')', text)
    text = re.sub(r'(Table|Figure)~\\ref\{([^}]+)\}', lambda m: f'{m.group(1)} {number(m.group(2))}', text)
    if '\\ref' in text:
        fail(f'unhandled \\ref form in {" ".join(text.split())[:160]!r}')
    return text


def tex_text(text, labels=None, protect_braces=False):
    """One paragraph or cell of LaTeX as plain text."""
    text = re.sub(r'\\label\{[^}]*\}', '', text)
    text = drop_citations(text)
    text = resolve_refs(text, labels or {})
    text = re.sub(r'\\textsuperscript\{\s*\\dag\s*\}|\\dag(?![A-Za-z])', '†', text)
    text = re.sub(r'\\(?:' + '|'.join(NO_TEXT) + r')(?![A-Za-z])', ' ', text)
    text = re.sub(r'(?<!\\)\$([^$]*)\$', lambda m: math_text(m.group(1)), text)
    text = channels(text)
    text = accents(text)
    text = unwrap(text, ['emph', 'textbf', 'textit', 'textrm', 'textsc', 'texttt', 'mbox', 'text', 'url'])
    if protect_braces:
        text = text.replace('{', '').replace('}', '')
    text = text.replace('---', EM_DASH).replace('--', '–').replace('``', '“').replace("''", '”')
    text = re.sub(r'\\[,;: ]', ' ', text).replace('~', ' ')
    text = re.sub(r'\\([&%_#])', r'\1', text)
    leftover = re.search(r'[\\{}$~]', text)
    if leftover:
        fail(f'LaTeX left in {text!r}')
    return ' '.join(text.split())


def paragraphs(block, labels):
    out = [tex_text(p, labels) for p in re.split(r'\n\s*\n', block)]
    return '\n\n'.join(p for p in out if p)


# ---------------------------------------------------------------- paper inputs

def read_labels(aux_text):
    """label -> (number, title) from main.aux."""
    labels, titles = {}, {}
    for m in re.finditer(r'\\newlabel\{([^}]+)\}\{\{([^{}]*)\}\{([^{}]*)\}', aux_text):
        labels.setdefault(m.group(1), m.group(2))
        try:
            titles.setdefault(m.group(1), read_group(aux_text, m.end())[0])
        except ExportError:
            pass
    return labels, titles


def parse_bib(text):
    """Minimal BibTeX reader (after analysis/awesome-sync/bibparse.py): key -> fields, first definition wins."""
    def value(i):
        while text[i].isspace():
            i += 1
        if text[i] == '{':
            content, end = read_group(text, i)
            return content, end
        if text[i] == '"':
            j, depth = i + 1, 0
            while not (text[j] == '"' and depth == 0):
                depth += text[j] == '{'
                depth -= text[j] == '}'
                j += 1
            return text[i + 1:j], j + 1
        m = re.match(r'[^,}\s]+', text[i:])
        return m.group(0), i + m.end()

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
            v, i = value(i + f.end())
            fields[f.group(1).lower()] = ' '.join(v.split())
            i += re.match(r'\s*,?', text[i:]).end()
            if text[i:].lstrip().startswith('}'):
                break
        out.setdefault(m.group(2), fields)
    return out


def read_bib(paper):
    main = (paper / 'main.tex').read_text(encoding='utf-8')
    m = re.search(r'^[^%\n]*\\bibliography\{([^}]+)\}', main, re.M)
    if not m:
        fail('no \\bibliography in main.tex')
    entries = {}
    for name in m.group(1).split(','):
        path = paper / (name.strip() + '.bib')
        for key, fields in parse_bib(path.read_text(encoding='utf-8')).items():
            entries.setdefault(key, fields)
    return entries


# ---------------------------------------------------------------- references

ARXIV = re.compile(r'(?:arxiv\.org/(?:abs|pdf|html)/|arXiv:?\s*)(\d{4}\.\d{4,5})', re.I)
AND = re.compile(r'\s+and\s+')


def clean_url(text):
    text = re.sub(r'\\url\{([^}]*)\}', r'\1', text or '')
    text = re.sub(r'\\([_%&#~])', r'\1', text)
    return text.replace('{', '').replace('}', '').strip()


def arxiv_id(entry):
    if entry.get('archiveprefix', '').lower() == 'arxiv' and re.fullmatch(r'\d{4}\.\d{4,5}', entry.get('eprint', '')):
        return entry['eprint']
    for field in ('eprint', 'url', 'journal', 'booktitle', 'howpublished', 'note'):
        m = ARXIV.search(entry.get(field, ''))
        if m:
            return m.group(1)
    return None


def person(name):
    name = name.strip()
    if name.startswith('{') and read_group(name, 0)[1] == len(name):
        return tex_text(name, protect_braces=True)  # corporate author such as {OpenAI}
    parts = [p.strip() for p in split_top(name, re.compile(r'\s*,\s*'))]
    if len(parts) > 1:
        name = ' '.join([parts[-1], parts[0]]) + ''.join(', ' + p for p in parts[1:-1])
    return tex_text(name, protect_braces=True)


def authors_short(field):
    names = [n for n in split_top(field, AND) if n.strip()]
    real = [n for n in names if n.strip() != 'others']
    text = ', '.join(person(n) for n in real[:3])
    return text + (' et al.' if len(real) > 3 or len(real) < len(names) else '')


def venue(entry):
    for field in ('journal', 'booktitle', 'howpublished'):
        value = entry.get(field, '')
        if not value or re.search(r'\\url|https?://', value):
            continue
        if re.match(r'arxiv\b', value, re.I):
            return 'arXiv preprint'
        return tex_text(value, protect_braces=True)
    return 'arXiv preprint' if arxiv_id(entry) else None


def reference(entry, table_url):
    """{title, all_authors_short, year, venue, url}; returns (ref, where the url came from)."""
    url, source = entry.get('url'), 'bib url'
    if not url:
        for field in ('howpublished', 'note'):
            m = re.search(r'\\url\{([^}]*)\}', entry.get(field, ''))
            if m:
                url = m.group(1)
                break
    if url:
        url = clean_url(url)
    elif entry.get('doi'):
        url, source = 'https://doi.org/' + re.sub(r'^https?://(dx\.)?doi\.org/', '', clean_url(entry['doi'])), 'doi'
    elif arxiv_id(entry):
        url, source = f'https://arxiv.org/abs/{arxiv_id(entry)}', 'arxiv id'
    elif table_url:
        url, source = table_url, 'table URL column'
    else:
        source = None
    ref = {'title': tex_text(entry.get('title', ''), protect_braces=True),
           'all_authors_short': authors_short(entry.get('author', ''))}
    year = entry.get('year', '')
    ref['year'] = int(year) if year.isdigit() else year
    v = venue(entry)
    if v:
        ref['venue'] = v
    if url:
        ref['url'] = url
    return ref, source


# ---------------------------------------------------------------- systems table

SCOPE_LEGEND = ('interaction domain', 'participant scope', 'outcome horizon')


def legend(notes_tex):
    """Codes of the Scope column (interaction domain icon, participant scope, outcome horizon)
    -> site names, from the table's legend note: 'Scope: interaction domain \\LandscapeIcon{robot}
    physical, ...; participant scope \\textbf{I} individual, ...; outcome horizon \\textbf{s}
    within-session, ..., \\textbf{--} not reported.'"""
    note = next((n for n in notes_tex if '\\LandscapeIcon' in n and all(p in n for p in SCOPE_LEGEND)), None)
    if note is None:
        fail(f'no legend note with \\LandscapeIcon and {", ".join(SCOPE_LEGEND)} in the systems table')
    name = lambda gloss: gloss[0].upper() + gloss[1:]

    def part(label, end):
        m = re.search(re.escape(label) + r'\s+(.*?)' + end, note, re.S)
        if not m:
            fail(f'legend for the {label} not found in {note!r}')
        return [p.strip() for p in split_top(m.group(1), re.compile(r'\s*,\s*'))]

    domains, scopes, horizons = {}, {}, {}
    for entry in part('interaction domain', ';'):
        m = re.fullmatch(r'\\LandscapeIcon\{(\w+)\}\s*(.+)', entry, re.S)
        if not m:
            fail(f'cannot read the domain legend entry {entry!r}')
        domains[m.group(1)] = name(m.group(2).strip())
    for target, label, end in ((scopes, 'participant scope', ';'), (horizons, 'outcome horizon', r'\.')):
        for entry in part(label, end):
            m = re.fullmatch(r'\\textbf\{([^{}]+)\}\s*(.+)', entry, re.S)
            if not m:
                fail(f'cannot read the {label} legend entry {entry!r}')
            target[m.group(1)] = name(m.group(2).strip())
    return domains, scopes, horizons


def table_rows(body):
    """(group, cells) for each row between \\midrule and \\bottomrule."""
    m = re.search(r'\\midrule(.*?)\\bottomrule', body, re.S)
    if not m:
        fail('systems table body not found')
    rows, group = [], None
    for chunk in re.split(r'\\\\\s*(?:\n|$)', m.group(1)):
        chunk = chunk.strip()
        while chunk.startswith('\\LandscapeSection'):
            heading, end = read_group(chunk, re.match(r'\\LandscapeSection\s*', chunk).end())
            group, chunk = heading.strip(), chunk[end:].strip()
        if not chunk:
            continue
        cells = [c.strip() for c in split_top(chunk, re.compile('&'))]
        if len(cells) != 6:
            fail(f'expected 6 cells, got {len(cells)} in {chunk[:80]!r}')
        if group is None:
            fail(f'row before any \\LandscapeSection: {chunk[:60]!r}')
        rows.append((group, cells))
    return rows


def export(paper):
    labels, label_titles = read_labels((paper / 'main.aux').read_text(encoding='utf-8'))
    bib = read_bib(paper)
    table = strip_comments((paper / TABLE_TEX).read_text(encoding='utf-8'))
    report = {'url_fallback': [], 'products': [], 'em_dash': []}

    caption = tex_text(read_group(table, table.index('\\caption{') + len('\\caption'))[0], labels)
    notes_tex = command_groups(table, 'TableNote')
    domain_names, scope_names, horizon_names = legend(notes_tex)
    notes = [tex_text(re.sub(r'\\LandscapeIcon\{(\w+)\}', r'[\1 icon]', n), labels) for n in notes_tex]

    groups, order = {}, []
    for group, (system, regime, mechanism, bottleneck, framework, url_cell) in table_rows(table):
        system = unwrap(system, ['mbox'])
        keys = [k.strip() for c in command_groups(system, 'citep') for k in c.split(',') if k.strip()]
        if not keys:
            fail(f'no citation key in {system!r}')
        name = tex_text(re.sub(r'\\textsuperscript\{\s*\\dag\s*\}', '', system))
        if '\\dag' in system:
            report['products'].append(name)
        icons, scope, horizon = (a.strip() for a in command_args(regime, 'LandscapeRegime', 3))
        icons = re.findall(r'\\LandscapeIcon\{(\w+)\}', icons)
        missing = [c for c in icons if c not in domain_names] + \
                  [c for c in scope.split('/') if c not in scope_names] + \
                  ([horizon] if horizon not in horizon_names else [])
        if missing:
            fail(f'{name}: codes {missing} are not in the table legend')
        domains = [domain_names[c] for c in icons]
        if group not in domains:
            fail(f'{name} sits in the {group} group but its icons say {domains}')
        for key in keys:
            if key not in bib:
                fail(f'{name}: cite key {key} is not in the bibliography')
        table_url = command_groups(url_cell, 'TableURL')
        table_code = command_groups(url_cell, 'TableCode')
        ref, source = reference(bib[keys[0]], clean_url(table_url[0]) if table_url else None)
        if source != 'bib url':
            report['url_fallback'].append(f'{name} ({keys[0]}): {source}')
        work = {
            'name': name,
            'key': keys[0],
            'keys': keys,
            'domains': domains,
            'participants': [scope_names[c] for c in scope.split('/')],
            'horizon': horizon_names[horizon],
            'regime': f'{"/".join(domains)} × {scope} × {tex_text(horizon)}',
            'mechanism': tex_text(mechanism),
            'bottleneck': tex_text(bottleneck),
            'framework': tex_text(framework),
            'ref': ref,
            # the links the table's URL column prints: the work, and its code when released
            'url': clean_url(table_url[0]) if table_url else None,
            'code': clean_url(table_code[0]) if table_code else None,
        }
        if group not in groups:
            groups[group] = []
            order.append(group)
        groups[group].append(work)

    # Section 6.1: one subsubsection per domain (with its bottleneck paragraph), then, if the
    # paper has one, a subsubsection of patterns across domains.
    source = strip_comments((paper / SECTION_TEX).read_text(encoding='utf-8'))
    m = re.search(r'\\subsection\{' + re.escape(LANDSCAPE_SUBSECTION) + r'\}(.*?)(?=\\(?:sub)?section\{)', source, re.S)
    if not m:
        fail(f'subsection "{LANDSCAPE_SUBSECTION}" not found in {SECTION_TEX}')
    parts = re.split(r'\\subsubsection\{', m.group(1))[1:]
    domain_parts, other_parts = [], []
    for part in parts:
        title, end = read_group('{' + part, 0)
        body = part[end - 1:]
        label = re.match(r'\s*\\label\{([^}]+)\}', body)
        if not label or label.group(1) not in labels:
            fail(f'subsubsection "{title}" has no label in main.aux')
        aux_title = tex_text(label_titles.get(label.group(1), ''), protect_braces=True)
        if aux_title and aux_title != tex_text(title):
            fail(f'main.aux is stale: {label.group(1)} is "{aux_title}" there but "{title}" in the source')
        item = (tex_text(title), labels[label.group(1)], body)
        (domain_parts if BOTTLENECK_PARAGRAPH.search(body) else other_parts).append(item)
    if len(domain_parts) != len(order) or len(other_parts) > 1:
        fail(f'expected {len(order)} domain subsubsections and at most one patterns subsubsection in 6.1')

    out_groups = []
    for domain, (title, number, body) in zip(order, domain_parts):
        if domain.lower() not in title.lower():
            fail(f'table group {domain} does not match subsubsection "{title}"')
        description, bottleneck = BOTTLENECK_PARAGRAPH.split(body, maxsplit=1)
        out_groups.append({
            'domain': domain,
            'section': number,
            'title': title,
            'description': paragraphs(description, labels),
            'bottleneck': paragraphs(bottleneck, labels),
            'works': groups[domain],
        })
    # The fields stay in the schema; without a patterns subsubsection they are empty strings.
    patterns_title, patterns_number, patterns = '', '', ''
    if other_parts:
        patterns_title, patterns_number, patterns_body = other_parts[0]
        patterns = paragraphs(patterns_body, labels)
    else:
        report['no_patterns'] = True

    data = {
        'caption': caption,
        'notes': notes,
        'groups': out_groups,
        'patterns': patterns,
        'patternsHeading': patterns_title,
        'patternsSection': patterns_number,
    }

    def scan(value, path):
        if isinstance(value, dict):
            for k, v in value.items():
                scan(v, f'{path}.{k}')
        elif isinstance(value, list):
            for i, v in enumerate(value):
                scan(v, f'{path}[{i}]')
        elif isinstance(value, str) and EM_DASH in value:
            report['em_dash'].append(path)

    scan(data, 'applications')
    return data, report


def main():
    parser = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    parser.add_argument('paper', nargs='?', type=Path, default=DEFAULT_PAPER, help='survey repository (read only)')
    parser.add_argument('-o', '--output', default=str(DEFAULT_OUTPUT), help='output JSON path, or - for stdout')
    args = parser.parse_args()
    try:
        data, report = export(args.paper.expanduser().resolve())
    except (ExportError, OSError) as error:
        sys.exit(f'export_applications: {error}')
    text = json.dumps(data, ensure_ascii=False, indent=1)
    if args.output == '-':
        sys.stdout.write(text + '\n')
    else:
        Path(args.output).write_text(text, encoding='utf-8')
    counts = ', '.join(f'{g["domain"]} {len(g["works"])}' for g in data['groups'])
    print(f'applications: {sum(len(g["works"]) for g in data["groups"])} rows ({counts})', file=sys.stderr)
    print(f'  product rows (\\dag in the table): {", ".join(report["products"]) or "none"}', file=sys.stderr)
    for line in report['url_fallback']:
        print(f'  url not from the bib url field: {line}', file=sys.stderr)
    if report['em_dash']:
        print(f'  em-dash in the paper text at: {", ".join(report["em_dash"])}', file=sys.stderr)
    if report.get('no_patterns'):
        print('  6.1 has no patterns subsubsection: patterns, patternsHeading and patternsSection are empty', file=sys.stderr)


if __name__ == '__main__':
    main()
