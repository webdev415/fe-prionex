import type { SettingsReplyTemplate } from '../types'

export function cloneReplyTemplate(template: SettingsReplyTemplate): SettingsReplyTemplate {
  return { ...template, letterTypeIds: [...template.letterTypeIds] }
}
