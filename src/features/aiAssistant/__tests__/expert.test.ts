/**
 * Экспертный режим — контракт с бэкендом.
 *
 * Проверяется ровно то, чем фронт рискует: разрешение на платный внешний
 * сервис (только явное «да»), чтение отчёта о расходе из потока и то, что поле
 * `expert` уходит в теле запроса лишь когда его туда положили.
 */
import { describe, expect, it, vi } from 'vitest'
import {
  EXPERT_CAPABILITY_OFF,
  normalizeCapabilities,
  sendChatMessage,
  type AssistantChatRequest,
} from '../api'
import { dispatchSseEvent, normalizeExpertUsage } from '../sse'

/** Response whose body streams the given SSE text chunks (mirrors api.sse.test). */
function sseResponse(chunks: string[]): Response {
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
  return new Response(body, { status: 200 })
}

const baseRequest: AssistantChatRequest = {
  message: 'разбери падение сборов',
  mode: 'fast',
  response_mode: 'short',
  output_format: 'text',
}

describe('normalizeCapabilities', () => {
  it('reads the documented expert_mode envelope', () => {
    const capabilities = normalizeCapabilities({
      expert_mode: {
        enabled: true,
        allowed: true,
        models: ['claude-sonnet-5', 'claude-opus-5'],
        daily_limit_usd: 5,
        spent_today_usd: 1.2,
      },
    })

    expect(capabilities.expert).toEqual({
      enabled: true,
      allowed: true,
      models: ['claude-sonnet-5', 'claude-opus-5'],
      dailyLimitUsd: 5,
      spentTodayUsd: 1.2,
      // При allowed=true шлюз обоих полей причины не шлёт вовсе.
      reason: null,
      reasonCode: null,
    })
  })

  it('carries the refusal reason and its machine code', () => {
    const capability = normalizeCapabilities({
      expert_mode: {
        enabled: true,
        allowed: false,
        models: ['claude-sonnet-5'],
        daily_limit_usd: 5,
        spent_today_usd: 5,
        reason: 'денний ліміт витрат вичерпано (5.00 з 5.00 $)',
        reason_code: 'limit',
      },
    }).expert

    expect(capability.reasonCode).toBe('limit')
    expect(capability.reason).toBe('денний ліміт витрат вичерпано (5.00 з 5.00 $)')
  })

  it('treats a missing / unknown payload as "no expert mode"', () => {
    expect(normalizeCapabilities(undefined).expert).toEqual(EXPERT_CAPABILITY_OFF)
    expect(normalizeCapabilities({}).expert).toEqual(EXPERT_CAPABILITY_OFF)
    expect(normalizeCapabilities({ expert_mode: null }).expert).toEqual(EXPERT_CAPABILITY_OFF)
  })

  it('opens the paid mode only on a literal true (never on a truthy string)', () => {
    const capability = normalizeCapabilities({
      expert_mode: { enabled: 'true', allowed: 1, models: ['claude-opus-5'] },
    }).expert

    expect(capability.enabled).toBe(false)
    expect(capability.allowed).toBe(false)
  })

  it('drops non-string models and reports absent budget figures as null', () => {
    const capability = normalizeCapabilities({
      expert_mode: {
        enabled: true,
        allowed: true,
        models: ['claude-sonnet-5', 42, '', null],
        daily_limit_usd: 'not-a-number',
      },
    }).expert

    expect(capability.models).toEqual(['claude-sonnet-5'])
    expect(capability.dailyLimitUsd).toBeNull()
    expect(capability.spentTodayUsd).toBeNull()
  })
})

describe('normalizeExpertUsage', () => {
  it('reads both the nested envelope and the flat object', () => {
    const nested = normalizeExpertUsage({
      expert: { model: 'claude-sonnet-5', cost_usd: 0.05, input_tokens: 900, output_tokens: 120 },
    })
    const flat = normalizeExpertUsage({
      model: 'claude-sonnet-5',
      cost_usd: 0.05,
      input_tokens: 900,
      output_tokens: 120,
    })

    expect(nested).toEqual(flat)
    expect(nested).toMatchObject({ model: 'claude-sonnet-5', costUsd: 0.05, outputTokens: 120 })
  })

  it('accepts a numeric string cost (JSON decimals arrive as strings)', () => {
    expect(normalizeExpertUsage({ model: 'claude-opus-5', cost_usd: '0.42' })?.costUsd).toBe(0.42)
  })

  it('is not a usage report without a model name', () => {
    expect(normalizeExpertUsage({ cost_usd: 0.05 })).toBeNull()
    expect(normalizeExpertUsage(null)).toBeNull()
    expect(normalizeExpertUsage({ model: '   ' })).toBeNull()
  })
})

