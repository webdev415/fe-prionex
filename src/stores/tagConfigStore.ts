/**
 * Tag Configuration Store
 *
 * Manages dynamic dropdown options for tags, rules, and segments.
 * MVP: persisted in localStorage via Zustand persist — per-browser only.
 * TODO: migrate to backend API for system-wide settings shared across all users.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface ConfigItem {
  value: string
  label: string
  translations?: Record<string, string>
}

export type EventFieldOptionsSource =
  | 'interactionResults'
  | 'interactionTypes'
  | 'interactionChannels'
  | 'interactionDirections'

export interface EventField {
  value: string
  label: string
  type: 'select' | 'text' | 'number'
  options?: ConfigItem[]
  optionsSource?: EventFieldOptionsSource
}

export interface EventConfig {
  value: string
  label: string
  fields: EventField[]
}

export interface RulePreset {
  key: string
  name: string
  description: string
  trigger_type: string
  trigger_event?: string
  cron_expression?: string
  conditions: Array<{ field: string; op: string; value: string }>
  action_type: string
  target_tag_code: string
  replace_tag_code?: string
}

export interface SegmentPreset {
  key: string
  name: string
  code: string
  description: string
  refresh_mode: string
  conditions: Array<{
    condition_type: string
    tag_code?: string
    field_name?: string
    group_index: number
    operator?: string
    value?: string
  }>
}

interface TagConfigState {
  // Dictionary settings
  categories: ConfigItem[]
  visibilities: ConfigItem[]
  expiryTypes: ConfigItem[]
  presetColors: string[]

  // Rule settings
  triggerTypes: ConfigItem[]
  availableEvents: EventConfig[]
  actionTypes: ConfigItem[]
  conditionFields: ConfigItem[]
  operators: ConfigItem[]
  rulePresets: RulePreset[]

  // Segment settings
  refreshModes: ConfigItem[]
  segmentPresets: SegmentPreset[]

  // CRUD operations
  addItem: (listKey: string, item: ConfigItem) => void
  removeItem: (listKey: string, value: string) => void
  updateItem: (listKey: string, oldValue: string, newItem: ConfigItem) => void
  addEvent: (event: EventConfig) => void
  removeEvent: (eventValue: string) => void
  updateEvent: (oldEventValue: string, event: EventConfig) => void
  addEventField: (eventValue: string, field: EventField) => void
  removeEventField: (eventValue: string, fieldValue: string) => void
  updateEventField: (eventValue: string, oldFieldValue: string, field: EventField) => void
  addEventFieldOption: (eventValue: string, fieldValue: string, option: ConfigItem) => void
  removeEventFieldOption: (eventValue: string, fieldValue: string, optionValue: string) => void
  updateEventFieldOption: (
    eventValue: string,
    fieldValue: string,
    oldOptionValue: string,
    option: ConfigItem
  ) => void
  addColor: (color: string) => void
  removeColor: (color: string) => void
  removePreset: (listKey: 'rulePresets' | 'segmentPresets', key: string) => void
  addSegmentPreset: (preset: SegmentPreset) => void
  updateSegmentPreset: (oldKey: string, preset: SegmentPreset) => void
  resetToDefaults: () => void
  /**
   * Replace all config sections with values from backend (PR2-BE).
   * Unknown keys are ignored; missing keys keep current state. Safe to call
   * on every successful useTagSettings fetch.
   */
  loadFromServer: (value: Record<string, unknown>) => void
}

const DEFAULT_INTERACTION_RESULT_OPTIONS: ConfigItem[] = [
  { value: 'No contact', label: 'No contact' },
  { value: 'Refusal to pay', label: 'Refusal to pay' },
  { value: 'Agreement', label: 'Agreement' },
  { value: 'Call back by appointment', label: 'Call back by appointment' },
  { value: 'Consent to interact', label: 'Consent to interact' },
  { value: 'Waiting for a call', label: 'Waiting for a call' },
  { value: 'Hanged up', label: 'Hanged up' },
  { value: 'Request for documents', label: 'Request for documents' },
  { value: 'Disconnected', label: 'Disconnected' },
  { value: 'Refused payment', label: 'Refused payment' },
  { value: 'Will provide information', label: 'Will provide information' },
  { value: 'Will not provide information', label: 'Will not provide information' },
  { value: 'Refused consent to interact', label: 'Refused consent to interact' },
  { value: 'Threatens', label: 'Threatens' },
  { value: 'Sent documents', label: 'Sent documents' },
  { value: 'No numbers', label: 'No numbers' },
  { value: 'Numbers found', label: 'Numbers found' },
]

