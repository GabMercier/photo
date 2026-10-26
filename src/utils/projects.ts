/**
 * Project Utilities
 *
 * A project (src/content/projects/*.md) groups posts that carry
 * `project: <slug>`. Everything a project page or card shows beyond its
 * own title and description is derived from those posts: cover, glow
 * color, date range and count.
 */
import { getCollection } from 'astro:content';
import type { CollectionEntry } from 'astro:content';
import type { Locale } from './i18n';

let hasProjectsPromise: Promise<boolean> | undefined;

/**
 * Whether at least one published project exists (drives the nav link).
 * Memoized in production so the header asks the content layer once per
 * build instead of once per page; in dev it stays live so the link appears
 * as soon as the first project is saved.
 */
export function hasPublishedProjects(): Promise<boolean> {
  const query = () => getCollection('projects', ({ data }) => !data.draft).then(list => list.length > 0);
  if (!import.meta.env.PROD) return query();
  hasProjectsPromise ??= query();
  return hasProjectsPromise;
}

export interface ProjectSummary {
  project: CollectionEntry<'projects'>;
  /** Published posts of the project, newest first */
  posts: CollectionEntry<'posts'>[];
  /** Explicit cover from the project, else the featured or newest post's cover */
  cover?: { src: string; alt: { en: string; fr: string } };
  /** Glow color of the post the cover comes from */
  glowColor?: string | null;
  newest?: Date;
  oldest?: Date;
}

export function summarizeProject(
  project: CollectionEntry<'projects'>,
  allPosts: CollectionEntry<'posts'>[]
): ProjectSummary {
  const posts = allPosts
    .filter(post => post.data.project === project.id)
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf() || b.id.localeCompare(a.id));

  const coverPost = posts.find(post => post.data.featured) || posts[0];
  const cover = project.data.coverImage
    ?? (coverPost ? { src: coverPost.data.coverImage.src, alt: coverPost.data.coverImage.alt } : undefined);

  return {
    project,
    posts,
    cover,
    glowColor: coverPost?.data.glowColor,
    newest: posts[0]?.data.date,
    oldest: posts[posts.length - 1]?.data.date,
  };
}

/** "août 2025" or "août 2025 – octobre 2025" */
export function formatDateRange(oldest: Date | undefined, newest: Date | undefined, locale: Locale): string {
  if (!oldest || !newest) return '';
  const formatter = new Intl.DateTimeFormat(locale === 'fr' ? 'fr-CA' : 'en-CA', { month: 'long', year: 'numeric' });
  const from = formatter.format(oldest);
  const to = formatter.format(newest);
  return from === to ? from : `${from} – ${to}`;
}

/** Sort for the index: featured first, then most recent work */
export function compareProjects(a: ProjectSummary, b: ProjectSummary): number {
  return Number(b.project.data.featured) - Number(a.project.data.featured)
    || (b.newest?.valueOf() ?? 0) - (a.newest?.valueOf() ?? 0)
    || a.project.id.localeCompare(b.project.id);
}
