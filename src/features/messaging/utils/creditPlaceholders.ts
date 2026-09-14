const CREDIT_PLACEHOLDER = /\{\{?\s*(contract_number|debt_amount)\s*\}?\}/

export function mentionsCreditVariable(text: string): boolean {
  return CREDIT_PLACEHOLDER.test(text ?? '')
}
