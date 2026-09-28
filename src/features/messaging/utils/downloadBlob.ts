/**
 * How long the object URL and the hidden link outlive the click.
 *
 * Revoking right after `click()` works in a bare browser, but download
 * managers, antivirus hooks and "ask where to save" flows read the URL a
 * moment later — against an already revoked URL the save silently fails while
 * the CRM got a 200 (fb28: 17 clicks on one assistant export, nothing saved).
 * A minute is far longer than any of them needs and short enough that the
 * Blob does not linger in memory.
 */
export const DOWNLOAD_URL_TTL_MS = 60_000

/** Trigger a browser download for a Blob (e.g. CSV export). */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  setTimeout(() => {
    // `remove()` is a no-op when the page already dropped the node, where
    // `removeChild` would throw long after the caller has moved on.
    link.remove()
    try {
      URL.revokeObjectURL(url)
    } catch {
      // Nothing to report a minute later: the only cost is a Blob kept until
      // the page unloads, and the download itself has long been handed over.
    }
  }, DOWNLOAD_URL_TTL_MS)
}
