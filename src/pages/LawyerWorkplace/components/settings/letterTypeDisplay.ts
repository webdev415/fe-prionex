import type { TFunction } from 'i18next'
import type { LetterTypeConfig } from '../../settings/types'

export function getLetterTypeName(
  letterType: Pick<LetterTypeConfig, 'nameKey' | 'nameFallback'>,
  t: TFunction
): string {
  return t(letterType.nameKey, letterType.nameFallback)
}
