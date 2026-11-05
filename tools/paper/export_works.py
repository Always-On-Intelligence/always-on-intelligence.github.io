"""Export site/data/works.json, the index of every work cited in the paper's tables.

Sources in the paper (read only): main.tex and every file it reaches through
\\input, main.aux of the last build (table numbers and pages), and the two
bibliographies custom.bib and position_refs.bib.

Each table whose rows cite works becomes an entry of `tables`; each cited key
becomes an entry of `works` with one placement per table row that cites it.
Three fields come from specific tables:
  level        tab:closure-worked, the highest level at which a row places the work
               (levelNote quotes the table note when that placement is conditional)
  application  tab:representative-systems, the Scope column (interaction domain,
               participant scope, outcome horizon) spelled out with the table's legend,
               plus key method, bottleneck and framework
  audit        tab:channel-evidence, the five channel marks (● reported, ○ explicitly
               absent, ◐ unreported or insufficiently specified) and the five steps of
               the chain of evidence; a work with several rows keeps every row as a
               placement, and its audit takes the strongest mark per channel (● over ○
               over ◐) and a step as stated when any row states it
`channels` lists the channels marked reported in the audit plus the channel that
heads a coupling table's group; `modules` lists the modules of the tables that
place the work (HALO is shown through `audit`).

Standard library only. The BibTeX reader follows analysis/awesome-sync/bibparse.py
and the LaTeX-to-text rules extend analysis/awesome-sync/metadata.py:clean().

    python3 tools/paper/export_works.py [PAPER_DIR] [--out PATH] [--generated YYYY-MM-DD] [--check]

PAPER_DIR defaults to $PAPER_DIR or /Users/bytedance/Desktop/code/proactive_survey.
The output depends only on the paper's files and the --generated date (default:
today), so two runs on the same inputs give identical bytes. --check exits 1
when the output file differs from a fresh export.
"""
import argparse
import datetime
import json
import os
import re
import sys
import unicodedata
from collections import Counter
from pathlib import Path

from paper_common import resolve_secrefs

SITE = Path(__file__).resolve().parents[2]
DEFAULT_PAPER = Path(os.environ.get('PAPER_DIR', '/Users/bytedance/Desktop/code/proactive_survey'))
DEFAULT_OUT = SITE / 'site/data/works.json'
BIBS = ('custom.bib', 'position_refs.bib')

MODULE_OF_SECTION = {'sec:sensing': 'Sensing', 'sec:memory': 'Memory', 'sec:action': 'Action',
                     'sec:systems': 'Systems', 'sec:halo': 'HALO'}
MODULE_ORDER = ['Sensing', 'Memory', 'Action', 'Systems']
CHANNEL_ORDER = ['S→M', 'M→A', 'A→S', 'M→S', 'A→M']
# Kinds as the site has named them since the first export; other tables fall back to
# the label suffix and then to the caption.
KIND_OF_LABEL = {'tab:concurrent-surveys': 'Concurrent surveys', 'tab:representative-systems': 'Applications',
                 'tab:closure-worked': 'Levels', 'tab:channel-evidence': 'Channel audit'}
KIND_OF_SUFFIX = [('-methods', 'Space'), ('-policy', 'Policy'), ('-loop-coverage', 'Coupling'),
                  ('-benchmarks', 'Evaluation')]
LEVEL_TABLE, APPLICATION_TABLE, AUDIT_TABLE = 'tab:closure-worked', 'tab:representative-systems', 'tab:channel-evidence'
LINK_COLUMNS = ('URL', 'Source')
# Within a domain band, rows above the first \ClosureKind are research systems
# (the closure table's caption: "we separate research systems from products").
DEFAULT_SUBGROUP = 'Research systems'
ICONS = {'robot': 'Physical', 'glasses': 'Wearable', 'computer': 'Digital'}
MARKERS = '†‡§⋆'
MARK_RANK = {'●': 2, '○': 1, '◐': 0}  # \HaloPartial (◐) replaced the old '-' mark
CHAIN_STEPS = ['record', 'outcome', 'attribution', 'revision', 'later_use']

WARNINGS = []
# label -> number from main.aux, filled by read_tables(); \secref and \secrefs resolve against it.
LABEL_NUMBERS = {}


def warn(message):
    if message not in WARNINGS:
        WARNINGS.append(message)


def label_number(label):
    if label not in LABEL_NUMBERS:
        raise RuntimeError(f'{label} is not in main.aux; rebuild the paper')
    return LABEL_NUMBERS[label]


# ---------------------------------------------------------------- TeX sources

def strip_comments(text):
    out = []
    for line in text.split('\n'):
        start = 0
        while (j := line.find('%', start)) >= 0:
            k = j
            while k > 0 and line[k - 1] == '\\':
                k -= 1
            if (j - k) % 2 == 0:
                line = line[:j]
                break
            start = j + 1
        out.append(line)
    return '\n'.join(out)


def tex_file(root, name):
    return root / (name if name.endswith('.tex') else name + '.tex')


SOURCES = []


def expand_inputs(root, name, depth=0):
    """main.tex with every \\input that exists replaced by its file, comments removed."""
    SOURCES.append(tex_file(root, name))
    text = strip_comments(tex_file(root, name).read_text(encoding='utf-8'))
    if depth > 20:
        raise RuntimeError('\\input nesting too deep')

    def include(m):
        target = m.group(1).strip()
        if not tex_file(root, target).exists():
            warn(f'\\input{{{target}}} not found, left out')
            return ''
        return expand_inputs(root, target, depth + 1)
    return re.sub(r'\\input\s*\{([^}]+)\}', include, text)


def group_end(s, i):
    """s[i] is '{'; the index just past its matching '}'."""
    depth, j, n = 0, i, len(s)
    while j < n:
        c = s[j]
        if c == '\\':
            j += 2
            continue
        if c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0:
                return j + 1
        j += 1
    raise ValueError(f'unbalanced braces near {s[i:i + 60]!r}')


def skip_space(s, i):
    while i < len(s) and s[i] in ' \t\n\r':
        i += 1
    return i


def read_arg(s, i):
    """One mandatory argument at s[i:]: (content, next index)."""
    i = skip_space(s, i)
    if i >= len(s):
        return '', i
    if s[i] == '{':
        end = group_end(s, i)
        return s[i + 1:end - 1], end
    if s[i] == '\\':
        m = re.compile(r'\\(?:[A-Za-z]+|.)').match(s, i)
        return m.group(0), m.end()
    return s[i], i + 1


