#!/usr/bin/env node
/**
 * Static audit for unmarked personal data in JSX — the regression barrier of
 * KAN-KB-54.
 *
 * WHAT IT ANSWERS: "does this file render a client's name, address or free-text
 * comment in a place OpenReplay would record verbatim?" It reports every JSX
 * site whose expression reads a PII-shaped identifier and which is not covered
 * by `data-openreplay-obscured` in the same file, plus a second list of PII that
 * sits in `title` / `alt` / `aria-label` / `placeholder`, which the tracker does
 * NOT mask at all (it masks text nodes, images and input values — attributes
 * reach the recording as they are, from obscured and hidden nodes alike).
 *
 * 🔴 WHY AN AST AND NOT A GREP. The requirement is "identifiers, not comments
 * and not string literals", and a line-based regex cannot express it — which is
 * visible in the task's own numbers: a grep over five field names calls
 * `RouteErrorElement.tsx` a hit for the words "address bar" in a sentence, and
 * `components/ui/Input.tsx` a hit for a comment. `typescript` is already a
 * devDependency, `ts.createSourceFile` parses TSX without a program, and no
 * TypeChecker is needed to ask what an identifier is spelled.
 *
 * WHAT IT CANNOT DO, said plainly: it sees the SOURCE, not the rendered DOM. A
 * block moved out of a marked container, a portal, a wrapper that drops
 * `...rest` — none of that is visible here. That is the job of the runtime
 * detector (`src/lib/openreplay/piiAudit.dev.ts`, `window.__piiAudit()`), and
 * the two are not interchangeable: the first catches new SOURCE, the second
 * catches new MARKUP.
 *
 * USAGE
 *   npm run pii-audit                  # full report, exit 0
 *   npm run pii-audit -- --check       # exit 1 if anything is unmarked (CI)
 *   npm run pii-audit -- --check src/pages/ClientManagement
 *   npm run pii-audit -- --json        # machine-readable
 *
 * The allowlist is `scripts/pii-audit.allowlist.json`: an array of
 * `{ path, identifier, reason }`. Keyed by path + identifier and NEVER by line
 * number — lines move with every edit, and a line-keyed allowlist stops matching
 * in silence, which is the failure mode this whole script exists to prevent.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

/**
 * The repository root.
 *
 * The fallback is for the test: Vitest transforms this module through Vite,
 * where `import.meta.url` is an http: URL rather than a file: one and
 * `fileURLToPath` throws. Under node — every real run — the first branch holds.
 */
const ROOT = (() => {
  try {
    return fileURLToPath(new URL('..', import.meta.url))
  } catch {
    return process.cwd()
  }
})()
const ALLOWLIST_PATH = join(ROOT, 'scripts/pii-audit.allowlist.json')

// ── The dictionary ───────────────────────────────────────────────────────────
// Written out here rather than left to the caller's judgement, because "what
// counts as a name" decided per file is how coverage drifts.
//
// ⚠️ The leading `[A-Za-z_]*` is not decoration. `\bfullName\b` does NOT match
// `clientFullName`: `\b` needs a word/non-word boundary, and there is none
// between `t` and `F`. With plain word boundaries the dictionary would miss
// exactly the derived names it was widened for (`clientFullName`, `fullAddress`,
// `assigned_user_full_name`).

const PII_NAME = [
  /[A-Za-z_]*[fF]ull_?[nN]ame\b/,
  /\b[A-Za-z_]*(first|last|middle|First|Last|Middle)_?[nN]ame\b/,
  /\b\w*EmployeeName\b/,
  /\b\w*[pP]atronymic\b/,
  // `displayName(user)` — `features/employeeCard/lib/displayName`, which builds
  // a person's name out of the parts. Added because reading the employee list
  // found a render site the field names alone could not: the identifier here
  // names the FORMATTER, not the field. Its 40 namesakes in `src/` are
  // `Component.displayName = '…'` assignments, which are not JSX expressions and
  // so never reach this rule.
  /^displayName$/,
  // Names that arrive at the JSX already renamed after their owner. The task's
  // five-field grep cannot see any of these, and neither could the rules above:
  // `clientName` is not `full_name` and not `fullName`. Found by reading
  // `pages/LawyerWorkplace`, where the entire section renders client names under
  // this spelling and the audit reported nothing at all.
  /\b\w*(client|contact|operator|employee|trainer|lawyer|debtor|recipient|sender|author|manager|person|customer|recorded_?by|created_?by|assigned_?by|updated_?by)_?[nN]ame\b/i,
]

