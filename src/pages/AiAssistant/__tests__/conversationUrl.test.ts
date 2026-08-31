import { beforeEach, describe, expect, it } from 'vitest'
import { parseConversationParam, writeConversationParam } from '../conversationUrl'

describe('parseConversationParam', () => {
  it('принимает положительное целое', () => {
    expect(parseConversationParam('?conversation=42')).toBe(42)
    expect(parseConversationParam('conversation=1')).toBe(1)
  })

  it('отбрасывает мусор, ноль, отрицательные, дробные и переполнение', () => {
    expect(parseConversationParam('')).toBeNull()
    expect(parseConversationParam('?other=1')).toBeNull()
    expect(parseConversationParam('?conversation=')).toBeNull()
    expect(parseConversationParam('?conversation=abc')).toBeNull()
    expect(parseConversationParam('?conversation=0')).toBeNull()
    expect(parseConversationParam('?conversation=-5')).toBeNull()
    expect(parseConversationParam('?conversation=4.2')).toBeNull()
    expect(parseConversationParam('?conversation=42abc')).toBeNull()
    expect(parseConversationParam('?conversation=9999999999999999999')).toBeNull()
  })
})

describe('writeConversationParam', () => {
  beforeEach(() => {
    window.history.replaceState({ marker: 'router-state' }, '', '/dashboard/ai-assistant')
  })

  it('ставит и обновляет параметр, не трогая остальные и history.state', () => {
    window.history.replaceState(window.history.state, '', '/dashboard/ai-assistant?tab=x')
    writeConversationParam(42)
    expect(window.location.pathname).toBe('/dashboard/ai-assistant')
    expect(window.location.search).toContain('conversation=42')
    expect(window.location.search).toContain('tab=x')
    // Внутреннее состояние роутера в history.state переживает запись.
    expect(window.history.state).toEqual({ marker: 'router-state' })

    writeConversationParam(43)
    expect(window.location.search).toContain('conversation=43')
    expect(window.location.search).not.toContain('conversation=42')
  })

  it('null убирает параметр; повторная запись того же значения — no-op', () => {
    writeConversationParam(42)
    writeConversationParam(null)
    expect(window.location.search).not.toContain('conversation')
    // Идемпотентность: значение уже такое — URL не пересобирается.
    writeConversationParam(null)
    expect(window.location.search).toBe('')
  })
})
