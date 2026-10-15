import { ImageResponse } from 'next/og';

// Shared artwork for the generated PNG icons (apple-touch-icon, 512px icon).
// Drawn with an SVG path, mirroring public/icon.svg, so no font is needed.
export function renderAppIcon(px: number) {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0c0a0b',
        }}
      >
        <svg width={px * 0.7} height={px * 0.7} viewBox="0 0 64 64">
          <path
            d="M32 8l6.5 13.2 14.5 2.1-10.5 10.2 2.5 14.5L32 41l-13 6.9 2.5-14.5L11 23.3l14.5-2.1z"
            fill="#F5C518"
          />
        </svg>
      </div>
    ),
    { width: px, height: px },
  );
}
