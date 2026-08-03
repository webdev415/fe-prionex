import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { OperatorPhoneStatus } from '../components/OperatorPhoneStatus'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}))

describe('OperatorPhoneStatus', () => {
  it('renders the Ready label and the AOR', () => {
    render(<OperatorPhoneStatus status="ready" aor="operator-c22-u63" />)
    const pill = screen.getByRole('status')
    expect(pill.textContent).toContain('Ready')
    expect(pill.textContent).toContain('operator-c22-u63')
  })

  it('renders Offline with no AOR', () => {
    render(<OperatorPhoneStatus status="offline" aor={null} />)
    const pill = screen.getByRole('status')
    expect(pill.textContent).toContain('Offline')
    expect(pill.textContent).not.toContain('·')
  })

  it('renders the Connecting label', () => {
    render(<OperatorPhoneStatus status="connecting" aor={null} />)
    expect(screen.getByRole('status').textContent).toContain('Connecting')
  })
})
