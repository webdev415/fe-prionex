/**
 * Rules of the task / request form (planner story 5.7): the deadline as
 * exactly one key, presets on the board's clock, board options and search,
 * server errors at their fields, board field values.
 */
import { describe, expect, it } from 'vitest'
import type { PlannerBoardField } from '@/api/planner/plannerApi'
import {
  boardCardOption,
  boardOptions,
  dueBody,
  fieldBodyValue,
  fieldErrorKey,
  fieldOfError,
  matchesBoard,
  presetChoice,
  todayIn,
  zonedMoment,
} from '../createTaskForm'

const KYIV = 'Europe/Kyiv'

const field = (overrides: Partial<PlannerBoardField>): PlannerBoardField => ({
  id: 'f-1',
  name: 'Номер договору',
  type: 'text',
  required: true,
  default: null,
  position: 1,
  options: [],
  ...overrides,
})

describe('срок — ровно одним ключом (3.11)', () => {
  it('дата без времени шлёт due_date и не шлёт due_at', () => {
    const result = dueBody({ date: '2026-10-05', time: '' }, KYIV)
    expect(result).toEqual({ body: { due_date: '2026-10-05' } })
  })

  it('дата со временем шлёт due_at со смещением пояса доски и не шлёт due_date', () => {
    // October in Kyiv is summer time (+03:00), December is winter time (+02:00).
    expect(dueBody({ date: '2026-10-05', time: '14:30' }, KYIV)).toEqual({
      body: { due_at: '2026-10-05T14:30:00+03:00' },
    })
    expect(dueBody({ date: '2026-12-01', time: '09:00' }, KYIV)).toEqual({
      body: { due_at: '2026-12-01T09:00:00+02:00' },
    })
    expect(dueBody({ date: '2026-12-01', time: '09:00' }, 'UTC')).toEqual({
      body: { due_at: '2026-12-01T09:00:00+00:00' },
    })
  })

  it('без срока — один ключ due_date: null; оба ключа не уходят никогда', () => {
    expect(dueBody(null, KYIV)).toEqual({ body: { due_date: null } })
    expect(dueBody({ date: '', time: '' }, KYIV)).toEqual({ body: { due_date: null } })
    for (const choice of [
      null,
      { date: '2026-10-05', time: '' },
      { date: '2026-10-05', time: '18:00' },
    ]) {
      const result = dueBody(choice, KYIV)
      expect('body' in result && Object.keys(result.body)).toHaveLength(1)
    }
  })

  it('час без даты, несуществующая дата и час в переводе стрелок — не отправляются', () => {
    expect(dueBody({ date: '', time: '10:00' }, KYIV)).toEqual({ problem: 'dateMissing' })
    expect(dueBody({ date: '2026-02-31', time: '' }, KYIV)).toEqual({ problem: 'invalidDate' })
    // 28.03.2027 in Kyiv the clocks jump from 03:00 to 04:00: 03:30 does not exist.
    expect(zonedMoment('2027-03-28', '03:30', KYIV)).toBeNull()
    expect(dueBody({ date: '2027-03-28', time: '03:30' }, KYIV)).toEqual({
      problem: 'nonexistentTime',
    })
    expect(zonedMoment('2027-03-28', '04:30', KYIV)).toBe('2027-03-28T04:30:00+03:00')
  })
})

describe('пресеты «Сьогодні 18:00 · Завтра · Пт» — по часам доски', () => {
  // Thursday 01.10.2026, 22:30 UTC — already Friday 02.10, 01:30 in Kyiv.
  const lateThursdayUtc = new Date('2026-10-01T22:30:00Z')

  it('«сегодня» — дата в поясе доски, а не браузера', () => {
    expect(todayIn(lateThursdayUtc, 'UTC')).toBe('2026-10-01')
    expect(todayIn(lateThursdayUtc, KYIV)).toBe('2026-10-02')
  })

  it('каждый пресет — дата и 18:00; «Пт» в пятницу — пятница следующей недели', () => {
    expect(presetChoice('today', lateThursdayUtc, KYIV)).toEqual({
      date: '2026-10-02',
      time: '18:00',
    })
    expect(presetChoice('tomorrow', lateThursdayUtc, KYIV)).toEqual({
      date: '2026-10-03',
      time: '18:00',
    })
    expect(presetChoice('friday', lateThursdayUtc, KYIV)).toEqual({
      date: '2026-10-09',
      time: '18:00',
    })
    // In UTC it is still Thursday: the Friday is tomorrow.
    expect(presetChoice('friday', lateThursdayUtc, 'UTC').date).toBe('2026-10-02')
  })

  it('пресет уходит моментом (due_at), а не датой', () => {
    const choice = presetChoice('tomorrow', lateThursdayUtc, KYIV)
    expect(dueBody(choice, KYIV)).toEqual({ body: { due_at: '2026-10-03T18:00:00+03:00' } })
  })
})