const PII_ADDR = [/[A-Za-z_]*[aA]ddress\b/]

/**
 * Rules whose signal is the OWNER, tested against the whole chain.
 *
 * `classify` judges by the last segment on purpose — `address.is_primary` must
 * not count as an address — so a rule that needs the object half lives here.
 *
 * Names of ATTACHMENTS and DOCUMENTS: `attachment.name`, `document.filename`,
 * `generated.document_name`. Added after review of KAN-KB-54 found an uploaded
 * file's name in a `title` inside the assistant — a file attached to a client's
 * case is called 'Іваненко_договір.pdf' more often than not, which is why phase
 * 4 removed the same value from `DocumentPreviewModal`'s iframe title.
 * Deliberately NOT every `fileName`: a bulk-import CSV or a template file is
 * named after a date or a form, and a rule that fired on those (22 sites when
 * tried) would have bought a dozen allowlist entries and no leak closed.
 */
const PII_NAME_BY_OWNER = [
  /\b(attachment|document)s?\??\.(name|filename|fileName|file_name|document_name)$/,
  /\b\w*document_?name$/i,
]

/**
 * Identifiers that match the shape but are not letters-of-a-person.
 *
 * `ip_address` is a network address, `email_address` is already masked by the
 * tracker (`obscureTextEmails`), `address_type` is an enum. Removing a `title`
 * or an `sr-only` label whose value is one of these is an accessibility
 * regression traded for nothing.
 */
const NOT_PII = [
  /\bip_?[aA]ddress\b/i,
  /\bemail_?[aA]ddress\b/i,
  /\b[aA]ddress_?[tT]ype\b/,
  /\bmac_?[aA]ddress\b/i,
  /\b[aA]ddress[bB]ar\b/,
]

/**
 * Free-text operator fields. ADVISORY ONLY — reported in its own section and
 * deliberately left out of `--check`.
 *
 * Unbounded it matches ~116 files, most of them template descriptions, course
 * summaries and settings blurbs. It cannot be narrowed by "the object is typed
 * as a Client" either: there is no such shared type (`Client` is declared twice,
 * as two different interfaces, in `features/clients/api/types.ts` and
 * `pages/ClientManagement/types.ts`), and "typed as" is a question for a
 * TypeChecker, not for this script. So the section is triaged by hand, by the
 * name of the receiver.
 */
const PII_FREE = [
  /\b(notes|comment|comments|description)\b/,
  // Rendered client-facing text: a letter, a sent SMS, a resolved template, a
  // call transcript. Added after review of KAN-KB-54 found the message preview
  // in SendMessageModal unmarked — `previewBody` is a resolved template that
  // routinely opens with the client's full name, and no field-name rule can see
  // it. The owner filter below is what keeps `template.body` (the unrendered
  // template, UI copy) out of the list.
  /\b(body|message|text|subject|content|html)\b/,
]

/** Receivers whose free text is operator/client prose rather than UI copy. */
const FREE_TEXT_OWNERS =
  /\b(client|contact|interaction|payment|row|item|detail|call|lead|debtor|promise|letter|message|sms|preview|email|mail|note|utt|utterance|segment|transcript|feedback|reply|rendered|display|safe)\w*$/i

/**
 * Property tails that read something OTHER than the value: a key, a count, a
 * method. `client.address.id` matches the address dictionary on its text alone.
 */
const NON_VALUE_TAILS = new Set([
  'id',
  'ids',
  'key',
  'length',
  'size',
  'count',
  'index',
  'trim',
  'toString',
  'map',
  'filter',
  'find',
  'some',
  'every',
  'join',
  'split',
  'slice',
  'includes',
])

