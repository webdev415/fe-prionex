/**
 * Раздел «Кредитный модуль» → Заявки.
 *
 * Что здесь защищается:
 *  - список показывает то, что вернул модуль, и ведёт в карточку (иначе очередь
 *    бесполезна);
 *  - фильтр по статусу уходит в запрос, а не фильтрует локально: страниц много,
 *    локальная фильтрация показывала бы верификатору неполную очередь;
 *  - метрики считаются из сводки, а не выдумываются нулями;
 *  - колонка шага появляется по данным модуля, а не по релизу фронта.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CreditApplicationsPage } from '../CreditApplicationsPage'
import { useCreditApplications, useCreditOverview } from '@/features/credit/hooks/useCredit'
import type { CreditApplicationSummary, CreditOverview } from '@/features/credit/api/types'

// Мокаем ХУКИ, а не HTTP-клиент: живой QueryClient оставляет таймеры
// notifyManager, которые срабатывают уже после teardown jsdom и падают в
// чужом тест-файле («window is not defined»). Странице всё равно, откуда
// данные, — проверяем ровно её поведение.
vi.mock('@/features/credit/hooks/useCredit', () => ({
  useCreditOverview: vi.fn(),
  useCreditApplications: vi.fn(),
}))

const OVERVIEW: CreditOverview = {
  role: 'underwriter',
  permissions: ['credit.applications.read', 'credit.decisions.decide'],
  roles_available: ['verifier', 'underwriter', 'risk_manager'],
  applications: { referred: 2, scoring: 1, declined: 118, disbursed: 257 },
  loans: { active: 61 },
  application_statuses: ['in_progress', 'scoring', 'referred', 'approved', 'declined', 'disbursed'],
  demo_mode: true,
}

const ROW: CreditApplicationSummary = {
  application_id: '11111111-2222-3333-4444-555555555555',
  number: 'DEMO-202608-03A17C',
  status: 'referred',
  product_code: 'CA_AB_PAYDAY',
  channel: 'site',
  jurisdiction: 'CA-AB',
  currency: 'CAD',
  requested_amount_minor: 90_000,
  client_email: 'marie.tremblay@example.ca',
  created_at: '2026-08-29T09:00:00Z',
  updated_at: '2026-08-29T09:05:00Z',
  decision_outcome: 'referred',
  decision_mode: 'automatic',
  final_amount_minor: null,
}

function renderPage(initialEntry = '/dashboard/credit/applications') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <CreditApplicationsPage />
    </MemoryRouter>
  )
}

describe('CreditApplicationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useCreditOverview).mockReturnValue({ data: OVERVIEW } as ReturnType<
      typeof useCreditOverview
    >)
    vi.mocked(useCreditApplications).mockReturnValue({
      data: { items: [ROW], next_cursor: null, total: 1 },
      isLoading: false,
      error: null,
    } as ReturnType<typeof useCreditApplications>)
  })

  it('показывает заявку из модуля', async () => {
    renderPage()
    expect(await screen.findByText('DEMO-202608-03A17C')).toBeInTheDocument()
    expect(screen.getByText('marie.tremblay@example.ca')).toBeInTheDocument()
    // 90 000 minor = 900.00 CAD: форматирование денег не должно терять масштаб
    expect(screen.getByText(/900[,.]00\s*CAD/)).toBeInTheDocument()
  })

  it('фильтр по статусу уходит в запрос к модулю, а не фильтрует локально', async () => {
    renderPage()
    await screen.findByText('DEMO-202608-03A17C')

    // В тестовой среде i18n замокан и возвращает ключ (см. src/test/setup.ts),
    // поэтому ищем кнопку по ключу перевода, а не по русскому/английскому тексту.
    fireEvent.click(screen.getByRole('button', { name: 'credit.status.referred' }))

    await waitFor(() => {
      expect(vi.mocked(useCreditApplications)).toHaveBeenCalledWith(
        expect.objectContaining({ status: ['referred'] })
      )
    })
  })

  it('метрики берутся из сводки модуля', async () => {
    renderPage()
    await screen.findByText('DEMO-202608-03A17C')
    // счётчик статуса «ручной разбор» из overview
    expect(await screen.findByText('2')).toBeInTheDocument()
  })

  // Колонка шага. Модуль начал отдавать `resume_step` в сводке позже самого
  // раздела, поэтому колонка обязана появляться ПО ДАННЫМ, а не по релизу
  // фронта: столбец из одних прочерков хуже отсутствующего.
  it('колонки шага нет, пока модуль шаг не отдаёт', async () => {
    renderPage()
    await screen.findByText('DEMO-202608-03A17C')
    expect(screen.queryByText('credit.columns.step')).not.toBeInTheDocument()
  })

  it('колонка шага появляется сама, как только шаг приходит', async () => {
    vi.mocked(useCreditApplications).mockReturnValue({
      data: {
        items: [{ ...ROW, status: 'in_progress', resume_step: 'bank_verification' }],
        next_cursor: null,
        total: 1,
      },
      isLoading: false,
      error: null,
    } as ReturnType<typeof useCreditApplications>)

    renderPage()
    expect(await screen.findByText('credit.columns.step')).toBeInTheDocument()
    // Название шага — из словаря блоков анкеты, а не машинным именем.
    expect(screen.getByText('credit.blocks.bank_verification')).toBeInTheDocument()
  })

  // Время на шаге. Модуль отдаёт его вместе с признаком, ИЗМЕРЕНО оно или
  // подставлено от создания заявки. Подстановка обязана быть подписана:
  // иначе «40 дн» читается как «клиент стоит сорок дней», хотя правда —
  // «ленты переходов тогда не было».
  const withStepTime = (source: 'step' | 'created') => {
    vi.mocked(useCreditApplications).mockReturnValue({
      data: {
        items: [
          {
            ...ROW,
            status: 'in_progress',
            resume_step: 'bank_verification',
            step_entered_at: '2026-08-29T06:00:00Z',
            step_entered_at_source: source,
          },
        ],
        next_cursor: null,
        total: 1,
      },
      isLoading: false,
      error: null,
    } as ReturnType<typeof useCreditApplications>)
  }

  it('измеренное время на шаге показывается без оговорки', async () => {
    withStepTime('step')
    renderPage()
    expect(await screen.findByText('credit.columns.onStep')).toBeInTheDocument()
    expect(screen.queryByText(/credit\.idle\.sinceCreated/)).not.toBeInTheDocument()
  })

  it('подставленное время подписано «з моменту створення», а не выдано за измерение', async () => {
    withStepTime('created')
    renderPage()
    await screen.findByText('credit.columns.onStep')
    expect(screen.getByText(/credit\.idle\.sinceCreated/)).toBeInTheDocument()
  })
})
