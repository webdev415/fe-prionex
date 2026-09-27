/**
 * «Написати листа» / «Відповісти» — what the modal sends, how it holds a second
 * click, and what the operator reads when the server refuses.
 *
 * The send door is stubbed at the API module; the mutation hook, the modal and
 * the dictionaries are real (Ukrainian `common`, Ukrainian `errors` through the
 * i18next instance `translateErrorCode` reads).
 *
 * All addresses, subjects and bodies are synthetic.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { toast } from 'sonner'
import i18n from '@/lib/i18n'
import ukCommon from '@/../public/locales/uk/common.json'
import enErrors from '@/../public/locales/en/errors.json'
import esErrors from '@/../public/locales/es/errors.json'
import ukErrors from '@/../public/locales/uk/errors.json'
import { SendClientEmailModal, type ClientEmailReplyTarget } from '../SendClientEmailModal'

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
type Codes = { codes: Record<string, string> }

const EMAIL = (ukCommon as { pages: { clients: { email: Record<string, string> } } }).pages.clients
  .email
const UK_CODES = (ukErrors as Codes).codes
const UK_HTTP = (ukErrors as { http: Record<string, string> }).http
/** The × of the shared modal, by its Ukrainian label. */
const CLOSE_LABEL = (ukCommon as { components: { modal: { close: string } } }).components.modal
  .close

/**
 * The eleven refusals of the client e-mail doors — copied from the api registry
 * table of story 17-41 (AC-A2-7), not from the dictionaries: a code missing
 * there stays red here. The two codes of the system sender (a3) never reach the
 * card and are deliberately not listed.
 */
const REFUSAL_CODES = [
  'EMAIL_CRM_CHANNEL_NOT_CONFIGURED',
  'EMAIL_CHECK_UNAVAILABLE',
  'EMAIL_CLIENT_NOT_IN_PROJECT',
  'EMAIL_CLIENT_NO_ADDRESS',
  'EMAIL_RECIPIENT_NOT_CLIENT_ADDRESS',
  'EMAIL_RECIPIENT_NOT_ALLOWLISTED',
  'EMAIL_CONTACT_RESTRICTED',
  'EMAIL_REPLY_PARENT_NOT_FOUND',
  'EMAIL_SEND_FAILED',
  'EMAIL_PROJECT_MAILBOX_TEST_FAILED',
  'EMAIL_PROJECT_MAILBOX_CONFLICT',
] as const

const LANGUAGES: Array<[string, Codes]> = [
  ['uk', ukErrors as Codes],
  ['en', enErrors as Codes],
  ['es', esErrors as Codes],
]

const CLIENT_ID = 42

function renderModal(options: { replyTo?: ClientEmailReplyTarget } = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  const onClose = vi.fn()
  const result = render(
    <QueryClientProvider client={client}>
      <SendClientEmailModal open clientId={CLIENT_ID} replyTo={options.replyTo} onClose={onClose} />
    </QueryClientProvider>
  )
  return { ...result, client, invalidate, onClose }
}

function httpError(status: number, data: Dictionary) {
  return Object.assign(new Error(`Request failed with status code ${status}`), {
    isAxiosError: true,
    response: { status, data },
  })
}

function speakUkrainianErrors() {
  vi.spyOn(i18n, 't').mockImplementation(((key: string, options?: Dictionary) => {
    if (options?.ns === 'errors') {
      const [section, name] = key.split('.')
      const table = section === 'codes' ? UK_CODES : section === 'http' ? UK_HTTP : undefined
      if (table && name in table) return table[name]
    }
    return (options?.defaultValue as string) ?? key
  }) as unknown as typeof i18n.t)
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

const SENT = {
  message_id: 'a1b2c3d4-0000-4000-8000-000000000009',
  thread_id: 'a1b2c3d4-0000-4000-8000-0000000000aa',
  sent_at: '2026-09-27T10:00:00Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  doors.sendClientMessage.mockResolvedValue(SENT)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('SendClientEmailModal — the request (T-B3)', () => {
  it('a new letter sends subject and text, and no parent', async () => {
    const user = userEvent.setup()
    renderModal()

    await user.type(screen.getByLabelText(EMAIL.subject), '  Payment schedule  ')
    await user.type(screen.getByLabelText(EMAIL.body), 'Synthetic body text')
    await user.click(screen.getByRole('button', { name: EMAIL.send }))

    await waitFor(() => expect(doors.sendClientMessage).toHaveBeenCalledTimes(1))
    expect(doors.sendClientMessage).toHaveBeenCalledWith(CLIENT_ID, {
      subject: 'Payment schedule',
      body_text: 'Synthetic body text',
    })
  })

  it('a reply keeps the thread: «Re:» subject and the letter answered', async () => {
    const user = userEvent.setup()
    renderModal({ replyTo: { id: 'parent-1', subject: 'Question about payment' } })

    expect(screen.getByLabelText(EMAIL.subject)).toHaveValue('Re: Question about payment')
    await user.type(screen.getByLabelText(EMAIL.body), 'Synthetic answer')
    await user.click(screen.getByRole('button', { name: EMAIL.send }))

    await waitFor(() =>
      expect(doors.sendClientMessage).toHaveBeenCalledWith(CLIENT_ID, {
        subject: 'Re: Question about payment',
        body_text: 'Synthetic answer',
        in_reply_to_message_id: 'parent-1',
      })
    )
  })

  it('answering an answer does not grow «Re: Re:»', () => {
    renderModal({ replyTo: { id: 'parent-2', subject: 'RE: Question' } })

    expect(screen.getByLabelText(EMAIL.subject)).toHaveValue('RE: Question')
  })

  it('«Надіслати» stays disabled until both subject and text are filled', async () => {
    const user = userEvent.setup()
    renderModal()
    const send = screen.getByRole('button', { name: EMAIL.send })

    expect(send).toBeDisabled()
    await user.type(screen.getByLabelText(EMAIL.subject), 'Subject only')
    expect(send).toBeDisabled()
    await user.type(screen.getByLabelText(EMAIL.body), '   ')
    expect(send).toBeDisabled()
    await user.type(screen.getByLabelText(EMAIL.body), 'text')
    expect(send).toBeEnabled()
  })
})

