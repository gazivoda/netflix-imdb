// Reserves room at the bottom of the page for the fixed cookie banner so it never covers the footer's last rows.
// The banner publishes its height as --consent-h on <html>; globals.css turns that into body padding-bottom.
export const CONSENT_SPACE_VAR = '--consent-h'

export function reserveBottomSpace(root: HTMLElement, el: HTMLElement, Observer?: typeof ResizeObserver): () => void {
  const apply = () => root.style.setProperty(CONSENT_SPACE_VAR, `${el.offsetHeight}px`)
  apply()
  const observer = Observer ? new Observer(apply) : null
  observer?.observe(el)
  return () => {
    observer?.disconnect()
    root.style.removeProperty(CONSENT_SPACE_VAR)
  }
}
