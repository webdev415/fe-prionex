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

vi.mock('react-i18next', async () => (await import('@/test/englishI18n')).englishReactI18nextMock())

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
  open,
}: { enabled?: boolean; results?: unknown[]; open?: boolean } = {}) {
  vi.mocked(useV3ScoresModule.useV3UiEnabled).mockReturnValue(enabled)
  vi.mocked(useV3ScoresModule.useV3Scores).mockReturnValue({
    data: { results },
  } as ReturnType<typeof useV3ScoresModule.useV3Scores>)
  return render(<V3ClientPriorityPanel projectId={1} clientId={100} open={open} />)
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

  it('renders nothing while collapsed', () => {
    // The chip above discloses it; collapsed, the panel is absent rather than
    // hidden, so nothing in it is reachable by keyboard or screen reader.
    setup({ open: false })
    expect(screen.queryByText('Call first')).not.toBeInTheDocument()
    expect(screen.queryByText('v3 Priority')).not.toBeInTheDocument()
  })

  it('stays open for the call sites that pass no open prop', () => {
    // Two other places render the panel inline with no chip to control it.
    setup()
    expect(screen.getByText('v3 Priority')).toBeInTheDocument()
  })

  it('renders nothing before the brand is cut over', () => {
    const { container } = setup({ enabled: false })
    expect(container).toBeEmptyDOMElement()
  })

  it('says the client is not scored rather than vanishing', () => {
    // Rendering nothing looked like a panel that had failed to load. The model
    // does not cover every client, and saying so is the honest answer.
    setup({ results: [] })
    expect(screen.getByText(/not scored/i)).toBeInTheDocument()
    expect(screen.getByText(/outside the scoring model/i)).toBeInTheDocument()
  })
})