describe('SendClientEmailModal — one click, one letter (AC-B-2 п. 7)', () => {
  it('the button is blocked while the request is in flight, and a double click sends once', async () => {
    const user = userEvent.setup()
    const pending = deferred<typeof SENT>()
    doors.sendClientMessage.mockReturnValue(pending.promise)
    renderModal()

    await user.type(screen.getByLabelText(EMAIL.subject), 'Subject')
    await user.type(screen.getByLabelText(EMAIL.body), 'Body')
    const send = screen.getByRole('button', { name: EMAIL.send })
    await user.dblClick(send)

    await waitFor(() => expect(send).toBeDisabled())
    await user.click(send)
    expect(doors.sendClientMessage).toHaveBeenCalledTimes(1)

    pending.resolve(SENT)
    await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1))
    expect(doors.sendClientMessage).toHaveBeenCalledTimes(1)
  })

  it('two clicks inside one frame — before the button re-renders as disabled — send one letter', async () => {
    const user = userEvent.setup()
    const pending = deferred<typeof SENT>()
    doors.sendClientMessage.mockReturnValue(pending.promise)
    renderModal()

    await user.type(screen.getByLabelText(EMAIL.subject), 'Subject')
    await user.type(screen.getByLabelText(EMAIL.body), 'Body')
    const send = screen.getByRole('button', { name: EMAIL.send })
    // Synchronously, back to back: React Query tells the button about the
    // pending request only on its next tick, so both clicks reach the handler.
    fireEvent.click(send)
    fireEvent.click(send)

    await waitFor(() => expect(doors.sendClientMessage).toHaveBeenCalled())
    pending.resolve(SENT)
    await waitFor(() => expect(toast.success).toHaveBeenCalled())
    expect(doors.sendClientMessage).toHaveBeenCalledTimes(1)
  })
})

/**
 * Closing the modal mid-request would drop the answer (a refusal nobody reads)
 * and the draft, and opening it again would start a second request beside the
 * first. Each way out is its own scene, so each can go red on its own.
 */
describe('SendClientEmailModal — stays open while the letter is on its way', () => {
  async function startSending() {
    const user = userEvent.setup()
    const pending = deferred<typeof SENT>()
    doors.sendClientMessage.mockReturnValue(pending.promise)
    const rendered = renderModal()
    await user.type(screen.getByLabelText(EMAIL.subject), 'Subject')
    await user.type(screen.getByLabelText(EMAIL.body), 'Body')
    return { user, pending, ...rendered }
  }

  it('Escape closes an idle modal, but not one whose letter is on its way', async () => {
    const { user, pending, onClose } = await startSending()

    // Positive control: Escape does reach the modal and close it when nothing is sent.
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
    onClose.mockClear()

    const send = screen.getByRole('button', { name: EMAIL.send })
    await user.click(send)
    await waitFor(() => expect(send).toBeDisabled())
    await user.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByLabelText(EMAIL.body)).toHaveValue('Body')

    pending.resolve(SENT)
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(doors.sendClientMessage).toHaveBeenCalledTimes(1)
  })

  it('«Скасувати» is disabled while the letter is on its way, and the draft stays', async () => {
    const { user, pending, onClose } = await startSending()
    const cancel = screen.getByRole('button', { name: 'Скасувати' })
    expect(cancel).toBeEnabled()

    await user.click(screen.getByRole('button', { name: EMAIL.send }))
    await waitFor(() => expect(cancel).toBeDisabled())
    await user.click(cancel)
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByLabelText(EMAIL.body)).toHaveValue('Body')

    pending.resolve(SENT)
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('the × is gone while the letter is on its way and back once the answer arrives', async () => {
    const { user, pending, onClose } = await startSending()
    expect(screen.getByRole('button', { name: CLOSE_LABEL })).toBeInTheDocument()

    const send = screen.getByRole('button', { name: EMAIL.send })
    await user.click(send)
    await waitFor(() => expect(send).toBeDisabled())
    expect(screen.queryByRole('button', { name: CLOSE_LABEL })).not.toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()

    pending.resolve(SENT)
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(await screen.findByRole('button', { name: CLOSE_LABEL })).toBeInTheDocument()
  })
})

