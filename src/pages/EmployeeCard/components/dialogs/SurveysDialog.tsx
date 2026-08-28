import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import { DateSelect } from '@/components/ui/DateSelect'
import '@/components/ui/DateSelect.theme.css'
import { Input } from '@/components/ui/Input'
import { Modal, ModalContent, ModalFooter, ModalHeader } from '@/components/ui/Modal'
import { addSurvey, updateSurvey } from '@/features/employeeCard/api/employeeCardApi'
import { employeeCardKeys } from '@/features/employeeCard/hooks/useEmployeeCard'
import type { EmployeeCard, SurveyInput } from '@/features/employeeCard/types.card'
import { formatPickerDateAsYMD, parsePickerYMD } from '@/lib/dateUtils'
import { getErrorMessage } from '@/lib/errors'

export interface SurveysDialogProps {
  card: EmployeeCard
  projectId: number | null
  /** The survey being corrected, or null to record a new one. */
  surveyId: number | null
  open: boolean
  onClose: () => void
}

const FORM_ID = 'employee-card-survey'

/** What a score is marked out of here. The field is bounded by it. */
const OUT_OF = 100

const BLANK = {
  name: '',
  completed_on: '',
  score: '',
  details_url: '',
}

/**
 * The surveys somebody answered, recorded one at a time.
 *
 * Surveys run outside this system - Google Forms - and most employees here are
 * recorded under personal addresses, five providers between them. So an export
 * cannot be attributed to people by matching what it carries; whoever enters
 * the answer supplies the judgement the matching cannot. That is why this is a
 * form on one person's card rather than a file covering many.
 *
 * A dated answer takes its place in the chronology too, which is what the
 * section is for: a survey nobody can see in the history is a survey that only
 * half happened.
 *
 * One dialog for both jobs. Adding and correcting ask for exactly the same
 * six things, and a second dialog would be the same form with a different
 * title - two places to keep in step for no gain to the reader.
 */
export function SurveysDialog({ card, projectId, surveyId, open, onClose }: SurveysDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const employeeId = card.header.id
  const editing =
    surveyId === null ? null : (card.surveys.find((one) => one.id === surveyId) ?? null)

  const [values, setValues] = useState(() =>
    editing
      ? {
          name: editing.name,
          completed_on: editing.completed_on ?? '',
          score: editing.score === null ? '' : String(editing.score),
          details_url: editing.details_url ?? '',
        }
      : BLANK
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const payload = (): SurveyInput => ({
    name: values.name.trim(),
    completed_on: values.completed_on || null,
    score: values.score.trim() ? Number(values.score) : null,
    // Not asked for, but not invented either: the field above is bounded by
    // 100, so a score entered here is out of 100 as a matter of fact rather
    // than assumption. An import still states its own total, which is why the
    // column stays - a quiz marked out of twenty is still a quiz.
    max_score: values.score.trim() ? OUT_OF : null,
    // Inferred rather than asked for: a result with a score is one that came
    // back, and a question about it on top of the score is a question nobody
    // needs to answer twice.
    status: values.score.trim() ? 'completed' : 'pending',
    details_url: values.details_url.trim() || null,
  })

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      const saved = editing
        ? await updateSurvey(employeeId, editing.id, payload())
        : await addSurvey(employeeId, payload())
      queryClient.setQueryData(employeeCardKeys.one(employeeId, projectId), saved)
      onClose()
    } catch (caught) {
      setError(getErrorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="2xl">
      <ModalHeader title={t('pages.employeeCard.dialogs.surveys')} />
      <ModalContent>
        <p className="text-muted-foreground mb-4 text-sm">{t('pages.employeeCard.surveys.hint')}</p>

        {error && (
          <p role="alert" className="text-destructive mb-4 text-sm">
            {error}
          </p>
        )}

        <form
          id={FORM_ID}
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          <Input
            label={t('pages.employeeCard.surveys.name')}
            value={values.name}
            required
            disabled={busy}
            onChange={(event) => setValues({ ...values, name: event.target.value })}
            className="sm:col-span-2"
          />

          <div className="space-y-1.5">
            <span className="text-muted-foreground text-xs">
              {t('pages.employeeCard.surveys.completedOn')}
            </span>
            <DateSelect
              value={parsePickerYMD(values.completed_on)}
              onChange={({ value }) =>
                setValues({ ...values, completed_on: value ? formatPickerDateAsYMD(value) : '' })
              }
              max={new Date()}
              format="dd.MM.yyyy"
              allowManualInput
              placeholder={t('pages.employeeCard.surveys.completedOn')}
            />
          </div>

          <Input
            label={t('pages.employeeCard.surveys.detailsUrl')}
            value={values.details_url}
            disabled={busy}
            onChange={(event) => setValues({ ...values, details_url: event.target.value })}
          />

          <Input
            label={t('pages.employeeCard.surveys.score')}
            type="number"
            min={0}
            max={OUT_OF}
            value={values.score}
            disabled={busy}
            onChange={(event) => setValues({ ...values, score: event.target.value })}
            helperText={t('pages.employeeCard.surveys.scoreHint')}
          />
        </form>
      </ModalContent>
      <ModalFooter>
        {/*
          Cancel and save, the way every other dialog on this card ends. The
          submit sits here rather than in the form because that is where
          somebody looks for it, and `form` is what keeps it a submit while it
          lives outside the fields it commits.
        */}
        <Button
          type="button"
          variant="cancel"
          onClick={onClose}
          disabled={busy}
          className="h-[45px] flex-1 text-sm"
        >
          {t('actions.cancel')}
        </Button>
        <Button
          type="submit"
          form={FORM_ID}
          variant="primary"
          disabled={busy || !values.name.trim()}
          className="h-[45px] flex-1 text-sm"
        >
          {editing ? t('pages.employeeCard.surveys.save') : t('pages.employeeCard.surveys.add')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
