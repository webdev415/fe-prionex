import type { MailboxFormValues } from '@/pages/LawyerWorkplace/components/settings/mailboxes/MailboxModal'
import type { ReplyTemplateFormValues } from '@/pages/LawyerWorkplace/components/settings/templates/ReplyTemplateModal'
import type {
  DepartmentSyncSettings,
  LawyerPriorityRole,
  LetterTypeConfig,
  MailboxRoutingRule,
  SettingsLawyer,
  SettingsMailbox,
  SettingsReplyTemplate,
  TrainingExample,
} from '@/pages/LawyerWorkplace/settings/types'
import { legalApi } from './legalApi'
import type {
  LegalDepartmentSyncSettings,
  LegalLawyer,
  LegalLetterType,
  LegalMailboxRoutingRuleInput,
  LegalReplyTemplate,
  LegalSettingsMailbox,
  LegalTrainingExample,
} from './types'

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
    isActive: item.is_active,
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isUuid(value: string): boolean {
  return UUID_RE.test(value)
}

function mapRoutingRuleToInput(rule: MailboxRoutingRule): LegalMailboxRoutingRuleInput {
  return {
    ...(isUuid(rule.id) ? { id: rule.id } : {}),
    match_type: rule.matchType,
    value: rule.value,
    letter_type_id: rule.letterTypeId,
  }
}

export function mapLegalSettingsMailboxToSettings(mailbox: LegalSettingsMailbox): SettingsMailbox {
  return {
    id: mailbox.id,
    email: mailbox.email,
    displayNameKey: `api:mailbox:name:${mailbox.id}`,
    displayNameFallback: mailbox.display_name,
    status: mailbox.status,
    provider: mailbox.provider === 'gmail_oauth2' ? 'google_workspace' : mailbox.provider,
    letterCount: mailbox.letter_count,
    defaultLetterTypeId: mailbox.default_letter_type_id,
    isDefaultOutgoing: mailbox.is_default_outgoing,
    hasCredentials: mailbox.has_credentials,
    routingRules: mailbox.routing_rules.map((rule) => ({
      id: rule.id,
      matchType: rule.match_type,
      value: rule.value,
      letterTypeId: rule.letter_type_id,
    })),
  }
}

export function mapSyncSettingsToUi(settings: LegalDepartmentSyncSettings): DepartmentSyncSettings {
  return {
    interval: settings.sync_interval,
    lastSyncedAt: settings.last_synced_at ?? '',
  }
}

export function mapMailboxFormToCreate(values: MailboxFormValues) {
  const base = {
    email: values.email.trim().toLowerCase(),
    display_name: values.displayName.trim(),
    provider: values.provider,
    default_letter_type_id: null,
    is_default_outgoing: false,
    routing_rules: values.routingRules.map(mapRoutingRuleToInput),
    sync_from_today: values.syncFromToday,
  }

  if (values.provider === 'custom') {
    return {
      ...base,
      password: values.password,
      imap_host: values.imapHost,
      imap_port: values.imapPort,
      imap_use_ssl: values.imapUseSsl,
      smtp_host: values.smtpHost,
      smtp_port: values.smtpPort,
      smtp_use_tls: values.smtpUseTls,
    }
  }

  return { ...base, password: values.password }
}

export function mapMailboxFormToUpdate(values: MailboxFormValues) {
  const base = {
    email: values.email.trim().toLowerCase(),
    display_name: values.displayName.trim(),
    provider: values.provider,
    default_letter_type_id: null,
    is_default_outgoing: false,
    routing_rules: values.routingRules.map(mapRoutingRuleToInput),
  }

  const passwordPayload = values.password.trim() ? { password: values.password.trim() } : {}

  if (values.provider === 'custom') {
    return {
      ...base,
      ...passwordPayload,
      imap_host: values.imapHost,
      imap_port: values.imapPort,
      imap_use_ssl: values.imapUseSsl,
      smtp_host: values.smtpHost,
      smtp_port: values.smtpPort,
      smtp_use_tls: values.smtpUseTls,
    }
  }

  return { ...base, ...passwordPayload }
}

export function mapLegalReplyTemplateToSettings(
  template: LegalReplyTemplate
): SettingsReplyTemplate {
  return {
    id: template.id,
    nameKey: `api:reply-template:name:${template.id}`,
    nameFallback: template.name,
    bodyKey: `api:reply-template:body:${template.id}`,
    bodyFallback: template.body,
    letterTypeIds: [...template.letter_type_ids],
    isActive: template.is_active,
  }
}

export function mapReplyTemplateFormToCreate(values: ReplyTemplateFormValues) {
  return {
    name: values.name.trim(),
    body: values.body,
    letter_type_ids: values.letterTypeIds,
    is_active: true,
  }
}

export function mapReplyTemplateFormToUpdate(values: ReplyTemplateFormValues) {
  return {
    name: values.name.trim(),
    body: values.body,
    letter_type_ids: values.letterTypeIds,
    is_active: true,
  }
}

export {
  applyLetterTemplatePlaceholders,
  applyReplyTemplatePlaceholders,
} from '../utils/letterTemplateVariables'