/**
 * Identifier shapes that hold a flag or a callback rather than a value:
 * `isUpdatingAddress`, `handleStartEditAddress`, `onAddressChange`,
 * `setFullName`.
 *
 * ⚠️ `format*`, `render*` and `get*` are deliberately NOT here:
 * `{formatEmployeeName(row)}` renders a name, and excluding that shape would
 * drop a real site (`pages/ActionAnalysis/components/CallsTable.tsx`).
 */
const NON_VALUE_SHAPE =
  /^(is|has|had|was|were|should|can|could|will|handle|on|set|toggle|use|open|close|show|hide)[A-Z]/

const ATTRS_UNMASKED = new Set(['title', 'alt', 'aria-label', 'placeholder'])

const OBSCURED_ATTR = 'data-openreplay-obscured'
const HIDDEN_ATTR = 'data-openreplay-hidden'

// ── CLI ──────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2)
const CHECK = argv.includes('--check')
const JSON_OUT = argv.includes('--json')
const QUIET = argv.includes('--quiet')
const targets = argv.filter((a) => !a.startsWith('--'))

// ── File discovery ───────────────────────────────────────────────────────────

/** Directories with no rendered output, so nothing in them can leak to a replay. */
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'coverage', '.git', '__tests__'])

function collectFiles(dir, out) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue
      collectFiles(full, out)
    } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
      if (/\.(test|spec)\.tsx$/.test(entry.name)) continue
      out.push(full)
    }
  }
  return out
}

function resolveTargets(list) {
  const roots = list.length > 0 ? list : ['src']
  const files = []
  for (const target of roots) {
    const abs = join(ROOT, target)
    if (!existsSync(abs)) {
      process.stderr.write(`pii-audit: no such path: ${target}\n`)
      process.exitCode = 2
      continue
    }
    if (statSync(abs).isDirectory()) collectFiles(abs, files)
    else if (abs.endsWith('.tsx')) files.push(abs)
  }
  return [...new Set(files)].sort()
}

// ── Classification ───────────────────────────────────────────────────────────

/** The last segment of a chain: `client.work?.managerFullName` -> `managerFullName`. */
function tailOf(text) {
  const dot = text.lastIndexOf('.')
  return dot === -1 ? text : text.slice(dot + 1)
}

/**
 * What kind of personal data, if any, an identifier reads.
 *
 * Judged on the chain's LAST segment, not on its full text. The object half of
 * a chain says what the value belongs to, not what it is: `address.is_primary`
 * is a boolean and `address.address_type` is an enum, yet both contain the
 * string "address" and both were reported before this was narrowed. A rule that
 * fires on the container's name reports the same false positive forever, and an
 * allowlist entry for it is an unexplained hole that outlives whoever added it.
 */
function classify(text) {
  const tail = tailOf(text)
  if (NOT_PII.some((re) => re.test(tail))) return null
  if (PII_NAME.some((re) => re.test(tail))) return 'PII_NAME'
  if (PII_ADDR.some((re) => re.test(tail))) return 'PII_ADDR'
  if (PII_NAME_BY_OWNER.some((re) => re.test(text))) return 'PII_NAME'
  return null
}

function classifyFree(text) {
  const tail = tailOf(text)
  // A bare identifier has no owner to filter on, so it is judged by its own
  // shape: `previewBody`, `renderedBody`, `safeHtml`, `displayBody` are the
  // resolved text of a message and were the sites review found unmarked.
  if (!text.includes('.')) {
    return /^(preview|rendered|display|safe|message|letter|sms|email)\w*(Body|Text|Html|Subject|Content)$/.test(
      text
    )
      ? 'PII_FREE'
      : null
  }
  if (!PII_FREE.some((re) => re.test(tail))) return null
  // `client.notes` yes, `template.description` no — decided by the owner, which
  // is the only signal available without a type checker.
  const owner = text.slice(0, text.lastIndexOf('.'))
  return FREE_TEXT_OWNERS.test(owner) ? 'PII_FREE' : null
}

// ── AST walk ─────────────────────────────────────────────────────────────────

