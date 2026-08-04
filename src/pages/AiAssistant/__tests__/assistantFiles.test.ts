import { describe, expect, it, vi } from 'vitest'
import { API_BASE_URL } from '@/lib/api'
import { classifyAssistantFile, resolveAssistantSource } from '../assistantFiles'

const FILES = `${API_BASE_URL}/api/v1/ai-assistant/files`
/** Токен мозга — `secrets.token_urlsafe(12)`, ровно 16 символов. */
const TOKEN = 'HcQ2vN8pLr4xTb_e'

describe('resolveAssistantSource — ссылка мозга → эндпоинт CRM', () => {
  it.each([
    ['канонический путь мозга', `/api/files/${TOKEN}/payments_2026.png`],
    ['без ведущего слэша', `api/files/${TOKEN}/payments_2026.png`],
    ['только хвост (модель обрезала префикс)', `${TOKEN}/payments_2026.png`],
  ])('%s → /api/v1/ai-assistant/files/<token>/<name>', (_label, src) => {
    expect(resolveAssistantSource(src)).toEqual({
      type: 'internal',
      url: `${FILES}/${TOKEN}/payments_2026.png`,
      name: 'payments_2026.png',
      kind: 'image',
    })
  })

  it('принимает токен длиннее 16 символов (запас на смену длины в мозге)', () => {
    const long = 'A'.repeat(64)
    expect(resolveAssistantSource(`/api/files/${long}/chart.png`)).toMatchObject({
      type: 'internal',
      url: `${FILES}/${long}/chart.png`,
    })
  })

  it('экранирует пробелы и кириллицу в имени файла', () => {
    const resolved = resolveAssistantSource(`${TOKEN}/звіт липень.xlsx`)

    expect(resolved.type).toBe('internal')
    const url = resolved.type === 'internal' ? resolved.url : ''
    expect(url).not.toContain(' ')
    expect(url).toContain('%20')
    expect(decodeURIComponent(url)).toBe(`${FILES}/${TOKEN}/звіт липень.xlsx`)
    // Имя для скачивания остаётся человекочитаемым.
    expect(resolved.type === 'internal' && resolved.name).toBe('звіт липень.xlsx')
  })

  it('не кодирует повторно уже экранированное имя', () => {
    const resolved = resolveAssistantSource(`${TOKEN}/%D0%B7%D0%B2%D1%96%D1%82.csv`)

    // Наивный encode дал бы %25D0%25B7… — сервер такой файл не найдёт.
    expect(resolved.type === 'internal' && resolved.url).toBe(
      `${FILES}/${TOKEN}/%D0%B7%D0%B2%D1%96%D1%82.csv`
    )
    expect(resolved.type === 'internal' && resolved.name).toBe('звіт.csv')
  })

  it('переживает литеральный `%` в имени (битая escape-последовательность)', () => {
    const resolved = resolveAssistantSource(`${TOKEN}/50% off.png`)

    expect(resolved.type).toBe('internal')
    const url = resolved.type === 'internal' ? resolved.url : ''
    expect(url).toBe(`${FILES}/${TOKEN}/50%25%20off.png`)
    expect(decodeURIComponent(url)).toBe(`${FILES}/${TOKEN}/50% off.png`)
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

describe('resolveAssistantSource — ссылка не может указать никуда, кроме моста', () => {
  it.each([
    ['чужой эндпоинт CRM', '/api/v1/clients/1'],
    ['обход вверх', `${TOKEN}/../../api/v1/clients/1`],
    ['обход в начале', '../secrets.png'],
    // `%2E%2E` — это `..`, экранированные так, чтобы проскочить проверку.
    ['экранированный обход', `/api/files/${TOKEN}/%2E%2E/%2E%2E/clients`],
    ['слишком короткий токен (не capability)', 'a1b2c3/payments.png'],
    ['лишний сегмент пути', `${TOKEN}/sub/dir/file.png`],
  ])('%s → unresolvable, а не запрос', (_label, src) => {
    expect(resolveAssistantSource(src)).toEqual({ type: 'unresolvable' })
  })

  it.each([
    ['обратные слэши', `${TOKEN}\\..\\..\\etc`],
    ['query-строка', `${TOKEN}/file.png?redirect=evil`],
    ['фрагмент', `${TOKEN}/file.png#x`],
    ['пустая строка', '   '],
  ])('%s → blocked', (_label, src) => {
    expect(resolveAssistantSource(src)).toEqual({ type: 'blocked' })
  })

  it('одиночное имя без токена — unresolvable (модель потеряла ссылку)', () => {
    // Симптом из задачи: `![](payments_2026.png)`. Токен и есть capability —
    // без него скачать нечего, и подставлять роут под голое имя нельзя:
    // это отдало бы любому оператору чужие выгрузки.
    expect(resolveAssistantSource('payments_2026.png')).toEqual({ type: 'unresolvable' })
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
      const resolved = resolve(`/api/files/${TOKEN}/chart.png`)

      expect(resolved.type === 'internal' && resolved.url).toBe(
        `/api/v1/ai-assistant/files/${TOKEN}/chart.png`
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
    ['shot.webp', 'image'],
    ['report.pdf', 'pdf'],
    ['export.xlsx', 'sheet'],
    ['export.csv', 'sheet'],
    ['notes.md', 'document'],
    ['raw.json', 'document'],
    ['archive.zip', 'other'],
    ['noextension', 'other'],
    // Шлюз отдаёт inline только png/jpg/jpeg/webp; остальное — карточка, а не
    // <img>, который всё равно упёрся бы в 400 по белому списку расширений.
    ['diagram.svg', 'other'],
    ['anim.gif', 'other'],
  ])('%s → %s', (name, kind) => {
    expect(classifyAssistantFile(name)).toBe(kind)
  })
})
