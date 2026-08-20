/**
 * AiRubricEditor tests — the Σ(weights) = 100 rule.
 *
 * quality-service refuses an AI rubric whose criteria weights don't sum to
 * 100. The editor mirrors that locally: the running total is on screen and
 * Save is disabled until it's right, so the trainer never meets the 422.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { AiRubricEditor } from '../AiRubricEditor'
import type { ScorecardTemplate } from '../../../types'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

function makeRubric(weights: number[]): ScorecardTemplate {
  return {
    id: 1,
    project_id: 1,
    name: 'Стягнення КЛ',
    description: null,
    call_type: null,
    purpose: 'ai',
    department_id: null,
    scorecard_type: 'client',
    sections: [
      {
        key: 'script',
        name: 'Скрипт',
        criteria: weights.map((weight, i) => ({
          key: `c${i}`,
          name: `Критерій ${i}`,
          scale: 'binary' as const,
          weight,
        })),
      },
    ],
    is_archived: false,
    created_by: 1,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
  }
}

function renderEditor(rubric: ScorecardTemplate, onSave = vi.fn()) {
  render(<AiRubricEditor rubric={rubric} departments={[]} onSave={onSave} />)
  return { onSave }
}

const saveButton = () => screen.getByRole('button', { name: 'actions.save' })

describe('AiRubricEditor — weight validation', () => {
  it('shows the running total and enables Save at exactly 100', () => {
    renderEditor(makeRubric([60, 40]))
    expect(screen.getByTestId('rubric-weight-total')).toHaveTextContent('100')
    expect(saveButton()).toBeEnabled()
  })

  it('blocks Save while the weights do not add up to 100', () => {
    renderEditor(makeRubric([60, 30]))
    expect(screen.getByTestId('rubric-weight-total')).toHaveTextContent('90')
    expect(saveButton()).toBeDisabled()
    expect(screen.getByText('pages.qaRules.rubrics.weightError')).toBeInTheDocument()
  })

  it('re-validates live as a weight is edited', () => {
    renderEditor(makeRubric([60, 30]))
    const weightInputs = screen.getAllByLabelText('pages.qaRules.rubrics.weight')
    fireEvent.change(weightInputs[1], { target: { value: '40' } })
    expect(screen.getByTestId('rubric-weight-total')).toHaveTextContent('100')
    expect(saveButton()).toBeEnabled()
  })

  it('submits the normalized payload with purpose=ai', () => {
    const { onSave } = renderEditor(makeRubric([60, 40]))
    fireEvent.click(saveButton())
    expect(onSave).toHaveBeenCalledTimes(1)
    const payload = onSave.mock.calls[0][0]
    expect(payload.purpose).toBe('ai')
    expect(payload.scorecard_type).toBe('client')
    expect(payload.department_id).toBeNull()
    expect(payload.sections[0].criteria.map((c: { weight: number }) => c.weight)).toEqual([60, 40])
  })

  it('refuses to save a rubric with no criteria at all', () => {
    renderEditor(makeRubric([]))
    expect(saveButton()).toBeDisabled()
  })
})
