/**
 * Send a window to `url` without a `Referer` header.
 *
 * `window.open(url, '_blank', 'noopener,noreferrer')` suppresses the referrer
 * but returns `null`, so a caller that must open the tab synchronously inside
 * the click (and learn whether a popup blocker refused it) opens a blank tab
 * instead and navigates it later. `tab.location.href = url` and
 * `location.assign(url)` are started by the CRM page and carry its URL as the
 * `Referer`. A `rel="noreferrer"` link clicked inside the target window's own
 * document is a navigation that window starts itself, with no referrer.
 *
 * Works for the current window too (`navigateWithoutReferrer(window, url)`).
 * If the target's document is unreachable (the tab already went to another
 * origin), the navigation still happens through `location` — silently not
 * navigating would burn a one-time link.
 */
export function navigateWithoutReferrer(target: Window, url: string): void {
  let doc: Document
  try {
    doc = target.document
  } catch {
    target.location.href = url
    return
  }
  const link = doc.createElement('a')
  link.href = url
  link.rel = 'noreferrer noopener'
  // Some engines follow only a link that is in the document.
  ;(doc.body ?? doc.documentElement).appendChild(link)
  link.click()
  link.remove()
}
