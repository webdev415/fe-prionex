/**
 * Настройки → Рубильники.
 *
 * Экран останавливает продукт, поэтому проверяется не вёрстка, а четыре
 * решения, каждое из которых стоит денег, если сломается:
 *  - выключение требует причины (история переключений — весь наш аудит);
 *  - выключение подтверждается отдельным шагом, а включение — одним нажатием;
 *  - переключать может только риск-менеджер;
 *  - непрочитанное положение показывается как непрочитанное, а не как «всё включено».
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CreditSwitchesSection } from '../components/CreditSwitchesSection'
import { useCreditSwitches, useSetCreditSwitch } from '@/features/credit/hooks/useCredit'
import type { CreditOverview } from '@/features/credit/api/types'

vi.mock('@/features/credit/hooks/useCredit', () => ({
  useCreditSwitches: vi.fn(),
  useSetCreditSwitch: vi.fn(),
}))

const mutate = vi.fn()

const overviewWith = (permissions: string[]) =>
  ({ role: 'risk_manager', permissions }) as unknown as CreditOverview

const ALL_ON = {
  switches: { applications_intake: true, client_cabinet: true, crm_section: true },
  history: [],
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useCreditSwitches).mockReturnValue({
    data: ALL_ON,
    isLoading: false,
    error: null,
  } as unknown as ReturnType<typeof useCreditSwitches>)
  vi.mocked(useSetCreditSwitch).mockReturnValue({
    mutate,
    isPending: false,
    isError: false,
  } as unknown as ReturnType<typeof useSetCreditSwitch>)
})

describe('CreditSwitchesSection', () => {
  it('выключение не уходит в модуль без причины', () => {
    render(<CreditSwitchesSection overview={overviewWith(['credit.switches.write'])} />)

    fireEvent.click(screen.getByLabelText('credit.switches.names.applications_intake'))
    // Появилось подтверждение, но запрос ещё НЕ ушёл.
    expect(mutate).not.toHaveBeenCalled()
    expect(screen.getByText('credit.switches.reasonRequired')).toBeInTheDocument()

    // Кнопка подтверждения заблокирована, пока причина пуста.
    const confirm = screen.getByRole('button', { name: 'credit.switches.turnOff' })
    expect(confirm).toBeDisabled()
  })

  it('с причиной уходит ровно то, что разрешает контракт', () => {
    render(<CreditSwitchesSection overview={overviewWith(['credit.switches.write'])} />)

    fireEvent.click(screen.getByLabelText('credit.switches.names.applications_intake'))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'сверка тарифа' } })
    fireEvent.click(screen.getByRole('button', { name: 'credit.switches.turnOff' }))

    // `additionalProperties: false` в схеме запроса: лишнее поле — ошибка, а не
    // молчаливое переключение не того.
    expect(mutate).toHaveBeenCalledTimes(1)
    const [args] = mutate.mock.calls[0]
    expect(args).toEqual({
      name: 'applications_intake',
      payload: { enabled: false, reason: 'сверка тарифа' },
    })
  })

  it('включение обратно — одним нажатием, без причины: возврат к работе не должен быть трудным', () => {
    vi.mocked(useCreditSwitches).mockReturnValue({
      data: { ...ALL_ON, switches: { ...ALL_ON.switches, crm_section: false } },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useCreditSwitches>)

    render(<CreditSwitchesSection overview={overviewWith(['credit.switches.write'])} />)
    fireEvent.click(screen.getByLabelText('credit.switches.names.crm_section'))

    expect(mutate).toHaveBeenCalledWith({
      name: 'crm_section',
      payload: { enabled: true, reason: null },
    })
  })

  it('без права записи переключатели заблокированы', () => {
    render(<CreditSwitchesSection overview={overviewWith(['credit.switches.read'])} />)

    expect(screen.getByLabelText('credit.switches.names.applications_intake')).toBeDisabled()
    expect(screen.getByText('credit.switches.readOnly')).toBeInTheDocument()
  })

  it('положение не прочитано — так и сказано, а не «всё включено»', () => {
    // Молчание здесь опаснее ошибки: риск-менеджер решит, что приём заявок
    // работает, хотя на самом деле неизвестно.
    vi.mocked(useCreditSwitches).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('boom'),
    } as unknown as ReturnType<typeof useCreditSwitches>)

    render(<CreditSwitchesSection overview={overviewWith(['credit.switches.write'])} />)
    expect(screen.getByText('credit.switches.loadFailed')).toBeInTheDocument()
    expect(screen.queryByText('credit.switches.on')).not.toBeInTheDocument()
  })
})
