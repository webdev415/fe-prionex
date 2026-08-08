import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AssistantChatStreamError,
  ATTACHMENTS_TOTAL_TOO_LARGE,
  sendChatMessage,
  type AssistantChatRequest,
} from '../api'

/** Build a Response whose body streams the given SSE text chunks. */
function sseResponse(chunks: string[], init: ResponseInit = {}): Response {
  const encoder = new TextEncoder()
  let i = 0
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(encoder.encode(chunks[i]))
        i += 1
      } else {
        controller.close()
      }
    },
  })
  return new Response(body, { status: 200, ...init })
}

const baseRequest: AssistantChatRequest = {
  message: 'сколько клиентов?',
  mode: 'fast',
  response_mode: 'short',
  output_format: 'text',
}

describe('sendChatMessage SSE transport', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('POSTs the request body with mode / attachments / conversation_id', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        sseResponse(['event: done\ndata: {"conversation_id":1,"message_id":2}\n\n'])
      )
    vi.stubGlobal('fetch', fetchMock)

    await sendChatMessage({
      ...baseRequest,
      mode: 'thinking',
      conversation_id: 42,
      attachments: [{ type: 'image', mime: 'image/png', data_b64: 'AAAA' }],
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('/api/v1/ai-assistant/chat')
    expect(init.method).toBe('POST')
    expect(init.headers.Accept).toBe('text/event-stream')
    const body = JSON.parse(init.body)
    expect(body).toMatchObject({
      message: 'сколько клиентов?',
      mode: 'thinking',
      conversation_id: 42,
      attachments: [{ type: 'image', mime: 'image/png', data_b64: 'AAAA' }],
    })
  })

  it('accumulates streamed text deltas into the resolved response', async () => {
    const onText = vi.fn()
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          sseResponse([
            'event: session\ndata: {"session_id":5}\n\n',
            'event: text\ndata: {"delta":"У вас "}\n\n',
            'event: text\ndata: {"delta":"378K клиентов"}\n\n',
            'event: done\ndata: {"session_id":5,"usage":{"tokens":11}}\n\n',
          ])
        )
    )

    const result = await sendChatMessage(baseRequest, { onText })

    expect(onText.mock.calls.map((c) => c[0]).join('')).toBe('У вас 378K клиентов')
    expect(result.response).toBe('У вас 378K клиентов')
    // session_id maps onto the conversation_id field of the response.
    expect(result.conversation_id).toBe(5)
  })

  it('surfaces sources {tables,tools} and followups {questions} through callbacks', async () => {
    const onSources = vi.fn()
    const onFollowups = vi.fn()
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          sseResponse([
            'event: text\ndata: {"delta":"ok"}\n\n',
            `event: sources\ndata: ${JSON.stringify({ tables: ['client_db'], tools: ['sql'] })}\n\n`,
            `event: followups\ndata: ${JSON.stringify({ questions: ['Ещё?'] })}\n\n`,
            'event: done\ndata: {}\n\n',
          ])
        )
    )

    await sendChatMessage(baseRequest, { onSources, onFollowups })

    expect(onSources).toHaveBeenCalledWith({ tables: ['client_db'], tools: ['sql'] })
    expect(onFollowups).toHaveBeenCalledWith(['Ещё?'])
  })

  it('forwards citations through onCitations and returns them in the response', async () => {
    const onCitations = vi.fn()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        sseResponse([
          'event: text\ndata: {"delta":"Долг 48 750 ₴[[1]]"}\n\n',
          `event: citations\ndata: ${JSON.stringify({
            items: [{ id: 1, kind: 'sql', ref: 'debts:remaining_debt_amount' }],
          })}\n\n`,
          'event: done\ndata: {}\n\n',
        ])
      )
    )

    const result = await sendChatMessage(baseRequest, { onCitations })

    expect(onCitations).toHaveBeenCalledWith([
      { id: 1, kind: 'sql', ref: 'debts:remaining_debt_amount' },
    ])
    expect(result.citations).toEqual([{ id: 1, kind: 'sql', ref: 'debts:remaining_debt_amount' }])
  })

  it('forwards reasoning deltas through onReasoning without polluting the answer', async () => {
    const onReasoning = vi.fn()
    const onText = vi.fn()
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          sseResponse([
            'event: reasoning\ndata: {"delta":"Думаю: "}\n\n',
            'event: reasoning\ndata: {"delta":"считаю клиентов"}\n\n',
            'event: text\ndata: {"delta":"378K"}\n\n',
            'event: done\ndata: {}\n\n',
          ])
        )
    )

    const result = await sendChatMessage(baseRequest, { onReasoning, onText })

    expect(onReasoning.mock.calls.map((c) => c[0]).join('')).toBe('Думаю: считаю клиентов')
    // The reasoning stream is the agent's thinking, not the visible answer.
    expect(result.response).toBe('378K')
    expect(onText).toHaveBeenCalledTimes(1)
  })

  it('records tool_start / tool_end into the assembled tool_calls', async () => {
    const onToolStart = vi.fn()
    const onToolEnd = vi.fn()
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          sseResponse([
            'event: tool_start\ndata: {"name":"sql_query","label":"SQL"}\n\n',
            'event: tool_end\ndata: {"tool_use_id":"t1","ok":true}\n\n',
            'event: text\ndata: {"delta":"done"}\n\n',
            'event: done\ndata: {}\n\n',
          ])
        )
    )

    const result = await sendChatMessage(baseRequest, { onToolStart, onToolEnd })

    expect(onToolStart).toHaveBeenCalledWith({ name: 'sql_query', label: 'SQL' })
    expect(onToolEnd).toHaveBeenCalledWith({ tool_use_id: 't1', ok: true })
    expect(result.tool_calls).toEqual([{ tool_name: 'sql_query', success: true }])
  })

  it('throws AssistantChatStreamError from an in-band error frame {message}', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          sseResponse([
            'event: text\ndata: {"delta":"part"}\n\n',
            'event: error\ndata: {"message":"thinking busy"}\n\n',
          ])
        )
    )

    const error = await sendChatMessage(baseRequest).catch((e) => e)
    expect(error).toBeInstanceOf(AssistantChatStreamError)
    expect(error.message).toBe('thinking busy')
  })

  it('surfaces an in-band status when the backend includes one (503)', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(sseResponse(['event: error\ndata: {"status":503,"message":"busy"}\n\n']))
    )

    await expect(sendChatMessage(baseRequest)).rejects.toMatchObject({
      name: 'AssistantChatStreamError',
      status: 503,
    })
  })

  it('throws AssistantChatStreamError on an HTTP error before the stream', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ detail: 'image needs text' }), {
          status: 422,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    )

    const error = await sendChatMessage(baseRequest).catch((e) => e)
    expect(error).toBeInstanceOf(AssistantChatStreamError)
    expect(error.status).toBe(422)
    expect(error.message).toBe('image needs text')
    expect(error.serverDetail).toBe('image needs text')
  })

  it('flattens the FastAPI validation detail list into readable text', async () => {
    // Pydantic answers a rejected attachment with detail: [{loc, msg, type}] —
    // rendering that object as-is would show the operator "[object Object]".
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            detail: [
              {
                loc: ['body', 'attachments', 0, 'data_b64'],
                msg: 'документ 62914560 байт перевищує ліміт 52428800 байт (50MB)',
                type: 'value_error',
              },
            ],
          }),
          { status: 422, headers: { 'Content-Type': 'application/json' } }
        )
      )
    )

    const error = await sendChatMessage(baseRequest).catch((e) => e)
    expect(error.serverDetail).toBe('документ 62914560 байт перевищує ліміт 52428800 байт (50MB)')
  })

  it('reads the structured 413 refusal (total attachment cap) with its code', async () => {
    // The service answers the total cap with detail as an OBJECT — a shape that
    // shares nothing with FastAPI's {msg} items, so reading only `msg` would
    // drop the wording and leave the operator with a wrong hint about a single
    // oversized file.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            detail: {
              code: ATTACHMENTS_TOTAL_TOO_LARGE,
              message:
                'Сумарний розмір вкладень перевищує ліміт — надішліть файли меншими партіями.',
              total_bytes: 157286400,
              max_bytes: 157286400,
            },
          }),
          { status: 413, headers: { 'Content-Type': 'application/json' } }
        )
      )
    )

    const error = await sendChatMessage(baseRequest).catch((e) => e)
    expect(error.status).toBe(413)
    expect(error.code).toBe(ATTACHMENTS_TOTAL_TOO_LARGE)
    expect(error.serverDetail).toBe(
      'Сумарний розмір вкладень перевищує ліміт — надішліть файли меншими партіями.'
    )
  })

  it('reports no code for the gateway 413, marking the text as not ours', async () => {
    // Kong: kong.response.error(413, "Request size limit exceeded") → a plain
    // {message} body. The absent code is what lets the UI tell this apart from
    // our own refusal and use its localised wording instead.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'Request size limit exceeded' }), {
          status: 413,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    )

    const error = await sendChatMessage(baseRequest).catch((e) => e)
    expect(error.status).toBe(413)
    expect(error.code).toBeUndefined()
  })

  it('leaves serverDetail unset when the error body is not JSON (proxy 413)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('<html><body><h1>413 Request Entity Too Large</h1></body></html>', {
          status: 413,
          headers: { 'Content-Type': 'text/html' },
        })
      )
    )

    const error = await sendChatMessage(baseRequest).catch((e) => e)
    expect(error.status).toBe(413)
    expect(error.serverDetail).toBeUndefined()
  })

  it('ignores unknown event frames in the stream (forward-compat)', async () => {
    const onText = vi.fn()
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          sseResponse([
            'event: reasoning\ndata: {"step":"thinking"}\n\n',
            'event: text\ndata: {"delta":"answer"}\n\n',
            'event: subagent_started\ndata: {"id":"a"}\n\n',
            'event: done\ndata: {}\n\n',
          ])
        )
    )

    const result = await sendChatMessage(baseRequest, { onText })
    expect(result.response).toBe('answer')
    expect(onText).toHaveBeenCalledTimes(1)
  })
})
