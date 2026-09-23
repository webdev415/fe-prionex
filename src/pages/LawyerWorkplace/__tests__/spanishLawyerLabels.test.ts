import { describe, expect, it } from 'vitest'
import es from '@/../public/locales/es/common.json'

type Tree = { [key: string]: string | Tree }

function strings(tree: Tree, prefix = ''): Array<[string, string]> {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === 'string'
      ? [[`${prefix}${key}`, value] as [string, string]]
      : strings(value, `${prefix}${key}.`)
  )
}

const spanish = es as unknown as { pages: { lawyerWorkplace: Tree } }

describe('Spanish lawyer workplace labels', () => {
  const labels = strings(spanish.pages.lawyerWorkplace)

  it('show no Cyrillic document prefixes', () => {
    expect(labels.filter(([, text]) => /[Ѐ-ӿ]/.test(text))).toEqual([])
  })

  it('speak of the regulator instead of the NBU', () => {
    expect(labels.filter(([, text]) => /\bNBU\b|Ucrania/.test(text))).toEqual([])
  })

  it('name the register exports in Spanish', () => {
    const exportNames = Object.fromEntries(labels)
    expect(exportNames['registry.export.incomingFileName']).toBe('registro-entrada-{{date}}.csv')
    expect(exportNames['registry.export.outgoingFileName']).toBe('registro-salida-{{date}}.csv')
  })
})
