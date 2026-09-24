import { useTranslation } from 'react-i18next'
import { Modal, ModalContent, ModalFooter, ModalHeader } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { piiProps } from '@/lib/openreplay/pii'

/**
 * Generic placeholder modal for Quick Actions whose backend lives in a
 * downstream KAN issue. Used for #1 (Assign task → KAN-411) and #3 (Assign
 * course/drill → KAN-416) until those land.
 *
 * Shows the title, a 1-liner about what the action will do, the operator
 * being targeted, and the issue ID gating the rollout. Calmer than a
 * sonner toast — trainers can see what's coming and click out cleanly.
 */
export interface PendingFeatureDialogProps {
  open: boolean
  onClose: () => void
  titleKey: string
  titleFallback: string
  descriptionKey: string
  descriptionFallback: string
  dependsOnIssue: string
  operatorName?: string | undefined
}

export function PendingFeatureDialog({
  open,
  onClose,
  titleKey,
  titleFallback,
  descriptionKey,
  descriptionFallback,
  dependsOnIssue,
  operatorName,
}: PendingFeatureDialogProps) {
  const { t } = useTranslation('common')

  return (
    <Modal open={open} onClose={onClose} maxWidth="sm">
      <ModalHeader title={t(titleKey, titleFallback)} />
      <ModalContent>
        <div className="flex flex-col gap-3">
          <p className="text-foreground text-sm">{t(descriptionKey, descriptionFallback)}</p>

          {operatorName ? (
            <div className="bg-muted flex items-center gap-2 rounded-lg px-3 py-2">
              <Icons.User size={14} className="text-muted-foreground" />
              <span className="text-foreground text-sm font-medium" {...piiProps}>
                {operatorName}
              </span>
            </div>
          ) : null}

          <div className="border-primary-200 bg-primary-100 flex items-start gap-2 rounded-lg border px-3 py-2">
            <Icons.Info size={16} className="text-primary-600 mt-0.5 flex-shrink-0" />
            <p className="text-primary-700 text-xs">
              {t(
                'pages.actionAnalysis.inbox.pendingFeature.dependsOn',
                'This action will be available once {{issue}} ships.',
                { issue: dependsOnIssue }
              )}
            </p>
          </div>
        </div>
      </ModalContent>
      <ModalFooter>
        <Button variant="primary" size="md" onClick={onClose} className="rounded-full">
          {t('actions.close', 'Close')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

export default PendingFeatureDialog
