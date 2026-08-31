import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useThemeStore } from '@/stores/themeStore'
import { THEME_ACCENTS, THEME_BASES, type ThemeAccent, type ThemeBase } from '@/theme/constants'

const ACCENT_SWATCH: Record<ThemeAccent, string> = {
  teal: '#204E4D',
  cyan: '#00B8DB',
  blue: '#2B7FFF',
  indigo: '#615FFF',
  violet: '#8E51FF',
  purple: '#AD46FF',
  fuchsia: '#E12AFB',
  pink: '#F6339A',
  rose: '#FF2056',
  orange: '#FF6900',
  amber: '#FD9A00',
}

const BASE_PREVIEW_SRC: Record<ThemeBase, string> = {
  'light-classic': '/assets/themes/light-classic.png',
  'neutral-dim': '/assets/themes/neutral-dim.png',
  'ultra-dark': '/assets/themes/ultra-dark.png',
  'high-contrast-light': '/assets/themes/high-contrast-light.png',
}

function ThemePreviewCard({
  base,
  selected,
  label,
  onSelect,
}: {
  base: ThemeBase
  selected: boolean
  label: string
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'group flex w-full min-w-0 flex-col gap-2 text-left',
        'focus-visible:ring-primary-500 focus-visible:rounded-xl focus-visible:ring-2 focus-visible:outline-none'
      )}
    >
      <div className="bg-card relative overflow-hidden rounded-xl">
        <img
          src={BASE_PREVIEW_SRC[base]}
          alt=""
          draggable={false}
          className="aspect-[16/10] h-auto w-full object-cover object-top"
        />
        <div
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-0 rounded-xl border-2 transition-opacity [will-change:opacity]',
            selected
              ? 'border-primary-300 opacity-100'
              : 'border-border opacity-0 group-hover:opacity-100'
          )}
        />
      </div>
      <span className="text-foreground text-center text-xs leading-[150%] font-medium tracking-[-0.2px] sm:text-sm">
        {label}
      </span>
    </button>
  )
}

export function AppearanceSettings() {
  const { t } = useTranslation('common')
  const base = useThemeStore((s) => s.base)
  const accent = useThemeStore((s) => s.accent)
  const setBase = useThemeStore((s) => s.setBase)
  const setAccent = useThemeStore((s) => s.setAccent)

  return (
    <section
      className="flex w-full flex-col items-start gap-5 self-stretch"
      aria-labelledby="appearance-settings-heading"
    >
      <div className="flex max-w-3xl flex-col gap-1.5 self-stretch">
        <h2
          id="appearance-settings-heading"
          className="text-foreground text-base leading-[150%] font-medium tracking-[-0.36px] sm:text-[18px]"
        >
          {t('pages.profile.appearance.title')}
        </h2>
        <p className="text-muted-foreground text-sm leading-[155%] font-light tracking-[-0.28px]">
          {t('pages.profile.appearance.description')}
        </p>
      </div>

      <div
        className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4"
        role="listbox"
        aria-label={t('pages.profile.appearance.baseThemesLabel')}
      >
        {THEME_BASES.map((themeBase) => (
          <ThemePreviewCard
            key={themeBase}
            base={themeBase}
            selected={base === themeBase}
            label={t(`pages.profile.appearance.bases.${themeBase}`)}
            onSelect={() => setBase(themeBase)}
          />
        ))}
      </div>

      <div
        className="flex w-full flex-wrap items-center justify-center gap-2.5 self-stretch sm:gap-3"
        role="listbox"
        aria-label={t('pages.profile.appearance.accentColorsLabel')}
      >
        {THEME_ACCENTS.map((themeAccent) => {
          const selected = accent === themeAccent
          const color = ACCENT_SWATCH[themeAccent]
          return (
            <button
              key={themeAccent}
              type="button"
              onClick={() => setAccent(themeAccent)}
              aria-pressed={selected}
              aria-label={t(`pages.profile.appearance.accents.${themeAccent}`)}
              title={t(`pages.profile.appearance.accents.${themeAccent}`)}
              className={cn(
                'h-6 w-6 shrink-0 rounded-full sm:h-7 sm:w-7',
                'focus-visible:ring-primary-500 focus-visible:ring-offset-card focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
                selected ? '' : 'hover:scale-105'
              )}
              style={{
                backgroundColor: color,
                boxShadow: selected ? `0 0 0 2px var(--card, #fff), 0 0 0 4px ${color}` : undefined,
              }}
            />
          )
        })}
      </div>
    </section>
  )
}

export default AppearanceSettings
