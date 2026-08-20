import { describe, it, expect, beforeEach } from 'vitest'
import { specificityOf, winningDeclaration } from '../cssCascade'

// The KAN-992 assertions in DateSelect.test.tsx are only as good as this
// resolver, so the resolver gets its own coverage — in particular the case
// that motivated it, where specificity and source order disagree and jsdom's
// own getComputedStyle picks the loser.

describe('specificityOf', () => {
  it.each([
    ['*', [0, 0, 0]],
    ['li', [0, 0, 1]],
    ['.item', [0, 1, 0]],
    ['#id', [1, 0, 0]],
    ["[aria-disabled='true']", [0, 1, 0]],
    ['li::before', [0, 0, 2]],
    ['.wrap .item', [0, 2, 0]],
    ['.wrap .item:hover', [0, 3, 0]],
    // The two selectors this was written for.
    [".wrap .item:not([aria-disabled='true'])", [0, 3, 0]],
    ['.wrap .item--selected', [0, 2, 0]],
    // :not() takes its most specific argument, not the sum.
    [".item:not([aria-disabled='true'], .item--selected)", [0, 2, 0]],
    ['.item:not(#a, .b)', [1, 1, 0]],
    // :where() contributes nothing; :is() behaves like :not().
    ['.item:where(#a)', [0, 1, 0]],
    ['.item:is(#a, .b)', [1, 1, 0]],
    ['.item:nth-child(2)', [0, 2, 0]],
  ])('scores %s', (selector, expected) => {
    expect(specificityOf(selector)).toEqual(expected)
  })
})

