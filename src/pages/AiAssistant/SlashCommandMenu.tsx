/**
 * Меню слеш-команд над композером ассистента (см. slashCommands.ts).
 * Презентационный компонент: список, активная строка, клик = выбор.
 * Клавиатуру (стрелки/Enter/Tab/Esc) обрабатывает страница — у неё уже есть
 * onKeyDown на textarea, второй обработчик устроил бы гонку за Enter.
 */
import { useTranslation } from 'react-i18next'
import type { SlashCommand } from './slashCommands'

interface SlashCommandMenuProps {
  items: readonly SlashCommand[]
  activeIndex: number
  onSelect: (command: SlashCommand) => void
}

export function SlashCommandMenu({ items, activeIndex, onSelect }: SlashCommandMenuProps) {
  const { t } = useTranslation()
  if (items.length === 0) return null

  return (
    <div
      role="listbox"
      aria-label={t('pages.aiAssistant.slashMenuAria')}
      data-testid="slash-command-menu"
      className="border-border bg-popover absolute bottom-full left-0 z-30 mb-1 w-full max-w-sm overflow-hidden rounded-lg border shadow-lg"
    >
      {items.map((item, index) => (
        <button
          key={item.command}
          type="button"
          role="option"
          aria-selected={index === activeIndex}
          className={`flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-sm ${
            index === activeIndex ? 'bg-accent' : 'hover:bg-accent/50'
          }`}
          // onMouseDown вместо onClick: click приходит после blur textarea,
          // меню к этому моменту уже закрыто и клик пролетает мимо.
          onMouseDown={(event) => {
            event.preventDefault()
            onSelect(item)
          }}
        >
          <span className="text-foreground font-medium">{item.command}</span>
          <span className="text-muted-foreground truncate text-xs">{t(item.descriptionKey)}</span>
        </button>
      ))}
    </div>
  )
}
