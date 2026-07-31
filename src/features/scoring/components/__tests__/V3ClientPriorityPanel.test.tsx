/**
 * V3ClientPriorityPanel — the "why this priority" surface on the client card.
 *
 * KAN-791 ACs covered here:
 *   * operators see the v3 bucket
 *   * ``rule_fired`` is visible on the debt view (the explainability requirement)
 *   * nothing renders before the brand's KAN-794 sign-off
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { V3ClientPriorityPanel } from '../V3ClientPriorityPanel'
import * as useV3ScoresModule from '@/features/scoring/hooks/useV3Scores'

vi.mock('@/features/scoring/hooks/useV3Scores', async () => {
  const actual = await vi.importActual<typeof useV3ScoresModule>(
    '@/features/scoring/hooks/useV3Scores'
  )
  return { ...actual, useV3UiEnabled: vi.fn(), useV3Scores: vi.fn() }
})

const ROWS = [
  { debt_id: 11, bucket_v3: 'CRIT', hazard: 0.4213, rule_fired: 'active_ptp' },
  { debt_id: 12, bucket_v3: 'LOW', hazard: 0.006, rule_fired: 'refusal_to_pay' },
]

function setup({
  enabled = true,
  results = ROWS,
}: { enabled?: boolean; results?: unknown[] } = {}) {
  vi.mocked(useV3ScoresModule.useV3UiEnabled).mockReturnValue(enabled)
  vi.mocked(useV3ScoresModule.useV3Scores).mockReturnValue({
    data: { results },
  } as ReturnType<typeof useV3ScoresModule.useV3Scores>)
  return render(<V3ClientPriorityPanel projectId={1} clientId={100} />)
}

describe('V3ClientPriorityPanel', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows the bucket for each of the client’s debts', () => {
    setup()
    // The badge renders the operator-facing label, not the raw bucket code —
    // "Call first" is an instruction, "CRIT" is jargon.
    expect(screen.getByText('Call first')).toBeInTheDocument()
    expect(screen.getByText('Low')).toBeInTheDocument()
  })

  it('shows the deciding rule so the priority is explainable', () => {
    setup()
    expect(screen.getByText('active_ptp')).toBeInTheDocument()
    expect(screen.getByText('refusal_to_pay')).toBeInTheDocument()
  })

  it('shows the pay chance as a percentage', () => {
    setup()
    expect(screen.getByText('42.1% pay chance')).toBeInTheDocument()
  })

  it('renders nothing before the brand is cut over', () => {
    const { container } = setup({ enabled: false })
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when the client has no scored debts', () => {
    // A client with no v3 rows must not leave an empty panel on the card.
    const { container } = setup({ results: [] })
    expect(container).toBeEmptyDOMElement()
  })
})
