import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { Label } from '@/components/ui/Label'
import { Modal, ModalContent, ModalFooter, ModalHeader } from '@/components/ui/Modal'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import type { LetterTypeConfig } from '../../../settings/types'
import { LetterTypeBadge } from '../LetterTypeBadge'

interface AddLawyerModalProps {
  open: boolean
  onClose: () => void
  letterTypes: LetterTypeConfig[]
  availableUsers: { id: number; name: string }[]
  onAdd: (input: { userId: number; displayName: string; letterTypeIds: string[] }) => Promise<void>
  isSubmitting?: boolean
  onAddLetterType: (onCreated?: (typeId: string) => void) => void
}

export function AddLawyerModal({
  open,
  onClose,
  letterTypes,
  availableUsers,
  onAdd,
  isSubmitting = false,
  onAddLetterType,
}: AddLawyerModalProps) {
  const { t } = useTranslation('common')
  const [userId, setUserId] = useState<number | null>(null)
  const [selectedTypeIds, setSelectedTypeIds] = useState<string[]>([])
  const [typesOpen, setTypesOpen] = useState(false)

  const selectedUser = useMemo(
    () => availableUsers.find((user) => user.id === userId) ?? null,
    [availableUsers, userId]
  )

  useEffect(() => {
    if (!open) return
    requestAnimationFrame(() => {
      setUserId(null)
      setSelectedTypeIds([])
      setTypesOpen(false)
    })
  }, [open])

  const toggleType = (typeId: string) => {
    setSelectedTypeIds((prev) =>
      prev.includes(typeId) ? prev.filter((id) => id !== typeId) : [...prev, typeId]
    )
  }

  const removeType = (typeId: string) => {
    setSelectedTypeIds((prev) => prev.filter((id) => id !== typeId))
  }

  const canSubmit = Boolean(userId && selectedTypeIds.length > 0 && !isSubmitting)
  const hasAvailableUsers = availableUsers.length > 0

  const handleAdd = async () => {
    if (!canSubmit || !userId || !selectedUser) return
    await onAdd({
      userId,
      displayName: selectedUser.name,
      letterTypeIds: selectedTypeIds,
    })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="md">
      <ModalHeader
        icon={
          <div className="bg-primary-300 flex h-10 w-10 items-center justify-center rounded-full">
            <Icons.UserMultiple02 size={20} strokeWidth={1.5} className="text-dark-500" />
          </div>
        }
        title={t('pages.lawyerWorkplace.settings.modals.addLawyer.title', 'Add lawyer')}
      />
      <ModalContent className="flex flex-col gap-5 px-1">
        <div className="flex flex-col gap-2">
          <Label className="text-dark-500 text-[13px] font-medium">
            {t('pages.lawyerWorkplace.settings.lawyer', 'Lawyer')}
          </Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild disabled={!hasAvailableUsers || isSubmitting}>
              <button
                type="button"
                disabled={!hasAvailableUsers || isSubmitting}
                className={cn(
                  'text-dark-500 flex h-11 w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-4 text-[14px] font-light',
                  (!hasAvailableUsers || isSubmitting) && 'cursor-not-allowed opacity-60'
                )}
              >
                <span className={cn(!selectedUser && 'text-gray-400')}>
                  {selectedUser
                    ? selectedUser.name
                    : t(
                        'pages.lawyerWorkplace.settings.modals.addLawyer.selectLawyer',
                        'Select a Lawyer'
                      )}
                </span>
                <Icons.ArrowDown size={16} strokeWidth={1.5} className="text-light-500" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="max-h-60 w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto"
            >
              {availableUsers.map((user) => (
                <DropdownMenuItem
                  key={user.id}
                  className="cursor-pointer"
                  onClick={() => setUserId(user.id)}
                >
                  {user.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {!hasAvailableUsers ? (
            <p className="text-light-600 text-[12px]">
              {t('pages.lawyerWorkplace.settings.modals.addLawyer.noLawyers', 'All lawyers added')}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-dark-500 text-[13px] font-medium">
            {t(
              'pages.lawyerWorkplace.settings.modals.addLawyer.responsibleTypes',
              'Responsible letter types'
            )}
          </Label>
          <DropdownMenu open={typesOpen} onOpenChange={setTypesOpen}>
            <DropdownMenuTrigger asChild disabled={isSubmitting}>
              <button
                type="button"
                disabled={isSubmitting}
                className="text-dark-500 flex h-11 w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-4 text-[14px] font-light disabled:opacity-60"
              >
                <span className={cn(selectedTypeIds.length === 0 && 'text-gray-400')}>
                  {selectedTypeIds.length > 0
                    ? t(
                        'pages.lawyerWorkplace.settings.modals.addLawyer.typesSelected',
                        '{{count}} selected',
                        { count: selectedTypeIds.length }
                      )
                    : t(
                        'pages.lawyerWorkplace.settings.modals.addLawyer.selectTypes',
                        'Select letter types'
                      )}
                </span>
                <Icons.ArrowDown
                  size={16}
                  strokeWidth={1.5}
                  className={cn('text-light-500 transition-transform', typesOpen && 'rotate-180')}
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-[var(--radix-dropdown-menu-trigger-width)]"
            >
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => {
                  setTypesOpen(false)
                  onAddLetterType((typeId) => {
                    setSelectedTypeIds((previous) =>
                      previous.includes(typeId) ? previous : [...previous, typeId]
                    )
                  })
                }}
              >
                <Icons.AddCircle size={16} strokeWidth={1.5} className="mr-2" />
                {t('pages.lawyerWorkplace.settings.modals.addLawyer.addNewType', 'Add new type')}
              </DropdownMenuItem>
              {letterTypes.map((letterType) => (
                <DropdownMenuItem
                  key={letterType.id}
                  className="cursor-pointer"
                  onClick={() => toggleType(letterType.id)}
                >
                  <span className="flex w-full items-center justify-between gap-2">
                    <LetterTypeBadge letterType={letterType} t={t} size="sm" />
                    {selectedTypeIds.includes(letterType.id) && (
                      <Icons.Tick02 size={14} strokeWidth={2} className="text-secondary-700" />
                    )}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {selectedTypeIds.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-2">
              {selectedTypeIds.map((typeId) => {
                const letterType = letterTypes.find((type) => type.id === typeId)
                if (!letterType) return null
                return (
                  <span key={typeId} className="inline-flex items-center gap-1">
                    <LetterTypeBadge letterType={letterType} t={t} size="sm" />
                    <button
                      type="button"
                      onClick={() => removeType(typeId)}
                      className="text-light-500 hover:text-dark-500"
                      aria-label={t('actions.remove', 'Remove')}
                    >
                      <Icons.Cancel01 size={12} strokeWidth={1.5} />
                    </button>
                  </span>
                )
              })}
            </div>
          )}
        </div>
      </ModalContent>
      <ModalFooter className="gap-2 px-1 sm:gap-3">
        <Button
          variant="cancel"
          size="md"
          onClick={onClose}
          className="flex-1"
          disabled={isSubmitting}
        >
          {t('actions.cancel', 'Cancel')}
        </Button>
        <Button
          variant="primary"
          size="md"
          onClick={handleAdd}
          disabled={!canSubmit}
          className={cn('flex-1', !canSubmit && 'opacity-60')}
        >
          {isSubmitting
            ? t('pages.lawyerWorkplace.settings.modals.addLawyer.submitting', 'Adding…')
            : t('pages.lawyerWorkplace.settings.modals.addLawyer.submit', 'Add')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
