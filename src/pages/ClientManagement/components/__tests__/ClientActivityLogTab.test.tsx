/**
 * Render coverage for the per-client activity tab.
 *
 * Each case here is either a bug that occurred while building the feature or a
 * signal the operator would be misled without:
 *
 *  - the degraded banner — a feed missing a whole source must say so, or it
 *    reads as a complete history and someone concludes "nobody called this
 *    client" when the call service was simply down
 *  - the operator dropdown accumulating — it was rebuilt from each response,
 *    so choosing an operator narrowed the feed to that person and the dropdown
 *    collapsed to the one already chosen, with no way back
 *  - tab labels — the raw values ("documents", "call-sms-history") are internal
 *    state names that mean nothing to a reader
 *  - document reads badged as UI events, not "Data changes"
 */

import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ClientActivityLogTab, type ActivityCallRef } from '../ClientActivityLogTab'
import { activityLogApi, type ActivityLogResponse } from '@/features/clients/api/activityLogApi'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown> | string) => {
      // Mirror the real i18n contract closely enough that a missing
      // interpolation shows up as a failure rather than passing silently.
      const table: Record<string, string> = {
        'pages.clients.detail.activityLog.empty': 'No activity recorded',
        'pages.clients.detail.activityLog.loadError': 'Could not load',
        'pages.clients.detail.activityLog.degraded': 'Some sources are unavailable: {{sources}}.',
        'pages.clients.detail.activityLog.openedTab': "Opened '{{tab}}' tab",
        'pages.clients.detail.activityLog.openedCard': 'Opened the client card',
        'pages.clients.detail.activityLog.sources.events': 'UI events',
        'pages.clients.detail.activityLog.sources.audit': 'Data changes',
        'pages.clients.detail.activityLog.sources.calls': 'Calls',
        'pages.clients.detail.activityLog.filters.allOperators': 'All operators',
        'pages.clients.detail.activityLog.filters.reset': 'Reset',
        'pages.clients.detail.activityLog.recording': 'Recording',
        'pages.clients.detail.activityLog.entryCount': '{{count}} entries',
        'pages.clients.detail.tabs.docs': 'Docs',
        'pages.clients.detail.tabs.callSms': 'Call / SMS',
        // The pagination control names its page buttons through aria-label, so
        // without these every button would answer to the same bare key.
        'components.pagination.goToPage': 'Go to page {{page}}',
        'components.pagination.previousPage': 'Previous page',
        'components.pagination.nextPage': 'Next page',
      }
      const fallback =
        opts && typeof opts === 'object' && typeof opts.defaultValue === 'string'
          ? opts.defaultValue
          : typeof opts === 'string'
            ? opts
            : key
      let out = table[key] ?? fallback
      if (opts && typeof opts === 'object') {
        for (const [k, v] of Object.entries(opts)) {
          out = out.replace(new RegExp(`{{\\s*${k}\\s*}}`, 'g'), String(v))
        }
      }
      return out
    },
    i18n: { language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}))

// jsdom implements neither, and Radix's Select calls both when opened.
// Same stub as UserManagementPage.table.test.tsx.
beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = vi.fn(() => false)
  }
  Element.prototype.scrollIntoView = vi.fn()
})

const getSpy = vi.spyOn(activityLogApi, 'get')

function renderTab(onPlayRecording?: (call: ActivityCallRef) => void) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ClientActivityLogTab clientId={2} isActive onPlayRecording={onPlayRecording} />
    </QueryClientProvider>
  )
}

/** One call entry as the aggregator returns it. */
function callEntry(over: Record<string, unknown> = {}) {
  return entry({
    source: 'calls' as const,
    kind: 'call',
    summary: 'Outbound call — promise_to_pay — 145s',
    detail: {
      call_id: 'a1000001-0000-4000-8000-000000000007',
      direction: 'outbound',
      talk_duration: 145,
      recording_path: '/var/spool/asterisk/monitor/outbound/20260909-071000.wav',
    },
    ...over,
  })
}

function response(over: Partial<ActivityLogResponse> = {}): ActivityLogResponse {
  const entries = over.entries ?? []
  return {
    client_id: 2,
    entries: [],
    degraded: [],
    // Enough for one page unless a test says otherwise, so the pagination
    // control stays out of the way of assertions that are not about it.
    total: entries.length,
    page: 1,
    page_size: 50,
    ...over,
  }
}

let nextEntryId = 0

function entry(over: Partial<ActivityLogResponse['entries'][number]> = {}) {
  return {
    // Unique per call: the list keys on it, and duplicate keys would collapse
    // rows the test expects to count.
    id: `events:${nextEntryId++}`,
    ts: '2026-09-01T10:00:00Z',
    source: 'events' as const,
    kind: 'client_card_open',
    operator_id: 7,
    operator_name: 'Seven Operator',
    summary: 'Opened the client card',
    detail: null,
    ...over,
  }
}

