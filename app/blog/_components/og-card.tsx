import { ImageResponse } from 'next/og';
import { CARD, GOLD, INK, OG_SIZE, ON_SIGNAL, PAPER, SIGNAL, loadFonts, mono } from '../../../lib/og';
import type { FilmStats } from '../../../lib/blog/stats';
import type { Film } from '../../../lib/blog/types';
import { cardText, gapMarkerPercent } from '../_lib/og-text';

export const BLOG_OG_SIZE = OG_SIZE;

function Score({ bg, color, name, value }: { bg: string; color: string; name: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ ...mono, fontSize: 18, color: INK, display: 'flex' }}>{name}</div>
      <div
        style={{
          display: 'flex',
          alignSelf: 'flex-start',
          padding: '8px 24px 6px',
          background: bg,
          color,
          border: `5px solid ${INK}`,
          boxShadow: `7px 7px 0 ${INK}`,
          fontFamily: 'Archivo',
          fontWeight: 900,
          fontSize: 96,
          lineHeight: 1,
        }}
      >
        {value}
      </div>
    </div>
  );
}

/** Text-only share card for one film: title, year, both scores, gap bar. No posters, no logos. */
export async function renderFilmCard(film: Film, stats: FilmStats) {
  const t = cardText(film, stats);
  const fonts = await loadFonts();
  const marker = gapMarkerPercent(stats.gap);
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', padding: '40px 58px 58px 40px', background: PAPER, color: INK, fontFamily: 'Archivo' }}>
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '30px 44px 28px 44px',
            background: CARD,
            border: `6px solid ${INK}`,
            boxShadow: `18px 18px 0 ${INK}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', padding: '7px 14px', background: SIGNAL, color: ON_SIGNAL, border: `3px solid ${INK}`, fontSize: 18, ...mono }}>
              Rating Watch
            </div>
            <div style={{ ...mono, fontSize: 18, display: 'flex' }}>IMDb vs Rotten Tomatoes</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div
              style={{
                display: 'flex',
                fontFamily: 'Archivo',
                fontWeight: 900,
                fontSize: t.titleSize,
                lineHeight: 0.92,
                textTransform: 'uppercase',
                wordSpacing: 8,
              }}
            >
              {t.title}
            </div>
            <div style={{ display: 'flex', fontFamily: 'Instrument Serif', fontStyle: 'italic', fontWeight: 400, fontSize: 50, color: SIGNAL }}>
              {t.year}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 }}>
            <div style={{ display: 'flex', gap: 36 }}>
              <Score bg={GOLD} color={INK} name="IMDb" value={t.imdb} />
              <Score bg={SIGNAL} color={ON_SIGNAL} name="Rotten Tomatoes" value={t.rt} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 330 }}>
              <div style={{ ...mono, fontSize: 18, display: 'flex' }}>Gap {t.gap} points</div>
              <div style={{ display: 'flex', position: 'relative', height: 26, border: `4px solid ${INK}`, background: PAPER }}>
                <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 3, background: INK, display: 'flex' }} />
                <div style={{ position: 'absolute', left: `${marker}%`, top: -8, width: 16, height: 34, marginLeft: -8, background: SIGNAL, border: `3px solid ${INK}`, display: 'flex' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', ...mono, fontSize: 13 }}>
                <div style={{ display: 'flex' }}>Audiences</div>
                <div style={{ display: 'flex' }}>Critics</div>
              </div>
              <div style={{ ...mono, fontSize: 17, textTransform: 'none', display: 'flex' }}>{t.verdict}</div>
            </div>
          </div>

          <div style={{ ...mono, fontSize: 18, textTransform: 'none', display: 'flex' }}>{t.asOf}</div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts },
  );
}
