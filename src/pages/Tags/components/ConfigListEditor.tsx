/**
 * ConfigListEditor
 *
 * Universal CRUD component for managing dropdown option lists.
 * When i18nPrefix is provided, shows translated labels and allows editing translations for 3 languages.
 */

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { ConfigItem } from '@/stores/tagConfigStore'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Icons } from '@/lib/icons'

interface ConfigListEditorProps {
  title: string
  description?: string
  items: ConfigItem[]
  onAdd: (item: ConfigItem) => void
  onRemove: (value: string) => void
  onUpdate: (oldValue: string, newItem: ConfigItem) => void
  showLabel?: boolean
  /** i18n key prefix for translating item values, e.g. "pages.tags.categories" */
  i18nPrefix?: string
}

const LANGS = ['en', 'uk'] as const

/** Build nested object from dot-path key, e.g. "a.b.c" + "val" → { a: { b: { c: "val" } } } */
function buildNestedObj(dotPath: string, value: string): Record<string, unknown> {
  const parts = dotPath.split('.')
  const result: Record<string, unknown> = {}
  let current = result
  for (let i = 0; i < parts.length - 1; i++) {
    current[parts[i]] = {}
    current = current[parts[i]] as Record<string, unknown>
  }
  current[parts[parts.length - 1]] = value
  return result
}

