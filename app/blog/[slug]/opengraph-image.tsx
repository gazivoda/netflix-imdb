import { notFound } from 'next/navigation';
import { renderFilmCard, BLOG_OG_SIZE } from '../_components/og-card';
import { getBlogData } from '../_lib/data';

export const alt = 'Rating Watch: IMDb and Rotten Tomatoes scores for a Netflix film';
export const size = BLOG_OG_SIZE;
export const contentType = 'image/png';
// Only published articles have a card: unknown slugs are a 404, nothing renders on demand.
export const dynamicParams = false;

export function generateStaticParams(): { slug: string }[] {
  return (getBlogData()?.publishedSlugs ?? []).map((slug) => ({ slug }));
}

export default async function Image({ params }: { params: { slug: string } }) {
  const data = getBlogData();
  const film = data?.films.find((f) => f.slug === params.slug);
  if (!data || !film || !data.published.has(film.slug)) notFound();
  return renderFilmCard(film, data.stats[film.slug]);
}
