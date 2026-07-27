import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key),
    i18n: { language: 'en' },
  }),
}))

vi.mock('@/features/lawyerWorkplace', () => ({
  useLegalInboxSummary: () => ({ unprocessedCount: 0 }),
  useLegalKanban: () => ({ tasks: [] }),
  useLegalDocumentStats: () => ({ data: { filterCounts: { all: 0 } } }),
}))

vi.mock('@/features/lawyerWorkplace/hooks/useLegalPermissions', () => ({
  useCanAccessLegalKanban: () => true,
}))

vi.mock('../LawyerAvailabilityToggle', () => ({
  LawyerAvailabilityToggle: () => null,
}))

import { LawyerWorkplaceHeaderNav } from '../LawyerWorkplaceHeaderNav'

function renderNav(initialUrl = '/?tab=inbox') {
  return render(
    <MemoryRouter initialEntries={[initialUrl]}>
      <LawyerWorkplaceHeaderNav />
    </MemoryRouter>
  )
}

describe('LawyerWorkplaceHeaderNav', () => {
  it('renders the incoming and outgoing registry tabs', () => {
    renderNav()

    expect(screen.getByRole('button', { name: 'Incoming registry' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Outgoing registry' })).toBeInTheDocument()
  })

  it('keeps the existing tabs alongside the new registry tabs', () => {
    renderNav()

    expect(screen.getByRole('button', { name: 'Inbox' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Documents' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument()
  })
})
