import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal, ModalContent, ModalFooter, ModalHeader } from '@/components/ui/Modal'
import { importSurveys } from '@/features/employeeCard/api/employeeCardApi'
import { employeeCardKeys } from '@/features/employeeCard/hooks/useEmployeeCard'
import { getErrorMessage } from '@/lib/errors'
import type { SurveyImportReport } from '@/features/employeeCard/types.card'

export interface SurveysDialogProps {
  open: boolean
  onClose: () => void
}

/**
 * Loading an export of survey answers.
 *
 * One file covers whoever is in it, matched by email - so this is not an
 * action on the employee whose card is open, and the wording says so. Every
 * card in the file changes, which is why the whole card cache is dropped
 * afterwards rather than the open one refreshed.
 *
 * The refusals are the point of the screen. The server returns each rejected
 * row with its line number precisely so a file can be corrected, and a dialog
 * that showed only "5 loaded" would throw away the half that makes a bad file
 * fixable.
 */
export function SurveysDialog({ open, onClose }: SurveysDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const fileInput = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<SurveyImportReport | null>(null)

  const run = async () => {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const answer = await importSurveys(file, name.trim())
      setReport(answer)
      await queryClient.invalidateQueries({ queryKey: employeeCardKeys.all })
    } catch (caught) {
      // The shared reader, not a hand-rolled one: a rejected body comes back
      // with `detail` as a list of validation objects rather than a sentence,
      // and reading only the string case turns every one of those into "that
      // could not be saved" - which says nothing about what to fix.
      setError(getErrorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="2xl">
      <ModalHeader title={t('pages.employeeCard.dialogs.surveys')} />
      <ModalContent>
        <p className="text-muted-foreground mb-4 text-sm">
          {t('pages.employeeCard.surveys.importHint')}
        </p>

        {error && (
          <p role="alert" className="text-destructive mb-4 text-sm">
            {error}
          </p>
        )}

        <div className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-muted-foreground text-xs">
              {t('pages.employeeCard.surveys.file')}
            </span>
            <input
              ref={fileInput}
              type="file"
              accept=".csv,text/csv"
              disabled={busy}
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null)
                setReport(null)
              }}
              className="text-foreground file:border-border file:bg-muted file:text-foreground block w-full text-sm file:mr-3 file:rounded-md file:border file:px-3 file:py-1.5"
            />
          </label>

          <Input
            label={t('pages.employeeCard.surveys.name')}
            value={name}
            disabled={busy}
            onChange={(event) => setName(event.target.value)}
            helperText={t('pages.employeeCard.surveys.nameHint')}
          />

          {report && (
            <div className="border-border space-y-3 rounded-lg border p-4">
              <p className="text-foreground text-sm">
                {t('pages.employeeCard.surveys.loaded', {
                  created: report.created,
                  updated: report.updated,
                  refused: report.refused,
                })}
              </p>

              {report.rows.length > 0 && (
                <ul className="space-y-1.5">
                  {report.rows.map((row) => (
                    <li key={`${row.row}-${row.email ?? ''}`} className="text-sm">
                      <span className="text-muted-foreground tabular-nums">
                        {t('pages.employeeCard.surveys.line', { line: row.row })}
                      </span>{' '}
                      <span className="text-foreground">{row.email || '—'}</span>{' '}
                      <span className="text-muted-foreground">— {row.reason}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </ModalContent>
      <ModalFooter>
        <Button
          type="button"
          variant="cancel"
          onClick={onClose}
          disabled={busy}
          className="h-[45px] flex-1 text-sm"
        >
          {t('actions.close')}
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={() => void run()}
          disabled={busy || !file}
          className="h-[45px] flex-1 text-sm"
        >
          {t('pages.employeeCard.surveys.import')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