def read_opt(s, i):
    """An optional [..] argument at s[i:]: (content or None, next index)."""
    j = skip_space(s, i)
    if j < len(s) and s[j] == '[':
        depth = 0
        for k in range(j + 1, len(s)):
            if s[k] == '{':
                depth += 1
            elif s[k] == '}':
                depth -= 1
            elif s[k] == ']' and depth == 0:
                return s[j + 1:k], k + 1
    return None, i


def read_args(s, i, spec):
    """Arguments by spec, e.g. 'om' = one optional then one mandatory."""
    out = []
    for kind in spec:
        if kind == 'o':
            value, i = read_opt(s, i)
        else:
            value, i = read_arg(s, i)
        out.append(value)
    return out, i


def split_spans(s, pattern):
    """(start, end) of the parts of s between matches of `pattern` at brace depth 0, outside math."""
    rx = re.compile(pattern)
    spans, depth, math, start, i, n = [], 0, False, 0, 0, len(s)
    while i < n:
        c = s[i]
        if depth == 0 and not math:
            m = rx.match(s, i)
            if m and m.end() > i:
                spans.append((start, i))
                start = i = m.end()
                continue
        if c == '\\':
            i += 2
            continue
        if c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
        elif c == '$' and depth == 0:
            math = not math
        i += 1
    spans.append((start, n))
    return spans


def split_top(s, pattern):
    return [s[a:b] for a, b in split_spans(s, pattern)]


def command_groups(s, name):
    """The first argument of every \\name in s."""
    out = []
    for m in re.finditer(r'\\' + name + r'(?![A-Za-z])', s):
        _, i = read_opt(s, m.end())
        value, _ = read_arg(s, i)
        out.append(value)
    return out


# ---------------------------------------------------------------- LaTeX to plain text

GREEK = {'alpha': 'α', 'beta': 'β', 'gamma': 'γ', 'delta': 'δ', 'epsilon': 'ε', 'varepsilon': 'ε', 'zeta': 'ζ',
         'eta': 'η', 'theta': 'θ', 'kappa': 'κ', 'lambda': 'λ', 'mu': 'μ', 'nu': 'ν', 'xi': 'ξ', 'pi': 'π',
         'rho': 'ρ', 'sigma': 'σ', 'tau': 'τ', 'phi': 'φ', 'varphi': 'φ', 'chi': 'χ', 'psi': 'ψ', 'omega': 'ω',
         'Gamma': 'Γ', 'Delta': 'Δ', 'Theta': 'Θ', 'Lambda': 'Λ', 'Pi': 'Π', 'Sigma': 'Σ', 'Phi': 'Φ',
         'Psi': 'Ψ', 'Omega': 'Ω'}
SYMBOLS = {'dag': '†', 'ddag': '‡', 'S': '§', 'P': '¶', 'star': '⋆', 'to': '→', 'rightarrow': '→',
           'leftarrow': '←', 'leftrightarrow': '↔', 'Rightarrow': '⇒', 'times': ' × ', 'cdot': '·',
           'ldots': '…', 'dots': '…', 'cdots': '…', 'textendash': '–', 'textemdash': '—', 'infty': '∞',
           'pm': '±', 'approx': '≈', 'sim': '∼', 'leq': '≤', 'le': '≤', 'geq': '≥', 'ge': '≥', 'neq': '≠',
           'notin': '∉',
           'checkmark': '✓', 'copyright': '©', 'textregistered': '®', 'texttrademark': '™', 'textbullet': '•',
           'aa': 'å', 'AA': 'Å', 'ae': 'æ', 'AE': 'Æ', 'o': 'ø', 'O': 'Ø', 'oe': 'œ', 'OE': 'Œ', 'ss': 'ß',
           'l': 'ł', 'L': 'Ł', 'i': 'i', 'j': 'j', 'textquoteright': '’', 'textquoteleft': '‘',
           'chSM': 'S→M', 'chMS': 'M→S', 'chMA': 'M→A', 'chAM': 'A→M', 'chAS': 'A→S', 'chSA': 'S→A',
           'HaloReported': '●', 'HaloAbsent': '○', 'HaloPartial': '◐', 'HaloUnreported': '◌',
           'HaloStep': '■', 'HaloNoStep': '·'}
SPACES = {'par', 'newline', 'linebreak', 'quad', 'qquad', 'enspace', 'enskip', 'space', 'hfill', 'thinspace',
          'medspace', 'thickspace', 'nobreakspace', 'cr'}
DROP = {'centering', 'raggedright', 'raggedleft', 'strut', 'tiny', 'scriptsize', 'footnotesize', 'small',
        'normalsize', 'large', 'Large', 'itshape', 'bfseries', 'mdseries', 'upshape', 'slshape', 'scshape',
        'sffamily', 'rmfamily', 'ttfamily', 'normalfont', 'boldmath', 'unboldmath', 'selectfont', 'relax',
        'noindent', 'protect', 'xspace', 'displaystyle', 'textstyle', 'scriptstyle', 'leavevmode', 'nobreak',
        'allowbreak', 'hline', 'toprule', 'midrule', 'bottomrule', 'TableHeader', 'surveytitleicon',
        'looseness', 'null', 'unskip', 'ignorespaces', 'bigstrut',
        'DomW', 'DomD', 'DomE'}  # domain badges (icons) before a work's name in the class tables
KEEP_TEXT = {'textbf', 'emph', 'textit', 'textrm', 'textsf', 'texttt', 'textsc', 'textup', 'textmd', 'textnormal',
             'textsl', 'text', 'mbox', 'hbox', 'makebox', 'ClosureCell', 'underline', 'uline', 'NoCaseChange',
             'ClosureKind', 'LandscapeSection', 'makecell', 'shortstack', 'textmu'}
KEEP_MATH = {'mathrm', 'mathit', 'mathbf', 'mathsf', 'mathtt', 'mathcal', 'boldsymbol', 'bm', 'operatorname'}
CITES = {'cite', 'citep', 'citet', 'citealp', 'citealt', 'citeauthor', 'citeyear', 'citeyearpar', 'Cite',
         'Citep', 'Citet', 'nocite'}
