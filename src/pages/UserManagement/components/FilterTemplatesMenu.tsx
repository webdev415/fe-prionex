import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { useConfirm } from '@/components/ui/useConfirm'
import { Modal, ModalContent, ModalFooter, ModalHeader } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Icons } from '@/lib/icons'
import { getErrorMessage } from '@/lib/errors'
import type { FilterTemplate } from '@/features/users/types'
import {
  useDeleteFilterTemplate,
  useFilterTemplates,
  useSaveFilterTemplate,
} from '@/features/users/hooks/useFilterTemplates'
import type { TemplateDocument } from '../lib/filterTemplateMapping'

interface FilterTemplatesMenuProps {
  currentFilters: TemplateDocument
  onApply: (template: FilterTemplate) => void
}

export function FilterTemplatesMenu({ currentFilters, onApply }: FilterTemplatesMenuProps) {
  const { t } = useTranslation('common')
  const { confirm, confirmDialog } = useConfirm()
  const [open, setOpen] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const [name, setName] = useState('')

  const { data } = useFilterTemplates(open)
  const saveTemplate = useSaveFilterTemplate()
  const deleteTemplate = useDeleteFilterTemplate()

  const templates = data?.templates ?? []

  const handleSave = async () => {
    const trimmed = name.trim()
    if (!trimmed) return

    try {
      await saveTemplate.mutateAsync({ name: trimmed, filters: currentFilters })
      toast.success(t('pages.users.filterTemplates.saved'))
      setSaveOpen(false)
      setName('')
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  const handleDelete = async (template: FilterTemplate) => {
    const confirmed = await confirm({
      title: t('pages.users.filterTemplates.confirmDeleteTitle'),
      message: t('pages.users.filterTemplates.confirmDeleteMessage', { name: template.name }),
      confirmLabel: t('actions.delete'),
      cancelLabel: t('actions.cancel'),
      tone: 'danger',
    })
    if (!confirmed) return

    try {
      await deleteTemplate.mutateAsync(template.id)
      toast.success(t('pages.users.filterTemplates.deleted'))
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <>
      {confirmDialog}
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1.5 text-sm underline-offset-2 hover:underline"
          >
            <Icons.Save size={14} strokeWidth={1.5} />
            {t('pages.users.filterTemplates.label')}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-72 min-w-[16rem] overflow-y-auto p-1.5">
          <DropdownMenuItem className="cursor-pointer" onClick={() => setSaveOpen(true)}>
            <span className="flex w-full items-center gap-2">
              <Icons.Add size={14} strokeWidth={2} />
              {t('pages.users.filterTemplates.saveCurrent')}
            </span>
          </DropdownMenuItem>

          {templates.length === 0 ? (
            <div className="text-muted-foreground px-2 py-2 text-xs">
              {t('pages.users.filterTemplates.empty')}
            </div>
          ) : (
            templates.map((template) => (
              <DropdownMenuItem
                key={template.id}
                className="cursor-pointer"
                onClick={() => onApply(template)}
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <span className="truncate">{template.name}</span>
                  <button
                    type="button"
                    aria-label={`${t('actions.delete')} ${template.name}`}
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      void handleDelete(template)
                    }}
                    className="text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
                  >
                    <Icons.Delete size={14} strokeWidth={1.5} />
                  </button>
                </span>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Modal open={saveOpen} onClose={() => setSaveOpen(false)} maxWidth="sm">
        <ModalHeader title={t('pages.users.filterTemplates.saveCurrent')} />
        <ModalContent>
          <Input
            label={t('pages.users.filterTemplates.nameLabel')}
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={100}
          />
        </ModalContent>
        <ModalFooter>
          <Button type="button" variant="cancel" onClick={() => setSaveOpen(false)}>
            {t('actions.cancel')}
          </Button>
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={!name.trim() || saveTemplate.isPending}
          >
            {t('actions.save')}
          </Button>
        </ModalFooter>
      </Modal>
    </>
  )
}