const DEFAULT_AVAILABLE_EVENTS: EventConfig[] = [
  {
    value: 'interaction.created',
    label: 'Interaction created',
    fields: [
      {
        value: 'result_name',
        label: 'result_name',
        type: 'select',
        optionsSource: 'interactionResults',
        options: DEFAULT_INTERACTION_RESULT_OPTIONS,
      },
      {
        value: 'type_code',
        label: 'type_code',
        type: 'select',
        optionsSource: 'interactionTypes',
        options: [
          { value: 'INCOMING', label: 'INCOMING' },
          { value: 'OUTGOING', label: 'OUTGOING' },
          { value: 'SEARCHING', label: 'SEARCHING' },
        ],
      },
      {
        value: 'channel',
        label: 'channel',
        type: 'select',
        optionsSource: 'interactionChannels',
        options: [
          { value: 'call', label: 'call' },
          { value: 'messenger', label: 'messenger' },
          { value: 'mail', label: 'mail' },
          { value: 'chat', label: 'chat' },
        ],
      },
      {
        value: 'direction',
        label: 'direction',
        type: 'select',
        optionsSource: 'interactionDirections',
        options: [
          { value: 'inbound', label: 'inbound' },
          { value: 'outbound', label: 'outbound' },
          { value: 'system', label: 'system' },
        ],
      },
    ],
  },
  {
    value: 'payment.verified',
    label: 'Payment verified',
    fields: [
      { value: 'payment_id', label: 'payment_id', type: 'number' },
      { value: 'payment_number', label: 'payment_number', type: 'text' },
      { value: 'debt_id', label: 'debt_id', type: 'number' },
      { value: 'amount', label: 'amount', type: 'number' },
      { value: 'payment_method', label: 'payment_method', type: 'text' },
      { value: 'payment_date', label: 'payment_date', type: 'text' },
      { value: 'status', label: 'status', type: 'text' },
      { value: 'verified_by_user_id', label: 'verified_by_user_id', type: 'number' },
      { value: 'verified_at', label: 'verified_at', type: 'text' },
      { value: 'remaining_debt', label: 'remaining_debt', type: 'number' },
    ],
  },
  {
    value: 'sms.sent',
    label: 'SMS sent',
    fields: [
      { value: 'sms_id', label: 'sms_id', type: 'number' },
      { value: 'message_id', label: 'message_id', type: 'text' },
      { value: 'phone_number', label: 'phone_number', type: 'text' },
      { value: 'template_name', label: 'template_name', type: 'text' },
      { value: 'segments', label: 'segments', type: 'number' },
      { value: 'gateway_provider', label: 'gateway_provider', type: 'text' },
      { value: 'status', label: 'status', type: 'text' },
    ],
  },
  {
    value: 'call.outcome.updated',
    label: 'Call outcome updated',
    fields: [
      { value: 'call_id', label: 'call_id', type: 'text' },
      { value: 'outcome', label: 'outcome', type: 'text' },
      { value: 'disposition', label: 'disposition', type: 'text' },
      { value: 'direction', label: 'direction', type: 'text' },
      { value: 'agent_extension', label: 'agent_extension', type: 'text' },
    ],
  },
  {
    value: 'scoring.completed',
    label: 'Scoring completed',
    fields: [
      { value: 'score', label: 'score', type: 'number' },
      { value: 'risk_score', label: 'risk_score', type: 'number' },
      { value: 'previous_score', label: 'previous_score', type: 'number' },
      { value: 'score_change', label: 'score_change', type: 'number' },
      { value: 'algorithm_version', label: 'algorithm_version', type: 'text' },
      { value: 'calculation_reason', label: 'calculation_reason', type: 'text' },
    ],
  },
  {
    value: 'client.imported',
    label: 'Client imported',
    fields: [
      { value: 'tax_id', label: 'tax_id', type: 'text' },
      { value: 'status', label: 'status', type: 'text' },
      { value: 'import_batch_id', label: 'import_batch_id', type: 'text' },
    ],
  },
  {
    value: 'debt.created',
    label: 'Debt created',
    fields: [
      { value: 'debt_id', label: 'debt_id', type: 'number' },
      { value: 'amount', label: 'amount', type: 'number' },
      { value: 'contract_number', label: 'contract_number', type: 'text' },
      { value: 'status', label: 'status', type: 'text' },
    ],
  },
  {
    value: 'debt.updated',
    label: 'Debt updated',
    fields: [
      { value: 'debt_id', label: 'debt_id', type: 'number' },
      { value: 'old_amount', label: 'old_amount', type: 'number' },
      { value: 'new_amount', label: 'new_amount', type: 'number' },
      { value: 'old_status', label: 'old_status', type: 'text' },
      { value: 'new_status', label: 'new_status', type: 'text' },
      { value: 'contract_number', label: 'contract_number', type: 'text' },
    ],
  },
  {
    value: 'client.created',
    label: 'Client created',
    fields: [
      { value: 'tax_id', label: 'tax_id', type: 'text' },
      { value: 'status', label: 'status', type: 'text' },
      { value: 'source', label: 'source', type: 'text' },
    ],
  },
  {
    value: 'payment.received',
    label: 'Payment received',
    fields: [
      { value: 'payment_id', label: 'payment_id', type: 'number' },
      { value: 'payment_number', label: 'payment_number', type: 'text' },
      { value: 'debt_id', label: 'debt_id', type: 'number' },
      { value: 'amount', label: 'amount', type: 'number' },
      { value: 'payment_method', label: 'payment_method', type: 'text' },
      { value: 'payment_date', label: 'payment_date', type: 'text' },
      { value: 'status', label: 'status', type: 'text' },
      { value: 'recorded_by_user_id', label: 'recorded_by_user_id', type: 'number' },
    ],
  },
  {
    value: 'payment.debt_closed',
    label: 'Debt closed',
    fields: [
      { value: 'payment_id', label: 'payment_id', type: 'number' },
      { value: 'payment_number', label: 'payment_number', type: 'text' },
      { value: 'debt_id', label: 'debt_id', type: 'number' },
      { value: 'amount', label: 'amount', type: 'number' },
      { value: 'payment_method', label: 'payment_method', type: 'text' },
      { value: 'payment_date', label: 'payment_date', type: 'text' },
      { value: 'status', label: 'status', type: 'text' },
      { value: 'verified_by_user_id', label: 'verified_by_user_id', type: 'number' },
      { value: 'verified_at', label: 'verified_at', type: 'text' },
      { value: 'remaining_debt', label: 'remaining_debt', type: 'number' },
    ],
  },
  {
    value: 'scoring.calculated',
    label: 'Scoring calculated',
    fields: [
      { value: 'score', label: 'score', type: 'number' },
      { value: 'risk_score', label: 'risk_score', type: 'number' },
      { value: 'previous_score', label: 'previous_score', type: 'number' },
      { value: 'score_change', label: 'score_change', type: 'number' },
      { value: 'algorithm_version', label: 'algorithm_version', type: 'text' },
      { value: 'calculation_reason', label: 'calculation_reason', type: 'text' },
    ],
  },
]