beforeEach(() => {
  getSpy.mockReset()
})

describe('ClientActivityLogTab', () => {
  it('names an unavailable source instead of showing a partial feed as complete', async () => {
    getSpy.mockResolvedValue(response({ entries: [entry()], degraded: ['calls'] }))
    renderTab()

    expect(await screen.findByText(/Some sources are unavailable: Calls/)).toBeVisible()
  })

  it('shows no banner when every source answered', async () => {
    getSpy.mockResolvedValue(response({ entries: [entry()] }))
    renderTab()

    await screen.findByText('Opened the client card')
    expect(screen.queryByText(/Some sources are unavailable/)).toBeNull()
  })

  it('renders tab names as the operator sees them, not raw state values', async () => {
    getSpy.mockResolvedValue(
      response({
        entries: [
          entry({
            kind: 'client_card_section_open',
            detail: { meta: { section: 'documents' } },
          }),
        ],
      })
    )
    renderTab()

    expect(await screen.findByText("Opened 'Docs' tab")).toBeVisible()
    expect(screen.queryByText(/documents/)).toBeNull()
  })

  it('badges a document read as a UI event, not a data change', async () => {
    // It arrives from the audit service, but opening a file changes nothing.
    getSpy.mockResolvedValue(
      response({
        entries: [
          entry({
            source: 'audit',
            kind: 'document.viewed',
            summary: "Viewed 'passport.pdf'",
          }),
        ],
      })
    )
    renderTab()

    await screen.findByText("Viewed 'passport.pdf'")
    expect(screen.getByText('UI events')).toBeVisible()
    expect(screen.queryByText('Data changes')).toBeNull()
  })

  it('keeps a document change badged as a data change', async () => {
    getSpy.mockResolvedValue(
      response({
        entries: [entry({ source: 'audit', kind: 'document.deleted', summary: 'Deleted a file' })],
      })
    )
    renderTab()

    await screen.findByText('Deleted a file')
    expect(screen.getByText('Data changes')).toBeVisible()
  })

  it('keeps every operator in the dropdown after filtering to one of them', async () => {
    // Regression: the list was rebuilt from each response, so selecting an
    // operator narrowed the feed and the dropdown collapsed to that person.
    getSpy.mockResolvedValueOnce(
      response({
        entries: [
          entry({ operator_id: 7, operator_name: 'Seven Operator' }),
          entry({ operator_id: 8, operator_name: 'Eight Operator', ts: '2026-09-01T09:00:00Z' }),
        ],
      })
    )
    renderTab()
    await screen.findAllByText('Opened the client card')

    // A later response containing only one operator must not shrink the list.
    getSpy.mockResolvedValue(
      response({ entries: [entry({ operator_id: 7, operator_name: 'Seven Operator' })] })
    )

    await userEvent.click(screen.getByRole('combobox'))
    // Scoped to the options: both names also appear in the feed rows behind it.
    await waitFor(() => {
      const options = screen.getAllByRole('option').map((o) => o.textContent)
      expect(options).toContain('Eight Operator')
      expect(options).toContain('Seven Operator')
    })
  })

  it('says so when the client has no activity at all', async () => {
    getSpy.mockResolvedValue(response())
    renderTab()
    expect(await screen.findByText('No activity recorded')).toBeVisible()
  })

  it('reports a failed request rather than rendering an empty feed', async () => {
    getSpy.mockRejectedValue(new Error('boom'))
    renderTab()
    expect(await screen.findByText('Could not load')).toBeVisible()
  })

  it('does not query while the tab is not the one on screen', () => {
    getSpy.mockResolvedValue(response())
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <ClientActivityLogTab clientId={2} isActive={false} />
      </QueryClientProvider>
    )
    expect(getSpy).not.toHaveBeenCalled()
  })

  it('hands the call up to be played rather than linking the file path', async () => {
    // `recording_path` names a file on the telephony host, and the endpoint
    // that serves it needs a Bearer token an <a href> cannot send. Every other
    // screen fetches the bytes through CallPlayer for that reason; this tab
    // used to render the raw path as a link, which resolved to nothing.
    const onPlay = vi.fn()
    getSpy.mockResolvedValue(response({ entries: [callEntry()], total: 1 }))
    renderTab(onPlay)

    await userEvent.click(await screen.findByRole('button', { name: 'Recording' }))

    expect(onPlay).toHaveBeenCalledWith(
      expect.objectContaining({
        callId: 'a1000001-0000-4000-8000-000000000007',
        direction: 'outbound',
        talkDurationSeconds: 145,
      })
    )
    // Nothing navigates: a link here would 404 on the telephony path.
    expect(screen.queryByRole('link', { name: 'Recording' })).toBeNull()
  })

  it('offers nothing to play for a call with no recording', async () => {
    const onPlay = vi.fn()
    getSpy.mockResolvedValue(
      response({
        entries: [
          callEntry({
            detail: {
              call_id: 'a1000001-0000-4000-8000-000000000003',
              direction: 'outbound',
              talk_duration: 0,
              recording_path: null,
            },
          }),
        ],
        total: 1,
      })
    )
    renderTab(onPlay)
    await screen.findByText('Outbound call — promise_to_pay — 145s')
    // A dead control is worse than none: it promises audio that was never kept.
    expect(screen.queryByRole('button', { name: 'Recording' })).toBeNull()
  })

  it('says how much history sits behind the filters', async () => {
    // Without it the operator has to page to the end to learn how much there
    // is, which is the question the bar should answer before they start.
    getSpy.mockResolvedValue(response({ entries: [entry()], total: 639 }))
    renderTab()
    expect(await screen.findByText('639 entries')).toBeVisible()
  })

  it('keeps Reset in place instead of making the row jump', async () => {
    // Rendering it only once a filter was active shifted every other control
    // sideways the moment someone picked a date.
    getSpy.mockResolvedValue(response({ entries: [entry()], total: 1 }))
    renderTab()
    const reset = await screen.findByRole('button', { name: 'Reset' })
    expect(reset).toBeVisible()
    expect(reset).toBeDisabled()
  })

  it('offers the rest of the history rather than ending at the first page', async () => {
    // The feed used to stop at its page size and say nothing about the rest,
    // so a client with 500 entries looked like a client with 200.
    getSpy.mockResolvedValue(response({ entries: [entry()], total: 500, page: 1, page_size: 50 }))
    renderTab()

    // 500 / 50 = 10 pages, so a page 10 must be reachable.
    expect(await screen.findByRole('button', { name: 'Go to page 10' })).toBeVisible()
  })

  it('hides the control when everything already fits on one page', async () => {
    getSpy.mockResolvedValue(response({ entries: [entry()], total: 1 }))
    renderTab()
    await screen.findByText('Opened the client card')
    expect(screen.queryByRole('button', { name: 'Go to page 1' })).toBeNull()
  })

  it('asks the server for the page the operator picked', async () => {
    getSpy.mockResolvedValue(response({ entries: [entry()], total: 500, page: 1, page_size: 50 }))
    renderTab()

    await userEvent.click(await screen.findByRole('button', { name: 'Go to page 2' }))

    // Paging is server-side: three sources with independent clocks cannot be
    // sliced in the browser, so the page number has to reach the endpoint.
    await waitFor(() =>
      expect(getSpy).toHaveBeenCalledWith(2, expect.objectContaining({ page: 2 }))
    )
  })

  it('keeps paginating when a later page reports no total', async () => {
    // Counting audit's match set is the expensive half of the request, so only
    // page one asks for it. If the tab did not keep that answer, moving to
    // page two would compute zero pages and the control would vanish under the
    // operator mid-browse.
    getSpy.mockResolvedValueOnce(
      response({ entries: [entry()], total: 500, page: 1, page_size: 50 })
    )
    renderTab()
    await screen.findByRole('button', { name: 'Go to page 10' })

    getSpy.mockResolvedValue(response({ entries: [entry()], total: null, page: 2, page_size: 50 }))
    await userEvent.click(screen.getByRole('button', { name: 'Go to page 2' }))

    await waitFor(() =>
      expect(getSpy).toHaveBeenCalledWith(2, expect.objectContaining({ page: 2 }))
    )
    // Still ten pages, and still saying how much history there is.
    expect(await screen.findByRole('button', { name: 'Go to page 10' })).toBeVisible()
    expect(screen.getByText('500 entries')).toBeVisible()
  })

  it('returns to page one when a filter changes', async () => {
    // Narrowing the feed while on a deep page lands on a page the filtered
    // result no longer has, which renders as "no activity" and reads as a bug.
    getSpy.mockResolvedValue(response({ entries: [entry()], total: 500, page: 1, page_size: 50 }))
    renderTab()

    await userEvent.click(await screen.findByRole('button', { name: 'Go to page 3' }))
    await waitFor(() =>
      expect(getSpy).toHaveBeenCalledWith(2, expect.objectContaining({ page: 3 }))
    )

    getSpy.mockClear()
    // Two comboboxes are on screen once paging shows: the operator filter and
    // the page-size picker. Pick the one showing the operator placeholder.
    const operatorSelect = screen
      .getAllByRole('combobox')
      .find((el) => el.textContent?.includes('All operators'))
    expect(operatorSelect).toBeDefined()
    await userEvent.click(operatorSelect!)
    await userEvent.click(await screen.findByRole('option', { name: 'Seven Operator' }))

    await waitFor(() =>
      expect(getSpy).toHaveBeenCalledWith(2, expect.objectContaining({ page: 1 }))
    )
    expect(getSpy).not.toHaveBeenCalledWith(2, expect.objectContaining({ page: 3 }))
  })
})
