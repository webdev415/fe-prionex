import type {
  LawyerPriorityRole,
  LetterTypeConfig,
  SettingsLawyer,
  TrainingExample,
} from '@/pages/LawyerWorkplace/settings/types'
import { legalApi } from './legalApi'
import type { LegalLawyer, LegalLetterType, LegalTrainingExample } from './types'

function mapTrainingExample(example: LegalTrainingExample): TrainingExample {
  return {
    id: example.id,
    titleKey: `api:title:${example.id}`,
    titleFallback: example.title,
    bodyKey: `api:body:${example.id}`,
    bodyFallback: example.body,
    sourceKey: `api:source:${example.id}`,
    sourceFallback: example.source ?? '',
    isPlaceholder: example.is_placeholder,
  }
}

export function mapLegalLetterTypeToConfig(item: LegalLetterType): LetterTypeConfig {
  return {
    id: item.id,
    slug: item.slug,
    nameKey: `api:name:${item.id}`,
    nameFallback: item.name,
    colorId: item.color_id,
    slaDays: item.sla_days,
    descriptionKey: `api:desc:${item.id}`,
    descriptionFallback: item.description ?? '',
    letterCount: item.letter_count,
    examples: item.examples.map(mapTrainingExample),
    priorities: item.priorities.map((priority) => ({
      lawyerId: priority.lawyer_id,
      stars: priority.stars,
      role: priority.role as LawyerPriorityRole,
    })),
    keywordHints: [...item.keyword_hints],
  }
}

export function mapLegalLawyerToSettings(lawyer: LegalLawyer): SettingsLawyer {
  return {
    id: lawyer.id,
    initials: lawyer.initials,
    nameKey: `api:lawyer:name:${lawyer.id}`,
    nameFallback: lawyer.display_name,
    roleKey: `api:lawyer:role:${lawyer.id}`,
    roleFallback: lawyer.role_title ?? 'Legal department',
    letterTypeIds: [...lawyer.letter_type_ids],
    currentActive: lawyer.current_active,
    maxInFlight: lawyer.max_in_flight,
    status: lawyer.status,
  }
}

export function slugifyLegalId(name: string, fallback: string): string {
  const normalized = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48)
  if (normalized && /^[a-z][a-z0-9_-]*$/.test(normalized)) {
    return normalized
  }
  return fallback
}

export function initialsFromName(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function isLocalTrainingExampleId(id: string): boolean {
  return id.startsWith('ex-') || id.startsWith('custom:')
}

export function mapLetterTypeConfigToUpdate(draft: LetterTypeConfig) {
  return {
    name: draft.nameFallback,
    color_id: draft.colorId,
    sla_days: draft.slaDays,
    description: draft.descriptionFallback || null,
    keyword_hints: draft.keywordHints,
  }
}

export async function syncLetterTypeDraft(draft: LetterTypeConfig, original: LetterTypeConfig) {
  await legalApi.updateLetterType(draft.id, mapLetterTypeConfigToUpdate(draft))
  await legalApi.replaceLetterTypePriorities(draft.id, {
    priorities: draft.priorities.map((priority) => ({
      lawyer_id: priority.lawyerId,
      stars: priority.stars,
      role: priority.role,
    })),
  })

  const originalExamples = original.examples.filter((example) => !example.isPlaceholder)
  const draftExamples = draft.examples.filter((example) => !example.isPlaceholder)
  const draftExampleIds = new Set(draftExamples.map((example) => example.id))

  for (const example of originalExamples) {
    if (!draftExampleIds.has(example.id) && !isLocalTrainingExampleId(example.id)) {
      await legalApi.deleteTrainingExample(draft.id, example.id)
    }
  }

  for (const example of draftExamples) {
    const payload = {
      title: example.titleFallback,
      body: example.bodyFallback,
      source: example.sourceFallback || null,
      is_placeholder: example.isPlaceholder ?? false,
    }
    if (isLocalTrainingExampleId(example.id)) {
      await legalApi.createTrainingExample(draft.id, payload)
      continue
    }
    const previous = originalExamples.find((item) => item.id === example.id)
    if (
      !previous ||
      previous.titleFallback !== example.titleFallback ||
      previous.bodyFallback !== example.bodyFallback ||
      previous.sourceFallback !== example.sourceFallback ||
      previous.isPlaceholder !== example.isPlaceholder
    ) {
      await legalApi.updateTrainingExample(draft.id, example.id, payload)
    }
  }
}
