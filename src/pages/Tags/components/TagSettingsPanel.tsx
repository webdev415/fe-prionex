/**
 * TagSettingsPanel
 *
 * Admin panel for managing tag system configuration:
 * dropdown options, events, conditions, and mutex groups.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useTagConfigStore } from '@/stores/tagConfigStore'
import { ConfigListEditor } from './ConfigListEditor'
import { Icons } from '@/lib/icons'
import { Button } from '@/components/ui/Button'
import type { TagDefinition } from '@/features/tags'

interface TagSettingsPanelProps {
  mutexGroups: Record<string, { tags: TagDefinition[]; totalClients: number }>
  isLoading: boolean
  onCreateGroup: () => void
}

type SectionId = 'dictionary' | 'rules' | 'segments' | 'groups'

export function TagSettingsPanel({ mutexGroups, isLoading, onCreateGroup }: TagSettingsPanelProps) {
  const { t } = useTranslation('common')
  const [openSection, setOpenSection] = useState<SectionId | null>('dictionary')

  const config = useTagConfigStore()

  const toggleSection = (id: SectionId) => {
    setOpenSection((prev) => (prev === id ? null : id))
  }

  const sections: Array<{
    id: SectionId
    title: string
    icon: React.ReactNode
    count: number
  }> = [
    {
      id: 'dictionary',
      title: t('pages.tags.settings.dictionarySettings', 'Tag Dictionary'),
      icon: <Icons.Brochure size={18} strokeWidth={1.5} />,
      count: config.categories.length + config.visibilities.length + config.expiryTypes.length,
    },
    {
      id: 'rules',
      title: t('pages.tags.settings.ruleSettings', 'Rules'),
      icon: <Icons.Setting07 size={18} strokeWidth={1.5} />,
      count:
        config.triggerTypes.length +
        config.availableEvents.length +
        config.actionTypes.length +
        config.conditionFields.length,
    },
    {
      id: 'segments',
      title: t('pages.tags.settings.segmentSettings', 'Segments'),
      icon: <Icons.UserMultiple size={18} strokeWidth={1.5} />,
      count: config.refreshModes.length,
    },
    {
      id: 'groups',
      title: t('pages.tags.settings.mutexGroups', 'Mutex Groups'),
      icon: <Icons.ChartRing size={18} strokeWidth={1.5} />,
      count: Object.keys(mutexGroups).length,
    },
  ]

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          {t(
            'pages.tags.settings.description',
            'Manage dropdown options, events, and rule conditions. Changes apply immediately to all forms.'
          )}
        </p>
        <Button
          size="sm"
          variant="cancel"
          onClick={() => {
            if (
              window.confirm(
                t('pages.tags.settings.confirmReset', 'Reset all settings to defaults?')
              )
            ) {
              config.resetToDefaults()
            }
          }}
          className="text-xs"
        >
          {t('pages.tags.settings.resetDefaults', 'Reset defaults')}
        </Button>
      </div>

      {sections.map((section) => (
        <div
          key={section.id}
          className="overflow-hidden rounded-lg border border-gray-200 bg-white"
        >
          {/* Accordion header */}
          <button
            onClick={() => toggleSection(section.id)}
            className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50"
          >
            <span className="text-gray-500">{section.icon}</span>
            <span className="flex-1 text-sm font-medium text-gray-900">{section.title}</span>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
              {section.count}
            </span>
            <Icons.ArrowRight
              size={16}
              className={`text-gray-400 transition-transform ${openSection === section.id ? 'rotate-90' : ''}`}
              strokeWidth={1.5}
            />
          </button>

          {/* Accordion content */}
          {openSection === section.id && (
            <div className="border-t border-gray-100 px-4 py-4">
              {section.id === 'dictionary' && <DictionarySettings />}
              {section.id === 'rules' && <RuleSettings />}
              {section.id === 'segments' && <SegmentSettings />}
              {section.id === 'groups' && (
                <GroupsSettings
                  mutexGroups={mutexGroups}
                  isLoading={isLoading}
                  onCreateGroup={onCreateGroup}
                  t={t}
                />
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function DictionarySettings() {
  const config = useTagConfigStore()
  const { t } = useTranslation('common')

  return (
    <div className="space-y-6">
      <ConfigListEditor
        title={t('pages.tags.settings.categories', 'Categories')}
        description={t(
          'pages.tags.settings.categoriesDesc',
          'Tag grouping categories (status, risk, etc.)'
        )}
        items={config.categories}
        onAdd={(item) => config.addItem('categories', item)}
        onRemove={(value) => config.removeItem('categories', value)}
        onUpdate={(oldValue, newItem) => config.updateItem('categories', oldValue, newItem)}
        i18nPrefix="pages.tags.categories"
      />
      <ConfigListEditor
        title={t('pages.tags.settings.visibilities', 'Visibility levels')}
        items={config.visibilities}
        onAdd={(item) => config.addItem('visibilities', item)}
        onRemove={(value) => config.removeItem('visibilities', value)}
        onUpdate={(oldValue, newItem) => config.updateItem('visibilities', oldValue, newItem)}
        i18nPrefix="pages.tags.visibilities"
      />
      <ConfigListEditor
        title={t('pages.tags.settings.expiryTypes', 'Expiry types')}
        items={config.expiryTypes}
        onAdd={(item) => config.addItem('expiryTypes', item)}
        onRemove={(value) => config.removeItem('expiryTypes', value)}
        onUpdate={(oldValue, newItem) => config.updateItem('expiryTypes', oldValue, newItem)}
        i18nPrefix="pages.tags.expiryTypes"
      />
    </div>
  )
}

function RuleSettings() {
  const config = useTagConfigStore()
  const { t } = useTranslation('common')

  return (
    <div className="space-y-6">
      <ConfigListEditor
        title={t('pages.tags.settings.triggerTypes', 'Trigger types')}
        items={config.triggerTypes}
        onAdd={(item) => config.addItem('triggerTypes', item)}
        onRemove={(value) => config.removeItem('triggerTypes', value)}
        onUpdate={(oldValue, newItem) => config.updateItem('triggerTypes', oldValue, newItem)}
        i18nPrefix="pages.tags.rules.triggerTypes"
      />
      <ConfigListEditor
        title={t('pages.tags.settings.events', 'Available events')}
        description={t('pages.tags.settings.eventsDesc', 'System events that can trigger rules')}
        items={config.availableEvents}
        onAdd={(item) => config.addItem('availableEvents', item)}
        onRemove={(value) => config.removeItem('availableEvents', value)}
        onUpdate={(oldValue, newItem) => config.updateItem('availableEvents', oldValue, newItem)}
        showLabel
      />
      <ConfigListEditor
        title={t('pages.tags.settings.actionTypes', 'Action types')}
        items={config.actionTypes}
        onAdd={(item) => config.addItem('actionTypes', item)}
        onRemove={(value) => config.removeItem('actionTypes', value)}
        onUpdate={(oldValue, newItem) => config.updateItem('actionTypes', oldValue, newItem)}
        i18nPrefix="pages.tags.rules.actionTypes"
      />
      <ConfigListEditor
        title={t('pages.tags.settings.conditionFields', 'Condition fields')}
        description={t(
          'pages.tags.settings.conditionFieldsDesc',
          'Fields available for rule/segment conditions'
        )}
        items={config.conditionFields}
        onAdd={(item) => config.addItem('conditionFields', item)}
        onRemove={(value) => config.removeItem('conditionFields', value)}
        onUpdate={(oldValue, newItem) => config.updateItem('conditionFields', oldValue, newItem)}
        i18nPrefix="pages.tags.rules.conditionFields"
      />
      <ConfigListEditor
        title={t('pages.tags.settings.operators', 'Operators')}
        items={config.operators}
        onAdd={(item) => config.addItem('operators', item)}
        onRemove={(value) => config.removeItem('operators', value)}
        onUpdate={(oldValue, newItem) => config.updateItem('operators', oldValue, newItem)}
        i18nPrefix="pages.tags.segments.operators"
      />

      {/* Rule Presets */}
      <PresetList
        title={t('pages.tags.settings.rulePresets', 'Шаблоны правил')}
        description={t('pages.tags.settings.rulePresetsDesc', 'Быстрый старт для создания правил')}
        presets={config.rulePresets.map((p) => ({
          key: p.key,
          name: p.name,
          description: p.description,
          badge: t(`pages.tags.rules.triggerTypes.${p.trigger_type}`, p.trigger_type),
          badgeColor: 'bg-blue-50 text-blue-600',
          details: [
            `${t('pages.tags.rules.action', 'Действие')}: ${t(`pages.tags.rules.actionTypes.${p.action_type}`, p.action_type)}`,
            `${t('pages.tags.rules.targetTag', 'Тег')}: ${p.target_tag_code}`,
            ...p.conditions.map((c) => `${c.field} ${c.op} ${c.value}`),
          ],
        }))}
        onRemove={(key) => config.removePreset('rulePresets', key)}
        t={t}
      />
    </div>
  )
}

function SegmentSettings() {
  const config = useTagConfigStore()
  const { t } = useTranslation('common')

  return (
    <div className="space-y-6">
      <ConfigListEditor
        title={t('pages.tags.settings.refreshModes', 'Refresh modes')}
        items={config.refreshModes}
        onAdd={(item) => config.addItem('refreshModes', item)}
        onRemove={(value) => config.removeItem('refreshModes', value)}
        onUpdate={(oldValue, newItem) => config.updateItem('refreshModes', oldValue, newItem)}
        i18nPrefix="pages.tags.segments.refreshModes"
      />

      {/* Segment Presets */}
      <PresetList
        title={t('pages.tags.settings.segmentPresets', 'Шаблоны сегментов')}
        presets={config.segmentPresets.map((p) => ({
          key: p.key,
          name: p.name,
          description: p.description,
          badge: `${p.conditions.length} ${t('pages.tags.rules.conditions', 'условий')}`,
          badgeColor: 'bg-gray-50 text-gray-500',
          details: p.conditions.map(
            (c) =>
              `${c.condition_type}${c.tag_code ? ': ' + c.tag_code : ''}`
          ),
        }))}
        onRemove={(key) => config.removePreset('segmentPresets', key)}
        t={t}
      />
    </div>
  )
}

/** Reusable preset list with expand/collapse details */
function PresetList({
  title,
  description,
  presets,
  onRemove,
  t,
}: {
  title: string
  description?: string
  presets: Array<{
    key: string
    name: string
    description: string
    badge: string
    badgeColor: string
    details: string[]
  }>
  onRemove: (key: string) => void
  t: (key: string, fallback: string) => string
}) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null)

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-sm font-medium text-gray-900">{title}</h4>
        {description && <p className="mt-0.5 text-xs text-gray-500">{description}</p>}
      </div>
      <div className="divide-y divide-gray-100 rounded-md border border-gray-200">
        {presets.length === 0 && (
          <p className="px-3 py-4 text-center text-xs text-gray-400">
            {t('pages.tags.settings.noItems', 'Нет элементов')}
          </p>
        )}
        {presets.map((preset) => (
          <div key={preset.key} className="px-3 py-2">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setExpandedKey((prev) => (prev === preset.key ? null : preset.key))}
                className="min-w-0 flex-1 text-left"
              >
                <p className="truncate text-xs font-medium text-gray-900">{preset.name}</p>
                <p className="truncate text-[10px] text-gray-400">{preset.description}</p>
              </button>
              <code
                className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${preset.badgeColor}`}
              >
                {preset.badge}
              </code>
              <button
                onClick={() => onRemove(preset.key)}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-gray-400 hover:bg-red-50 hover:text-red-500"
                title={t('actions.delete', 'Удалить')}
              >
                <Icons.Cancel01 size={12} strokeWidth={1.5} />
              </button>
            </div>
            {expandedKey === preset.key && preset.details.length > 0 && (
              <div className="mt-2 space-y-0.5 rounded bg-gray-50 p-2">
                {preset.details.map((detail, i) => (
                  <p key={i} className="text-[10px] text-gray-600">
                    {detail}
                  </p>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function GroupsSettings({
  mutexGroups,
  isLoading,
  onCreateGroup,
  t,
}: {
  mutexGroups: Record<string, { tags: TagDefinition[]; totalClients: number }>
  isLoading: boolean
  onCreateGroup: () => void
  t: (key: string, fallback: string) => string
}) {
  const groupEntries = Object.entries(mutexGroups)

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        {t(
          'pages.tags.groups.mutexNote',
          'Only one tag from a mutex group can be active on a client at a time.'
        )}
      </p>

      {!isLoading && groupEntries.length === 0 && (
        <p className="py-4 text-center text-xs text-gray-400">
          {t('pages.tags.groups.noGroups', 'No mutex groups')}
        </p>
      )}

      {groupEntries.map(([groupName, group]) => (
        <div key={groupName} className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold text-gray-900">
                {t(`pages.tags.mutexGroupDescriptions.${groupName}`, groupName)}
              </h4>
              <code className="text-xs text-gray-400">{groupName}</code>
            </div>
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600">
              {t('pages.tags.groups.clients', 'Клиенты')}: {group.totalClients}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {group.tags.map((tag) => (
              <div
                key={tag.id}
                className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1"
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
                <span className="text-xs font-medium text-gray-800">{tag.name}</span>
                <span className="text-[10px] text-gray-400">({tag.client_count || 0})</span>
              </div>
            ))}
          </div>
          {group.tags.length === 0 && (
            <p className="text-xs text-gray-400">{t('pages.tags.groups.noTags', 'Нет тегов')}</p>
          )}
        </div>
      ))}

      <Button size="sm" onClick={onCreateGroup} className="text-xs">
        <Icons.Add size={14} strokeWidth={2} className="mr-1" />
        {t('pages.tags.groups.createGroup', 'Create group')}
      </Button>
    </div>
  )
}
