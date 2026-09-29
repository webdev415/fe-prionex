import { describe, expect, it } from 'vitest'
import { isTriggerConfigIncomplete } from '../triggerConfig'

/**
 * KAN-711: a trigger saved without its field fires on every event of its type,
 * so "Add trigger" must stay disabled until that field is filled in.
 */
describe('isTriggerConfigIncomplete', () => {
  it('blocks the default form: tag_change with no tag chosen', () => {
    expect(isTriggerConfigIncomplete('tag_change', {})).toBe(true)
  })

  it.each([
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

  it.each(['date_reached', 'role_action'])('leaves %s alone, it has no field', (type) => {
    expect(isTriggerConfigIncomplete(type, {})).toBe(false)
  })
})
