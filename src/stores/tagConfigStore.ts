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
  conditions: Array<{
    condition_type: string
    tag_code?: string
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
  availableEvents: ConfigItem[]
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
  addColor: (color: string) => void
  removeColor: (color: string) => void
  removePreset: (listKey: 'rulePresets' | 'segmentPresets', key: string) => void
  resetToDefaults: () => void
}

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
  // Canonical event names — must match backend DomainEventPublisher routing keys
  availableEvents: [
    { value: 'interaction.created', label: 'Interaction created' },
    { value: 'payment.verified', label: 'Payment verified' },
    { value: 'sms.sent', label: 'SMS sent' },
    { value: 'call.outcome.updated', label: 'Call outcome updated' },
    { value: 'scoring.completed', label: 'Scoring completed' },
    { value: 'client.imported', label: 'Client imported' },
  ],
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
    { value: 'neq', label: '!= (not equals)' },
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
      conditions: [{ condition_type: 'has_tag', tag_code: 'legal_proceedings', group_index: 0 }],
    },
    {
      key: 'new_no_risk',
      name: 'New Without Risk',
      code: 'new_no_risk',
      description: 'New clients without high or medium risk assessment',
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
  | 'addItem'
  | 'removeItem'
  | 'updateItem'
  | 'addColor'
  | 'removeColor'
  | 'removePreset'
  | 'resetToDefaults'
>

export const useTagConfigStore = create<TagConfigState>()(
  persist(
    (set) => ({
      ...DEFAULT_CONFIG,

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

      resetToDefaults: () => set(DEFAULT_CONFIG),
    }),
    {
      name: 'tag-config-storage',
      version: 1,
    }
  )
)
