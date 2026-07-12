import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Label } from '@/components/ui/Label'
import { Modal, ModalContent, ModalFooter, ModalHeader } from '@/components/ui/Modal'
import { cn } from '@/lib/utils'
import type { TrainingExample } from '../../../../settings/types'
import { stripSourcePrefix } from '../../../../settings/utils/settingsI18n'

export interface TrainingExampleFormValues {
  title: string
  body: string
  source: string
}

interface EditTrainingExampleModalProps {
  open: boolean
  example: TrainingExample | null
  onClose: () => void
  onSave: (values: TrainingExampleFormValues) => void
}

function getInitialValues(
  example: TrainingExample | null,
  t: (key: string, fallback: string) => string
) {
  if (!example) {
    return { title: '', body: '', source: '' }
  }

  return {
    title: t(example.titleKey, example.titleFallback),
    body: t(example.bodyKey, example.bodyFallback),
    source: stripSourcePrefix(t(example.sourceKey, example.sourceFallback)),
  }
}

export function EditTrainingExampleModal({
  open,
  example,
  onClose,
  onSave,
}: EditTrainingExampleModalProps) {
  const { t } = useTranslation('common')
  const isEditing = example !== null

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [source, setSource] = useState('')

  useEffect(() => {
    if (!open) return
    requestAnimationFrame(() => {
      const initial = getInitialValues(example, t)
      setTitle(initial.title)
      setBody(initial.body)
      setSource(initial.source)
    })
  }, [open, example, t])

  const canSave = title.trim().length > 0 && body.trim().length > 0

  const handleSave = () => {
    if (!canSave) return
    onSave({
      title: title.trim(),
      body: body.trim(),
      source: source.trim(),
    })
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="lg">
      <ModalHeader
        title={
          isEditing
            ? t(
                'pages.lawyerWorkplace.settings.letterTypes.editTrainingExample',
                'Edit training example'
              )
            : t(
                'pages.lawyerWorkplace.settings.letterTypes.addTrainingExampleTitle',
                'Add training example'
              )
        }
      />
      <ModalContent className="flex flex-col gap-4 px-1">
        <div className="flex flex-col gap-2">
          <Label className="text-dark-500 text-[12px] font-medium">
            {t('pages.lawyerWorkplace.settings.letterTypes.exampleTitle', 'Title')}
          </Label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t(
              'pages.lawyerWorkplace.settings.letterTypes.exampleTitlePlaceholder',
              'e.g. Late-payment interest complaint'
            )}
            className="text-dark-500 focus:border-primary-400 h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-[13px] outline-none"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-dark-500 text-[12px] font-medium">
            {t(
              'pages.lawyerWorkplace.settings.letterTypes.exampleBody',
              'Letter content (paste from archive)'
            )}
          </Label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            placeholder={t(
              'pages.lawyerWorkplace.settings.letterTypes.exampleBodyPlaceholder',
              'Paste the full letter text here...'
            )}
            className="text-dark-500 focus:border-primary-400 w-full resize-y rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-[13px] outline-none"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-dark-500 text-[12px] font-medium">
            {t('pages.lawyerWorkplace.settings.letterTypes.exampleSource', 'Sender')}
          </Label>
          <div className="relative">
            <span className="text-light-600 pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[13px]">
              {t('pages.lawyerWorkplace.settings.letterTypes.exampleSourcePrefix', 'from')}
            </span>
            <input
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder={t(
                'pages.lawyerWorkplace.settings.letterTypes.exampleSourcePlaceholder',
                'I. Petrenko'
              )}
              className="text-dark-500 focus:border-primary-400 h-11 w-full rounded-xl border border-gray-200 bg-white py-2 pr-3 pl-12 text-[13px] outline-none"
            />
          </div>
        </div>
      </ModalContent>
      <ModalFooter className="gap-2 px-1 sm:gap-3">
        <Button variant="cancel" size="md" onClick={onClose} className="flex-1">
          {t('actions.cancel', 'Cancel')}
        </Button>
        <Button
          variant="primary"
          size="md"
          onClick={handleSave}
          disabled={!canSave}
          className={cn('flex-1', !canSave && 'opacity-60')}
        >
          {t('actions.save', 'Save')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
