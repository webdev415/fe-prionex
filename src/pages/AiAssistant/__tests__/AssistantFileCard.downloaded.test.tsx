/**
 * fb28-file-card-downloaded: карточка выгрузки ассистента после удачного
 * скачивания сама говорит «Передано браузеру ✓» (не «Завантажено»: страница
 * знает только, что отдала файл браузеру) и где искать — загрузки браузера или
 * папка «Завантаження», а повторное нажатие в первые секунды не качает файл
 * молча ещё раз, а подсказывает и предлагает «Завантажити ще раз» явно
 * (prod-188: 17 нажатий за 10 с, все 200).
 *
 * Тексты — настоящие строки en/common.json (englishI18n), а не ключи: проверяем,
 * что человек увидит, и что ключи в словаре есть.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AssistantFileCard, FILE_REPEAT_GUARD_MS } from '../AssistantFileAttachment'
import { api } from '@/lib/api'
import { downloadBlob } from '@/features/messaging/utils/downloadBlob'

vi.mock('react-i18next', async () => (await import('@/test/englishI18n')).englishReactI18nextMock())

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api')
  return { ...actual, api: { get: vi.fn() } }
})

vi.mock('@/features/messaging/utils/downloadBlob', () => ({
  downloadBlob: vi.fn(),
}))

const mockGet = vi.mocked(api.get)
const URL_ =
  'https://api.dev.crm-prionex.online/api/v1/ai-assistant/files/HcQ2vN8pLr4xTb_e/export.xlsx'
const NAME = 'export.xlsx'
const T0 = new Date('2026-09-28T11:17:55Z').getTime()

const DOWNLOADED = 'Sent to browser ✓'
const HINT = 'If the file is missing, check your browser downloads (Ctrl+J) or the Downloads folder'
const ALREADY =
  'The file was already sent to the browser. If it is missing, check your browser downloads (Ctrl+J) or the Downloads folder'
const AGAIN = 'Download again'
const FAILED = 'Download failed — try again'

function renderCard() {
  return render(<AssistantFileCard url={URL_} name={NAME} kind="sheet" label="Угоди з 0 касань" />)
}

function card() {
  return screen.getByTestId('assistant-file-card')
}

/** Всегда присутствующая live-область: её текст и слышит скринридер. */
function live() {
  return screen.getByTestId('assistant-file-live')
}

async function downloadOnce() {
  fireEvent.click(card())
  await waitFor(() => expect(card()).toHaveAttribute('data-download-state', 'downloaded'))
}