export const DEFAULT_EVENT_LABELS = Object.fromEntries(
  DEFAULT_AVAILABLE_EVENTS.map((event) => [event.value, event.label])
) as Record<string, string>

const DEFAULT_CONFIG = {
  categories: [
    { value: 'custom', label: 'Custom' },
    { value: 'status', label: 'Status' },
    { value: 'risk', label: 'Risk' },
    { value: 'behavior', label: 'Behavior' },
    { value: 'communication', label: 'Communication' },
    { value: 'system', label: 'System' },
  ],
  visibilities: [
    { value: 'ui', label: 'UI' },
    { value: 'analytics', label: 'Analytics' },
    { value: 'system', label: 'System' },
  ],
  expiryTypes: [
    { value: 'permanent', label: 'Permanent' },
    { value: 'ttl', label: 'TTL' },
    { value: 'loan_closure', label: 'Loan Closure' },
  ],
  presetColors: [
    '#FF6B6B',
    '#4ECDC4',
    '#45B7D1',
    '#FFA07A',
    '#98D8C8',
    '#F7DC6F',
    '#BB8FCE',
    '#85C1E2',
    '#80D80A',
    '#FF9D00',
    '#DC2626',
    '#DFDFDF',
  ],
  triggerTypes: [
    { value: 'event', label: 'Event' },
    { value: 'schedule', label: 'Schedule' },
    { value: 'tag_expired', label: 'Tag Expired' },
    { value: 'scoring_change', label: 'Scoring Change' },
    { value: 'import_complete', label: 'Import Complete' },
  ],
  // Events with payload fields — must match backend DomainEventPublisher routing keys
  availableEvents: DEFAULT_AVAILABLE_EVENTS,
  actionTypes: [
    { value: 'add_tag', label: 'Add tag' },
    { value: 'remove_tag', label: 'Remove tag' },
    { value: 'replace_tag', label: 'Replace tag' },
  ],
  conditionFields: [
    { value: 'risk_score', label: 'Risk Score' },
    { value: 'days_past_due', label: 'Days Past Due' },
    { value: 'total_debt', label: 'Total Debt' },
    { value: 'remaining_debt', label: 'Remaining Debt' },
    { value: 'debt_count', label: 'Debt Count' },
    { value: 'status', label: 'Status' },
    { value: 'has_tag', label: 'Has Tag' },
    { value: 'not_has_tag', label: 'Not Has Tag' },
  ],
  operators: [
    { value: 'eq', label: '= (equals)' },
    { value: 'ne', label: '!= (not equals)' },
    { value: 'gt', label: '> (greater)' },
    { value: 'gte', label: '>= (greater or equal)' },
    { value: 'lt', label: '< (less)' },
    { value: 'lte', label: '<= (less or equal)' },
    { value: 'contains', label: '~ (contains)' },
    { value: 'in', label: 'in (list)' },
    { value: 'not_in', label: '!in (not in list)' },
  ],
  refreshModes: [
    { value: 'on_demand', label: 'On Demand' },
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'realtime', label: 'Realtime' },
  ],
  rulePresets: [
    {
      key: 'auto_high_risk',
      name: 'Auto-tag High Risk',
      description: 'Automatically tag clients as high risk when scoring exceeds threshold',
      trigger_type: 'event',
      trigger_event: 'scoring.completed',
      conditions: [{ field: 'risk_score', op: 'gte', value: '80' }],
      action_type: 'add_tag',
      target_tag_code: 'high_risk',
    },
    {
      key: 'remove_high_risk',
      name: 'Remove High Risk',
      description: 'Remove high risk tag when scoring drops below threshold',
      trigger_type: 'event',
      trigger_event: 'scoring.completed',
      conditions: [{ field: 'risk_score', op: 'lt', value: '80' }],
      action_type: 'remove_tag',
      target_tag_code: 'high_risk',
    },
    {
      key: 'mark_active_debtor',
      name: 'Mark Active Debtors',
      description: 'Daily: tag clients with past-due balances as active debtors',
      trigger_type: 'schedule',
      cron_expression: '0 6 * * *',
      conditions: [{ field: 'days_past_due', op: 'gt', value: '0' }],
      action_type: 'add_tag',
      target_tag_code: 'active_debtor',
    },
    {
      key: 'mark_paid_off',
      name: 'Mark Paid Off',
      description: 'Tag client as paid off when full payment is received',
      trigger_type: 'event',
      trigger_event: 'payment.verified',
      conditions: [{ field: 'remaining_debt', op: 'eq', value: '0' }],
      action_type: 'add_tag',
      target_tag_code: 'paid_off',
    },
    {
      key: 'broken_promise',
      name: 'Broken Promise to Pay',
      description: 'Daily: replace promise_to_pay with refuses_to_pay when >30 days past due',
      trigger_type: 'schedule',
      cron_expression: '0 8 * * *',
      conditions: [
        { field: 'has_tag', op: 'eq', value: 'promise_to_pay' },
        { field: 'days_past_due', op: 'gt', value: '30' },
      ],
      action_type: 'replace_tag',
      target_tag_code: 'refuses_to_pay',
      replace_tag_code: 'promise_to_pay',
    },
    {
      key: 'no_contact_retry',
      name: 'Retry No Contact',
      description: 'Daily: clear no_contact tag after 7+ days past due to retry contact',
      trigger_type: 'schedule',
      cron_expression: '0 9 * * *',
      conditions: [
        { field: 'has_tag', op: 'eq', value: 'no_contact' },
        { field: 'days_past_due', op: 'gt', value: '7' },
      ],
      action_type: 'remove_tag',
      target_tag_code: 'no_contact',
    },
  ],
  segmentPresets: [
    {
      key: 'high_risk',
      name: 'High Risk Active Debtors',
      code: 'high_risk_active',
      description: 'Clients with high risk and active debt status',
      refresh_mode: 'on_demand',
      conditions: [
        { condition_type: 'has_tag', tag_code: 'high_risk', group_index: 0 },
        { condition_type: 'has_tag', tag_code: 'active_debtor', group_index: 0 },
      ],
    },
    {
      key: 'promise_to_pay',
      name: 'Promise to Pay',
      code: 'promise_to_pay',
      description: 'Clients who promised to pay but have not paid off yet',
      refresh_mode: 'on_demand',
      conditions: [
        { condition_type: 'has_tag', tag_code: 'promise_to_pay', group_index: 0 },
        { condition_type: 'not_has_tag', tag_code: 'paid_off', group_index: 0 },
      ],
    },
    {
      key: 'no_contact',
      name: 'No Contact',
      code: 'no_contact_active',
      description: 'Active debtors who could not be reached',
      refresh_mode: 'on_demand',
      conditions: [
        { condition_type: 'has_tag', tag_code: 'no_contact', group_index: 0 },
        { condition_type: 'has_tag', tag_code: 'active_debtor', group_index: 0 },
      ],
    },
    {
      key: 'refuses_to_pay',
      name: 'Refuses to Pay',
      code: 'refuses_to_pay',
      description: 'Clients who refuse to pay, not yet in legal proceedings',
      refresh_mode: 'on_demand',
      conditions: [
        { condition_type: 'has_tag', tag_code: 'refuses_to_pay', group_index: 0 },
        { condition_type: 'not_has_tag', tag_code: 'legal_proceedings', group_index: 0 },
      ],
    },
    {
      key: 'legal',
      name: 'Legal Proceedings',
      code: 'legal_proceedings',
      description: 'Clients currently in legal proceedings',
      refresh_mode: 'on_demand',
      conditions: [{ condition_type: 'has_tag', tag_code: 'legal_proceedings', group_index: 0 }],
    },
    {
      key: 'new_no_risk',
      name: 'New Without Risk',
      code: 'new_no_risk',
      description: 'New clients without high or medium risk assessment',
      refresh_mode: 'on_demand',
      conditions: [
        { condition_type: 'has_tag', tag_code: 'new_client', group_index: 0 },
        { condition_type: 'not_has_tag', tag_code: 'high_risk', group_index: 0 },
        { condition_type: 'not_has_tag', tag_code: 'medium_risk', group_index: 0 },
      ],
    },
  ],
}

