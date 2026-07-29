import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Label } from '@/components/ui/Label'
import { Modal, ModalContent, ModalFooter, ModalHeader } from '@/components/ui/Modal'
import { Icons } from '@/lib/icons'
import { cn, generateCode } from '@/lib/utils'
import type { LetterTypeConfig } from '../../../settings/types'
import { LETTER_TYPE_COLOR_OPTIONS } from '../constants'
import { LetterTypeBadge } from '../LetterTypeBadge'

// Backend letter-type id pattern (see POST /letter-types).
const CODE_PATTERN = /^[a-z][a-z0-9_-]*$/

interface AddLetterTypeModalProps {
  open: boolean
  onClose: () => void
  onAdd: (input: Pick<LetterTypeConfig, 'nameFallback' | 'colorId' | 'id'>) => Promise<void>
  isSubmitting?: boolean
}

export function AddLetterTypeModal({
  open,
  onClose,
  onAdd,
  isSubmitting = false,
}: AddLetterTypeModalProps) {
  const { t } = useTranslation('common')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [colorId, setColorId] = useState(LETTER_TYPE_COLOR_OPTIONS[0]?.id ?? 'teal')
  // The code is auto-derived from the name until the user edits it by hand.
  const codeManuallyEdited = useRef(false)

  useEffect(() => {
    if (!open) return
    requestAnimationFrame(() => {
      setName('')
      setCode('')
      codeManuallyEdited.current = false
      setColorId(LETTER_TYPE_COLOR_OPTIONS[0]?.id ?? 'teal')
    })
  }, [open])

  const handleNameChange = (value: string) => {
    setName(value)
    if (!codeManuallyEdited.current) {
      setCode(generateCode(value))
    }
  }

  const handleCodeChange = (value: string) => {
    codeManuallyEdited.current = true
    setCode(value)
  }

  const previewName =
    name.trim() ||
    t('pages.lawyerWorkplace.settings.letterTypes.previewFallback', 'Letter type name')
  const codeInvalid = code.length > 0 && !CODE_PATTERN.test(code)
  const canSubmit = name.trim().length > 0 && CODE_PATTERN.test(code) && !isSubmitting

  const handleAdd = async () => {
    if (!canSubmit) return
    await onAdd({ nameFallback: name.trim(), colorId, id: code })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="md">
      <ModalHeader
        icon={
          <div className="bg-primary-300 flex h-10 w-10 items-center justify-center rounded-full">
            <Icons.UserMultiple02 size={20} strokeWidth={1.5} className="text-foreground" />
          </div>
        }
        title={t('pages.lawyerWorkplace.settings.modals.addType.title', 'Add type')}
      />
      <ModalContent className="flex flex-col gap-5 px-1">
        <div className="flex flex-col gap-2">
          <Label className="text-foreground text-[13px] font-medium">
            {t('pages.lawyerWorkplace.settings.modals.addType.letterTypes', 'Letter types')}
          </Label>
          <input
            type="text"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder={t(
              'pages.lawyerWorkplace.settings.modals.addType.placeholder',
              'e.g. Payment dispute'
            )}
            className="text-foreground focus:border-primary-400 border-border bg-input placeholder:text-muted-foreground h-11 w-full rounded-xl border px-4 text-[14px] outline-none"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-foreground text-[13px] font-medium">
            {t('pages.lawyerWorkplace.settings.modals.addType.code', 'Code')}
          </Label>
          <input
            type="text"
            value={code}
            onChange={(e) => handleCodeChange(e.target.value)}
            placeholder={t(
              'pages.lawyerWorkplace.settings.modals.addType.codePlaceholder',
              'e.g. payment_dispute'
            )}
            className={cn(
              'text-foreground focus:border-primary-400 border-border bg-input placeholder:text-muted-foreground h-11 w-full rounded-xl border px-4 text-[14px] outline-none',
              codeInvalid && 'border-error focus:border-error'
            )}
          />
          <p className="text-muted-foreground text-[12px]">
            {t(
              'pages.lawyerWorkplace.settings.modals.addType.codeHint',
              'Unique ID for the API. Auto-generated from the name.'
            )}
          </p>
          {codeInvalid && (
            <p className="text-error text-[12px]">
              {t(
                'pages.lawyerWorkplace.settings.modals.addType.codeError',
                'Use latin letters, digits, _ or -; must start with a letter.'
              )}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <Label className="text-foreground text-[13px] font-medium">
            {t('pages.lawyerWorkplace.settings.modals.addType.color', 'Color')}
          </Label>
          <div className="flex flex-wrap gap-3">
            {LETTER_TYPE_COLOR_OPTIONS.map((option) => {
              const selected = colorId === option.id
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-label={t(
                    `pages.lawyerWorkplace.settings.letterTypes.colors.${option.id}`,
                    option.id
                  )}
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
          <Label className="text-foreground text-[13px] font-medium">
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
            ? t('pages.lawyerWorkplace.settings.modals.addType.submitting', 'Adding…')
            : t('pages.lawyerWorkplace.settings.modals.addType.submit', 'Add')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
