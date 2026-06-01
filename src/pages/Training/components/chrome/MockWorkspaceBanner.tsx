import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'

/**
 * Bottom floating workspace bar — Figma Popup-Trainer frame.
 * White card with Coach badge, department context, operator count, menu button.
 */
export function MockWorkspaceBanner() {
  const { t } = useTranslation('common')
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-[10px] border border-[#ECEFF3] bg-white px-3 py-3 shadow-lg">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-[#204E4D]/10 px-3 py-1 text-xs font-medium text-[#204E4D]">
          {t('pages.training.workspaceBanner.coach', 'Coach')}
        </span>
        <Icons.UserCircle02Icon size={18} className="text-[#204E4D]" />
        <span className="text-sm font-medium text-[#204E4D]">
          {t('pages.training.workspaceBanner.label', "Coach's Workspace")}
        </span>
        <span className="text-sm text-[#05040D]">· UA · Consumer Loans</span>
      </div>

      <p className="text-sm font-light text-[#05040D]">
        {t(
          'pages.training.workspaceBanner.assignedTo',
          "You are assigned to the department 'Department A - Hard Collection'"
        )}
      </p>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-2 text-sm text-[#05040D]">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#EBECE8] text-xs font-medium text-[#676767]">
            7
          </span>
          {t('pages.training.workspaceBanner.operatorsInOperation', 'operators in operation')}
        </span>
        <Button
          variant="primary"
          size="sm"
          className="rounded-lg bg-[#204E4D] px-4 text-xs hover:bg-[#1a403f]"
          leftIcon={<Icons.Checkmark size={12} className="text-white" />}
        >
          {t('pages.training.inbox.detail.corrected', 'Corrected')}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="rounded-lg border border-gray-300 bg-white px-4 text-xs text-[#05040D]"
        >
          {t('pages.training.inbox.detail.escalation', 'Escalation')}
        </Button>
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#BBFB5B] text-[#05040D]"
          aria-label={t('pages.training.workspaceBanner.menu', 'Menu')}
        >
          <Icons.Menu11 size={18} />
        </button>
      </div>
    </div>
  )
}

export default MockWorkspaceBanner
