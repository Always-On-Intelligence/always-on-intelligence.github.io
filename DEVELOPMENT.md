# Development

Project website for **Always-On Personal Intelligence: A Roadmap Towards Continuing, Self-Evolving Loops**.

Live at https://always-on-intelligence.github.io/ (GitHub Pages serves an organization site only from a repository named `Always-On-Intelligence.github.io`).

## Structure

- `index.html` — the paper's page: title, an overview (the abstract compressed into a lede and three contribution cards, with the key phrases marked), the video, the paper's twelve main takeaways as cards that open over the page (`site/takeaways.mjs`), then one section per part of the paper. The paper's main finding is takeaway 07 (Main finding · §3–5); HALO's read table shows it. Its Demo section is only a teaser: hovering an episode plays a short loop of its room (`assets/play/preview/`, recorded from the rooms, see `site/play/README.md`), and the one way in is "Open the demo"
- `play.html` — the Demo page: the floating island in real-time 3D (`site/island-hero.mjs`, `site/play/island.mjs`), the episode library and the player; `site/play-page.mjs` is its entry point. Old `index.html#case-…` links forward here
- `site/site.css` — page styles; colours follow the paper's Morandi palette (sensing sage, memory rose, action blue, HALO purple, systems gold)
- `site/main.mjs` — mounts each interactive figure on the paper's page; `site/teaser.mjs` runs the Demo teaser
- `site/framework.mjs` — §2: the loop of Sensing, Memory and Action with six channels, shared conditions and the implementation; walkthroughs of one reminder and of one mechanism revision; the "which kind of agent" table
- `site/applications.mjs` — §6.1: one column per group of the paper's systems table, in the table's order (§6.1.1–6.1.3), with what its assistants do, all of the group's rows (each opens its sheet) and its bottlenecks
- `site/levels.mjs` — §6.3: levels of loop closure L0–L5 with each criterion, the level checklist, and the placed systems (§ marks an L5 placement that holds only under a stated condition)
- `site/cases.mjs`, `site/case-core.mjs`, `site/data/cases.mjs`, `site/cases.css` — the Demo page: a library of eight case episodes (three wearable, three digital, two physical) modeled on works in the systems and closure tables. A case opens in a player that steps through its beats and shows, for each step, the scene, the active modules and channels, the shared conditions, the parts of the implementation, and the running state z and mechanism θ. "What if" options change one condition, cut one channel (a scripted contrast in the spirit of HALO run mode), or switch the mode. `tests/cases.test.mjs` checks the vocabulary, that a cut channel never delivers, that the cases together cover all six channels, conditions, implementation parts, module classes, scopes, horizons and the five evidence steps, and that no case claims a higher level than its sources without saying which added step raises it.
- `site/halo.mjs` — §7. Read mode shows the paper's Table 22 (`site/data/halo-read.json`): for 40 works, the five coupling channels beyond S→A and the five steps of the chain of evidence, with the counts the paper quotes. A work opens its sheet. Run mode shows HALO's own runs, 90 tests in 20 works, each test the blind judge's choices between the released run and the run with a channel or step cut, drawn as two charts with one dot per work (channels and self-evolution) whose x axis comes from Table 22. Run data: `site/data/halo-results.json`, written by `tools/halo/export_results.py` from the HALO repository (`HALO_DIR`, default `~/Desktop/code/HALO`; `--check` reports a stale file). It holds only run mode and each run case's cite key, since the page follows the paper for read mode
- `site/works.mjs` — searchable index of every work cited in the paper's tables
- `site/sheet.mjs` — the shared glass sheet that opens settings, domains and systems
- `site/systems.mjs` — joins the systems, levels and read-mode tables on cite keys
- `site/data/` — content exported from the paper sources (see below)
- `assets/figures/` — web exports of the paper's roadmap and framework figures, the social preview, and `banner-bg.webp`, the textless version of the awesome-list banner used behind the title (generated with Codex's built-in imagegen; the prompts are recorded in the awesome repository's `assets/banner-prompt.md`)
- `assets/applications/` — the nine illustrations cropped from the paper's application figure
- `world/vendor/three/` — the three.js build (r184) that the island and the episode rooms import
- `tools/paper/` — scripts that export the paper's tables and text into `site/data/` (see below)
- `assets/readme/` — the banner (the reading list's animated `banner.gif`), the section screenshots and the Demo GIFs shown in `README.md`
- `citation.bib` — downloadable citation; it must match the BibTeX blocks in `index.html` and `README.md`
- `sitemap.xml` and `robots.txt` — for search engines: the sitemap lists the paper's page, the Demo page and the PDF, and `robots.txt` points to it and to the HALO docs' own sitemap (`/HALO/sitemap-index.xml`). Add a page here when the site gains one
- `google080f4f9c89ba4404.html` — Google Search Console's ownership check for the site. Keep it, or the site loses its verified status there

This is a static website. No build step is needed to preview it.

## Preview locally

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open http://127.0.0.1:8000/ for the paper's page and http://127.0.0.1:8000/play.html for the Demo. The figures load their data with `fetch`, so opening `index.html` from the file system does not work.

## Tests

```sh
node --test tests/*.test.mjs
```

`tests/site.test.mjs` checks the page data against the paper's framework (six channels and their difficulty, the reminder walkthrough, the nine regimes, the systems, levels and read-mode tables), that HALO read mode matches the paper's Table 22 and its quoted counts and every run test adds up, that the paper's page links to the Demo page only through the nav and "Open the demo" (every teaser episode has its preview loop), and that `citation.bib` matches the page.

## Publish

GitHub Pages serves the `main` branch at `/ (root)`. Push changes to `main` to publish. `.nojekyll` ensures assets are served without Jekyll processing.

The Paper button opens `Always-On_Personal_Intelligence.pdf`, the paper as built on 6 November 2026 and the same file as in the reading list, until the arXiv version is out. GitHub Pages serves it as a PDF, so browsers open it directly. When the paper changes, replace the PDF, and keep website copy, figure exports, author order, and the BibTeX in `index.html` and `citation.bib` synchronized with the approved draft.

## Content and provenance

The page follows the paper as built on 23 October 2026. Text in the interactive figures quotes the paper, mostly Section 2, the module chapters' opening, conditions, and takeaway paragraphs, Section 7.2, and Section 8; `site/data/framework.mjs`, `regimes.mjs` and `halo.mjs` hold it by hand. The JSON files in `site/data/` are exported from the paper's LaTeX sources by the scripts in `tools/paper/` (standard-library Python; they read the survey repository, by default `~/Desktop/code/proactive_survey`, or `PAPER_DIR`):

- `applications.json` — the systems table of §6.1 with each domain's description and bottlenecks (`export_applications.py`)
- `levels.json` — levels of loop closure (§6.3): the level checklist, the closure table, and the L5 conditions (`export_levels.py`)
- `halo-read.json` — the paper's read-mode table (Table 22, §7.1), shown in HALO read mode and in the system sheets (`export_halo.py`)
- `halo-evidence.json` — the review record behind Table 22: each cell's mark and the section of the work's paper where the reviewers found it, without line numbers or local paths (`export_halo_evidence.py`, reading `analysis/evidence/channel-judgements-v3.json`). The one-line evidence on each HALO card is hand-written from the same record in `site/data/halo-lines.json`
- `works.json` — every work cited in the paper's tables, with its placements, channels, level and source (`export_works.py`)

Re-export them when the paper changes; each script also takes `--check`. The two paper figures on the page, the roadmap in the masthead and the framework figure that opens §2 (`fig/roadmap.pdf` and `fig/teaser.pdf`), come from `sh tools/paper/export_figures.sh` (macOS, needs `swiftc` and Pillow).
