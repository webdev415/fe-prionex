/**
 * NotificationBell — visibility of every notification type (Tanya's
 * 13.08 complaint: types without a renderer inflated the badge, then
 * «Позначити як прочитані» erased every trace of them).
 *
 * Invariants under test:
 *  1. Previously-invisible types (e.g. one_on_one_scheduled and the
 *     30-min one_on_one_reminder) render in the «Навчання» tab; unknown
 *     future types render generically in «Інше» instead of disappearing
 *     silently.
 *  2. Badge = sum of unread counts of VISIBLE types only —
 *     ta_chain_created (11.5K unread system noise on prod) is excluded,
 *     so the badge always reconciles with the popup.
 *  3. The «Прочитані» tab lists read=true notifications (the backend
 *     keeps rows on mark-as-read; the list endpoint filters by read=).
 *  4. «Позначити як прочитані» does not lose notifications: after
 *     mark-all-read the item is still reachable in «Прочитані» — even
 *     an unknown type that no longer appears in unread by_type.
 *  5. The read-history fetch is TYPE-SCOPED. The mock reproduces the
 *     real backend contract (created_at DESC + server-side pagination)
 *     and seeds 120 ta_chain_created rows newer than everything else:
 *     an unscoped read=true fetch would get a first page of pure noise,
 *     the client-side HIDDEN_TYPES filter would blank the tab, and the
 *     trail would be lost again right after mark-all-read.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'

import { NotificationBell } from '../NotificationBell'
import * as notificationApi from '@/features/notifications/api/notificationApi'
import type { NotificationItem, UnreadCountResponse } from '@/features/notifications/types'
import { useAuthStore } from '@/stores/authStore'
import type { User } from '@/types/api'

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

// Real items are one hour OLDER than the noise below — with created_at
// DESC ordering they only survive the first page if the fetch filters
// out the noise server-side (via the repeatable `type` param).
const HOUR_AGO = new Date(Date.now() - 3_600_000).toISOString()

const oneOnOneItem = makeItem({
  id: 'n-1on1',
  type: 'one_on_one_scheduled',
  title: '1-on-1 scheduled',
  body: 'Your trainer scheduled a 1-on-1 for 2026-08-25 10:00 UTC (30 min)',
  metadata: { trainer_id: 7, scheduled_at: '2026-08-25T10:00:00+00:00', duration_minutes: 30 },
  created_at: HOUR_AGO,
})

// Shape as published by quality-service ``expire_one_on_ones``: title
// only, body=None, metadata carries ids but no name/scheduled_at — the
// training card must still render it (title + "1-на-1 скоро" label).
const reminderItem = makeItem({
  id: 'n-1on1-reminder',
  type: 'one_on_one_reminder',
  title: 'Upcoming 1-on-1 in 30 minutes',
  metadata: { trainer_id: 7, operator_id: 12 },
  created_at: HOUR_AGO,
})

// Group training (KAN-752), shaped like quality-service's
// ``training_event_data``: the topic is metadata.title (n.title is the
// generic headline the consumer renders), and meeting_url is optional.
const groupTrainingItem = makeItem({
  id: 'n-group-training',
  type: 'training_scheduled',
  title: 'Вас призначено на груповий тренінг',
  body: '«Робота із запереченнями» — 26.08.2026 17:00\nПосилання на зустріч: https://meet.example.com/abc',
  metadata: {
    group_training_id: 5,
    trainer_id: 7,
    title: 'Робота із запереченнями',
    scheduled_at: '2026-08-26T14:00:00+00:00',
    duration_minutes: 90,
    meeting_url: 'https://meet.example.com/abc',
    location: null,
    participant_ids: [12],
  },
  created_at: HOUR_AGO,
})

// Trainer-facing post-session nudge. No dedicated card — the backend
// ships a ready-to-read title/body, so it belongs in «Інше».
// Deliberately ALREADY READ, so it is absent from the unread by_type
// aggregate below: the dynamic unknown-type fallback only discovers
// types that are currently unread, so this item is reachable only if
// the type is in KNOWN_MISC_TYPES. Were it unread, the fallback alone
// would render it and the test would pass without the frontend knowing
// the type at all.
const feedbackDueItem = makeItem({
  id: 'n-feedback-due',
  type: 'one_on_one_feedback_due',
  title: "Залиште зворотний зв'язок за зустріччю 1-на-1",
  body: 'Зустріч 1-на-1 з оператором Іван Петров завершилась',
  metadata: { one_on_one_id: 3, trainer_id: 7, operator_id: 12 },
  read: true,
  read_at: HOUR_AGO,
  created_at: HOUR_AGO,
})

const unknownTypeItem = makeItem({
  id: 'n-future',
  type: 'brand_new_type' as NotificationItem['type'],
  title: 'Something brand new',
  body: 'A type this build has never heard of',
  created_at: HOUR_AGO,
})

const taskItem = makeItem({
  id: 'n-task',
  type: 'task_overdue',
  title: 'Overdue task',
  metadata: { task_id: 42, due_date: '2026-08-20T10:00:00Z' },
  created_at: HOUR_AGO,
})

// 120 ta_chain_created rows, all newer than the real items — enough to
// fill the read tab's entire page (page_size=100) whenever a fetch is
// not type-scoped (prod scale: 11 572 rows for a single trainer).
const noiseItems: NotificationItem[] = Array.from({ length: 120 }, (_, i) =>
  makeItem({
    id: `n-noise-${i}`,
    type: 'ta_chain_created',
    title: `TA chain ${i}`,
    created_at: new Date(Date.now() - i * 1000).toISOString(),
  })
)

// Stateful backend double: mark-all-read flips every item to read, so
// the read=true listing afterwards proves nothing was lost.
let allRead = false
let unread: UnreadCountResponse

function installApiMocks(extraItems: NotificationItem[] = []) {
  allRead = false
  unread = {
    total: 11578,
    by_type: {
      ta_chain_created: 11572,
      task_overdue: 2,
      one_on_one_scheduled: 1,
      one_on_one_reminder: 1,
      training_scheduled: 1,
      brand_new_type: 1,
    },
  }

  mockGetUnreadCount.mockImplementation(async () => (allRead ? { total: 0, by_type: {} } : unread))

  mockGetNotifications.mockImplementation(async (params) => {
    const types = Array.isArray(params.type) ? params.type : params.type ? [params.type] : []
    let all = [
      taskItem,
      oneOnOneItem,
      reminderItem,
      groupTrainingItem,
      feedbackDueItem,
      unknownTypeItem,
      ...extraItems,
      ...noiseItems,
    ].map((n) => (allRead ? { ...n, read: true, read_at: new Date().toISOString() } : n))
    if (params.read !== undefined) {
      all = all.filter((n) => n.read === params.read)
    }
    if (types.length > 0) {
      all = all.filter((n) => types.includes(n.type))
    }
    // Real backend contract the client must survive: created_at DESC
    // ordering + server-side pagination. Without them the stateful mock
    // could not catch an unscoped fetch drowning in ta_chain_created.
    all = [...all].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    const page = params.page ?? 1
    const pageSize = params.page_size ?? 50
    const start = (page - 1) * pageSize
    return {
      items: all.slice(start, start + pageSize),
      total: all.length,
      page,
      page_size: pageSize,
    }
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

    // The 30-min reminder is a training event too: same tab, training
    // card with its own type label — not a generic row buried in «Інше».
    expect(await screen.findByText('Upcoming 1-on-1 in 30 minutes')).toBeInTheDocument()
    expect(
      screen.getByText('notificationBell.trainingTypes.one_on_one_reminder')
    ).toBeInTheDocument()
    const trainingCall = mockGetNotifications.mock.calls.find(([params]) => {
      const types = Array.isArray(params.type) ? params.type : []
      return types.includes('one_on_one_scheduled')
    })
    expect(trainingCall).toBeDefined()
    expect(trainingCall![0].type).toContain('one_on_one_reminder')
  })

  it('renders a group training in the training tab with topic, time and meeting link', async () => {
    const user = userEvent.setup()
    renderBell()
    await openBell(user)

    await user.click(await screen.findByText('notificationBell.tabs.training'))

    expect(await screen.findByText('Вас призначено на груповий тренінг')).toBeInTheDocument()
    // The topic rides in metadata.title — n.title is only the headline.
    expect(screen.getByText('«Робота із запереченнями»')).toBeInTheDocument()
    // Time comes from metadata too, formatted rather than raw ISO.
    expect(screen.getByText(/26-08-2026/)).toBeInTheDocument()
    expect(
      screen.getByText('notificationBell.trainingTypes.training_scheduled')
    ).toBeInTheDocument()
    // A real anchor, not text inside the card button: the operator can
    // open the meeting without the click being eaten by mark-as-read.
    expect(
      screen.getByRole('link', { name: 'notificationBell.training.joinMeeting' })
    ).toHaveAttribute('href', 'https://meet.example.com/abc')

    // Both group-training types must be part of the tab's scoped fetch.
    const trainingCall = mockGetNotifications.mock.calls.find(([params]) => {
      const types = Array.isArray(params.type) ? params.type : []
      return types.includes('training_scheduled')
    })
    expect(trainingCall).toBeDefined()
    expect(trainingCall![0].type).toContain('training_reminder')
  })

  it('drops a non-http meeting_url instead of rendering it as a link', async () => {
    // meeting_url is free text typed by a trainer, so a `javascript:` href
    // would execute on click. The card must still render everything else.
    // Reuse the real fixture pipeline (ordering, pagination, type scoping)
    // and rewrite only the one field under test.
    const base = mockGetNotifications.getMockImplementation()!
    mockGetNotifications.mockImplementation(async (params) => {
      const page = await base(params)
      return {
        ...page,
        items: page.items.map((n) =>
          n.type === 'training_scheduled'
            ? { ...n, metadata: { ...n.metadata, meeting_url: 'javascript:alert(1)' } }
            : n
        ),
      }
    })

    const user = userEvent.setup()
    renderBell()
    await openBell(user)
    await user.click(await screen.findByText('notificationBell.tabs.training'))

    expect(await screen.findByText('«Робота із запереченнями»')).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'notificationBell.training.joinMeeting' })
    ).not.toBeInTheDocument()
  })

  it('renders one_on_one_feedback_due in the "other" tab', async () => {
    const user = userEvent.setup()
    renderBell()
    await openBell(user)

    await user.click(await screen.findByText('notificationBell.tabs.other'))

    // Already read, so it is not in the unread by_type aggregate: the
    // type reaches the fetch from KNOWN_MISC_TYPES, not from the dynamic
    // unknown-type fallback.
    expect(
      await screen.findByText("Залиште зворотний зв'язок за зустріччю 1-на-1")
    ).toBeInTheDocument()
    await waitFor(() => {
      const calledWithFeedbackDue = mockGetNotifications.mock.calls.some(([params]) => {
        const types = Array.isArray(params.type) ? params.type : []
        return types.includes('one_on_one_feedback_due')
      })
      expect(calledWithFeedbackDue).toBe(true)
    })
  })

  it('the read tab fetch is scoped to include the new training types', async () => {
    allRead = true
    const user = userEvent.setup()
    renderBell()
    await openBell(user)

    await user.click(await screen.findByText('notificationBell.tabs.read'))

    await waitFor(() => {
      const readCall = mockGetNotifications.mock.calls.find(([params]) => params.read === true)
      expect(readCall).toBeDefined()
      const types = Array.isArray(readCall![0].type) ? readCall![0].type : []
      expect(types).toContain('training_scheduled')
      expect(types).toContain('training_reminder')
      expect(types).toContain('one_on_one_feedback_due')
    })
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
    // 2 (task_overdue) + 1 (one_on_one_scheduled) + 1 (one_on_one_reminder)
    // + 1 (training_scheduled) + 1 (brand_new_type) = 6; 11 572
    // ta_chain_created unread must NOT leak into the badge.
    expect(await screen.findByText('6')).toBeInTheDocument()
    expect(screen.queryByText('99+')).not.toBeInTheDocument()
  })

  it('the read tab lists read=true notifications, type-scoped so hidden noise cannot fill the page', async () => {
    allRead = true // backend already has everything read — incl. 120 ta_chain rows
    const user = userEvent.setup()
    renderBell()
    await openBell(user)

    await user.click(await screen.findByText('notificationBell.tabs.read'))

    // The real item survives even though 120 newer ta_chain_created rows
    // would otherwise occupy the whole created_at-DESC first page.
    expect(await screen.findByText('Overdue task')).toBeInTheDocument()
    expect(screen.queryByText(/TA chain/)).not.toBeInTheDocument()
    await waitFor(() => {
      const readCall = mockGetNotifications.mock.calls.find(([params]) => params.read === true)
      expect(readCall).toBeDefined()
      const types = Array.isArray(readCall![0].type) ? readCall![0].type : []
      expect(types.length).toBeGreaterThan(0)
      expect(types).toContain('task_overdue')
      expect(types).not.toContain('ta_chain_created')
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

    // The trace survives: the same notification is now in «Прочитані» —
    // Tanya's exact scenario: 120 freshly-read ta_chain rows are newer
    // and would fill the whole page were the read fetch not type-scoped.
    await user.click(screen.getByText('notificationBell.tabs.read'))
    expect(await screen.findByText('1-on-1 scheduled')).toBeInTheDocument()

    // The unknown type ALSO survives: it is gone from unread by_type
    // after mark-all-read, but the session cache of ever-seen unknown
    // types keeps it in the read fetch's type list.
    expect(await screen.findByText('Something brand new')).toBeInTheDocument()
    expect(screen.queryByText(/TA chain/)).not.toBeInTheDocument()
  })
})

// UBKI is a Ukrainian-only integration (story 17-56, Р-5). In any other
// project the UBKI tab is hidden while it is empty; an alert that did arrive
// keeps the tab, since hiding a non-empty tab would lose the alert. A hidden
// tab never stays selected: the header is not remounted on a project switch,
// so a UBKI tab opened in a Ukrainian project falls back to the tasks panel.
// A shown tab does not vanish under the operator while the panel is open; the
// choice is taken again when the panel is reopened or the project changes.
const ubkiConnectionDownItem = makeItem({
  id: 'n-ubki-down',
  type: 'ubki_connection_down',
  title: 'UBKI connection lost',
  created_at: HOUR_AGO,
})

function userInProject(country: string): User {
  return {
    id: '1',
    projects: [{ id: '3', name: 'Project', country, roles: [] }],
    active_project_id: '3',
  } as unknown as User
}

describe('UBKI tab only in a Ukrainian project', () => {
  afterEach(() => {
    useAuthStore.setState({ user: null })
  })

  it('N-1: hides the empty UBKI tab in a Canadian project', async () => {
    useAuthStore.setState({ user: userInProject('CA') })
    const user = userEvent.setup()
    renderBell()
    await openBell(user)

    expect(await screen.findByText('notificationBell.tabs.tasks')).toBeInTheDocument()
    expect(await screen.findByText('Overdue task')).toBeInTheDocument()
    expect(screen.queryByText('notificationBell.tabs.ubki')).not.toBeInTheDocument()
    // Only UBKI goes: every other tab, including the ones after it, stays.
    for (const tab of [
      'notificationBell.tabs.starred',
      'notificationBell.tabs.training',
      'notificationBell.tabs.payments',
      'notificationBell.tabs.calls',
      'notificationBell.tabs.rrPayments',
      'notificationBell.tabs.other',
      'notificationBell.tabs.read',
    ]) {
      expect(screen.getByText(tab)).toBeInTheDocument()
    }
  })

  it('N-2: keeps the UBKI tab in a Canadian project once a UBKI alert arrived', async () => {
    installApiMocks([ubkiConnectionDownItem])
    useAuthStore.setState({ user: userInProject('CA') })
    const user = userEvent.setup()
    renderBell()
    await openBell(user)

    expect(await screen.findByText('notificationBell.tabs.ubki')).toBeInTheDocument()
  })

  it('N-3: keeps the UBKI tab in a Ukrainian project with no UBKI alerts', async () => {
    useAuthStore.setState({ user: userInProject('UA') })
    const user = userEvent.setup()
    renderBell()
    await openBell(user)

    expect(await screen.findByText('notificationBell.tabs.ubki')).toBeInTheDocument()
  })

  it('N-4: a UBKI tab opened in a Ukrainian project falls back to tasks after a switch to a Canadian one', async () => {
    useAuthStore.setState({ user: userInProject('UA') })
    const user = userEvent.setup()
    renderBell()
    await openBell(user)

    await user.click(await screen.findByText('notificationBell.tabs.ubki'))
    expect(await screen.findByText('notificationBell.empty.ubki')).toBeInTheDocument()
    expect(screen.getByText('notificationBell.tabs.tasks')).not.toHaveClass('border-primary-500')

    act(() => useAuthStore.setState({ user: userInProject('CA') }))

    expect(screen.queryByText('notificationBell.tabs.ubki')).not.toBeInTheDocument()
    expect(screen.queryByText('notificationBell.empty.ubki')).not.toBeInTheDocument()
    // Panels follow the shown tab, not the raw choice: the tasks panel with its
    // card and actions, not a blank one.
    expect(await screen.findByText('Overdue task')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'notificationBell.taskActions.completeAria' })
    ).toBeInTheDocument()
    // The strip highlights the tab the panel shows, not the hidden UBKI one.
    expect(screen.getByText('notificationBell.tabs.tasks')).toHaveClass('border-primary-500')
  })

  it('N-5: opens a UBKI alert that arrived in a Canadian project', async () => {
    installApiMocks([ubkiConnectionDownItem])
    useAuthStore.setState({ user: userInProject('CA') })
    const user = userEvent.setup()
    renderBell()
    await openBell(user)

    await user.click(await screen.findByText('notificationBell.tabs.ubki'))

    expect(await screen.findByText('UBKI connection lost')).toBeInTheDocument()
  })

  it('N-6: a shown UBKI tab stays while the panel is open, even when a refetch drops the last alert', async () => {
    installApiMocks([ubkiConnectionDownItem])
    useAuthStore.setState({ user: userInProject('CA') })
    const user = userEvent.setup()
    renderBell()
    await openBell(user)
    await user.click(await screen.findByText('notificationBell.tabs.ubki'))
    expect(await screen.findByText('UBKI connection lost')).toBeInTheDocument()

    // The operator dismisses the last UBKI alert; the refetch comes back without it.
    installApiMocks()
    await user.click(screen.getByRole('button', { name: 'notificationBell.dismissAria' }))
    await waitFor(() => expect(screen.queryByText('UBKI connection lost')).not.toBeInTheDocument())

    expect(screen.getByText('notificationBell.tabs.ubki')).toBeInTheDocument()
    expect(screen.getByText('notificationBell.empty.ubki')).toBeInTheDocument()

    // Closing and reopening the panel takes the choice again: the tab is gone.
    await user.click(screen.getByLabelText(/notificationBell\.ariaLabel/))
    await openBell(user)

    expect(await screen.findByText('Overdue task')).toBeInTheDocument()
    expect(screen.queryByText('notificationBell.tabs.ubki')).not.toBeInTheDocument()
  })
})
