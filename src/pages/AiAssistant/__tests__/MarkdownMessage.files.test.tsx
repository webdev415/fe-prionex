import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MarkdownMessage } from '../MarkdownMessage'
import { api } from '@/lib/api'
import { downloadBlob } from '@/features/messaging/utils/downloadBlob'

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, api: { get: vi.fn() } }
})

vi.mock('@/features/messaging/utils/downloadBlob', () => ({
  downloadBlob: vi.fn(),
}))

const mockGet = vi.mocked(api.get)
const FILES = 'https://api.dev.crm-prionex.online/api/v1/ai-assistant/files'

/** The bridge answers with a Blob; the component turns it into an object URL. */
function respondWithBlob(type = 'image/png') {
  mockGet.mockResolvedValue({ data: new Blob(['binary'], { type }) })
}

beforeEach(() => {
  vi.clearAllMocks()
  URL.createObjectURL = vi.fn(() => 'blob:mock-file')
  URL.revokeObjectURL = vi.fn()
})

describe('MarkdownMessage — предпросмотр графиков ассистента', () => {
  it('относительный путь картинки уходит на CRM-эндпоинт файлов, а не на текущий URL', async () => {
    respondWithBlob()
    render(<MarkdownMessage>{'![Графік платежів](a1b2c3/payments_2026.png)'}</MarkdownMessage>)

    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    expect(mockGet).toHaveBeenCalledWith(
      `${FILES}/a1b2c3/payments_2026.png`,
      expect.objectContaining({ responseType: 'blob' })
    )

    const image = await screen.findByRole('img', { name: 'Графік платежів' })
    // Картинка живёт на blob-URL: запрос ушёл через авторизованный клиент,
    // а не голым <img src>, который не носит Bearer-токен и получил бы 401.
    expect(image).toHaveAttribute('src', 'blob:mock-file')
    expect(image).toHaveAttribute('loading', 'lazy')
  })

  it('подставляет имя файла в alt, когда модель его не написала', async () => {
    respondWithBlob()
    render(<MarkdownMessage>{'![](a1b2c3/chart.png)'}</MarkdownMessage>)

    expect(await screen.findByRole('img', { name: 'chart.png' })).toBeInTheDocument()
  })

  it('клик по картинке открывает крупный просмотр', async () => {
    respondWithBlob()
    render(<MarkdownMessage>{'![Графік](a1b2c3/payments_2026.png)'}</MarkdownMessage>)

    expect(screen.queryByTestId('assistant-file-preview-modal')).not.toBeInTheDocument()

    fireEvent.click(await screen.findByTestId('assistant-image'))

    const modal = await screen.findByTestId('assistant-file-preview-modal')
    expect(modal).toBeInTheDocument()
    expect(await screen.findByRole('img', { name: 'payments_2026.png' })).toBeInTheDocument()
  })

  it('битая картинка даёт плейсхолдер, а не сломанную иконку', async () => {
    mockGet.mockRejectedValue(new Error('404 — токен протух'))
    render(<MarkdownMessage>{'![Графік](a1b2c3/gone.png)'}</MarkdownMessage>)

    const placeholder = await screen.findByTestId('assistant-image-placeholder')
    expect(placeholder).toHaveTextContent('Could not load the image “Графік”')
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})

describe('MarkdownMessage — внешние ссылки не загружаются как картинки', () => {
  it.each([
    ['https', '![tracker](https://evil.tld/pixel.png)'],
    ['протокол-относительная', '![tracker](//evil.tld/pixel.png)'],
  ])('%s: <img> не рендерится и запрос не уходит', async (_label, markdown) => {
    render(<MarkdownMessage>{markdown}</MarkdownMessage>)

    // Ничего не грузим: иначе чужой хост узнал бы, что оператор прочитал ответ.
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(mockGet).not.toHaveBeenCalled()

    const link = screen.getByTestId('assistant-external-link')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveTextContent('tracker')
  })

  it('data:-картинка не рендерится и не превращается в ссылку', () => {
    render(<MarkdownMessage>{'![x](data:image/png;base64,iVBORw0KGgo=)'}</MarkdownMessage>)

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.queryByTestId('assistant-external-link')).not.toBeInTheDocument()
    expect(screen.getByTestId('assistant-blocked-ref')).toBeInTheDocument()
  })

  it('javascript:-ссылка теряет href, но текст остаётся', () => {
    render(<MarkdownMessage>{'[Натисни](javascript:alert(1))'}</MarkdownMessage>)

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByText('Натисни')).toBeInTheDocument()
  })
})

describe('MarkdownMessage — выгрузки показываются карточкой', () => {
  it('ссылка на xlsx рендерится карточкой с именем, а не голым URL', () => {
    render(<MarkdownMessage>{'[Завантажити звіт](a1b2c3/payments_2026.xlsx)'}</MarkdownMessage>)

    const card = screen.getByTestId('assistant-file-card')
    expect(card).toHaveAttribute('data-file-kind', 'sheet')
    expect(card).toHaveTextContent('Завантажити звіт')
    expect(card).toHaveTextContent('Download')
    // Ничего не тянем, пока оператор не нажал.
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('клик по карточке скачивает файл через авторизованный клиент', async () => {
    const blob = new Blob(['id,sum'], { type: 'text/csv' })
    mockGet.mockResolvedValue({ data: blob })
    render(<MarkdownMessage>{'[Виписка](a1b2c3/export.csv)'}</MarkdownMessage>)

    fireEvent.click(screen.getByTestId('assistant-file-card'))

    await waitFor(() =>
      expect(mockGet).toHaveBeenCalledWith(
        `${FILES}/a1b2c3/export.csv`,
        expect.objectContaining({ responseType: 'blob' })
      )
    )
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledWith(blob, 'export.csv'))
  })

  it('сорванное скачивание сообщает об ошибке в самой карточке', async () => {
    mockGet.mockRejectedValue(new Error('503'))
    render(<MarkdownMessage>{'[Виписка](a1b2c3/export.csv)'}</MarkdownMessage>)

    fireEvent.click(screen.getByTestId('assistant-file-card'))

    expect(await screen.findByText('Download failed — try again')).toBeInTheDocument()
    expect(downloadBlob).not.toHaveBeenCalled()
  })

  it('pdf открывается предпросмотром в модалке, а не скачиванием', async () => {
    respondWithBlob('application/pdf')
    render(<MarkdownMessage>{'[Акт звірки](a1b2c3/act.pdf)'}</MarkdownMessage>)

    const card = screen.getByTestId('assistant-file-card')
    expect(card).toHaveAttribute('data-file-kind', 'pdf')
    fireEvent.click(card)

    expect(await screen.findByTestId('assistant-file-preview-modal')).toBeInTheDocument()
    expect(downloadBlob).not.toHaveBeenCalled()
  })

  it('картинка, присланная ссылкой (а не ![]), тоже становится карточкой', () => {
    render(<MarkdownMessage>{'[Графік](a1b2c3/chart.png)'}</MarkdownMessage>)

    expect(screen.getByTestId('assistant-file-card')).toHaveAttribute('data-file-kind', 'image')
    expect(mockGet).not.toHaveBeenCalled()
  })
})