/**
 * The identifiers an expression READS, in the source's own spelling.
 *
 * Three exclusions, each of which decides whether the report is usable at all:
 *
 * 🔴 NESTED JSX IS NOT DESCENDED INTO. Without this the walk reports the
 * OUTERMOST expression on the screen rather than the place the value is
 * rendered: `{tab === 'payments' && (…900 lines…)}` is reported as a hit for a
 * `client.fullName` a thousand lines below it. That is not a cosmetic problem —
 * marking up the real site would not clear the finding, because the marked
 * element is not an ancestor of the outer expression. The barrier would stay red
 * no matter what anyone did to the code. Every nested expression is visited on
 * its own by the main walk, so nothing is lost by stopping here.
 *
 * BINDING POSITIONS ARE NOT READS. The `address` in
 * `addresses.map((address) => …)` names a variable, it does not render one.
 *
 * A CHAIN ENDING IN A NON-VALUE IS NOT A READ. `addresses.length` is a number,
 * `firstName.trim()` is a method, `address.id` is a key. Reporting those teaches
 * the reader to skip the output, which costs more than the entries are worth.
 */
function expressionNames(node, names) {
  const visit = (current) => {
    // Nested JSX, and the contents of string and template literals: copy, not
    // identifiers.
    if (
      ts.isJsxElement(current) ||
      ts.isJsxSelfClosingElement(current) ||
      ts.isJsxFragment(current) ||
      ts.isJsxExpression(current) ||
      ts.isStringLiteralLike(current)
    ) {
      return
    }

    // A CONDITION TESTS A VALUE, IT DOES NOT RENDER ONE.
    // `{clientName ? <span>{clientName}</span> : null}` renders the name in the
    // branch, and the branch is what gets marked up. Reading the condition too
    // reports the OUTER expression as a second site — one that marking up the
    // inner span can never clear, because the marked element is not its
    // ancestor. Same failure as descending into nested JSX, reached from the
    // other side.
    if (ts.isConditionalExpression(current)) {
      visit(current.whenTrue)
      visit(current.whenFalse)
      return
    }
    if (
      ts.isBinaryExpression(current) &&
      (current.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
        current.operatorToken.kind === ts.SyntaxKind.BarBarToken)
    ) {
      // `{name && <span>…</span>}` guards; `{name || '—'}` renders. Only the
      // first has a left side that is a test rather than a value.
      const right = current.right
      const guardsJsx =
        ts.isJsxElement(right) ||
        ts.isJsxSelfClosingElement(right) ||
        ts.isJsxFragment(right) ||
        ts.isParenthesizedExpression(right)
      if (!guardsJsx) visit(current.left)
      visit(right)
      return
    }

    if (
      ts.isParameter(current) ||
      ts.isBindingElement(current) ||
      ts.isVariableDeclaration(current)
    ) {
      current.forEachChild((child) => {
        if (child !== current.name) visit(child)
      })
      return
    }

    if (ts.isPropertyAccessExpression(current)) {
      const tail = current.name.getText()
      if (NON_VALUE_TAILS.has(tail)) {
        // …but a CALL before the tail produced the value, and its arguments may
        // render one: `people.map((p) => personName(p)).join(', ')` puts every
        // name on the screen, yet stopping at `.join` never reached the
        // callback (fe-prionex#337, TaskMeta `AssigneeNames`). Only a call is
        // descended into — `addresses.length` and `firstName.trim()` still read
        // a count and a method, not a value.
        if (ts.isCallExpression(current.expression)) visit(current.expression)
        return
      }
      if (!NON_VALUE_SHAPE.test(tail)) names.add(current.getText())
      // The object half is NOT visited: `address` in `address.is_primary` is
      // the container, not a rendered value, and adding it made every boolean
      // and enum on an address object a finding.
      return
    }

    if (ts.isIdentifier(current)) {
      if (!NON_VALUE_SHAPE.test(current.getText())) names.add(current.getText())
      return
    }

    current.forEachChild(visit)
  }

  visit(node)
  return names
}

