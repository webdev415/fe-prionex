#!/usr/bin/env node
/**
 * Generate `docs/prod-releases.md`'s table from `action_run`.
 *
 * Story 6.12 / `#d51`. This file replaces a HUMAN TRANSCRIPTION step, not a human decision:
 * eight of the ledger's ten columns are already recorded by the Forgejo instance and readable
 * over the REST API, and `action_run` rows are NOT job logs -- which matters, because a record
 * that lives only in a job log is the exact thing this ledger exists to avoid (six
 * `log_in_storage=f` observations across Stories 5.3/5.4).
 *
 * 🔴 "GENERATED" DOES NOT MEAN "COMMITTED AUTOMATICALLY". `#d51` §2 measured that `main` carries
 * `enable_push: false` with an EMPTY push whitelist -- a direct push is refused for every
 * account, admin included -- so no workflow can commit this file and the repository-write
 * credential Story 5.4 declined would not have helped. A person runs this and merges the diff.
 * The human act shrinks from "type ten cells correctly" to "run one command and read a diff".
 *
 * Read scope is enough. Never hand this the registry RW token.
 *
 *   FORGEJO_TOKEN=$(tr -d '"\r\n' < ~/.config/forgejo/token) npm run ledger:prod
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'

const HOST = process.env.FORGEJO_HOST ?? 'git.crm-prionex.com'
const REPO = process.env.FORGEJO_REPO ?? 'CRM/fe-prionex'
const WORKFLOW = 'deploy-prod.yml'
const LEDGER = 'docs/prod-releases.md'
const ANNOTATIONS = 'docs/prod-releases-annotations.json'
const BEGIN =
  '<!-- BEGIN GENERATED LEDGER -- do not edit between these markers; see scripts/gen-prod-ledger.mjs -->'
const END = '<!-- END GENERATED LEDGER -->'

/**
 * 🔴 THE EPOCH. Everything before this instant is EXCLUDED, and that is not a tidiness
 * preference -- it is the difference between a release ledger and a fabricated one.
 *
 * As of 2026-08-27 there are 21 `deploy-prod.yml` dispatches in `action_run` and EVERY ONE of
 * them is a rehearsal or a proof, not a release: `#d47` and `#d48` say so in those words, and
 * `docs/prod-releases.md` states on its own face that no production release has ever been
 * approved. A generator without this cut would manufacture a 21-row release history into a file
 * that says it has none.
 *
 * The instant is the merge of `#d51` -- commit 89ddca51, `2026-08-27T13:58:58+02:00`. That is
 * the correct boundary on the merits and not merely a convenient one: "the dispatch IS the
 * approval" became true when that commit landed. Every one of the 21 predates it by hours (the
 * latest, run 705, started 08:58:22Z).
 */
const LEDGER_EPOCH = new Date('2026-08-27T11:58:58Z')

const SELF_TEST = process.argv.includes('--self-test')
const token = process.env.FORGEJO_TOKEN
if (!token && !SELF_TEST)
  die('FORGEJO_TOKEN is not set. Read scope is enough; never use the registry RW token.')

function die(msg) {
  console.error(`FAIL: ${msg}`)
  process.exit(1)
}

async function api(path) {
  const res = await fetch(`https://${HOST}/api/v1${path}`, {
    headers: { Authorization: `token ${token}`, Accept: 'application/json' },
  })
  if (!res.ok)
    die(`GET ${path} -> HTTP ${res.status}. Refusing to render a ledger from a failed read.`)
  return res.json()
}

/**
 * Walk to natural termination.
 *
 * 🔴 `limit` CAPS AT 50 on this instance no matter what is requested -- asking for 500 returns
 * 50. In this project a truncated read has produced a WRONG CONCLUSION five times, once making
 * every registry marker look deleted. A silently short RELEASE LEDGER is the worst instance of
 * that class, so the walked count is asserted against the server's own `total_count` and a
 * mismatch is fatal rather than cosmetic.
 */
