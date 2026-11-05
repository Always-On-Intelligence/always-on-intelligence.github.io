# Always-On Personal Intelligence

Project website for **Always-On Personal Intelligence: A Roadmap Towards Continuing, Self-Evolving Loops**.

Planned site: https://always-on-intelligence.github.io/ (GitHub Pages serves an organization site only from a repository named `Always-On-Intelligence.github.io`).

## Structure

- `index.html` — the paper's page: title, an overview (the abstract compressed into a lede and three contribution cards, with the key phrases marked), a Findings section (the paper's main finding on one screen, then its two gaps, Memory guiding Sensing and outcomes returning to Memory, each shown as a demonstration in the running example with the Table 22 counts and the open problem it raises, all from `site/findings.mjs`; more findings by chapter behind a toggle), then one section per part of the paper. Its Demo section is only a teaser: hovering an episode plays a short loop of its room (`assets/play/preview/`, recorded from the rooms, see `site/play/README.md`), and the one way in is "Open the demo"
- `play.html` — the Demo page: the floating island in real-time 3D (`site/island-hero.mjs`, `site/play/island.mjs`), the episode library and the player; `site/play-page.mjs` is its entry point. Old `index.html#case-…` links forward here
- `site/site.css` — page styles; colours follow the paper's Morandi palette (sensing sage, memory rose, action blue, HALO purple, systems gold)
- `site/main.mjs` — mounts each interactive figure on the paper's page; `site/teaser.mjs` runs the Demo teaser
- `site/framework.mjs` — §2: the loop of Sensing, Memory and Action with six channels, shared conditions and the implementation; walkthroughs of one reminder and of one mechanism revision; the "which kind of agent" table
- `site/applications.mjs` — §2.5 and §6.1: glass grid of interaction domain × participant scope over the paper's application illustrations, filtered by outcome horizon
- `site/levels.mjs` — §6.3: levels of loop closure L0–L5 with each criterion, the level checklist, and the placed systems (§ marks an L5 placement that holds only under a stated condition)
- `site/cases.mjs`, `site/case-core.mjs`, `site/data/cases.mjs`, `site/cases.css` — the Demo page: a library of eight case episodes (three wearable, three digital, two physical) modeled on works in the systems and closure tables. A case opens in a player that steps through its beats and shows, for each step, the scene, the active modules and channels, the shared conditions, the parts of the implementation, and the running state z and mechanism θ. "What if" options change one condition, cut one channel (a scripted contrast in the spirit of HALO run mode), or switch the mode. `tests/cases.test.mjs` checks the vocabulary, that a cut channel never delivers, that the cases together cover all six channels, conditions, implementation parts, module classes, scopes, horizons and the five evidence steps, and that no case claims a higher level than its sources without saying which added step raises it.
- `site/halo.mjs` — §7. Read mode shows the paper's Table 22 (`site/data/halo-read.json`): for 40 works, the five coupling channels beyond S→A and the five steps of the chain of evidence, with the counts the paper quotes. A work opens its sheet. Run mode shows HALO's own runs, 90 tests in 20 works, each test the blind judge's choices between the released run and the run with a channel or step cut, drawn as two charts with one dot per work (channels and self-evolution) whose x axis comes from Table 22. Run data: `site/data/halo-results.json`, written by `tools/halo/export_results.py` from the HALO repository (`HALO_DIR`, default `~/Desktop/code/HALO`; `--check` reports a stale file). It holds only run mode and each run case's cite key, since the page follows the paper for read mode
- `site/works.mjs` — searchable index of every work cited in the paper's tables
- `site/sheet.mjs` — the shared glass sheet that opens settings, domains and systems
- `site/systems.mjs` — joins the systems, levels and read-mode tables on cite keys
- `site/data/` — content exported from the paper sources (see below)
- `assets/figures/` — web exports of the paper's roadmap and framework figures, the social preview, and `banner-bg.webp`, the textless version of the awesome-list banner used behind the title (generated with Codex's built-in imagegen; the prompts are recorded in the awesome repository's `assets/banner-prompt.md`)
- `assets/applications/` — the nine illustrations cropped from the paper's application figure
- `demo/` — Minecraft iframe, scene switching and page-level game mode (not loaded by any page for now, see below)
- `game-src/` — complete editable Minecraft client, bilingual HUD, NPCs, continuous demo and developer guide
- `game/` — deployed client and versioned NTU map assets
- `world/` — the three.js ECCV and NTU worlds; `world/vendor/three/` is also the three.js build that the island and the episode rooms import
- `halo/` — the September evidence explorer (v2 ledger, 31 configurations); no longer linked from the page, since the paper's read mode now covers 40 works and the HALO code moves to its own repository
- `tools/paper/` — scripts that export the paper's tables and text into `site/data/` (see below)
- `citation.bib` — downloadable citation; it must match the BibTeX block in `index.html`

