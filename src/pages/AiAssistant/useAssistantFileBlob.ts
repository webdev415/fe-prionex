import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

/**
 * Failure codes the file gateway returns in `{"detail": {"code", "message"}}`.
 * Only the ones worth a distinct sentence to the operator are named; the rest
 * (401 is handled globally by the axios interceptor, 403 by the access gate)
 * collapse into the generic message.
 */
export type AssistantFileErrorCode = 'file_not_found' | 'file_too_large' | 'brain_unavailable'

const KNOWN_ERROR_CODES = new Set<string>(['file_not_found', 'file_too_large', 'brain_unavailable'])

export type AssistantFileBlobState =
  | { status: 'loading' }
  | { status: 'ready'; objectUrl: string; blob: Blob }
  | { status: 'error'; code?: AssistantFileErrorCode }

/**
 * Read a Blob as text. `Blob.text()` is absent in Safari below 14 (and in the
 * jsdom used by the tests), so fall back to the FileReader that predates it.
 */
function blobToText(blob: Blob): Promise<string> {
  if (typeof blob.text === 'function') return blob.text()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(blob)
  })
}

/**
 * Read the gateway's error code out of a failed request.
 *
 * The body is JSON, but the request asked for `responseType: 'blob'`, so axios
 * hands back a Blob even on failure — it has to be read back as text before the
 * code is visible.
 */
export async function readAssistantFileErrorCode(
  error: unknown
): Promise<AssistantFileErrorCode | undefined> {
  const data = (error as { response?: { data?: unknown } })?.response?.data
  try {
    const raw = data instanceof Blob ? JSON.parse(await blobToText(data)) : data
    const code = (raw as { detail?: { code?: unknown } })?.detail?.code
    return typeof code === 'string' && KNOWN_ERROR_CODES.has(code)
      ? (code as AssistantFileErrorCode)
      : undefined
  } catch {
    // Non-JSON body (network error, gateway HTML) — generic message it is.
    return undefined
  }
}

/**
 * Load a file from the assistant bridge as a Blob and expose it as an object URL.
 *
 * A plain `<img src="/api/v1/ai-assistant/files/…">` cannot be used here: the
 * gateway authenticates with a bearer token held in localStorage (it reads only
 * the `Authorization` header — there is no cookie auth), and the browser does
 * not attach it to a subresource request, so the image would 401. Fetching
 * through the shared axios client and minting an object URL is the same route
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
      .catch(async (error: unknown) => {
        if (cancelled) return
        const code = await readAssistantFileErrorCode(error)
        if (!cancelled) setOutcome({ key: url, result: { status: 'error', code } })
      })

    return () => {
      cancelled = true
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [url])

  return outcome?.key === url ? outcome.result : { status: 'loading' }
}