LINKS = {'TableURL', 'TableCode', 'HaloReportLink', 'HaloCodeLink', 'url', 'nolinkurl'}
ARGS_DROPPED = {'label': 'm', 'ref': 'm', 'eqref': 'm', 'pageref': 'm', 'autoref': 'm', 'cref': 'm',
                'Cref': 'm', 'index': 'm', 'footnote': 'om', 'footnotemark': 'o', 'color': 'om',
                'vspace': 'm', 'phantom': 'm', 'hphantom': 'm', 'vphantom': 'm', 'fontsize': 'mm',
                'setlength': 'mm', 'addlinespace': 'o', 'rule': 'omm', 'rowcolor': 'omoo',
                'cellcolor': 'om', 'arrayrulecolor': 'om', 'linespread': 'm', 'hypersetup': 'm',
                'faIcon': 'm', 'faGithub': '', 'faBookOpen': '', 'cmidrule': 'm',
                'PIcon': 'm'}  # product icon before a name in Table 21
ACCENTS = {"'": '\u0301', '`': '\u0300', '^': '\u0302', '"': '\u0308', '~': '\u0303', '=': '\u0304',
           '.': '\u0307', 'u': '\u0306', 'v': '\u030c', 'H': '\u030b', 'c': '\u0327', 'k': '\u0328',
           'r': '\u030a', 'd': '\u0323', 'b': '\u0331'}
SUP = dict(zip('0123456789+-=()ni', '⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿⁱ'))
SUB = dict(zip('0123456789+-=()', '₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎'))
DIMENSION = re.compile(r'\s*-?[\d.]+\s*(?:pt|em|ex|mu|cm|mm|in|bp|sp)(?:\s*plus\s*-?[\d.]+\s*\w+)?(?:\s*minus\s*-?[\d.]+\s*\w+)?')
KERN_SLASH = re.compile(r'\\kern\s*-?[\d.]+\s*(?:pt|em|ex|mu)\s*/\s*\\kern\s*-?[\d.]+\s*(?:pt|em|ex|mu)')
CMD = re.compile(r'\\([A-Za-z]+)(\*?)|\\(.)', re.S)
ICON = '\x01{}\x02'


def superscript(text):
    if text and all(c in SUP for c in text):
        return ''.join(SUP[c] for c in text)
    return text


def subscript(text):
    if text and all(c in SUB for c in text):
        return ''.join(SUB[c] for c in text)
    return '_' + text


def compose(mark, base):
    if not base:
        return ''
    return unicodedata.normalize('NFC', base[0] + ACCENTS[mark]) + base[1:]


def icon(path):
    stem = Path(path.strip()).stem
    return ICON.format(ICONS[stem]) if stem in ICONS else ''


