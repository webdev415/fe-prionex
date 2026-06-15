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
import { ADD_LAWYER_OPTIONS } from '../constants'
import { LetterTypeBadge } from '../LetterTypeBadge'

interface AddLawyerModalProps {
  open: boolean
  onClose: () => void
  letterTypes: LetterTypeConfig[]
  existingLawyerIds: string[]
  onAdd: (input: { lawyerOptionId: string; letterTypeIds: string[] }) => void
  onAddLetterType: (onCreated?: (typeId: string) => void) => void
}

export function AddLawyerModal({
  open,
  onClose,
  letterTypes,
  existingLawyerIds,
  onAdd,
  onAddLetterType,
}: AddLawyerModalProps) {
  const { t } = useTranslation('common')
  const [lawyerOptionId, setLawyerOptionId] = useState('')
  const [selectedTypeIds, setSelectedTypeIds] = useState<string[]>([])
  const [typesOpen, setTypesOpen] = useState(false)

  const availableLawyers = useMemo(
    () => ADD_LAWYER_OPTIONS.filter((option) => !existingLawyerIds.includes(option.id)),
    [existingLawyerIds]
  )

  const selectedLawyer = ADD_LAWYER_OPTIONS.find((option) => option.id === lawyerOptionId)

  useEffect(() => {
    if (!open) return
    requestAnimationFrame(() => {
      setLawyerOptionId('')
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

  const canSubmit = Boolean(lawyerOptionId && selectedTypeIds.length > 0)
  const hasAvailableLawyers = availableLawyers.length > 0

  const handleAdd = () => {
    if (!canSubmit) return
    onAdd({ lawyerOptionId, letterTypeIds: selectedTypeIds })
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
            <DropdownMenuTrigger asChild disabled={!hasAvailableLawyers}>
              <button
                type="button"
                disabled={!hasAvailableLawyers}
                className={cn(
                  'text-dark-500 flex h-11 w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-4 text-[14px] font-light',
                  !hasAvailableLawyers && 'cursor-not-allowed opacity-60'
                )}
              >
                <span className={cn(!selectedLawyer && 'text-gray-400')}>
                  {selectedLawyer
                    ? t(selectedLawyer.nameKey, selectedLawyer.nameFallback)
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
              className="w-[var(--radix-dropdown-menu-trigger-width)]"
            >
              {availableLawyers.map((option) => (
                <DropdownMenuItem
                  key={option.id}
                  className="cursor-pointer"
                  onClick={() => setLawyerOptionId(option.id)}
                >
                  {t(option.nameKey, option.nameFallback)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {!hasAvailableLawyers ? (
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
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="text-dark-500 flex h-11 w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-4 text-[14px] font-light"
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
        <Button variant="cancel" size="md" onClick={onClose} className="flex-1">
          {t('actions.cancel', 'Cancel')}
        </Button>
        <Button
          variant="primary"
          size="md"
          onClick={handleAdd}
          disabled={!canSubmit}
          className={cn('flex-1', !canSubmit && 'opacity-60')}
        >
          {t('pages.lawyerWorkplace.settings.modals.addLawyer.submit', 'Add')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
