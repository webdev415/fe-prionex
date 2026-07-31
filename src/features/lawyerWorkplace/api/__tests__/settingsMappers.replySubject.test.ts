import { describe, it, expect } from 'vitest'
import type { ReplyTemplateFormValues } from '@/pages/LawyerWorkplace/components/settings/templates/ReplyTemplateModal'
import {
  mapLegalReplyTemplateToSettings,
  mapReplyTemplateFormToCreate,
  mapReplyTemplateFormToUpdate,
} from '../settingsMappers'
import type { LegalReplyTemplate } from '../types'

const FORM: ReplyTemplateFormValues = {
  name: 'Standard reply',
  subject: 'Відповідь №{{contract}}',
  body: 'Dear client',
  letterTypeIds: ['complaint'],
}

describe('reply-template subject mapping', () => {
  it('sends the subject in the create payload', () => {
    expect(mapReplyTemplateFormToCreate(FORM)).toMatchObject({
      name: 'Standard reply',
      subject: 'Відповідь №{{contract}}',
    })
  })

  it('sends the subject in the update payload', () => {
    expect(mapReplyTemplateFormToUpdate(FORM).subject).toBe('Відповідь №{{contract}}')
  })

  it('maps a blank subject to null (clears it)', () => {
    expect(mapReplyTemplateFormToCreate({ ...FORM, subject: '   ' }).subject).toBeNull()
    expect(mapReplyTemplateFormToUpdate({ ...FORM, subject: '' }).subject).toBeNull()
  })

  it('carries the API subject into the settings fallback', () => {
    const api: LegalReplyTemplate = {
      id: 't1',
      name: 'Standard reply',
      subject: 'Тема з API',
      body: 'Body',
      letter_type_ids: [],
      is_active: true,
    }
    const settings = mapLegalReplyTemplateToSettings(api)
    expect(settings.subjectFallback).toBe('Тема з API')
    expect(settings.subjectKey).toBe('api:reply-template:subject:t1')
  })

  it('maps a null API subject to an empty fallback', () => {
    const api: LegalReplyTemplate = {
      id: 't2',
      name: 'No subject',
      subject: null,
      body: 'Body',
      letter_type_ids: [],
      is_active: true,
    }
    expect(mapLegalReplyTemplateToSettings(api).subjectFallback).toBe('')
  })
})
