import { describe, expect, it } from 'vitest'
import { unresolvedVariables } from '../unresolvedVariables'

const resolved = {
  client_name: 'Olena',
  contract_number: '1-60-2413',
  debt_amount: '15 817,54',
  due_date: '01.10.2026',
  operator_phone: '',
}

describe('finding the variables a message still has no value for', () => {
  it('reads the double-brace form the message modal uses', () => {
    expect(unresolvedVariables('Contract {{contract_number}}', { contract_number: '' })).toEqual([
      'contract_number',
    ])
  })

  it('reads the single-brace form the sms templates use', () => {
    expect(unresolvedVariables('Contract {contract_number}', { contract_number: '' })).toEqual([
      'contract_number',
    ])
  })

  it('catches due_date, which depends on the selected credit', () => {
    expect(unresolvedVariables('Pay by {{due_date}}', { ...resolved, due_date: '' })).toEqual([
      'due_date',
    ])
  })

  it('says nothing when every referenced variable has a value', () => {
    expect(
      unresolvedVariables('Hi {{client_name}}, contract {{contract_number}}', resolved)
    ).toEqual([])
  })

  it('ignores variables the message never mentions', () => {
    expect(unresolvedVariables('Hi {{client_name}}', resolved)).toEqual([])
  })

  it('reports each missing variable once, in the order it appears', () => {
    const text = '{{contract_number}} {{due_date}} {{contract_number}}'
    expect(unresolvedVariables(text, { contract_number: '', due_date: '' })).toEqual([
      'contract_number',
      'due_date',
    ])
  })

  it('tolerates padding and an empty message', () => {
    expect(unresolvedVariables('{{ debt_amount }}', { debt_amount: '' })).toEqual(['debt_amount'])
    expect(unresolvedVariables('', resolved)).toEqual([])
  })
})
