/**
 * Delete copy must not promise something the backend does not do.
 *
 * SMS templates and messaging drafts are soft-deleted: the row survives with
 * is_deleted/deleted_at/deleted_by and only a purge job removes it, after the
 * retention window. Both modals used to say the item was "permanently removed"
 * and the action "cannot be undone", which told users recoverable data was gone.
 *
 * The modal tests render mocked translations, so they would still pass if these
 * strings regressed. This asserts the shipped locale files themselves, in both
 * languages.
 */

import { describe, it, expect } from 'vitest'
import enCommon from '@/../public/locales/en/common.json'
import ukCommon from '@/../public/locales/uk/common.json'

type Json = Record<string, unknown>

const LOCALES: Array<[string, Json]> = [
  ['en', enCommon as Json],
  ['uk', ukCommon as Json],
]

const BLOCKS = [
  ['pages.smsTemplates.modals.delete', ['movedToTrashTitle', 'movedToTrashDescription']],
  ['pages.messagingDrafts.delete', ['movedToTrashTitle', 'movedToTrashDescription']],
] as const

// The exact keys whose text was untrue. Their absence is the fix.
const RETIRED = [
  'pages.smsTemplates.modals.delete.actionCannotBeUndone',
  'pages.smsTemplates.modals.delete.templateWillBePermanentlyRemoved',
  'pages.messagingDrafts.delete.cannotUndo',
  'pages.messagingDrafts.delete.permanentRemoval',
]

// en and uk phrasings of the promise these blocks must never make again.
const FALSE_PROMISES = [
  /permanently/i,
  /cannot be undone/i,
  /can'?t be undone/i,
  /назавжди/i,
  /неможливо скасувати/i,
  /не можна скасувати/i,
]

function at(obj: Json, path: string): unknown {
  return path.split('.').reduce<unknown>((node, part) => {
    if (node && typeof node === 'object') {
      return (node as Json)[part]
    }
    return undefined
  }, obj)
}

describe('soft-delete modal copy', () => {
  it.each(LOCALES)('%s defines the Trash wording for both modals', (_name, locale) => {
    for (const [block, keys] of BLOCKS) {
      for (const key of keys) {
        const value = at(locale, `${block}.${key}`)
        expect(typeof value, `${block}.${key}`).toBe('string')
        expect((value as string).trim().length).toBeGreaterThan(0)
      }
    }
  })

  it.each(LOCALES)('%s no longer carries the retired keys', (_name, locale) => {
    for (const path of RETIRED) {
      expect(at(locale, path), path).toBeUndefined()
    }
  })

  it.each(LOCALES)('%s never promises permanent removal in these blocks', (_name, locale) => {
    for (const [block] of BLOCKS) {
      const node = at(locale, block) as Json
      for (const [key, value] of Object.entries(node)) {
        if (typeof value !== 'string') continue
        for (const pattern of FALSE_PROMISES) {
          expect(pattern.test(value), `${block}.${key} = "${value}"`).toBe(false)
        }
      }
    }
  })

  it('mentions recovery, so the user knows Trash exists', () => {
    expect(
      at(enCommon as Json, 'pages.smsTemplates.modals.delete.movedToTrashDescription')
    ).toMatch(/restore/i)
    expect(at(enCommon as Json, 'pages.messagingDrafts.delete.movedToTrashDescription')).toMatch(
      /restore/i
    )
    expect(
      at(ukCommon as Json, 'pages.smsTemplates.modals.delete.movedToTrashDescription')
    ).toMatch(/відновити/i)
    expect(at(ukCommon as Json, 'pages.messagingDrafts.delete.movedToTrashDescription')).toMatch(
      /відновити/i
    )
  })
})
