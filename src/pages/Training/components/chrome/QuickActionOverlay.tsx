import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Icons } from '@/lib/icons'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { useAuthStore } from '@/stores/authStore'
import { PERMISSIONS } from '@/constants/permissions'

/**
 * Quick Action — Figma "Double Button - Fast Action" + Action Overlay menu.
 */
export interface QuickActionOverlayProps {
  onAssignTask?: () => void
  onScheduleOneOnOne?: () => void
  onAssignMaterial?: () => void
  onRateDialogue?: () => void
}

interface ActionRowProps {
  icon: React.ReactNode
  title: string
  subtitle: string
  onClick: () => void
}

function ActionRow({ icon, title, subtitle, onClick }: ActionRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50"
    >
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#204E4D]">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-[#05040D]">{title}</span>
        <span className="block text-xs text-[#7B7B7B]">{subtitle}</span>
      </span>
    </button>
  )
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
  const canScheduleOneOnOne = userPermissions.includes(PERMISSIONS.TRAINING.CREATE_ONE_ON_ONE)
  const canAssignMaterial = userPermissions.includes(PERMISSIONS.TRAINING.VIEW_INBOX)
  const canRateDialogue = userPermissions.includes(PERMISSIONS.TRAINING.CREATE_SCORECARD)
  const canViewTraining = userPermissions.includes(PERMISSIONS.TRAINING.VIEW_INBOX)

  const fallbackToast = () =>
    toast.info(t('pages.training.inbox.quickActions.comingSoon', 'Coming soon'))

  const handleClick = (handler?: () => void) => () => {
    setOpen(false)
    ;(handler ?? fallbackToast)()
  }

  const hasAnyAction =
    canAssignTask || canScheduleOneOnOne || canAssignMaterial || canRateDialogue || canViewTraining

  if (!hasAnyAction) {
    return null
  }

  const showAssignTask = canAssignTask || canViewTraining
  const showSchedule = canScheduleOneOnOne || canViewTraining
  const showMaterial = canAssignMaterial
  const showRate = canRateDialogue || canViewTraining

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="mb-1 flex h-[42px] items-center gap-3 rounded-full border border-white bg-[#204E4D] py-1 pr-5 pl-1 text-white shadow-sm transition-colors hover:bg-[#1a403f]"
        >
          <span className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-full bg-[#BBFB5B]">
            <Icons.Add size={18} className="text-[#05040D]" />
          </span>
          <span className="text-xs font-medium tracking-tight">
            {t('pages.training.inbox.quickActions.button', 'Quick Action')}
          </span>
          <Icons.ArrowDown02
            size={16}
            className={`text-white transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[min(100vw-2rem,320px)] overflow-hidden rounded-2xl border border-[#EBECE8] p-0 shadow-lg"
      >
        {showAssignTask ? (
          <ActionRow
            icon={<Icons.CheckmarkSquare03 size={16} className="text-[#BBFB5B]" />}
            title={t('pages.training.inbox.quickActions.assignTask', 'Assign task')}
            subtitle={t(
              'pages.training.inbox.quickActions.assignTaskHint',
              'Operator · topic · deadline'
            )}
            onClick={handleClick(canAssignTask ? onAssignTask : undefined)}
          />
        ) : null}
        {showAssignTask && (showSchedule || showMaterial || showRate) ? (
          <div className="mx-4 border-t border-[#EBECE8]" />
        ) : null}
        {showSchedule ? (
          <ActionRow
            icon={<Icons.Calendar size={16} className="text-[#BBFB5B]" />}
            title={t('pages.training.inbox.quickActions.scheduleOneOnOne', 'Schedule 1-on-1')}
            subtitle={t(
              'pages.training.inbox.quickActions.scheduleOneOnOneHint',
              'Operator · date · time'
            )}
            onClick={handleClick(canScheduleOneOnOne ? onScheduleOneOnOne : undefined)}
          />
        ) : null}
        {showSchedule && (showMaterial || showRate) ? (
          <div className="mx-4 border-t border-[#EBECE8]" />
        ) : null}
        {showMaterial ? (
          <ActionRow
            icon={<Icons.Activity01 size={16} className="text-[#BBFB5B]" />}
            title={t('pages.training.inbox.quickActions.assignCourse', 'Assign course / drill')}
            subtitle={t(
              'pages.training.inbox.quickActions.assignCourseHint',
              'Operator · material'
            )}
            onClick={handleClick(onAssignMaterial)}
          />
        ) : null}
        {showMaterial && showRate ? <div className="mx-4 border-t border-[#EBECE8]" /> : null}
        {showRate ? (
          <ActionRow
            icon={<Icons.SecurityValidation size={16} className="text-[#BBFB5B]" />}
            title={t('pages.training.inbox.quickActions.rateDialogue', 'Rate dialogue')}
            subtitle={t('pages.training.inbox.quickActions.rateDialogueHint', 'Open scorecard')}
            onClick={handleClick(canRateDialogue ? onRateDialogue : undefined)}
          />
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default QuickActionOverlay
