import { describe, expect, it } from 'vitest'
import { mentionsCreditVariable } from '../creditPlaceholders'

describe('spotting a message that needs a credit', () => {
  it('sees the double-brace form the message modal uses', () => {
    expect(mentionsCreditVariable('Contract {{contract_number}} is overdue')).toBe(true)
    expect(mentionsCreditVariable('You owe {{debt_amount}}')).toBe(true)
  })

  it('sees the single-brace form the sms templates use', () => {
    expect(mentionsCreditVariable('Contract {contract_number} is overdue')).toBe(true)
    expect(mentionsCreditVariable('You owe {debt_amount}')).toBe(true)
  })

  it('tolerates padding inside the braces', () => {
    expect(mentionsCreditVariable('{{ contract_number }}')).toBe(true)
  })

  it('ignores messages that need no credit', () => {
    expect(mentionsCreditVariable('Hello {{client_name}}, please call us')).toBe(false)
    expect(mentionsCreditVariable('Call {operator_phone}')).toBe(false)
    expect(mentionsCreditVariable('')).toBe(false)
  })
})
