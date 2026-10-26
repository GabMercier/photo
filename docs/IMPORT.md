# Importing photos in bulk

`npm run import` turns a folder of exported JPEGs into posts. It reads the
metadata Lightroom embeds, writes a web-sized copy of each image, creates the
posts, and runs the prebuild so the result is ready to commit.

```bash
npm run import -- ~/Pictures/export/charlevoix --project charlevoix-2025 --project-title "Charlevoix 2025" --project-kind travel
```

Think of it as a bulk create on the Posts table: each image becomes a row,
with the columns filled from the file instead of typed in the CMS form.

## Before exporting from Lightroom

Fill what you want on the site while the photos are still in Lightroom, then
export once. Everything below is optional; empty fields stay empty.

| Lightroom field | Lands in | Notes |
|---|---|---|
| Title | `title` | Bilingual convention below |
| Caption | `description` | Shown under the photo, used for share cards |
| Alt Text (Accessibility) | `coverImage.alt` | Lightroom Classic 12+; the site reads it as the alt text |
| Keywords | `tags` | Matched against `src/data/tags/` by slug, English or French label, or `scripts/import/keyword-map.json` |
| Sublocation, City, State/Province, Country, ISO Country Code | `location` | Country becomes the 2-letter code, translated at build time |
| GPS | `location.lat/lng` | See *GPS and privacy* |
| Capture date | `date` and `dateTaken` | `--date today` publishes with today's date instead |
| Camera, lens, exposure | `exifSummary`, EXIF display | Through the existing prebuild; `--lens` names a manual lens |
| Hierarchical keyword `Projet|Charlevoix 2025` | `project` | Any root named project, projet, series or série |

**Bilingual texts.** Lightroom has one Title, one Caption and one Alt Text.
Write both languages in one field separated by two pipes, French first by
default:

```
Lever sur le fleuve || Sunrise over the river
```

A single text goes to the `--lang` side (default `fr`) and the other side is
listed in the report for translation. `--mirror` copies it to both sides
instead, which suits proper nouns.

