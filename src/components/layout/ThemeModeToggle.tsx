import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Icons } from '@/lib/icons'
import { useThemeStore } from '@/stores/themeStore'
import { isDarkBase } from '@/theme/constants'

export function ThemeModeToggle({ className }: { className?: string }) {
  const { t } = useTranslation('common')
  const base = useThemeStore((s) => s.base)
  const toggleLightDark = useThemeStore((s) => s.toggleLightDark)
  const isDark = isDarkBase(base)

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={t(isDark ? 'theme.switchToLight' : 'theme.switchToDark')}
      title={t(isDark ? 'theme.switchToLight' : 'theme.switchToDark')}
      onClick={toggleLightDark}
      className={cn(
        'bg-secondary-800 focus-visible:ring-primary-500 focus-visible:ring-offset-background inline-flex h-9 shrink-0 items-center rounded-full p-1 transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        className
      )}
    >
      <span
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded-full transition-colors',
          isDark ? 'bg-card text-foreground' : 'text-white/70'
        )}
        aria-hidden
      >
        <Icons.Moon size={16} strokeWidth={1.5} />
      </span>
      <span
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded-full transition-colors',
          !isDark ? 'bg-card text-foreground' : 'text-white/70'
        )}
        aria-hidden
      >
        <Icons.Sun size={16} strokeWidth={1.5} />
      </span>
    </button>
  )
}

export default ThemeModeToggle
