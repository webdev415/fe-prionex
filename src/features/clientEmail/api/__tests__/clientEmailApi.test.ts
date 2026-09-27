/**
 * Doors of the client e-mail channel — what leaves the browser and what a
 * failure hands back.
 *
 * The transport is stubbed at the module boundary (`@/lib/api`), as everywhere
 * in this repository; the paths are asserted in full, because the shared client
 * adds only the host and a missing `/api/v1` prefix 404s against the real
 * gateway, never here.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/lib/i18n'
import ukErrors from '@/../public/locales/uk/errors.json'

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  api: mockApi,
  default: mockApi,
}))

const {
  clientEmailApi,
  clientEmailFailureText,
  getCapabilities,
  listClientMessages,
  getClientMessage,
  sendClientMessage,
} = await import('../clientEmailApi')
const { CLIENT_EMAIL_DISABLED } = await import('../types')

type Errors = { codes: Record<string, string>; http: Record<string, string> }
const UK = ukErrors as Errors

/** i18next answers `errors` keys from the Ukrainian file — codes and HTTP statuses alike. */
function speakUkrainianErrors() {
  vi.spyOn(i18n, 't').mockImplementation(((key: string, options?: Record<string, unknown>) => {
    if (options?.ns === 'errors') {
      const [section, name] = key.split('.')
      const table = section === 'codes' ? UK.codes : section === 'http' ? UK.http : undefined
      if (table && name in table) return table[name]
    }
    return (options?.defaultValue as string) ?? key
  }) as unknown as typeof i18n.t)
}

afterEach(() => {
  vi.restoreAllMocks()
})

