/**
 * Tags Feature Types
 *
 * Type definitions for tags domain (backward-compatible + extended)
 */

export type TagCategory = 'status' | 'risk' | 'behavior' | 'communication' | 'system' | 'custom'
export type TagVisibility = 'ui' | 'analytics' | 'system' | 'hidden'
export type TagOrigin = 'system' | 'custom'
export type ExpiryType = 'permanent' | 'ttl' | 'loan_closure'

// Backward-compatible Tag interface
export interface Tag {
  id: number
  name: string
  color: string
  description?: string
  project_id: number
  project_name?: string
  client_count?: number
  category?: TagCategory
  is_protected?: boolean
  expiry_type?: ExpiryType
  created_at: string
}

// Extended tag definition (superset of Tag)

export interface TagDefinition extends Tag {
  code: string
  category: TagCategory
  visibility: TagVisibility
  origin: TagOrigin
  is_active: boolean
  default_ttl_hours?: number
  default_expires_at?: string
  mutex_group?: string
  requires_payload: boolean
  payload_schema?: Record<string, unknown>
  notification_enabled: boolean
  notification_template?: string
  notification_roles?: string[]
  is_protected: boolean
  protected_removal_roles: string[]
  expiry_type: ExpiryType
  /** Restrict to departments; omit / empty = all departments */
  department_ids?: number[] | null
  updated_at?: string
  is_deleted?: boolean
}

// Backward-compatible create (name, color, description)
export interface TagCreate {
  name: string
  color: string
  description?: string
}

// Extended create
export interface TagDefinitionCreate extends TagCreate {
  code?: string
  category?: TagCategory
  visibility?: TagVisibility
  is_active?: boolean
  default_ttl_hours?: number
  default_expires_at?: string
  mutex_group?: string
  requires_payload?: boolean
  payload_schema?: Record<string, unknown>
  notification_enabled?: boolean
  notification_template?: string
  notification_roles?: string[]
  is_protected?: boolean
  protected_removal_roles?: string[]
  expiry_type?: ExpiryType
  department_ids?: number[] | null
}

export interface TagUpdate {
  name?: string
  color?: string
  description?: string
}

export interface TagDefinitionUpdate extends TagUpdate {
  code?: string
  category?: TagCategory
  visibility?: TagVisibility
  is_active?: boolean
  default_ttl_hours?: number
  default_expires_at?: string | null
  mutex_group?: string
  requires_payload?: boolean
  payload_schema?: Record<string, unknown>
  notification_enabled?: boolean
  notification_template?: string
  notification_roles?: string[]
  is_protected?: boolean
  protected_removal_roles?: string[]
  expiry_type?: ExpiryType
  department_ids?: number[] | null
}

export interface TagsListResponse {
  tags: Tag[]
  total_count: number
}

// Tag Assignment
export interface TagAssignment {
  id: number
  client_id: number
  tag_definition_id: number
  project_id: number
  assigned_by_id?: number
  assigned_by_type: string
  expires_at?: string
  expiry_type: ExpiryType
  payload?: Record<string, unknown>
  is_active: boolean
  assigned_at: string
  tag_name?: string
  tag_color?: string
  tag_code?: string
  removal_status?: 'pending' | 'approved' | 'rejected' | null
  removal_requested_by?: number
  removal_requested_at?: string
  removal_request_reason?: string
}

export interface RemovalRequest {
  id: number
  client_id: number
  tag_definition_id: number
  project_id: number
  tag_name?: string
  tag_color?: string
  tag_code?: string
  removal_requested_by?: number
  removal_requested_at?: string
  removal_request_reason?: string
  removal_status: string
}

export interface TagAssignmentLog {
  id: number
  client_id: number
  tag_definition_id: number
  project_id: number
  action: string
  actor_id?: number
  actor_type: string
  reason?: string
  created_at: string
}

// Tag Rule
export type RuleTriggerType =
  | 'event'
  | 'schedule'
  | 'tag_expired'
  | 'scoring_change'
  | 'import_complete'
export type RuleActionType = 'add_tag' | 'remove_tag' | 'replace_tag'

export interface RuleCondition {
  field: string
  op: string
  value: unknown
}

export interface TagRule {
  id: number
  project_id: number
  name: string
  code?: string
  description?: string
  trigger_type: RuleTriggerType
  trigger_event?: string
  trigger_tag_code?: string
  cron_expression?: string
  conditions: RuleCondition[]
  action_type: RuleActionType
  target_tag_code: string
  replace_tag_code?: string
  priority: number
  is_active: boolean
  last_executed_at?: string
  execution_count: number
  created_at?: string
  updated_at?: string
  created_by: number
}

export interface TagRuleCreate {
  name: string
  code?: string
  description?: string
  trigger_type: RuleTriggerType
  trigger_event?: string
  trigger_tag_code?: string
  cron_expression?: string
  conditions: RuleCondition[]
  action_type: RuleActionType
  target_tag_code: string
  replace_tag_code?: string
  priority?: number
  is_active?: boolean
}

export interface TagRuleUpdate {
  name?: string
  code?: string
  description?: string
  trigger_type?: RuleTriggerType
  trigger_event?: string
  trigger_tag_code?: string
  cron_expression?: string
  conditions?: RuleCondition[]
  action_type?: RuleActionType
  target_tag_code?: string
  replace_tag_code?: string
  priority?: number
  is_active?: boolean
}

// Segment
export type SegmentRefreshMode = 'on_demand' | 'scheduled' | 'realtime'
export type ConditionType = 'has_tag' | 'not_has_tag' | 'tag_payload_field' | 'client_field'

export interface SegmentCondition {
  id?: number
  segment_id?: number
  group_index: number
  condition_type: ConditionType
  tag_code?: string
  field_name?: string
  operator: string
  value?: string
}

export interface Segment {
  id: number
  project_id: number
  name: string
  code: string
  description?: string
  refresh_mode: SegmentRefreshMode
  cached_client_count: number
  last_refreshed_at?: string
  is_active: boolean
  conditions: SegmentCondition[]
  created_at?: string
  updated_at?: string
}

export interface SegmentCreate {
  name: string
  code?: string
  description?: string
  refresh_mode?: SegmentRefreshMode
  conditions: Omit<SegmentCondition, 'id' | 'segment_id'>[]
}

export interface SegmentUpdate {
  name?: string
  description?: string
  refresh_mode?: SegmentRefreshMode
  is_active?: boolean
  conditions?: Omit<SegmentCondition, 'id' | 'segment_id'>[]
}

export interface SegmentPreview {
  client_count: number
  sample_client_ids: number[]
}

export interface SegmentClientsPage {
  total: number
  skip: number
  limit: number
  client_ids: number[]
}

// Client State
export interface ClientState {
  client_id: number
  project_id: number
  state: {
    risk_level?: string
    payment_status?: string
    communication_status?: string
    behavior_flags: string[]
    active_tag_codes: string[]
    active_tag_count: number
    promises: Array<{ tag_code: string; promise_date: string; amount?: number }>
    flags: string[]
    expiring_tags?: Array<{ tag_code: string; expires_at: string }>
  }
  active_tags: TagAssignment[]
  cached_at?: string
  is_stale: boolean
}
