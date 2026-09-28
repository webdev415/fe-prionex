import { afterEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import i18n from '@/lib/i18n'
import { setActiveCurrency } from '@/lib/projectCurrency'
import type { AuditLog } from '../AuditLogsPage'
import { AuditLogDetailModal } from '../components/AuditLogDetailModal'

const mutableI18n = i18n as unknown as { language: string }

const debtChange = {
  id: 1,
  timestamp: '2026-09-26T10:00:00Z',
  status: 'success',
  username: 'op',
  action: 'UPDATE',
  changes: [
    { field_name: 'debt_amount', old_value: '100', new_value: '150', change_type: 'Modified' },
  ],
} as AuditLog

function modalText(): string {
  render(<AuditLogDetailModal open log={debtChange} onClose={vi.fn()} />)
  return (document.body.textContent ?? '').replace(/\s/g, ' ')
}

describe('audit log debt amounts in the project currency', () => {
  afterEach(() => {
    mutableI18n.language = 'en'
    setActiveCurrency('UAH')
  })

  it('writes a CAD debt change in Canadian dollars without calling it UAH', () => {
    mutableI18n.language = 'en'
    setActiveCurrency('CAD')

    const text = modalText()

    expect(text).toContain('CA$100')
    expect(text).toContain('CA$150')
    expect(text).not.toContain('UAH')
  })

  it('keeps the UAH suffix for a hryvnia project', () => {
    expect(modalText()).toContain('₴ 150 UAH')
  })
})
