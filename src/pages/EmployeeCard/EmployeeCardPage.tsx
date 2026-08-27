import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ChronologySection } from '@/features/employeeCard'
import { useEmployeeCard } from '@/features/employeeCard/hooks/useEmployeeCard'
import { CardTabs } from './components/CardTabs'
import { ProfilePanel } from './components/ProfilePanel'
import { useScrollSpy } from './hooks/useScrollSpy'

const SECTION_IDS = [
  'personal-information',
  'work-information',
  'contacts-and-family',
  'additional-data',
  'documents-and-hiring',
  'surveys',
  'chronology',
]

export function EmployeeCardPage() {
  const { t } = useTranslation()
  const { userId } = useParams<{ userId: string }>()
  const [searchParams] = useSearchParams()

  const employeeId = Number(userId)
  const projectId = Number(searchParams.get('project_id')) || null
  const listQuery = searchParams.toString()

  const { data, isLoading, isError } = useEmployeeCard(employeeId, projectId)
  const activeSection = useScrollSpy(SECTION_IDS)

  const tabs = useMemo(
    () =>
      SECTION_IDS.map((id) => ({
        id,
        label: t(`pages.employeeCard.sections.${id}`),
      })),
    [t]
  )

  if (Number.isNaN(employeeId) || employeeId < 1) {
    return <p className="text-destructive p-6">{t('pages.employeeCard.notFound')}</p>
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <Link
        to={`/dashboard/team-management/users${listQuery ? `?${listQuery}` : ''}`}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm"
      >
        {t('pages.employeeCard.backToList')}
      </Link>

      {isLoading && <p className="text-muted-foreground">{t('common.loading')}</p>}

      {isError && (
        <p role="alert" className="text-destructive">
          {t('pages.employeeCard.failed')}
        </p>
      )}

      {data && (
        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <ProfilePanel header={data.header} />

          <div className="min-w-0 space-y-6">
            <CardTabs
              tabs={tabs}
              activeId={activeSection}
              ariaLabel={t('pages.employeeCard.sectionNav')}
            />

            {SECTION_IDS.filter((id) => id !== 'chronology').map((id) => (
              <section
                key={id}
                id={id}
                tabIndex={-1}
                aria-labelledby={`${id}-heading`}
                className="border-border bg-card scroll-mt-24 rounded-xl border p-6"
              >
                <h2 id={`${id}-heading`} className="text-foreground text-lg font-semibold">
                  {t(`pages.employeeCard.sections.${id}`)}
                </h2>
              </section>
            ))}

            <section
              id="chronology"
              tabIndex={-1}
              className="border-border bg-card scroll-mt-24 rounded-xl border p-6"
            >
              <ChronologySection userId={employeeId} />
            </section>
          </div>
        </div>
      )}
    </div>
  )
}
