import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

export type AssistantFileBlobState =
  | { status: 'loading' }
  | { status: 'ready'; objectUrl: string; blob: Blob }
  | { status: 'error' }

/**
 * Load a file from the assistant bridge as a Blob and expose it as an object URL.
 *
 * A plain `<img src="/api/v1/ai-assistant/files/…">` cannot be used here: the
 * CRM authenticates with a bearer token held in localStorage, and the browser
 * does not attach it to a subresource request, so the image would 401. Fetching
 * through the shared axios client (which adds the header and follows the 401 →
 * re-login rule) and minting an object URL is the same route
 * `DocumentPreviewModal` already takes for client documents.
 *
 * The object URL is revoked when the URL changes or the component unmounts, so
 * switching conversations leaks nothing. The result is stored together with the
 * URL it belongs to: after a change, the previous (already revoked) blob can
 * never be handed back — the hook reports `loading` until the new one lands.
 */
export function useAssistantFileBlob(url: string): AssistantFileBlobState {
  const [outcome, setOutcome] = useState<{
    key: string
    result: AssistantFileBlobState
  } | null>(null)

  useEffect(() => {
    let cancelled = false
    let objectUrl: string | null = null
    const controller = new AbortController()

    api
      .get<Blob>(url, { responseType: 'blob', signal: controller.signal })
      .then((response) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(response.data)
        setOutcome({ key: url, result: { status: 'ready', objectUrl, blob: response.data } })
      })
      .catch(() => {
        // Any failure (404 from an expired token, 403, network) collapses into
        // one state — the bubble shows a placeholder instead of a broken image.
        if (!cancelled) setOutcome({ key: url, result: { status: 'error' } })
      })

    return () => {
      cancelled = true
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [url])

  return outcome?.key === url ? outcome.result : { status: 'loading' }
}
