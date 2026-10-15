import { ImageResponse } from 'next/og';

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_ALT =
  'Netflix Ratings: IMDb and Rotten Tomatoes scores shown on Netflix title cards';

// One shared card for og:image and twitter:image. Rendered at build time.
export function renderOgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 72,
          background: 'linear-gradient(135deg, #0c0a0b 0%, #1d1819 100%)',
          color: '#f6f2ef',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: '#e50914',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 30,
              fontWeight: 800,
            }}
          >
            NR
          </div>
          <div style={{ fontSize: 40, fontWeight: 700 }}>Netflix Ratings</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>
            Know if it is worth watching before you press play.
          </div>
          <div style={{ fontSize: 32, color: '#b3a9a4' }}>
            Free Chrome extension. IMDb + Rotten Tomatoes on Netflix.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 20 }}>
          <div
            style={{
              display: 'flex',
              padding: '14px 28px',
              borderRadius: 14,
              background: '#f5c518',
              color: '#0c0a0b',
              fontSize: 36,
              fontWeight: 800,
            }}
          >
            IMDb
          </div>
          <div
            style={{
              display: 'flex',
              padding: '14px 28px',
              borderRadius: 14,
              background: '#fa320a',
              color: '#fff',
              fontSize: 36,
              fontWeight: 800,
            }}
          >
            Rotten Tomatoes
          </div>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
