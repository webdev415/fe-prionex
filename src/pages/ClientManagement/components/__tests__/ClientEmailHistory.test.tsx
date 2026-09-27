/**
 * «Пошта» sub-tab — the states an operator reads and the rows of the list.
 *
 * The doors are stubbed at the API module; the hooks, the component and the
 * dictionaries are real. `react-i18next` is re-mocked with the REAL Ukrainian
 * dictionary: the global mock answers with the key itself, and «not connected»
 * versus «no letters yet» is a statement about two different SENTENCES the
 * operator reads, not about two keys.
 *
 * All addresses, subjects and bodies are synthetic (`@example.ca`).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import i18n from '@/lib/i18n'
import { formatDateTime } from '@/lib/localeFormat'
import { expectNotObscured, expectObscured } from '@/test/piiHelpers'
import ukCommon from '@/../public/locales/uk/common.json'
import ukErrors from '@/../public/locales/uk/errors.json'
import type {
  ClientEmailCapabilities,
  ClientEmailMessage,
  ClientEmailMessageList,
} from '@/features/clientEmail/api/types'
import { ClientEmailHistory } from '../ClientEmailHistory'

vi.mock('react-i18next', async () => {
  const uk = (await import('../../../../../public/locales/uk/common.json')).default as Record<
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
  const t = (key: string, options?: unknown): string => {
    const found = lookup(key)
    let template = typeof found === 'string' ? found : typeof options === 'string' ? options : key
    if (options && typeof options === 'object') {
      const vars = options as Record<string, unknown>
      template = template.replace(/\{\{(\w+)\}\}/g, (_match, name: string) =>
        name in vars ? String(vars[name]) : `{{${name}}}`
      )
    }
    return template
  }
  return {
    useTranslation: () => ({ t, i18n: { language: 'uk', changeLanguage: vi.fn() } }),
    Trans: ({ children }: { children: ReactNode }) => children,
    initReactI18next: { type: '3rdParty', init: vi.fn() },
  }
})

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const doors = vi.hoisted(() => ({
  getCapabilities: vi.fn(),
  listClientMessages: vi.fn(),
  getClientMessage: vi.fn(),
  sendClientMessage: vi.fn(),
}))

/** The doors are stubbed; how a failure is read (`clientEmailFailureText`) stays real. */
vi.mock('@/features/clientEmail/api/clientEmailApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/clientEmail/api/clientEmailApi')>()
  return { ...actual, clientEmailApi: doors, ...doors }
})

type Dictionary = Record<string, unknown>
const EMAIL = (ukCommon as { pages: { clients: { email: Record<string, string> } } }).pages.clients
  .email
const CODES = (ukErrors as { codes: Record<string, string> }).codes
const HTTP = (ukErrors as { http: Record<string, string> }).http

const CLIENT_ID = 42

function capabilities(overrides: Partial<ClientEmailCapabilities> = {}): ClientEmailCapabilities {
  return {
    enabled: true,
    project_mailbox: 'connected',
    can_read: true,
    can_send: true,
    ...overrides,
  }
}

function letter(overrides: Partial<ClientEmailMessage> & { id: string }): ClientEmailMessage {
  return {
    thread_id: `thread-${overrides.id}`,
    direction: 'incoming',
    channel: 'project',
    subject: `Subject ${overrides.id}`,
    counterparty: 'client.1741@example.ca',
    mailbox_email: 'support@example.ca',
    at: '2026-09-25T09:00:00Z',
    attachment_count: 0,
    link_source: 'thread_reply',
    ...overrides,
  }
}

function page(items: ClientEmailMessage[]): ClientEmailMessageList {
  return { items, total: items.length, limit: 100, offset: 0 }
}

function renderHistory() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const result = render(
    <QueryClientProvider client={client}>
      <ClientEmailHistory clientId={CLIENT_ID} />
    </QueryClientProvider>
  )
  return { ...result, client }
}

function httpError(status: number, data: Dictionary) {
  return Object.assign(new Error(`Request failed with status code ${status}`), {
    isAxiosError: true,
    response: { status, data },
  })
}

/** `lib/errors` reads `codes.*` and `http.*` through i18next — answer from the Ukrainian file. */
function speakUkrainianErrors() {
  vi.spyOn(i18n, 't').mockImplementation(((key: string, options?: Dictionary) => {
    if (options?.ns === 'errors') {
      const [section, name] = key.split('.')
      const table = section === 'codes' ? CODES : section === 'http' ? HTTP : undefined
      if (table && name in table) return table[name]
    }
    return (options?.defaultValue as string) ?? key
  }) as unknown as typeof i18n.t)
}

