import { describe, expect, it, vi } from 'vitest'

// The shared test setup mocks i18next core, so @/lib/i18n has no real `t`.
// Provide a passthrough that returns the defaultValue for the noSubject fallback.
vi.mock('@/lib/i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/i18n')>()
  return {
    ...actual,
    default: {
      t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key,
    },
  }
})

import {
  buildLetterParameters,
  isLetterParametersReadOnly,
  mapInboxItemToLetterListItem,
  mapMessageToLetterDetail,
  mapProcessingStatusToDisplay,
} from '../mappers'
import type { LegalInboxItem, LegalMessageDetail, LegalLetterType } from '../types'

describe('mapInboxItemToLetterListItem', () => {
  const baseItem: LegalInboxItem = {
    id: 'msg-1',
    thread_id: 'thread-1',
    mailbox_id: 'mb-uuid',
    subject: 'Hi CRM-Prionex',
    from_address: 'sargsyantigran835@gmail.com',
    processing_status: 'in_progress',
    direction: 'incoming',
    received_at: '2026-06-24T09:00:00Z',
    is_quarantined: false,
    needs_manual_review: false,
    suggested_letter_type_id: 'attorney_request',
    suggested_client_id: 1,
    suggested_lawyer_user_id: 10,
    auto_process_eligible: false,
  }

  it('shows client name in the card title when client is matched', () => {
    const item = mapInboxItemToLetterListItem({
      ...baseItem,
      suggested_client_source: 'contract_number',
      suggested_client_name: 'Client-111 Беззуб',
    })

    expect(item.senderName).toBe('Client-111 Беззуб')
    expect(item.senderEmail).toBe('sargsyantigran835@gmail.com')
  })

  it('falls back to a localized placeholder when the subject is blank', () => {
    const item = mapInboxItemToLetterListItem({
      ...baseItem,
      subject: '   ',
    })

    expect(item.subject).toBe('(no subject)')
  })

  it('uses mailbox email instead of mailbox id', () => {
    const item = mapInboxItemToLetterListItem({
      ...baseItem,
      mailbox_email: 'liokaivenn@gmail.com',
    })

    expect(item.mailbox).toBe('liokaivenn@gmail.com')
    expect(item.routeFromEmail).toBe('sargsyantigran835@gmail.com')
    expect(item.routeToEmail).toBe('liokaivenn@gmail.com')
  })

  it('shows mailbox to recipient route for outbound sent rows', () => {
    const item = mapInboxItemToLetterListItem({
      ...baseItem,
      direction: 'outbound',
      processing_status: 'sent',
      from_address: 'client@example.com',
      to_addresses: ['client@example.com'],
      mailbox_email: 'legal@company.com',
    })

    expect(item.direction).toBe('outgoing')
    expect(item.routeFromEmail).toBe('legal@company.com')
    expect(item.routeToEmail).toBe('client@example.com')
  })
})

