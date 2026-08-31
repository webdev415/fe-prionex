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
/** Токен мозга — `secrets.token_urlsafe(12)`, ровно 16 символов. */
const TOKEN = 'HcQ2vN8pLr4xTb_e'

/** The bridge answers with a Blob; the component turns it into an object URL. */
function respondWithBlob(type = 'image/png') {
  mockGet.mockResolvedValue({ data: new Blob(['binary'], { type }) })
}

/** The gateway's failure envelope: `{"detail": {"code", "message"}}` as a Blob. */
function respondWithError(code: string, status = 404) {
  mockGet.mockRejectedValue({
    response: {
      status,
      data: new Blob([JSON.stringify({ detail: { code, message: 'что-то пошло не так' } })], {
        type: 'application/json',
      }),
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  URL.createObjectURL = vi.fn(() => 'blob:mock-file')
  URL.revokeObjectURL = vi.fn()
})

describe('MarkdownMessage — предпросмотр графиков ассистента', () => {
  it('канонический путь мозга уходит на CRM-эндпоинт файлов, а не на текущий URL', async () => {
    respondWithBlob()
    render(
      <MarkdownMessage>{`![Графік платежів](/api/files/${TOKEN}/payments_2026.png)`}</MarkdownMessage>
    )

    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    expect(mockGet).toHaveBeenCalledWith(
      `${FILES}/${TOKEN}/payments_2026.png`,
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
    render(<MarkdownMessage>{`![](/api/files/${TOKEN}/chart.png)`}</MarkdownMessage>)

    expect(await screen.findByRole('img', { name: 'chart.png' })).toBeInTheDocument()
  })

  it('клик по картинке открывает крупный просмотр', async () => {
    respondWithBlob()
    render(<MarkdownMessage>{`![Графік](/api/files/${TOKEN}/payments_2026.png)`}</MarkdownMessage>)

    expect(screen.queryByTestId('assistant-file-preview-modal')).not.toBeInTheDocument()

    fireEvent.click(await screen.findByTestId('assistant-image'))

    expect(await screen.findByTestId('assistant-file-preview-modal')).toBeInTheDocument()
    expect(await screen.findByRole('img', { name: 'payments_2026.png' })).toBeInTheDocument()
  })

  it('битая картинка даёт плейсхолдер, а не сломанную иконку', async () => {
    mockGet.mockRejectedValue(new Error('сеть отвалилась'))
    render(<MarkdownMessage>{`![Графік](/api/files/${TOKEN}/gone.png)`}</MarkdownMessage>)

    const placeholder = await screen.findByTestId('assistant-image-placeholder')
    expect(placeholder).toHaveTextContent('Could not load the image “Графік”')
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('код ошибки шлюза превращается в осмысленную фразу, а не в общее «не удалось»', async () => {
    respondWithError('file_too_large', 413)
    render(<MarkdownMessage>{`![Графік](/api/files/${TOKEN}/huge.png)`}</MarkdownMessage>)

    const placeholder = await screen.findByTestId('assistant-image-placeholder')
    expect(placeholder).toHaveTextContent('The file is too large to open here')
  })
})

describe('MarkdownMessage — модель потеряла токен', () => {
  it('`![](payments_2026.png)` без токена не даёт битой картинки и не шлёт запрос', () => {
    // Симптом из задачи. Токен — это capability: без него скачивать нечего,
    // подставлять роут под голое имя нельзя (отдало бы чужие выгрузки).
    render(<MarkdownMessage>{'![Графік](payments_2026.png)'}</MarkdownMessage>)

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(mockGet).not.toHaveBeenCalled()

    const card = screen.getByTestId('assistant-unresolvable-ref')
    expect(card).toHaveTextContent('Графік')
    expect(card).toHaveTextContent('ask the assistant to send it again')
  })

  it('ссылка без токена оставляет текст, но не создаёт ссылку', () => {
    render(<MarkdownMessage>{'[Завантажити звіт](payments_2026.xlsx)'}</MarkdownMessage>)

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.queryByTestId('assistant-file-card')).not.toBeInTheDocument()
    expect(screen.getByText('Завантажити звіт')).toBeInTheDocument()
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

  it('ссылка на чужой эндпоинт CRM не превращается в запрос', () => {
    render(<MarkdownMessage>{'[Клієнти](/api/v1/clients/1)'}</MarkdownMessage>)

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(mockGet).not.toHaveBeenCalled()
    expect(screen.getByText('Клієнти')).toBeInTheDocument()
  })
})

describe('MarkdownMessage — выгрузки показываются карточкой', () => {
  it('ссылка на xlsx рендерится карточкой с именем, а не голым URL', () => {
    render(
      <MarkdownMessage>{`[Завантажити звіт](/api/files/${TOKEN}/payments_2026.xlsx)`}</MarkdownMessage>
    )

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
    render(<MarkdownMessage>{`[Виписка](/api/files/${TOKEN}/export.csv)`}</MarkdownMessage>)

    fireEvent.click(screen.getByTestId('assistant-file-card'))

    await waitFor(() =>
      expect(mockGet).toHaveBeenCalledWith(
        `${FILES}/${TOKEN}/export.csv`,
        expect.objectContaining({ responseType: 'blob' })
      )
    )
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledWith(blob, 'export.csv'))
  })

  it('сорванное скачивание сообщает об ошибке в самой карточке', async () => {
    respondWithError('file_not_found')
    render(<MarkdownMessage>{`[Виписка](/api/files/${TOKEN}/export.csv)`}</MarkdownMessage>)

    fireEvent.click(screen.getByTestId('assistant-file-card'))

    expect(await screen.findByText('The file is no longer available')).toBeInTheDocument()
    expect(downloadBlob).not.toHaveBeenCalled()
  })

  it('pdf открывается предпросмотром в модалке, а не скачиванием', async () => {
    respondWithBlob('application/pdf')
    render(<MarkdownMessage>{`[Акт звірки](/api/files/${TOKEN}/act.pdf)`}</MarkdownMessage>)

    const card = screen.getByTestId('assistant-file-card')
    expect(card).toHaveAttribute('data-file-kind', 'pdf')
    fireEvent.click(card)

    expect(await screen.findByTestId('assistant-file-preview-modal')).toBeInTheDocument()
    expect(downloadBlob).not.toHaveBeenCalled()
  })

  it('картинка, присланная ссылкой (а не ![]), тоже становится карточкой', () => {
    render(<MarkdownMessage>{`[Графік](/api/files/${TOKEN}/chart.png)`}</MarkdownMessage>)

    expect(screen.getByTestId('assistant-file-card')).toHaveAttribute('data-file-kind', 'image')
    expect(mockGet).not.toHaveBeenCalled()
  })
})
