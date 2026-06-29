import { describe, expect, it, vi } from 'vitest'
import {
  consumeSseStream,
  dispatchSseEvent,
  parseSseChunk,
  SseParser,
  type SseStreamCallbacks,
} from '../sse'

/** Build a ReadableStream that emits the given UTF-8 string chunks in order. */
function streamFromChunks(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
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

describe('SseParser frame decoding', () => {
  it('parses event + data into a frame', () => {
    const frames = parseSseChunk('event: text\ndata: {"delta":"hi"}\n\n')
    expect(frames).toEqual([{ event: 'text', data: '{"delta":"hi"}' }])
  })

  it('joins multiple data lines with a newline', () => {
    const frames = parseSseChunk('event: text\ndata: line1\ndata: line2\n\n')
    expect(frames).toEqual([{ event: 'text', data: 'line1\nline2' }])
  })

  it('strips a single leading space after the colon', () => {
    const frames = parseSseChunk('event:text\ndata:no-space\n\n')
    expect(frames[0]).toEqual({ event: 'text', data: 'no-space' })
  })

  it('ignores comment lines', () => {
    const frames = parseSseChunk(': keep-alive\nevent: done\ndata: {}\n\n')
    expect(frames).toEqual([{ event: 'done', data: '{}' }])
  })

  it('buffers a partial frame across pushes and emits once terminated', () => {
    const parser = new SseParser()
    expect(parser.push('event: text\n')).toEqual([])
    expect(parser.push('data: {"delta":"ab"}')).toEqual([])
    const frames = parser.push('\n\n')
    expect(frames).toEqual([{ event: 'text', data: '{"delta":"ab"}' }])
  })

  it('splits multiple frames in one chunk', () => {
    const frames = parseSseChunk(
      'event: text\ndata: a\n\nevent: text\ndata: b\n\nevent: done\ndata: {}\n\n'
    )
    expect(frames.map((f) => f.event)).toEqual(['text', 'text', 'done'])
  })

  it('flush emits a trailing un-terminated frame', () => {
    const parser = new SseParser()
    parser.push('event: done\ndata: {}')
    expect(parser.flush()).toEqual([{ event: 'done', data: '{}' }])
  })

  it('normalises CRLF line endings', () => {
    const frames = parseSseChunk('event: text\r\ndata: hi\r\n\r\n')
    expect(frames).toEqual([{ event: 'text', data: 'hi' }])
  })
})

describe('dispatchSseEvent routing', () => {
  it('accumulates text deltas through onText', () => {
    const onText = vi.fn()
    dispatchSseEvent({ event: 'text', data: '{"delta":"Hel"}' }, { onText })
    dispatchSseEvent({ event: 'text', data: '{"delta":"lo"}' }, { onText })
    expect(onText).toHaveBeenNthCalledWith(1, 'Hel')
    expect(onText).toHaveBeenNthCalledWith(2, 'lo')
  })

  it('forwards plain-text (non-JSON) data deltas verbatim', () => {
    const onText = vi.fn()
    dispatchSseEvent({ event: 'text', data: 'raw chunk' }, { onText })
    expect(onText).toHaveBeenCalledWith('raw chunk')
  })

  it('parses a sources frame into {tables, tools} (ASSISTANT_MODES.md §4)', () => {
    const onSources = vi.fn()
    dispatchSseEvent(
      {
        event: 'sources',
        data: JSON.stringify({ tables: ['client_db.payments'], tools: ['sql_query'] }),
      },
      { onSources }
    )
    expect(onSources).toHaveBeenCalledWith({
      tables: ['client_db.payments'],
      tools: ['sql_query'],
    })
  })

  it('defaults missing sources arrays to empty', () => {
    const onSources = vi.fn()
    dispatchSseEvent({ event: 'sources', data: JSON.stringify({ tables: ['a'] }) }, { onSources })
    expect(onSources).toHaveBeenCalledWith({ tables: ['a'], tools: [] })
  })

  it('parses a followups frame from {questions:[...]}', () => {
    const onFollowups = vi.fn()
    dispatchSseEvent(
      {
        event: 'followups',
        data: JSON.stringify({ questions: ['Показать за месяц', 'Сравнить с прошлым'] }),
      },
      { onFollowups }
    )
    expect(onFollowups).toHaveBeenCalledWith(['Показать за месяц', 'Сравнить с прошлым'])
  })

  it('routes a tool_start frame', () => {
    const onToolStart = vi.fn()
    dispatchSseEvent(
      {
        event: 'tool_start',
        data: JSON.stringify({ name: 'sql_query', label: 'SQL', args_preview: 'SELECT ...' }),
      },
      { onToolStart }
    )
    expect(onToolStart).toHaveBeenCalledWith({
      name: 'sql_query',
      label: 'SQL',
      args_preview: 'SELECT ...',
    })
  })

  it('routes a tool_end frame (ok defaults to false)', () => {
    const onToolEnd = vi.fn()
    dispatchSseEvent(
      { event: 'tool_end', data: JSON.stringify({ tool_use_id: 't1', result_preview: '12 rows' }) },
      { onToolEnd }
    )
    expect(onToolEnd).toHaveBeenCalledWith({
      tool_use_id: 't1',
      result_preview: '12 rows',
      ok: false,
    })
  })

  it('does NOT treat tool_start / tool_end as terminators', () => {
    expect(dispatchSseEvent({ event: 'tool_start', data: '{"name":"x"}' }, {})).toBeUndefined()
    expect(dispatchSseEvent({ event: 'tool_end', data: '{"ok":true}' }, {})).toBeUndefined()
  })

  it('routes an error frame and signals the terminator', () => {
    const onError = vi.fn()
    const outcome = dispatchSseEvent(
      { event: 'error', data: JSON.stringify({ message: 'busy' }) },
      { onError }
    )
    expect(onError).toHaveBeenCalledWith({ message: 'busy' })
    expect(outcome).toBe('error')
  })

  it('routes a done frame with session_id + usage and signals the terminator', () => {
    const onDone = vi.fn()
    const outcome = dispatchSseEvent(
      { event: 'done', data: JSON.stringify({ session_id: 9, usage: { tokens: 100 } }) },
      { onDone }
    )
    expect(onDone).toHaveBeenCalledWith({ session_id: 9, usage: { tokens: 100 } })
    expect(outcome).toBe('done')
  })

  it('routes a session frame with session_id', () => {
    const onSession = vi.fn()
    dispatchSseEvent({ event: 'session', data: JSON.stringify({ session_id: 3 }) }, { onSession })
    expect(onSession).toHaveBeenCalledWith({ session_id: 3 })
  })

  it('ignores unknown / future event types without throwing (forward-compat)', () => {
    const callbacks: SseStreamCallbacks = {
      onText: vi.fn(),
      onError: vi.fn(),
      onSources: vi.fn(),
      onFollowups: vi.fn(),
      onToolStart: vi.fn(),
      onToolEnd: vi.fn(),
    }
    // The exact future names called out in the contract + a wildcard.
    for (const event of ['reasoning', 'todo', 'subagent_start', 'subagent_done', 'mystery']) {
      expect(() => dispatchSseEvent({ event, data: '{"x":1}' }, callbacks)).not.toThrow()
    }
    expect(callbacks.onText).not.toHaveBeenCalled()
    expect(callbacks.onError).not.toHaveBeenCalled()
    expect(callbacks.onSources).not.toHaveBeenCalled()
    expect(callbacks.onFollowups).not.toHaveBeenCalled()
    expect(callbacks.onToolStart).not.toHaveBeenCalled()
    expect(callbacks.onToolEnd).not.toHaveBeenCalled()
  })

  it('does not crash on malformed JSON data', () => {
    const onSources = vi.fn()
    expect(() =>
      dispatchSseEvent({ event: 'sources', data: '{not json' }, { onSources })
    ).not.toThrow()
    expect(onSources).toHaveBeenCalledWith({ tables: [], tools: [] })
  })
})

describe('consumeSseStream end-to-end', () => {
  it('accumulates text across chunked frames and resolves on done', async () => {
    const onText = vi.fn()
    const onDone = vi.fn()
    const stream = streamFromChunks([
      'event: session\ndata: {"session_id":1}\n\n',
      'event: text\ndata: {"delta":"Hello"}\n\nevent: te',
      'xt\ndata: {"delta":", world"}\n\n',
      'event: done\ndata: {"session_id":1,"usage":{"tokens":7}}\n\n',
    ])

    const outcome = await consumeSseStream(stream, { onText, onDone })

    expect(outcome).toBe('done')
    expect(onText.mock.calls.map((c) => c[0]).join('')).toBe('Hello, world')
    expect(onDone).toHaveBeenCalledWith({ session_id: 1, usage: { tokens: 7 } })
  })

  it('stops at an error frame and reports the error outcome', async () => {
    const onError = vi.fn()
    const onText = vi.fn()
    const stream = streamFromChunks([
      'event: text\ndata: {"delta":"partial"}\n\n',
      'event: error\ndata: {"message":"thinking busy"}\n\n',
      // Anything after the terminator must not be processed.
      'event: text\ndata: {"delta":"ignored"}\n\n',
    ])

    const outcome = await consumeSseStream(stream, { onError, onText })

    expect(outcome).toBe('error')
    expect(onError).toHaveBeenCalledWith({ message: 'thinking busy' })
    expect(onText).toHaveBeenCalledTimes(1)
    expect(onText).toHaveBeenCalledWith('partial')
  })

  it('handles a multi-byte UTF-8 character split across chunks', async () => {
    const onText = vi.fn()
    // "—" (em dash) is 3 bytes in UTF-8; split the byte sequence across chunks.
    const encoder = new TextEncoder()
    const full = encoder.encode('event: text\ndata: a—b\n\nevent: done\ndata: {}\n\n')
    const cut = 19 // somewhere inside the em-dash bytes
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(full.slice(0, cut))
        controller.enqueue(full.slice(cut))
        controller.close()
      },
    })

    const outcome = await consumeSseStream(stream, { onText })
    expect(outcome).toBe('done')
    expect(onText.mock.calls.map((c) => c[0]).join('')).toBe('a—b')
  })
})
