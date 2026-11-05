# Next steps — playbook

Each item below has **steps** (what you do) and a **prompt** (paste into a Claude Code session in this folder). Do them in order; each one is a clean session. Tip: start any new session with *"Status update first, read-only"* to get your bearings before anything changes.

---

# Queue added 2026-11-05

Items 1 and 2b below are done: the glass header, content model and importer landed (dcef1b4, 2195db2), and the first imported batch is live (9e01b50, e7d6968) and approved. One uncommitted change sits in the repo: ~139 lines in `Header.astro` adding press-and-hold lens drag on touch — deal with it in item 6 before any other header work.

## 5. Scheduled publishing test (big batch + daily/weekly cron)

Import a large batch once, future-date the posts, and let the site publish them on its own. All static, no CMS involved: a date filter at build time plus a scheduled rebuild.

**How it works**

1. You pick the batch, fill the Lightroom fields (Title/Caption with `||`, keywords, IPTC location), export, and the importer runs once — images and prebuild outputs are committed up front, as usual.
2. The posts' `date` frontmatter gets spread across future days (daily cadence) or weeks.
3. A shared "published" filter (`!draft && !private && date <= now`) replaces the ad-hoc filters in every posts query. There are ~8 call sites today: `FeedPage`, `GalleryPage`, `HomePage` (×2), `ProjectPage`, `ProjectsPage`, `rss.xml.ts`, and **both `[slug]` pages** — without the slug pages, future posts would still be reachable at their direct URL.
4. A `schedule:` cron goes into the GitHub Actions deploy workflow (e.g. daily 16:00 UTC ≈ 11:00–12:00 in Québec). Each run rebuilds; posts whose date has passed appear.

**Caveats to settle in-session**

- If the GitHub repo is public, the future photos are browsable in the repo before they appear on the site. Check visibility and decide if that matters.
- Pick one timezone convention for post dates vs the cron hour, or a post can slip a day.
- Daily cron ≈ 30 builds/month — well within Actions minutes and Cloudflare's 500/month.

**Prompt**

> Do item 5 from NEXT-STEPS.md. I exported the batch to [folder]; cadence [daily|weekly] starting [date]. Dry-run the import and show me the report first. Then add the shared date filter and the workflow cron, and prove with a local build that a future-dated post is absent everywhere (feed, gallery, home, RSS, direct URL) and present once its date passes.

## 6. Header rework: merge the lens logo and the menu, revisit the top blur

Two parts, prototype-first like the original header session.

**Steps**

1. First, review the uncommitted `Header.astro` diff (touch press-and-hold lens drag). Try it on the iPhone; land it or drop it before redesigning on top of it.
2. Design exploration: the dome logo dot and the pill nav becoming one object — e.g. the logo as the lens's resting home, or the pill growing out of the logo on scroll. Ask for 2–3 throwaway prototypes before touching the real header.
3. Separately decide the top-of-page blur strip (scroll edge fade): keep, rework, or remove. Judge it over real photos in the feed.

**Prompt**

> Do item 6 from NEXT-STEPS.md. Start with the uncommitted Header.astro touch-drag diff: walk me through it, I'll decide land or drop. Then build 2–3 standalone prototypes of the logo+menu merged into one object, and show the feed with the edge fade kept / reworked / removed so I can compare. No changes to the real header until I pick.

## 7. Feed: the expand button is the only action on an image

Feed images currently click through to their post (deliberate choice on 2026-10-25 — now reversed: accidental clicks while scrolling the snap feed are worse than the shortcut). Only the expand button should act; the lightbox's "View Post" is the route to the post.

**Steps**

1. In the feed context only, remove the `.post-card__link` anchor from around the image (gallery behavior unchanged).
2. Keep an accessible path to the post on each card — the title/caption stays a link, so keyboard and screen-reader users aren't locked out.
3. Verify on touch: a swipe or stray tap on the photo does nothing; expand → lightbox → View Post works.

**Prompt**

> Do item 7 from NEXT-STEPS.md: in the feed, images must not link to the post — expand button → lightbox → "View Post" is the only route from the image, with the card title still linking for keyboard/screen-reader access. Show me before/after in the preview, desktop and narrow.

## 8. From the original plan (Feb 2026), still worth doing

Reviewed the old Phase 7 wishlist against what exists now. EXIF display is already done (post pages). Best remaining candidates, in order:

| What | Why now |
|------|---------|
| **Map view** | The location model (lat/lng, IPTC import) built in October makes it nearly free — a Leaflet page plotting posts fits the travel/hyperlocal direction. GPS is coarse by default, so no precision worries. |
| **Before/after slider** | A compare slider (single frame vs stacked/StarNet result) is a natural fit for astro posts and shows the craft. |
| **Cloudflare Web Analytics** | One toggle + script tag, free, no cookies. Worth doing the day the scheduled uploads start, to see if anyone's watching. |
| **OG share images** | Per-post social cards generated at build. Nice once content flows. |

Skipped on purpose: search (FilterBar already covers 25 posts), comments, newsletter wiring, print store — revisit when traffic exists.

