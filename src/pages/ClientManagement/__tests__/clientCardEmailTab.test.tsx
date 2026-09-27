/**
 * «Пошта» in the client card — scenes over the WHOLE card, not over a copy of
 * the gate next to it: the subject is a statement about the screen.
 *
 * What is real: the page, the «Пошта» hooks, `getCapabilities` with its `404`
 * rule, the shared axios client and its interceptors. What is stubbed: the
 * card's data sources (profile, loans, neighbouring sections) and the transport
 * — an adapter on the shared client answers the e-mail doors and records every
 * URL the card asked for, so «no request to the lawyers' doors» is measured on
 * what actually left, not on what a mock was told.
 *
 * All addresses, subjects and bodies are synthetic (`@example.ca`).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AxiosError, type AxiosAdapter, type AxiosResponse } from 'axios'
import type { ReactNode } from 'react'
/**
 * Static import on purpose (see `clientCardCreditBlock.test.tsx`): a cold load
 * of the page inside the first test's budget times out under CI load.
 */
import ClientDetailPage from '../ClientDetailPage'
import api from '@/lib/api'

/** Real Ukrainian dictionary: the scenes read the words an operator reads. */
vi.mock('react-i18next', async () => {
  const uk = (await import('../../../../public/locales/uk/common.json')).default as Record<
    string,
    unknown
  >
  const lookup = (key: string): unknown =>
    key
      .split('.')
      .reduce<unknown>(
        (node, part) =>
          node && typeof node === 'object' && part in node
            ? (node as Record<string, unknown>)[part]
            : undefined,
        uk
      )
  const t = (key: string, options?: unknown, interpolation?: Record<string, unknown>): string => {
    const vars = (interpolation ?? (typeof options === 'object' ? options : undefined)) as
      | Record<string, unknown>
      | undefined
    const found = lookup(key)
    let template = typeof found === 'string' ? found : typeof options === 'string' ? options : key
    if (vars) {
      template = template.replace(/\{\{(\w+)\}\}/g, (_match, name: string) =>
        name in vars ? String(vars[name]) : `{{${name}}}`
      )
    }
    return template
  }
  return {
    useTranslation: () => ({ t, i18n: { language: 'uk', changeLanguage: vi.fn() } }),
    Trans: ({ children }: { children: ReactNode }) => children,
    I18nextProvider: ({ children }: { children: ReactNode }) => children,
    initReactI18next: { type: '3rdParty', init: vi.fn() },
  }
})

vi.mock('@/features/credit/api/creditModuleFlag', () => ({
  CREDIT_MODULE_FLAG: 'VITE_CREDIT_MODULE_ENABLED',
  isCreditModuleEnabled: () => false,
}))

vi.mock('@/features/credit/api/creditApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/credit/api/creditApi')>()
  return {
    ...actual,
    creditApi: {
      ...actual.creditApi,
      clientLoans: vi.fn(async () => ({ items: [], next_cursor: null })),
    },
  }
})

vi.mock('@/features/ubki', () => ({
  useSubmitDebtToUbki: () => ({ mutate: vi.fn(), isPending: false }),
  useBulkSubmitToUbki: () => ({ mutate: vi.fn(), isPending: false }),
  useUbkiAvailable: () => true,
  ubkiKeys: { all: ['ubki'] },
}))

vi.mock('../components/UbkiSubmissionHistory', () => ({ UbkiSubmissionHistory: () => null }))
vi.mock('../components/taChains', () => ({
  TAInteractionHistory: () => null,
  ChainExecutor: () => null,
}))
vi.mock('../components/EditInteractionModal', () => ({ EditInteractionModal: () => null }))
vi.mock('../components/SendSMSModal', () => ({ SendSMSModal: () => null }))
vi.mock('../components/SendMessageModal', () => ({ SendMessageModal: () => null }))
vi.mock('../components/RecordPaymentModal', () => ({ RecordPaymentModal: () => null }))
vi.mock('../components/WriteoffCreateModal', () => ({ WriteoffCreateModal: () => null }))

/** Every right is granted except the ones a scene takes away. */
const denied = vi.hoisted(() => new Set<string>())

vi.mock('@/hooks/usePermissions', () => ({
  useHasPermission: vi.fn((permission: string) => !denied.has(permission)),
  useHasAnyPermission: vi.fn(() => true),
  useHasAllPermissions: vi.fn(() => true),
  useUserRole: vi.fn(() => 'admin'),
}))

const PROFILE = {
  id: 42,
  full_name: 'Клієнт Тестовий',
  first_name: 'Тестовий',
  last_name: 'Клієнт',
  middle_name: null,
  email: 'client.1741@example.ca',
  tax_id: '1234567890',
  identity_key: 'tin' as const,
  phone_primary: '+15550100',
  date_of_birth: null,
  age: null,
  priority_score: 10,
  priority_level: 'low',
  manual_priority: null,
  status: 'new',
  contacts: [],
  comments: [],
  addresses: [],
  passport: null,
  employment: null,
  tags: [],
}