async function fetchAllRuns() {
  const runs = []
  let reported = null
  for (let page = 1; page <= 500; page++) {
    const d = await api(`/repos/${REPO}/actions/runs?limit=50&page=${page}`)
    if (reported === null) reported = d.total_count ?? null
    const batch = d.workflow_runs ?? []
    if (batch.length === 0) break
    runs.push(...batch)
  }
  assertComplete(runs.length, reported)
  return { runs, reported }
}

/**
 * `event` IS USELESS AS A FILTER AND MUST NOT BE REINTRODUCED AS ONE.
 *
 * Measured across every run in this repository: the count reporting
 * `event === 'workflow_dispatch'` is ZERO. Dispatches report `event: ""`. Filtering on it yields
 * an EMPTY ledger that looks exactly like "no releases yet". The discriminator is the presence
 * of an `inputs` key in the parsed `event_payload`.
 *
 * (Inside a workflow `github.event_name` IS correct -- `#d21` measured that on run 631. This is
 * an API-projection quirk, not a platform-wide one.)
 */
function dispatchInputs(run) {
  if (!run.event_payload) return null
  let payload
  try {
    payload = JSON.parse(run.event_payload) // a JSON string inside JSON -- parse, never regex
  } catch {
    return null
  }
  return payload && typeof payload.inputs === 'object' && payload.inputs !== null
    ? payload.inputs
    : null
}

/**
 * 🔴 THE INPUT WAS RENAMED MID-HISTORY AND BOTH NAMES MUST BE READ.
 *
 * Runs 629-640 carry `inputs.image_tag`; runs 642 onward carry `inputs.tag`. That is `#d47`(3)'s
 * fix -- `deploy-prod.yml` renamed its own dispatch input specifically so it could not shadow
 * the callee's -- landing between runs 640 and 642. Reading only one name silently blanks six
 * runs or fifteen, with no error anywhere.
 */
function releaseTag(inputs) {
  return inputs.tag ?? inputs.image_tag ?? null
}

const HEX12 = /^sha-([0-9a-f]{12})-prod$/

function candidateMarker(tag) {
  // `#d18` §3: the short SHA is EXACTLY 12 hex, and Stories 5.4/6.3/6.5/6.6 are all bound to that
  // width. Anything else is not derivable and says so rather than guessing.
  const m = tag && HEX12.exec(tag)
  return m ? `preprod-${m[1]}` : '—'
}

function isoDate(ts) {
  if (!ts || String(ts).startsWith('0001')) return '—'
  return new Date(ts).toISOString().replace('T', ' ').slice(0, 19) + 'Z'
}

function cell(v) {
  // A pipe would shift every later column -- the rule `docs/prod-releases.md` already states for
  // its own Note column.
  return String(v ?? '')
    .replaceAll('|', '/')
    .replaceAll('\n', ' ')
    .trim()
}

function loadAnnotations() {
  if (!existsSync(ANNOTATIONS)) return {}
  try {
    return JSON.parse(readFileSync(ANNOTATIONS, 'utf8'))
  } catch (e) {
    die(`${ANNOTATIONS} exists but is not valid JSON (${e.message}). Refusing to guess.`)
  }
}

function render(rows) {
  const head =
    '| Date (UTC) | image_tag | Candidate | prod_tag | Dispatched by (account) | Waiver? | Dispatch start (UTC) | Deploy end (UTC) | Deploy run id | Note |\n' +
    '|---|---|---|---|---|---|---|---|---|---|'
  if (rows.length === 0) return head
  return [head, ...rows].join('\n')
}

/**
 * The whole transformation, kept PURE so `--self-test` can exercise the paths no real run can
 * reach today. As of 2026-08-27 the only live path is "everything is pre-epoch, render nothing"
 * (21 of 21), so every other branch below is exercised by fixture and is LABELLED AS SUCH in the
 * story's outcome matrix. A synthetic pass is not a live row.
 */
