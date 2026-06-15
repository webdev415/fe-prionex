import type { LetterTypeConfig, LetterTypePriorityAssignment, TrainingExample } from '../types'

export function cloneLetterType(type: LetterTypeConfig): LetterTypeConfig {
  return {
    ...type,
    examples: type.examples.map((example) => ({ ...example })),
    priorities: type.priorities.map((priority) => ({ ...priority })),
    keywordHints: [...type.keywordHints],
  }
}

export function updateLetterTypePriority(
  draft: LetterTypeConfig,
  lawyerId: string,
  patch: Partial<LetterTypePriorityAssignment>
): LetterTypeConfig {
  const next = draft.priorities.some((item) => item.lawyerId === lawyerId)
    ? draft.priorities.map((item) => (item.lawyerId === lawyerId ? { ...item, ...patch } : item))
    : [...draft.priorities, { lawyerId, stars: 0, role: 'off' as const, ...patch }]

  return { ...draft, priorities: next }
}

export function removeTrainingExample(
  draft: LetterTypeConfig,
  exampleId: string
): LetterTypeConfig {
  return {
    ...draft,
    examples: draft.examples.filter((example) => example.id !== exampleId),
  }
}

export function upsertTrainingExample(
  draft: LetterTypeConfig,
  example: TrainingExample
): LetterTypeConfig {
  const exists = draft.examples.some((item) => item.id === example.id)
  return {
    ...draft,
    examples: exists
      ? draft.examples.map((item) => (item.id === example.id ? example : item))
      : [...draft.examples, example],
  }
}

export function createLetterTypeFromInput(
  input: Pick<LetterTypeConfig, 'nameFallback' | 'colorId'>
): LetterTypeConfig {
  const id = `type-${Date.now()}`

  return {
    id,
    slug: input.nameFallback.toLowerCase().replace(/\s+/g, '_').slice(0, 24),
    nameKey: `custom:${id}`,
    nameFallback: input.nameFallback,
    colorId: input.colorId,
    slaDays: 14,
    descriptionKey: `custom-desc:${id}`,
    descriptionFallback: '',
    letterCount: 0,
    examples: [],
    priorities: [],
    keywordHints: [],
  }
}

export function createTrainingExampleFromForm(
  existingId: string | undefined,
  values: { title: string; body: string; source: string }
): TrainingExample {
  const id = existingId ?? `ex-${Date.now()}`
  const sourceFallback = values.source.trim().startsWith('from ')
    ? values.source.trim()
    : `from ${values.source.trim()}`

  return {
    id,
    titleKey: `custom:title:${id}`,
    titleFallback: values.title.trim(),
    bodyKey: `custom:body:${id}`,
    bodyFallback: values.body.trim(),
    sourceKey: `custom:source:${id}`,
    sourceFallback,
  }
}
