import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { DateSelect } from '@/components/ui/DateSelect'
import '@/components/ui/DateSelect.theme.css'
import { Input } from '@/components/ui/Input'
import { useReplaceContacts } from '@/features/employeeCard/hooks/useEmployeeCard'
import type { EmployeeCard, RelativeInput } from '@/features/employeeCard/types.card'
import { formatPickerDateAsYMD, parsePickerYMD } from '@/lib/dateUtils'
import { SectionDialog } from './SectionDialog'
import { useSectionSave } from './useSectionSave'

export interface ContactsDialogProps {
  card: EmployeeCard
  projectId: number | null
  open: boolean
  onClose: () => void
}

const FORM_ID = 'employee-card-contacts'

/**
 * The Contacts and Family dialog.
 *
 * The whole set is sent, because that is what the dialog does: rows are added
 * and removed together and saved once, so anything removed here is removed by
 * not coming back.
 *
 * A row with no name is dropped before sending rather than refused. An empty
 * row is what an Add button produces when somebody changes their mind, and
 * making them delete it to save is a worse answer than ignoring it.
 */
export function ContactsDialog({ card, projectId, open, onClose }: ContactsDialogProps) {
  const { t } = useTranslation()
  const mutation = useReplaceContacts(card.header.id, projectId)
  const { save, error, saving } = useSectionSave(mutation, onClose)

  const [rows, setRows] = useState<RelativeInput[]>([
    ...card.contacts.map((one) => ({
      kind: 'contact' as const,
      full_name: one.full_name,
      relation: one.relation ?? '',
      phone: one.phone ?? '',
    })),
    ...card.children.map((one) => ({
      kind: 'child' as const,
      full_name: one.full_name,
      date_of_birth: one.date_of_birth ?? '',
    })),
  ])

  const update = (index: number, changes: Partial<RelativeInput>) =>
    setRows(rows.map((row, at) => (at === index ? { ...row, ...changes } : row)))

  const add = (kind: 'contact' | 'child') => setRows([...rows, { kind, full_name: '' }])

  const remove = (index: number) => setRows(rows.filter((_, at) => at !== index))

  const group = (kind: 'contact' | 'child', title: string, addLabel: string) => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-foreground text-sm font-medium">{title}</h3>
        <Button type="button" variant="secondary" size="sm" onClick={() => add(kind)}>
          {addLabel}
        </Button>
      </div>

      {rows.map((row, index) =>
        row.kind !== kind ? null : (
          <div key={index} className="border-border space-y-3 rounded-lg border p-3">
            <Input
              label={
                kind === 'contact'
                  ? t('pages.employeeCard.fields.name')
                  : t('pages.employeeCard.fields.childName')
              }
              value={row.full_name}
              onChange={(event) => update(index, { full_name: event.target.value })}
            />
            {kind === 'contact' ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label={t('pages.employeeCard.fields.relation')}
                  value={row.relation ?? ''}
                  onChange={(event) => update(index, { relation: event.target.value })}
                />
                <Input
                  label={t('pages.employeeCard.fields.phone')}
                  value={row.phone ?? ''}
                  onChange={(event) => update(index, { phone: event.target.value })}
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <span className="text-muted-foreground text-xs">
                  {t('pages.employeeCard.fields.dateOfBirth')}
                </span>
                <DateSelect
                  value={parsePickerYMD(row.date_of_birth)}
                  onChange={({ value }) =>
                    update(index, {
                      date_of_birth: value ? formatPickerDateAsYMD(value) : '',
                    })
                  }
                  max={new Date()}
                  format="dd.MM.yyyy"
                  allowManualInput
                  placeholder={t('pages.employeeCard.fields.dateOfBirth')}
                />
              </div>
            )}
            <Button type="button" variant="cancel" size="sm" onClick={() => remove(index)}>
              {t('actions.delete')}
            </Button>
          </div>
        )
      )}
    </div>
  )

  return (
    <SectionDialog
      open={open}
      title={t('pages.employeeCard.dialogs.contacts')}
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
          void save(
            rows
              .filter((row) => row.full_name.trim())
              .map((row) => ({
                ...row,
                full_name: row.full_name.trim(),
                relation: row.relation?.trim() || null,
                phone: row.phone?.trim() || null,
                date_of_birth: row.date_of_birth || null,
              }))
          )
        }}
      >
        {group(
          'contact',
          t('pages.employeeCard.fields.contactPerson'),
          t('pages.employeeCard.dialogs.add')
        )}
        {group(
          'child',
          t('pages.employeeCard.fields.children'),
          t('pages.employeeCard.dialogs.add')
        )}
      </form>
    </SectionDialog>
  )
}