type ListKey = keyof Omit<
  TagConfigState,
  | 'presetColors'
  | 'rulePresets'
  | 'segmentPresets'
  | 'availableEvents'
  | 'addItem'
  | 'removeItem'
  | 'updateItem'
  | 'addEvent'
  | 'removeEvent'
  | 'updateEvent'
  | 'addEventField'
  | 'removeEventField'
  | 'updateEventField'
  | 'addEventFieldOption'
  | 'removeEventFieldOption'
  | 'updateEventFieldOption'
  | 'addColor'
  | 'removeColor'
  | 'removePreset'
  | 'addSegmentPreset'
  | 'updateSegmentPreset'
  | 'resetToDefaults'
>

function cloneConfigItems(items: ConfigItem[] | undefined): ConfigItem[] {
  return (items ?? []).map((item) => ({
    value: String(item.value ?? '').trim(),
    label: String(item.label ?? item.value ?? '').trim(),
  }))
}

function normalizeEventField(field: EventField): EventField {
  return {
    value: String(field.value ?? '').trim(),
    label: String(field.label ?? field.value ?? '').trim(),
    type: field.type ?? 'text',
    optionsSource: field.optionsSource,
    options: cloneConfigItems(field.options),
  }
}

function normalizeEventConfig(event: EventConfig): EventConfig {
  const eventValue = String(event.value ?? '').trim()
  const normalizedFields = (event.fields ?? [])
    .map(normalizeEventField)
    .filter((field) => field.value.length > 0)
  const defaultFields =
    DEFAULT_AVAILABLE_EVENTS.find((item) => item.value === eventValue)?.fields.map(
      normalizeEventField
    ) ?? []
  const mergedFields = new Map(defaultFields.map((field) => [field.value, field]))

  for (const field of normalizedFields) {
    mergedFields.set(field.value, field)
  }

  return {
    value: eventValue,
    label: String(event.label ?? event.value ?? '').trim(),
    fields: Array.from(mergedFields.values()),
  }
}