vi.mock('@/features/clients/hooks/useClients', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/clients/hooks/useClients')>()
  const empty = { data: undefined, isLoading: false, isError: false, error: null, refetch: vi.fn() }
  const list = { data: [], isLoading: false, isError: false, error: null, refetch: vi.fn() }
  return {
    ...actual,
    useClient: () => empty,
    useClientProfile: () => ({ ...empty, data: PROFILE }),
    useClientLoans: () => list,
    useClientPaymentsSection: () => empty,
    useClientCallSmsHistory: () => empty,
    useClientRecentCalls: () => list,
    useClientTasks: () => list,
    useClientOperatorsSection: () => empty,
    useClientDocuments: () => list,
    useClientActivities: () => list,
    useUpdateContact: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useCreateContact: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useDeleteContact: () => ({ mutateAsync: vi.fn(), isPending: false }),
  }
})

const CLIENT_ID = 42
const CAPABILITIES_URL = '/api/v1/email/capabilities'
const MESSAGES_URL = `/api/v1/email/clients/${CLIENT_ID}/messages`
const LETTER_ID = 'a1b2c3d4-0000-4000-8000-000000001741'

/**
 * A letter that had only HTML, as the server hands it over: text it derived,
 * and — to prove the modal never renders markup — characters that WOULD become
 * a bold tag and an image on one of the lawyers' inline doors if they did.
 */
const MARKUP_AS_TEXT =
  'Hello <b>bold</b> <img src="/api/v1/legal/messages/m-1/inline/a-1"> end of letter'

const ROW = {
  id: LETTER_ID,
  thread_id: 'a1b2c3d4-0000-4000-8000-0000000017aa',
  direction: 'incoming',
  channel: 'project',
  subject: 'About my payment',
  counterparty: 'client.1741@example.ca',
  mailbox_email: 'support@example.ca',
  at: '2026-09-26T08:30:00Z',
  attachment_count: 0,
  link_source: 'thread_reply',
}

type Reply = { status: number; data: unknown }

const transport = vi.hoisted(() => ({
  requested: [] as string[],
  capabilities: { status: 200, data: null } as { status: number; data: unknown },
}))

function answer(url: string): Reply {
  if (url === CAPABILITIES_URL) return transport.capabilities
  if (url === MESSAGES_URL) {
    return { status: 200, data: { items: [ROW], total: 1, limit: 100, offset: 0 } }
  }
  if (url === `${MESSAGES_URL}/${LETTER_ID}`) {
    return {
      status: 200,
      data: {
        ...ROW,
        body_text: MARKUP_AS_TEXT,
        body_derived_from_html: true,
        is_quarantined: false,
        attachments: [],
      },
    }
  }
  return { status: 0, data: null }
}

const recordingAdapter: AxiosAdapter = async (config) => {
  const url = config.url ?? ''
  transport.requested.push(url)
  const reply = answer(url)
  if (reply.status === 0) {
    // Everything else the card asks for fails the way an offline machine does —
    // with a code the shared client does not retry, so nothing lingers.
    throw new AxiosError('Blocked in test', 'ERR_BLOCKED_IN_TEST', config)
  }
  const response: AxiosResponse = {
    data: reply.data,
    status: reply.status,
    statusText: String(reply.status),
    headers: {},
    config,
  }
  if (reply.status >= 400) {
    throw new AxiosError(
      `Request failed with status code ${reply.status}`,
      AxiosError.ERR_BAD_REQUEST,
      config,
      undefined,
      response
    )
  }
  return response
}

const originalAdapter = api.defaults.adapter

function enabledCapabilities(overrides: Record<string, unknown> = {}): Reply {
  return {
    status: 200,
    data: {
      enabled: true,
      project_mailbox: 'connected',
      can_read: true,
      can_send: true,
      ...overrides,
    },
  }
}