describe('dispatchSseEvent — expert frames', () => {
  it('routes a `result` frame to onExpert without ending the stream', () => {
    const onExpert = vi.fn()
    const terminator = dispatchSseEvent(
      { event: 'result', data: '{"expert":{"model":"claude-opus-5","cost_usd":0.31}}' },
      { onExpert }
    )

    expect(terminator).toBeUndefined()
    expect(onExpert).toHaveBeenCalledWith(expect.objectContaining({ model: 'claude-opus-5' }))
  })

  it('also reads the usage when it rides inside `done`', () => {
    const onExpert = vi.fn()
    const onDone = vi.fn()
    const terminator = dispatchSseEvent(
      { event: 'done', data: '{"session_id":7,"expert":{"model":"claude-sonnet-5"}}' },
      { onExpert, onDone }
    )

    expect(terminator).toBe('done')
    expect(onDone).toHaveBeenCalled()
    expect(onExpert).toHaveBeenCalledWith(expect.objectContaining({ model: 'claude-sonnet-5' }))
  })

  it('does not price an ordinary turn whose `done` merely names the brain model', () => {
    const onExpert = vi.fn()
    dispatchSseEvent({ event: 'done', data: '{"session_id":7,"model":"gemma-26b"}' }, { onExpert })

    expect(onExpert).not.toHaveBeenCalled()
  })
})

describe('sendChatMessage — expert turn', () => {
  it('sends the expert block and resolves with the streamed usage', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        sseResponse([
          'event: text\ndata: {"delta":"Готово"}\n\n',
          'event: result\ndata: {"expert":{"model":"claude-sonnet-5","cost_usd":0.05,"input_tokens":900,"output_tokens":120}}\n\n',
          'event: done\ndata: {"session_id":11}\n\n',
        ])
      )
    vi.stubGlobal('fetch', fetchMock)
    const onExpert = vi.fn()

    const result = await sendChatMessage(
      { ...baseRequest, expert: { model: 'claude-sonnet-5' } },
      { onExpert }
    )

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).expert).toEqual({
      model: 'claude-sonnet-5',
    })
    expect(onExpert).toHaveBeenCalledTimes(1)
    expect(result.expert).toMatchObject({ model: 'claude-sonnet-5', costUsd: 0.05 })

    vi.unstubAllGlobals()
  })

  it('reads the usage the live gateway sends — inside the done frame', async () => {
    // Боевая форма (ASSISTANT_MODES.md §4): отдельного `result` шлюз не шлёт,
    // расход приезжает блоком внутри `done`.
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          sseResponse([
            'event: text\ndata: {"delta":"Готово"}\n\n',
            'event: done\ndata: {"session_id":"abc","cost_usd":0.02,"expert":{"model":"claude-opus-5","cost_usd":0.31,"input_tokens":1200,"output_tokens":400,"cache_read_tokens":10,"cache_write_tokens":5}}\n\n',
          ])
        )
    )

    const result = await sendChatMessage({ ...baseRequest, expert: { model: 'claude-opus-5' } })

    // Цена берётся из expert.cost_usd, а не из занижённого done.cost_usd.
    expect(result.expert).toMatchObject({ model: 'claude-opus-5', costUsd: 0.31 })

    vi.unstubAllGlobals()
  })

  it('leaves an ordinary turn without an expert block or usage', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(sseResponse(['event: done\ndata: {"session_id":11}\n\n']))
    vi.stubGlobal('fetch', fetchMock)

    const result = await sendChatMessage(baseRequest)

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).expert).toBeUndefined()
    expect(result.expert).toBeUndefined()

    vi.unstubAllGlobals()
  })
})
