import { renderOgImage, OG_SIZE, OG_ALT } from '../lib/og';

export const alt = OG_ALT;
export const size = OG_SIZE;
export const contentType = 'image/png';

export default function Image() {
  return renderOgImage();
}
