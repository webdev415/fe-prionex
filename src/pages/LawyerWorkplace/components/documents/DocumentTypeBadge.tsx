import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import type { LegalDocumentType } from '../../documents/types'
import {
  DOCUMENT_TYPE_BADGE_COLOURS,
  DOCUMENT_TYPE_I18N_KEYS,
  DOCUMENT_TYPE_LABELS,
} from './constants'

interface DocumentTypeBadgeProps {
  type: LegalDocumentType
}

export function DocumentTypeBadge({ type }: DocumentTypeBadgeProps) {
  const { t } = useTranslation('common')

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium',
        DOCUMENT_TYPE_BADGE_COLOURS[type]
      )}
    >
      {t(DOCUMENT_TYPE_I18N_KEYS[type], DOCUMENT_TYPE_LABELS[type])}
    </span>
  )
}
