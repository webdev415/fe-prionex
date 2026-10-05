import { describe, expect, it } from 'vitest'
import {
  TRIGGER_TYPES,
  type TriggerType,
  buildTriggerConfig,
  isTriggerConfigIncomplete,
} from '../triggerConfig'

/**
 * KAN-711: a trigger saved without its field fires on every event of its type,
 * so "Add trigger" must stay disabled until that field is filled in.
 */
describe('isTriggerConfigIncomplete', () => {
  it('blocks the default form: the first type with no field chosen', () => {
    expect(TRIGGER_TYPES[0]).toBe('tag_change')
    expect(isTriggerConfigIncomplete(TRIGGER_TYPES[0], {})).toBe(true)
  })

  it.each<[TriggerType, string, string]>([
    ['tag_change', 'tag_id', '12'],
    ['call_result', 'result_code', 'no_answer'],
    ['debt_status', 'status', 'overdue'],
    ['chain_completed', 'source_chain_id', '3'],
  ])('requires %s to carry %s', (type, field, value) => {
    expect(isTriggerConfigIncomplete(type, {})).toBe(true)
    expect(isTriggerConfigIncomplete(type, { [field]: value })).toBe(false)
  })

  it('treats a blank result code as missing', () => {
    expect(isTriggerConfigIncomplete('call_result', { result_code: '   ' })).toBe(true)
  })

  it('does not accept a field that belongs to another type', () => {
    expect(isTriggerConfigIncomplete('tag_change', { status: 'overdue' })).toBe(true)
  })

  // No backend event source for these yet; see REQUIRED_TRIGGER_FIELD.
  it.each<TriggerType>(['date_reached', 'role_action'])(
    'leaves %s alone, the backend has no event for it yet',
    (type) => {
      expect(isTriggerConfigIncomplete(type, {})).toBe(false)
    }
  )
})

describe('buildTriggerConfig', () => {
  it('sends the result code trimmed, so it can match the backend code', () => {
    expect(buildTriggerConfig({ result_code: '  no_answer ' })).toEqual({
      result_code: 'no_answer',
    })
  })

  it('sends ids as numbers', () => {
    expect(buildTriggerConfig({ tag_id: '12' })).toEqual({ tag_id: 12 })
    expect(buildTriggerConfig({ source_chain_id: '3' })).toEqual({ source_chain_id: 3 })
  })

  it('sends the debt status as chosen', () => {
    expect(buildTriggerConfig({ status: 'overdue' })).toEqual({ status: 'overdue' })
  })

  it('drops blank values instead of sending them', () => {
    expect(buildTriggerConfig({ result_code: '   ' })).toEqual({})
    expect(buildTriggerConfig({})).toEqual({})
  })

  it('never sends a config the guard would have blocked', () => {
    // Whatever passes the guard must still carry its field after building.
    for (const [type, field, value] of [
      ['tag_change', 'tag_id', '12'],
      ['call_result', 'result_code', ' x '],
      ['debt_status', 'status', 'active'],
      ['chain_completed', 'source_chain_id', '3'],
    ] as const) {
      const form = { [field]: value }
      expect(isTriggerConfigIncomplete(type, form)).toBe(false)
      expect(buildTriggerConfig(form)).toHaveProperty(field)
    }
  })
})
