/**
 * Tag Label Utility
 *
 * Loads bilingual tag labels from src/data/tags/*.md at build time.
 * Each file has YAML frontmatter with `en` and `fr` keys.
 */
import fs from 'node:fs';
import path from 'node:path';

export interface TagData {
  en: string;
  fr: string;
}

let cache: Record<string, TagData> | null = null;

export function loadTags(): Record<string, TagData> {
  if (cache) return cache;

  const dir = path.join(process.cwd(), 'src/data/tags');
  if (!fs.existsSync(dir)) return {};

  const tags: Record<string, TagData> = {};
  for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.md'))) {
    const content = fs.readFileSync(path.join(dir, file), 'utf-8');
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (match) {
      const fm = match[1];
      const slug = file.replace('.md', '');
      tags[slug] = {
        en: fm.match(/en:\s*"([^"]+)"/)?.[1] || slug,
        fr: fm.match(/fr:\s*"([^"]+)"/)?.[1] || slug,
      };
    }
  }

  cache = tags;
  return tags;
}
