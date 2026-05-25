/** Replace `{{variable}}` tokens (messaging draft syntax). */
export function renderMessagingTemplate(
  templateText: string,
  variables: Record<string, string | undefined>
): string {
  if (!templateText) return ''

  return templateText.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*\}\}/g, (match, varName) => {
    const value = variables[varName]
    return value !== undefined && value !== '' ? value : match
  })
}
