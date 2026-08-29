/**
 * Разбор анкеты заявки.
 *
 * Повод для этого теста — живой дефект (29.08): карточка строилась на формате
 * демо-сида (`applicant`), а сайт присылает блоки `personal`/`phones`/…, и
 * реальная заявка показывала пустые поля. Тест держит оба формата.
 */
import { describe, it, expect } from 'vitest'
import { normalizeDraft } from '../draft'

const SITE_DRAFT = {
  personal: { first_name: 'Ruslan', last_name: 'Malynovskyi', birth_date: '1988-03-12' },
  phones: {
    items: [
      { kind: 'home', number: '+14035550002', is_primary: false },
      { kind: 'mobile', number: '+14035550001', is_primary: true },
    ],
  },
  address: { line1: '222 3 Ave SW', city: 'Calgary', province: 'AB', postal_code: 'T2P 0B4' },
  income: {
    net_amount_minor: 320000,
    frequency: 'bi_weekly',
    paydays: ['2026-09-11', '2026-09-25'],
    receipt_method: 'direct_deposit',
    employment_status: 'employment_full_time',
  },
  params: { amount_minor: 50000, referral_source: 'other' },
}

const STAND_DRAFT = {
  applicant: {
    first_name: 'Marie',
    last_name: 'Tremblay',
    email: 'marie@example.ca',
    phone: '+17805550142',
    date_of_birth: '1988-04-17',
  },
  income: { net_amount_minor: 118000, frequency: 'biweekly', employer: 'Northern Lights' },
  params: { requested_amount_minor: 90000 },
}

describe('normalizeDraft', () => {
  it('читает боевую анкету сайта', () => {
    const result = normalizeDraft(SITE_DRAFT, 'ceo-crm-live@example.ca')
    expect(result.fullName).toBe('Ruslan Malynovskyi')
    // email в анкете отсутствует — берётся с самой заявки
    expect(result.email).toBe('ceo-crm-live@example.ca')
    // из нескольких телефонов выбирается основной, а не первый
    expect(result.phone).toBe('+14035550001')
    expect(result.address).toBe('222 3 Ave SW, Calgary, AB, T2P 0B4')
    expect(result.incomeMinor).toBe(320000)
    expect(result.paydays).toHaveLength(2)
    expect(result.requestedMinor).toBe(50000)
    expect(result.employmentStatus).toBe('employment_full_time')
  })

  it('читает демо-анкету стенда (старый формат)', () => {
    const result = normalizeDraft(STAND_DRAFT, null)
    expect(result.fullName).toBe('Marie Tremblay')
    expect(result.email).toBe('marie@example.ca')
    expect(result.phone).toBe('+17805550142')
    expect(result.requestedMinor).toBe(90000)
  })

  it('НЕ подставляет работодателя в графу занятости', () => {
    // Фикстура STAND_DRAFT содержит employer без employment_status — то есть
    // прогоняет ровно ту ветку, где раньше жил дефект. Но проверки на
    // employmentStatus не было, и тест оставался зелёным и до фикса, и после.
    // Неверные данные в поле хуже пустоты: оператор им верит.
    const result = normalizeDraft(STAND_DRAFT, null)
    expect(result.employmentStatus).toBeNull()
    expect(result.employer).toBe('Northern Lights')
  })

  it('статус занятости берётся из своего поля', () => {
    const result = normalizeDraft(SITE_DRAFT, null)
    expect(result.employmentStatus).toBe('employment_full_time')
  })

  it('читает форму телефонов сайта (phones.primary), а не только items', () => {
    // Живое расхождение 29.08: web-credit присылает {primary}, скриптовый
    // вход — {items}. Обе формы лежат в базе; карточка обязана читать обе.
    const result = normalizeDraft(
      { ...SITE_DRAFT, phones: { primary: { kind: 'mobile', number: '+14035550777' } } },
      null
    )
    expect(result.phone).toBe('+14035550777')
  })

  it('не падает на пустой анкете', () => {
    const result = normalizeDraft(undefined, null)
    expect(result.fullName).toBe('')
    expect(result.paydays).toEqual([])
    expect(result.requestedMinor).toBeNull()
  })
})