export function ConfigListEditor({
  title,
  description,
  items,
  onAdd,
  onRemove,
  onUpdate,
  showLabel = false,
  i18nPrefix,
}: ConfigListEditorProps) {
  const { t, i18n } = useTranslation('common')
  const [langsLoaded, setLangsLoaded] = useState(false)

  // Pre-load all languages so we can read/write translations for en/uk
  useEffect(() => {
    if (i18nPrefix && !langsLoaded) {
      i18n.loadLanguages(['en', 'uk']).then(() => setLangsLoaded(true))
    }
  }, [i18n, i18nPrefix, langsLoaded])

  const [newValue, setNewValue] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [editingValue, setEditingValue] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editLabel, setEditLabel] = useState('')

  // Multi-lang state for add/edit when i18nPrefix is used
  const [newLangs, setNewLangs] = useState<Record<string, string>>({ en: '', uk: '' })
  const [editLangs, setEditLangs] = useState<Record<string, string>>({ en: '', uk: '' })

  const getDisplayLabel = (item: ConfigItem) => {
    if (i18nPrefix) {
      return t(`${i18nPrefix}.${item.value}`, item.label)
    }
    return showLabel && item.label !== item.value ? item.label : ''
  }

  const handleAdd = () => {
    const value = newValue.trim()
    if (!value) return

    if (i18nPrefix) {
      // Save translations to runtime i18n
      const label = newLangs.en || value
      LANGS.forEach((lang) => {
        const langLabel = newLangs[lang]?.trim()
        if (langLabel) {
          i18n.addResourceBundle(
            lang,
            'common',
            buildNestedObj(`${i18nPrefix}.${value}`, langLabel),
            true,
            true
          )
        }
      })
      onAdd({ value, label })
      setNewValue('')
      setNewLangs({ en: '', uk: '' })
    } else {
      onAdd({ value, label: showLabel ? newLabel.trim() || value : value })
      setNewValue('')
      setNewLabel('')
    }
  }

  const handleStartEdit = (item: ConfigItem) => {
    setEditingValue(item.value)
    setEditValue(item.value)
    setEditLabel(item.label)
    if (i18nPrefix) {
      const langs: Record<string, string> = {}
      LANGS.forEach((lang) => {
        langs[lang] = i18n.t(`${i18nPrefix}.${item.value}`, { lng: lang }) || item.label
      })
      setEditLangs(langs)
    }
  }

  const handleSaveEdit = () => {
    if (!editingValue || !editValue.trim()) return
    if (i18nPrefix) {
      LANGS.forEach((lang) => {
        const langLabel = editLangs[lang]?.trim()
        if (langLabel) {
          i18n.addResourceBundle(
            lang,
            'common',
            buildNestedObj(`${i18nPrefix}.${editValue.trim()}`, langLabel),
            true,
            true
          )
        }
      })
      onUpdate(editingValue, { value: editValue.trim(), label: editLangs.en || editValue.trim() })
    } else {
      onUpdate(editingValue, {
        value: editValue.trim(),
        label: showLabel ? editLabel.trim() || editValue.trim() : editValue.trim(),
      })
    }
    setEditingValue(null)
  }

  const handleCancelEdit = () => {
    setEditingValue(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      action()
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-foreground text-sm font-medium">{title}</h4>
        {description && <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>}
      </div>

      {/* Add new item */}
      <div className="border-border space-y-1.5 rounded-md border border-dashed p-2">
        <div className="flex items-center gap-2">
          <Input
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="value (API code)"
            className="h-8 flex-1 text-xs"
            onKeyDown={(e) => handleKeyDown(e, handleAdd)}
          />
          {!i18nPrefix && showLabel && (
            <Input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="label"
              className="h-8 flex-1 text-xs"
              onKeyDown={(e) => handleKeyDown(e, handleAdd)}
            />
          )}
          <Button
            size="sm"
            onClick={handleAdd}
            className="h-8 px-3 text-xs"
            disabled={!newValue.trim()}
          >
            <Icons.Add size={14} strokeWidth={2} />
          </Button>
        </div>
        {i18nPrefix && newValue.trim() && (
          <div className="flex items-center gap-2">
            {LANGS.map((lang) => (
              <Input
                key={lang}
                value={newLangs[lang]}
                onChange={(e) => setNewLangs((prev) => ({ ...prev, [lang]: e.target.value }))}
                placeholder={lang.toUpperCase()}
                className="h-7 flex-1 text-xs"
                onKeyDown={(e) => handleKeyDown(e, handleAdd)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Items list */}
      <div className="divide-border border-border divide-y rounded-md border">
        {items.length === 0 && (
          <p className="text-muted-foreground px-3 py-4 text-center text-xs">
            {t('pages.tags.settings.noItems', 'No items')}
          </p>
        )}
        {items.map((item) => (
          <div key={item.value} className="px-3 py-1.5">
            {editingValue === item.value ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="h-7 flex-1 text-xs"
                    onKeyDown={(e) => handleKeyDown(e, handleSaveEdit)}
                    /* eslint-disable-next-line jsx-a11y/no-autofocus */
                    autoFocus
                  />
                  {!i18nPrefix && showLabel && (
                    <Input
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      className="h-7 flex-1 text-xs"
                      onKeyDown={(e) => handleKeyDown(e, handleSaveEdit)}
                    />
                  )}
                  <button
                    onClick={handleSaveEdit}
                    className="text-success-600 hover:bg-success-50 flex h-6 w-6 items-center justify-center rounded"
                  >
                    <Icons.CheckmarkBadge02 size={14} strokeWidth={2} />
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="text-muted-foreground hover:bg-muted flex h-6 w-6 items-center justify-center rounded"
                  >
                    <Icons.Cancel01 size={14} strokeWidth={2} />
                  </button>
                </div>
                {i18nPrefix && (
                  <div className="flex items-center gap-2">
                    {LANGS.map((lang) => (
                      <Input
                        key={lang}
                        value={editLangs[lang]}
                        onChange={(e) =>
                          setEditLangs((prev) => ({ ...prev, [lang]: e.target.value }))
                        }
                        placeholder={lang.toUpperCase()}
                        className="h-7 flex-1 text-xs"
                        onKeyDown={(e) => handleKeyDown(e, handleSaveEdit)}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <code className="bg-muted text-foreground flex-shrink-0 rounded px-1.5 py-0.5 text-xs">
                  {item.value}
                </code>
                <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">
                  {getDisplayLabel(item)}
                </span>
                <button
                  onClick={() => handleStartEdit(item)}
                  className="text-muted-foreground hover:bg-muted hover:text-foreground flex h-6 w-6 shrink-0 items-center justify-center rounded"
                >
                  <Icons.PencilEdit size={12} strokeWidth={1.5} />
                </button>
                <button
                  onClick={() => {
                    if (
                      window.confirm(
                        t(
                          'pages.tags.settings.confirmRemove',
                          'Are you sure you want to remove this item?'
                        )
                      )
                    ) {
                      onRemove(item.value)
                    }
                  }}
                  className="text-muted-foreground hover:bg-error-50 hover:text-error-500 flex h-6 w-6 shrink-0 items-center justify-center rounded"
                >
                  <Icons.Cancel01 size={12} strokeWidth={1.5} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
