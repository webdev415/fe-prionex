import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  DEFAULT_EVENT_LABELS,
  type ConfigItem,
  type EventConfig,
  type EventField,
  type EventFieldOptionsSource,
  useTagConfigStore,
} from '@/stores/tagConfigStore'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Icons } from '@/lib/icons'

const FIELD_TYPES: Array<EventField['type']> = ['text', 'number', 'select']

function getEventDisplayLabel(
  event: EventConfig,
  t: (key: string, fallback: string) => string
): string {
  const defaultLabel = DEFAULT_EVENT_LABELS[event.value]
  if (defaultLabel && event.label === defaultLabel) {
    return t(`pages.tags.rules.events.${event.value}`, event.label)
  }

  return event.label
}

function getSourceBadgeLabel(
  source: EventFieldOptionsSource | undefined,
  t: (key: string, fallback: string) => string
): string | null {
  switch (source) {
    case 'interactionResults':
      return t('pages.tags.settings.eventSources.interactionResults', 'Live: interaction results')
    case 'interactionTypes':
      return t('pages.tags.settings.eventSources.interactionTypes', 'Live: interaction types')
    case 'interactionChannels':
      return t('pages.tags.settings.eventSources.interactionChannels', 'Live: interaction channels')
    case 'interactionDirections':
      return t(
        'pages.tags.settings.eventSources.interactionDirections',
        'Derived: interaction directions'
      )
    default:
      return null
  }
}

function normalizeOptionDraft(value: string, label: string): ConfigItem {
  const trimmedValue = value.trim()
  const trimmedLabel = label.trim()
  return {
    value: trimmedValue,
    label: trimmedLabel || trimmedValue,
  }
}

function EventOptionRow({
  eventValue,
  fieldValue,
  option,
}: {
  eventValue: string
  fieldValue: string
  option: ConfigItem
}) {
  const { t } = useTranslation('common')
  const updateEventFieldOption = useTagConfigStore((state) => state.updateEventFieldOption)
  const removeEventFieldOption = useTagConfigStore((state) => state.removeEventFieldOption)
  const [editing, setEditing] = useState(false)
  const [draftValue, setDraftValue] = useState(option.value)
  const [draftLabel, setDraftLabel] = useState(option.label)

  const handleSave = () => {
    const normalized = normalizeOptionDraft(draftValue, draftLabel)
    if (!normalized.value) return
    updateEventFieldOption(eventValue, fieldValue, option.value, normalized)
    setDraftValue(normalized.value)
    setDraftLabel(normalized.label)
    setEditing(false)
  }

  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 px-2 py-2">
      {editing ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={draftValue}
            onChange={(event) => setDraftValue(event.target.value)}
            placeholder={t('pages.tags.settings.optionValue', 'Value')}
            className="h-8 min-w-[180px] flex-1 text-xs"
          />
          <Input
            value={draftLabel}
            onChange={(event) => setDraftLabel(event.target.value)}
            placeholder={t('pages.tags.settings.optionLabel', 'Label')}
            className="h-8 min-w-[180px] flex-1 text-xs"
          />
          <button
            type="button"
            onClick={handleSave}
            className="flex h-7 w-7 items-center justify-center rounded text-green-600 hover:bg-green-50"
            aria-label={t('actions.save', 'Save')}
          >
            <Icons.CheckmarkBadge02 size={14} strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => {
              setDraftValue(option.value)
              setDraftLabel(option.label)
              setEditing(false)
            }}
            className="flex h-7 w-7 items-center justify-center rounded text-gray-400 hover:bg-gray-100"
            aria-label={t('actions.cancel', 'Cancel')}
          >
            <Icons.Cancel01 size={14} strokeWidth={2} />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <code className="rounded bg-white px-1.5 py-0.5 text-xs text-gray-700">
            {option.value}
          </code>
          <span className="min-w-0 flex-1 truncate text-xs text-gray-500">
            {option.label !== option.value ? option.label : ''}
          </span>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex h-7 w-7 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label={t('actions.edit', 'Edit')}
          >
            <Icons.PencilEdit size={12} strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={() => removeEventFieldOption(eventValue, fieldValue, option.value)}
            className="flex h-7 w-7 items-center justify-center rounded text-gray-400 hover:bg-red-50 hover:text-red-500"
            aria-label={t('actions.remove', 'Remove')}
          >
            <Icons.Cancel01 size={12} strokeWidth={1.5} />
          </button>
        </div>
      )}
    </div>
  )
}

