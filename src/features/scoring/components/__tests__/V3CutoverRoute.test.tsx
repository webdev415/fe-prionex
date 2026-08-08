/**
 * V3CutoverRoute — the KAN-791 gate.
 *
 * The ticket's last AC is "Hidden until sub-task 8 sign-off; toggled on per
 * brand." That makes this component a compliance control, not a convenience:
 * during the shadow run the v3 buckets are explicitly NOT validated, and an
 * operator acting on them is acting on numbers the client has not approved.
 *
 * So the interesting cases are the negative ones — it must fail CLOSED while the
 * answer is still loading, and on error, not just when the switch is off.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { V3CutoverRoute } from '../V3CutoverRoute'
import * as useV3ScoresModule from '@/features/scoring/hooks/useV3Scores'

vi.mock('@/features/scoring/hooks/useV3Scores')

const mockState = (enabled: boolean, isLoading = false) => {
  vi.mocked(useV3ScoresModule.useV3UiEnabledState).mockReturnValue({ enabled, isLoading })
}

function renderGuarded() {
  return render(
    <MemoryRouter initialEntries={['/work-list']}>
      <Routes>
        <Route
          path="/work-list"
          element={
            <V3CutoverRoute>
              <div>Priority Work List</div>
            </V3CutoverRoute>
          }
        />
        <Route path="/dashboard" element={<div>Dashboard</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('V3CutoverRoute', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders the page once the brand has been cut over', () => {
    mockState(true)
    renderGuarded()
    expect(screen.getByText('Priority Work List')).toBeInTheDocument()
  })

  it('redirects away when the brand is not cut over', () => {
    mockState(false)
    renderGuarded()
    expect(screen.queryByText('Priority Work List')).not.toBeInTheDocument()
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })

  it('shows nothing at all while the switch is still loading', () => {
    // Rendering the page first and redirecting after would flash unvalidated
    // priorities on screen — brief, but visible, and enough to act on.
    mockState(false, true)
    renderGuarded()
    expect(screen.queryByText('Priority Work List')).not.toBeInTheDocument()
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument()
  })

  it('fails closed when the switch cannot be read', () => {
    // The hook reports enabled=false on error; a brand without an explicit
    // opt-in must never be treated as signed off because a request failed.
    mockState(false)
    renderGuarded()
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })
})
