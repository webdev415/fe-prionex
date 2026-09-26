/**
 * Переход окна по адресу без заголовка Referer.
 *
 * `location.href = url` и `location.assign(url)` из окна CRM уходят с его
 * Referer. Ссылка `rel="noreferrer"` в документе того окна, которое уходит, —
 * переход, который начинает само это окно и без Referer. Документ окна может
 * быть недоступен (вкладка уже на чужом origin) — тогда переход всё равно
 * случается, прямым адресом: молча не перейти было бы хуже.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { navigateWithoutReferrer } from '../navigateWithoutReferrer'

const URL_ = 'https://cms.dev.example.test/admin/sso?t=one-time'

describe('navigateWithoutReferrer', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('нажимает ссылку `noreferrer` в документе целевого окна и убирает её', () => {
    const doc = document.implementation.createHTMLDocument('')
    const target = { document: doc, location: { href: '' } } as unknown as Window
    const seen: Array<{ href: string; rel: string; owner: Document; connected: boolean }> = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      seen.push({
        href: this.href,
        rel: this.rel,
        owner: this.ownerDocument,
        connected: this.isConnected,
      })
    })

    navigateWithoutReferrer(target, URL_)

    expect(seen).toEqual([
      { href: URL_, rel: expect.stringContaining('noreferrer'), owner: doc, connected: true },
    ])
    expect(doc.querySelectorAll('a')).toHaveLength(0)
    expect((target.location as { href: string }).href).toBe('')
  })

  it('документ окна недоступен (чужой origin) — переход прямым адресом, а не тишина', () => {
    const location = { href: '' }
    const target = {
      get document(): Document {
        throw new DOMException('Blocked a frame with origin', 'SecurityError')
      },
      location,
    } as unknown as Window
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    navigateWithoutReferrer(target, URL_)

    expect(location.href).toBe(URL_)
    expect(click).not.toHaveBeenCalled()
  })
})
