/**
 * Ukrainian `planner` dictionary for tests of the section: the global
 * react-i18next mock returns raw keys, and the stories pin the Ukrainian texts
 * literally («Немає доступу до Планера…», «Планер тимчасово недоступний…»).
 * Other namespaces fall back to `defaultValue` or the key.
 */
import uk from '@/../public/locales/uk/planner.json'

function lookup(key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined,
      uk
    )
}

export function plannerT(namespace: string) {
  return (key: string, second?: unknown): string => {
    const options = (second && typeof second === 'object' ? second : {}) as Record<string, unknown>
    const ns = typeof options.ns === 'string' ? options.ns : namespace
    const fallback =
      typeof second === 'string' ? second : (options.defaultValue as string | undefined)
    const found = ns === 'planner' ? lookup(key) : undefined
    const template = typeof found === 'string' ? found : (fallback ?? key)
    return template.replace(/\{\{(\w+)\}\}/g, (_: string, name: string) =>
      name in options ? String(options[name]) : `{{${name}}}`
    )
  }
}

export function plannerUseTranslation(namespace = 'common') {
  return { t: plannerT(namespace), i18n: { language: 'uk' } }
}
