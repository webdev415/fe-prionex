/**
 * Лента этапов в карточке заявки.
 *
 * Проверяется ровно то, ради чего лента заведена: оператор видит ТЕ ЖЕ пять
 * шагов и ТУ ЖЕ нумерацию, что клиент в кабинете, — иначе разговор «я на
 * третьем шаге» превращается в спор о нумерации. Сам расчёт пинуется отдельно
 * (`features/credit/api/__tests__/applicationStages.test.ts`); здесь — что
 * лента вообще доехала до карточки и что подписи берутся из словаря.
 *
 * Данные заявки — форма живого ответа стенда (CA-000208, dev 72.62.17.132,
 * 01.09.2026): `in_progress`, `resume_step: 'address'`,
 * `missing_fields: ['address','phones','income','params','bank_verification']`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CreditStageProgress } from '../components/CreditStageProgress'
import { CreditApplicationDetailPage } from '../CreditApplicationDetailPage'
import * as hooks from '@/features/credit/hooks/useCredit'
import type { CreditApplicationDetail } from '@/features/credit/api/types'

vi.mock('@/features/credit/hooks/useCredit')
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<typeof import('react-router-dom')>('react-router-dom')),
  useParams: () => ({ applicationId: '6a547e31-ba5e-4723-a2ea-ea55c8ef5197' }),
}))

const APPLICATION: CreditApplicationDetail = {
  application_id: '6a547e31-ba5e-4723-a2ea-ea55c8ef5197',
  number: 'CA-000208',
  status: 'in_progress',
  product_code: 'CA_AB_PAYDAY',
  channel: 'web',
  jurisdiction: 'CA-AB',
  currency: 'CAD',
  requested_amount_minor: 40_000,
  client_email: 'client@example.com',
  created_at: '2026-09-01T08:00:00+00:00',
  updated_at: '2026-09-01T09:00:00+00:00',
  decision_outcome: null,
  decision_mode: null,
  final_amount_minor: null,
  resume_step: 'address',
  missing_fields: ['address', 'phones', 'income', 'params', 'bank_verification'],
  project_id: 1,
  client_id: null,
  decision_id: null,
  loan_id: null,
  paydays: [],
  consents: [],
  audit: [],
  draft: {},
}

/** Пункт ленты целиком: значок, подпись, состояние. */
function stageItem(stage: string) {
  const label = screen.getByText(`credit.stage.${stage}`)
  return label.closest('li') as HTMLElement
}

describe('лента этапов', () => {
  it('показывает пять шагов клиента подряд', () => {
    render(<CreditStageProgress application={APPLICATION} />)
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(5)
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining('credit.stage.registration'),
      expect.stringContaining('credit.stage.questionnaire'),
      expect.stringContaining('credit.stage.bank'),
      expect.stringContaining('credit.stage.decision'),
      expect.stringContaining('credit.stage.signing'),
    ])
  })

  it('называет состояние каждого шага словом, а не одним цветом', () => {
    // jsdom не применяет Tailwind, и «зелёный кружок» тестом не проверить.
    // Но состояние обязано быть В ТЕКСТЕ — ради читалки и ради дальтоника.
    render(<CreditStageProgress application={APPLICATION} />)
    expect(within(stageItem('registration')).getByText('credit.stageState.done')).toBeVisible()
    expect(within(stageItem('questionnaire')).getByText('credit.stageState.current')).toBeVisible()
    expect(within(stageItem('bank')).getByText('credit.stageState.todo')).toBeInTheDocument()
  })

  it('нумерует непройденные шаги теми же номерами, что видит клиент', () => {
    render(<CreditStageProgress application={APPLICATION} />)
    // Клиент на втором шаге — значок текущего показывает «2», а не «1» и не «3».
    expect(within(stageItem('questionnaire')).getByText('2')).toBeInTheDocument()
    expect(within(stageItem('signing')).getByText('5')).toBeInTheDocument()
  })

  it('на отказе отмечает сбойным шаг решения, а не подписание', () => {
    render(<CreditStageProgress application={{ status: 'declined', missing_fields: [] }} />)
    expect(within(stageItem('decision')).getByText('credit.stageState.failed')).toBeVisible()
    expect(within(stageItem('signing')).getByText('credit.stageState.todo')).toBeInTheDocument()
  })
})

describe('карточка заявки', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(hooks.useCreditOverview).mockReturnValue({
      data: { permissions: [] },
    } as unknown as ReturnType<typeof hooks.useCreditOverview>)
    vi.mocked(hooks.useCreditApplication).mockReturnValue({
      data: APPLICATION,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof hooks.useCreditApplication>)
  })

  it('несёт ленту этапов рядом с блоком «застряв на кроці»', () => {
    render(
      <MemoryRouter>
        <CreditApplicationDetailPage />
      </MemoryRouter>
    )
    // Обе вещи на одном экране: где встал (строка простоя) и весь путь (лента).
    expect(screen.getByText(/credit\.card\.stuckAt/)).toBeInTheDocument()
    expect(screen.getByText(/credit\.card\.stagesTitle/)).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(5)
    expect(within(stageItem('questionnaire')).getByText('credit.stageState.current')).toBeVisible()
  })
})
