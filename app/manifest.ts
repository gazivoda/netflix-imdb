import type { MetadataRoute } from 'next';
import { HOME_DESCRIPTION } from '../lib/pages';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Netflix Ratings',
    short_name: 'Netflix Ratings',
    description: HOME_DESCRIPTION,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#ece6d8',
    theme_color: '#ece6d8',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
      { src: '/icon', sizes: '512x512', type: 'image/png' },
    ],
  };
}
