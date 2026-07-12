import { describe, expect, it } from 'vitest'
import type { Element, Root } from 'hast'
import {
  CLIENT_ID_PROP,
  CLIENT_REF_TAG,
  FACT_NUMBER_PROP,
  FACT_REF_TAG,
  hasMarkers,
  normalizeCircledFootnotes,
  rehypeAssistantMarkers,
  splitMarkers,
} from '../assistantMarkers'

describe('splitMarkers — факт-сноски [[N]]', () => {
  it('разбивает "48 750 ₴[[1]]" на текст + факт-сегмент', () => {
    expect(splitMarkers('48 750 ₴[[1]]')).toEqual([
      { type: 'text', value: '48 750 ₴' },
      { type: 'fact', n: 1 },
    ])
  })

  it('поддерживает несколько факт-сносок в одной строке', () => {
    expect(splitMarkers('Долг 48 750 ₴[[1]], срок 12.06.2026[[2]].')).toEqual([
      { type: 'text', value: 'Долг 48 750 ₴' },
      { type: 'fact', n: 1 },
      { type: 'text', value: ', срок 12.06.2026' },
      { type: 'fact', n: 2 },
      { type: 'text', value: '.' },
    ])
  })

  it('разбирает многозначный номер сноски', () => {
    expect(splitMarkers('итог[[42]]')).toEqual([
      { type: 'text', value: 'итог' },
      { type: 'fact', n: 42 },
    ])
  })
})

describe('splitMarkers — ссылки на клиента [[client:id|Имя]]', () => {
  it('разбирает id и имя через "|"', () => {
    expect(splitMarkers('Клиент [[client:48213|Коваленко О. П.]] должен')).toEqual([
      { type: 'text', value: 'Клиент ' },
      { type: 'client', id: 48213, label: 'Коваленко О. П.' },
      { type: 'text', value: ' должен' },
    ])
  })

  it('обрезает пробелы вокруг имени', () => {
    expect(splitMarkers('[[client:7|  Иван Петров  ]]')).toEqual([
      { type: 'client', id: 7, label: 'Иван Петров' },
    ])
  })

  it('корректно разбирает смесь клиент- и факт-маркеров', () => {
    expect(splitMarkers('[[client:5|А. Б.]] заплатил 10[[3]]')).toEqual([
      { type: 'client', id: 5, label: 'А. Б.' },
      { type: 'text', value: ' заплатил 10' },
      { type: 'fact', n: 3 },
    ])
  })
})

describe('splitMarkers — текст без маркеров и битые маркеры (экранирование)', () => {
  it('текст без маркеров = один text-сегмент (рендер не меняется)', () => {
    expect(splitMarkers('Просто текст без маркеров.')).toEqual([
      { type: 'text', value: 'Просто текст без маркеров.' },
    ])
  })

  it('пустая строка = пустой список сегментов', () => {
    expect(splitMarkers('')).toEqual([])
  })

  it('нечисловой факт-маркер остаётся текстом', () => {
    expect(splitMarkers('см. [[abc]] тут')).toEqual([{ type: 'text', value: 'см. [[abc]] тут' }])
  })

  it('неполный маркер остаётся текстом', () => {
    expect(splitMarkers('оборванный [[1 маркер')).toEqual([
      { type: 'text', value: 'оборванный [[1 маркер' },
    ])
  })

  it('client-маркер без имени не совпадает и остаётся текстом', () => {
    expect(splitMarkers('[[client:5]]')).toEqual([{ type: 'text', value: '[[client:5]]' }])
  })
})

describe('hasMarkers', () => {
  it('true для факт- и клиент-маркеров, false для обычного текста', () => {
    expect(hasMarkers('a[[1]]')).toBe(true)
    expect(hasMarkers('[[client:1|X]]')).toBe(true)
    expect(hasMarkers('без маркеров')).toBe(false)
    // Повторный вызов не должен зависеть от lastIndex глобального regex.
    expect(hasMarkers('a[[1]]')).toBe(true)
  })
})

