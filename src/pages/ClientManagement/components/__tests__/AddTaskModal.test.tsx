/**
 * AddTaskModal — smoke tests
 *
 * Scope kept narrow on purpose:
 *   • Verifies the modal mounts without throwing under the canonical
 *     mock setup (auth, query, hook).
 *   • Verifies the Due Date label is rendered (regression for the
 *     KAN-608 picker integration).
 *
 * Deeper coverage:
 *   • BE due_date validator logic — covered by 10 cases in
 *     ``services/task/tests/unit/test_task_schemas.py`` (Pydantic
 *     unit tests).
 *   • Hook error parsing (Pydantic 422 array → toast message) —
 *     small / linear; verified by manual run.
 *   • Picker constraint visuals (greyed past days/slots) — verified
 *     by manual verification per the plan §6.3 (requires opening the
 *     react-datepicker popper, which doesn't render in jsdom).
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
    i18n: { language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}))

vi.mock('@/features/clients/hooks/useClients', () => ({
  useCreateTask: () => ({ mutate: vi.fn(), isPending: false }),
  useTaskSubjects: () => ({ data: [] }),
}))

vi.mock('@/features/users/hooks/useUsers', () => ({
  useOperators: () => ({
    data: [{ id: 1, full_name: 'Test Operator' }],
  }),
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({ user: { active_project_id: '1' } }),
}))

import { AddTaskModal } from '../AddTaskModal'

function renderWith(node: ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(<QueryClientProvider client={qc}>{node}</QueryClientProvider>)
}

describe('AddTaskModal — smoke', () => {
  it('renders the modal with the Due Date label', () => {
    renderWith(<AddTaskModal open clientId={1} onClose={vi.fn()} />)
    expect(screen.getByText('Due Date')).toBeInTheDocument()
  })

  it('does not throw on mount when feature props are present', () => {
    expect(() => renderWith(<AddTaskModal open clientId={1} onClose={vi.fn()} />)).not.toThrow()
  })
})
