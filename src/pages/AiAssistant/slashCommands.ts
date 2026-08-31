/**
 * Слеш-команды композера ассистента — как в Claude Code: «/» в начале пустого
 * поля открывает меню, стрелки выбирают, Enter/Tab подставляет.
 *
 * Сами команды исполняет МОЗГ (assistant/application/chat_service.py — блок
 * «Слэш-команды — без модели»): они уходят обычным сообщением, мозг отвечает
 * текстом без запуска модели. Меню — только подсказка и автодополнение; список
 * здесь обязан совпадать с мозговым. `newChat` — единственная клиентская
 * команда: чистит диалог CRM локально (кнопка «Новий чат»), а не мозговую
 * сессию.
 */

export interface SlashCommand {
  /** Каноническая форма, которая подставляется в поле. */
  command: string
  /** Синонимы, по которым команда находится при наборе. */
  aliases: readonly string[]
  /** Ключ i18n с описанием для строки меню. */
  descriptionKey: string
  /** Клиентская команда: перехватывается страницей, в мозг не уходит. */
  clientAction?: 'newChat'
}

export const SLASH_COMMANDS: readonly SlashCommand[] = [
  {
    command: '/статус',
    aliases: ['/status'],
    descriptionKey: 'pages.aiAssistant.slashStatus',
  },
  {
    command: '/сброс',
    aliases: ['/reset'],
    descriptionKey: 'pages.aiAssistant.slashReset',
  },
  {
    command: '/помощь',
    aliases: ['/help'],
    descriptionKey: 'pages.aiAssistant.slashHelp',
  },
  {
    command: '/новий',
    aliases: ['/new'],
    descriptionKey: 'pages.aiAssistant.slashNewChat',
    clientAction: 'newChat',
  },
] as const

/**
 * Открывать ли меню и какие команды показать. Меню живёт только пока ввод —
 * НАЧАТАЯ команда: первый символ «/», без пробелов (появился пробел — человек
 * пишет обычный текст со слешем, напр. «/ довідка по 24/7» — не мешаем).
 */
export function matchSlashCommands(input: string): SlashCommand[] {
  if (!input.startsWith('/') || /\s/.test(input)) return []
  const needle = input.toLowerCase()
  return SLASH_COMMANDS.filter((c) =>
    [c.command, ...c.aliases].some((form) => form.startsWith(needle))
  )
}

/** Ввод — уже полная команда (каноническая или синоним), без хвоста. */
export function exactSlashCommand(input: string): SlashCommand | null {
  const needle = input.trim().toLowerCase()
  if (!needle.startsWith('/')) return null
  return SLASH_COMMANDS.find((c) => c.command === needle || c.aliases.includes(needle)) ?? null
}
