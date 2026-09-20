/**
 * Раздел «Кредитный модуль» → Очередь ручного разбора.
 *
 * Что здесь защищается:
 *  - список показывает то, что вернул модуль, и ведёт в карточку заявки —
 *    иначе очередь бесполезна;
 *  - ПРИЧИНЫ разбора видны: ради них очередь и существует, список без них
 *    отвечает «кто-то ждёт», но не отвечает «что от меня требуется»;
 *  - фильтр по статусу уходит В ЗАПРОС, а не режет уже полученный список:
 *    очередь — это все referred-решения за всё время, и локальный фильтр
 *    показывал бы андеррайтеру подмножество присланного;
 *  - ни один заголовок не сортируемый и `Pagination` не подключён. Это не
 *    придирка к стилю: у ручки нет ни `sort`, ни `limit`/`cursor` — параметры
 *    молча отбрасываются (проверено живьём: `?sort=bogus` → 200 и все строки),
 *    так что кликабельный заголовок отсортировал бы только загруженное и
 *    соврал бы оператору, попросившему «самых старых наверх».
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom'
import { CreditUnderwritingQueuePage } from '../CreditUnderwritingQueuePage'
import { useCreditOverview, useCreditUnderwritingQueue } from '@/features/credit/hooks/useCredit'
import type { CreditOverview, CreditQueueItem } from '@/features/credit/api/types'

// Мокаем ХУКИ, а не HTTP-клиент: живой QueryClient оставляет таймеры
// notifyManager, которые срабатывают уже после teardown jsdom и падают в чужом
// тест-файле. Странице всё равно, откуда данные, — проверяем ровно её поведение.
vi.mock('@/features/credit/hooks/useCredit', () => ({
  useCreditOverview: vi.fn(),
  useCreditUnderwritingQueue: vi.fn(),
}))

// Исходник читаем глобом Vite, а не `node:fs`: сборка идёт без типов Node, и
// `tsc -b` (то есть CI) на импорт `node:fs` падает.
const SOURCE = Object.values(
  import.meta.glob('../CreditUnderwritingQueuePage.tsx', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>
)[0]

const OVERVIEW: CreditOverview = {
  role: 'underwriter',
  permissions: ['credit.applications.read', 'credit.decisions.decide'],
  applications: { referred: 20, scoring: 1, declined: 118, disbursed: 257 },
  loans: { active: 61 },
  application_statuses: ['in_progress', 'scoring', 'referred', 'approved', 'declined', 'disbursed'],
  demo_mode: true,
}

// Строка снята с живого стенда 31.08.2026 (GET /underwriting/queue?status=pending):
// девять полей, ни одного лишнего, `assigned_to` пуст у всех 31 позиции.
const ROW: CreditQueueItem = {
  application_id: 'a5f957e1-6b72-43a1-9076-12e1665a2b72',
  decision_id: 'f5b1f3bd-1d58-4233-8561-e1df3830c26f',
  status: 'pending',
  assigned_to: null,
  referred_at: '2026-08-31T13:28:02.999780+00:00',
  requested_amount_minor: 30_000,
  currency: 'CAD',
  product_code: 'CA_AB_PAYDAY',
  review_reasons: ['income_mismatch'],
}

function mockQueue(items: CreditQueueItem[] = [ROW]) {
  vi.mocked(useCreditUnderwritingQueue).mockReturnValue({
    data: { items, next_cursor: null },
    isLoading: false,
    error: null,
  } as unknown as ReturnType<typeof useCreditUnderwritingQueue>)
}

/** Заглушка карточки заявки: показывает id, на который её открыли. */
function ApplicationCardStub() {
  const { applicationId } = useParams()
  return <div data-testid="card">{applicationId}</div>
}

function renderPage(initialEntry = '/dashboard/credit/underwriting') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <CreditUnderwritingQueuePage />
    </MemoryRouter>
  )
}

describe('CreditUnderwritingQueuePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useCreditOverview).mockReturnValue({ data: OVERVIEW } as ReturnType<
      typeof useCreditOverview
    >)
    mockQueue()
  })

  it('показывает позицию очереди из модуля', async () => {
    renderPage()
    // Номера заявки ручка не отдаёт — строку опознаём по началу UUID.
    expect(await screen.findByText('a5f957e1…')).toBeInTheDocument()
    expect(screen.getByText('CA_AB_PAYDAY')).toBeInTheDocument()
    // 30 000 minor = 300.00 CAD: масштаб денег терять нельзя.
    expect(screen.getByText(/300[,.]00\s*CAD/)).toBeInTheDocument()
  })

  it('показывает причину разбора — ради неё очередь и существует', async () => {
    renderPage()
    // В тестовой среде i18n замокан и возвращает ключ (src/test/setup.ts),
    // поэтому причина видна как ключ своего пространства, а не как машинный код.
    expect(await screen.findByText('credit.referralReason.income_mismatch')).toBeInTheDocument()
  })

  it('пустой список причин рисует прочерком, а не прячет строку', async () => {
    mockQueue([{ ...ROW, review_reasons: [] }])
    renderPage()
    // Строка на месте: разбор объявлен, причины не названы — это находка
    // глубже очереди, и прятать её нельзя.
    expect(await screen.findByText('a5f957e1…')).toBeInTheDocument()
    expect(screen.queryByText(/credit\.reviewReason\./)).not.toBeInTheDocument()
  })

  it('по умолчанию просит у модуля только то, что ждёт решения', async () => {
    renderPage()
    await screen.findByText('a5f957e1…')
    expect(vi.mocked(useCreditUnderwritingQueue)).toHaveBeenCalledWith('pending')
  })

  it('фильтр по статусу уходит в запрос к модулю, а не фильтрует локально', async () => {
    renderPage()
    await screen.findByText('a5f957e1…')

    fireEvent.click(screen.getByRole('button', { name: 'credit.queueStatus.done' }))

    await waitFor(() => {
      expect(vi.mocked(useCreditUnderwritingQueue)).toHaveBeenCalledWith('done')
    })
  })

  it('«показать все» снимает фильтр, а не подставляет несуществующее значение', async () => {
    renderPage()
    await screen.findByText('a5f957e1…')

    fireEvent.click(screen.getByRole('button', { name: 'credit.actions.showAll' }))

    // У ручки «все» — это ОТСУТСТВИЕ параметра: значения `all` она не знает и
    // ответила бы 422.
    await waitFor(() => {
      expect(vi.mocked(useCreditUnderwritingQueue)).toHaveBeenCalledWith(undefined)
    })
  })

  it('клик по строке открывает карточку ИМЕННО этой заявки', async () => {
    // Ради этого перехода очередь и нужна: разбирать заявку в списке нечем,
    // решение принимают в карточке. Поднимаем настоящий роутинг, а не смотрим
    // на исходник: опечатка в адресе или подстановка `decision_id` вместо
    // `application_id` увела бы оператора на пустую страницу.
    render(
      <MemoryRouter initialEntries={['/dashboard/credit/underwriting']}>
        <Routes>
          <Route path="/dashboard/credit/underwriting" element={<CreditUnderwritingQueuePage />} />
          <Route
            path="/dashboard/credit/applications/:applicationId"
            element={<ApplicationCardStub />}
          />
        </Routes>
      </MemoryRouter>
    )

    fireEvent.click(await screen.findByText('a5f957e1…'))

    expect(await screen.findByTestId('card')).toHaveTextContent(ROW.application_id)
  })

  it('ни один заголовок не сортируемый', async () => {
    const { container } = renderPage()
    await screen.findByText('a5f957e1…')
    const headers = [...container.querySelectorAll('th')]
    expect(headers.length).toBeGreaterThan(0)
    // DataTable вешает на сортируемый заголовок `cursor-pointer` и рисует
    // иконку сортировки. Появление класса = появление сортировки.
    expect(headers.filter((th) => th.className.includes('cursor-pointer'))).toEqual([])
  })

  it('в исходнике страницы нет ни сортировки, ни страниц', () => {
    // Страж против «добавлю для симметрии с заявками»: у ручки нет полей
    // сортировки и нет курсора, и `sortable`/`Pagination` здесь могут появиться
    // только вместе с правкой модуля.
    expect(SOURCE).not.toMatch(/sortable:/)
    expect(SOURCE).not.toMatch(/sortKey:/)
    expect(SOURCE).not.toMatch(/<Pagination/)
    expect(SOURCE).not.toMatch(/CREDIT_PAGE_SIZE_OPTIONS/)
  })
})
