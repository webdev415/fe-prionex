/**
 * Moving a card on the kanban — the pure plan (planner story 5.3, AC3): the
 * neighbour that says the place, the keys the card's rights allow, and the
 * optimistic picture. The drag path and the keyboard path both go through it.
 */
import { describe, expect, it } from 'vitest'
import {
  applyMove,
  canMoveCard,
  currentPosition,
  planBack,
  planDrop,
  planPatch,
  planReorder,
  positionAt,
} from '../board/kanbanMove'
import { cardAccepts, columnAccepts, type CardDragData } from '../board/dnd'
import { makeCard, makeKanban } from './plannerFixtures'

const card = (n: number, statusId = 's-todo') =>
  makeCard({
    id: `t-${n}`,
    key: `SKL-${n}`,
    number: n,
    status: {
      id: statusId,
      name: statusId,
      category: statusId === 's-done' ? 'done' : statusId === 's-work' ? 'in_progress' : 'todo',
    },
  })

const A = card(1)
const B = card(2)
const C = card(3)
const W = card(4, 's-work')
const board = () => makeKanban([A, B, C, W])
const BOTH = { changeStatus: true, reorder: true }

describe('план перемещения карточки (5.3)', () => {
  it('место — сосед: перед карточкой, что пойдёт следом, в конце — после последней, в пустой — никакого', () => {
    expect(positionAt([A, B], 0)).toEqual({ before_id: 't-1' })
    expect(positionAt([A, B], 1)).toEqual({ before_id: 't-2' })
    expect(positionAt([A, B], 2)).toEqual({ after_id: 't-2' })
    expect(positionAt([], 0)).toBeUndefined()
  })

  it('бросок на карточку — по ближнему краю; на свободное место колонки — в конец; на себя — ничего', () => {
    expect(
      planDrop(board(), 't-1', { statusId: 's-todo', overTaskId: 't-3', edge: 'bottom' })
    ).toMatchObject({
      toStatusId: 's-todo',
      toIndex: 2,
    })
    expect(
      planDrop(board(), 't-3', { statusId: 's-todo', overTaskId: 't-1', edge: 'top' })
    ).toMatchObject({
      toIndex: 0,
    })
    expect(planDrop(board(), 't-1', { statusId: 's-work' })).toMatchObject({
      fromStatusId: 's-todo',
      toStatusId: 's-work',
      toIndex: 1,
    })
    expect(
      planDrop(board(), 't-1', { statusId: 's-todo', overTaskId: 't-1', edge: 'top' })
    ).toBeNull()
  })

  it('команда: внутри колонки — только position; между колонками — status_id и position', () => {
    const inside = planDrop(board(), 't-1', {
      statusId: 's-todo',
      overTaskId: 't-3',
      edge: 'bottom',
    })!
    expect(planPatch(board(), inside, BOTH)?.patch).toEqual({ position: { after_id: 't-3' } })

    const across = planDrop(board(), 't-2', { statusId: 's-work', overTaskId: 't-4', edge: 'top' })!
    expect(planPatch(board(), across, BOTH)?.patch).toEqual({
      status_id: 's-work',
      position: { before_id: 't-4' },
    })
  })

  it('на своё же место — команды нет', () => {
    const same = planDrop(board(), 't-2', {
      statusId: 's-todo',
      overTaskId: 't-1',
      edge: 'bottom',
    })!
    expect(planPatch(board(), same, BOTH)).toBeNull()
  })

  it('права: без reorder — только status_id и конец колонки; без change_status — не в другую колонку', () => {
    const across = planDrop(board(), 't-2', { statusId: 's-work', overTaskId: 't-4', edge: 'top' })!
    const statusOnly = planPatch(board(), across, { changeStatus: true, reorder: false })
    expect(statusOnly?.patch).toEqual({ status_id: 's-work' })
    expect(statusOnly?.plan.toIndex).toBe(1)
    expect(planPatch(board(), across, { changeStatus: false, reorder: true })).toBeNull()

    const inside = planReorder(board(), 't-1', 'down')!
    expect(planPatch(board(), inside, { changeStatus: true, reorder: false })).toBeNull()
  })

  it('«Змінити порядок»: вище, нижче, на початок — и ничего, когда карточка уже там', () => {
    expect(planPatch(board(), planReorder(board(), 't-2', 'up')!, BOTH)?.patch).toEqual({
      position: { before_id: 't-1' },
    })
    expect(planPatch(board(), planReorder(board(), 't-2', 'down')!, BOTH)?.patch).toEqual({
      position: { after_id: 't-3' },
    })
    expect(planPatch(board(), planReorder(board(), 't-3', 'top')!, BOTH)?.patch).toEqual({
      position: { before_id: 't-1' },
    })
    expect(planReorder(board(), 't-1', 'up')).toBeNull()
    expect(planReorder(board(), 't-1', 'top')).toBeNull()
    expect(planReorder(board(), 't-3', 'down')).toBeNull()
  })

  it('оптимистичная картинка: карточка сразу в новой колонке, счётчики обеих колонок сдвинуты', () => {
    const kanban = makeKanban([A, B, C, W], undefined, { 's-todo': 57 })
    const next = applyMove(
      kanban,
      { taskId: 't-1', fromStatusId: 's-todo', toStatusId: 's-work', toIndex: 0 },
      { id: 's-work', name: 'В роботі', category: 'in_progress' }
    )
    const todo = next.columns.find((c) => c.status.id === 's-todo')!
    const work = next.columns.find((c) => c.status.id === 's-work')!
    expect(todo.items.map((c) => c.id)).toEqual(['t-2', 't-3'])
    expect(todo.total).toBe(56)
    expect(work.items.map((c) => c.id)).toEqual(['t-1', 't-4'])
    expect(work.items[0].status).toEqual({
      id: 's-work',
      name: 'В роботі',
      category: 'in_progress',
    })
    expect(work.total).toBe(2)
  })

  it('путь назад для «Скасувати»: прежний сосед, а после перемещения — индекс по нему', () => {
    const before = board()
    expect(currentPosition(before, 't-2')).toEqual({
      statusId: 's-todo',
      position: { before_id: 't-3' },
    })
    const moved = applyMove(
      before,
      { taskId: 't-2', fromStatusId: 's-todo', toStatusId: 's-work', toIndex: 1 },
      { id: 's-work', name: 's-work', category: 'in_progress' }
    )
    expect(planBack(moved, 't-2', 's-todo', { before_id: 't-3' })).toMatchObject({
      toStatusId: 's-todo',
      toIndex: 1,
    })
    // The neighbour is gone meanwhile: the end of the column.
    expect(planBack(moved, 't-2', 's-todo', { before_id: 't-99' })?.toIndex).toBe(2)
  })

  it('кого можно взять и куда бросить — по правам карточки', () => {
    expect(canMoveCard({ allowed_actions: ['edit'] })).toBe(false)
    expect(canMoveCard({ allowed_actions: ['reorder'] })).toBe(true)
    const source = (changeStatus: boolean, reorder: boolean): CardDragData => ({
      type: 'planner-card',
      taskId: 't-1',
      statusId: 's-todo',
      changeStatus,
      reorder,
    })
    expect(columnAccepts(source(true, false), 's-work')).toBe(true)
    expect(columnAccepts(source(true, false), 's-todo')).toBe(false)
    expect(columnAccepts(source(false, true), 's-work')).toBe(false)
    // Without `reorder` no line between cards: the server puts it at the end.
    expect(cardAccepts(source(true, false), 's-work')).toBe(false)
    expect(cardAccepts(source(false, true), 's-todo')).toBe(true)
    expect(cardAccepts(source(false, true), 's-work')).toBe(false)
  })
})