beforeEach(() => {
  vi.clearAllMocks()
  // Только часы: промисы и таймеры waitFor остаются настоящими.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(T0)
  mockGet.mockResolvedValue({ data: new Blob(['xlsx'], { type: 'application/octet-stream' }) })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('AssistantFileCard — видимый итог скачивания', () => {
  it('до нажатия карточка предлагает скачать и ничего не тянет', () => {
    renderCard()
    expect(card()).toHaveTextContent('Download')
    expect(card()).not.toHaveAttribute('data-download-state')
    expect(screen.queryByText(DOWNLOADED)).not.toBeInTheDocument()
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('после удачного скачивания показывает «Передано браузеру ✓» и где искать файл', async () => {
    renderCard()
    await downloadOnce()

    expect(downloadBlob).toHaveBeenCalledTimes(1)
    expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), NAME)
    expect(screen.getByTestId('assistant-file-downloaded')).toHaveTextContent(DOWNLOADED)
    expect(card()).toHaveTextContent(HINT)
    expect(card()).not.toBeDisabled()
    // Скринридер слышит итог из live-области, которая была в DOM ещё до клика.
    expect(live()).toHaveAttribute('role', 'status')
    expect(live()).toHaveTextContent(DOWNLOADED)
  })

  it('состояние «Завантажено» держится, а не гаснет через мгновение', async () => {
    const { rerender } = renderCard()
    await downloadOnce()

    vi.setSystemTime(T0 + 10 * 60_000)
    // Ререндер ответа (стрим, новый ход в разговоре) не должен сбросить итог.
    rerender(<AssistantFileCard url={URL_} name={NAME} kind="sheet" label="Угоди з 0 касань" />)

    expect(card()).toHaveAttribute('data-download-state', 'downloaded')
    expect(screen.getByTestId('assistant-file-downloaded')).toHaveTextContent(DOWNLOADED)
    expect(card()).toHaveTextContent(HINT)
  })

  it('повторное нажатие в первые секунды не качает молча, а подсказывает', async () => {
    renderCard()
    await downloadOnce()

    vi.setSystemTime(T0 + 2_000)
    fireEvent.click(card())
    fireEvent.click(card())

    const hint = await screen.findByTestId('assistant-file-repeat-hint')
    expect(hint).toHaveTextContent(ALREADY)
    // Объявляет подсказку постоянная live-область, а не сама подсказка,
    // появившаяся уже с текстом (такие NVDA/JAWS часто пропускают).
    expect(hint).not.toHaveAttribute('role')
    expect(live()).toHaveTextContent(ALREADY)
    expect(mockGet).toHaveBeenCalledTimes(1)
    expect(downloadBlob).toHaveBeenCalledTimes(1)
    // Подсказка не вложена в кнопку карточки (кнопка в кнопке — невалидный DOM).
    expect(card()).not.toContainElement(hint)
  })

  it('«Завантажити ще раз» скачивает явно и убирает подсказку', async () => {
    renderCard()
    await downloadOnce()

    vi.setSystemTime(T0 + 3_000)
    fireEvent.click(card())
    fireEvent.click(await screen.findByRole('button', { name: AGAIN }))

    await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(2))
    expect(mockGet).toHaveBeenCalledTimes(2)
    await waitFor(() =>
      expect(screen.queryByTestId('assistant-file-repeat-hint')).not.toBeInTheDocument()
    )
    expect(card()).toHaveAttribute('data-download-state', 'downloaded')
  })

  it('«Завантажити ще раз» оставляет фокус на карточке, а не роняет его в body', async () => {
    renderCard()
    await downloadOnce()

    vi.setSystemTime(T0 + 3_000)
    fireEvent.click(card())
    const again = await screen.findByRole('button', { name: AGAIN })
    again.focus()
    fireEvent.click(again)

    // Кнопка «ещё раз» уходит из DOM вместе с подсказкой — фокус уже на карточке.
    expect(card()).toHaveFocus()
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(2))
    await waitFor(() =>
      expect(screen.queryByTestId('assistant-file-repeat-hint')).not.toBeInTheDocument()
    )
    expect(card()).toHaveFocus()
  })

  it('двойное нажатие во время запроса тянет файл один раз', async () => {
    let release: (value: unknown) => void = () => {}
    mockGet.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve
        }) as never
    )
    renderCard()

    fireEvent.click(card())
    fireEvent.click(card())

    expect(card()).toBeDisabled()
    expect(mockGet).toHaveBeenCalledTimes(1)
    // Пока идёт запрос, live-область пуста — следующий успех объявится заново.
    expect(live()).toBeEmptyDOMElement()

    release({ data: new Blob(['xlsx'], { type: 'application/octet-stream' }) })
    await waitFor(() => expect(card()).toHaveAttribute('data-download-state', 'downloaded'))
    expect(mockGet).toHaveBeenCalledTimes(1)
    expect(downloadBlob).toHaveBeenCalledTimes(1)
    expect(live()).toHaveTextContent(DOWNLOADED)
  })

  it('после окна повторное нажатие снова просто скачивает', async () => {
    renderCard()
    await downloadOnce()

    vi.setSystemTime(T0 + FILE_REPEAT_GUARD_MS + 1)
    fireEvent.click(card())

    await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(2))
    expect(screen.queryByTestId('assistant-file-repeat-hint')).not.toBeInTheDocument()
  })

  it('окно отсчитывается от последнего удачного скачивания', async () => {
    renderCard()
    await downloadOnce()

    vi.setSystemTime(T0 + FILE_REPEAT_GUARD_MS + 1)
    fireEvent.click(card())
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledTimes(2))

    vi.setSystemTime(T0 + FILE_REPEAT_GUARD_MS + 2_000)
    fireEvent.click(card())

    expect(await screen.findByTestId('assistant-file-repeat-hint')).toBeInTheDocument()
    expect(downloadBlob).toHaveBeenCalledTimes(2)
  })
})

describe('AssistantFileCard — ошибка скачивания как раньше', () => {
  it('сорванное скачивание пишет «Не вдалося завантажити» и не ставит «Передано»', async () => {
    mockGet.mockRejectedValue(new Error('Network Error'))
    renderCard()

    fireEvent.click(card())

    expect(await screen.findByText(FAILED)).toBeInTheDocument()
    expect(card()).not.toHaveAttribute('data-download-state')
    expect(screen.queryByText(DOWNLOADED)).not.toBeInTheDocument()
    expect(downloadBlob).not.toHaveBeenCalled()
  })

  it('после ошибки следующее нажатие пробует сразу, без подсказки-сторожа', async () => {
    mockGet.mockRejectedValueOnce(new Error('Network Error'))
    renderCard()

    fireEvent.click(card())
    await screen.findByText(FAILED)

    fireEvent.click(card())
    await waitFor(() => expect(card()).toHaveAttribute('data-download-state', 'downloaded'))
    expect(screen.queryByText(FAILED)).not.toBeInTheDocument()
    expect(screen.queryByTestId('assistant-file-repeat-hint')).not.toBeInTheDocument()
  })

  it('сорванное «Завантажити ще раз» снимает «Передано» и показывает ошибку', async () => {
    renderCard()
    await downloadOnce()

    mockGet.mockRejectedValueOnce(new Error('Network Error'))
    vi.setSystemTime(T0 + 1_000)
    fireEvent.click(card())
    fireEvent.click(await screen.findByRole('button', { name: AGAIN }))

    expect(await screen.findByText(FAILED)).toBeInTheDocument()
    expect(card()).not.toHaveAttribute('data-download-state')
    expect(screen.queryByTestId('assistant-file-repeat-hint')).not.toBeInTheDocument()
  })
})
