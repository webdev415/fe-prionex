import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'

/**
 * Bottom-pinned "Coach's Workspace" banner. Mirrors the Figma frame —
 * dark-green bar showing the trainer's workspace context (project ·
 * vertical · assigned department) with two status pills on the right.
 *
 * Mock variant: project/department names are hardcoded so the banner
 * renders without auth context. Real WorkspaceBanner lives at
 * `chrome/WorkspaceBanner.tsx`.
 */
export function MockWorkspaceBanner() {
  const { t } = useTranslation('common')
  return (
    <div className="bg-primary-700 -mx-4 flex flex-wrap items-center justify-between gap-2 rounded-t-2xl px-4 py-2.5 text-white shadow-lg sm:-mx-6 sm:px-6">
      <div className="flex items-center gap-2 text-[11px]">
        <Icons.UserCircle02Icon size={14} className="text-white/80" />
        <span className="font-semibold">
          {t('pages.training.workspaceBanner.label', "Coach's Workspace")}
        </span>
        <span className="text-white/70">·</span>
        <span className="text-white/80">UA</span>
        <span className="text-white/70">·</span>
        <span className="text-white/80">Consumer Loans</span>
        <span className="text-white/70">·</span>
        <span className="text-white/80">
          {t(
            'pages.training.workspaceBanner.assignedTo',
            'you are assigned to the department Department A · Hard Collection'
          )}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/30 px-2.5 py-1 text-[10px] font-medium text-white">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-300" />
          {t('pages.training.workspaceBanner.inOperation', 'Operator in operation')}
        </span>
        <span className="flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-medium text-white">
          <Icons.Brochure size={11} className="text-white/90" />
          {t('pages.training.workspaceBanner.role', 'Escalation')}
        </span>
      </div>
    </div>
  )
}

export default MockWorkspaceBanner
