/**
 * StageChecklist independent-toggle coverage.
 *
 * Regression guard: marking one stage must NOT change any other stage.
 * Previously a monotonic auto-mark flipped every earlier/later stage, so a
 * trainer could only ever record all-reached or all-not-reached.
 */

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { StageChecklist } from '../ScorecardPanel'
import type { Section } from '../../types'

const STAGE_KEYS = [
  'stage_greeting',
  'stage_need_identification',
  'stage_solution_presentation',
  'stage_objection_handling',
  'stage_closing',
  'stage_farewell',
]

const section: Section = {
  key: 'script_stages',
  name: 'Script stages',
  criteria: STAGE_KEYS.map((key, i) => ({
    key,
    name: `Stage ${i + 1}`,
    scale: 'binary',
    weight: 0,
  })),
}

// The test i18n mock returns the key for t(key, fallback); the buttons render
// in stage order, so getAllByText(key)[i] is the i-th stage's button.
const REACHED = 'pages.training.scorecard.stages.reached'
const NOT_REACHED = 'pages.training.scorecard.stages.notReached'

describe('StageChecklist (independent toggles)', () => {
  it('marking one stage not-reached changes only that stage', () => {
    const onChange = vi.fn()
    render(<StageChecklist section={section} scores={{}} disabled={false} onChange={onChange} />)

    fireEvent.click(screen.getAllByText(NOT_REACHED)[0]) // greeting

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('stage_greeting', false)
  })

  it('marking the last stage reached changes only that stage', () => {
    const onChange = vi.fn()
    render(<StageChecklist section={section} scores={{}} disabled={false} onChange={onChange} />)

    fireEvent.click(screen.getAllByText(REACHED)[5]) // farewell

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('stage_farewell', true)
  })

  it('re-clicking the active choice clears the stage to null', () => {
    const onChange = vi.fn()
    render(
      <StageChecklist
        section={section}
        scores={{ stage_closing: { value: true } }}
        disabled={false}
        onChange={onChange}
      />
    )

    fireEvent.click(screen.getAllByText(REACHED)[4]) // closing, already reached

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('stage_closing', null)
  })
})
