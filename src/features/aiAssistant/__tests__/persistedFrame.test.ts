/**
 * Кадр `persisted` — единственный источник id ответа в потоковом ходе.
 *
 * Прокси кладёт его ПОСЛЕ терминального `done` (сначала ход должен закоммититься).
 * Клиент до 11.09.2026 обрывал чтение на `done` и возвращал `message_id: 0` —
 * из-за этого кнопки оценки не рисовались ни разу за ход, и в бою за 23 дня
 * хранения Loki не ушло НИ ОДНОГО запроса `feedback` при 34 завершённых ходах.
 */
import { describe, expect, it, vi } from 'vitest'
import { sendChatMessage, type AssistantChatRequest } from '../api'
import { consumeSseStream } from '../sse'

const encoder = new TextEncoder()

/** Поток, который закрывается после последнего куска. */
function sseStream(chunks: string[]): ReadableStream<Uint8Array> {
  let i = 0
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(encoder.encode(chunks[i]))
        i += 1
      } else {
        controller.close()
      }
    },
  })
}

/** Поток, который после отданных кусков НЕ закрывается (зависший прокси). */
function openEndedStream(chunks: string[]): ReadableStream<Uint8Array> {
  let i = 0
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(encoder.encode(chunks[i]))
        i += 1
      }
      // иначе — тишина: pull больше ничего не отдаёт и поток не закрывается
    },
  })
}

function sseResponse(chunks: string[]): Response {
  return new Response(sseStream(chunks), { status: 200 })
}

const baseRequest: AssistantChatRequest = {
  message: 'скільки боргу',
  mode: 'fast',
  response_mode: 'short',
  output_format: 'text',
}

describe('consumeSseStream: хвост после done', () => {
  it('дочитывает `persisted` после `done`', async () => {
    const onPersisted = vi.fn()
    const onDone = vi.fn()
    const outcome = await consumeSseStream(
      sseStream([
        'event: text\ndata: {"delta":"ок"}\n\n',
        'event: done\ndata: {"session_id":"abc"}\n\n',
        'event: persisted\ndata: {"conversation_id":7,"message_id":42,"coverage_flag":null}\n\n',
      ]),
      { onDone, onPersisted }
    )

    expect(outcome).toBe('done')
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(onPersisted).toHaveBeenCalledWith({
      conversation_id: 7,
      message_id: 42,
      coverage_flag: null,
    })
  })

  it('не ждёт вечно, если поток после `done` не закрылся', async () => {
    const onPersisted = vi.fn()
    const outcome = await consumeSseStream(
      openEndedStream(['event: done\ndata: {"session_id":"abc"}\n\n']),
      { onPersisted },
      { postDoneDrainMs: 20 }
    )

    expect(outcome).toBe('done')
    expect(onPersisted).not.toHaveBeenCalled()
  })

  it('`error` обрывает чтение сразу — хвоста не ждём', async () => {
    const onPersisted = vi.fn()
    const outcome = await consumeSseStream(
      openEndedStream([
        'event: error\ndata: {"message":"нет"}\n\n',
        'event: persisted\ndata: {"message_id":42}\n\n',
      ]),
      { onPersisted },
      { postDoneDrainMs: 20 }
    )

    expect(outcome).toBe('error')
    expect(onPersisted).not.toHaveBeenCalled()
  })

  it('ошибка ПОСЛЕ `done` не превращает удавшийся ход в провал', async () => {
    // Прокси шлёт `error` вместо `persisted`, когда запись хода в БД не удалась.
    // Ответ оператор уже прочитал — терять его из-за неудавшегося персиста нельзя.
    const onError = vi.fn()
    const outcome = await consumeSseStream(
      sseStream([
        'event: text\ndata: {"delta":"ок"}\n\n',
        'event: done\ndata: {"session_id":"abc"}\n\n',
        'event: error\ndata: {"message":"persist failed"}\n\n',
      ]),
      { onError }
    )

    expect(outcome).toBe('done')
    expect(onError).not.toHaveBeenCalled()
  })
})

describe('sendChatMessage: id ответа', () => {
  it('возвращает message_id из `persisted`, а не ноль', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          sseResponse([
            'event: meta\ndata: {"conversation_id":7}\n\n',
            'event: text\ndata: {"delta":"ок"}\n\n',
            'event: done\ndata: {"session_id":"abc"}\n\n',
            'event: persisted\ndata: {"conversation_id":7,"message_id":42,"coverage_flag":"partial"}\n\n',
          ])
        )
    )

    const result = await sendChatMessage(baseRequest)

    expect(result.message_id).toBe(42)
    expect(result.conversation_id).toBe(7)
    expect(result.coverage_flag).toBe('partial')
    vi.unstubAllGlobals()
  })

  it('старый прокси без `persisted`: message_id остаётся 0 («неизвестен»)', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          sseResponse([
            'event: meta\ndata: {"conversation_id":7}\n\n',
            'event: text\ndata: {"delta":"ок"}\n\n',
            'event: done\ndata: {"session_id":"abc"}\n\n',
          ])
        )
    )

    const result = await sendChatMessage(baseRequest)

    expect(result.message_id).toBe(0)
    vi.unstubAllGlobals()
  })
})
