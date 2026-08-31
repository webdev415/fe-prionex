/**
 * AiRubricEditor tests — the Σ(weights) = 100 rule.
 *
 * quality-service refuses an AI rubric whose criteria weights don't sum to
 * 100. The editor mirrors that locally: the running total is on screen and
 * Save is disabled until it's right, so the trainer never meets the 422.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'

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

describe('AiRubricEditor — the outbound line the rubric grades', () => {
  it('reads a rubric without the field as «any line»', () => {
    // The backend that predates the split answers no `telephony_type` at all.
    // That must render as «any line», not as a blank select.
    renderEditor(makeRubric([100]))
    expect(screen.getByTestId('rubric-slice')).toHaveTextContent(
      'pages.qaRules.rubrics.telephonyAny'
    )
  })

  it('leaves the key out entirely when the trainer never touched the line', () => {
    // The update route reads «key absent» as «leave the line alone» and an
    // explicit null as «clear it». Saving an unrelated edit must not unpin a
    // rubric that was pinned to a line.
    const { onSave } = renderEditor({ ...makeRubric([100]), telephony_type: 'grey' })
    fireEvent.click(saveButton())
    expect(onSave.mock.calls[0][0]).not.toHaveProperty('telephony_type')
  })

  it('sends an explicit null when the trainer moves a pinned rubric back to «any»', () => {
    const { onSave } = renderEditor({ ...makeRubric([100]), telephony_type: 'grey' })
    fireEvent.change(screen.getByLabelText('pages.qaRules.rubrics.telephonyType'), {
      target: { value: '' },
    })
    fireEvent.click(saveButton())
    expect(onSave.mock.calls[0][0].telephony_type).toBeNull()
  })

  it('always carries the line on a rubric that does not exist yet', () => {
    // Create has nothing to leave alone, so «any line» is stated, not implied.
    const onSave = vi.fn()
    render(<AiRubricEditor departments={[]} onSave={onSave} />)
    fireEvent.change(screen.getByLabelText('pages.qaRules.rubrics.name'), {
      target: { value: 'Нова' },
    })
    fireEvent.click(screen.getByRole('button', { name: /addSection/ }))
    fireEvent.click(screen.getByRole('button', { name: /addCriterion/ }))
    fireEvent.change(screen.getByLabelText('pages.qaRules.rubrics.weight'), {
      target: { value: '100' },
    })
    fireEvent.click(saveButton())
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave.mock.calls[0][0]).toHaveProperty('telephony_type', null)
  })

  it('spells grey the way the data spells it — grey, never gray', () => {
    const { onSave } = renderEditor({ ...makeRubric([100]), telephony_type: 'white' })
    fireEvent.change(screen.getByLabelText('pages.qaRules.rubrics.telephonyType'), {
      target: { value: 'grey' },
    })
    expect(screen.getByTestId('rubric-slice')).toHaveTextContent(
      'pages.qaRules.rubrics.telephony.grey'
    )
    fireEvent.click(saveButton())
    expect(onSave.mock.calls[0][0].telephony_type).toBe('grey')
  })

  it('follows the select live in the header and in the payload', () => {
    const { onSave } = renderEditor(makeRubric([100]))
    fireEvent.change(screen.getByLabelText('pages.qaRules.rubrics.telephonyType'), {
      target: { value: 'white' },
    })
    expect(screen.getByTestId('rubric-slice')).toHaveTextContent(
      'pages.qaRules.rubrics.telephony.white'
    )
    fireEvent.click(saveButton())
    expect(onSave.mock.calls[0][0].telephony_type).toBe('white')
  })

  it('reads a line the UI does not offer as «any line» rather than blanking', () => {
    // `unknown` belongs to the call records' own vocabulary; a rubric should
    // never end up pinned to it, and the editor must not render an empty select.
    renderEditor({ ...makeRubric([100]), telephony_type: 'unknown' })
    expect(screen.getByTestId('rubric-slice')).toHaveTextContent(
      'pages.qaRules.rubrics.telephonyAny'
    )
  })

  it('does not call the twin on the other line a slice conflict', () => {
    // A white and a grey rubric for the same department are the whole point
    // of the split — warning here would fire on the main new flow.
    const grey: ScorecardTemplate = { ...makeRubric([100]), id: 2, telephony_type: 'grey' }
    render(
      <AiRubricEditor
        rubric={{ ...makeRubric([100]), id: 1, telephony_type: 'white' }}
        departments={[]}
        siblings={[grey]}
        onSave={vi.fn()}
      />
    )
    expect(screen.queryByTestId('rubric-slice-conflict')).not.toBeInTheDocument()
  })

  it('still warns when the other rubric sits on the same line', () => {
    const twin: ScorecardTemplate = { ...makeRubric([100]), id: 2, telephony_type: 'white' }
    render(
      <AiRubricEditor
        rubric={{ ...makeRubric([100]), id: 1, telephony_type: 'white' }}
        departments={[]}
        siblings={[twin]}
        onSave={vi.fn()}
      />
    )
    expect(screen.getByTestId('rubric-slice-conflict')).toBeInTheDocument()
  })
})

function makeMultiSection(): ScorecardTemplate {
  const base = makeRubric([100])
  return {
    ...base,
    sections: [
      base.sections[0],
      {
        key: 'closing',
        name: 'Завершення',
        criteria: [
          { key: 'bye', name: 'Прощання', scale: 'binary' as const, weight: 0, description: 'є' },
        ],
      },
    ],
  }
}

describe('AiRubricEditor — folding sections', () => {
  it('opens the first section and folds the rest', () => {
    renderEditor(makeMultiSection())
    expect(screen.getByTestId('rubric-section-toggle-script')).toHaveAttribute(
      'aria-expanded',
      'true'
    )
    expect(screen.getByTestId('rubric-section-toggle-closing')).toHaveAttribute(
      'aria-expanded',
      'false'
    )
    // The folded section's criteria are not rendered at all — that is the
    // point: 13 criteria as one flat list is two screens of inputs.
    expect(screen.queryByDisplayValue('Прощання')).not.toBeInTheDocument()
  })

  it('unfolds a section on click and folds it back', () => {
    renderEditor(makeMultiSection())
    const toggle = screen.getByTestId('rubric-section-toggle-closing')
    fireEvent.click(toggle)
    expect(screen.getByDisplayValue('Прощання')).toBeInTheDocument()
    fireEvent.click(toggle)
    expect(screen.queryByDisplayValue('Прощання')).not.toBeInTheDocument()
  })

  it('unfolds and folds every section at once', () => {
    renderEditor(makeMultiSection())
    fireEvent.click(screen.getByTestId('rubric-expand-all'))
    expect(screen.getByDisplayValue('Прощання')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('rubric-collapse-all'))
    expect(screen.queryByDisplayValue('Прощання')).not.toBeInTheDocument()
    expect(screen.queryByDisplayValue('Критерій 0')).not.toBeInTheDocument()
  })

  it('carries the criterion count and the weight subtotal on the folded header', () => {
    renderEditor(makeMultiSection())
    const meta = screen.getByTestId('rubric-section-meta-closing')
    expect(meta).toHaveTextContent('pages.qaRules.rubrics.criteriaCount: 1')
    expect(meta).toHaveTextContent('pages.qaRules.rubrics.weightTotal: 0')
  })

  it('saves what a folded section holds — folding is not deleting', () => {
    const { onSave } = renderEditor(makeMultiSection())
    fireEvent.click(saveButton())
    const payload = onSave.mock.calls[0][0]
    expect(payload.sections).toHaveLength(2)
    expect(payload.sections[1].criteria[0].name).toBe('Прощання')
  })

  it('has no fold-all controls for a single-section rubric', () => {
    renderEditor(makeRubric([100]))
    expect(screen.queryByTestId('rubric-expand-all')).not.toBeInTheDocument()
  })
})

describe('AiRubricEditor — the empty «AI instruction»', () => {
  it('says what an empty instruction costs', () => {
    renderEditor(makeRubric([100]))
    expect(screen.getByTestId('rubric-instruction-hint')).toHaveTextContent(
      'pages.qaRules.rubrics.instructionHint'
    )
  })

  it('counts the criteria that have none, per section', () => {
    // The live universal rubric ships all 13 criteria without an instruction;
    // nothing on screen said so, and the model was left guessing from names.
    renderEditor(makeRubric([60, 40]))
    expect(screen.getByTestId('rubric-section-missing-script')).toHaveTextContent(
      'pages.qaRules.rubrics.missingInstruction'
    )
  })

  it('drops the badge once every criterion carries an instruction', () => {
    const rubric = makeRubric([100])
    rubric.sections[0].criteria[0].description = 'Зараховувати, якщо оператор назвав себе.'
    renderEditor(rubric)
    expect(screen.queryByTestId('rubric-section-missing-script')).not.toBeInTheDocument()
  })

  it('offers an example instead of repeating the label in the placeholder', () => {
    renderEditor(makeRubric([100]))
    expect(
      screen.getByPlaceholderText('pages.qaRules.rubrics.criterionDescriptionPlaceholder')
    ).toBeInTheDocument()
  })
})

describe('AiRubricEditor — the prose fields', () => {
  const LONG_EXAMPLES = [
    "1. Уявіть, що Ви знайшли омріяне місце роботи, пройшли співбесіду, але після перевірки фінансової репутації Вам відмовили через наявні порушення зобов'язань.",
    '2. Уявіть, що у Вас зламався телефон, Ви звертаєтеся до магазину за розстрочкою, але Вам відмовляють, бо фінансова репутація зіпсована простроченнями.',
  ].join('\n')

  function makeProseRubric(): ScorecardTemplate {
    const base = makeRubric([100])
    return {
      ...base,
      sections: [
        {
          ...base.sections[0],
          criteria: [
            {
              ...base.sections[0].criteria[0],
              description: 'Пояснити наслідки\nпростроченої заборгованості.',
              examples: LONG_EXAMPLES,
            },
          ],
        },
      ],
    }
  }

  it('shows the speech examples instead of only smuggling them through a save', () => {
    // They round-tripped invisibly before: a trainer could not read, let alone
    // edit, the wording the model is actually fed.
    renderEditor(makeProseRubric())
    // Not getByDisplayValue: its default normalizer collapses the newlines
    // that are the whole point of this field.
    const examples = screen.getByPlaceholderText(
      'pages.qaRules.rubrics.criterionExamplesPlaceholder'
    ) as HTMLTextAreaElement
    expect(examples.value).toBe(LONG_EXAMPLES)
  })

  it('gives both prose fields a textarea, so a newline can be typed at all', () => {
    renderEditor(makeProseRubric())
    const instruction = screen.getByPlaceholderText(
      'pages.qaRules.rubrics.criterionDescriptionPlaceholder'
    )
    const examples = screen.getByPlaceholderText(
      'pages.qaRules.rubrics.criterionExamplesPlaceholder'
    )
    expect(instruction.tagName).toBe('TEXTAREA')
    expect(examples.tagName).toBe('TEXTAREA')
  })

  it('keeps the line breaks through a save — trim clips the edges, not the middle', () => {
    const { onSave } = renderEditor(makeProseRubric())
    fireEvent.click(saveButton())
    const criterion = onSave.mock.calls[0][0].sections[0].criteria[0]
    expect(criterion.examples).toBe(LONG_EXAMPLES)
    expect(criterion.examples.split('\n')).toHaveLength(2)
    expect(criterion.description).toBe('Пояснити наслідки\nпростроченої заборгованості.')
  })

  it('saves an edited examples block', () => {
    const { onSave } = renderEditor(makeProseRubric())
    fireEvent.change(
      screen.getByPlaceholderText('pages.qaRules.rubrics.criterionExamplesPlaceholder'),
      { target: { value: 'Перший рядок\nДругий рядок' } }
    )
    fireEvent.click(saveButton())
    expect(onSave.mock.calls[0][0].sections[0].criteria[0].examples).toBe(
      'Перший рядок\nДругий рядок'
    )
  })

  it('writes an emptied prose field back as null, not as an empty string', () => {
    const { onSave } = renderEditor(makeProseRubric())
    fireEvent.change(
      screen.getByPlaceholderText('pages.qaRules.rubrics.criterionExamplesPlaceholder'),
      { target: { value: '   ' } }
    )
    fireEvent.click(saveButton())
    expect(onSave.mock.calls[0][0].sections[0].criteria[0].examples).toBeNull()
  })
})

describe('AiRubricEditor — the unfinished-dialogue scale', () => {
  function withScale(overrides: Record<string, unknown> = {}): ScorecardTemplate {
    return {
      ...makeRubric([100]),
      grading_rules: {
        incomplete_dialog: {
          title: 'Параметри оцінки незавершеного діалогу',
          source: 'Незавершені діалоги 09.2025',
          telephony_type: 'white',
          levels: [
            { score: 50, description: 'провокація конфлікту' },
            { score: 70, description: 'неконструктивний діалог' },
            { score: 85, description: 'послідовно, проте' },
            { score: 100, description: 'домовленість' },
          ],
          ...overrides,
        },
      },
    }
  }

  const gradingLine = () => screen.getByLabelText('pages.qaRules.rubrics.grading.line')

  it('offers to create a scale rather than showing an empty stub', () => {
    renderEditor(makeRubric([100]))
    expect(screen.queryByTestId('rubric-grading-section')).not.toBeInTheDocument()
    expect(screen.getByTestId('rubric-grading-add')).toBeInTheDocument()
  })

  it('starts folded and counts its bands on the header', () => {
    renderEditor(withScale())
    expect(screen.getByTestId('rubric-grading-toggle')).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByTestId('rubric-grading-toggle')).toHaveTextContent(
      'pages.qaRules.rubrics.grading.levels: 4'
    )
    expect(screen.queryByTestId('rubric-grading-level-0')).not.toBeInTheDocument()
  })

  it('unfolds to the four editable bands, the heading, the line and the source', () => {
    renderEditor(withScale())
    fireEvent.click(screen.getByTestId('rubric-grading-toggle'))
    expect(screen.getByTestId('rubric-grading-level-3')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Параметри оцінки незавершеного діалогу')).toBeInTheDocument()
    expect((gradingLine() as HTMLSelectElement).value).toBe('white')
    expect(screen.getByTestId('rubric-grading-source')).toHaveTextContent(
      'Незавершені діалоги 09.2025'
    )
  })

  it('sends the canonical container, levels sorted, on save', () => {
    const { onSave } = renderEditor(withScale())
    fireEvent.click(saveButton())
    const scale = onSave.mock.calls[0][0].grading_rules.incomplete_dialog
    expect(Object.keys(scale).sort()).toEqual(['levels', 'source', 'telephony_type', 'title'])
    expect(scale.levels.map((l: { score: number }) => l.score)).toEqual([50, 70, 85, 100])
    expect(Object.keys(scale.levels[0]).sort()).toEqual(['description', 'score'])
  })

  it("adds and removes bands — four is today's file, not the shape", () => {
    const { onSave } = renderEditor(withScale())
    fireEvent.click(screen.getByTestId('rubric-grading-toggle'))
    fireEvent.click(screen.getByTestId('rubric-grading-add-level'))
    const fresh = within(screen.getByTestId('rubric-grading-level-4'))
    fireEvent.change(fresh.getByRole('spinbutton'), { target: { value: '60' } })
    fireEvent.change(fresh.getByRole('textbox'), { target: { value: 'проміжний рівень' } })
    fireEvent.click(saveButton())
    expect(
      onSave.mock.calls[0][0].grading_rules.incomplete_dialog.levels.map(
        (l: { score: number }) => l.score
      )
    ).toEqual([50, 60, 70, 85, 100])
  })

  it('blocks Save on a top band below 100 instead of letting it mark calls down quietly', () => {
    renderEditor(withScale())
    fireEvent.click(screen.getByTestId('rubric-grading-toggle'))
    const top = within(screen.getByTestId('rubric-grading-level-3'))
    fireEvent.change(top.getByRole('spinbutton'), { target: { value: '90' } })
    expect(screen.getByTestId('rubric-grading-issues')).toHaveTextContent(
      'pages.qaRules.rubrics.grading.issueTop'
    )
    expect(saveButton()).toBeDisabled()
  })

  it('blocks Save when the scale points at the line the card excludes', () => {
    // quality-service answers 422 «…would never apply…» — better to say so
    // before the request than to relay it after.
    renderEditor(withScale())
    fireEvent.change(screen.getByLabelText('pages.qaRules.rubrics.telephonyType'), {
      target: { value: 'grey' },
    })
    // The section is folded, so the header has to carry the alarm — otherwise
    // Save goes dead with nothing on screen explaining why.
    expect(screen.getByText('pages.qaRules.rubrics.grading.blocked')).toBeInTheDocument()
    expect(saveButton()).toBeDisabled()

    fireEvent.click(screen.getByTestId('rubric-grading-toggle'))
    expect(screen.getByTestId('rubric-grading-issues')).toHaveTextContent(
      'pages.qaRules.rubrics.grading.issueLineMismatch'
    )
  })

  it('lets the scale be narrower than a card that judges both lines', () => {
    // «AI: стягнення КЛ» is exactly this shape.
    renderEditor(withScale())
    expect(screen.queryByTestId('rubric-grading-issues')).not.toBeInTheDocument()
    expect(saveButton()).toBeEnabled()
  })

  it('removes the scale with an explicit null, so the card can drop it', () => {
    const { onSave } = renderEditor(withScale())
    fireEvent.click(screen.getByTestId('rubric-grading-remove'))
    fireEvent.click(saveButton())
    expect(onSave.mock.calls[0][0].grading_rules).toBeNull()
  })

  it('says nothing about rules on a card that had none and still has none', () => {
    const { onSave } = renderEditor(makeRubric([100]))
    fireEvent.click(saveButton())
    expect(onSave.mock.calls[0][0]).not.toHaveProperty('grading_rules')
  })

  it('a freshly added scale starts at a single band worth 100', () => {
    // The one shape that is valid the moment it appears.
    const { onSave } = renderEditor(makeRubric([100]))
    fireEvent.click(screen.getByTestId('rubric-grading-add'))
    const level = within(screen.getByTestId('rubric-grading-level-0'))
    expect((level.getByRole('spinbutton') as HTMLInputElement).value).toBe('100')
    fireEvent.change(level.getByRole('textbox'), { target: { value: 'будь-який обрив' } })
    fireEvent.click(saveButton())
    expect(onSave.mock.calls[0][0].grading_rules.incomplete_dialog.levels).toEqual([
      { score: 100, description: 'будь-який обрив' },
    ])
  })

  it('folds and unfolds with the sections when the trainer folds everything', () => {
    renderEditor(withScale())
    fireEvent.click(screen.getByTestId('rubric-expand-all'))
    expect(screen.getByTestId('rubric-grading-level-0')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('rubric-collapse-all'))
    expect(screen.queryByTestId('rubric-grading-level-0')).not.toBeInTheDocument()
  })

  it('names the line the scale applies to on the header, folded or not', () => {
    // Which calls a scale covers is the first thing a trainer needs, and the
    // card two fields up may well say something else.
    renderEditor(withScale())
    expect(screen.getByTestId('rubric-grading-slice')).toHaveTextContent(
      'pages.qaRules.rubrics.telephony.white'
    )
  })

  it('says «any line» on the header when the scale covers both', () => {
    renderEditor(withScale({ telephony_type: null }))
    expect(screen.getByTestId('rubric-grading-slice')).toHaveTextContent(
      'pages.qaRules.rubrics.telephonyAny'
    )
  })

  it('reorders the bands when a score is done being edited, not while it is typed', () => {
    // The server returns them ascending, so the rows should read that way —
    // but re-sorting on every keystroke pulls the field out from under the
    // trainer typing in it.
    renderEditor(withScale())
    fireEvent.click(screen.getByTestId('rubric-grading-toggle'))
    const first = within(screen.getByTestId('rubric-grading-level-0')).getByRole('spinbutton')

    fireEvent.change(first, { target: { value: '90' } })
    // Still in place: 90 typed over 50 has not moved the row yet.
    expect(
      (
        within(screen.getByTestId('rubric-grading-level-0')).getByRole(
          'spinbutton'
        ) as HTMLInputElement
      ).value
    ).toBe('90')

    fireEvent.blur(first)
    expect(
      Array.from(screen.getAllByTestId(/^rubric-grading-level-/)).map(
        (row) => (within(row).getByRole('spinbutton') as HTMLInputElement).value
      )
    ).toEqual(['70', '85', '90', '100'])
  })
})