class Converter:
    """LaTeX fragment -> text, for table cells, captions, notes and bib fields."""

    def __init__(self, macros=None):
        self.macros = macros or {}

    def __call__(self, tex):
        tex = self.expand(tex or '')
        tex = resolve_secrefs(tex, label_number)  # \secref{a} -> §N, \secrefs{a}--\ref{b} -> §§N–M
        tex = KERN_SLASH.sub(' / ', tex)
        # A citation is dropped with the tie or space before it: 'Name~\citep{k}\LFive' -> 'Name§'.
        tex = re.sub(r'[~\s]+(?=\\(?:' + '|'.join(sorted(CITES, key=len, reverse=True)) + r')(?![A-Za-z]))', '', tex)
        return finish(self.convert(tex))

    def expand(self, tex):
        """Zero-argument macros defined in the table itself, e.g. \\LFive."""
        for _ in range(5):
            before = tex
            for name, body in self.macros.items():
                tex = re.sub(r'\\' + name + r'(?![A-Za-z])[ \t]*', lambda m, body=body: body, tex)
            if tex == before:
                break
        return tex

    def convert(self, s, math=False):
        out, i, n = [], 0, len(s)
        while i < n:
            c = s[i]
            if c == '\\':
                m = CMD.match(s, i)
                if m.group(1):
                    text, i = self.command(m.group(1), s, m.end(), math)
                    out.append(text)
                    continue
                ch, i = m.group(3), m.end()
                if ch in ACCENTS and ch not in '.~=^' or ch in '.~=^' and i < n and (s[i].isalpha() or s[i] == '{'):
                    base, i = read_arg(s, i)
                    out.append(compose(ch, self.convert(base)))
                elif ch == '(' or ch == '[':
                    close = '\\)' if ch == '(' else '\\]'
                    end = s.find(close, i)
                    end = n if end < 0 else end
                    out.append(self.convert(s[i:end], math=True))
                    i = end + 2
                elif ch in '\\':
                    _, i = read_opt(s, i)
                    out.append(' ')
                elif ch in ',;: \n\t':
                    out.append(' ')
                elif ch in '!-/)]':
                    pass
                elif ch in '&%_#{}$':
                    out.append(ch)
                else:
                    out.append(ch)
                continue
            if c == '$':
                if s.startswith('$$', i):
                    end = s.find('$$', i + 2)
                    end = n if end < 0 else end
                    out.append(self.convert(s[i + 2:end], math=True))
                    i = end + 2
                else:
                    end = s.find('$', i + 1)
                    while end > 0 and s[end - 1] == '\\':
                        end = s.find('$', end + 1)
                    end = n if end < 0 else end
                    out.append(self.convert(s[i + 1:end], math=True))
                    i = end + 1
                continue
            if c == '{':
                end = group_end(s, i)
                out.append(self.convert(s[i + 1:end - 1], math))
                i = end
                continue
            if c == '}':
                i += 1
                continue
            if c == '~':
                out.append(' ')
                i += 1
                continue
            if math:
                if c in '^_':
                    arg, i = read_arg(s, i + 1)
                    inner = self.convert(arg, math=True).strip()
                    out.append(superscript(inner) if c == '^' else subscript(inner))
                    continue
                if c in ',;':
                    out.append(c + ' ')
                    i += 1
                    continue
                if c in ' \t\n':
                    i += 1
                    continue
            else:
                if s.startswith('---', i):
                    out.append('—')
                    i += 3
                    continue
                if s.startswith('--', i):
                    out.append('–')
                    i += 2
                    continue
                if s.startswith('``', i):
                    out.append('“')
                    i += 2
                    continue
                if s.startswith("''", i):
                    out.append('”')
                    i += 2
                    continue
            out.append(c)
            i += 1
        return ''.join(out)

    def command(self, name, s, i, math):
        """Text for \\name at s[i:] (just past the name) and the index after its arguments."""
        conv = self.convert
        if name in CITES:
            _, i = read_args(s, i, 'oo')
            _, i = read_arg(s, i)
            return '', i
        if name in LINKS:
            url, i = read_arg(s, i)
            return clean_url(url), i
        if name == 'href':
            (_, text), i = read_args(s, i, 'mm')
            return conv(text, math), i
        if name == 'texorpdfstring':  # {TeX version}{plain-text version}: keep the plain text
            (_, text), i = read_args(s, i, 'mm')
            return conv(text, math), i
        if name == 'textsuperscript':
            arg, i = read_arg(s, i)
            return superscript(conv(arg).strip()), i
        if name == 'textsubscript':
            arg, i = read_arg(s, i)
            return subscript(conv(arg).strip()), i
        if name in ('textcolor', 'colorbox'):
            (_, _, text), i = read_args(s, i, 'omm')
            return conv(text, math), i
        if name == 'fcolorbox':
            (_, _, text), i = read_args(s, i, 'mmm')
            return conv(text, math), i
        if name == 'multicolumn':
            (_, _, text), i = read_args(s, i, 'mmm')
            return conv(text, math), i
        if name == 'multirow':
            (_, _, _, _, text), i = read_args(s, i, 'momom')
            return conv(text, math), i
        if name == 'raisebox':
            (_, _, _, text), i = read_args(s, i, 'moom')
            return conv(text, math), i
        if name in ('resizebox', 'scalebox'):
            (_, _, text), i = read_args(s, i, 'mmm' if name == 'resizebox' else 'mom')
            return conv(text, math), i
        if name == 'includegraphics':
            (_, path), i = read_args(s, i, 'om')
            return icon(path), i
        if name in ('LandscapeIcon', 'SurveyDomainIcon', 'SurveyCaptionIcon'):
            path, i = read_arg(s, i)
            return icon(path), i
        if name == 'LandscapeRegime':
            (a, b, c), i = read_args(s, i, 'mmm')
            return f'{conv(a)} × {conv(b)} × {conv(c)}', i
        if name == 'ClosureHead':
            (a, b), i = read_args(s, i, 'mm')
            return f'{conv(a)} {conv(b)}', i
        if name in ('TableChannel', 'chedge'):
            (a, b), i = read_args(s, i, 'mm')
            return f'{conv(a, True).strip()}→{conv(b, True).strip()}', i
        if name == 'TableSection':
            (_, text), i = read_args(s, i, 'mm')
            return conv(text), i
        if name == 'TableSectionColor':
            (_, _, text), i = read_args(s, i, 'mmm')
            return conv(text), i
        if name == 'TableNote':
            text, i = read_arg(s, i)
            return ' ' + conv(text) + ' ', i
        if name in ('kern', 'mkern', 'hskip', 'vskip', 'hspace', 'hspace*'):
            if name in ('kern', 'mkern', 'hskip', 'vskip'):
                m = DIMENSION.match(s, i)
                return ('' if name != 'hskip' else ' '), (m.end() if m else i)
            _, i = read_arg(s, i)
            return ' ', i
        if name in ('begin', 'end'):
            env, i = read_arg(s, i)
            if name == 'begin' and env.strip() == 'minipage':
                _, i = read_args(s, i, 'ooom')
            elif name == 'begin' and env.strip() in ('tabular', 'tabularx', 'tabular*'):
                _, i = read_args(s, i, 'om' if env.strip() == 'tabular' else 'mm')
            return ' ', i
        if name in ARGS_DROPPED:
            _, i = read_args(s, i, ARGS_DROPPED[name])
            return '', i
        if name in KEEP_TEXT or name in KEEP_MATH or name == 'ensuremath':
            arg, i = read_arg(s, i)
            if name == 'ensuremath':
                return conv(arg, True), i
            return conv(arg, math and name in KEEP_MATH), i
        if name in ACCENTS:
            base, i = read_arg(s, i)
            return compose(name, conv(base)), i
        if name in GREEK or name in SYMBOLS:
            text = GREEK.get(name) or SYMBOLS[name]
            j = skip_space(s, i)
            if s.startswith('{}', j):
                j += 2
            return text, (j if name not in GREEK else i)
        if name in SPACES:
            return ' ', skip_space(s, i)
        if name in DROP:
            return '', skip_space(s, i)
        warn(f'unknown command \\{name} (text kept, command dropped)')
        return '', skip_space(s, i)


def finish(text):
    """Icons joined into a list, spacing normalized."""
    regime = '×' in text

    def join(m):
        names = re.findall('\x01([^\x02]*)\x02', m.group(0))
        return ('/' if regime else ', ').join(names) + ' '
    text = re.sub('(?:\x01[^\x02]*\x02\\s*)+', join, text)
    text = re.sub(r'\s+', ' ', text).strip()
    text = re.sub(r'\s+([,.;:!?)\]])', r'\1', text)
    text = re.sub(r'([(\[])\s+', r'\1', text)
    return text


def clean_url(text):
    """URLs only need TeX escapes removed (from analysis/awesome-sync/metadata.py)."""
    text = re.sub(r'\\url\{([^}]*)\}', r'\1', text or '')
    text = re.sub(r'\\([_%&#~])', r'\1', text)
    return text.replace('{', '').replace('}', '').strip()


PLAIN = Converter()


def strip_markers(text):
    return text.strip().rstrip(MARKERS).strip()


# ---------------------------------------------------------------- bibliography

def _value(text, i):
    """One field value at text[i:]: (value, next index). Follows awesome-sync/bibparse.py."""
    while text[i].isspace():
        i += 1
    if text[i] == '{':
        depth, j = 0, i
        while True:
            if text[j] == '{':
                depth += 1
            elif text[j] == '}':
                depth -= 1
                if depth == 0:
                    return text[i + 1:j], j + 1
            j += 1
    if text[i] == '"':
        j, depth = i + 1, 0
        while not (text[j] == '"' and depth == 0):
            depth += text[j] == '{'
            depth -= text[j] == '}'
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
            fields[f.group(1).lower()] = ' '.join(value.split())
            i += re.match(r'\s*,?', text[i:]).end()
            if text[i:].lstrip().startswith('}'):
                break
        out.setdefault(m.group(2), fields)
    return out


def read_bib(paper):
    entries = {}
    for name in BIBS:
        for key, fields in parse_bib((paper / name).read_text(encoding='utf-8')).items():
            entries.setdefault(key, fields)  # BibTeX keeps the first definition
    return entries


ARXIV = re.compile(r'(?:arxiv\.org/(?:abs|pdf|html)/|arXiv:?\s*)(\d{4}\.\d{4,5})', re.I)