function cloneEventConfigs(events: EventConfig[]): EventConfig[] {
  return events.map(normalizeEventConfig)
}

function normalizeSegmentPreset(preset: SegmentPreset): SegmentPreset {
  const code = String(preset.code ?? '').trim()
  const key = String(preset.key ?? code).trim() || code

  return {
    key,
    name: String(preset.name ?? '').trim(),
    code,
    description: String(preset.description ?? '').trim(),
    refresh_mode: String(preset.refresh_mode ?? 'on_demand').trim() || 'on_demand',
    conditions: (preset.conditions ?? []).map((condition) => ({
      condition_type: String(condition.condition_type ?? 'has_tag').trim() || 'has_tag',
      tag_code: condition.tag_code ? String(condition.tag_code).trim() : undefined,
      field_name: condition.field_name ? String(condition.field_name).trim() : undefined,
      group_index: Number.isFinite(condition.group_index) ? condition.group_index : 0,
      operator: condition.operator ? String(condition.operator).trim() : undefined,
      value: condition.value ? String(condition.value).trim() : undefined,
    })),
  }
}

function normalizeSegmentPresets(rawSegmentPresets: unknown): SegmentPreset[] {
  if (!Array.isArray(rawSegmentPresets)) {
    return DEFAULT_CONFIG.segmentPresets.map(normalizeSegmentPreset)
  }

  const normalized = rawSegmentPresets
    .map((item) => {
      if (typeof item !== 'object' || item === null) {
        return null
      }

      return normalizeSegmentPreset(item as SegmentPreset)
    })
    .filter(
      (preset): preset is SegmentPreset =>
        preset !== null && preset.key.length > 0 && preset.code.length > 0 && preset.name.length > 0
    )

  if (normalized.length === 0) {
    return DEFAULT_CONFIG.segmentPresets.map(normalizeSegmentPreset)
  }

  return normalized
}