/** An axios-shaped failure, as `axios.isAxiosError` recognises it. */
function httpError(status: number, data?: Record<string, unknown>) {
  return Object.assign(new Error(`Request failed with status code ${status}`), {
    isAxiosError: true,
    response: { status, data },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getCapabilities', () => {
  it('asks the capabilities door and returns its answer as is', async () => {
    const answer = {
      enabled: true,
      project_mailbox: 'connected',
      can_read: true,
      can_send: false,
    }
    mockApi.get.mockResolvedValue({ data: answer })

    await expect(getCapabilities()).resolves.toEqual(answer)
    expect(mockApi.get).toHaveBeenCalledWith('/api/v1/email/capabilities')
  })

  it('404 — an api without the channel — reads as «off», not as an error', async () => {
    mockApi.get.mockRejectedValue(httpError(404, { detail: 'Not Found' }))

    const answer = await getCapabilities()

    expect(answer).toEqual({
      enabled: false,
      project_mailbox: null,
      can_read: false,
      can_send: false,
    })
    // A copy, so a caller mutating the answer cannot change the shared default.
    expect(answer).not.toBe(CLIENT_EMAIL_DISABLED)
  })

  it.each([403, 500, 503])('%s is thrown, not folded into «off»', async (status) => {
    const failure = httpError(status, { detail: 'boom' })
    mockApi.get.mockRejectedValue(failure)

    await expect(getCapabilities()).rejects.toBe(failure)
  })

  it('a network failure without a response is thrown as well', async () => {
    const failure = Object.assign(new Error('Network Error'), { isAxiosError: true })
    mockApi.get.mockRejectedValue(failure)

    await expect(getCapabilities()).rejects.toBe(failure)
  })
})

describe('client letters', () => {
  it('lists the letters of the client with the paging parameters', async () => {
    const page = { items: [], total: 0, limit: 100, offset: 0 }
    mockApi.get.mockResolvedValue({ data: page })

    await expect(listClientMessages(42, { limit: 100, offset: 0 })).resolves.toBe(page)
    expect(mockApi.get).toHaveBeenCalledWith('/api/v1/email/clients/42/messages', {
      params: { limit: 100, offset: 0 },
    })
  })

  it('reads one letter by its id', async () => {
    const letter = { id: 'a1b2c3d4-0000-4000-8000-000000000001' }
    mockApi.get.mockResolvedValue({ data: letter })

    await expect(getClientMessage(42, letter.id)).resolves.toBe(letter)
    expect(mockApi.get).toHaveBeenCalledWith(
      '/api/v1/email/clients/42/messages/a1b2c3d4-0000-4000-8000-000000000001'
    )
  })

  it('sends the body as given — subject, text and the letter answered', async () => {
    const sent = {
      message_id: 'a1b2c3d4-0000-4000-8000-000000000009',
      thread_id: 'a1b2c3d4-0000-4000-8000-0000000000aa',
      sent_at: '2026-09-27T10:00:00Z',
    }
    mockApi.post.mockResolvedValue({ data: sent })
    const request = {
      subject: 'Re: Payment schedule',
      body_text: 'Synthetic body',
      in_reply_to_message_id: 'a1b2c3d4-0000-4000-8000-000000000001',
    }

    await expect(sendClientMessage(42, request)).resolves.toBe(sent)
    expect(mockApi.post).toHaveBeenCalledWith('/api/v1/email/clients/42/messages', request)
    // No recipient ever leaves the browser: the server writes to the card's address.
    expect(Object.keys(mockApi.post.mock.calls[0][1])).not.toContain('to_address')
  })

  it('a coded refusal reaches the caller with its code and params intact', async () => {
    const refusal = httpError(409, {
      detail: 'Contact restricted',
      code: 'EMAIL_CONTACT_RESTRICTED',
      params: { reasons: ['opt_out'] },
    })
    mockApi.post.mockRejectedValue(refusal)

    const caught = await sendClientMessage(42, { subject: 's', body_text: 'b' }).catch(
      (error: unknown) => error
    )

    expect(caught).toBe(refusal)
    const data = (caught as { response: { data: Record<string, unknown> } }).response.data
    expect(data.code).toBe('EMAIL_CONTACT_RESTRICTED')
    expect(data.params).toEqual({ reasons: ['opt_out'] })
  })

  it('a refusal of the list keeps its code as well', async () => {
    const refusal = httpError(503, {
      detail: 'Check unavailable',
      code: 'EMAIL_CHECK_UNAVAILABLE',
      params: { check: 'client' },
    })
    mockApi.get.mockRejectedValue(refusal)

    await expect(listClientMessages(42)).rejects.toBe(refusal)
  })

  it('the API object exposes exactly the four doors', () => {
    expect(Object.keys(clientEmailApi).sort()).toEqual([
      'getCapabilities',
      'getClientMessage',
      'listClientMessages',
      'sendClientMessage',
    ])
  })
})

describe('clientEmailFailureText — what the operator reads', () => {
  it('a coded refusal reads as the sentence of its code', () => {
    speakUkrainianErrors()
    const refusal = httpError(409, {
      detail: 'Contact with the client by e-mail is restricted',
      code: 'EMAIL_CONTACT_RESTRICTED',
    })

    expect(clientEmailFailureText(refusal)).toBe(UK.codes.EMAIL_CONTACT_RESTRICTED)
  })

  it('404 without a code — the gateway after the channel went off — reads as «not found»', () => {
    speakUkrainianErrors()

    const text = clientEmailFailureText(httpError(404, { detail: 'Not Found' }))

    expect(text).toBe(UK.http.notFound)
    expect(text).not.toContain('Not Found')
  })

  it('403 without a code does not show the permission slug of the door', () => {
    speakUkrainianErrors()
    const failure = httpError(403, {
      detail: 'Insufficient permissions. Requires: email.client.read',
    })

    const text = clientEmailFailureText(failure)

    expect(text).toBe(UK.http.forbidden)
    expect(text).not.toContain('email.client.read')
  })

  it('422 of the framework reads as the validation sentence, not its field list', () => {
    speakUkrainianErrors()
    const failure = httpError(422, {
      detail: [{ type: 'missing', loc: ['body', 'subject'], msg: 'Field required' }],
    })

    const text = clientEmailFailureText(failure)

    expect(text).toBe(UK.http.validation)
    expect(text).not.toContain('Field required')
  })

  it('a status without a sentence of its own reads as the generic one, not axios English', () => {
    speakUkrainianErrors()

    const text = clientEmailFailureText(httpError(503, { detail: 'Service Unavailable' }))

    expect(text).toBe(UK.http.generic)
    expect(text).not.toContain('status code')
  })

  it('a network failure without a response keeps the network sentence', () => {
    speakUkrainianErrors()
    const failure = Object.assign(new Error('Network Error'), {
      isAxiosError: true,
      code: 'ERR_NETWORK',
    })

    expect(clientEmailFailureText(failure)).toBe(UK.http.network)
  })
})