describe('winningDeclaration', () => {
  const load = (css: string, html: string) => {
    document.head.innerHTML = ''
    const style = document.createElement('style')
    style.textContent = css
    document.head.appendChild(style)
    document.body.innerHTML = html
    return document.querySelector('#target') as HTMLElement
  }

  beforeEach(() => {
    document.head.innerHTML = ''
    document.body.innerHTML = ''
  })

  it('prefers specificity over source order, unlike jsdom', () => {
    const el = load(
      `.wrap .item:not([x]) { color: rgb(1, 1, 1) !important; }
       .wrap .item--sel { color: rgb(2, 2, 2) !important; }`,
      `<div class="wrap"><li id="target" class="item item--sel"></li></div>`
    )

    // What jsdom computes — the last matching rule, specificity ignored.
    expect(getComputedStyle(el).color).toBe('rgb(2, 2, 2)')
    // What a browser computes: (0,3,0) beats (0,2,0) regardless of order.
    expect(winningDeclaration(el, 'color')?.value).toBe('rgb(1, 1, 1)')
  })

  it('falls back to source order when specificity ties', () => {
    const el = load(
      `.wrap .item { color: rgb(1, 1, 1); }
       .wrap .other { color: rgb(2, 2, 2); }`,
      `<div class="wrap"><li id="target" class="item other"></li></div>`
    )
    expect(winningDeclaration(el, 'color')?.value).toBe('rgb(2, 2, 2)')
  })

  it('lets !important outrank a more specific normal declaration', () => {
    const el = load(
      `.item { color: rgb(1, 1, 1) !important; }
       .wrap .item#target { color: rgb(2, 2, 2); }`,
      `<div class="wrap"><li id="target" class="item"></li></div>`
    )
    expect(winningDeclaration(el, 'color')?.value).toBe('rgb(1, 1, 1)')
  })

  it('ignores :hover rules at rest and applies them under { hover: true }', () => {
    const el = load(
      `.item { background-color: rgb(1, 1, 1); }
       .item:hover { background-color: rgb(2, 2, 2); }`,
      `<li id="target" class="item"></li>`
    )
    expect(winningDeclaration(el, 'background-color')?.value).toBe('rgb(1, 1, 1)')
    expect(winningDeclaration(el, 'background-color', { hover: true })?.value).toBe('rgb(2, 2, 2)')
  })

  it('splits selector lists so each half is ranked on its own specificity', () => {
    const el = load(
      `.wrap .item:not([x]) { color: rgb(1, 1, 1) !important; }
       .a, .wrap .item--sel:hover { color: rgb(2, 2, 2) !important; }`,
      `<div class="wrap"><li id="target" class="item item--sel"></li></div>`
    )
    // The matching half is (0,3,0) and ties the first rule, so order decides.
    expect(winningDeclaration(el, 'color', { hover: true })?.value).toBe('rgb(2, 2, 2)')
  })

  it('honours !important on a var() value, which jsdom itself drops', () => {
    // The gap that made this helper necessary: jsdom's declaration parser
    // reports an empty priority for ``var(--x) !important``, so a themed rule
    // would rank below any plain-valued library rule on a longer selector.
    const el = load(
      `:root { --brand: rgb(1, 1, 1); }
       .item { color: var(--brand) !important; }
       .wrap ul li.item.other { color: rgb(2, 2, 2); }`,
      `<div class="wrap"><ul><li id="target" class="item other"></li></ul></div>`
    )

    const winner = winningDeclaration(el, 'color')
    expect(winner?.important).toBe(true)
    expect(winner?.value).toBe('var(--brand)')
  })

  it('reports values as the stylesheet wrote them, without CSSOM normalisation', () => {
    const el = load(`.item { color: #ffffff; }`, `<li id="target" class="item"></li>`)
    expect(winningDeclaration(el, 'color')?.value).toBe('#ffffff')
  })

  it('throws when an at-rule contains a genuine competitor', () => {
    // Returning rgb(1,1,1) here would be a wrong winner, not a skipped rule:
    // in a browser with the dark scheme active .wrap .item wins on specificity.
    const el = load(
      `.item { color: rgb(1, 1, 1); }
       @media (prefers-color-scheme: dark) { .wrap .item { color: rgb(2, 2, 2); } }`,
      `<div class="wrap"><li id="target" class="item"></li></div>`
    )
    // The message must NAME the block: a reader hitting this needs to know
    // whether it is a query that could apply here or one that never will.
    expect(() => winningDeclaration(el, 'color')).toThrow(/@media \(prefers-color-scheme: dark\)/)
  })

  it('ignores at-rule contents that could not have competed', () => {
    // Same block, different property and a non-matching selector: neither could
    // change the answer, so the resolver must stay quiet rather than refuse to
    // answer any question about a stylesheet that happens to contain @media.
    const el = load(
      `.item { color: rgb(1, 1, 1); }
       @media (prefers-color-scheme: dark) {
         .item { background-color: rgb(9, 9, 9); }
         .somewhere-else { color: rgb(2, 2, 2); }
       }`,
      `<div class="wrap"><li id="target" class="item"></li></div>`
    )
    expect(winningDeclaration(el, 'color')?.value).toBe('rgb(1, 1, 1)')
  })

  it('does not let a statement at-rule swallow the rule after it', () => {
    // react-datepicker.css opens with @charset, and the prelude used to carry
    // it into the next selector — which then looked like an at-rule and was
    // dropped, losing that stylesheet's entire first rule.
    const el = load(
      `@charset "UTF-8";
       .item { color: rgb(4, 4, 4); }`,
      `<li id="target" class="item"></li>`
    )
    expect(winningDeclaration(el, 'color')?.value).toBe('rgb(4, 4, 4)')
  })

  it('treats a brace inside a quoted value as data, not structure', () => {
    // ``content: "{"`` is legal CSS. Counting that brace mis-sliced every rule
    // after it, and tripped the nesting guard on a rule that has no nesting.
    const el = load(
      `.item { content: "{"; color: rgb(3, 3, 3); }
       .item { background-color: rgb(7, 7, 7); }`,
      `<li id="target" class="item"></li>`
    )
    expect(winningDeclaration(el, 'color')?.value).toBe('rgb(3, 3, 3)')
    // The rule AFTER it must still be found — proof the slice stayed aligned.
    expect(winningDeclaration(el, 'background-color')?.value).toBe('rgb(7, 7, 7)')
  })

  it('throws on a nested rule rather than mis-attributing it', () => {
    const el = load(
      `.item { color: rgb(1, 1, 1); &:hover { color: rgb(2, 2, 2); } }`,
      `<li id="target" class="item"></li>`
    )
    expect(() => winningDeclaration(el, 'color')).toThrow(/nested/)
  })

  it('does not split a declaration value on a quoted semicolon', () => {
    // Must query the property whose OWN value holds the quoted ';' — a later
    // declaration survives the bad split intact, so asserting on `color` here
    // would pass with or without the fix.
    const el = load(
      `.item { content: "a;b"; color: rgb(6, 6, 6); }`,
      `<li id="target" class="item"></li>`
    )
    expect(winningDeclaration(el, 'content')?.value).toBe('"a;b"')
  })

  it('does not split a selector list inside an attribute value', () => {
    const el = load(
      `[data-x="a,b"] .item { color: rgb(5, 5, 5); }`,
      `<div data-x="a,b"><li id="target" class="item"></li></div>`
    )
    expect(winningDeclaration(el, 'color')?.value).toBe('rgb(5, 5, 5)')
  })

  it('ignores commented-out rules', () => {
    const el = load(
      `.item { color: rgb(1, 1, 1); }
       /* .wrap .item { color: rgb(2, 2, 2); } */`,
      `<div class="wrap"><li id="target" class="item"></li></div>`
    )
    expect(winningDeclaration(el, 'color')?.value).toBe('rgb(1, 1, 1)')
  })

  it('throws instead of silently dropping a selector jsdom cannot parse', () => {
    // A swallowed selector would remove a candidate from the ranking and
    // return the runner-up as the winner — green, and wrong.
    const el = load(`.item:bogus(x) { color: rgb(1, 1, 1); }`, `<li id="target" class="item"></li>`)
    expect(() => winningDeclaration(el, 'color')).toThrow(/cannot match the selector/)
  })

  it('does not throw for a selector that merely fails to match', () => {
    const el = load(`.other { color: rgb(1, 1, 1); }`, `<li id="target" class="item"></li>`)
    expect(() => winningDeclaration(el, 'color')).not.toThrow()
  })

  it('returns null when nothing sets the property', () => {
    const el = load(`.item { color: rgb(1, 1, 1); }`, `<li id="target" class="item"></li>`)
    expect(winningDeclaration(el, 'border-color')).toBeNull()
  })
})