This is a static website, including a Minecraft client with an in-browser single-player server. No build step is needed to preview the checked-in website. To develop the game, follow [game-src/README.MD](game-src/README.MD).

The two 3D worlds (ECCV 2026 and NTU) are off the pages for now: no page loads `demo/minecraft-embed.mjs`, and the library has no world cards. Their sources stay in `demo/`, `game/`, `game-src/` and `world/`. To bring them back, load the embed on `play.html`, restore `#world-stage` with `#village-demo` inside it (no ancestor may use `transform`, `filter`, `backdrop-filter` or `perspective`), and add the cards; the embed also expects `#live-demo-title` and `#village-deck`. The paper's page keeps `id="live-demo"` on the teaser because the game staging script checks for it.

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

The paper PDF and the author list are not posted yet: the Paper button reads "coming soon" and the BibTeX says "Authors to be announced". `assets/always-on-personal-ai.pdf` is the September 15 build and is no longer linked. When the paper is posted, add the PDF, link the button, and keep website copy, figure exports, author order, and the BibTeX in `index.html` and `citation.bib` synchronized with the approved draft.

## Content and provenance

The page follows the paper as built on 23 October 2026. Text in the interactive figures quotes the paper, mostly Section 2, the module chapters' opening, conditions, and takeaway paragraphs, Section 7.2, and Section 8; `site/data/framework.mjs`, `regimes.mjs` and `halo.mjs` hold it by hand. The JSON files in `site/data/` are exported from the paper's LaTeX sources by the scripts in `tools/paper/` (standard-library Python; they read the survey repository, by default `~/Desktop/code/proactive_survey`, or `PAPER_DIR`):

- `applications.json` — the systems table of §6.1 with each domain's description and bottlenecks (`export_applications.py`)
- `levels.json` — levels of loop closure (§6.3): the level checklist, the closure table, and the L5 conditions (`export_levels.py`)
- `halo-read.json` — the paper's read-mode table (Table 22, §7.1), shown in HALO read mode and in the system sheets (`export_halo.py`)
- `halo-evidence.json` — the review record behind Table 22: each cell's mark and the section of the work's paper where the reviewers found it, without line numbers or local paths (`export_halo_evidence.py`, reading `analysis/evidence/channel-judgements-v3.json`). The one-line evidence on each HALO card is hand-written from the same record in `site/data/halo-lines.json`
- `works.json` — every work cited in the paper's tables, with its placements, channels, level and source (`export_works.py`)

Re-export them when the paper changes; each script also takes `--check`. The two paper figures on the page, the roadmap in the masthead and the framework figure that opens §2 (`fig/roadmap.pdf` and `fig/teaser.pdf`), come from `sh tools/paper/export_figures.sh` (macOS, needs `swiftc` and Pillow).

The older files `script.js`, `research.js`, `research.css`, `application-space*.{mjs,css}` and `data/research-index.json` belong to the previous page and are no longer loaded by `index.html`.

## HALO workspace (September version)

The `/halo/` route is the September workspace and is no longer linked from the page. It is entirely static. It browses the published read-mode review, prepares a self-contained Markdown task for a local coding agent, and displays locally selected evidence/report files. It does not launch model sessions or contact a local agent. Inputs and imported files are not uploaded or saved by the site.

`halo/data/inventory.json` is an explicit public export of the current v2 source ledger, with local cache paths omitted. Its source SHA-256 is included for provenance. It preserves the 31 configurations and all 155 mechanism judgments. Run results are not inferred from this read-mode inventory.
