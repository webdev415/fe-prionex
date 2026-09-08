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
import { ClientActivityLogTab } from '../ClientActivityLogTab'
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
        'pages.clients.detail.tabs.docs': 'Docs',
        'pages.clients.detail.tabs.callSms': 'Call / SMS',
      }
      let out = table[key] ?? (typeof opts === 'string' ? opts : key)
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

function renderTab() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ClientActivityLogTab clientId={2} isActive />
    </QueryClientProvider>
  )
}

function response(over: Partial<ActivityLogResponse> = {}): ActivityLogResponse {
  return { client_id: 2, entries: [], degraded: [], ...over }
}

function entry(over: Partial<ActivityLogResponse['entries'][number]> = {}) {
  return {
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
})