describe('SendClientEmailModal — success', () => {
  it('says «Лист надіслано», closes, and makes the client list read again', async () => {
    const user = userEvent.setup()
    const { invalidate, onClose } = renderModal()

    await user.type(screen.getByLabelText(EMAIL.subject), 'Subject')
    await user.type(screen.getByLabelText(EMAIL.body), 'Body')
    await user.click(screen.getByRole('button', { name: EMAIL.send }))

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(toast.success).toHaveBeenCalledWith(EMAIL.sent)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['clientEmail', 'clients', CLIENT_ID] })
  })
})

describe('SendClientEmailModal — refusals in the operator’s words', () => {
  it('EMAIL_CONTACT_RESTRICTED — «Клієнт відмовився від листів або є обмеження контакту»', async () => {
    const user = userEvent.setup()
    speakUkrainianErrors()
    doors.sendClientMessage.mockRejectedValue(
      httpError(409, {
        detail: 'Contact with the client by e-mail is restricted',
        code: 'EMAIL_CONTACT_RESTRICTED',
        params: { reasons: ['opt_out'] },
      })
    )
    const { onClose } = renderModal()

    await user.type(screen.getByLabelText(EMAIL.subject), 'Subject')
    await user.type(screen.getByLabelText(EMAIL.body), 'Body')
    await user.click(screen.getByRole('button', { name: EMAIL.send }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Клієнт відмовився від листів або є обмеження контакту')
    expect(alert).not.toHaveTextContent('Contact with the client by e-mail is restricted')
    expect(alert).not.toHaveTextContent('opt_out')
    // The operator keeps what was typed and can try again after the restriction is lifted.
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByLabelText(EMAIL.body)).toHaveValue('Body')
    expect(screen.getByRole('button', { name: EMAIL.send })).toBeEnabled()
  })

  it.each(REFUSAL_CODES)('%s reaches the operator in Ukrainian', async (code) => {
    const user = userEvent.setup()
    speakUkrainianErrors()
    doors.sendClientMessage.mockRejectedValue(
      httpError(400, { detail: 'English server text', code })
    )
    renderModal()

    await user.type(screen.getByLabelText(EMAIL.subject), 'Subject')
    await user.type(screen.getByLabelText(EMAIL.body), 'Body')
    await user.click(screen.getByRole('button', { name: EMAIL.send }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(UK_CODES[code])
    expect(alert).not.toHaveTextContent('English server text')
  })

  it('a refusal WITHOUT a code reads as the sentence of its status, not the framework’s English', async () => {
    const user = userEvent.setup()
    speakUkrainianErrors()
    doors.sendClientMessage.mockRejectedValue(
      httpError(422, {
        detail: [{ type: 'string_too_long', loc: ['body', 'subject'], msg: 'String too long' }],
      })
    )
    renderModal()

    await user.type(screen.getByLabelText(EMAIL.subject), 'Subject')
    await user.type(screen.getByLabelText(EMAIL.body), 'Body')
    await user.click(screen.getByRole('button', { name: EMAIL.send }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(UK_HTTP.validation)
    expect(alert).not.toHaveTextContent('String too long')
  })
})

describe('client e-mail refusal codes — dictionaries', () => {
  it('lists the eleven codes of the api registry', () => {
    // Guards the checks below against an empty or duplicated list.
    expect(REFUSAL_CODES).toHaveLength(11)
    expect(new Set(REFUSAL_CODES).size).toBe(11)
  })

  it.each(LANGUAGES)('have a sentence in %s', (_language, errors) => {
    const missing = REFUSAL_CODES.filter((code) => {
      const text = errors.codes[code]
      return typeof text !== 'string' || text.trim() === ''
    })

    expect(missing).toEqual([])
  })

  it('carry no placeholders, no code names, no project names and no API paths', () => {
    for (const [language, errors] of LANGUAGES) {
      for (const code of REFUSAL_CODES) {
        const text = errors.codes[code]
        const where = `${language} ${code}`
        expect(typeof text === 'string' && text.trim() !== '', `${where}: no sentence`).toBe(true)
        expect(text, `${where}: a placeholder`).not.toContain('{{')
        expect(text.toLowerCase(), `${where}: repeats the code name`).not.toContain(
          code.toLowerCase()
        )
        expect(text, `${where}: names an API path`).not.toContain('/api/')
        for (const project of ['Fin-Boost', 'FBLEG', 'TECHNO', 'fin-boost']) {
          expect(text, `${where}: names a project`).not.toContain(project)
        }
      }
    }
  })
})
