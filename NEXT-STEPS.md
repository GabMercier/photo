# Next steps — playbook

Each item below has **steps** (what you do) and a **prompt** (paste into a Claude Code session in this folder). Do them in order; each one is a clean session. Tip: start any new session with *"Status update first, read-only"* to get your bearings before anything changes.

---

## 1. Land today's work (2026-10-25)

Everything is uncommitted on `main`: the content model + importer (afternoon) and the liquid-glass header + fixes (evening).

**Steps**

1. Look at the site one last time: `npx astro preview` → http://localhost:4321 (desktop, then narrow the window below 600px for icon tabs).
2. Have Claude split the work into commits and show you each one before anything is committed.
3. Push. GitHub Actions deploys to Cloudflare Pages automatically on `main`.
4. **Test on your iPhone** (this is the one thing no session could do):
   - Header shows the *frosted* pill (no refraction — that's correct on iOS), legible over bright photos
   - Feed: snap between posts — no sliver of the previous photo under the header
   - Tap a feed photo → opens the post; expand arrows → lightbox with "View Post"
   - Icon tabs + EN/FR toggle at phone width; French pages too
   - Settings → Accessibility → try Reduce Motion and Increase Contrast, revisit the site
   - Look at Safari's own toolbar: iOS tints it from the page's top edge — if it looks off, note it

**Prompt**

> Review all uncommitted changes in this repo. Propose a split into logical commits (content model + importer separate from the glass/header work), show me a summary and diffstat for each before committing anything. Don't push until I say so.

Then, after your iPhone test, if anything is off:

> On my iPhone the header [describe what you saw / paste screenshot]. Diagnose and fix — the known iOS quirks are in DEVELOPMENT_ROADMAP.md under "2026-10-25 research notes".

---

## 2. Content: approve drafts, first import, first project

This is the point of everything else — getting astro / travel / hyperlocal photos flowing.

### 2a. Approve the drafted texts

I drafted alt text + descriptions (EN/FR) onto the 13 existing posts, plus two locations (Charlevoix, rue Sainte-Ursule). They're in the posts' frontmatter, uncommitted.

**Prompt**

> Walk me through the alt text, descriptions and locations you drafted on the existing posts, one post at a time, EN and FR side by side. I'll say "ok" or give corrections; apply them as we go.

### 2b. First real import (the maiden voyage)

**Steps**

1. In Lightroom, for the photos you want to publish, fill:
   - **Title** and **Caption** — bilingual with `||`: `French text || English text`
   - **Keywords** → become tags (see `scripts/import/keyword-map.json` for the mapping)
   - **IPTC location**: Sublocation, City, State/Province, Country code — and GPS if you want it (stripped to coarse by default)
2. Export full-size JPEGs to a folder (the importer resizes to 2400px itself).
3. Dry-run first, then real run — full guide in `docs/IMPORT.md`:
   ```
   npm run import -- ~/Pictures/export-folder --dry-run
   npm run import -- ~/Pictures/export-folder
   ```
4. Read the report at `scripts/import/last-report.md`, check the generated post files, then run the prebuild + a local build before committing.

**Prompt**

> I exported photos to [folder]. Run the importer as a dry-run, show me the report, and wait for my go before the real import. After importing, run the prebuild chain and a build, and show me the new posts in the preview.

### 2c. First project (lights up the Projects tab)

The `projects` collection exists but is empty. One markdown file in `src/content/projects/` makes the nav tab appear (icon is already drawn).

**Prompt**

> Create my first project: [working title], kind [travel|local|astro], covering the posts [which ones / tag / date range]. Draft the bilingual title and description for my review, pick a cover from the posts, and show me /projects and the project page in the preview.

---

## 3. Engineering debts (each ~an hour, one per session)

| # | What | Why |
|---|------|-----|
| 3a | Prebuild in CI | Today `optimize-images`, `extract-glow-colors`, `extract-exif` run only on your Mac and their outputs are committed. Moving them into GitHub Actions means the repo stops carrying generated files. Keep `generate-depth-maps` local (Python + model). |
| 3b | Pin Sveltia | The CMS loads unpinned from unpkg — a bad release could break /admin overnight. |
| 3c | One CMS config | `public/admin/en/config.yml`, `fr/config.yml` and a stale root copy must be edited in step today; generate both from one source. |
| 3d | Drop `marked` | Astro renders markdown itself; one less dependency. |
| 3e | Type cleanup | `astro check` reports 110 pre-existing errors (null checks in client scripts). Chip away until 0, then it can gate CI. |

**Prompt (adjust the letter)**

> Do item 3a from NEXT-STEPS.md: move the prebuild scripts (except depth maps) into the GitHub Actions workflow. Plan first and show me the plan before changing anything; then verify with a full build and the headless screenshot recipe.

---

## 4. Glass follow-ups (optional polish, when the mood strikes)

Research-backed options, details in `DEVELOPMENT_ROADMAP.md` → "Liquid Glass Implementation Guide" → *2026-10-25 research notes*:

| # | What | Payoff |
|---|------|--------|
| 4a | iPhone refraction for photo-overlay controls | The back/expand/carousel buttons can get *real* lensing on iOS by refracting an aligned copy of the photo (`filter: url()` — works in all engines). The header stays frosted on iOS; this is for controls over a known image. |
| 4b | `transition:persist` on the header | Keeps the header DOM alive across page swaps so displacement maps don't re-bake (currently a brief frosted flash per navigation in Chrome). Needs syncing the active link + EN/FR href manually on swap. |
| 4c | Extend the material | FilterBar pills, slideshow controls and share toast still use the old flat glass; port the header's material (sheen, rim, tiers) so the whole site speaks one language. |
| 4d | CSS scroll-driven ramp | Replace the JS `--hs` scroll listener with `animation-timeline: scroll()` (now in Safari 26+ and Firefox 159); keep JS as fallback. |

**Prompt (adjust the letter)**

> Do item 4a from NEXT-STEPS.md: bring refraction to the post back-button and carousel controls on iOS using the filter-on-photo-copy method from the research notes. Mind the WebKit gotchas listed there (fresh filter ids, size ceiling, no video). Verify headless, including a spoofed Safari UA.

---

## Session habits that worked today

- **"Status update first, read-only"** when resuming after a gap.
- Ultracode on for big builds/research; off for quick tweaks.
- Verification recipe (headless Chrome, scratch copies, A/B builds) is in Claude's memory — it will reuse it; just ask for "verified with screenshots".
- One item per session; commit before starting the next.