def arxiv_id(entry):
    for field in ('eprint', 'url', 'journal', 'booktitle', 'note', 'howpublished', 'volume'):
        m = ARXIV.search(entry.get(field, ''))
        if m:
            return m.group(1)
    if entry.get('archiveprefix', '').lower() == 'arxiv' and re.fullmatch(r'\d{4}\.\d{4,5}', entry.get('eprint', '')):
        return entry['eprint']
    return None


def split_and(field):
    spans = split_spans(field, r'\s+and\s+')
    return [field[a:b].strip() for a, b in spans if field[a:b].strip()]


def person(name):
    """'Last, First' or 'First Last' or '{Corporate Name}' -> 'First Last'."""
    parts = [p.strip() for p in split_top(name, ',')]
    if len(parts) == 2:
        return PLAIN(f'{parts[1]} {parts[0]}')
    if len(parts) == 3:
        return PLAIN(f'{parts[2]} {parts[0]} {parts[1]}')
    return PLAIN(name)


def authors(entry):
    """First three authors, then 'et al.' when more are listed or the list ends in 'others'."""
    names = split_and(entry.get('author', ''))
    others = any(n.lower() == 'others' for n in names)
    people = [person(n) for n in names if n.lower() != 'others']
    if not people:
        return None
    return ', '.join(people[:3]) + (' et al.' if len(people) > 3 or others else '')


def venue(entry):
    for field in ('journal', 'booktitle', 'howpublished', 'institution', 'school'):
        value = entry.get(field, '').strip()
        if not value or re.match(r'\\url|https?://', value):
            continue
        text = PLAIN(value)
        if re.match(r'(arxiv|corr)\b', text, re.I):
            return 'arXiv preprint'
        return text
    return 'arXiv preprint' if arxiv_id(entry) else None


def bib_url(entry):
    if entry.get('url'):
        return clean_url(entry['url'])
    for field in ('howpublished', 'note'):
        m = re.search(r'\\url\{([^}]*)\}', entry.get(field, ''))
        if m:
            return clean_url(m.group(1))
    if entry.get('doi'):
        return 'https://doi.org/' + re.sub(r'^https?://(dx\.)?doi\.org/', '', clean_url(entry['doi']))
    aid = arxiv_id(entry)
    return f'https://arxiv.org/abs/{aid}' if aid else None


def year(entry):
    m = re.search(r'\d{4}', entry.get('year', '') or entry.get('date', ''))
    return int(m.group(0)) if m else None


# ---------------------------------------------------------------- tables

ROW_COMMAND = re.compile(
    r'\s*(?:\\(toprule|midrule|bottomrule|hline|TableHeader|endhead|endfirsthead|endfoot|endlastfoot)(?![A-Za-z])'
    r'(?:\[[^\]]*\])?'
    r'|\\addlinespace(?:\[[^\]]*\])?'
    r'|\\cmidrule(?:\([^)]*\))?\{[^}]*\}'
    r'|\\rowcolor(?:\[[^\]]*\])?\{[^}]*\}(?:\[[^\]]*\]){0,2}'
    r'|\\noalign\{[^}]*\})')
SELF_ENDING_BANDS = {'TableSectionColor': 'mmm', 'TableSection': 'mm', 'LandscapeSection': 'm'}
CITE = re.compile(r'\\(?:' + '|'.join(sorted(CITES, key=len, reverse=True)) + r')\*?\s*(?:\[[^\]]*\]\s*){0,2}\{([^}]*)\}')
ROW_END = r'\\\\\*?(?:\s*\[[^\]]*\])?|\\tabularnewline(?![A-Za-z])'
ITEM_SEPARATOR = r'\\par(?![A-Za-z])|\\newline(?![A-Za-z])|\\\\|,|;'
WRAPPERS = ('mbox', 'ClosureCell', 'makecell', 'shortstack', 'hbox')


def cite_keys(tex):
    keys = []
    for m in CITE.finditer(tex):
        for key in m.group(1).split(','):
            key = key.strip()
            if key and key not in keys:
                keys.append(key)
    return keys


def local_macros(env):
    """Zero-argument \\newcommand definitions inside one table environment."""
    out = {}
    rx = re.compile(r'\\(?:newcommand|renewcommand|providecommand|DeclareRobustCommand)\*?\s*(?:\{\\([A-Za-z]+)\}|\\([A-Za-z]+))')
    for m in rx.finditer(env):
        i = skip_space(env, m.end())
        if i < len(env) and env[i] == '[':
            continue
        if i < len(env) and env[i] == '{':
            out[m.group(1) or m.group(2)] = env[i + 1:group_end(env, i) - 1]
    return out


def unwrap(cell):
    cell = cell.strip()
    while True:
        m = re.match(r'\\(?:' + '|'.join(WRAPPERS) + r')(?:\[[^\]]*\])?\s*\{', cell)
        if not m:
            return cell
        end = group_end(cell, m.end() - 1)
        if cell[end:].strip():
            return cell
        cell = cell[m.end():end - 1].strip()


def cell_items(raw):
    """The cited items of one cell: each a TeX substring holding one cite command
    together with the uncited words that belong to its name."""
    if not CITE.search(raw):
        return []
    body = unwrap(raw)
    items, pending = [], None
    for a, b in split_spans(body, ITEM_SEPARATOR):
        part = body[a:b]
        if CITE.search(part):
            items.append([a if pending is None else pending, b])
            pending = None
        elif part.strip() and pending is None:
            pending = a
    if pending is not None and items:
        items[-1][1] = len(body)
    return [body[a:b] for a, b in items]


def split_cell(raw):
    """(content, span) of a cell, unpacking \\multicolumn."""
    raw = raw.strip()
    m = re.match(r'\\multicolumn\s*\{\s*(\d+)\s*\}', raw)
    if m:
        (_, content), end = read_args(raw, m.end(), 'mm')
        if not raw[end:].strip():
            return content, int(m.group(1))
    return raw, 1