describe('выбор доски', () => {
  const list = {
    items: [
      {
        id: 'b1',
        code: 'SKL',
        name: 'Склад',
        kind: 'team' as const,
        version: 1,
        role: 'board_member' as const,
        allowed_actions: ['create_task'],
      },
    ],
    intake: [
      {
        id: 'b2',
        code: 'TP',
        name: 'ТП',
        kind: 'department' as const,
        department_name: 'ТП',
        intake_hint: 'стягнення простроченої заборгованості',
        required_fields: [],
      },
      {
        id: 'b3',
        code: 'SUP',
        name: 'Підтримка',
        kind: 'department' as const,
        department_name: 'Тех. підтримка',
        intake_hint: 'підтримка клієнтів, не стягнення',
        required_fields: [],
      },
      {
        id: 'b4',
        code: 'ITO',
        name: 'IT-опс',
        kind: 'team' as const,
        department_name: null,
        intake_hint: null,
        required_fields: [],
      },
    ],
  }

  it('доски члена — задачи, доски intake — заявки; «Нова заявка» — только intake', () => {
    const options = boardOptions(list)
    expect(options.map((o) => [o.code, o.group, o.request])).toEqual([
      ['SKL', 'team', false],
      ['TP', 'intakeDepartment', true],
      ['SUP', 'intakeDepartment', true],
      ['ITO', 'intakeTeam', true],
    ])
    expect(boardOptions(list, true).map((o) => o.code)).toEqual(['TP', 'SUP', 'ITO'])
    expect(boardOptions(undefined)).toEqual([])
    expect(boardOptions({ items: list.items }).map((o) => o.code)).toEqual(['SKL'])
  })

  it('поиск — по названию, отделу, коду и подсказке П-9, без учёта регистра', () => {
    const options = boardOptions(list)
    const found = (q: string) => options.filter((o) => matchesBoard(o, q)).map((o) => o.code)
    expect(found('клієнт')).toEqual(['SUP'])
    expect(found('СТЯГНЕННЯ')).toEqual(['TP', 'SUP'])
    expect(found('тех.')).toEqual(['SUP'])
    expect(found('ito')).toEqual(['ITO'])
    expect(found('  ')).toEqual(['SKL', 'TP', 'SUP', 'ITO'])
  })

  it('карточка доски — доска члена в «Дошка» только при create_task (запасной вариант без списка)', () => {
    const card = { code: 'SKL', name: 'Склад', kind: 'team' as const }
    expect(boardCardOption({ ...card, allowed_actions: ['create_task', 'configure'] })).toEqual({
      code: 'SKL',
      name: 'Склад',
      group: 'team',
      request: false,
      department: null,
      hint: null,
    })
    expect(boardCardOption({ ...card, allowed_actions: ['configure'] })).toBeUndefined()
  })
})

describe('ошибка сервера — у своего поля', () => {
  const fields = [field({ id: 'f-1', name: 'Номер договору' })]

  it('ключи тела и поля доски (по id, иначе по имени)', () => {
    expect(fieldOfError({ field: 'assignee_ids' }, fields)).toBe('assignees')
    expect(fieldOfError({ field: 'due_at' }, fields)).toBe('due')
    expect(fieldOfError({ field: 'type_id', reason: 'triage_only' }, fields)).toBe('type')
    expect(fieldOfError({ field: 'Номер договору', id: 'f-1' }, fields)).toBe('field:f-1')
    expect(fieldOfError({ field: 'Номер договору' }, fields)).toBe('field:f-1')
    expect(fieldOfError({ field: 'dev_task_url' }, fields)).toBeUndefined()
    expect(fieldOfError({}, fields)).toBeUndefined()
  })

  it('текст — по причине, иначе по полю', () => {
    expect(fieldErrorKey({ reason: 'required' }, 'field:f-1')).toBe('create.errors.required')
    expect(fieldErrorKey({ reason: 'raw_html' }, 'description')).toBe('create.errors.rawHtml')
    expect(fieldErrorKey({}, 'assignees')).toBe('create.errors.assignees')
    expect(fieldErrorKey({ reason: 'invalid' }, 'field:f-1')).toBe('create.errors.invalid')
  })
})

describe('значения полей доски', () => {
  it('число, пустое, мультивыбор и человек — в форме контракта', () => {
    expect(fieldBodyValue(field({ type: 'number' }), '1.5')).toBe(1.5)
    expect(fieldBodyValue(field({ type: 'number' }), 'abc')).toBeUndefined()
    expect(fieldBodyValue(field({ type: 'text' }), '  ')).toBeNull()
    expect(fieldBodyValue(field({ type: 'multi_select' }), [])).toBeNull()
    expect(fieldBodyValue(field({ type: 'multi_select' }), ['o-1'])).toEqual(['o-1'])
    expect(
      fieldBodyValue(field({ type: 'person' }), {
        user_id: 'u-1',
        crm_user_id: 1,
        full_name: 'Олена Коваль',
        never_logged_in: false,
        departments: [],
      })
    ).toBe('u-1')
  })
})