**Export settings.** JPEG, sRGB, quality 90 or more, any size (the script
resizes to the site's 2400 px ceiling). Under *Metadata*, choose
*All Metadata* and leave *Remove Location Info* unchecked if you want the
coordinates in the post; the script controls what reaches the published file.

## What the script does

1. **Reads** EXIF, XMP and IPTC from each file (`scripts/import/metadata.ts`).
2. **Writes the image** to `public/images/uploads/` as lowercase `.jpg`, long
   edge capped at `--max-edge` (2400). Files already within the ceiling are
   copied byte for byte when nothing has to be stripped. Camera EXIF, the ICC
   profile and the XMP travel with the file; the GPS block does not, unless
   `--gps precise`.
3. **Writes a post** per image in `src/content/posts/` named
   `YYYY-MM-DD-<title-or-filename>.md`, with the same fields the CMS writes,
   plus `location` and `project`.
4. **Creates vocabulary** it needs: the project file when `--project` or a
   project keyword points to one that does not exist yet, and tag files for
   unknown keywords when `--create-tags` is given.
5. **Records** each import in `src/data/import-manifest.json` (source name,
   content hash, size, post). Re-importing the same file is a no-op.
6. **Runs `npm run prebuild`** so optimized sizes, glow colors and EXIF
   summaries exist before you commit. `--no-prebuild` skips it.
7. **Writes a report** to `scripts/import/last-report.md` (ignored by git):
   what was created, and a *Needs attention* list of missing alt text,
   untranslated titles, keywords that matched no tag, unrecognised countries
   and files that carried GPS.

Nothing is pushed. Review the posts in the CMS or in your editor, then commit
and push; the GitHub Action deploys.

## Options

```
--project <slug>          group every post under this project (created if missing)
--project-title "<text>"  title of a new project ("Français || English")
--project-kind <kind>     travel | local | astro | other
--tags a,b                tag slugs added to every post
--lang fr|en              language of single-language text (default fr)
--mirror                  copy single-language text to both languages
--date taken|today        publication date source (default taken)
--draft                   create posts as drafts
--one-post                one series post for the whole folder
--cover <file>            cover image for --one-post (default: earliest shot)
--title, --description    texts for --one-post ("Français || English")
--show-exif               show camera info on the post page
--lens "<name>"           lens for images whose EXIF has none (manual lenses)
--gps coarse|precise|none GPS handling (default coarse)
--max-edge <px>           long-edge ceiling (default 2400)
--quality <1-100>         JPEG quality when re-encoding (default 90)
--create-tags             create tags for unknown keywords
--update                  fill empty fields of existing posts, never overwrite
--dry-run                 plan and report only, write nothing
--no-prebuild             skip npm run prebuild
```

Always try `--dry-run` first on a new lot: it prints the plan and the full
report without touching the repository.

## Recipes

A trip, one project, French captions written in Lightroom:

```bash
npm run import -- ~/Pictures/export/islande --project islande-2026 --project-title "Islande 2026 || Iceland 2026" --project-kind travel
```

Deep-sky work on the manual 180 mm, camera info shown, everything tagged astro:

```bash
npm run import -- ~/Pictures/export/orion --lens "Nikkor 180mm f/2.8 AI-S" --tags astro --show-exif --gps none
```

One series post made of eight frames, with the fourth one as cover:

```bash
npm run import -- ~/Pictures/export/rue-saint-jean --one-post --cover _DSC5104.jpg --title "Rue Saint-Jean, quatre saisons || Rue Saint-Jean, four seasons" --project rue-saint-jean --project-kind local
```

Re-export the same files after filling titles and locations in Lightroom, and
let the script fill the gaps without touching what you edited in the CMS:

```bash
npm run import -- ~/Pictures/re-export --update
```

Posts first, decisions later: import as drafts, publish from the CMS.

```bash
npm run import -- ~/Pictures/export/essais --draft
```

## Keywords and tags

A keyword matches a tag when its accent- and case-insensitive form equals the
tag slug, its English label or its French label (`Noir et blanc`, `Black and
White`, `black-and-white` all give `black-and-white`). Synonyms live in
`scripts/import/keyword-map.json` (`"n&b": "black-and-white"`). Keywords that
match nothing are listed in the report; they never create tags unless
`--create-tags` is given, so the vocabulary stays curated.

Hierarchical keywords are read for the project only. Their other levels
(`Lieux|Québec|Charlevoix`) are left alone: location comes from the location
fields, not from keywords.

## Projects

A project is a trip, a place you keep coming back to, or any body of work:
`src/content/projects/<slug>.md` with a bilingual title and description, a
kind (travel, local, astro, other), an optional location and cover. Posts
point at it with `project: <slug>`. The site lists projects at `/projects`
and shows each one at `/projects/<slug>`; the nav link appears once a project
exists. The cover, date range and photo count come from the posts unless the
project sets its own cover.

`--project` creates the file with the title you give (or a title made from the
slug) and leaves the description for the CMS. A multi-image *post*
(`postType: series`) is a different thing: one post holding several images.

## GPS and privacy

Phones and some cameras write exact coordinates. For hyperlocal work that
points at home, so the default is cautious:

- `coarse` (default): coordinates rounded to two decimals (about 1 km) in the
  post, GPS block removed from the published JPEG. Camera, lens, exposure and
  capture date are kept so the EXIF display still works.
- `precise`: exact coordinates in the post, the file published with every
  byte of its metadata.
- `none`: no coordinates anywhere.

Files without GPS keep all their metadata in every mode. Note that the 22
images uploaded before this script existed carry whatever metadata Lightroom
or the phone wrote; the iPhone shots among them include GPS.

## Re-running, renaming, updating

- The same file imported twice is skipped (matched by content, whatever its
  name).
- A different file whose name clashes with an existing upload is renamed
  (`_dsc4420-2.jpg`) and the report says so.
- `--update` refreshes existing posts from the files: it only fills fields
  that are empty (title, description, alt text, location, project, date taken,
  lens override) and adds missing tags. It recognises both files imported by
  the script and older uploads with the same filename, so re-exporting the
  original 22 images with metadata filled in Lightroom is a supported way to
  enrich them.

## After the import

1. Open the CMS (`npm run dev`, then `/admin/`) or the files under
   `src/content/posts/` and go through the *Needs attention* list.
2. Alt text in both languages matters most: ask Claude to draft it from the
   images, or fill Lightroom's Alt Text field before the next export.
3. Commit and push. The prebuild outputs (`public/images/optimized/`, the
   manifests, `glowColor` and `exifSummary` in the posts) are committed
   because CI does not run the prebuild.
