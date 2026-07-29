import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/errors'
import { Modal, ModalContent, ModalFooter, ModalHeader } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { RadioGroup, RadioItem } from '@/components/ui/Radio'
import { useContactTags, useSetContactTags } from '@/features/contactTags/hooks/useContactTags'
import type { ContactTagAssignmentCategory } from '@/features/contactTags/types'

interface ContactTagSelectorModalProps {
  open: boolean
  onClose: () => void
  clientId: number
  contactId: number
  phoneNumber: string
}

function TagValueBadge({ name, color }: { name: string; color?: string | null }) {
  const bg = color || '#64748b'
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white"
      style={{ backgroundColor: bg }}
    >
      {name}
    </span>
  )
}

export function ContactTagSelectorModal({
  open,
  onClose,
  clientId,
  contactId,
  phoneNumber,
}: ContactTagSelectorModalProps) {
  const { t } = useTranslation('common')
  const { data: categories = [], isLoading } = useContactTags(clientId, contactId, open)
  const setTags = useSetContactTags(clientId, contactId)
  const [localEdits, setLocalEdits] = useState<Record<number, number[]>>({})

  const baseDraft = useMemo(() => {
    const initial: Record<number, number[]> = {}
    if (!open) return initial
    categories.forEach((c) => {
      initial[c.category_id] = [...c.assigned_value_ids]
    })
    return initial
  }, [open, categories])

  const draft = useMemo(() => ({ ...baseDraft, ...localEdits }), [baseDraft, localEdits])

  const handleClose = () => {
    setLocalEdits({})
    onClose()
  }

  const toggleMulti = (categoryId: number, valueId: number) => {
    setLocalEdits((prev) => {
      const current = prev[categoryId] ?? baseDraft[categoryId] ?? []
      const next = current.includes(valueId)
        ? current.filter((id) => id !== valueId)
        : [...current, valueId]
      return { ...prev, [categoryId]: next }
    })
  }

  const setSingle = (categoryId: number, valueId: number) => {
    setLocalEdits((prev) => {
      const current = prev[categoryId] ?? baseDraft[categoryId] ?? []
      const next = current[0] === valueId ? [] : [valueId]
      return { ...prev, [categoryId]: next }
    })
  }

  const clearSingle = (categoryId: number) => {
    setLocalEdits((prev) => ({ ...prev, [categoryId]: [] }))
  }

  const saveCategory = async (category: ContactTagAssignmentCategory) => {
    try {
      await setTags.mutateAsync({
        category_id: category.category_id,
        value_ids: draft[category.category_id] ?? [],
      })
      setLocalEdits((prev) => {
        const next = { ...prev }
        delete next[category.category_id]
        return next
      })
      toast.success(t('pages.contactTags.saved', 'Tags updated'))
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <Modal open={open} onClose={handleClose} maxWidth="lg">
      <ModalHeader
        title={`${t('pages.contactTags.manageTags', 'Contact tags')} — ${phoneNumber}`}
      />
      <ModalContent className="max-h-[60vh] overflow-y-auto">
        {isLoading ? (
          <p>{t('common.loading', 'Loading...')}</p>
        ) : categories.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {t('pages.contactTags.noCategories', 'No tag categories available')}
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {categories.map((category) => (
              <div
                key={category.category_id}
                className="border-border bg-card rounded-lg border p-3"
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <span className="text-foreground text-sm font-medium">
                      {category.category_name}
                    </span>
                    <p className="text-muted-foreground text-xs">
                      {category.selection_type === 'multi'
                        ? t('pages.contactTags.multiSelectHint', 'Select one or more values')
                        : t(
                            'pages.contactTags.singleSelectHint',
                            'Select one value, or clear to remove'
                          )}
                      {category.is_system &&
                        ` · ${t('pages.contactTags.systemCategory', 'System category')}`}
                    </p>
                  </div>
                  {!category.can_edit && (
                    <span className="bg-muted text-muted-foreground shrink-0 rounded px-2 py-0.5 text-xs">
                      {t('pages.contactTags.readOnly', 'Read only')}
                    </span>
                  )}
                </div>
                {category.selection_type === 'single' ? (
                  <>
                    <RadioGroup
                      value={String(draft[category.category_id]?.[0] ?? '')}
                      onValueChange={(v) =>
                        category.can_edit && setSingle(category.category_id, Number(v))
                      }
                      disabled={!category.can_edit}
                      className="flex flex-col gap-2"
                    >
                      {category.values.map((v) => (
                        <label
                          key={v.id}
                          className={`flex items-center gap-2 rounded p-1.5 ${
                            category.can_edit ? 'hover:bg-muted cursor-pointer' : 'cursor-default'
                          }`}
                        >
                          <RadioItem
                            value={String(v.id)}
                            id={`ct-tag-${category.category_id}-${v.id}`}
                            onClick={() => {
                              if (!category.can_edit) return
                              const current = draft[category.category_id]?.[0]
                              if (current === v.id) {
                                setSingle(category.category_id, v.id)
                              }
                            }}
                          />
                          <TagValueBadge name={v.name} color={v.color} />
                          {v.blocks_calls && (
                            <span
                              className="text-error-500 text-xs"
                              title={t('pages.contactTags.blocksCalls', 'Blocks calls')}
                            >
                              📵
                            </span>
                          )}
                        </label>
                      ))}
                    </RadioGroup>
                    {category.can_edit && (draft[category.category_id]?.length ?? 0) > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="mt-2"
                        onClick={() => clearSingle(category.category_id)}
                      >
                        {t('pages.contactTags.clearSelection', 'Clear selection')}
                      </Button>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col gap-1">
                    {category.values.map((v) => (
                      <label
                        key={v.id}
                        className={`flex items-center gap-2 rounded p-1.5 ${
                          category.can_edit ? 'hover:bg-muted cursor-pointer' : 'cursor-default'
                        }`}
                      >
                        <Checkbox
                          checked={(draft[category.category_id] ?? []).includes(v.id)}
                          disabled={!category.can_edit}
                          onCheckedChange={() =>
                            category.can_edit && toggleMulti(category.category_id, v.id)
                          }
                        />
                        <TagValueBadge name={v.name} color={v.color} />
                        {v.blocks_calls && (
                          <span
                            className="text-error-500 text-xs"
                            title={t('pages.contactTags.blocksCalls', 'Blocks calls')}
                          >
                            📵
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                )}
                {category.can_edit && (
                  <Button
                    size="sm"
                    className="mt-3"
                    disabled={setTags.isPending}
                    onClick={() => saveCategory(category)}
                  >
                    {t('common.save', 'Save')}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </ModalContent>
      <ModalFooter>
        <Button variant="white-secondary" onClick={handleClose}>
          {t('common.close', 'Close')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
