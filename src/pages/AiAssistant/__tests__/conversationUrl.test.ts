import { beforeEach, describe, expect, it } from 'vitest'
import {
  isNewConversationParam,
  NEW_CONVERSATION_QUERY,
  parseConversationParam,
  writeConversationParam,
} from '../conversationUrl'

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

  it('маркер нового диалога — не id: для разбора это отсутствие deep-link', () => {
    expect(parseConversationParam('?conversation=new')).toBeNull()
    expect(parseConversationParam('?conversation=New')).toBeNull()
  })
})

describe('isNewConversationParam', () => {
  it('узнаёт маркер в любом регистре', () => {
    expect(isNewConversationParam('?conversation=new')).toBe(true)
    expect(isNewConversationParam('conversation=NEW')).toBe(true)
    expect(isNewConversationParam('?conversation=New')).toBe(true)
    expect(isNewConversationParam(`?tab=x&${NEW_CONVERSATION_QUERY}`)).toBe(true)
  })

  it('всё остальное маркером не считает', () => {
    expect(isNewConversationParam('')).toBe(false)
    expect(isNewConversationParam('?conversation=42')).toBe(false)
    expect(isNewConversationParam('?conversation=')).toBe(false)
    expect(isNewConversationParam('?conversation=newest')).toBe(false)
    expect(isNewConversationParam('?other=new')).toBe(false)
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

  it("'new' ставит маркер и перетирается id созданного диалога", () => {
    window.history.replaceState(window.history.state, '', '/dashboard/ai-assistant?tab=x')
    writeConversationParam('new')
    expect(window.location.search).toContain('conversation=new')
    expect(window.location.search).toContain('tab=x')

    // Первая отправка вернула id — маркер уступает ему место.
    writeConversationParam(77)
    expect(window.location.search).toContain('conversation=77')
    expect(window.location.search).not.toContain('conversation=new')
  })

  it("маркер снимается 'null'ом наравне с id", () => {
    writeConversationParam('new')
    writeConversationParam(null)
    expect(window.location.search).toBe('')
  })
})