export function buildRows(runs, ann) {
  let examined = 0
  let preEpoch = 0
  let noTag = 0
  const rows = []

  for (const run of runs) {
    if (run.workflow_id !== WORKFLOW) continue
    const inputs = dispatchInputs(run)
    if (!inputs) continue
    examined++

    const started =
      run.started && !String(run.started).startsWith('0001') ? new Date(run.started) : null
    if (!started || started < LEDGER_EPOCH) {
      preEpoch++
      continue
    }

    const tag = releaseTag(inputs)
    if (!tag) {
      // Not silently blanked -- see `releaseTag`'s comment. Reported and still rendered.
      noTag++
      console.warn(
        `WARN: run ${run.index_in_repo} carries neither \`tag\` nor \`image_tag\` in its inputs. ` +
          `Keys present: ${Object.keys(inputs).join(', ') || '<none>'}`
      )
    }

    const rollback = String(inputs.rollback ?? 'false') === 'true'
    const a = ann[String(run.index_in_repo)] ?? {}
    const note = [
      rollback
        ? '**ROLLBACK** — restoring a tag already recorded here is not a new release and needs no new approval (see the regulation). NOT an approval row.'
        : '',
      cell(a.note),
    ]
      .filter(Boolean)
      .join(' ')

    rows.push(
      '| ' +
        [
          isoDate(run.started).slice(0, 10),
          '`' + cell(tag ?? '—') + '`',
          '`' + candidateMarker(tag) + '`',
          '`' + cell(tag ?? '—') + '`',
          cell(run.trigger_user?.login ?? '—'),
          cell(a.waiver ?? ''),
          isoDate(run.started),
          isoDate(run.stopped),
          String(run.index_in_repo), // 🔴 index_in_repo, NOT id: run 705 is API id 1618
          note,
        ].join(' | ') +
        ' |'
    )
  }

  rows.reverse() // oldest first -- an append-only ledger reads forward in time
  return { rows, examined, preEpoch, noTag }
}

export function assertComplete(walked, reported) {
  if (reported !== null && walked !== reported) {
    die(
      `walked ${walked} runs but the server reports total_count=${reported}. ` +
        `A short read here means a short RELEASE LEDGER. Refusing to render.`
    )
  }
}

async function main() {
  const { runs, reported } = await fetchAllRuns()
  const { rows, examined, preEpoch, noTag } = buildRows(runs, loadAnnotations())

  const before = readFileSync(LEDGER, 'utf8')
  const i = before.indexOf(BEGIN)
  const j = before.indexOf(END)
  if (i === -1 || j === -1 || j < i) {
    die(
      `${LEDGER} is missing the generated-region markers. Refusing to overwrite the whole file: ` +
        `everything outside those markers is hand-written prose that #d51 rewrote, and losing it ` +
        `is far worse than an unrendered table.`
    )
  }
  const after = before.slice(0, i + BEGIN.length) + '\n\n' + render(rows) + '\n\n' + before.slice(j)

  const changed = after !== before
  if (changed) writeFileSync(LEDGER, after)

  console.log(`dispatches examined : ${examined}`)
  console.log(
    `excluded, pre-epoch : ${preEpoch}   (epoch ${LEDGER_EPOCH.toISOString()}, commit 89ddca51)`
  )
  console.log(`rows rendered       : ${rows.length}`)
  if (noTag) console.log(`⚠️  runs with neither input name: ${noTag}`)
  console.log(`total runs walked   : ${runs.length} (server reported ${reported})`)
  console.log(`${LEDGER}           : ${changed ? 'UPDATED' : 'unchanged'}`)
  console.log(
    `sha256(prose+table) : ${createHash('sha256').update(after).digest('hex').slice(0, 16)}`
  )

  if (rows.length === 0) {
    console.log('')
    console.log('An EMPTY ledger is the correct output today, and the counts above are why:')
    console.log(
      `every one of the ${examined} dispatches predates the epoch. They are rehearsals and`
    )
    console.log('proofs, recorded in #d47 and #d48 -- deliberately not rows here. This is not')
    console.log('"found nothing".')
  }
}

if (SELF_TEST) {
  const { selfTest } = await import('./gen-prod-ledger.selftest.mjs')
  process.exit(
    selfTest({
      buildRows,
      assertComplete,
      releaseTag,
      dispatchInputs,
      candidateMarker,
      cell,
      LEDGER_EPOCH,
    })
  )
}

await main()