/**
 * The element or component an attribute sits on, for the report.
 *
 * It is reported rather than filtered on, and that is a decision worth stating.
 * The obvious rule — "only lower-case tags are real DOM attributes" — is wrong
 * here in both directions. `<Link title={fullName}>` forwards the prop to the
 * `<a>` it renders, so the value reaches the recording exactly as it would from
 * a `<span>`; filtering on the tag's case dropped three of the six known leaks
 * the moment it was tried. `<ModalHeader title={…}>` really does render the
 * prop as a text node, where markup IS the fix. Which of the two a component is
 * cannot be known without reading it, so the host is printed and the reader
 * reads it — an under-reported leak costs more than a mis-categorised one.
 */
function attributeHost(node) {
  const opening = node.parent?.parent
  const tag = opening?.tagName?.getText()
  if (!tag) return '?'
  return /^[a-z]/.test(tag) ? `<${tag}>` : tag
}

/** True when this JSX element, or one of its JSX ancestors, carries the attribute. */
function isCoveredInSource(node) {
  for (let cur = node; cur; cur = cur.parent) {
    if (ts.isJsxElement(cur) || ts.isJsxSelfClosingElement(cur) || ts.isJsxFragment(cur)) {
      const opening = ts.isJsxElement(cur) ? cur.openingElement : cur
      const attributes = opening.attributes?.properties ?? []
      for (const attr of attributes) {
        if (ts.isJsxAttribute(attr)) {
          const name = attr.name.getText()
          if (name === OBSCURED_ATTR || name === HIDDEN_ATTR) return true
          if (name === `"${OBSCURED_ATTR}"` || name === `'${OBSCURED_ATTR}'`) return true
          // `obscured` / `obscured={true}` on a component that forwards the flag
          // (FieldGrid, SearchableSelect, DataTable's expandedObscured).
          //
          // 🔴 The VALUE decides, not the name (review of KAN-KB-54, round 4).
          // Treating any prop called `obscured` as coverage let
          // `<SearchableSelect obscured={false}>` — or `obscured={isPerson}` —
          // silence `--check` for the whole subtree, including real renders of
          // names inside it. Same rule as `isCoveredByColumnLiteral`: a bare
          // shorthand or a literal `true` covers; a literal `false` does not; any
          // OTHER expression does not either, because the audit cannot know
          // which branch runs and a false negative here is a leak nobody sees.
          if (name === 'obscured' || name === 'expandedObscured') {
            if (!attr.initializer) return true
            const value = attr.initializer
              .getText()
              .replace(/^\{|\}$/g, '')
              .trim()
            if (value === 'true') return true
            continue
          }
        } else if (ts.isJsxSpreadAttribute(attr)) {
          // `{...piiProps}` / `{...(x ? piiProps : {})}` — the constant is the
          // only sanctioned way to spread the attribute, so its name is enough.
          if (/\bpii(Props|HiddenProps)\b/.test(attr.getText())) return true
        }
      }
      // `<Pii>` / `<Pii as="div">` — the wrapper from lib/openreplay/pii.tsx.
      const tag = ts.isJsxElement(cur)
        ? cur.openingElement.tagName.getText()
        : ts.isJsxSelfClosingElement(cur)
          ? cur.tagName.getText()
          : ''
      if (tag === 'Pii') return true
    }
  }
  return false
}

/**
 * Does this element ITSELF carry the obscuring attribute?
 *
 * Deliberately not the ancestor walk used for text: iframe capture reads the
 * attribute off the node, so a marked wrapper counts for nothing here.
 */
function ownAttributesMark(opening) {
  for (const attr of opening.attributes?.properties ?? []) {
    if (ts.isJsxAttribute(attr) && attr.name.getText() === OBSCURED_ATTR) return true
    if (ts.isJsxSpreadAttribute(attr) && /\bpiiProps\b/.test(attr.getText())) return true
  }
  return false
}

/**
 * Does this object literal look like a `Column<T>`?
 *
 * `key` plus `header` is the shape, and it is checked rather than assumed so
 * that the rule below cannot fire on any object that happens to own a `render`.
 */
