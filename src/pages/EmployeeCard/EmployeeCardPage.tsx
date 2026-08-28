import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useSearchParams } from 'react-router-dom'
import { ChronologySection } from '@/features/employeeCard'
import { useCardNeighbours, useEmployeeCard } from '@/features/employeeCard/hooks/useEmployeeCard'
import { BackToList, CardNavigation } from './components/CardNavigation'
import { CardSections } from './components/CardSections'
import { CardTabs } from './components/CardTabs'
import { DocumentsSection } from './components/DocumentsSection'
import { ProfilePanel } from './components/ProfilePanel'
import { SurveysSection } from './components/SurveysSection'
import { AdditionalDialog } from './components/dialogs/AdditionalDialog'
import { ContactsDialog } from './components/dialogs/ContactsDialog'
import { DocumentsDialog } from './components/dialogs/DocumentsDialog'
import { PersonalDialog } from './components/dialogs/PersonalDialog'
import { WorkDialog } from './components/dialogs/WorkDialog'
import { CARD_HEADER_OFFSET, useScrollSpy } from './hooks/useScrollSpy'
import { useTailSpace } from './hooks/useTailSpace'

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
  const rendered = Boolean(data)
  const { active: activeSection, select: selectSection } = useScrollSpy(
    SECTION_IDS,
    CARD_HEADER_OFFSET,
    rendered
  )
  const tailSpace = useTailSpace(SECTION_IDS[SECTION_IDS.length - 1], CARD_HEADER_OFFSET, rendered)
  const [editing, setEditing] = useState<string | null>(null)

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
    /*
      The card scrolls inside its own container rather than with the page.
      ``main`` in DashboardLayout carries ``overflow-y-auto`` with only
      ``min-h-screen``, so it grows instead of scrolling and the document
      scrolls instead - but it still counts as the scroll container that
      ``position: sticky`` measures against, and a container that never
      scrolls means sticky never engages, at any offset. Giving the card a
      container that really does scroll is what makes the panel and the header
      stay put, and it is what the design asks for in as many words: fixed at
      the top of the content container.

      The height cancels the padding ``main`` puts around this: 80px above,
      and 24px below - the largest of its three responsive bottom paddings,
      so no breakpoint ends up with a second scrollbar.
    */
    <div className="h-[calc(100vh-104px)] overflow-y-auto px-4 pb-4 [scrollbar-width:none] md:px-6 md:pb-6 [&::-webkit-scrollbar]:hidden">
      {isLoading && <p className="text-muted-foreground pt-4">{t('common.loading')}</p>}

      {isError && (
        <p role="alert" className="text-destructive">
          {t('pages.employeeCard.failed')}
        </p>
      )}

      {data && (
        <div className="grid items-start gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="sticky top-0 space-y-4 pt-4 md:pt-6">
            <BackToList listQuery={listQuery} />
            <ProfilePanel header={data.header} />
          </div>

          <div className="min-w-0 space-y-6">
            {/*
              Walking the list and choosing a section are the same job - going
              somewhere - so they stay on screen together while the sections
              scroll under them. They are one sticky block rather than two so
              the tabs never need to know how tall the row above them is.
            */}
            <div className="bg-background sticky top-0 z-10 space-y-3 pt-4 pb-2 md:pt-6">
              <CardNavigation listQuery={listQuery} neighbours={neighbours} />

              <CardTabs
                tabs={tabs}
                activeId={activeSection}
                ariaLabel={t('pages.employeeCard.sectionNav')}
                onSelect={selectSection}
              />
            </div>

            <CardSections card={data} onEdit={setEditing} />
            <DocumentsSection card={data} onEdit={setEditing} />
            <SurveysSection card={data} />

            <section
              id="chronology"
              tabIndex={-1}
              className="border-border bg-card scroll-mt-32 rounded-xl border p-6"
            >
              <ChronologySection userId={employeeId} />
            </section>

            {/*
              Somewhere for the last section to scroll to. Without it the
              container runs out before that section's top reaches the header,
              and its tab appears to do nothing when clicked.
            */}
            <div aria-hidden style={{ height: tailSpace }} />

            {editing === 'personal' && (
              <PersonalDialog
                card={data}
                projectId={projectId}
                open
                onClose={() => setEditing(null)}
              />
            )}
            {editing === 'contacts' && (
              <ContactsDialog
                card={data}
                projectId={projectId}
                open
                onClose={() => setEditing(null)}
              />
            )}
            {editing === 'additional' && (
              <AdditionalDialog
                card={data}
                projectId={projectId}
                open
                onClose={() => setEditing(null)}
              />
            )}
            {editing === 'work' && (
              <WorkDialog card={data} projectId={projectId} open onClose={() => setEditing(null)} />
            )}
            {editing === 'documents' && (
              <DocumentsDialog
                card={data}
                projectId={projectId}
                open
                onClose={() => setEditing(null)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
