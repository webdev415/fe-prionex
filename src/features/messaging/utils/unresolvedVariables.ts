const DOUBLE_BRACE = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*\}\}/g
const SINGLE_BRACE = /\{\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*\}/g

export type PlaceholderSyntax = 'double' | 'single'

export function unresolvedVariables(
  text: string,
  values: Record<string, string | undefined>,
  syntax: PlaceholderSyntax
): string[] {
  const pattern = syntax === 'double' ? DOUBLE_BRACE : SINGLE_BRACE
  const missing: string[] = []

  for (const match of (text ?? '').matchAll(pattern)) {
    const name = match[1]
    if (!Object.prototype.hasOwnProperty.call(values, name)) continue
    const value = values[name]
    if ((value === undefined || value === '') && !missing.includes(name)) {
      missing.push(name)
    }
  }

  return missing
}

const CREDIT_DERIVED = ['contract_number', 'debt_amount', 'due_date']

export function blockingVariables(missing: string[]): string[] {
  return missing.filter((name) => CREDIT_DERIVED.includes(name))
}
