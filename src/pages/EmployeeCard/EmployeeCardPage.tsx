import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useSearchParams } from 'react-router-dom'
import { ChronologySection } from '@/features/employeeCard'
import { useCardNeighbours, useEmployeeCard } from '@/features/employeeCard/hooks/useEmployeeCard'
import { BackToList, CardNavigation } from './components/CardNavigation'
import { CardSections } from './components/CardSections'
import { CardTabs } from './components/CardTabs'
import { EmployeeCardSkeleton } from './components/EmployeeCardSkeleton'
import { DocumentsSection } from './components/DocumentsSection'
import { ProfilePanel } from './components/ProfilePanel'
import { SurveysSection } from './components/SurveysSection'
import { SurveysDialog } from './components/dialogs/SurveysDialog'
import { AdditionalDialog } from './components/dialogs/AdditionalDialog'
import { ContactsDialog } from './components/dialogs/ContactsDialog'
import { DocumentsDialog } from './components/dialogs/DocumentsDialog'
import { PersonalDialog } from './components/dialogs/PersonalDialog'
import { WorkDialog } from './components/dialogs/WorkDialog'
import { useConfirm } from '@/components/ui/useConfirm'
import { useRemoveSurvey } from '@/features/employeeCard/hooks/useEmployeeCard'
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
  /*
   * Which survey the one dialog is opened on: null means a new one. Kept
   * beside `editing` rather than folded into it, because "the surveys dialog
   * is open" and "it is open on survey 11" are two different facts.
   */
  const [survey, setSurvey] = useState<number | null>(null)
  const removeOne = useRemoveSurvey(employeeId, projectId)
  const { confirm, confirmDialog } = useConfirm()

  /*
   * Asked before removing, not after. A survey carries a score somebody
   * recorded from a form that has long since closed, and its chronology line
   * goes with it - neither is anywhere else to be recovered from.
   */
  const confirmRemoval = async (surveyId: number) => {
    const survey = data?.surveys.find((one) => one.id === surveyId)
    const agreed = await confirm({
      title: t('pages.employeeCard.surveys.removeTitle'),
      message: t('pages.employeeCard.surveys.removeMessage', { name: survey?.name ?? '' }),
      confirmLabel: t('actions.delete'),
      tone: 'danger',
    })
    if (agreed) removeOne.mutate(surveyId)
  }

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
    <div className="h-[calc(100vh-104px)] overflow-y-auto px-4 pb-4 [scrollbar-width:none] supports-[height:100dvh]:h-[calc(100dvh-104px)] md:px-6 md:pb-6 [&::-webkit-scrollbar]:hidden">
      {confirmDialog}

      {isLoading && <EmployeeCardSkeleton label={t('common.loading')} />}

      {isError && (
        <p role="alert" className="text-destructive">
          {t('pages.employeeCard.failed')}
        </p>
      )}

      {data && (
        <div className="grid items-start gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="space-y-4 pt-4 md:pt-6 lg:sticky lg:top-0">
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
            {/*
              The page's own background, not an approximation of it: the same
              two classes the layout root carries, so the colour comes from
              ``--background`` and the image from ``--dashboard-bg-image`` -
              ``neutral-dim`` and the light theme both define one, which is why
              a flat fill of the right colour still read as a strip laid over
              the card.

              ``fixed`` attachment is what lines the two up. It measures the
              background against the viewport rather than against this bar, and
              the root - which does not scroll, the card's own container does -
              measures against a box the size of the viewport too. So the strip
              paints exactly the part of the page it covers.
            */}
            <div className="bg-background bg-dashboard-light sticky top-0 z-10 space-y-3 bg-cover [background-attachment:fixed] bg-center pt-4 pb-2 md:pt-6">
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
            <SurveysSection
              card={data}
              onAdd={() => {
                setSurvey(null)
                setEditing('surveys')
              }}
              onEditSurvey={(surveyId) => {
                setSurvey(surveyId)
                setEditing('surveys')
              }}
              onRemoveSurvey={(surveyId) => void confirmRemoval(surveyId)}
            />

            <section
              id="chronology"
              tabIndex={-1}
              className="border-border bg-card scroll-mt-32 rounded-xl border p-4 sm:p-6"
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
            {editing === 'surveys' && (
              <SurveysDialog
                card={data}
                projectId={projectId}
                surveyId={survey}
                open
                onClose={() => setEditing(null)}
              />
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