function normalizeOperators(items: ConfigItem[]): ConfigItem[] {
  const deduped = new Map<string, ConfigItem>()

  for (const item of items) {
    const value = item.value === 'neq' ? 'ne' : item.value
    if (!deduped.has(value)) {
      deduped.set(value, { ...item, value })
    }
  }

  return Array.from(deduped.values())
}

function normalizeAvailableEventsState(rawAvailableEvents: unknown): EventConfig[] {
  if (!Array.isArray(rawAvailableEvents)) {
    return cloneEventConfigs(DEFAULT_AVAILABLE_EVENTS)
  }

  const normalized = rawAvailableEvents
    .map((item) => {
      if (typeof item !== 'object' || item === null) {
        return null
      }

      const eventLike = item as Partial<EventConfig> & { fields?: unknown }
      const fields = Array.isArray(eventLike.fields) ? eventLike.fields : []

      if (
        fields.length === 0 &&
        typeof eventLike.value === 'string' &&
        typeof eventLike.label === 'string'
      ) {
        const defaultEvent = DEFAULT_AVAILABLE_EVENTS.find(
          (event) => event.value === eventLike.value
        )
        return normalizeEventConfig({
          value: eventLike.value,
          label: eventLike.label,
          fields: defaultEvent?.fields ?? [],
        })
      }

      return normalizeEventConfig({
        value: String(eventLike.value ?? ''),
        label: String(eventLike.label ?? eventLike.value ?? ''),
        fields: fields as EventField[],
      })
    })
    .filter((event): event is EventConfig => event !== null && event.value.length > 0)

  if (normalized.length === 0) {
    return cloneEventConfigs(DEFAULT_AVAILABLE_EVENTS)
  }

  const merged = new Map(
    DEFAULT_AVAILABLE_EVENTS.map((event) => [event.value, normalizeEventConfig(event)])
  )

  for (const event of normalized) {
    merged.set(event.value, normalizeEventConfig(event))
  }

  return Array.from(merged.values())
}