**Prompt (pick one)**

> Do the map view from item 8 in NEXT-STEPS.md: a /map page (EN/FR) plotting published posts with coarse locations, thumbnail popups linking to posts, matching the site's dark glass style. Plan first, show me the plan before building.

## 9. Rank on Google for the full name — without the name in URLs or page text

Checked 2026-11-05: `site:gphoto.pages.dev` returns nothing (the site isn't indexed yet), and a search for "Gabriel Mercier-Blouin" has zero competing results. So the goal is very reachable, and machine-readable-only signals should be enough. Current state: every page already ships schema.org `Person` JSON-LD, but as **"Gabriel Mercier"**; the `<title>` is "… | Gabriel Mercier Photography"; sharp strips all image metadata; there is no `public/robots.txt`.

**The legitimate invisible channels (in order of impact)**

1. **Get indexed first.** Add `public/robots.txt` with a `Sitemap:` line (the sitemap already builds), verify the site in Google Search Console, submit the sitemap. Nothing ranks until this is done.
2. **Fix the JSON-LD name.** Change the `Person` in `Base.astro`, `PostPage`, `GalleryPage`, `ProjectPage` to full name `Gabriel Mercier-Blouin` with `alternateName: 'Gabriel Mercier'`, and add `sameAs:` links to public profiles (Instagram/GitHub/etc.). JSON-LD is invisible to visitors and is exactly the channel Google provides for this.
3. **External links** — the strongest signal and nothing on the site changes: put the site URL on profiles that carry the full name (Instagram bio, GitHub, LinkedIn…). Google associates the entity from the web graph.
4. **IPTC Creator/Credit in the served JPEGs.** Google Images reads IPTC creator metadata ("image credit"). Needs an exiftool (or equivalent) step in `optimize-images` since sharp currently strips everything. Invisible on the page.
5. **Optional, decide in-session:** full name in the `meta description` — never visible on the site, but it *would* appear in Google's result snippet. Same question for the `<title>` (browser tab). Stronger signal; Gabriel decides where the line is.

**Not doing:** hidden text (`display:none`, offscreen spans) — against Google's guidelines, can get the site demoted; name-stuffed alt text — alt describes the photo, not the author.

**Honest expectations:** indexing takes days-to-weeks after Search Console submission; the name→site association can take longer. With zero competition on the name, steps 1–3 alone will very likely put the site at #1 eventually. A custom domain (a neutral one, no name needed — e.g. gmbpho.com) would also help general credibility but is optional.

**Prompt**

> Do item 9 from NEXT-STEPS.md: robots.txt + sitemap wiring, fix the Person JSON-LD to my full name with alternateName and sameAs (I'll give you the profile URLs), and add the IPTC creator step to optimize-images. Show me exactly where my full name will and won't appear before committing. Then walk me through the Search Console verification — that part is on my account.

**Status 2026-11-05:** robots.txt + the shared Person JSON-LD (`src/utils/author.ts`: full name, alternateName, stable @id, QC/CA address) shipped. Still open: Search Console verification (Gabriel's account — meta tag to add once he has the token), `sameAs` profile URLs, IPTC creator metadata (deferred: exiftool isn't installed and rewriting every committed optimized image would bloat git history — fold it into the item-5 import session so only new images carry it, backfill later if ever), and the name-in-meta-description decision.

## 10. Rank for topics: "street photography Québec", "astrophotographie", …

Different game from item 9: Google ranks *pages* for topic queries, not sites. A query like "photographie de rue Québec" needs a page whose title, description, heading and copy actually say that — the current gallery/tag pages are thin (generic titles, no copy). What moves the needle, in order:

1. **Landing pages with real copy.** The `projects` collection is the natural vehicle: a "Street photography in Québec City" / « Photographie de rue à Québec » project page with a paragraph of honest FR+EN text, cover, and its posts. One good page per theme (street, astro, travel) beats keywords sprinkled everywhere.
2. **Per-page titles/descriptions.** Tag and gallery pages currently share near-identical meta; give the important ones specific localized titles ("Astrophotography from Québec — Gabriel Mercier Photography").
3. **French matters most for Québec queries** — the FR pages are not a translation afterthought here, they're the primary surface. Sitemap already declares hreflang pairs; in-page `<link rel=alternate hreflang>` in Base.astro is a cheap belt-and-braces addition.
4. **Cadence feeds it.** The scheduled publishing from item 5 is itself an SEO signal (fresh content, growing archive). Do item 5 first.

Honest expectations: unlike the zero-competition name search, these queries have real competitors (working photographers, tourism sites). Months, not weeks — and content quality/volume decides it, not markup.

**Prompt**

> Do item 10 from NEXT-STEPS.md, starting with one landing page: a [street|astro|travel] project with real bilingual copy aimed at "[query]", plus specific meta titles/descriptions for it and the gallery, and in-page hreflang alternates in Base.astro. Draft all copy for my review first.

---

# Original queue (2026-10-25)

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