def table_rows(body):
    """('header'|'band'|'subband'|'row', payload) for the rows of a tabular body."""
    out, header_done = [], False
    for a, b in split_spans(body, ROW_END):
        chunk = body[a:b]
        while True:
            m = ROW_COMMAND.match(chunk)
            if m and m.end() > 0 and chunk[:m.end()].strip():
                if m.group(1) == 'midrule':
                    header_done = True
                chunk = chunk[m.end():]
                continue
            chunk = chunk.strip()
            m = re.match(r'\\(' + '|'.join(SELF_ENDING_BANDS) + r')(?![A-Za-z])', chunk)
            if m:
                args, end = read_args(chunk, m.end(), SELF_ENDING_BANDS[m.group(1)])
                out.append(('band', args[-1]))
                chunk = chunk[end:]
                continue
            break
        if not chunk:
            continue
        if chunk.startswith('\\ClosureKind'):
            out.append(('subband', read_arg(chunk, len('\\ClosureKind'))[0]))
            continue
        cells = [split_cell(c) for c in split_top(chunk, r'&')]
        if not header_done:
            out.append(('header', cells))
        elif len(cells) == 1 and chunk.startswith('\\multicolumn'):
            out.append(('band', cells[0][0]))
        else:
            out.append(('row', cells))
    return out


def tabular_body(env):
    m = re.search(r'\\begin\{(tabularx|tabular\*|tabular|longtable)\}', env)
    if not m:
        return None
    kind = m.group(1)
    _, i = read_args(env, m.end(), 'mm' if kind in ('tabularx', 'tabular*') else 'om')
    end = env.find('\\end{%s}' % kind, i)
    return env[i:end]


def caption_title(env, conv):
    """The bold opening of the caption, or its first sentence."""
    m = re.search(r'\\caption(?![A-Za-z])', env)
    if not m:
        return None
    (short, long), _ = read_args(env, m.end(), 'om')
    long = long.strip()
    bold = re.match(r'\\textbf\s*\{', long)
    if bold:
        return conv(long[bold.end() - 1:group_end(long, bold.end() - 1)])
    text = conv(long)
    return text.split('. ')[0].rstrip('.') + '.' if text else conv(short or '')


def header_columns(header_rows, ncols, conv):
    """Logical columns: [(name, [physical indices])]. Lower header rows win; a multicolumn
    header keeps its physical columns together."""
    names, owner = [''] * ncols, list(range(ncols))
    for r, cells in enumerate(header_rows):
        col = 0
        for content, span in cells:
            text = conv(content)
            for k in range(col, min(col + span, ncols)):
                if text:
                    names[k], owner[k] = text, (r, col)
            col += span
    columns = []
    for k in range(ncols):
        if columns and owner[k] == owner[k - 1] and names[k] == names[k - 1]:
            columns[-1][1].append(k)
        else:
            columns.append((names[k], [k]))
    seen = Counter(name for name, _ in columns)
    for name, count in seen.items():
        if count > 1:
            warn(f'duplicate column name {name!r}')
    return columns


def read_tables(paper):
    doc = expand_inputs(paper, 'main.tex')
    newest = max(SOURCES, key=lambda p: p.stat().st_mtime)
    if newest.stat().st_mtime > (paper / 'main.aux').stat().st_mtime:
        warn(f'{newest.name} is newer than main.aux; table numbers and pages may be stale until the paper is rebuilt')
    aux = {}
    for m in re.finditer(r'\\newlabel\{([^}]*)\}\{\{([^}]*)\}\{([^}]*)\}', (paper / 'main.aux').read_text(encoding='utf-8')):
        aux.setdefault(m.group(1), (m.group(2), m.group(3)))
    LABEL_NUMBERS.update({label: number for label, (number, _) in aux.items()})
    sections = []
    for m in re.finditer(r'\\section\*?\s*\{', doc):
        label = re.compile(r'\\label\{(sec:[^}]*)\}').search(doc, m.end())
        sections.append((m.start(), label.group(1) if label else None))
    title = None
    m = re.search(r'\\title\s*\{', doc)
    if m:
        title = PLAIN(doc[m.end():group_end(doc, m.end() - 1) - 1])

    tables = []
    for m in re.finditer(r'\\begin\{(table\*?)\}', doc):
        end = doc.find('\\end{%s}' % m.group(1), m.end())
        env = doc[m.end():end]
        labels = [l for l in re.findall(r'\\label\{([^}]+)\}', env) if l.startswith('tab:')]
        body = tabular_body(env)
        if not labels or body is None or not CITE.search(body):
            continue
        section = next((lab for pos, lab in reversed(sections) if pos < m.start()), None)
        conv = Converter(local_macros(env))
        number, page = aux.get(labels[0], (None, None))
        if number is None:
            warn(f'{labels[0]} is not in main.aux; rebuild the paper')
        tables.append({
            'label': labels[0], 'number': number, 'page': int(page) if page and page.isdigit() else None,
            'env': env, 'body': body, 'conv': conv, 'module': MODULE_OF_SECTION.get(section),
            'caption': caption_title(env, conv), 'notes': command_groups(env[env.find(body) + len(body):], 'TableNote'),
        })
    return title, tables


def kind_of(table):
    label = table['label']
    if label in KIND_OF_LABEL:
        return KIND_OF_LABEL[label]
    for suffix, kind in KIND_OF_SUFFIX:
        if label.endswith(suffix):
            return kind
    warn(f'{label}: no kind rule, the caption is used')
    return table['caption']


def placements_of(table):
    """Parse one table: its logical columns and one record per cited item
    (keys, name, item text, group, cells, column)."""
    conv = table['conv']
    rows = table_rows(table['body'])
    data = [cells for kind, cells in rows if kind == 'row']
    ncols = max([sum(span for _, span in cells) for kind, cells in rows if kind in ('row', 'header')] or [0])
    columns = header_columns([cells for kind, cells in rows if kind == 'header'], ncols, conv)
    physical_to_logical = {k: c for c, (_, ks) in enumerate(columns) for k in ks}

    def logical(cells):
        """Raw TeX parts per logical column."""
        out, col = [[] for _ in columns], 0
        for content, span in cells:
            if col in physical_to_logical:
                out[physical_to_logical[col]].append(content)
            col += span
        return out

    cite_columns = {c for cells in data for c, parts in enumerate(logical(cells)) if any(CITE.search(p) for p in parts)}
    grid = len(cite_columns) > 1
    has_sub = any(kind == 'subband' for kind, _ in rows)
    found, band, sub = [], None, None
    for kind, payload in rows:
        if kind == 'band':
            band, sub = conv(payload), (DEFAULT_SUBGROUP if has_sub else None)
            continue
        if kind == 'subband':
            sub = conv(payload)
            continue
        if kind != 'row':
            continue
        parts = logical(payload)
        texts = [' / '.join(t for t in (conv(p) for p in ps) if t) for ps in parts]
        for c, ps in enumerate(parts):
            for raw in ps:
                for item in cell_items(raw):
                    keys = cite_keys(item)
                    text = conv(item)
                    if len(CITE.findall(item)) > 1:
                        warn(f'{table["label"]}: one item holds several citations: {text!r}')
                    if grid:
                        cells = {columns[c][0]: text}
                    else:
                        cells = {name: (text if k == c else texts[k]) for k, (name, _) in enumerate(columns)}
                    group = band + (f' / {sub}' if sub else '') if band else (texts[0] if c > 0 else None)
                    found.append({'keys': keys, 'name': strip_markers(text), 'text': text, 'group': group,
                                  'cells': cells, 'column': columns[c][0]})
    return columns, found


