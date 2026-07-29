export type SettingsSubTab = 'letterTypes' | 'lawyers' | 'mailboxes' | 'routing' | 'templates'

export type LawyerPriorityRole = 'primary' | 'backup' | 'secondary' | 'off'

/**
 * How the response-SLA countdown treats the day count.
 *   - `working`  — business days only (weekends excluded).
 *   - `calendar` — plain calendar days.
 * Backend defaults to `calendar`; the field is optional on the wire for
 * backward compatibility with older payloads.
 */
export type SlaDayType = 'working' | 'calendar'

export type LawyerStatus = 'online' | 'away'

export interface LetterTypeColorOption {
  id: string
  dotClass: string
  bgClass: string
  textClass: string
  ringClass: string
}

export interface TrainingExample {
  id: string
  titleKey: string
  titleFallback: string
  bodyKey: string
  bodyFallback: string
  sourceKey: string
  sourceFallback: string
  isPlaceholder?: boolean
}

export interface LetterTypePriorityAssignment {
  lawyerId: string
  stars: number
  role: LawyerPriorityRole
}

export interface LetterTypeConfig {
  id: string
  slug: string
  nameKey: string
  nameFallback: string
  colorId: string
  slaDays: number
  slaDayType: SlaDayType
  descriptionKey: string
  descriptionFallback: string
  letterCount: number
  examples: TrainingExample[]
  priorities: LetterTypePriorityAssignment[]
  keywordHints: string[]
  isActive: boolean
}

export interface SettingsLawyer {
  id: string
  initials: string
  nameKey: string
  nameFallback: string
  roleKey: string
  roleFallback: string
  letterTypeIds: string[]
  currentActive: number
  maxInFlight: number
  status: LawyerStatus
}

export type MailboxStatus = 'connected' | 'error' | 'disabled'

export type SyncInterval = '15m' | '30m' | '1h' | '4h' | 'daily'

export type RoutingMatchType = 'sender_domain' | 'subject_keyword' | 'default'

export interface MailboxRoutingRule {
  id: string
  matchType: RoutingMatchType
  value: string
  letterTypeId: string
  isActive: boolean
  priority: number
}

export type MailboxProvider = 'ukrnet' | 'iua' | 'google_workspace' | 'microsoft365' | 'custom'

export interface SettingsMailbox {
  id: string
  email: string
  displayNameKey: string
  displayNameFallback: string
  status: MailboxStatus
  provider: MailboxProvider
  letterCount: number
  defaultLetterTypeId: string | null
  routingRules: MailboxRoutingRule[]
  isDefaultOutgoing: boolean
  hasCredentials: boolean
}

export interface DepartmentSyncSettings {
  interval: SyncInterval
  lastSyncedAt: string
}

export interface SettingsReplyTemplate {
  id: string
  nameKey: string
  nameFallback: string
  bodyKey: string
  bodyFallback: string
  letterTypeIds: string[]
  isActive: boolean
}
