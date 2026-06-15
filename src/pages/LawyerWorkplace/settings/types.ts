export type SettingsSubTab = 'letterTypes' | 'lawyers' | 'mailboxes' | 'templates'

export type LawyerPriorityRole = 'primary' | 'backup' | 'secondary' | 'off'

export type LawyerStatus = 'online' | 'away'

export interface LetterTypeColorOption {
  id: string
  dotClass: string
  bgClass: string
  textClass: string
  ringClass: string
}

export interface TrainingExample {
  id: string
  titleKey: string
  titleFallback: string
  bodyKey: string
  bodyFallback: string
  sourceKey: string
  sourceFallback: string
  isPlaceholder?: boolean
}

export interface LetterTypePriorityAssignment {
  lawyerId: string
  stars: number
  role: LawyerPriorityRole
}

export interface LetterTypeConfig {
  id: string
  slug: string
  nameKey: string
  nameFallback: string
  colorId: string
  slaDays: number
  descriptionKey: string
  descriptionFallback: string
  letterCount: number
  examples: TrainingExample[]
  priorities: LetterTypePriorityAssignment[]
  keywordHints: string[]
}

export interface SettingsLawyer {
  id: string
  initials: string
  nameKey: string
  nameFallback: string
  roleKey: string
  roleFallback: string
  letterTypeIds: string[]
  currentActive: number
  maxInFlight: number
  status: LawyerStatus
}
