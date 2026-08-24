/**
 * NotificationBell — visibility of every notification type (Tanya's
 * 13.08 complaint: types without a renderer inflated the badge, then
 * «Позначити як прочитані» erased every trace of them).
 *
 * Invariants under test:
 *  1. Previously-invisible types (e.g. one_on_one_scheduled) render in
 *     the «Навчання» tab; unknown future types render generically in
 *     «Інше» instead of disappearing silently.
 *  2. Badge = sum of unread counts of VISIBLE types only —
 *     ta_chain_created (11.5K unread system noise on prod) is excluded,
 *     so the badge always reconciles with the popup.
 *  3. The «Прочитані» tab lists read=true notifications (the backend
 *     keeps rows on mark-as-read; the list endpoint filters by read=).
 *  4. «Позначити як прочитані» does not lose notifications: after
 *     mark-all-read the item is still reachable in «Прочитані».
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'

import { NotificationBell } from '../NotificationBell'
import * as notificationApi from '@/features/notifications/api/notificationApi'
import type {
  NotificationItem,
  NotificationListResponse,
  UnreadCountResponse,
} from '@/features/notifications/types'

vi.mock('@/features/notifications/api/notificationApi')
vi.mock('@/features/notifications/hooks/useNotificationSocket', () => ({
  useNotificationSocket: () => ({ connected: false, reconnecting: false }),
}))

const mockGetNotifications = vi.mocked(notificationApi.getNotifications)
const mockGetUnreadCount = vi.mocked(notificationApi.getUnreadCount)
const mockMarkAllAsRead = vi.mocked(notificationApi.markAllAsRead)
const mockMarkAsRead = vi.mocked(notificationApi.markAsRead)

function makeItem(overrides: Partial<NotificationItem>): NotificationItem {
  return {
    id: 'n-1',
    type: 'task_overdue',
    title: 'Some notification',
    body: null,
    metadata: {},
    read: false,
    starred: false,
    created_at: new Date().toISOString(),
    read_at: null,
    ...overrides,
  } as NotificationItem
}

function listResponse(items: NotificationItem[]): NotificationListResponse {
  return { items, total: items.length, page: 1, page_size: 50 }
}

const oneOnOneItem = makeItem({
  id: 'n-1on1',
  type: 'one_on_one_scheduled',
  title: '1-on-1 scheduled',
  body: 'Your trainer scheduled a 1-on-1 for 2026-08-25 10:00 UTC (30 min)',
  metadata: { trainer_id: 7, scheduled_at: '2026-08-25T10:00:00+00:00', duration_minutes: 30 },
})

const unknownTypeItem = makeItem({
  id: 'n-future',
  type: 'brand_new_type' as NotificationItem['type'],
  title: 'Something brand new',
  body: 'A type this build has never heard of',
})

const taskItem = makeItem({
  id: 'n-task',
  type: 'task_overdue',
  title: 'Overdue task',
  metadata: { task_id: 42, due_date: '2026-08-20T10:00:00Z' },
})

// Stateful backend double: mark-all-read flips every item to read, so
// the read=true listing afterwards proves nothing was lost.
let allRead = false
let unread: UnreadCountResponse

function installApiMocks() {
  allRead = false
  unread = {
    total: 11576,
    by_type: {
      ta_chain_created: 11572,
      task_overdue: 2,
      one_on_one_scheduled: 1,
      brand_new_type: 1,
    },
  }

  mockGetUnreadCount.mockImplementation(async () => (allRead ? { total: 0, by_type: {} } : unread))

  mockGetNotifications.mockImplementation(async (params) => {
    const types = Array.isArray(params.type) ? params.type : params.type ? [params.type] : []
    const all = [taskItem, oneOnOneItem, unknownTypeItem].map((n) =>
      allRead ? { ...n, read: true, read_at: new Date().toISOString() } : n
    )
    if (params.read === true) {
      return listResponse(all.filter((n) => n.read))
    }
    if (types.length > 0) {
      return listResponse(all.filter((n) => types.includes(n.type)))
    }
    return listResponse(all)
  })

  mockMarkAllAsRead.mockImplementation(async () => {
    allRead = true
  })
  mockMarkAsRead.mockResolvedValue(undefined)
}

function renderBell() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
  return render(<NotificationBell />, { wrapper })
}

async function openBell(user: ReturnType<typeof userEvent.setup>) {
  const bellButton = await screen.findByLabelText(/notificationBell\.ariaLabel/)
  await user.click(bellButton)
}

beforeEach(() => {
  vi.clearAllMocks()
  installApiMocks()
  // jsdom has no scrollIntoView; the tab strip calls it on tab change.
  Element.prototype.scrollIntoView = vi.fn()
})

describe('NotificationBell — visibility of all types', () => {
  it('renders a previously-invisible type (one_on_one_scheduled) in the training tab', async () => {
    const user = userEvent.setup()
    renderBell()
    await openBell(user)

    await user.click(await screen.findByText('notificationBell.tabs.training'))

    expect(await screen.findByText('1-on-1 scheduled')).toBeInTheDocument()
    // 1-on-1 card surfaces "when" from metadata (formatted date, not raw ISO).
    expect(screen.getByText(/25-08-2026/)).toBeInTheDocument()
  })

  it('renders an unknown future type generically in the "other" tab', async () => {
    const user = userEvent.setup()
    renderBell()
    await openBell(user)

    await user.click(await screen.findByText('notificationBell.tabs.other'))

    expect(await screen.findByText('Something brand new')).toBeInTheDocument()
    // The dynamic type discovered from by_type must be part of the fetch.
    await waitFor(() => {
      const calledWithUnknown = mockGetNotifications.mock.calls.some(([params]) => {
        const types = Array.isArray(params.type) ? params.type : []
        return types.includes('brand_new_type')
      })
      expect(calledWithUnknown).toBe(true)
    })
  })

  it('badge counts only visible types — ta_chain_created noise is excluded', async () => {
    renderBell()
    // 2 (task_overdue) + 1 (one_on_one_scheduled) + 1 (brand_new_type) = 4;
    // 11 572 ta_chain_created unread must NOT leak into the badge.
    expect(await screen.findByText('4')).toBeInTheDocument()
    expect(screen.queryByText('99+')).not.toBeInTheDocument()
  })

  it('the read tab lists read=true notifications from the API', async () => {
    allRead = true // backend already has everything read
    const user = userEvent.setup()
    renderBell()
    await openBell(user)

    await user.click(await screen.findByText('notificationBell.tabs.read'))

    expect(await screen.findByText('Overdue task')).toBeInTheDocument()
    await waitFor(() => {
      const calledWithRead = mockGetNotifications.mock.calls.some(
        ([params]) => params.read === true
      )
      expect(calledWithRead).toBe(true)
    })
  })

  it('mark-all-read does not lose notifications — they remain in the read tab', async () => {
    const user = userEvent.setup()
    renderBell()
    await openBell(user)

    // The one_on_one item is visible before mark-all-read.
    await user.click(await screen.findByText('notificationBell.tabs.training'))
    expect(await screen.findByText('1-on-1 scheduled')).toBeInTheDocument()

    await user.click(screen.getByText('notificationBell.markAllRead'))
    await waitFor(() => expect(mockMarkAllAsRead).toHaveBeenCalledTimes(1))

    // The trace survives: the same notification is now in «Прочитані».
    await user.click(screen.getByText('notificationBell.tabs.read'))
    expect(await screen.findByText('1-on-1 scheduled')).toBeInTheDocument()
  })
})
