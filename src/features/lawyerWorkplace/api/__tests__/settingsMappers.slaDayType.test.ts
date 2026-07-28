import { describe, it, expect } from 'vitest'
import type { LetterTypeConfig } from '@/pages/LawyerWorkplace/settings/types'
import { mapLegalLetterTypeToConfig, mapLetterTypeConfigToUpdate } from '../settingsMappers'
import type { LegalLetterType } from '../types'

const API_TYPE: LegalLetterType = {
  id: 'complaint',
  slug: 'complaint',
  name: 'Complaint',
  color_id: 'teal',
  sla_days: 7,
  description: null,
  keyword_hints: [],
  is_active: true,
  letter_count: 0,
  examples: [],
  priorities: [],
}

const CONFIG: LetterTypeConfig = {
  id: 'complaint',
  slug: 'complaint',
  nameKey: 'api:name:complaint',
  nameFallback: 'Complaint',
  colorId: 'teal',
  slaDays: 5,
  slaDayType: 'working',
  descriptionKey: 'api:desc:complaint',
  descriptionFallback: '',
  letterCount: 0,
  examples: [],
  priorities: [],
  keywordHints: [],
  isActive: true,
}

describe('letter-type SLA day-type mapping', () => {
  it('defaults slaDayType to "calendar" when the API omits sla_day_type', () => {
    expect(mapLegalLetterTypeToConfig(API_TYPE).slaDayType).toBe('calendar')
  })

  it('reads slaDayType "working" from the API', () => {
    const config = mapLegalLetterTypeToConfig({ ...API_TYPE, sla_day_type: 'working' })
    expect(config.slaDayType).toBe('working')
  })

  it('sends sla_day_type alongside sla_days in the update payload', () => {
    const payload = mapLetterTypeConfigToUpdate(CONFIG)
    expect(payload).toMatchObject({ sla_days: 5, sla_day_type: 'working' })
  })

  it('sends the calendar variant when selected', () => {
    const payload = mapLetterTypeConfigToUpdate({ ...CONFIG, slaDayType: 'calendar' })
    expect(payload.sla_day_type).toBe('calendar')
  })
})