# ---------------------------------------------------------------- derived fields

def closure_notes(table):
    """Marker -> general sentence, and name -> specific line, from the closure table's notes."""
    general, specific = {}, {}
    for note in table['notes']:
        for line in split_top(note, r'\\\\'):
            text = table['conv'](line)
            if not text:
                continue
            if text[0] in MARKERS:
                general[text[0]] = text[1:].strip()
                continue
            head, _, rest = text.partition(':')
            if rest:
                for name in re.split(r',\s*(?:and\s+)?|\s+and\s+', head):
                    if name.strip():
                        specific[name.strip()] = text
    return general, specific


def regime_legend(table):
    """Codes of the participant scope and outcome horizon in the Scope column -> words, from the
    table legend: 'participant scope \\textbf{I} individual, ...; outcome horizon \\textbf{s}
    within-session, ..., \\textbf{--} not reported.'"""
    for note in table['notes']:
        if 'participant scope' not in note or 'outcome horizon' not in note:
            continue
        found = {}
        for label, end in (('participant scope', ';'), ('outcome horizon', '.')):
            m = re.search(re.escape(label) + r'\s+(.*?)' + re.escape(end), note, re.S)
            pairs = {}
            for part in split_top(m.group(1), r'\s*,\s*'):
                entry = re.fullmatch(r'\s*\\textbf\s*\{([^{}]*)\}\s*(.*?)\s*', part, re.S)
                if not entry:
                    raise RuntimeError(f'{table["label"]}: cannot read the {label} legend entry {part!r}')
                gloss = PLAIN(entry.group(2))
                pairs[PLAIN(entry.group(1))] = gloss[:1].upper() + gloss[1:]
            found[label] = pairs
        return found['participant scope'], found['outcome horizon']
    raise RuntimeError(f'{table["label"]}: no participant scope / outcome horizon legend in the table notes')


def chain_columns(table, columns):
    """Chain-of-evidence column name -> step id, from the caption's abbreviation list."""
    m = re.search(r'\\caption(?![A-Za-z])', table['env'])
    (_, caption), _ = read_args(table['env'], m.end(), 'om')
    text = table['conv'](caption)
    out = {}
    for name, _ in columns:
        if name.endswith('.') and name not in CHANNEL_ORDER:
            hit = re.search(re.escape(name) + r'\s+([a-z][a-z ]*?)\s*(?:,|\.|$)', text)
            if hit:
                out[name] = hit.group(1).strip().replace(' ', '_')
    if sorted(out.values()) != sorted(CHAIN_STEPS):
        warn(f'{table["label"]}: chain columns read as {out}; using column order instead')
        steps = [name for name, _ in columns if name.endswith('.') and name not in CHANNEL_ORDER]
        out = dict(zip(steps, CHAIN_STEPS))
    return out


def link_of(cells):
    for column in LINK_COLUMNS:
        m = re.search(r'https?://\S+', cells.get(column, ''))
        if m:
            return m.group(0)
    return None


