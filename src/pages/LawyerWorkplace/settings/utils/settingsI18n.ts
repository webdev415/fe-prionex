import type { TFunction } from 'i18next'

const SOURCE_PREFIX_PATTERN = /^(from|від|от)\s+/i

export function stripSourcePrefix(value: string): string {
  return value.replace(SOURCE_PREFIX_PATTERN, '').trim()
}

export function formatSourceWithPrefix(name: string, prefix: string): string {
  const trimmed = stripSourcePrefix(name)
  if (!trimmed) return prefix
  return `${prefix} ${trimmed}`
}

export function getSourcePrefix(t: TFunction): string {
  return t('pages.lawyerWorkplace.settings.letterTypes.exampleSourcePrefix', 'from')
}

export function getKeywordHintLabel(keyword: string, _t: TFunction): string {
  return keyword
}
