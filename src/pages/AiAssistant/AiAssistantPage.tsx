import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { Textarea } from '@/components/ui/Textarea'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'

const QUICK_ACTION_KEYS = ['quickClientData', 'quickDebt', 'quickReport', 'quickEmployee'] as const

type AssistDropdownProps = {
  ariaLabel: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
  triggerClassName?: string
}

function AssistFilterDropdown({
  ariaLabel,
  value,
  options,
  onChange,
  triggerClassName,
}: AssistDropdownProps) {
  const label = useMemo(
    () => options.find((o) => o.value === value)?.label ?? options[0]?.label ?? '',
    [options, value]
  )

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          className={cn(
            'text-dark-500 inline-flex h-6 cursor-pointer items-center justify-center gap-1.5 border-l-1 border-l-gray-200 bg-white px-3 text-xs font-light shadow-none sm:w-32 sm:max-w-none',
            triggerClassName
          )}
        >
          <span className="min-w-0 flex-1 truncate text-left">{label}</span>
          <Icons.ArrowDown size={14} strokeWidth={1.5} className="shrink-0 text-gray-500" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-white">
        {options.map((o) => (
          <DropdownMenuItem
            key={o.value}
            className="text-dark-500 text-sm font-light"
            onSelect={() => onChange(o.value)}
          >
            {o.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function AiAssistantPage() {
  const { t } = useTranslation('common')
  const [message, setMessage] = useState('')
  const [clientScope, setClientScope] = useState('all')
  const [period, setPeriod] = useState('all')

  const clientOptions = useMemo(
    () => [
      { value: 'all', label: t('pages.aiAssistant.allClients') },
      { value: 'recent', label: t('pages.aiAssistant.recentClients') },
    ],
    [t]
  )

  const periodOptions = useMemo(
    () => [
      { value: 'all', label: t('pages.aiAssistant.periodAll') },
      { value: 'month', label: t('pages.aiAssistant.periodMonth') },
      { value: 'quarter', label: t('pages.aiAssistant.periodQuarter') },
      { value: 'year', label: t('pages.aiAssistant.periodYear') },
    ],
    [t]
  )

  return (
    <div
      className={cn(
        'flex min-h-[calc(100vh-5.5rem)] w-full flex-1 flex-col self-stretch supports-[height:100dvh]:min-h-[calc(100dvh-5.5rem)]'
      )}
    >
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 pt-6 sm:px-12 lg:px-20">
        <div className="flex flex-col items-center justify-center gap-10">
          <img src="/logo.svg" alt={t('app.name')} className="h-12 w-auto" />
          <span className="text-dark-500 text-center text-[30px] leading-[129%] font-light tracking-[-0.6px]">
            {t('pages.aiAssistant.greeting')}
          </span>
        </div>
      </div>

      <div className="mt-auto flex w-full shrink-0 flex-col items-center px-4 pt-4 pb-6 sm:px-12 sm:pb-8 lg:px-20">
        <div className="w-full max-w-5xl">
          <div className="border-light-200 shadow-dark-500/5 rounded-3xl border border-white/60 bg-white/95 p-4 shadow-lg sm:p-5">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t('pages.aiAssistant.inputPlaceholder')}
              className={cn(
                'min-h-[120px] resize-none border-0 bg-transparent px-1 py-2 text-base shadow-none',
                'placeholder:text-gray-400 focus-visible:ring-0 focus-visible:ring-offset-0'
              )}
              aria-label={t('pages.aiAssistant.inputPlaceholder')}
            />

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                className="text-dark-500 hover:text-primary-600 flex cursor-pointer items-center gap-2 text-sm font-light transition-colors"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-500">
                  <Icons.Add size={16} strokeWidth={1.5} />
                </span>
                {t('pages.aiAssistant.settings')}
              </button>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <AssistFilterDropdown
                  ariaLabel={t('pages.aiAssistant.client')}
                  value={clientScope}
                  onChange={setClientScope}
                  options={clientOptions}
                />
                <AssistFilterDropdown
                  ariaLabel={t('pages.aiAssistant.period')}
                  value={period}
                  onChange={setPeriod}
                  options={periodOptions}
                />

                <button
                  type="button"
                  aria-label={t('pages.aiAssistant.voiceInput')}
                  className="bg-primary-300 hover:bg-primary-500 flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-white shadow-md transition-colors"
                >
                  <Icons.Mic02 size={20} strokeWidth={1} className="text-dark-500" />
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-4">
            {QUICK_ACTION_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                className={cn(
                  'text-secondary-800 cursor-pointer rounded-full border border-white bg-white/70 px-5 py-3 text-center text-base leading-[155%] font-light tracking-[-0.32px]',
                  'hover:border-primary-300 hover:bg-primary-50/40 transition-colors'
                )}
                onClick={() =>
                  setMessage((prev) =>
                    prev
                      ? `${prev}\n${t(`pages.aiAssistant.${key}`)}`
                      : t(`pages.aiAssistant.${key}`)
                  )
                }
              >
                {t(`pages.aiAssistant.${key}`)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