function renderCard() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  })
  const result = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/dashboard/clients/${CLIENT_ID}`]}>
        <Routes>
          <Route path="/dashboard/clients/:id" element={<ClientDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
  return { ...result, client }
}

async function openCallSmsTab(container: HTMLElement) {
  const user = userEvent.setup()
  const tab = container.querySelector('[data-tab="call-sms-history"]')
  expect(tab, 'the «Дзвінок / SMS» tab of the card').toBeTruthy()
  await user.click(tab as HTMLElement)
  // The sub-tab row sits next to the header of the section.
  const header = await screen.findByText('Останні дзвінки та SMS')
  return { user, header }
}

/** The row of the section header: header, sub-tabs, export. */
function subTabBar(header: HTMLElement): HTMLElement {
  const row = header.closest('div')?.parentElement
  if (!row) throw new Error('the section header is rendered outside its row')
  return row
}

function emailTabButton(container: HTMLElement): HTMLElement | null {
  return container.querySelector('[data-call-sms-tab="email"]')
}

/** The capabilities query of the card — found by prefix, whatever project the store holds. */
function capabilitiesQuery(client: QueryClient) {
  const [query] = client.getQueryCache().findAll({ queryKey: ['clientEmail', 'capabilities'] })
  return query
}

async function capabilitiesSettled(client: QueryClient) {
  await waitFor(() => expect(capabilitiesQuery(client)?.state.status).toBe('success'))
}

function emailRequests(): string[] {
  return transport.requested.filter((url) => url.startsWith('/api/v1/email'))
}

beforeEach(() => {
  vi.clearAllMocks()
  denied.clear()
  transport.requested = []
  transport.capabilities = enabledCapabilities()
  api.defaults.adapter = recordingAdapter
})

afterEach(() => {
  api.defaults.adapter = originalAdapter
  vi.restoreAllMocks()
})

describe('«Пошта» sub-tab of the client card (T-B4)', () => {
  it('is there when the server says the channel is on and the caller may read', async () => {
    const { container } = renderCard()
    const { header } = await openCallSmsTab(container)

    const button = await waitFor(() => {
      const found = emailTabButton(container)
      expect(found).toBeTruthy()
      return found as HTMLElement
    })
    expect(button).toHaveTextContent('Пошта')
    expect(within(subTabBar(header)).getByText('Пошта')).toBe(button)
    expect(emailRequests()).toContain(CAPABILITIES_URL)
  })

  it('asks the server nothing about e-mail until «Дзвінок / SMS» is opened', async () => {
    const { container } = renderCard()
    // The card is drawn: its tab strip is there.
    await waitFor(() =>
      expect(container.querySelector('[data-tab="call-sms-history"]')).toBeTruthy()
    )
    // A request the card makes on open anyway would already be recorded by now.
    await waitFor(() => expect(transport.requested.length).toBeGreaterThan(0))
    expect(emailRequests()).toEqual([])

    await openCallSmsTab(container)

    await waitFor(() => expect(emailRequests()).toContain(CAPABILITIES_URL))
  })

  it('is not there without «email.client.read» — and the card does not even ask', async () => {
    denied.add('email.client.read')
    const { container } = renderCard()
    const { header } = await openCallSmsTab(container)

    // Positive control of the row: the neighbours are drawn, only «Пошта» is not.
    expect(within(subTabBar(header)).getByText('Дзвінки')).toBeInTheDocument()
    expect(emailTabButton(container)).toBeNull()
    expect(emailRequests()).toEqual([])
  })

  it('is not there when the server answers «enabled: false»', async () => {
    transport.capabilities = {
      status: 200,
      data: { enabled: false, project_mailbox: null, can_read: false, can_send: false },
    }
    const { container, client } = renderCard()
    await openCallSmsTab(container)

    await capabilitiesSettled(client)
    expect(emailTabButton(container)).toBeNull()
  })

  it('is not there when an older api answers 404 — no channel, not an error', async () => {
    transport.capabilities = { status: 404, data: { detail: 'Not Found' } }
    const { container, client } = renderCard()
    await openCallSmsTab(container)

    await capabilitiesSettled(client)
    expect(emailTabButton(container)).toBeNull()
    expect(capabilitiesQuery(client)?.state.data).toMatchObject({ enabled: false })
  })

  it('leaves the other sub-tabs where they were', async () => {
    const { container } = renderCard()
    const { header } = await openCallSmsTab(container)
    await waitFor(() => expect(emailTabButton(container)).toBeTruthy())

    const bar = within(subTabBar(header))
    for (const label of ['Всі', 'Дзвінки', 'SMS', 'Повідомлення', 'Пошта']) {
      expect(bar.getByText(label), label).toBeInTheDocument()
    }
  })

  it('titles the section «Останні листи» on «Пошта», not «Останні дзвінки та SMS»', async () => {
    const { container } = renderCard()
    const { user } = await openCallSmsTab(container)
    const button = await waitFor(() => {
      const found = emailTabButton(container)
      expect(found).toBeTruthy()
      return found as HTMLElement
    })

    await user.click(button)

    expect(await screen.findByText('Останні листи')).toBeInTheDocument()
    expect(screen.queryByText('Останні дзвінки та SMS')).not.toBeInTheDocument()
  })

  it('reads a letter as text: no markup rendered, nothing asked of the lawyers’ doors', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { container } = renderCard()
    const { user } = await openCallSmsTab(container)
    const button = await waitFor(() => {
      const found = emailTabButton(container)
      expect(found).toBeTruthy()
      return found as HTMLElement
    })
    await user.click(button)
    await user.click(await screen.findByText('About my payment'))

    const body = await screen.findByTestId('client-email-body')
    expect(body.textContent).toBe(MARKUP_AS_TEXT)
    // Text, not markup: the characters are there, the elements are not.
    expect(body.children).toHaveLength(0)
    expect(body.querySelector('b, img')).toBeNull()
    expect(document.querySelector('img[src*="/api/v1/legal"]')).toBeNull()
    expect(screen.getByText(/HTML-версії листа/)).toBeInTheDocument()

    expect(transport.requested).toContain(`${MESSAGES_URL}/${LETTER_ID}`)
    expect(transport.requested.filter((url) => url.includes('/api/v1/legal'))).toEqual([])
    const fetched = fetchSpy.mock.calls.map(([input]) => String(input))
    expect(fetched.filter((url) => url.includes('/api/v1/legal'))).toEqual([])
  })
})
