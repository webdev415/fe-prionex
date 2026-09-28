/**
 * fb28-file-card-downloaded: object URL и скрытая ссылка живут минуту после
 * клика. Мгновенный revoke ломал сохранение у менеджеров загрузок и антивирусов,
 * которые читают URL чуть позже клика (prod-188: 17 ответов 200, файла нет).
 */
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { DOWNLOAD_URL_TTL_MS, downloadBlob } from '../downloadBlob'

const OBJECT_URL = 'blob:mock-download'

let clickSpy: MockInstance<HTMLAnchorElement['click']>

beforeEach(() => {
  vi.useFakeTimers()
  URL.createObjectURL = vi.fn(() => OBJECT_URL)
  URL.revokeObjectURL = vi.fn()
  // jsdom не умеет навигацию по `download`-ссылке — клик только считаем.
  clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
})

afterEach(() => {
  vi.runOnlyPendingTimers()
  vi.useRealTimers()
  clickSpy.mockRestore()
  document.body.replaceChildren()
})

function downloadLinks() {
  return document.body.querySelectorAll<HTMLAnchorElement>('a[download]')
}

describe('downloadBlob', () => {
  it('кликает по скрытой ссылке с именем файла и blob-URL', () => {
    const blob = new Blob(['id,sum'], { type: 'text/csv' })
    downloadBlob(blob, 'export.csv')

    expect(URL.createObjectURL).toHaveBeenCalledWith(blob)
    expect(clickSpy).toHaveBeenCalledTimes(1)
    const [link] = downloadLinks()
    expect(link.download).toBe('export.csv')
    expect(link.getAttribute('href')).toBe(OBJECT_URL)
    expect(link.style.visibility).toBe('hidden')
  })

  it('не отзывает URL и не убирает ссылку сразу после клика', () => {
    downloadBlob(new Blob(['x']), 'a.xlsx')

    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    expect(downloadLinks()).toHaveLength(1)

    vi.advanceTimersByTime(DOWNLOAD_URL_TTL_MS - 1)
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    expect(downloadLinks()).toHaveLength(1)
  })

  it('через минуту отзывает URL и убирает ссылку', () => {
    expect(DOWNLOAD_URL_TTL_MS).toBe(60_000)
    downloadBlob(new Blob(['x']), 'a.xlsx')

    vi.advanceTimersByTime(DOWNLOAD_URL_TTL_MS)

    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(OBJECT_URL)
    expect(downloadLinks()).toHaveLength(0)
  })

  it('каждое скачивание отзывает свой URL', () => {
    vi.mocked(URL.createObjectURL)
      .mockReturnValueOnce('blob:first')
      .mockReturnValueOnce('blob:second')

    downloadBlob(new Blob(['1']), 'one.csv')
    vi.advanceTimersByTime(10_000)
    downloadBlob(new Blob(['2']), 'two.csv')
    expect(downloadLinks()).toHaveLength(2)

    vi.advanceTimersByTime(DOWNLOAD_URL_TTL_MS - 10_000)
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:first')
    expect(downloadLinks()).toHaveLength(1)

    vi.advanceTimersByTime(10_000)
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2)
    expect(URL.revokeObjectURL).toHaveBeenLastCalledWith('blob:second')
    expect(downloadLinks()).toHaveLength(0)
  })

  it('отложенная уборка не падает, если страница уже убрала ссылку сама', () => {
    downloadBlob(new Blob(['x']), 'a.csv')
    document.body.replaceChildren()

    expect(() => vi.advanceTimersByTime(DOWNLOAD_URL_TTL_MS)).not.toThrow()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(OBJECT_URL)
  })

  it('сбой revoke через минуту не всплывает необработанной ошибкой', () => {
    vi.mocked(URL.revokeObjectURL).mockImplementation(() => {
      throw new Error('revoke unavailable')
    })
    downloadBlob(new Blob(['x']), 'a.csv')

    expect(() => vi.advanceTimersByTime(DOWNLOAD_URL_TTL_MS)).not.toThrow()
    expect(downloadLinks()).toHaveLength(0)
  })
})
