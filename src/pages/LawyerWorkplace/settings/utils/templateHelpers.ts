import type { DocumentPresetType, SettingsDocumentPreset, SettingsReplyTemplate } from '../types'

let nextReplyTemplateId = 100
let nextDocumentPresetId = 100

export function cloneReplyTemplate(template: SettingsReplyTemplate): SettingsReplyTemplate {
  return { ...template, letterTypeIds: [...template.letterTypeIds] }
}

export function cloneDocumentPreset(preset: SettingsDocumentPreset): SettingsDocumentPreset {
  return { ...preset }
}

export function createReplyTemplateFromForm(input: {
  name: string
  body: string
  letterTypeIds: string[]
}): SettingsReplyTemplate {
  const id = `rt-${nextReplyTemplateId++}`
  return {
    id,
    nameKey: `custom-reply:${id}`,
    nameFallback: input.name.trim(),
    bodyKey: `custom-reply-body:${id}`,
    bodyFallback: input.body.trim(),
    letterTypeIds: [...input.letterTypeIds],
    isActive: true,
  }
}

export function updateReplyTemplate(
  templates: SettingsReplyTemplate[],
  templateId: string,
  patch: Partial<
    Pick<
      SettingsReplyTemplate,
      'nameFallback' | 'nameKey' | 'bodyFallback' | 'bodyKey' | 'letterTypeIds' | 'isActive'
    >
  >
): SettingsReplyTemplate[] {
  return templates.map((template) =>
    template.id === templateId ? { ...template, ...patch } : template
  )
}

export function toggleReplyTemplateActive(
  templates: SettingsReplyTemplate[],
  templateId: string
): SettingsReplyTemplate[] {
  return templates.map((template) =>
    template.id === templateId ? { ...template, isActive: !template.isActive } : template
  )
}

export function createDocumentPresetFromForm(input: {
  name: string
  documentType: DocumentPresetType
  defaultAssigneeId: string | null
}): SettingsDocumentPreset {
  const id = `dp-${nextDocumentPresetId++}`
  return {
    id,
    nameKey: `custom-preset:${id}`,
    nameFallback: input.name.trim(),
    documentType: input.documentType,
    defaultAssigneeId: input.defaultAssigneeId,
    isActive: true,
  }
}

export function updateDocumentPreset(
  presets: SettingsDocumentPreset[],
  presetId: string,
  patch: Partial<
    Pick<
      SettingsDocumentPreset,
      'nameFallback' | 'nameKey' | 'documentType' | 'defaultAssigneeId' | 'isActive'
    >
  >
): SettingsDocumentPreset[] {
  return presets.map((preset) => (preset.id === presetId ? { ...preset, ...patch } : preset))
}

export function toggleDocumentPresetActive(
  presets: SettingsDocumentPreset[],
  presetId: string
): SettingsDocumentPreset[] {
  return presets.map((preset) =>
    preset.id === presetId ? { ...preset, isActive: !preset.isActive } : preset
  )
}

export function getActiveReplyTemplates(
  templates: SettingsReplyTemplate[]
): SettingsReplyTemplate[] {
  return templates.filter((template) => template.isActive)
}

export function getActiveDocumentPresets(
  presets: SettingsDocumentPreset[],
  documentType?: DocumentPresetType
): SettingsDocumentPreset[] {
  return presets.filter(
    (preset) => preset.isActive && (documentType ? preset.documentType === documentType : true)
  )
}
