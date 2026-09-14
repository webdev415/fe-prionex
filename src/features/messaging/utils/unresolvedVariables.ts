const PLACEHOLDER = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*\}\}|\{\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*\}/g

export function unresolvedVariables(
  text: string,
  values: Record<string, string | undefined>
): string[] {
  const missing: string[] = []
  for (const match of (text ?? '').matchAll(PLACEHOLDER)) {
    const name = match[1] ?? match[2]
    const value = values[name]
    if ((value === undefined || value === '') && !missing.includes(name)) {
      missing.push(name)
    }
  }
  return missing
}