def build(paper, generated):
    title, all_tables = read_tables(paper)
    bib = read_bib(paper)
    tables, works, items_by_key = [], {}, {}
    extras = {}
    for table in all_tables:
        columns, found = placements_of(table)
        if not found:
            continue
        table['columns'] = columns
        extras[table['label']] = table
        tables.append({'label': table['label'], 'number': table['number'], 'page': table['page'],
                       'caption': table['caption'], 'module': table['module'], 'kind': kind_of(table),
                       'columns': [name for name, _ in columns]})
        for item in found:
            for key in item['keys']:
                items_by_key.setdefault(key, []).append((table, item))

    level_table = extras.get(LEVEL_TABLE)
    general, specific = closure_notes(level_table) if level_table else ({}, {})
    app_table = extras.get(APPLICATION_TABLE)
    scopes, horizons = regime_legend(app_table) if app_table else ({}, {})
    audit_table = extras.get(AUDIT_TABLE)
    chain_of = chain_columns(audit_table, audit_table['columns']) if audit_table else {}

    report = {'multi_level': {}, 'multi_audit': {}, 'table_url': [], 'no_url': [], 'missing_bib': []}
    for key, placed in items_by_key.items():
        entry = bib.get(key)
        if entry is None:
            report['missing_bib'].append(key)
            entry = {}
        names = [n for n, _ in Counter(item['name'] for _, item in placed if item['name']).most_common()]
        url = bib_url(entry)
        if not url:
            for _, item in placed:
                link = link_of(item['cells']) if len(item['keys']) == 1 else None
                if link:
                    url = link
                    report['table_url'].append(key)
                    break
        if not url:
            report['no_url'].append(key)

        level, level_note, levels = None, None, []
        for table, item in placed:
            if table['label'] == LEVEL_TABLE:
                m = re.match(r'L(\d+)', item['column'])
                if m:
                    levels.append((int(m.group(1)), item))
        if levels:
            best = max(levels, key=lambda x: x[0])
            level = f'L{best[0]}'
            marks = [c for c in best[1]['text'] if c in MARKERS]
            if marks:
                parts = [general.get(marks[0], '')]
                line = specific.get(best[1]['name'])
                parts.append(line or '')
                level_note = ' '.join(p for p in parts if p) or None
            if len(levels) > 1:
                report['multi_level'][key] = [f"L{lv} {item['text']}" for lv, item in levels]

        application = None
        for table, item in placed:
            if table['label'] == APPLICATION_TABLE:
                cells = item['cells']
                regime_col = next(n for n, _ in table['columns'] if n == 'Scope' or '×' in n)
                parts = [p.strip() for p in cells[regime_col].split('×')]
                domain, scope, horizon = (parts + ['', '', ''])[:3]
                unknown = [c for c in scope.split('/') if c not in scopes] + [c for c in horizon.split('/') if c not in horizons]
                if unknown:
                    warn(f'{key}: regime codes {unknown} are not in the legend')
                application = {
                    'domain': domain,
                    'participants': '/'.join(scopes.get(c, c) for c in scope.split('/')),
                    'horizon': '/'.join(horizons.get(c, c) for c in horizon.split('/')),
                    'mechanism': next((v for n, v in cells.items() if n.startswith('Key')), None),
                    'bottleneck': cells.get('Bottleneck'),
                    'framework': cells.get('Framework'),
                }
                break

        audit, rows = None, [(t, i) for t, i in placed if t['label'] == AUDIT_TABLE]
        if rows:
            groups = []
            cells = {ch: None for ch in CHANNEL_ORDER}
            chain = {step: False for step in CHAIN_STEPS}
            for table, item in rows:
                for ch in CHANNEL_ORDER:
                    mark = item['cells'].get(ch)
                    if mark not in MARK_RANK:
                        warn(f'{key}: unexpected mark {mark!r} for {ch}')
                        continue
                    if cells[ch] is None or MARK_RANK[mark] > MARK_RANK[cells[ch]]:
                        cells[ch] = mark
                for column, step in chain_of.items():
                    value = item['cells'].get(column, '')
                    if value not in ('■', '·'):
                        warn(f'{key}: unexpected chain mark {value!r} for {column}')
                    chain[step] = chain[step] or value == '■'
                if item['group'] not in groups:
                    groups.append(item['group'])
            for ch in CHANNEL_ORDER:
                if cells[ch] is None:
                    warn(f'{key}: no mark for {ch}, recorded as ◐')
                    cells[ch] = '◐'
            if len(groups) > 1:
                warn(f'{key}: audit rows sit in different groups {groups}')
            audit = {'group': groups[0], 'product': any('†' in item['text'] for _, item in rows),
                     'cells': cells, 'chain': chain}
            if len(rows) > 1:
                report['multi_audit'][key] = [item['text'] for _, item in rows]

        channels = set()
        if audit:
            channels |= {ch for ch, mark in audit['cells'].items() if mark == '●'}
        for _, item in placed:
            m = re.match(r'([SMA]→[SMA])\s*:', item['group'] or '')
            if m:
                channels.add(m.group(1))
        modules = {table['module'] for table, _ in placed}

        works[key] = {
            'key': key,
            'names': names,
            'title': PLAIN(entry.get('title', '')) or None,
            'authors': authors(entry),
            'year': year(entry),
            'venue': venue(entry),
            'url': url,
            'modules': [m for m in MODULE_ORDER if m in modules],
            'placements': [{'table': table['label'], 'group': item['group'], 'cells': item['cells']} for table, item in placed],
            'channels': [c for c in CHANNEL_ORDER if c in channels],
            'level': level,
            'levelNote': level_note,
            'application': application,
            'audit': audit,
        }
    data = {'generated': generated, 'paper_title': title, 'tables': tables, 'works': list(works.values())}
    return data, report


# ---------------------------------------------------------------- output

def dump(data):
    """One table or work per line, as the site has stored it since the first export."""
    line = lambda x: json.dumps(x, ensure_ascii=False, separators=(',', ':'))
    return ('{' + f'"generated":{line(data["generated"])},\n'
            f'"paper_title":{line(data["paper_title"])},\n'
            '"tables":[\n' + ',\n'.join(line(t) for t in data['tables']) + '\n],\n'
            '"works":[\n' + ',\n'.join(line(w) for w in data['works']) + '\n]}\n')


def leftovers(data):
    """Strings in the output that still look like LaTeX."""
    bad = []

    def walk(x, where):
        if isinstance(x, dict):
            for k, v in x.items():
                walk(v, f'{where}.{k}')
        elif isinstance(x, list):
            for k, v in enumerate(x):
                walk(v, f'{where}[{k}]')
        elif isinstance(x, str) and re.search(r'[\\{}$~\x01\x02]|textsuperscript|citep',
                                              re.sub(r'https?://\S+', '', x)):
            bad.append(f'{where}: {x[:80]}')
    walk(data, '')
    return bad


def main():
    parser = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    parser.add_argument('paper', nargs='?', default=str(DEFAULT_PAPER), help='paper directory (main.tex, main.aux, bibs)')
    parser.add_argument('--out', default=str(DEFAULT_OUT), help='output JSON path')
    parser.add_argument('--generated', help='date stamped as "generated" (default: today; with --check, the date '
                                            'already in the output file)')
    parser.add_argument('--check', action='store_true', help='exit 1 if the output file differs from a fresh export')
    args = parser.parse_args()
    paper, out = Path(args.paper), Path(args.out)
    generated = args.generated
    if generated is None and args.check and out.exists():
        m = re.match(r'\{"generated":"([^"]*)"', out.read_text(encoding='utf-8'))
        generated = m.group(1) if m else None
    generated = generated or datetime.date.today().isoformat()

    data, report = build(paper, generated)
    text = dump(data)
    bad = leftovers(data)
    for message in WARNINGS:
        print(f'warning: {message}', file=sys.stderr)
    for message in bad:
        print(f'LaTeX left in output: {message}', file=sys.stderr)
    if report['missing_bib']:
        print(f'warning: cite keys missing from the bibliography: {report["missing_bib"]}', file=sys.stderr)
    if args.check:
        same = out.exists() and out.read_text(encoding='utf-8') == text
        print('up to date' if same else f'{out} differs from a fresh export')
        sys.exit(0 if same else 1)
    out.write_text(text, encoding='utf-8')
    print(f'{out}: {len(data["tables"])} tables, {len(data["works"])} works')
    print('tables: ' + ', '.join(f'{t["number"]} {t["label"]} ({t["kind"]})' for t in data['tables']))
    if report['multi_level']:
        print('works placed at several levels (highest kept): ' + '; '.join(
            f'{k}: {", ".join(v)}' for k, v in report['multi_level'].items()))
    if report['multi_audit']:
        print('works with several HALO read-mode rows (strongest mark kept): ' + '; '.join(
            f'{k}: {", ".join(v)}' for k, v in report['multi_audit'].items()))
    if report['table_url']:
        print(f'url from the table link column (no url, DOI or arXiv id in the bib): {", ".join(report["table_url"])}')
    if report['no_url']:
        print(f'works without any url: {", ".join(report["no_url"])}')
    sys.exit(1 if bad or report['missing_bib'] else 0)


if __name__ == '__main__':
    main()
