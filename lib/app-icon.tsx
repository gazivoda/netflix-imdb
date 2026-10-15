import { ImageResponse } from 'next/og';

// Shared artwork for the generated PNG icons (apple-touch-icon, 512px icon).
// Mirrors public/icon.svg: a signal-red square with an ink border and hard offset
// shadow, an "N" mark with its own ink shadow, on paper. Pure shapes, so no font is needed.
const N = 'M20 45V13h9l10 18V13h8v32h-9L28 27v18z';

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
          background: '#ece6d8',
        }}
      >
        <svg width={px} height={px} viewBox="0 0 64 64">
          <rect x="9" y="9" width="52" height="52" fill="#111111" />
          <rect x="3" y="3" width="52" height="52" fill="#e5241b" stroke="#111111" strokeWidth="3" />
          <path d={N} transform="translate(-1.5 2)" fill="#111111" />
          <path d={N} transform="translate(-4 -1)" fill="#f6f1e5" />
        </svg>
      </div>
    ),
    { width: px, height: px },
  );
}
