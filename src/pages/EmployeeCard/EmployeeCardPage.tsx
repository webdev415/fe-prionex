import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useSearchParams } from 'react-router-dom'
import { ChronologySection } from '@/features/employeeCard'
import { useCardNeighbours, useEmployeeCard } from '@/features/employeeCard/hooks/useEmployeeCard'
import { CardNavigation } from './components/CardNavigation'
import { CardSections } from './components/CardSections'
import { CardTabs } from './components/CardTabs'
import { DocumentsSection } from './components/DocumentsSection'
import { ProfilePanel } from './components/ProfilePanel'
import { SurveysSection } from './components/SurveysSection'
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
  const { data: neighbours } = useCardNeighbours(employeeId, listQuery)
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
      <CardNavigation listQuery={listQuery} neighbours={neighbours} />

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

            <CardSections card={data} />
            <DocumentsSection card={data} />
            <SurveysSection card={data} />

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
