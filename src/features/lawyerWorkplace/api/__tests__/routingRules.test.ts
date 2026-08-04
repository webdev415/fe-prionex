import { describe, it, expect } from 'vitest'
import type { MailboxRoutingRule } from '@/pages/LawyerWorkplace/settings/types'
import { mapLegalSettingsMailboxToSettings, mapRoutingRulesToUpdate } from '../settingsMappers'
import type { LegalSettingsMailbox } from '../types'

const UUID = '11111111-1111-4111-8111-111111111111'

function baseMailbox(routingRules: LegalSettingsMailbox['routing_rules']): LegalSettingsMailbox {
  return {
    id: 'mb-1',
    email: 'legal@prionex.ua',
    display_name: 'Legal',
    status: 'connected',
    provider: 'custom',
    letter_count: 0,
    default_letter_type_id: null,
    is_default_outgoing: false,
    has_credentials: true,
    routing_rules: routingRules,
  }
}

describe('mapRoutingRulesToUpdate', () => {
  it('sends is_active and priority, and only sends id for persisted (UUID) rules', () => {
    const rules: MailboxRoutingRule[] = [
      {
        id: UUID,
        matchType: 'sender_domain',
        value: 'vchasno.ua',
        letterTypeId: 'court',
        isActive: true,
        priority: 0,
        action: 'assign_type',
      },
      {
        id: 'rule-1001',
        matchType: 'default',
        value: '',
        letterTypeId: 'other',
        isActive: false,
        priority: 1,
        action: 'assign_type',
      },
    ]

    expect(mapRoutingRulesToUpdate(rules)).toEqual({
      routing_rules: [
        {
          id: UUID,
          match_type: 'sender_domain',
          value: 'vchasno.ua',
          letter_type_id: 'court',
          is_active: true,
          priority: 0,
          action: 'assign_type',
        },
        {
          match_type: 'default',
          value: '',
          letter_type_id: 'other',
          is_active: false,
          priority: 1,
          action: 'assign_type',
        },
      ],
    })
  })
})

describe('mapLegalSettingsMailboxToSettings routing rules', () => {
  it('passes through is_active and priority when present', () => {
    const result = mapLegalSettingsMailboxToSettings(
      baseMailbox([
        {
          id: UUID,
          match_type: 'subject_keyword',
          value: 'позовна заява',
          letter_type_id: 'court',
          is_active: false,
          priority: 3,
        },
      ])
    )

    expect(result.routingRules[0]).toEqual({
      id: UUID,
      matchType: 'subject_keyword',
      value: 'позовна заява',
      letterTypeId: 'court',
      action: 'assign_type',
      isActive: false,
      priority: 3,
    })
  })

  it('defaults is_active to true and priority to 0 for older backends', () => {
    const result = mapLegalSettingsMailboxToSettings(
      baseMailbox([
        {
          id: UUID,
          match_type: 'sender_domain',
          value: 'vchasno.ua',
          letter_type_id: 'court',
        },
      ])
    )

    expect(result.routingRules[0].isActive).toBe(true)
    expect(result.routingRules[0].priority).toBe(0)
  })
})

describe('routing rule move_to_working action', () => {
  it('serializes a move_to_working rule with null letter_type_id', () => {
    const rules: MailboxRoutingRule[] = [
      {
        id: UUID,
        matchType: 'sender_domain',
        value: 'parked.example.com',
        letterTypeId: '',
        action: 'move_to_working',
        isActive: true,
        priority: 0,
      },
    ]

    expect(mapRoutingRulesToUpdate(rules).routing_rules[0]).toMatchObject({
      match_type: 'sender_domain',
      value: 'parked.example.com',
      action: 'move_to_working',
      letter_type_id: null,
    })
  })

  it('maps a move_to_working response rule to an empty letterTypeId', () => {
    const result = mapLegalSettingsMailboxToSettings(
      baseMailbox([
        {
          id: UUID,
          match_type: 'sender_domain',
          value: 'parked.example.com',
          letter_type_id: null,
          action: 'move_to_working',
        },
      ])
    )

    expect(result.routingRules[0]).toMatchObject({
      action: 'move_to_working',
      letterTypeId: '',
    })
  })
})
