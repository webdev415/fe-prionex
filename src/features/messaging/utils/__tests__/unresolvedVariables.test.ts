import { describe, expect, it } from 'vitest'
import { blockingVariables, unresolvedVariables } from '../unresolvedVariables'

const resolved = {
  client_name: 'Olena',
  contract_number: '1-60-2413',
  debt_amount: '15 817,54',
  due_date: '01.10.2026',
}

describe('finding the variables a message still has no value for', () => {
  it('reads the double-brace form the message modal renders', () => {
    expect(
      unresolvedVariables('Contract {{contract_number}}', { contract_number: '' }, 'double')
    ).toEqual(['contract_number'])
  })

  it('reads the single-brace form the sms templates render', () => {
    expect(
      unresolvedVariables('Contract {contract_number}', { contract_number: '' }, 'single')
    ).toEqual(['contract_number'])
  })

  it('reports any variable the caller left empty, whatever it is', () => {
    expect(
      unresolvedVariables('Pay by {{operator_name}}', { operator_name: '' }, 'double')
    ).toEqual(['operator_name'])
  })

  it('ignores single braces when scanning for the double-brace renderer', () => {
    expect(
      unresolvedVariables('Item {contract_number}', { contract_number: '' }, 'double')
    ).toEqual([])
  })

  it('flags what the single-brace renderer would itself substitute', () => {
    expect(unresolvedVariables('{{contract_number}}', { contract_number: '' }, 'single')).toEqual([
      'contract_number',
    ])
  })

  it('ignores tokens the app does not build, so stray braces cannot block a send', () => {
    expect(unresolvedVariables('Ref {{promo_code}} and {{n}}', resolved, 'double')).toEqual([])
  })

  it('does not treat inherited object members as variables', () => {
    expect(unresolvedVariables('{{constructor}} {{toString}}', resolved, 'double')).toEqual([])
  })

  it('says nothing when every referenced variable has a value', () => {
    expect(
      unresolvedVariables('Hi {{client_name}}, contract {{contract_number}}', resolved, 'double')
    ).toEqual([])
  })

  it('reports each missing variable once, in the order it appears', () => {
    const text = '{{contract_number}} {{due_date}} {{contract_number}}'
    expect(unresolvedVariables(text, { contract_number: '', due_date: '' }, 'double')).toEqual([
      'contract_number',
      'due_date',
    ])
  })

  it('tolerates padding and an empty message', () => {
    expect(unresolvedVariables('{{ debt_amount }}', { debt_amount: '' }, 'double')).toEqual([
      'debt_amount',
    ])
    expect(unresolvedVariables('', resolved, 'double')).toEqual([])
  })

  it('blocks only on variables that choosing a credit can fill', () => {
    expect(blockingVariables(['contract_number', 'debt_amount'])).toEqual([
      'contract_number',
      'debt_amount',
    ])
  })

  it('does not block on due_date, which a credit cannot always supply', () => {
    expect(blockingVariables(['due_date'])).toEqual([])
    expect(blockingVariables(['contract_number', 'due_date'])).toEqual(['contract_number'])
  })

  it('does not block on a variable the operator cannot supply here', () => {
    expect(blockingVariables(['operator_phone', 'operator_name'])).toEqual([])
  })

  it('still reports the unblocking ones so the operator is warned', () => {
    const missing = unresolvedVariables('{{operator_phone}}', { operator_phone: '' }, 'double')

    expect(missing).toEqual(['operator_phone'])
    expect(blockingVariables(missing)).toEqual([])
  })
})