function cloneDefaultConfig() {
  return {
    ...DEFAULT_CONFIG,
    categories: cloneConfigItems(DEFAULT_CONFIG.categories),
    visibilities: cloneConfigItems(DEFAULT_CONFIG.visibilities),
    expiryTypes: cloneConfigItems(DEFAULT_CONFIG.expiryTypes),
    presetColors: [...DEFAULT_CONFIG.presetColors],
    triggerTypes: cloneConfigItems(DEFAULT_CONFIG.triggerTypes),
    availableEvents: cloneEventConfigs(DEFAULT_CONFIG.availableEvents),
    actionTypes: cloneConfigItems(DEFAULT_CONFIG.actionTypes),
    conditionFields: cloneConfigItems(DEFAULT_CONFIG.conditionFields),
    operators: cloneConfigItems(DEFAULT_CONFIG.operators),
    refreshModes: cloneConfigItems(DEFAULT_CONFIG.refreshModes),
    rulePresets: DEFAULT_CONFIG.rulePresets.map((preset) => ({
      ...preset,
      conditions: preset.conditions.map((condition) => ({ ...condition })),
    })),
    segmentPresets: DEFAULT_CONFIG.segmentPresets.map(normalizeSegmentPreset),
  }
}

export const useTagConfigStore = create<TagConfigState>()(
  persist(
    (set) => ({
      ...cloneDefaultConfig(),

      addItem: (listKey: string, item: ConfigItem) =>
        set((state) => {
          const list = state[listKey as ListKey]
          if (!Array.isArray(list)) return state
          if (list.some((i) => i.value === item.value)) return state
          return { [listKey]: [...list, item] }
        }),

      removeItem: (listKey: string, value: string) =>
        set((state) => {
          const list = state[listKey as ListKey]
          if (!Array.isArray(list)) return state
          return { [listKey]: list.filter((i) => i.value !== value) }
        }),

      updateItem: (listKey: string, oldValue: string, newItem: ConfigItem) =>
        set((state) => {
          const list = state[listKey as ListKey]
          if (!Array.isArray(list)) return state
          return {
            [listKey]: list.map((i) => (i.value === oldValue ? newItem : i)),
          }
        }),

      addEvent: (event: EventConfig) =>
        set((state) => {
          const normalized = normalizeEventConfig(event)
          if (!normalized.value) return state
          if (state.availableEvents.some((item) => item.value === normalized.value)) return state
          return {
            availableEvents: [...state.availableEvents, normalized],
          }
        }),

      removeEvent: (eventValue: string) =>
        set((state) => ({
          availableEvents: state.availableEvents.filter((event) => event.value !== eventValue),
        })),

      updateEvent: (oldEventValue: string, event: EventConfig) =>
        set((state) => {
          const normalized = normalizeEventConfig(event)
          if (!normalized.value) return state
          if (
            oldEventValue !== normalized.value &&
            state.availableEvents.some((item) => item.value === normalized.value)
          ) {
            return state
          }

          return {
            availableEvents: state.availableEvents.map((item) =>
              item.value === oldEventValue ? normalized : item
            ),
          }
        }),

      addEventField: (eventValue: string, field: EventField) =>
        set((state) => {
          const normalized = normalizeEventField(field)
          if (!normalized.value) return state

          return {
            availableEvents: state.availableEvents.map((event) => {
              if (event.value !== eventValue) return event
              if (event.fields.some((item) => item.value === normalized.value)) return event
              return {
                ...event,
                fields: [...event.fields, normalized],
              }
            }),
          }
        }),

      removeEventField: (eventValue: string, fieldValue: string) =>
        set((state) => ({
          availableEvents: state.availableEvents.map((event) =>
            event.value === eventValue
              ? {
                  ...event,
                  fields: event.fields.filter((field) => field.value !== fieldValue),
                }
              : event
          ),
        })),

      updateEventField: (eventValue: string, oldFieldValue: string, field: EventField) =>
        set((state) => {
          const normalized = normalizeEventField(field)
          if (!normalized.value) return state

          return {
            availableEvents: state.availableEvents.map((event) => {
              if (event.value !== eventValue) return event
              if (
                oldFieldValue !== normalized.value &&
                event.fields.some((item) => item.value === normalized.value)
              ) {
                return event
              }

              return {
                ...event,
                fields: event.fields.map((item) =>
                  item.value === oldFieldValue ? normalized : item
                ),
              }
            }),
          }
        }),

      addEventFieldOption: (eventValue: string, fieldValue: string, option: ConfigItem) =>
        set((state) => {
          const normalizedOption = cloneConfigItems([option])[0]
          if (!normalizedOption?.value) return state

          return {
            availableEvents: state.availableEvents.map((event) => {
              if (event.value !== eventValue) return event

              return {
                ...event,
                fields: event.fields.map((field) => {
                  if (field.value !== fieldValue) return field
                  const options = field.options ?? []
                  if (options.some((item) => item.value === normalizedOption.value)) return field
                  return {
                    ...field,
                    options: [...options, normalizedOption],
                  }
                }),
              }
            }),
          }
        }),

      removeEventFieldOption: (eventValue: string, fieldValue: string, optionValue: string) =>
        set((state) => ({
          availableEvents: state.availableEvents.map((event) => {
            if (event.value !== eventValue) return event

            return {
              ...event,
              fields: event.fields.map((field) =>
                field.value === fieldValue
                  ? {
                      ...field,
                      options: (field.options ?? []).filter(
                        (option) => option.value !== optionValue
                      ),
                    }
                  : field
              ),
            }
          }),
        })),

      updateEventFieldOption: (
        eventValue: string,
        fieldValue: string,
        oldOptionValue: string,
        option: ConfigItem
      ) =>
        set((state) => {
          const normalizedOption = cloneConfigItems([option])[0]
          if (!normalizedOption?.value) return state

          return {
            availableEvents: state.availableEvents.map((event) => {
              if (event.value !== eventValue) return event

              return {
                ...event,
                fields: event.fields.map((field) => {
                  if (field.value !== fieldValue) return field
                  if (
                    oldOptionValue !== normalizedOption.value &&
                    (field.options ?? []).some((item) => item.value === normalizedOption.value)
                  ) {
                    return field
                  }

                  return {
                    ...field,
                    options: (field.options ?? []).map((item) =>
                      item.value === oldOptionValue ? normalizedOption : item
                    ),
                  }
                }),
              }
            }),
          }
        }),

      addColor: (color: string) =>
        set((state) => {
          if (state.presetColors.includes(color)) return state
          return { presetColors: [...state.presetColors, color] }
        }),

      removeColor: (color: string) =>
        set((state) => ({
          presetColors: state.presetColors.filter((c) => c !== color),
        })),

      removePreset: (listKey: 'rulePresets' | 'segmentPresets', key: string) =>
        set((state) => ({
          [listKey]: state[listKey].filter((p) => p.key !== key),
        })),

      addSegmentPreset: (preset: SegmentPreset) =>
        set((state) => {
          const normalized = normalizeSegmentPreset(preset)
          if (!normalized.key || !normalized.code || !normalized.name) return state
          if (state.segmentPresets.some((item) => item.key === normalized.key)) return state

          return {
            segmentPresets: [...state.segmentPresets, normalized],
          }
        }),

      updateSegmentPreset: (oldKey: string, preset: SegmentPreset) =>
        set((state) => {
          const normalized = normalizeSegmentPreset(preset)
          if (!normalized.key || !normalized.code || !normalized.name) return state
          if (
            oldKey !== normalized.key &&
            state.segmentPresets.some((item) => item.key === normalized.key)
          ) {
            return state
          }

          return {
            segmentPresets: state.segmentPresets.map((item) =>
              item.key === oldKey ? normalized : item
            ),
          }
        }),

      resetToDefaults: () => set(cloneDefaultConfig()),

      loadFromServer: (value) =>
        set((state) => {
          if (!value || typeof value !== 'object') return state
          const next: Partial<TagConfigState> = {}
          const known: Array<keyof TagConfigState> = [
            'categories',
            'visibilities',
            'expiryTypes',
            'presetColors',
            'triggerTypes',
            'availableEvents',
            'actionTypes',
            'conditionFields',
            'operators',
            'refreshModes',
            'rulePresets',
            'segmentPresets',
          ]
          for (const key of known) {
            const incoming = (value as Record<string, unknown>)[key]
            if (incoming !== undefined) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ;(next as Record<string, unknown>)[key] = incoming as any
            }
          }
          return { ...state, ...next }
        }),
    }),
    {
      name: 'tag-config-storage',
      version: 4,
      migrate: (persistedState) => {
        const state = persistedState as Partial<TagConfigState> | undefined
        if (!state) return cloneDefaultConfig()

        return {
          ...cloneDefaultConfig(),
          ...state,
          availableEvents: normalizeAvailableEventsState(state.availableEvents),
          operators: Array.isArray(state.operators)
            ? normalizeOperators(state.operators)
            : cloneConfigItems(DEFAULT_CONFIG.operators),
          segmentPresets: normalizeSegmentPresets(state.segmentPresets),
        }
      },
    }
  )
)
