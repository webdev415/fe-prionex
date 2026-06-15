import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Label } from '@/components/ui/Label'
import { Modal, ModalContent, ModalFooter, ModalHeader } from '@/components/ui/Modal'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import type { LetterTypeConfig } from '../../../settings/types'
import { LETTER_TYPE_COLOR_OPTIONS } from '../constants'
import { LetterTypeBadge } from '../LetterTypeBadge'

interface AddLetterTypeModalProps {
  open: boolean
  onClose: () => void
  onAdd: (input: Pick<LetterTypeConfig, 'nameFallback' | 'colorId'>) => void
}

export function AddLetterTypeModal({ open, onClose, onAdd }: AddLetterTypeModalProps) {
  const { t } = useTranslation('common')
  const [name, setName] = useState('')
  const [colorId, setColorId] = useState(LETTER_TYPE_COLOR_OPTIONS[0]?.id ?? 'teal')

  useEffect(() => {
    if (!open) return
    requestAnimationFrame(() => {
      setName('')
      setColorId(LETTER_TYPE_COLOR_OPTIONS[0]?.id ?? 'teal')
    })
  }, [open])

  const previewName =
    name.trim() ||
    t('pages.lawyerWorkplace.settings.letterTypes.previewFallback', 'Customer complaint')
  const canSubmit = name.trim().length > 0

  const handleAdd = () => {
    if (!canSubmit) return
    onAdd({ nameFallback: name.trim(), colorId })
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
        title={t('pages.lawyerWorkplace.settings.modals.addType.title', 'Add type')}
      />
      <ModalContent className="flex flex-col gap-5 px-1">
        <div className="flex flex-col gap-2">
          <Label className="text-dark-500 text-[13px] font-medium">
            {t('pages.lawyerWorkplace.settings.modals.addType.letterTypes', 'Letter types')}
          </Label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t(
              'pages.lawyerWorkplace.settings.modals.addType.placeholder',
              'ex. Customer complaint'
            )}
            className="text-dark-500 focus:border-primary-400 h-11 w-full rounded-xl border border-gray-200 bg-white px-4 text-[14px] outline-none placeholder:text-gray-400"
          />
        </div>

        <div className="flex flex-col gap-3">
          <Label className="text-dark-500 text-[13px] font-medium">
            {t('pages.lawyerWorkplace.settings.modals.addType.color', 'Color')}
          </Label>
          <div className="flex flex-wrap gap-3">
            {LETTER_TYPE_COLOR_OPTIONS.map((option) => {
              const selected = colorId === option.id
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-label={option.id}
                  onClick={() => setColorId(option.id)}
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full transition-all',
                    selected && 'ring-2 ring-offset-2',
                    selected && option.ringClass
                  )}
                >
                  <span className={cn('h-5 w-5 rounded-full', option.dotClass)} />
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex flex-col items-start gap-2">
          <Label className="text-dark-500 text-[13px] font-medium">
            {t('pages.lawyerWorkplace.settings.modals.addType.preview', 'Preview')}
          </Label>
          <LetterTypeBadge
            t={t}
            letterType={{
              colorId,
              nameKey: 'preview',
              nameFallback: previewName,
            }}
            size="md"
            className="w-fit"
          />
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
          {t('pages.lawyerWorkplace.settings.modals.addType.submit', 'Add')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