beforeEach(() => {
  vi.clearAllMocks()
  doors.getCapabilities.mockResolvedValue(capabilities())
  doors.listClientMessages.mockResolvedValue(page([]))
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ClientEmailHistory — states (AC-B-2 п. 3–6)', () => {
  it.each(['not_configured', 'error', 'disabled'] as const)(
    'project mailbox «%s» — «не підключено», not «листів немає», and no «Написати листа»',
    async (state) => {
      doors.getCapabilities.mockResolvedValue(capabilities({ project_mailbox: state }))
      renderHistory()

      expect(await screen.findByText(EMAIL.notConfigured)).toBeInTheDocument()
      expect(screen.queryByText(EMAIL.none)).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: EMAIL.write })).not.toBeInTheDocument()
      // Nothing to read without a mailbox — the list door is not asked at all.
      expect(doors.listClientMessages).not.toHaveBeenCalled()
    }
  )

  it('connected and empty — «листування ще немає», not «не підключено»', async () => {
    renderHistory()

    expect(await screen.findByText(EMAIL.none)).toBeInTheDocument()
    expect(screen.queryByText(EMAIL.notConfigured)).not.toBeInTheDocument()
    expect(doors.listClientMessages).toHaveBeenCalledWith(CLIENT_ID, { limit: 100, offset: 0 })
  })

  it('the two notices are different sentences', () => {
    expect(EMAIL.none).toBeTruthy()
    expect(EMAIL.notConfigured).toBeTruthy()
    expect(EMAIL.none).not.toBe(EMAIL.notConfigured)
  })

  it('a failed load shows its reason by code, not an empty list', async () => {
    speakUkrainianErrors()
    doors.listClientMessages.mockRejectedValue(
      httpError(503, {
        detail: 'Could not verify the client',
        code: 'EMAIL_CHECK_UNAVAILABLE',
        params: { check: 'client' },
      })
    )
    renderHistory()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(CODES.EMAIL_CHECK_UNAVAILABLE)
    expect(alert).not.toHaveTextContent('Could not verify the client')
    expect(screen.queryByText(EMAIL.none)).not.toBeInTheDocument()
  })

  it('a failed load WITHOUT a code shows the sentence of its status, not the server’s English', async () => {
    // The gateway's answer once the channel is switched off while the card still
    // holds an earlier «enabled: true».
    speakUkrainianErrors()
    doors.listClientMessages.mockRejectedValue(httpError(404, { detail: 'Not Found' }))
    renderHistory()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(HTTP.notFound)
    expect(alert).not.toHaveTextContent('Not Found')
    expect(screen.queryByText(EMAIL.none)).not.toBeInTheDocument()
  })

  it('the server says the token may not read — the list is not asked and nothing is claimed', async () => {
    // A fresh right in the role, an old token: `/me` already says yes, the door
    // would still answer 403.
    doors.getCapabilities.mockResolvedValue(capabilities({ can_read: false }))
    renderHistory()

    // Positive control: the answer about the channel has arrived and been drawn.
    expect(await screen.findByRole('button', { name: EMAIL.write })).toBeInTheDocument()
    expect(doors.listClientMessages).not.toHaveBeenCalled()
    expect(screen.queryByText(EMAIL.none)).not.toBeInTheDocument()
    expect(screen.queryByText(EMAIL.notConfigured)).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('ClientEmailHistory — rows (AC-B-2 п. 5, 7, 8)', () => {
  it('keeps the order of the server, without re-sorting', async () => {
    // Deliberately NOT chronological: any sort by time on the client reorders it.
    doors.listClientMessages.mockResolvedValue(
      page([
        letter({ id: 'm-2', subject: 'Second', at: '2026-09-20T10:00:00Z' }),
        letter({ id: 'm-1', subject: 'First', at: '2026-09-25T10:00:00Z' }),
        letter({ id: 'm-3', subject: 'Third', at: '2026-09-22T10:00:00Z' }),
      ])
    )
    const { container } = renderHistory()

    await screen.findByText('Second')
    const order = [...container.querySelectorAll('[data-email-row]')].map((row) =>
      row.getAttribute('data-email-row')
    )
    expect(order).toEqual(['m-2', 'm-1', 'm-3'])
  })

  it('names the direction: «від клієнта» for his letter, «клієнту» for ours', async () => {
    doors.listClientMessages.mockResolvedValue(
      page([
        letter({ id: 'in-1', direction: 'incoming', subject: 'Client wrote' }),
        letter({ id: 'out-1', direction: 'outbound', subject: 'We answered' }),
      ])
    )
    const { container } = renderHistory()

    await screen.findByText('Client wrote')
    const incoming = container.querySelector('[data-email-row="in-1"]') as HTMLElement
    const outbound = container.querySelector('[data-email-row="out-1"]') as HTMLElement
    expect(within(incoming).getByText(EMAIL.incoming)).toBeInTheDocument()
    expect(within(incoming).queryByText(EMAIL.outgoing)).not.toBeInTheDocument()
    expect(within(outbound).getByText(EMAIL.outgoing)).toBeInTheDocument()
    expect(within(outbound).queryByText(EMAIL.incoming)).not.toBeInTheDocument()
  })

  it('marks a system letter «системний» and only that one; counts attachments', async () => {
    doors.listClientMessages.mockResolvedValue(
      page([
        letter({
          id: 'sys-1',
          direction: 'outbound',
          channel: 'system',
          subject: 'Payment reminder',
          mailbox_email: null,
        }),
        letter({
          id: 'op-1',
          direction: 'outbound',
          subject: 'Operator letter',
          attachment_count: 2,
        }),
      ])
    )
    const { container } = renderHistory()

    await screen.findByText('Payment reminder')
    const system = container.querySelector('[data-email-row="sys-1"]') as HTMLElement
    const operator = container.querySelector('[data-email-row="op-1"]') as HTMLElement
    expect(within(system).getByText(EMAIL.system)).toBeInTheDocument()
    expect(within(operator).queryByText(EMAIL.system)).not.toBeInTheDocument()
    expect(within(operator).getByText('Вкладень: 2')).toBeInTheDocument()
    expect(within(system).queryByText(/Вкладень/)).not.toBeInTheDocument()
  })

  it('obscures the correspondent and the subject for the session recording, not the time', async () => {
    const at = '2026-09-26T08:30:00Z'
    const row = letter({
      id: 'pii-1',
      subject: 'About my loan',
      counterparty: 'client.1741@example.ca',
      at,
    })
    doors.listClientMessages.mockResolvedValue(page([row]))
    renderHistory()

    expectObscured(await screen.findByText('client.1741@example.ca'))
    expectObscured(screen.getByText('About my loan'))
    expectNotObscured(screen.getByText(formatDateTime(at, 'uk')))
    expectNotObscured(screen.getByText(EMAIL.incoming))
  })

  it('a row without a timestamp shows «—», not a date made up from null', async () => {
    doors.listClientMessages.mockResolvedValue(
      page([letter({ id: 'no-at', subject: 'Undated letter', at: null })])
    )
    const { container } = renderHistory()

    await screen.findByText('Undated letter')
    const row = container.querySelector('[data-email-row="no-at"]') as HTMLElement
    expect(within(row).getByText('—')).toBeInTheDocument()
    // `new Date(null)` is 1 January 1970 — a real, wrong date.
    expect(row).not.toHaveTextContent('1970')
  })

  it('offers «Написати листа» when the server says the caller may send', async () => {
    renderHistory()

    expect(await screen.findByRole('button', { name: EMAIL.write })).toBeInTheDocument()
  })

  it('hides «Написати листа» when the server says the caller may not send', async () => {
    doors.getCapabilities.mockResolvedValue(capabilities({ can_send: false }))
    renderHistory()

    await screen.findByText(EMAIL.none)
    expect(screen.queryByRole('button', { name: EMAIL.write })).not.toBeInTheDocument()
  })
})

describe('ClientEmailHistory — reading and answering a letter from the list', () => {
  it('opens the letter, and «Відповісти» sends into its thread', async () => {
    const user = userEvent.setup()
    const row = letter({ id: 'in-7', subject: 'Question about payment' })
    doors.listClientMessages.mockResolvedValue(page([row]))
    doors.getClientMessage.mockResolvedValue({
      ...row,
      body_text: 'Synthetic question text',
      is_quarantined: false,
      attachments: [],
    })
    doors.sendClientMessage.mockResolvedValue({
      message_id: 'out-8',
      thread_id: row.thread_id,
      sent_at: '2026-09-27T10:00:00Z',
    })
    renderHistory()

    await user.click(await screen.findByText('Question about payment'))
    expect(await screen.findByText('Synthetic question text')).toBeInTheDocument()
    expect(doors.getClientMessage).toHaveBeenCalledWith(CLIENT_ID, 'in-7')

    await user.click(screen.getByRole('button', { name: EMAIL.reply }))
    const subject = await screen.findByLabelText(EMAIL.subject)
    expect(subject).toHaveValue('Re: Question about payment')
    await user.type(screen.getByLabelText(EMAIL.body), 'Synthetic answer')
    await user.click(screen.getByRole('button', { name: EMAIL.send }))

    await waitFor(() =>
      expect(doors.sendClientMessage).toHaveBeenCalledWith(CLIENT_ID, {
        subject: 'Re: Question about payment',
        body_text: 'Synthetic answer',
        in_reply_to_message_id: 'in-7',
      })
    )
  })

  it('a letter that is gone answers in the operator’s words, not the door’s English', async () => {
    const user = userEvent.setup()
    speakUkrainianErrors()
    doors.listClientMessages.mockResolvedValue(
      page([letter({ id: 'gone-1', subject: 'Old letter' })])
    )
    doors.getClientMessage.mockRejectedValue(httpError(404, { detail: 'Message not found' }))
    renderHistory()

    await user.click(await screen.findByText('Old letter'))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(HTTP.notFound)
    expect(alert).not.toHaveTextContent('Message not found')
  })
})
