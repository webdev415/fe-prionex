import { useTranslation } from 'react-i18next'
import { displayName } from '@/features/employeeCard/lib/displayName'
import { mayWrite } from '@/features/employeeCard/lib/mayWrite'
import type { EmployeeCard } from '@/features/employeeCard/types.card'
import { CardSection } from './CardSection'
import { FieldGrid } from './FieldGrid'

export interface CardSectionsProps {
  card: EmployeeCard
  onEdit?: (section: string) => void
}

/**
 * Everything the card shows, read-only.
 *
 * Dates are rendered in the reader's own locale rather than as the ISO string
 * the API sends.
 *
 * Nothing recorded reads as a dash, wherever it appears - the same mark the
 * employees list writes in an empty cell. Spelling it out put a sentence
 * everywhere there was no value, and on a new employee that is nearly
 * everywhere: the few real values had to be picked out of a wall of prose.
 */
export function CardSections({ card, onEdit }: CardSectionsProps) {
  const { t, i18n } = useTranslation()

  const day = (value: string | null) =>
    value ? new Date(value).toLocaleDateString(i18n.language) : null

  const editable = (section: string) =>
    mayWrite(card) && onEdit
      ? { editLabel: t('pages.employeeCard.edit'), onEdit: () => onEdit(section) }
      : {}

  return (
    <>
      <CardSection
        id="personal-information"
        title={t('pages.employeeCard.sections.personal-information')}
        {...editable('personal')}
      >
        <FieldGrid
          fields={[
            { label: t('pages.employeeCard.fields.fullName'), value: displayName(card.header) },
            {
              label: t('pages.employeeCard.fields.dateOfBirth'),
              value: day(card.personal.date_of_birth),
            },
            { label: t('pages.employeeCard.fields.phone'), value: card.header.phone },
            { label: t('pages.employeeCard.fields.telegram'), value: card.personal.telegram },
            { label: t('pages.employeeCard.fields.email'), value: card.header.email },
            { label: t('pages.employeeCard.fields.city'), value: card.personal.city },
            { label: t('pages.employeeCard.fields.address'), value: card.personal.address },
            {
              label: t('pages.employeeCard.fields.novaPoshta'),
              value: card.personal.nova_poshta_branch,
            },
            {
              label: t('pages.employeeCard.fields.workFormat'),
              value: card.header.work_format
                ? t(`pages.employeeCard.workFormat.${card.header.work_format}`)
                : null,
            },
            {
              label: t('pages.employeeCard.fields.referralSource'),
              value: card.personal.referral_source,
            },
          ]}
        />
      </CardSection>

      <CardSection
        id="work-information"
        title={t('pages.employeeCard.sections.work-information')}
        {...editable('work')}
      >
        <FieldGrid
          fields={[
            { label: t('pages.employeeCard.fields.department'), value: card.work.department },
            { label: t('pages.employeeCard.fields.position'), value: card.work.position },
            { label: t('pages.employeeCard.fields.manager'), value: card.work.manager },
            {
              label: t('pages.employeeCard.fields.hiredAt'),
              value: day(card.work.hired_at),
            },
          ]}
        />
      </CardSection>

      <CardSection
        id="contacts-and-family"
        title={t('pages.employeeCard.sections.contacts-and-family')}
        {...editable('contacts')}
      >
        <div className="space-y-6">
          <div className="space-y-3">
            <h3 className="text-foreground text-sm font-medium">
              {t('pages.employeeCard.fields.contactPerson')}
            </h3>
            {card.contacts.length === 0 ? (
              <p className="text-muted-foreground text-sm">—</p>
            ) : (
              <ul className="space-y-3">
                {card.contacts.map((contact) => (
                  <li key={contact.id}>
                    <FieldGrid
                      fields={[
                        {
                          label: t('pages.employeeCard.fields.name'),
                          value: contact.full_name,
                        },
                        {
                          label: t('pages.employeeCard.fields.relation'),
                          value: contact.relation,
                        },
                        {
                          label: t('pages.employeeCard.fields.phone'),
                          value: contact.phone,
                        },
                      ]}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-3">
            <h3 className="text-foreground text-sm font-medium">
              {t('pages.employeeCard.fields.children')}
            </h3>
            {card.children.length === 0 ? (
              <p className="text-muted-foreground text-sm">—</p>
            ) : (
              <ul className="space-y-3">
                {card.children.map((child) => (
                  <li key={child.id}>
                    <FieldGrid
                      fields={[
                        {
                          label: t('pages.employeeCard.fields.name'),
                          value: child.full_name,
                        },
                        {
                          label: t('pages.employeeCard.fields.dateOfBirth'),
                          value: day(child.date_of_birth),
                        },
                      ]}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </CardSection>

      <CardSection
        id="additional-data"
        title={t('pages.employeeCard.sections.additional-data')}
        {...editable('additional')}
      >
        <div className="space-y-6">
          <FieldGrid
            fields={[
              {
                label: t('pages.employeeCard.fields.militaryService'),
                value: card.additional.military_status,
              },
              {
                label: t('pages.employeeCard.fields.visaStatus'),
                value: card.additional.visa_status,
              },
              {
                label: t('pages.employeeCard.fields.languages'),
                value: card.additional.languages
                  .map((one) => (one.level ? `${one.language} (${one.level})` : one.language))
                  .join(', '),
              },
            ]}
          />

          {card.additional.educations.length > 0 && (
            <ul className="space-y-4">
              {card.additional.educations.map((education) => (
                <li key={education.id}>
                  <FieldGrid
                    fields={[
                      {
                        label: t('pages.employeeCard.fields.educationLevel'),
                        value: education.level,
                      },
                      {
                        label: t('pages.employeeCard.fields.institution'),
                        value: education.institution,
                      },
                      {
                        label: t('pages.employeeCard.fields.faculty'),
                        value: [education.faculty, education.speciality]
                          .filter(Boolean)
                          .join(' / '),
                      },
                      {
                        label: t('pages.employeeCard.fields.graduationYear'),
                        value: education.graduation_year,
                      },
                    ]}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardSection>
    </>
  )
}
