import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';

// Bump when the card design changes: Next serves these routes with a 1-year
// immutable cache, so a new query string is the only way to refresh shared previews.
export const OG_VERSION = '3';

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_ALT =
  'Rating Watch: IMDb and Rotten Tomatoes scores shown on Netflix title cards';

// Brand tokens from docs/DESIGN.md. next/og cannot read CSS variables.
export const PAPER = '#ece6d8';
export const CARD = '#f6f1e5';
export const INK = '#111111';
export const SIGNAL = '#e5241b';
/** Text on SIGNAL (globals.css: --signal takes white text only). */
export const ON_SIGNAL = '#fff';
export const GOLD = '#f2c230';

// next/og cannot fetch fonts (offline builds), so the same faces the site uses are
// bundled in lib/fonts (Archivo static instance at wdth 62 / wght 900, JetBrains Mono
// 700, Instrument Serif Italic; all SIL OFL from Google Fonts).
// Read from disk (the route is prerendered at build time, cwd is the project root).
const load = (file: string) => readFile(path.join(process.cwd(), 'lib/fonts', file));

export async function loadFonts() {
  const [archivo, mono, serif] = await Promise.all([
    load('Archivo-ExtraCondensed-Black.ttf'),
    load('JetBrainsMono-Bold.ttf'),
    load('InstrumentSerif-Italic.ttf'),
  ]);
  return [
    { name: 'Archivo', data: archivo, weight: 900 as const, style: 'normal' as const },
    { name: 'JetBrains Mono', data: mono, weight: 700 as const, style: 'normal' as const },
    { name: 'Instrument Serif', data: serif, weight: 400 as const, style: 'italic' as const },
  ];
}

export const mono = {
  fontFamily: 'JetBrains Mono',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: 2,
};

function ScoreTag({ bg, color, name, hint }: { bg: string; color: string; name: string; hint: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div
        style={{
          display: 'flex',
          alignSelf: 'flex-start',
          padding: '8px 22px 6px',
          background: bg,
          color,
          border: `5px solid ${INK}`,
          boxShadow: `7px 7px 0 ${INK}`,
          fontFamily: 'Archivo',
          fontWeight: 900,
          fontSize: 66,
          lineHeight: 1,
        }}
      >
        {name}
      </div>
      <div style={{ ...mono, fontSize: 18, color: INK, display: 'flex' }}>{hint}</div>
    </div>
  );
}

// One shared card for og:image and twitter:image. Rendered at build time.
export async function renderOgImage() {
  const fonts = await loadFonts();
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          padding: '40px 58px 58px 40px',
          background: PAPER,
          color: INK,
          fontFamily: 'Archivo',
        }}
      >
        <div
          style={{
            flex: 1,
            display: 'flex',
            position: 'relative',
            background: CARD,
            border: `6px solid ${INK}`,
            boxShadow: `18px 18px 0 ${INK}`,
          }}
        >
          {/* main ticket */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: '32px 40px 30px 44px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div
                style={{
                  display: 'flex',
                  padding: '7px 14px',
                  background: SIGNAL,
                  color: '#fff',
                  border: `3px solid ${INK}`,
                  fontSize: 18,
                  ...mono,
                }}
              >
                Rating Watch
              </div>
              <div style={{ ...mono, fontSize: 18, display: 'flex' }}>Free Chrome extension</div>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                fontFamily: 'Archivo',
                fontWeight: 900,
                fontSize: 98,
                lineHeight: 0.9,
                textTransform: 'uppercase',
                wordSpacing: 10,
              }}
            >
              <div style={{ display: 'flex' }}>Know if it is</div>
              <div
                style={{
                  display: 'flex',
                  fontFamily: 'Instrument Serif',
                  fontStyle: 'italic',
                  fontWeight: 400,
                  textTransform: 'none',
                  fontSize: 112,
                  wordSpacing: 0,
                  color: SIGNAL,
                  marginTop: 2,
                }}
              >
                worth watching
              </div>
              <div style={{ display: 'flex' }}>before you</div>
              <div style={{ display: 'flex' }}>press play.</div>
            </div>

            <div style={{ ...mono, fontSize: 20, display: 'flex', textTransform: 'none' }}>
              IMDb + Rotten Tomatoes on Netflix title cards
            </div>
          </div>

          {/* perforation */}
          <div
            style={{
              width: 0,
              display: 'flex',
              borderLeft: `5px dashed ${INK}`,
              margin: '14px 0',
            }}
          />

          {/* stub */}
          <div
            style={{
              width: 300,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: 44,
              padding: '0 28px 0 36px',
              background: PAPER,
            }}
          >
            <ScoreTag bg={GOLD} color={INK} name="IMDb" hint="Rating out of 10" />
            <ScoreTag bg={SIGNAL} color="#fff" name="RT" hint="Rotten Tomatoes %" />
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts },
  );
}