function isColumnLiteral(node) {
  if (!ts.isObjectLiteralExpression(node)) return false
  const keys = new Set(
    node.properties
      .filter((prop) => ts.isPropertyAssignment(prop) || ts.isShorthandPropertyAssignment(prop))
      .map((prop) => prop.name?.getText())
  )
  return keys.has('key') && keys.has('header')
}

/**
 * A DataTable column object literal carrying `obscured: true`.
 *
 * Columns are declared outside JSX, so the JSX-ancestor walk above cannot see
 * them — without this every `render: (r) => r.full_name` in the 19 table files
 * would be reported forever, and the flag added in phase 1 would buy nothing.
 */
function isCoveredByColumnLiteral(node) {
  for (let cur = node; cur; cur = cur.parent) {
    if (ts.isObjectLiteralExpression(cur)) {
      for (const prop of cur.properties) {
        if (!ts.isPropertyAssignment(prop) && !ts.isShorthandPropertyAssignment(prop)) continue
        const key = prop.name?.getText()
        if (key !== 'obscured') continue
        // Literal `true` only — same reasoning as the JSX branch: a computed
        // value is a branch the audit cannot see down. Unlike JSX, an object
        // shorthand `{ key, header, obscured }` is a VARIABLE read, not `true`,
        // so it does not count either.
        if (ts.isShorthandPropertyAssignment(prop)) continue
        if (prop.initializer.getText() === 'true') return true
      }
    }
  }
  return false
}

function lineOf(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1
}

function auditFile(absPath) {
  const relPath = relative(ROOT, absPath).split(sep).join('/')
  return auditSource(relPath, readFileSync(absPath, 'utf8'))
}

/**
 * The audit of one file's source, without touching the disk.
 *
 * Split out so the rules can be tested against fixtures. They have to be: the
 * walk's exclusions decide whether the report points at the line a developer
 * must edit or at a container a thousand lines above it, and both shapes look
 * identical in a summary count.
 */
export function auditSource(relPath, text) {
  const absPath = join(ROOT, relPath)
  const sourceFile = ts.createSourceFile(
    absPath,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  )

  const rendered = []
  const attributes = []
  const freeText = []
  const iframes = []
  const htmlSinks = []

  const visit = (node) => {
    // ── <iframe> still open to capture ───────────────────────────────────
    // `TopObserver` captures a frame when
    // `captureIFrames && !hasOpenreplayAttribute(node, 'obscured')`, reading the
    // attribute off the NODE in its own callback. Inheritance plays no part, so
    // this cannot be folded into the checks below, and `captureIFrames` defaults
    // to true and is not set in `src/lib/openreplay/index.ts`. A same-origin
    // frame — including every `blob:` URL, which inherits the creator's origin —
    // therefore has its whole document written into the recording.
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
      if (node.tagName.getText() === 'iframe' && !ownAttributesMark(node)) {
        iframes.push({
          path: relPath,
          line: lineOf(sourceFile, node),
          identifier: '<iframe>',
          kind: 'IFRAME',
        })
      }
    }

    // ── dangerouslySetInnerHTML: a sink with no identifiers ───────────────
    // Whatever this renders, the walk below cannot see: the text nodes come out
    // of a string at runtime and nothing in the source names them. So the rule
    // is structural — the sink must sit under a marked node, its own or an
    // ancestor's. Review of KAN-KB-54 found a client's whole letter rendered
    // this way (`EmailMessageBody`) outside every marked node in the file.
    if (ts.isJsxAttribute(node) && node.name.getText() === 'dangerouslySetInnerHTML') {
      if (!isCoveredInSource(node)) {
        htmlSinks.push({
          path: relPath,
          line: lineOf(sourceFile, node),
          identifier: 'dangerouslySetInnerHTML',
          kind: 'HTML_SINK',
        })
      }
    }

    // ── PII in an unmasked attribute ──────────────────────────────────────
    if (ts.isJsxAttribute(node) && ATTRS_UNMASKED.has(node.name.getText())) {
      const initializer = node.initializer
      if (initializer && ts.isJsxExpression(initializer) && initializer.expression) {
        const names = expressionNames(initializer.expression, new Set())
        for (const name of names) {
          const kind = classify(name)
          if (kind) {
            attributes.push({
              path: relPath,
              line: lineOf(sourceFile, node),
              identifier: name,
              attribute: node.name.getText(),
              host: attributeHost(node),
              kind,
            })
            break
          }
        }
      }
    }

    // ── PII rendered by a DataTable column that returns no JSX ───────────
    // `render: (r) => r.full_name` renders a name into a `<td>` without ever
    // producing a JSX expression, so the walk below cannot see it. Skipping
    // these would leave the one declarative chokepoint in the codebase — the 19
    // files that go through DataTable — entirely unaudited.
    if (
      ts.isPropertyAssignment(node) &&
      node.name.getText() === 'render' &&
      isColumnLiteral(node.parent)
    ) {
      const names = expressionNames(node.initializer, new Set())
      for (const name of names) {
        const kind = classify(name)
        if (!kind) continue
        if (!isCoveredByColumnLiteral(node)) {
          rendered.push({ path: relPath, line: lineOf(sourceFile, node), identifier: name, kind })
        }
        break
      }
    }

    // ── PII rendered as text ──────────────────────────────────────────────
    if (ts.isJsxExpression(node) && node.expression && !ts.isJsxAttribute(node.parent)) {
      const names = expressionNames(node.expression, new Set())
      let reported = false
      for (const name of names) {
        const kind = classify(name)
        if (!kind) continue
        reported = true
        if (!isCoveredInSource(node) && !isCoveredByColumnLiteral(node)) {
          rendered.push({ path: relPath, line: lineOf(sourceFile, node), identifier: name, kind })
        }
        break
      }
      if (!reported) {
        for (const name of names) {
          if (!classifyFree(name)) continue
          if (!isCoveredInSource(node) && !isCoveredByColumnLiteral(node)) {
            freeText.push({
              path: relPath,
              line: lineOf(sourceFile, node),
              identifier: name,
              kind: 'PII_FREE',
            })
          }
          break
        }
      }
    }

    node.forEachChild(visit)
  }

  visit(sourceFile)
  return { rendered, attributes, freeText, iframes, htmlSinks }
}

