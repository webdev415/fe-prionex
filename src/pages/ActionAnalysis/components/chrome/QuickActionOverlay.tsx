import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { useAuthStore } from '@/stores/authStore'
import { PERMISSIONS } from '@/constants/permissions'

/**
 * Quick Action overlay — top-right floating menu invoked from the Trainer
 * Workplace header strip.
 *
 * Four actions per [Figma/Action Overlay.png]:
 *   1. Assign task          — stubbed; lands in KAN-411 (step 9 of KAN-413)
 *   2. Schedule 1-on-1      — stubbed; real flow in step 6
 *   3. Assign course/drill  — stubbed; lands in KAN-416 (step 9 of KAN-413)
 *   4. Rate dialogue        — stubbed; real flow in step 5
 *
 * Each button is gated on its respective permission; absent perms hide the
 * row. Clicking a stubbed action toasts a "coming soon" message and (where
 * applicable in later steps) calls the appropriate handler prop.
 */
export interface QuickActionOverlayProps {
  onAssignTask?: () => void
  onScheduleOneOnOne?: () => void
  onAssignMaterial?: () => void
  onRateDialogue?: () => void
}

export function QuickActionOverlay({
  onAssignTask,
  onScheduleOneOnOne,
  onAssignMaterial,
  onRateDialogue,
}: QuickActionOverlayProps) {
  const { t } = useTranslation('common')
  const [open, setOpen] = useState(false)
  const userPermissions = useAuthStore((s) => s.user?.permissions ?? [])

  const canAssignTask = userPermissions.includes(PERMISSIONS.CLIENTS.CREATE_TASKS)
  const canScheduleOneOnOne = userPermissions.includes(
    PERMISSIONS.ACTION_ANALYSIS.CREATE_ONE_ON_ONE
  )
  // Course/drill assignment lands in KAN-416 — no permission constant yet.
  const canAssignMaterial = userPermissions.includes(PERMISSIONS.ACTION_ANALYSIS.VIEW_INBOX)
  const canRateDialogue = userPermissions.includes(PERMISSIONS.ACTION_ANALYSIS.CREATE_SCORECARD)

  const fallbackToast = () =>
    toast.info(t('pages.actionAnalysis.inbox.quickActions.comingSoon', 'Coming soon'))

  const handleClick = (handler?: () => void) => () => {
    setOpen(false)
    ;(handler ?? fallbackToast)()
  }

  if (!canAssignTask && !canScheduleOneOnOne && !canAssignMaterial && !canRateDialogue) {
    return null
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="primary"
          size="md"
          leftIcon={<Icons.Add size={16} className="text-primary-foreground" />}
          className="h-[45px] rounded-full px-5 text-xs"
        >
          {t('pages.actionAnalysis.inbox.quickActions.button', 'Quick Action')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {canAssignTask ? (
          <DropdownMenuItem onClick={handleClick(onAssignTask)} className="gap-3 py-2.5">
            <Icons.Brochure size={20} className="text-primary-600" />
            <div className="flex flex-col">
              <span className="text-sm font-medium">
                {t('pages.actionAnalysis.inbox.quickActions.assignTask', 'Assign task')}
              </span>
              <span className="text-muted-foreground text-xs">
                {t(
                  'pages.actionAnalysis.inbox.quickActions.assignTaskHint',
                  'Operator · topic · deadline'
                )}
              </span>
            </div>
          </DropdownMenuItem>
        ) : null}

        {canScheduleOneOnOne ? (
          <DropdownMenuItem onClick={handleClick(onScheduleOneOnOne)} className="gap-3 py-2.5">
            <Icons.Calendar size={20} className="text-primary-600" />
            <div className="flex flex-col">
              <span className="text-sm font-medium">
                {t('pages.actionAnalysis.inbox.quickActions.scheduleOneOnOne', 'Schedule 1-on-1')}
              </span>
              <span className="text-muted-foreground text-xs">
                {t(
                  'pages.actionAnalysis.inbox.quickActions.scheduleOneOnOneHint',
                  'Operator · date · time'
                )}
              </span>
            </div>
          </DropdownMenuItem>
        ) : null}

        {canAssignMaterial ? (
          <DropdownMenuItem onClick={handleClick(onAssignMaterial)} className="gap-3 py-2.5">
            <Icons.Activity01 size={20} className="text-primary-600" />
            <div className="flex flex-col">
              <span className="text-sm font-medium">
                {t('pages.actionAnalysis.inbox.quickActions.assignCourse', 'Assign course / drill')}
              </span>
              <span className="text-muted-foreground text-xs">
                {t(
                  'pages.actionAnalysis.inbox.quickActions.assignCourseHint',
                  'Operator · material'
                )}
              </span>
            </div>
          </DropdownMenuItem>
        ) : null}

        {canRateDialogue ? (
          <DropdownMenuItem onClick={handleClick(onRateDialogue)} className="gap-3 py-2.5">
            <Icons.SecurityValidation size={20} className="text-primary-600" />
            <div className="flex flex-col">
              <span className="text-sm font-medium">
                {t('pages.actionAnalysis.inbox.quickActions.rateDialogue', 'Rate dialogue')}
              </span>
              <span className="text-muted-foreground text-xs">
                {t('pages.actionAnalysis.inbox.quickActions.rateDialogueHint', 'Open scorecard')}
              </span>
            </div>
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default QuickActionOverlay