describe('normalizeCircledFootnotes — глиф ①..⑳ → маркер [[N]]', () => {
  it('возвращает глиф в [[N]] для номера с источником', () => {
    expect(normalizeCircledFootnotes('В статусе new 413 442 ①.', new Set([1]))).toBe(
      'В статусе new 413 442 [[1]].'
    )
  })

  it('конвертирует несколько глифов, каждый по своему номеру', () => {
    expect(normalizeCircledFootnotes('Долг ① и срок ②', new Set([1, 2]))).toBe(
      'Долг [[1]] и срок [[2]]'
    )
  })

  it('глиф без источника остаётся текстом (гейт по citationIds)', () => {
    // ③ = сноска 3, но источника 3 нет → не трогаем; ① есть → конвертируем.
    expect(normalizeCircledFootnotes('первый ① третий ③', new Set([1]))).toBe(
      'первый [[1]] третий ③'
    )
  })

  it('пустой набор источников = полный no-op (прежнее поведение)', () => {
    expect(normalizeCircledFootnotes('текст ① со сноской', new Set())).toBe('текст ① со сноской')
  })

  it('⑳ = сноска 20 (верхняя граница диапазона)', () => {
    expect(normalizeCircledFootnotes('край ⑳', new Set([20]))).toBe('край [[20]]')
  })
})

/** Собрать минимальное hast-дерево: <p>{children}</p>. */
function paragraph(...children: Root['children']): Root {
  return {
    type: 'root',
    children: [{ type: 'element', tagName: 'p', properties: {}, children: children as never }],
  }
}

describe('rehypeAssistantMarkers — hast-трансформация', () => {
  const transform = rehypeAssistantMarkers()

  it('заменяет [[N]] на элемент fact-ref с номером в свойствах', () => {
    const tree = paragraph({ type: 'text', value: 'Долг 100[[1]]' })
    transform(tree)

    const p = tree.children[0] as Element
    expect(p.children).toHaveLength(2)
    expect(p.children[0]).toEqual({ type: 'text', value: 'Долг 100' })
    const fact = p.children[1] as Element
    expect(fact.tagName).toBe(FACT_REF_TAG)
    expect(fact.properties?.[FACT_NUMBER_PROP]).toBe('1')
  })

  it('заменяет [[client:id|Имя]] на client-ref с id и текстом-меткой', () => {
    const tree = paragraph({ type: 'text', value: '[[client:48213|Коваленко О. П.]]' })
    transform(tree)

    const p = tree.children[0] as Element
    const client = p.children[0] as Element
    expect(client.tagName).toBe(CLIENT_REF_TAG)
    expect(client.properties?.[CLIENT_ID_PROP]).toBe('48213')
    expect(client.children[0]).toEqual({ type: 'text', value: 'Коваленко О. П.' })
  })

  it('не трогает текст без маркеров', () => {
    const tree = paragraph({ type: 'text', value: 'обычный текст' })
    transform(tree)
    const p = tree.children[0] as Element
    expect(p.children).toEqual([{ type: 'text', value: 'обычный текст' }])
  })

  it('не заходит внутрь <code>/<pre> (маркеры в коде остаются текстом)', () => {
    const tree: Root = {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'pre',
          properties: {},
          children: [
            {
              type: 'element',
              tagName: 'code',
              properties: {},
              children: [{ type: 'text', value: 'value[[1]]' }],
            },
          ],
        },
      ],
    }
    transform(tree)

    const pre = tree.children[0] as Element
    const code = pre.children[0] as Element
    expect(code.children).toEqual([{ type: 'text', value: 'value[[1]]' }])
  })

  it('с citationIds: кружковый глиф ① из вывода модели становится fact-ref', () => {
    // Модель нарисовала готовый глиф вместо [[1]] — при наличии источника 1
    // он должен стать кликабельной сноской (регресс: раньше оставался текстом).
    const transformWithIds = rehypeAssistantMarkers({ citationIds: new Set([1]) })
    const tree = paragraph({ type: 'text', value: 'В статусе new 413 442 ①' })
    transformWithIds(tree)

    const p = tree.children[0] as Element
    expect(p.children).toHaveLength(2)
    expect(p.children[0]).toEqual({ type: 'text', value: 'В статусе new 413 442 ' })
    const fact = p.children[1] as Element
    expect(fact.tagName).toBe(FACT_REF_TAG)
    expect(fact.properties?.[FACT_NUMBER_PROP]).toBe('1')
  })

  it('без citationIds кружковый глиф остаётся обычным текстом', () => {
    const tree = paragraph({ type: 'text', value: 'В статусе new 413 442 ①' })
    transform(tree)
    const p = tree.children[0] as Element
    expect(p.children).toEqual([{ type: 'text', value: 'В статусе new 413 442 ①' }])
  })
})
