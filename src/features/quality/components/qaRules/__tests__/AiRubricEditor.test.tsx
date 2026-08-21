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

describe('AiRubricEditor — fields the form does not render', () => {
  // The template PUT replaces `sections` whole. Anything the editor rebuilds
  // from its own inputs is therefore deleted from the rubric on save — and
  // `critical` is the one that must never go: it caps the whole call at 40
  // when the criterion fails, so losing it turns a blocking rule into an
  // ordinary one and inflates scores from that moment on, with nothing in the
  // UI to show it happened.
  function makeRubricWithExtras(): ScorecardTemplate {
    const base = makeRubric([60, 40])
    const [first, second] = base.sections[0].criteria
    return {
      ...base,
      sections: [
        {
          ...base.sections[0],
          criteria: [
            { ...first, critical: true, examples: 'Іван Іванович, доброго дня.', raw_points: 5 },
            { ...second, examples: 'Повна сума до закриття складає ___.', raw_points: 10 },
          ],
        },
      ],
    }
  }

  it('keeps critical, examples and raw_points through an unrelated edit', () => {
    const { onSave } = renderEditor(makeRubricWithExtras())
    fireEvent.click(saveButton())

    const payload = onSave.mock.calls[0][0]
    const [first, second] = payload.sections[0].criteria
    expect(first.critical).toBe(true)
    expect(first.examples).toBe('Іван Іванович, доброго дня.')
    expect(first.raw_points).toBe(5)
    expect(second.examples).toBe('Повна сума до закриття складає ___.')
    expect(second.raw_points).toBe(10)
  })

  it('offers only the scales the API accepts', () => {
    // `binary_critical` is not an API scale: the server takes binary | 0-5 and
    // reads criticality off the separate flag. Listing it here produced a 422
    // on the very rule a trainer most wants to mark.
    renderEditor(makeRubricWithExtras())
    const scaleSelect = screen
      .getAllByRole('combobox')
      .find((el) => el.getAttribute('aria-label') === 'pages.qaRules.rubrics.scale')
    const values = Array.from(scaleSelect!.querySelectorAll('option')).map((o) =>
      o.getAttribute('value')
    )
    expect(values).toEqual(['binary', '0-5'])
  })

  it('lets a trainer mark a criterion critical', () => {
    const { onSave } = renderEditor(makeRubric([60, 40]))
    const boxes = screen.getAllByRole('checkbox')
    fireEvent.click(boxes[0])
    fireEvent.click(saveButton())

    const payload = onSave.mock.calls[0][0]
    expect(payload.sections[0].criteria[0].critical).toBe(true)
    expect(payload.sections[0].criteria[1].critical ?? null).toBeNull()
  })

  it('still applies the edits the form does render', () => {
    const { onSave } = renderEditor(makeRubricWithExtras())
    const weightInputs = screen.getAllByRole('spinbutton')
    fireEvent.change(weightInputs[0], { target: { value: '70' } })
    fireEvent.change(weightInputs[1], { target: { value: '30' } })
    fireEvent.click(saveButton())

    const payload = onSave.mock.calls[0][0]
    expect(payload.sections[0].criteria.map((c: { weight: number }) => c.weight)).toEqual([70, 30])
    expect(payload.sections[0].criteria[0].critical).toBe(true)
  })
})
