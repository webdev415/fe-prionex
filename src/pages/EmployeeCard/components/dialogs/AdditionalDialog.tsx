import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { DateSelect } from '@/components/ui/DateSelect'
import '@/components/ui/DateSelect.theme.css'
import { Input } from '@/components/ui/Input'
import { useUpdateAdditional } from '@/features/employeeCard/hooks/useEmployeeCard'
import type { EmployeeCard } from '@/features/employeeCard/types.card'
import { parseLanguages } from './parseLanguages'
import { SectionDialog } from './SectionDialog'
import { useSectionSave } from './useSectionSave'

export interface AdditionalDialogProps {
  card: EmployeeCard
  projectId: number | null
  open: boolean
  onClose: () => void
}

const FORM_ID = 'employee-card-additional'

interface EducationRow {
  level: string
  institution: string
  faculty: string
  speciality: string
  graduation_year: string
}

/**
 * The Additional Data dialog.
 *
 * Education is a list the dialog adds to, so it is sent whole rather than as
 * edits to single rows. Languages are typed as one line the way the design
 * shows them - "English (B2), Polish (A2)" - and split on the way out, which
 * is what people already write and avoids a second list to manage.
 */
export function AdditionalDialog({ card, projectId, open, onClose }: AdditionalDialogProps) {
  const { t } = useTranslation()
  const mutation = useUpdateAdditional(card.header.id, projectId)
  const { save, error, saving } = useSectionSave(mutation, onClose)

  const [military, setMilitary] = useState(card.additional.military_status ?? '')
  const [visa, setVisa] = useState(card.additional.visa_status ?? '')
  const [languages, setLanguages] = useState(
    card.additional.languages
      .map((one) => (one.level ? `${one.language} (${one.level})` : one.language))
      .join(', ')
  )
  const [educations, setEducations] = useState<EducationRow[]>(
    card.additional.educations.map((one) => ({
      level: one.level ?? '',
      institution: one.institution ?? '',
      faculty: one.faculty ?? '',
      speciality: one.speciality ?? '',
      graduation_year: one.graduation_year ? String(one.graduation_year) : '',
    }))
  )

  const update = (index: number, changes: Partial<EducationRow>) =>
    setEducations(educations.map((row, at) => (at === index ? { ...row, ...changes } : row)))

  return (
    <SectionDialog
      open={open}
      title={t('pages.employeeCard.dialogs.additional')}
      formId={FORM_ID}
      saving={saving}
      error={error}
      onClose={onClose}
    >
      <form
        id={FORM_ID}
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault()
          void save({
            military_status: military.trim() || null,
            visa_status: visa.trim() || null,
            languages: parseLanguages(languages),
            educations: educations
              .filter((row) => row.institution.trim() || row.level.trim())
              .map((row) => ({
                level: row.level.trim() || null,
                institution: row.institution.trim() || null,
                faculty: row.faculty.trim() || null,
                speciality: row.speciality.trim() || null,
                graduation_year: Number(row.graduation_year) || null,
              })),
          })
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t('pages.employeeCard.fields.militaryService')}
            value={military}
            onChange={(event) => setMilitary(event.target.value)}
          />
          <Input
            label={t('pages.employeeCard.fields.visaStatus')}
            value={visa}
            onChange={(event) => setVisa(event.target.value)}
          />
        </div>

        <Input
          label={t('pages.employeeCard.fields.languages')}
          helperText={t('pages.employeeCard.dialogs.languagesHint')}
          value={languages}
          onChange={(event) => setLanguages(event.target.value)}
        />

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-foreground text-sm font-medium">
              {t('pages.employeeCard.dialogs.education')}
            </h3>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() =>
                setEducations([
                  ...educations,
                  {
                    level: '',
                    institution: '',
                    faculty: '',
                    speciality: '',
                    graduation_year: '',
                  },
                ])
              }
            >
              {t('pages.employeeCard.dialogs.add')}
            </Button>
          </div>

          {educations.map((row, index) => (
            <div key={index} className="border-border space-y-3 rounded-lg border p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label={t('pages.employeeCard.fields.educationLevel')}
                  value={row.level}
                  onChange={(event) => update(index, { level: event.target.value })}
                />
                <Input
                  label={t('pages.employeeCard.fields.institution')}
                  value={row.institution}
                  onChange={(event) => update(index, { institution: event.target.value })}
                />
                <Input
                  label={t('pages.employeeCard.fields.faculty')}
                  value={row.faculty}
                  onChange={(event) => update(index, { faculty: event.target.value })}
                />
                {/*
                  A year, not a date. The field stores one number, so a picker
                  offering a month and a day would ask for two more that are
                  thrown away on save - and typing a year by hand invites the
                  typo the bounds below would then reject.
                */}
                <div className="space-y-1.5">
                  <span className="text-muted-foreground text-xs">
                    {t('pages.employeeCard.fields.graduationYear')}
                  </span>
                  <DateSelect
                    value={row.graduation_year ? new Date(Number(row.graduation_year), 0, 1) : null}
                    onChange={({ value }) =>
                      update(index, {
                        graduation_year: value ? String(value.getFullYear()) : '',
                      })
                    }
                    showYearPicker
                    format="yyyy"
                    min={new Date(1900, 0, 1)}
                    max={new Date(2100, 11, 31)}
                    placeholder={t('pages.employeeCard.fields.graduationYear')}
                  />
                </div>
              </div>
              <Button
                type="button"
                variant="cancel"
                size="sm"
                onClick={() => setEducations(educations.filter((_, at) => at !== index))}
              >
                {t('actions.delete')}
              </Button>
            </div>
          ))}
        </div>
      </form>
    </SectionDialog>
  )
}
