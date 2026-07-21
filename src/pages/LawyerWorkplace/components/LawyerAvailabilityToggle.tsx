import { useTranslation } from 'react-i18next'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import {
  useIsRegisteredLegalLawyer,
  useLegalLawyerMe,
  useUpdateMyLawyerStatus,
} from '@/features/lawyerWorkplace/hooks/useLegalLawyerMe'
import type { LawyerStatus } from '@/pages/LawyerWorkplace/settings/types'

const STATUS_OPTIONS: LawyerStatus[] = ['online', 'away']

export function LawyerAvailabilityToggle() {
  const { t } = useTranslation('common')
  const { isRegisteredLawyer, isLoading: isCheckingRegistration } = useIsRegisteredLegalLawyer()
  const {
    data: lawyer,
    isLoading,
    isError,
  } = useLegalLawyerMe({
    enabled: isRegisteredLawyer,
  })
  const updateStatus = useUpdateMyLawyerStatus()

  if (isCheckingRegistration || !isRegisteredLawyer || isLoading || isError || !lawyer) {
    return null
  }

  const isOnline = lawyer.status === 'online'
  const isSaving = updateStatus.isPending

  const handleStatusChange = (status: LawyerStatus) => {
    if (status === lawyer.status || isSaving) return
    updateStatus.mutate(status)
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={isSaving}
          className={cn(
            'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[11px] leading-none font-medium transition-colors disabled:opacity-60 sm:px-3 sm:text-[12px]',
            isOnline
              ? 'border-success-200 bg-success-50 text-success-700'
              : 'border-warning-200 bg-warning-50 text-warning-700'
          )}
          aria-label={t('pages.lawyerWorkplace.availability.label', 'Your availability')}
        >
          <span
            className={cn('h-2 w-2 rounded-full', isOnline ? 'bg-success-500' : 'bg-warning-500')}
          />
          <span className="hidden sm:inline">
            {t(`pages.lawyerWorkplace.settings.lawyers.status.${lawyer.status}`, lawyer.status)}
          </span>
          <Icons.ArrowDown size={12} strokeWidth={1.5} className="opacity-70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[140px] p-1.5">
        {STATUS_OPTIONS.map((status) => (
          <DropdownMenuItem
            key={status}
            className="flex cursor-pointer items-center gap-2 text-[12px]"
            onClick={() => handleStatusChange(status)}
          >
            {t(`pages.lawyerWorkplace.settings.lawyers.status.${status}`, status)}
            {lawyer.status === status ? (
              <Icons.Tick02 size={14} strokeWidth={2} className="text-primary-600 ml-auto" />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
