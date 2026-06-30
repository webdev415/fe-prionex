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
    setLocalEdits((prev) => ({ ...prev, [categoryId]: [valueId] }))
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
    <Modal open={open} onClose={handleClose}>
      <ModalHeader
        title={`${t('pages.contactTags.manageTags', 'Contact tags')} — ${phoneNumber}`}
      />
      <ModalContent className="max-h-[60vh] overflow-y-auto">
        {isLoading ? (
          <p>{t('common.loading', 'Loading...')}</p>
        ) : (
          <div className="flex flex-col gap-4">
            {categories.map((category) => (
              <div key={category.category_id} className="rounded border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium">{category.category_name}</span>
                  {!category.can_edit && (
                    <span className="text-xs text-gray-500">
                      {t('pages.contactTags.readOnly', 'Read only')}
                    </span>
                  )}
                </div>
                {category.selection_type === 'single' ? (
                  <RadioGroup
                    value={String(draft[category.category_id]?.[0] ?? '')}
                    onValueChange={(v) =>
                      category.can_edit && setSingle(category.category_id, Number(v))
                    }
                    disabled={!category.can_edit}
                  >
                    {category.values.map((v) => (
                      <RadioItem key={v.id} value={String(v.id)}>
                        <span
                          className="mr-2 inline-block h-2 w-2 rounded-full"
                          style={{ backgroundColor: v.color || '#94a3b8' }}
                        />
                        {v.name}
                      </RadioItem>
                    ))}
                  </RadioGroup>
                ) : (
                  <div className="flex flex-col gap-1">
                    {category.values.map((v) => (
                      <label key={v.id} className="flex cursor-pointer items-center gap-2">
                        <Checkbox
                          checked={(draft[category.category_id] ?? []).includes(v.id)}
                          disabled={!category.can_edit}
                          onCheckedChange={() =>
                            category.can_edit && toggleMulti(category.category_id, v.id)
                          }
                        />
                        <span
                          className="mr-2 inline-block h-2 w-2 rounded-full"
                          style={{ backgroundColor: v.color || '#94a3b8' }}
                        />
                        {v.name}
                      </label>
                    ))}
                  </div>
                )}
                {category.can_edit && (
                  <Button
                    size="sm"
                    className="mt-2"
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
        <Button variant="ghost" onClick={handleClose}>
          {t('common.close', 'Close')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