describe('buildLetterParameters', () => {
  it('uses debt contract number instead of client code', () => {
    const message = {
      suggested_letter_type_id: 'complaint',
      suggested_client_id: 111,
      suggested_lawyer_user_id: 10,
      suggested_client_source: 'sender_email',
      suggested_contract_number: '27427',
      confirmed_contract_number: null,
      received_at: '2026-06-24T09:00:00Z',
    } as LegalMessageDetail

    const parameters = buildLetterParameters(message, {
      letterTypesById: new Map<string, LegalLetterType>([
        [
          'complaint',
          {
            id: 'complaint',
            slug: 'complaint',
            name: 'Complaint',
            sla_days: 7,
          } as LegalLetterType,
        ],
      ]),
    })

    expect(parameters.contractLabel).toBe('27427')
    expect(parameters.contractId).toBe('27427')
  })

  it('prefers confirmed contract over suggested contract', () => {
    const message = {
      suggested_letter_type_id: 'complaint',
      suggested_client_id: 111,
      suggested_lawyer_user_id: 10,
      suggested_contract_number: '27427',
      confirmed_contract_number: '99999',
      received_at: '2026-06-24T09:00:00Z',
    } as LegalMessageDetail

    const parameters = buildLetterParameters(message)
    expect(parameters.contractLabel).toBe('99999')
  })

  it('prefers confirmed letter type over suggested letter type', () => {
    const message = {
      suggested_letter_type_id: 'complaint',
      confirmed_letter_type_id: 'attorney_request',
      received_at: '2026-06-24T09:00:00Z',
    } as LegalMessageDetail

    const parameters = buildLetterParameters(message, {
      letterTypesById: new Map<string, LegalLetterType>([
        [
          'attorney_request',
          {
            id: 'attorney_request',
            slug: 'attorney_request',
            name: 'Attorney request',
            sla_days: 7,
          } as LegalLetterType,
        ],
      ]),
    })

    expect(parameters.letterType).toBe('attorney_request')
  })

  it('leaves due date empty when letter type is unclassified', () => {
    const message = {
      suggested_letter_type_id: null,
      confirmed_letter_type_id: null,
      received_at: '2026-05-21T09:00:00Z',
    } as LegalMessageDetail

    const parameters = buildLetterParameters(message)
    expect(parameters.dueDate).toBe('')
    expect(parameters.confirmedCount).toBe(0)
  })

  it('computes due date from letter type SLA when type is known', () => {
    const message = {
      suggested_letter_type_id: 'complaint',
      received_at: '2026-05-21T09:00:00Z',
    } as LegalMessageDetail

    const parameters = buildLetterParameters(message, {
      letterTypesById: new Map<string, LegalLetterType>([
        [
          'complaint',
          {
            id: 'complaint',
            slug: 'complaint',
            name: 'Complaint',
            sla_days: 14,
          } as LegalLetterType,
        ],
      ]),
    })

    expect(parameters.dueDate).toBe('2026-06-04')
  })

  it('prefers persisted suggested due date over SLA default', () => {
    const message = {
      suggested_letter_type_id: 'complaint',
      suggested_due_date: '2026-07-20T12:00:00.000Z',
      received_at: '2026-05-21T09:00:00Z',
    } as LegalMessageDetail

    const parameters = buildLetterParameters(message, {
      letterTypesById: new Map<string, LegalLetterType>([
        [
          'complaint',
          {
            id: 'complaint',
            slug: 'complaint',
            name: 'Complaint',
            sla_days: 14,
          } as LegalLetterType,
        ],
      ]),
    })

    expect(parameters.dueDate).toBe('2026-07-20')
  })

  it('maps lawyer id from merged suggested_lawyer_user_id for EDO reply context', () => {
    const message = {
      id: 'msg-1',
      thread_id: 'thread-1',
      mailbox_id: 'mb-1',
      internet_message_id: '<msg@example>',
      subject: 'Test',
      from_address: 'sender@example.com',
      to_addresses: ['legal@company.com'],
      cc_addresses: [],
      body_text: 'Hello',
      body_html: null,
      processing_status: 'in_progress',
      direction: 'incoming',
      received_at: '2026-06-24T09:00:00Z',
      sent_at: null,
      is_quarantined: false,
      quarantine_reason: null,
      needs_manual_review: false,
      suggested_letter_type_id: 'complaint',
      suggested_client_id: 100,
      suggested_lawyer_user_id: 42,
      auto_process_eligible: false,
      legal_task_id: 501,
      attachments: [],
    } as LegalMessageDetail

    const detail = mapMessageToLetterDetail(message, undefined)
    expect(detail.replyContext.clientId).toBe(100)
    expect(detail.replyContext.assignedUserId).toBe(42)
    expect(detail.parameters.lawyerId).toBe('42')
  })

  it('uses mailbox to recipient route in thread header for outbound messages', () => {
    const message = {
      id: 'msg-out-1',
      thread_id: 'thread-1',
      mailbox_id: 'mb-1',
      internet_message_id: '<out@example>',
      subject: 'RE: Test',
      from_address: 'client@example.com',
      to_addresses: ['client@example.com'],
      cc_addresses: [],
      body_text: 'Response',
      body_html: null,
      processing_status: 'sent',
      direction: 'outbound',
      received_at: '2026-06-24T10:00:00Z',
      sent_at: '2026-06-24T10:00:00Z',
      is_quarantined: false,
      quarantine_reason: null,
      needs_manual_review: false,
      suggested_letter_type_id: 'complaint',
      suggested_client_id: 100,
      suggested_lawyer_user_id: 42,
      auto_process_eligible: false,
      legal_task_id: null,
      attachments: [],
    } as LegalMessageDetail

    const detail = mapMessageToLetterDetail(message, undefined, {
      mailboxLabelById: new Map([['mb-1', 'legal@company.com']]),
    })
    expect(detail.routeFromEmail).toBe('legal@company.com')
    expect(detail.routeToEmail).toBe('client@example.com')
  })
})

describe('mapProcessingStatusToDisplay', () => {
  it('maps auto_processed with manual review to in_progress badge', () => {
    expect(mapProcessingStatusToDisplay('auto_processed', true)).toBe('in_progress')
  })

  it('maps full auto_processed without manual review to auto badge', () => {
    expect(mapProcessingStatusToDisplay('auto_processed', false)).toBe('auto_processed')
  })

  it('maps sent outbound processing status to done badge', () => {
    expect(mapProcessingStatusToDisplay('sent')).toBe('done')
  })
})

describe('isLetterParametersReadOnly', () => {
  it('keeps partial auto letters editable', () => {
    expect(
      isLetterParametersReadOnly({
        status: 'in_progress',
        isUnprocessed: true,
      })
    ).toBe(false)
  })

  it('locks full auto-processed letters', () => {
    expect(
      isLetterParametersReadOnly({
        status: 'auto_processed',
        isUnprocessed: false,
      })
    ).toBe(true)
  })

  it('locks outbound sent letters', () => {
    expect(
      isLetterParametersReadOnly({
        status: 'new',
        isUnprocessed: true,
        direction: 'outbound',
      })
    ).toBe(true)
  })
})
