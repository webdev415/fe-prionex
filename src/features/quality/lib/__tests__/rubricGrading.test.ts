/**
 * rubricGrading tests — the one place that knows the wire shape of the
 * unfinished-dialogue scale, and therefore the one place worth pinning down.
 *
 * Canon (quality-service): `grading_rules` is a container keyed by rule kind;
 * `incomplete_dialog` carries `title` / `source` / `telephony_type` / `levels`,
 * a level carries `score` / `description`.
 */
import { describe, expect, it } from 'vitest'

import {
  GRADING_RULE_KIND,
  gradingScaleIssues,
  nextFreeScore,
  readIncompleteDialogScale,
  writeIncompleteDialogScale,
  type IncompleteDialogScale,
} from '../rubricGrading'

function wire(levels: unknown[], extra: Record<string, unknown> = {}) {
  return { incomplete_dialog: { title: 'Параметри', telephony_type: 'white', levels, ...extra } }
}

function scale(overrides: Partial<IncompleteDialogScale> = {}): IncompleteDialogScale {
  return {
    title: 'Параметри',
    source: null,
    telephony_type: 'white',
    levels: [
      { score: 50, description: 'провокація конфлікту' },
      { score: 100, description: 'послідовний діалог' },
    ],
    ...overrides,
  }
}

describe('readIncompleteDialogScale', () => {
  it('reads the canonical payload', () => {
    expect(
      readIncompleteDialogScale(
        wire(
          [
            { score: 50, description: 'провокація конфлікту' },
            { score: 100, description: 'послідовний діалог' },
          ],
          { source: 'Незавершені діалоги 09.2025' }
        )
      )
    ).toEqual({
      title: 'Параметри',
      source: 'Незавершені діалоги 09.2025',
      telephony_type: 'white',
      levels: [
        { score: 50, description: 'провокація конфлікту' },
        { score: 100, description: 'послідовний діалог' },
      ],
    })
  })

  it('renders nothing for a card that carries no rules at all', () => {
    // Every card but «AI: стягнення КЛ» is graded by its criteria alone.
    expect(readIncompleteDialogScale(undefined)).toBeNull()
    expect(readIncompleteDialogScale(null)).toBeNull()
    expect(readIncompleteDialogScale({})).toBeNull()
    expect(readIncompleteDialogScale(wire([]))).toBeNull()
  })

  it('ignores a container that only holds some other rule kind', () => {
    expect(readIncompleteDialogScale({ some_future_rule: { levels: [{ score: 100 }] } })).toBeNull()
  })

  it('reads a line the UI does not offer as «any line»', () => {
    const read = readIncompleteDialogScale(
      wire([{ score: 100, description: 'а' }], {
        telephony_type: 'gray',
      })
    )
    // `gray` is not a value the data carries — the vocabulary is `grey`.
    expect(read?.telephony_type).toBeNull()
  })

  it('drops a level whose score it would have to invent', () => {
    // A band graded by a threshold no trainer wrote is worse than no band.
    expect(
      readIncompleteDialogScale(
        wire([{ description: 'без бала' }, { score: 100, description: 'ок' }])
      )?.levels
    ).toEqual([{ score: 100, description: 'ок' }])
  })

  it('keeps a level with no wording — that is a blocking issue, not a reason to drop it', () => {
    expect(readIncompleteDialogScale(wire([{ score: 50 }]))?.levels).toEqual([
      { score: 50, description: '' },
    ])
  })
})

describe('writeIncompleteDialogScale', () => {
  it('sorts the levels the way the server will return them', () => {
    const written = writeIncompleteDialogScale(
      null,
      scale({
        levels: [
          { score: 100, description: 'б' },
          { score: 50, description: 'а' },
        ],
      })
    )
    expect(
      (written?.[GRADING_RULE_KIND] as { levels: { score: number }[] }).levels.map((l) => l.score)
    ).toEqual([50, 100])
  })

  it('trims the edges of the wording and leaves the newlines inside', () => {
    const written = writeIncompleteDialogScale(
      null,
      scale({ levels: [{ score: 100, description: '  Перший\nДругий  ' }] })
    )
    expect(
      (written?.[GRADING_RULE_KIND] as { levels: { description: string }[] }).levels[0].description
    ).toBe('Перший\nДругий')
  })

  it('carries a rule kind it does not know about through the save', () => {
    // The container may grow other kinds; rebuilding it from what the editor
    // renders would delete one added later.
    const written = writeIncompleteDialogScale(
      { some_future_rule: { keep: true }, incomplete_dialog: { levels: [] } },
      scale()
    )
    expect(written?.some_future_rule).toEqual({ keep: true })
  })

  it('removes only this rule kind, leaving the siblings', () => {
    const written = writeIncompleteDialogScale(
      { some_future_rule: { keep: true }, incomplete_dialog: { levels: [] } },
      null
    )
    expect(written).toEqual({ some_future_rule: { keep: true } })
  })

  it('collapses an emptied container to null, the way the server stores it', () => {
    expect(writeIncompleteDialogScale({ incomplete_dialog: { levels: [] } }, null)).toBeNull()
  })
})

describe('nextFreeScore', () => {
  it('never repeats a score already on the scale', () => {
    expect(nextFreeScore([{ score: 0, description: '' }])).toBe(1)
    expect(nextFreeScore([])).toBe(0)
  })
})

describe('gradingScaleIssues', () => {
  it('stays quiet on a scale the server would accept', () => {
    expect(gradingScaleIssues(scale(), null)).toEqual([])
  })

  it('refuses a top band below 100 — it marks down every cut-short call in silence', () => {
    expect(
      gradingScaleIssues(scale({ levels: [{ score: 90, description: 'а' }] }), null)
    ).toContain('pages.qaRules.rubrics.grading.issueTop')
  })

  it('refuses two bands sharing a score', () => {
    expect(
      gradingScaleIssues(
        scale({
          levels: [
            { score: 100, description: 'а' },
            { score: 100, description: 'б' },
          ],
        }),
        null
      )
    ).toContain('pages.qaRules.rubrics.grading.issueDuplicate')
  })

  it('refuses a score outside 0..100 and a band with no wording', () => {
    const issues = gradingScaleIssues(
      scale({
        levels: [
          { score: 120, description: '   ' },
          { score: 100, description: 'ок' },
        ],
      }),
      null
    )
    expect(issues).toContain('pages.qaRules.rubrics.grading.issueRange')
    expect(issues).toContain('pages.qaRules.rubrics.grading.issueNoWording')
  })

  it('refuses an empty scale', () => {
    expect(gradingScaleIssues(scale({ levels: [] }), null)).toEqual([
      'pages.qaRules.rubrics.grading.issueEmptyScale',
    ])
  })

  it('refuses a scale pinned to the line the card excludes — the server 422s on it', () => {
    expect(gradingScaleIssues(scale({ telephony_type: 'white' }), 'grey')).toContain(
      'pages.qaRules.rubrics.grading.issueLineMismatch'
    )
  })

  it('allows a scale for both lines on a card narrowed to one', () => {
    expect(gradingScaleIssues(scale({ telephony_type: null }), 'grey')).toEqual([])
  })

  it('allows a scale narrower than a card that judges both lines', () => {
    // «AI: стягнення КЛ» is exactly this: one set of criteria for both lines,
    // with the scale applying to white calls only.
    expect(gradingScaleIssues(scale({ telephony_type: 'white' }), null)).toEqual([])
  })
})
