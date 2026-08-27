import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { downloadDocument } from '@/features/employeeCard/api/employeeCardApi'
import type { EmployeeCard } from '@/features/employeeCard/types.card'
import { CardSection } from './CardSection'

export interface DocumentsSectionProps {
  card: EmployeeCard
  onEdit?: (section: string) => void
}

function readableSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * The documents attached to somebody, and their interview comment.
 *
 * Downloading goes through the API client rather than a plain link: the route
 * needs the bearer token, and a link would send an unauthenticated request and
 * get a 401 where the reader expects a file. The object URL is released as
 * soon as the save has started, so a long session does not accumulate them.
 */
export function DocumentsSection({ card, onEdit }: DocumentsSectionProps) {
  const { t, i18n } = useTranslation()
  const [busyId, setBusyId] = useState<number | null>(null)

  const save = async (documentId: number, filename: string) => {
    setBusyId(documentId)
    try {
      const blob = await downloadDocument(card.header.id, documentId)
      const href = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = href
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(href)
    } catch {
      toast.error(t('pages.employeeCard.documents.downloadFailed'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <CardSection
      id="documents-and-hiring"
      title={t('pages.employeeCard.sections.documents-and-hiring')}
      {...(card.can_edit && onEdit
        ? { editLabel: t('pages.employeeCard.edit'), onEdit: () => onEdit('documents') }
        : {})}
    >
      <div className="space-y-6">
        {card.documents.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t('pages.employeeCard.documents.none')}</p>
        ) : (
          <ul className="space-y-2">
            {card.documents.map((document) => (
              <li
                key={document.id}
                className="border-border flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-foreground truncate text-sm font-medium">
                    {document.original_filename}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {t('pages.employeeCard.documents.uploaded', {
                      date: new Date(document.uploaded_at).toLocaleDateString(i18n.language),
                      size: readableSize(document.size_bytes),
                    })}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={busyId === document.id}
                  onClick={() => void save(document.id, document.original_filename)}
                >
                  {t('pages.employeeCard.documents.download')}
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-2">
          <h3 className="text-foreground text-sm font-medium">
            {t('pages.employeeCard.documents.interviewComment')}
          </h3>
          <p className="text-muted-foreground text-sm whitespace-pre-line">
            {card.interview_comment || t('pages.employeeCard.notFilledIn')}
          </p>
        </div>
      </div>
    </CardSection>
  )
}
