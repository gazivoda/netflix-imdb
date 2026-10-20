import { ImageResponse } from 'next/og';

// Shared artwork for the generated PNG icons (apple-touch-icon, 512px icon).
// Mirrors public/icon.svg: a gold square with an ink border and hard offset shadow and a red
// star with an ink outline, on paper. Pure shapes, so no font is needed.
const STAR = '29.00,10.00 33.70,23.03 47.55,23.47 36.60,31.97 40.46,45.28 29.00,37.49 17.54,45.28 21.40,31.97 10.45,23.47 24.30,23.03';

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
          <rect x="3" y="3" width="52" height="52" fill="#f2c230" stroke="#111111" strokeWidth="3" />
          <polygon points={STAR} fill="#e5241b" stroke="#111111" strokeWidth="1.2" strokeLinejoin="round" />
        </svg>
      </div>
    ),
    { width: px, height: px },
  );
}
