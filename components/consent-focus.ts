// Focus and dismissal rules for the cookie banner, kept pure so they are unit-testable without a DOM.
import type { Consent } from '../lib/consent'

interface Focusable { isConnected: boolean; focus(opts?: FocusOptions): void }

/**
 * Where focus goes once the banner is gone. A reopened banner returns to the control that opened it (the footer's
 * "Cookie settings"). The first-visit banner has no opener, and removing the focused button would drop focus on <body>,
 * so it goes to the page's main landmark (tabindex -1, the skip link's target) instead.
 */
export function focusTargetAfterBanner(
  opener: Focusable | null,
  doc: { getElementById(id: string): Focusable | null },
): Focusable | null {
  if (opener && opener.isConnected) return opener
  const main = doc.getElementById('main')
  return main && main.isConnected ? main : null
}

/**
 * Escape closes the banner only when the visitor reopened it to review a choice they already made. The first-visit
 * banner asks for a decision and stays until Accept or Decline; Escape there would be a silent third answer.
 */
export function escapeDismissesBanner(reopened: boolean, stored: Consent): boolean {
  return reopened && stored !== null
}