function EventFieldCard({ eventValue, field }: { eventValue: string; field: EventField }) {
  const { t } = useTranslation('common')
  const updateEventField = useTagConfigStore((state) => state.updateEventField)
  const removeEventField = useTagConfigStore((state) => state.removeEventField)
  const addEventFieldOption = useTagConfigStore((state) => state.addEventFieldOption)
  const [editing, setEditing] = useState(false)
  const [draftValue, setDraftValue] = useState(field.value)
  const [draftType, setDraftType] = useState<EventField['type']>(field.type)
  const [newOptionValue, setNewOptionValue] = useState('')
  const [newOptionLabel, setNewOptionLabel] = useState('')

  const sourceBadge = getSourceBadgeLabel(field.optionsSource, t)

  const handleSaveField = () => {
    const nextValue = draftValue.trim()
    if (!nextValue) return

    updateEventField(eventValue, field.value, {
      ...field,
      value: nextValue,
      label: nextValue,
      type: draftType,
      options: draftType === 'select' ? (field.options ?? []) : [],
    })
    setDraftValue(nextValue)
    setEditing(false)
  }

  const handleAddOption = () => {
    const option = normalizeOptionDraft(newOptionValue, newOptionLabel)
    if (!option.value) return
    addEventFieldOption(eventValue, field.value, option)
    setNewOptionValue('')
    setNewOptionLabel('')
  }

  return (
    <div className="space-y-3 rounded-md border border-gray-200 bg-white p-3">
      {editing ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={draftValue}
            onChange={(event) => setDraftValue(event.target.value)}
            placeholder={t('pages.tags.settings.fieldCode', 'Field code')}
            className="h-8 min-w-[180px] flex-1 text-xs"
          />
          <select
            value={draftType}
            onChange={(event) => setDraftType(event.target.value as EventField['type'])}
            className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-700"
          >
            {FIELD_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleSaveField}
            className="flex h-7 w-7 items-center justify-center rounded text-green-600 hover:bg-green-50"
            aria-label={t('actions.save', 'Save')}
          >
            <Icons.CheckmarkBadge02 size={14} strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => {
              setDraftValue(field.value)
              setDraftType(field.type)
              setEditing(false)
            }}
            className="flex h-7 w-7 items-center justify-center rounded text-gray-400 hover:bg-gray-100"
            aria-label={t('actions.cancel', 'Cancel')}
          >
            <Icons.Cancel01 size={14} strokeWidth={2} />
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <code className="rounded bg-gray-50 px-1.5 py-0.5 text-xs text-gray-700">
            {field.value}
          </code>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">
            {field.type}
          </span>
          {sourceBadge && (
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700">
              {sourceBadge}
            </span>
          )}
          <span className="ml-auto text-[11px] text-gray-400">
            {field.type === 'select'
              ? t('pages.tags.settings.valuesCount', '{{count}} values', {
                  count: (field.options ?? []).length,
                })
              : ''}
          </span>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex h-7 w-7 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label={t('actions.edit', 'Edit')}
          >
            <Icons.PencilEdit size={12} strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={() => removeEventField(eventValue, field.value)}
            className="flex h-7 w-7 items-center justify-center rounded text-gray-400 hover:bg-red-50 hover:text-red-500"
            aria-label={t('actions.remove', 'Remove')}
          >
            <Icons.Cancel01 size={12} strokeWidth={1.5} />
          </button>
        </div>
      )}

      {field.type === 'select' && (
        <div className="space-y-2 border-t border-gray-100 pt-3">
          <div className="text-[11px] font-medium tracking-wide text-gray-500 uppercase">
            {t('pages.tags.settings.values', 'Values')}
          </div>

          {(field.options ?? []).length === 0 && (
            <p className="text-xs text-gray-400">
              {sourceBadge
                ? t(
                    'pages.tags.settings.liveValuesFallback',
                    'Live values will be merged at runtime. Add manual values here only if you need overrides/fallbacks.'
                  )
                : t('pages.tags.settings.noValues', 'No values configured')}
            </p>
          )}

          {(field.options ?? []).map((option) => (
            <EventOptionRow
              key={option.value}
              eventValue={eventValue}
              fieldValue={field.value}
              option={option}
            />
          ))}

          <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-gray-200 p-2">
            <Input
              value={newOptionValue}
              onChange={(event) => setNewOptionValue(event.target.value)}
              placeholder={t('pages.tags.settings.optionValue', 'Value')}
              className="h-8 min-w-[180px] flex-1 text-xs"
            />
            <Input
              value={newOptionLabel}
              onChange={(event) => setNewOptionLabel(event.target.value)}
              placeholder={t('pages.tags.settings.optionLabel', 'Label')}
              className="h-8 min-w-[180px] flex-1 text-xs"
            />
            <Button
              type="button"
              size="sm"
              onClick={handleAddOption}
              className="h-8 px-3 text-xs"
              disabled={!newOptionValue.trim()}
            >
              <Icons.Add size={14} strokeWidth={2} />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function EventCard({ event }: { event: EventConfig }) {
  const { t } = useTranslation('common')
  const updateEvent = useTagConfigStore((state) => state.updateEvent)
  const removeEvent = useTagConfigStore((state) => state.removeEvent)
  const addEventField = useTagConfigStore((state) => state.addEventField)
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draftValue, setDraftValue] = useState(event.value)
  const [draftLabel, setDraftLabel] = useState(event.label)
  const [newFieldValue, setNewFieldValue] = useState('')
  const [newFieldType, setNewFieldType] = useState<EventField['type']>('text')

  const handleSaveEvent = () => {
    const nextValue = draftValue.trim()
    const nextLabel = draftLabel.trim() || nextValue
    if (!nextValue) return
    updateEvent(event.value, {
      ...event,
      value: nextValue,
      label: nextLabel,
    })
    setDraftValue(nextValue)
    setDraftLabel(nextLabel)
    setEditing(false)
  }

  const handleAddField = () => {
    const value = newFieldValue.trim()
    if (!value) return
    addEventField(event.value, {
      value,
      label: value,
      type: newFieldType,
      options: newFieldType === 'select' ? [] : [],
    })
    setNewFieldValue('')
    setNewFieldType('text')
    setExpanded(true)
  }

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-3">
      {editing ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={draftValue}
            onChange={(event) => setDraftValue(event.target.value)}
            placeholder={t('pages.tags.settings.eventCode', 'Event code')}
            className="h-8 min-w-[220px] flex-1 text-xs"
          />
          <Input
            value={draftLabel}
            onChange={(event) => setDraftLabel(event.target.value)}
            placeholder={t('pages.tags.settings.eventLabel', 'Display name')}
            className="h-8 min-w-[220px] flex-1 text-xs"
          />
          <button
            type="button"
            onClick={handleSaveEvent}
            className="flex h-7 w-7 items-center justify-center rounded text-green-600 hover:bg-green-50"
            aria-label={t('actions.save', 'Save')}
          >
            <Icons.CheckmarkBadge02 size={14} strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => {
              setDraftValue(event.value)
              setDraftLabel(event.label)
              setEditing(false)
            }}
            className="flex h-7 w-7 items-center justify-center rounded text-gray-400 hover:bg-gray-100"
            aria-label={t('actions.cancel', 'Cancel')}
          >
            <Icons.Cancel01 size={14} strokeWidth={2} />
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <code className="rounded bg-gray-50 px-1.5 py-0.5 text-xs text-gray-700">
            {event.value}
          </code>
          <span className="min-w-0 flex-1 truncate text-sm text-gray-700">
            {getEventDisplayLabel(event, t)}
          </span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">
            {t('pages.tags.settings.fieldsCount', '{{count}} fields', {
              count: event.fields.length,
            })}
          </span>
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="flex h-7 w-7 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label={
              expanded ? t('actions.collapse', 'Collapse') : t('actions.expand', 'Expand')
            }
          >
            <Icons.ArrowRight
              size={14}
              className={expanded ? 'rotate-90 transition-transform' : 'transition-transform'}
              strokeWidth={1.5}
            />
          </button>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex h-7 w-7 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label={t('actions.edit', 'Edit')}
          >
            <Icons.PencilEdit size={12} strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={() => removeEvent(event.value)}
            className="flex h-7 w-7 items-center justify-center rounded text-gray-400 hover:bg-red-50 hover:text-red-500"
            aria-label={t('actions.remove', 'Remove')}
          >
            <Icons.Cancel01 size={12} strokeWidth={1.5} />
          </button>
        </div>
      )}

      {expanded && (
        <div className="space-y-3 border-t border-gray-100 pt-3">
          <div className="text-[11px] font-medium tracking-wide text-gray-500 uppercase">
            {t('pages.tags.settings.eventFields', 'Fields')}
          </div>

          {event.fields.length === 0 && (
            <p className="text-xs text-gray-400">
              {t('pages.tags.settings.noFields', 'No fields configured for this event')}
            </p>
          )}

          {event.fields.map((field) => (
            <EventFieldCard key={field.value} eventValue={event.value} field={field} />
          ))}

          <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-gray-200 p-2">
            <Input
              value={newFieldValue}
              onChange={(event) => setNewFieldValue(event.target.value)}
              placeholder={t('pages.tags.settings.fieldCode', 'Field code')}
              className="h-8 min-w-[220px] flex-1 text-xs"
            />
            <select
              value={newFieldType}
              onChange={(event) => setNewFieldType(event.target.value as EventField['type'])}
              className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-700"
            >
              {FIELD_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <Button
              type="button"
              size="sm"
              onClick={handleAddField}
              className="h-8 px-3 text-xs"
              disabled={!newFieldValue.trim()}
            >
              <Icons.Add size={14} strokeWidth={2} />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export function EventConfigEditor() {
  const { t } = useTranslation('common')
  const events = useTagConfigStore((state) => state.availableEvents)
  const addEvent = useTagConfigStore((state) => state.addEvent)
  const [newEventValue, setNewEventValue] = useState('')
  const [newEventLabel, setNewEventLabel] = useState('')

  const handleAddEvent = () => {
    const value = newEventValue.trim()
    if (!value) return

    addEvent({
      value,
      label: newEventLabel.trim() || value,
      fields: [],
    })
    setNewEventValue('')
    setNewEventLabel('')
  }

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-sm font-medium text-gray-900">
          {t('pages.tags.settings.events', 'Available events')}
        </h4>
        <p className="mt-0.5 text-xs text-gray-500">
          {t(
            'pages.tags.settings.eventsDesc',
            'Configure event schema for the rule builder: event code, payload fields, and selectable values.'
          )}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-gray-200 p-2">
        <Input
          value={newEventValue}
          onChange={(event) => setNewEventValue(event.target.value)}
          placeholder={t('pages.tags.settings.eventCode', 'Event code')}
          className="h-8 min-w-[220px] flex-1 text-xs"
        />
        <Input
          value={newEventLabel}
          onChange={(event) => setNewEventLabel(event.target.value)}
          placeholder={t('pages.tags.settings.eventLabel', 'Display name')}
          className="h-8 min-w-[220px] flex-1 text-xs"
        />
        <Button
          type="button"
          size="sm"
          onClick={handleAddEvent}
          className="h-8 px-3 text-xs"
          disabled={!newEventValue.trim()}
        >
          <Icons.Add size={14} strokeWidth={2} />
        </Button>
      </div>

      <div className="space-y-3">
        {events.map((event) => (
          <EventCard key={event.value} event={event} />
        ))}

        {events.length === 0 && (
          <p className="rounded-md border border-gray-200 px-3 py-4 text-center text-xs text-gray-400">
            {t('pages.tags.settings.noItems', 'No items')}
          </p>
        )}
      </div>
    </div>
  )
}
