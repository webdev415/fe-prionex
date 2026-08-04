import { describe, expect, it, vi } from 'vitest'
import { API_BASE_URL } from '@/lib/api'
import { classifyAssistantFile, resolveAssistantSource } from '../assistantFiles'

const FILES = `${API_BASE_URL}/api/v1/ai-assistant/files`

describe('resolveAssistantSource — относительный путь → эндпоинт CRM', () => {
  it('переписывает `<token>/<имя>` на /api/v1/ai-assistant/files/...', () => {
    const resolved = resolveAssistantSource('a1b2c3/payments_2026.png')

    expect(resolved).toEqual({
      type: 'internal',
      url: `${FILES}/a1b2c3/payments_2026.png`,
      name: 'payments_2026.png',
      kind: 'image',
    })
  })

  it('экранирует пробелы и кириллицу в имени файла', () => {
    const resolved = resolveAssistantSource('tok/звіт липень.xlsx')

    expect(resolved.type).toBe('internal')
    const url = resolved.type === 'internal' ? resolved.url : ''
    expect(url).not.toContain(' ')
    expect(url).toContain('%20')
    expect(decodeURI(url)).toBe(`${FILES}/tok/звіт липень.xlsx`)
    // Имя для скачивания остаётся человекочитаемым.
    expect(resolved.type === 'internal' && resolved.name).toBe('звіт липень.xlsx')
  })

  it('не кодирует повторно уже экранированное имя', () => {
    const resolved = resolveAssistantSource('tok/%D0%B7%D0%B2%D1%96%D1%82.csv')

    // Наивный encodeURI дал бы %25D0%25B7… — сервер такой файл не найдёт.
    expect(resolved.type === 'internal' && resolved.url).toBe(
      `${FILES}/tok/%D0%B7%D0%B2%D1%96%D1%82.csv`
    )
    expect(resolved.type === 'internal' && resolved.name).toBe('звіт.csv')
  })

  it('переживает литеральный `%` в имени (битая escape-последовательность)', () => {
    const resolved = resolveAssistantSource('tok/50% off.png')

    expect(resolved.type).toBe('internal')
    const url = resolved.type === 'internal' ? resolved.url : ''
    expect(url).toBe(`${FILES}/tok/50%25%20off.png`)
    expect(decodeURIComponent(url)).toBe(`${FILES}/tok/50% off.png`)
  })
})

describe('resolveAssistantSource — внешние ссылки не становятся картинкой', () => {
  it.each([
    'https://evil.tld/pixel.png',
    'http://evil.tld/pixel.png',
    '//evil.tld/pixel.png', // протокол-относительная — тоже чужой origin
  ])('%s классифицируется как external', (src) => {
    expect(resolveAssistantSource(src)).toEqual({ type: 'external', href: src })
  })

  it.each([
    'data:image/png;base64,iVBORw0KGgo=',
    'javascript:alert(1)',
    'blob:https://crm-prionex.online/abc',
    'file:///etc/passwd',
  ])('%s блокируется полностью (даже как ссылка)', (src) => {
    expect(resolveAssistantSource(src)).toEqual({ type: 'blocked' })
  })
})

describe('resolveAssistantSource — путь не может выйти за пределы моста', () => {
  it.each([
    ['обход вверх', 'tok/../../api/v1/clients/1'],
    ['обход в начале', '../secrets.png'],
    ['абсолютный путь по origin CRM', '/api/v1/clients/1'],
    ['обратные слэши', 'tok\\..\\..\\etc'],
    // `%2E%2E` — это `..`, экранированные так, чтобы проскочить проверку.
    ['экранированный обход', 'tok/%2E%2E/%2E%2E/api/v1/clients/1'],
    ['query-строка', 'tok/file.png?redirect=evil'],
    ['фрагмент', 'tok/file.png#x'],
    ['пустой сегмент', 'tok//file.png'],
    ['пустая строка', '   '],
  ])('%s → blocked', (_label, src) => {
    expect(resolveAssistantSource(src)).toEqual({ type: 'blocked' })
  })

  it('undefined/null не роняют резолвер', () => {
    expect(resolveAssistantSource(undefined)).toEqual({ type: 'blocked' })
    expect(resolveAssistantSource(null)).toEqual({ type: 'blocked' })
  })
})

describe('resolveAssistantSource — базовый URL, заканчивающийся слэшем', () => {
  it('прод собирается с VITE_API_BASE_URL="/" → same-origin путь, а не //api/...', async () => {
    // Наивная склейка дала бы `//api/v1/...` — протокол-относительный URL,
    // то есть запрос на хост с именем `api`, а не на свой origin.
    vi.resetModules()
    vi.doMock('@/lib/api', () => ({ API_BASE_URL: '/', api: { get: vi.fn() } }))
    try {
      const { resolveAssistantSource: resolve } = await import('../assistantFiles')
      const resolved = resolve('tok/chart.png')

      expect(resolved.type === 'internal' && resolved.url).toBe(
        '/api/v1/ai-assistant/files/tok/chart.png'
      )
    } finally {
      vi.doUnmock('@/lib/api')
      vi.resetModules()
    }
  })
})

describe('classifyAssistantFile', () => {
  it.each([
    ['chart.png', 'image'],
    ['photo.JPEG', 'image'],
    ['report.pdf', 'pdf'],
    ['export.xlsx', 'sheet'],
    ['export.csv', 'sheet'],
    ['act.docx', 'document'],
    ['archive.zip', 'other'],
    ['noextension', 'other'],
    // SVG — документ, а не растр: уходит в карточку-скачивание, не в <img>.
    ['diagram.svg', 'other'],
  ])('%s → %s', (name, kind) => {
    expect(classifyAssistantFile(name)).toBe(kind)
  })
})
