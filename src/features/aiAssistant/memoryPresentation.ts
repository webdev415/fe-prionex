/**
 * Общее представление записей памяти ассистента.
 *
 * Один и тот же факт показывают два экрана — панель «Персоналізація» самого
 * сотрудника и админский раздел «Память» в настройках AI. Подпись
 * происхождения, цвет бейджа и формат даты должны совпадать: разъехавшись,
 * они превращаются в два разных ответа на вопрос «откуда это в памяти».
 */

/** Сколько символов текста уходит в заголовок записи (аналог make_title диалогов). */
export const MEMORY_TITLE_LENGTH = 60

/** Верхняя граница текста факта — как у названия диалога: не роман. */
export const MEMORY_CONTENT_MAX_LENGTH = 500

/**
 * Заголовок факта из его текста: первые ~60 символов по границе слова.
 *
 * Сервер хранит `title` отдельно от `content`, но спрашивать у оператора два
 * поля ради подзаголовка — лишний шаг: короткая запись целиком становится
 * заголовком, длинная обрезается.
 */
export function makeMemoryTitle(content: string): string {
  const text = content.trim().replace(/\s+/g, ' ')
  if (text.length <= MEMORY_TITLE_LENGTH) return text
  const cut = text.slice(0, MEMORY_TITLE_LENGTH)
  const lastSpace = cut.lastIndexOf(' ')
  // По пробелу режем, только если от строки остаётся что-то осмысленное —
  // иначе (одно длинное слово) обрезаем жёстко по лимиту.
  const head = lastSpace > MEMORY_TITLE_LENGTH / 3 ? cut.slice(0, lastSpace) : cut
  return `${head.trimEnd()}…`
}

export type MemorySourceKey = 'user' | 'agent' | 'observation' | 'unknown'

/**
 * Ключ подписи происхождения. Неизвестный `source` даёт нейтральное «інше»:
 * мозг заводит новые виды раньше фронта, и бейдж не должен превращаться в
 * сырой слаг или пустоту.
 */
export function memorySourceKey(source: string): MemorySourceKey {
  if (source === 'user') return 'user'
  if (source === 'agent') return 'agent'
  if (source === 'seed' || source === 'profile') return 'observation'
  return 'unknown'
}

export const MEMORY_SOURCE_BADGE_CLASS: Record<MemorySourceKey, string> = {
  user: 'bg-primary-50 text-primary-700',
  agent: 'bg-success-100 text-success-700',
  observation: 'bg-muted text-muted-foreground',
  unknown: 'bg-muted text-muted-foreground',
}

/** Дата записи в коротком локальном формате; мусор в поле даёт пустую строку. */
export function formatMemoryDate(value: string | null | undefined, language: string): string {
  if (!value) return ''
  const ts = new Date(value).getTime()
  if (!Number.isFinite(ts)) return ''
  return new Date(ts).toLocaleDateString(language || 'en', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  })
}