// ── Allowlist ────────────────────────────────────────────────────────────────

function loadAllowlist() {
  if (!existsSync(ALLOWLIST_PATH)) return []
  const parsed = JSON.parse(readFileSync(ALLOWLIST_PATH, 'utf8'))
  if (!Array.isArray(parsed)) {
    throw new Error(`${ALLOWLIST_PATH}: expected an array of { path, identifier, reason }`)
  }
  for (const entry of parsed) {
    if (!entry.path || !entry.identifier || !entry.reason) {
      throw new Error(
        `${ALLOWLIST_PATH}: every entry needs path, identifier and a reason — ` +
          `an entry without a reason is an unexplained hole: ${JSON.stringify(entry)}`
      )
    }
    if ('line' in entry) {
      throw new Error(
        `${ALLOWLIST_PATH}: entries must NOT be keyed by line — lines move and the ` +
          `entry stops matching in silence: ${JSON.stringify(entry)}`
      )
    }
  }
  return parsed
}

const allowKey = (finding) => `${finding.path} ${finding.identifier}`

// ── Report ───────────────────────────────────────────────────────────────────

function groupByFile(findings) {
  const map = new Map()
  for (const finding of findings) {
    if (!map.has(finding.path)) map.set(finding.path, [])
    map.get(finding.path).push(finding)
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
}

function printSection(title, findings, note) {
  if (findings.length === 0) return
  process.stdout.write(`\n${title} (${findings.length})\n`)
  if (note) process.stdout.write(`${note}\n`)
  for (const [path, group] of groupByFile(findings)) {
    process.stdout.write(`\n  ${path}\n`)
    for (const finding of group.sort((a, b) => a.line - b.line)) {
      const attr = finding.attribute ? ` [${finding.attribute} on ${finding.host}]` : ''
      process.stdout.write(`    ${path}:${finding.line}  ${finding.identifier}${attr}\n`)
    }
  }
}

function main() {
  const files = resolveTargets(targets)
  const allowlist = loadAllowlist()
  const allowed = new Set(allowlist.map(allowKey))
  const used = new Set()

  const rendered = []
  const attributes = []
  const freeText = []
  const iframes = []
  const htmlSinks = []

  for (const file of files) {
    const result = auditFile(file)
    // One pass over every section, so an allowlist entry is marked as USED
    // whichever section it silences — otherwise a free-text entry that does its
    // job is reported as stale, and the stale report stops being read.
    const keep = (finding) => {
      const key = allowKey(finding)
      if (!allowed.has(key)) return true
      used.add(key)
      return false
    }
    iframes.push(...result.iframes.filter(keep))
    htmlSinks.push(...result.htmlSinks.filter(keep))
    freeText.push(...result.freeText.filter(keep))
    for (const finding of [...result.rendered, ...result.attributes]) {
      if (!keep(finding)) continue
      ;(finding.attribute ? attributes : rendered).push(finding)
    }
  }

  if (JSON_OUT) {
    process.stdout.write(
      JSON.stringify(
        { files: files.length, rendered, attributes, iframes, htmlSinks, freeText },
        null,
        2
      ) + '\n'
    )
  } else if (!QUIET) {
    process.stdout.write(`pii-audit: ${files.length} .tsx files\n`)
    printSection(
      '🔴 UNMARKED PII RENDERED AS TEXT',
      rendered,
      '   Wrap the container in the markup (KAN-KB-54) — see docs/openreplay-pii-markup.md.'
    )
    printSection(
      '🔴 PII IN AN ATTRIBUTE THE TRACKER DOES NOT MASK',
      attributes,
      '   On a DOM element the value reaches the recording verbatim — attributes are\n' +
        '   NEVER masked outside privateMode. Remove it, or move it into a <Tooltip>\n' +
        '   whose content is a text node. On a COMPONENT, read where the prop lands:\n' +
        '   forwarded to a DOM node (Link, Button) — same fix; rendered as content\n' +
        '   (ModalHeader) — wrap the interpolated part in <Pii> instead.'
    )
    printSection(
      '🔴 <iframe> STILL CAPTURED',
      iframes,
      '   Put the attribute on the <iframe> ITSELF (a wrapper does nothing): the\n' +
        '   whole same-origin document, blob: URLs included, is written into the\n' +
        '   recording otherwise.'
    )
    printSection(
      '🔴 dangerouslySetInnerHTML OUTSIDE ANY MARKED NODE',
      htmlSinks,
      '   Nothing this renders has an identifier the audit could see, so the sink\n' +
        '   itself (or an ancestor) must carry the attribute. Inheritance then covers\n' +
        '   every text node the HTML produces.'
    )
    printSection(
      'ℹ️  free-text candidates (advisory, not part of --check)',
      freeText,
      '   Triage by hand: client/contact/payment prose gets marked up, UI copy goes\n' +
        '   in the allowlist with a reason.'
    )
    if (
      rendered.length === 0 &&
      attributes.length === 0 &&
      iframes.length === 0 &&
      htmlSinks.length === 0
    ) {
      process.stdout.write('\n✅ no unmarked personal data\n')
    }
    const stale = allowlist.filter((e) => !used.has(allowKey(e)) && files.length > 0)
    // Only meaningful on a full run: a scoped run legitimately never reaches
    // most of the allowlist.
    if (targets.length === 0 && stale.length > 0) {
      process.stdout.write(
        `\nℹ️  ${stale.length} allowlist entries matched nothing — the code may have moved on:\n`
      )
      for (const entry of stale) {
        process.stdout.write(`    ${entry.path}  ${entry.identifier}\n`)
      }
    }
  }

  const blocking = rendered.length + attributes.length + iframes.length + htmlSinks.length
  if (CHECK && blocking > 0) {
    process.stderr.write(
      `\npii-audit: ${blocking} unmarked site(s). ` +
        `Mark them up, or add an entry with a reason to scripts/pii-audit.allowlist.json.\n`
    )
    process.exit(1)
  }
}

// Only when run as a command. The module is also imported by its test, and an
// import that audits the whole repository and calls `process.exit` would take
// the test runner with it.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
