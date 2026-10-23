// Single source of truth for the home page promo video: the visible section (PromoVideo),
// its caption and the VideoObject JSON-LD (lib/seo.ts) all read from here so they cannot drift.

export const PROMO_VIDEO = {
  title: 'Rating Watch in 30 seconds',
  src: '/video/rating-watch-promo.mp4',
  poster: '/video/rating-watch-promo-poster.webp',
  uploadDate: '2026-10-20',
  duration: 'PT30S',
  playLabel: 'Watch the 30 second overview',
  // Two plain sentences, shown under the video and reused as the JSON-LD description.
  caption:
    'The free Chrome extension puts IMDb and Rotten Tomatoes scores on Netflix title cards where available, so you can pick something before you press play. The optional AR mode points your phone camera at a TV and shows available scores over the titles it matches.',
} as const;
