/**
 * Preview helpers for text-based Document Templates.
 *
 * The variable *catalogue* is now served by the backend
 * (`GET /api/v1/documents/templates/variables`); this module only keeps the
 * pure helpers used to render the live preview of a text template body.
 */

import type { TemplateVariableDefinition } from '@/features/documents'

/** Replace every {{name}} in `body` with values from `mapping`. Unknown vars are left in place. */
export function substituteVariables(body: string, mapping: Record<string, string>): string {
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (full, key: string) =>
    Object.prototype.hasOwnProperty.call(mapping, key) ? mapping[key] : full
  )
}

/**
 * Build a `{ name: sample }` map from the server variable dictionary, used to
 * render sample values in the text-template live preview.
 */
export function buildSampleVariableMap(
  items: TemplateVariableDefinition[] | undefined
): Record<string, string> {
  const map: Record<string, string> = {}
  for (const v of items ?? []) {
    map[v.name] = v.sample
  }
  return map
}
