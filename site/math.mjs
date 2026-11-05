// LaTeX rendering with KaTeX, loaded on demand from jsDelivr. If the library cannot be
// loaded, formulas fall back to their TeX source so the page still reads.

const KATEX_URL = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.mjs';
let pending = null;

export function loadKatex() {
  pending ??= import(KATEX_URL).then(m => m.default).catch(error => {
    console.warn('KaTeX could not be loaded; showing TeX source instead.', error);
    return null;
  });
  return pending;
}

const escapeHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Render one TeX expression to HTML. */
export function tex(katex, source, display = false) {
  if (!katex) return `<code class="tex-fallback">${escapeHtml(source)}</code>`;
  return katex.renderToString(source, { throwOnError: false, displayMode: display, output: 'html', strict: 'ignore' });
}

/** Render text that contains $…$ math segments; the text parts are escaped. */
export function mixed(katex, text) {
  return String(text).split(/(\$[^$]+\$)/g)
    .map(part => (part.startsWith('$') && part.endsWith('$') ? tex(katex, part.slice(1, -1)) : escapeHtml(part)))
    .join('');
}
