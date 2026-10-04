/**
 * След показанных правовых текстов (18-4e): чтение поля карточки без React.
 *
 * Защищается терпимость: модуль старше контракта 0.1.48 поля не шлёт (блока нет,
 * а не «пусто»), элемент не той формы не роняет экран, будущее поле этапа (18-4c)
 * читается, но не требуется. Отпечатки синтетические.
 */
import { describe, it, expect } from 'vitest'
import {
  LEGAL_TRAIL_SHA_PREFIX,
  doorKind,
  hasDoor,
  hasShownAt,
  readLegalTrail,
  shortSha,
  sourceKind,
} from '../legalTrail'
import { CREDIT_CONSENT_KINDS, CREDIT_DYNAMIC_NAMESPACES } from '../enums'

const SHA = 'ab'.repeat(32)
const VALID = {
  source: 'legal-texts',
  subject: 'sign.max_cost',
  publication_id: 63,
  version_no: 1,
  sha256: SHA,
  locale: 'en',
  shown_at: null,
  received_at: '2026-10-04T03:33:19.123456+00:00',
}

describe('readLegalTrail: форма поля → состояние блока', () => {
  it.each([
    ['поля нет', undefined],
    ['null', null],
    ['объект', {}],
    ['строка', 'x'],
    ['число', 3],
  ])('%s → null (блока нет)', (_name, value) => {
    expect(readLegalTrail(value)).toBeNull()
  })

  it('пустой массив → [] (блок с пометкой «следа нет»)', () => {
    expect(readLegalTrail([])).toEqual([])
  })

  it('только не-объекты → [] (как пустой массив)', () => {
    expect(readLegalTrail([null, 'x', 7, ['a']])).toEqual([])
  })

  it('не-объекты пропускаются, порядок объектов — как в массиве', () => {
    const rows = readLegalTrail([
      null,
      { ...VALID, subject: 'z.last' },
      'x',
      { ...VALID, subject: 'a.first' },
    ])
    expect(rows?.map((shown) => shown.subject)).toEqual(['z.last', 'a.first'])
  })

  it('валидный элемент читается без потерь, лишние ключи игнорируются', () => {
    expect(readLegalTrail([{ ...VALID, extra_future: { a: 1 } }])).toEqual([
      { ...VALID, door: null },
    ])
  })

  it('значение не того вида → null в своём поле, строка остаётся', () => {
    const [shown] = readLegalTrail([
      {
        source: 5,
        subject: {},
        publication_id: '63',
        version_no: 'one',
        sha256: 123,
        locale: 7,
        shown_at: {},
        received_at: 123,
        door: ['sign'],
      },
    ]) ?? [null]
    expect(shown).toEqual({
      source: null,
      subject: null,
      publication_id: null,
      version_no: null,
      sha256: null,
      locale: null,
      shown_at: null,
      received_at: null,
      door: null,
    })
  })

  it('номера — только конечные целые', () => {
    const [shown] =
      readLegalTrail([{ ...VALID, publication_id: Number.NaN, version_no: 1.5 }]) ?? []
    expect(shown?.publication_id).toBeNull()
    expect(shown?.version_no).toBeNull()
  })

  it('момент показа не подменяется моментом приёма', () => {
    const [shown] = readLegalTrail([VALID]) ?? []
    expect(shown?.shown_at).toBeNull()
    expect(shown?.received_at).toBe(VALID.received_at)
  })
})

describe('помощники столбцов', () => {
  it('отпечаток — ровно 12 первых знаков; пустой — null', () => {
    expect(LEGAL_TRAIL_SHA_PREFIX).toBe(12)
    expect(shortSha(SHA)).toBe(SHA.slice(0, 12))
    expect(shortSha(null)).toBeNull()
    expect(shortSha('')).toBeNull()
  })

  it.each([
    ['legal-texts', 'legalTexts'],
    ['site-documents', 'siteDocuments'],
    ['cms-other', null],
    [null, null],
  ] as const)('источник %s → %s', (source, kind) => {
    expect(sourceKind(source)).toBe(kind)
  })

  it.each([
    ['intake', 'intake'],
    ['sign', 'sign'],
    ['screen_x', null],
    ['', null],
    [null, null],
  ] as const)('этап %s → %s', (door, kind) => {
    expect(doorKind(door)).toBe(kind)
  })

  it('«Показано» — только если хотя бы один момент задан', () => {
    const rows = readLegalTrail([VALID, VALID]) ?? []
    expect(hasShownAt(rows)).toBe(false)
    const withOne = readLegalTrail([VALID, { ...VALID, shown_at: '2026-10-04T08:15:00+00:00' }])
    expect(hasShownAt(withOne ?? [])).toBe(true)
  })

  it('«Етап» — только при непустом `door` хотя бы у одной строки (AC-3)', () => {
    expect(hasDoor(readLegalTrail([VALID]) ?? [])).toBe(false)
    expect(
      hasDoor(
        readLegalTrail([
          { ...VALID, door: '' },
          { ...VALID, door: '' },
        ]) ?? []
      )
    ).toBe(false)
    expect(hasDoor(readLegalTrail([VALID, { ...VALID, door: 'screen_x' }]) ?? [])).toBe(true)
  })
})

describe('виды согласий: страж словаря (AC-6)', () => {
  it('пространство `consent` = девять видов `Consent.kind` контракта 0.1.48', () => {
    // Литерал снят с `openapi.yaml:7871` модуля (45c4d6b2), не с `enums.ts`.
    const contract = [
      'terms',
      'personal_data',
      'e_signature',
      'credit_bureau',
      'marketing',
      'ibv_provider',
      'pad',
      'e_copy',
      'privacy_policy',
    ]
    expect([...(CREDIT_DYNAMIC_NAMESPACES.consent ?? [])].sort()).toEqual([...contract].sort())
    expect([...CREDIT_CONSENT_KINDS].sort()).toEqual([...contract].sort())
  })
})
