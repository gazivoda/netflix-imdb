# Ratings guide browser verification

Captured October 23, 2026 from the local Node 22 production build at `http://localhost:3107/how-to/netflix-ratings-explained`. These are local release checks, not evidence of live deployment or field Core Web Vitals.

- `ratings-guide-desktop.png`: 1440×1000 viewport, initial consent state.
- `ratings-guide-mobile.png`: 320×900 viewport, initial consent state.
- `ratings-table-mobile.png`: 320×900 viewport after declining analytics and scrolling to the comparison. The table scrolls within a named, keyboard-focusable region; document width remains320 px.

Browser assertions: one H1; correct canonical metadata and full author identity in the Article JSON-LD; all three store links use the official listing. Document scroll width equals viewport width at 320 px and 1440 px. Declining consent leaves Google Analytics unloaded. The new page uses existing typography, styles, consent controls and navigation; no new client component or dependency was added.

The registry title was subsequently changed to sentence case to comply with the existing brand guard; screenshot body text and layout remain identical. See `tasks/todo.md` and the consolidated growth report for final validation.
