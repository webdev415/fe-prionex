import type {
  DepartmentSyncSettings,
  MailboxRoutingRule,
  SettingsMailbox,
  SyncInterval,
} from '../types'

let nextMailboxId = 100
let nextRuleId = 1000

export function cloneMailbox(mailbox: SettingsMailbox): SettingsMailbox {
  return {
    ...mailbox,
    routingRules: mailbox.routingRules.map((rule) => ({ ...rule })),
  }
}

export function createMailboxFromForm(input: {
  email: string
  displayName: string
  defaultLetterTypeId: string | null
  isDefaultOutgoing: boolean
}): SettingsMailbox {
  const id = `mb-${nextMailboxId++}`
  return {
    id,
    email: input.email.trim().toLowerCase(),
    displayNameKey: `custom-mailbox:${id}`,
    displayNameFallback: input.displayName.trim(),
    status: 'connected',
    provider: 'custom',
    letterCount: 0,
    defaultLetterTypeId: null,
    isDefaultOutgoing: input.isDefaultOutgoing,
    hasCredentials: false,
    routingRules: [],
  }
}

export function updateMailbox(
  mailboxes: SettingsMailbox[],
  mailboxId: string,
  patch: Partial<
    Pick<
      SettingsMailbox,
      | 'email'
      | 'displayNameFallback'
      | 'displayNameKey'
      | 'status'
      | 'defaultLetterTypeId'
      | 'isDefaultOutgoing'
      | 'routingRules'
    >
  >
): SettingsMailbox[] {
  return mailboxes.map((mailbox) => {
    if (mailbox.id !== mailboxId) {
      if (patch.isDefaultOutgoing) {
        return { ...mailbox, isDefaultOutgoing: false }
      }
      return mailbox
    }
    return { ...mailbox, ...patch }
  })
}

export function toggleMailboxStatus(
  mailboxes: SettingsMailbox[],
  mailboxId: string
): SettingsMailbox[] {
  return mailboxes.map((mailbox) => {
    if (mailbox.id !== mailboxId) return mailbox
    const nextStatus = mailbox.status === 'disabled' ? 'connected' : 'disabled'
    return { ...mailbox, status: nextStatus }
  })
}

export function upsertRoutingRule(
  mailbox: SettingsMailbox,
  rule: MailboxRoutingRule
): SettingsMailbox {
  const exists = mailbox.routingRules.some((item) => item.id === rule.id)
  return {
    ...mailbox,
    routingRules: exists
      ? mailbox.routingRules.map((item) => (item.id === rule.id ? rule : item))
      : [...mailbox.routingRules, rule],
  }
}

export function removeRoutingRule(mailbox: SettingsMailbox, ruleId: string): SettingsMailbox {
  return {
    ...mailbox,
    routingRules: mailbox.routingRules.filter((rule) => rule.id !== ruleId),
  }
}

export function createRoutingRule(
  letterTypeId: string,
  matchType: MailboxRoutingRule['matchType'],
  value: string,
  isActive = true,
  action: MailboxRoutingRule['action'] = 'assign_type'
): MailboxRoutingRule {
  return {
    id: `rule-${nextRuleId++}`,
    matchType,
    // Default rules carry no value; only domain/keyword rules have one.
    value: matchType === 'default' ? '' : value.trim(),
    // A move_to_working rule carries no letter type.
    letterTypeId: action === 'move_to_working' ? '' : letterTypeId,
    action,
    isActive,
    priority: 0,
  }
}

// Identification precedence: sender domain → subject keyword → default fallback.
const ROUTING_MATCH_RANK: Record<MailboxRoutingRule['matchType'], number> = {
  sender_domain: 0,
  subject_keyword: 1,
  default: 2,
}

/**
 * Order rules by identification precedence (stable within the same match type),
 * so the table always reads domain rules first and the fallback last.
 */
export function sortRoutingRules(rules: MailboxRoutingRule[]): MailboxRoutingRule[] {
  return rules
    .map((rule, index) => ({ rule, index }))
    .sort((a, b) => {
      const rankDiff = ROUTING_MATCH_RANK[a.rule.matchType] - ROUTING_MATCH_RANK[b.rule.matchType]
      return rankDiff !== 0 ? rankDiff : a.index - b.index
    })
    .map((entry) => entry.rule)
}

/**
 * Sort the rules and re-stamp `priority` from their position, giving the
 * backend a deterministic order on every replace-write.
 */
export function withReindexedPriority(rules: MailboxRoutingRule[]): MailboxRoutingRule[] {
  return sortRoutingRules(rules).map((rule, index) => ({ ...rule, priority: index }))
}

export function getConnectedMailboxCount(mailboxes: SettingsMailbox[]): number {
  return mailboxes.filter((mailbox) => mailbox.status === 'connected').length
}

export function getSyncIntervalLabelKey(interval: SyncInterval): string {
  return `pages.lawyerWorkplace.settings.mailboxes.sync.intervals.${interval}`
}

export function cloneSyncSettings(settings: DepartmentSyncSettings): DepartmentSyncSettings {
  return { ...settings }
}
