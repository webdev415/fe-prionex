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

describe('AiRubricEditor — the slice the rubric applies to', () => {
  it('spells out interlocutor + department instead of raw ids', () => {
    render(
      <AiRubricEditor
        rubric={{ ...makeRubric([100]), department_id: 5, scorecard_type: 'third_party' }}
        departments={[{ id: 5, name: 'Стягнення' }]}
        onSave={vi.fn()}
      />
    )
    const slice = screen.getByTestId('rubric-slice')
    expect(slice).toHaveTextContent('pages.qaRules.rubrics.typeThirdParty')
    expect(slice).toHaveTextContent('Стягнення')
    expect(slice).not.toHaveTextContent('5')
  })

  it('calls a department-less rubric universal, not «null»', () => {
    renderEditor(makeRubric([100]))
    expect(screen.getByTestId('rubric-slice')).toHaveTextContent('pages.qaRules.rubrics.universal')
  })

  it('follows the selects live, so the header describes what would be saved', () => {
    render(
      <AiRubricEditor
        rubric={makeRubric([100])}
        departments={[{ id: 5, name: 'Стягнення' }]}
        onSave={vi.fn()}
      />
    )
    fireEvent.change(screen.getByDisplayValue('pages.qaRules.rubrics.universal'), {
      target: { value: '5' },
    })
    expect(screen.getByTestId('rubric-slice')).toHaveTextContent('Стягнення')
  })

  it('badges the rubric active or archived', () => {
    const { unmount } = render(
      <AiRubricEditor rubric={makeRubric([100])} departments={[]} onSave={vi.fn()} />
    )
    expect(screen.getByTestId('rubric-status')).toHaveTextContent(
      'pages.qaRules.rubrics.statusActive'
    )
    unmount()

    render(
      <AiRubricEditor
        rubric={{ ...makeRubric([100]), is_archived: true }}
        departments={[]}
        onSave={vi.fn()}
      />
    )
    expect(screen.getByTestId('rubric-status')).toHaveTextContent(
      'pages.qaRules.rubrics.statusArchived'
    )
  })

  it('has no status badge for a rubric that does not exist yet', () => {
    render(<AiRubricEditor departments={[]} onSave={vi.fn()} />)
    expect(screen.queryByTestId('rubric-status')).not.toBeInTheDocument()
  })

  it('warns when another active rubric already owns the slice', () => {
    const owner: ScorecardTemplate = { ...makeRubric([100]), id: 2, name: 'Чинна рубрика' }
    render(
      <AiRubricEditor
        rubric={{ ...makeRubric([100]), id: 1 }}
        departments={[]}
        siblings={[owner]}
        onSave={vi.fn()}
      />
    )
    expect(screen.getByTestId('rubric-slice-conflict')).toBeInTheDocument()
  })

  it('stays quiet when the other rubric is archived or sits on another slice', () => {
    const archived: ScorecardTemplate = { ...makeRubric([100]), id: 2, is_archived: true }
    const otherSlice: ScorecardTemplate = {
      ...makeRubric([100]),
      id: 3,
      scorecard_type: 'third_party',
    }
    render(
      <AiRubricEditor
        rubric={{ ...makeRubric([100]), id: 1 }}
        departments={[]}
        siblings={[archived, otherSlice]}
        onSave={vi.fn()}
      />
    )
    expect(screen.queryByTestId('rubric-slice-conflict')).not.toBeInTheDocument()
  })
})
