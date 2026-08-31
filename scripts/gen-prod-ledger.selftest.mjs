/**
 * Fixtures for the paths no real run can reach yet.
 *
 * 🔴 As of 2026-08-27 the ONLY live path is "all 21 dispatches are pre-epoch, render nothing".
 * Everything below is exercised by fixture. A synthetic pass is NOT a live row and the story's
 * outcome matrix labels it that way. This file exists so those branches are exercised at all --
 * not so they can be graded as proven.
 */
const AFTER = '2026-08-28T09:00:00+02:00' // comfortably after the epoch
const BEFORE = '2026-08-27T08:58:22+02:00' // run 705's real start -- pre-epoch

function run(idx, inputs, extra = {}) {
  return {
    index_in_repo: idx,
    workflow_id: 'deploy-prod.yml',
    event: '', // every dispatch reports this -- the reason `event` is never the filter
    event_payload: JSON.stringify({ inputs, ref: 'refs/heads/main' }),
    trigger_user: { login: 'platform-admin' },
    started: AFTER,
    stopped: AFTER,
    ...extra,
  }
}

export function selfTest(m) {
  const { buildRows, releaseTag, dispatchInputs, candidateMarker, cell } = m
  let failed = 0
  const check = (name, cond, detail = '') => {
    console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${name}${cond ? '' : '   <- ' + detail}`)
    if (!cond) failed++
  }

  // ── the input rename, #d47(3): runs 629-640 vs 642-705 ────────────────────────────────────
  check(
    'legacy `image_tag` is read',
    releaseTag({ image_tag: 'sha-aaaaaaaaaaaa-prod' }) === 'sha-aaaaaaaaaaaa-prod'
  )
  check(
    'current `tag` is read',
    releaseTag({ tag: 'sha-bbbbbbbbbbbb-prod' }) === 'sha-bbbbbbbbbbbb-prod'
  )
  check('`tag` wins when both are present', releaseTag({ tag: 'T', image_tag: 'I' }) === 'T')
  check('neither name yields null, not a crash', releaseTag({ rollback: 'true' }) === null)

  // ── `event` is never the filter ───────────────────────────────────────────────────────────
  check('an empty `event` still yields inputs', dispatchInputs(run(1, { tag: 'x' })) !== null)
  check(
    'a payload with no `inputs` is rejected',
    dispatchInputs({ event_payload: '{"ref":"x"}' }) === null
  )
  check(
    'unparseable payload is rejected, not thrown',
    dispatchInputs({ event_payload: '{oops' }) === null
  )

  // ── #d18 §3: exactly 12 hex ───────────────────────────────────────────────────────────────
  check(
    '12 hex derives the marker',
    candidateMarker('sha-a99ccd44c5a3-prod') === 'preprod-a99ccd44c5a3'
  )
  check(
    '40 hex does not (run 643 shape)',
    candidateMarker('sha-a99ccd44c5a39345fa65eb74e87343b187e129e9-prod') === '—'
  )
  check('a record tag does not (run 644 shape)', candidateMarker('prod-current') === '—')

  // ── the pipe rule ─────────────────────────────────────────────────────────────────────────
  check('a pipe cannot shift a column', !cell('a | b').includes('|'))
  check('a newline cannot shift a row', !cell('a\nb').includes('\n'))

  // ── the epoch ─────────────────────────────────────────────────────────────────────────────
  {
    const r = buildRows(
      [run(900, { tag: 'sha-cccccccccccc-prod' }, { started: BEFORE, stopped: BEFORE })],
      {}
    )
    check(
      'a pre-epoch dispatch is excluded and counted',
      r.rows.length === 0 && r.preEpoch === 1 && r.examined === 1,
      JSON.stringify({ rows: r.rows.length, preEpoch: r.preEpoch, examined: r.examined })
    )
  }
  {
    const r = buildRows([run(901, { tag: 'sha-dddddddddddd-prod', rollback: 'false' })], {})
    check('a post-epoch release renders one row', r.rows.length === 1 && r.preEpoch === 0)
    check('the row carries index_in_repo, not an API id', r.rows[0]?.includes('| 901 |'), r.rows[0])
    check('a non-rollback row is not labelled ROLLBACK', !r.rows[0]?.includes('ROLLBACK'))
  }
  {
    const r = buildRows([run(902, { tag: 'sha-eeeeeeeeeeee-prod', rollback: 'true' })], {})
    check('a rollback is emitted, not omitted', r.rows.length === 1)
    check('a rollback is labelled', r.rows[0]?.includes('**ROLLBACK**'), r.rows[0])
  }
  {
    const r = buildRows([run(903, { tag: 'sha-ffffffffffff-prod' })], {
      903: { waiver: 'D40, single-candidate, expires 2026-09-01', note: 'annotated by hand' },
    })
    check(
      'the side-file merges by run id',
      r.rows[0]?.includes('D40, single-candidate') && r.rows[0]?.includes('annotated by hand'),
      r.rows[0]
    )
  }
  {
    const r = buildRows([run(904, { tag: 'sha-999999999999-prod' })], {})
    check(
      'a run with NO side-file entry renders empty cells and does not fail',
      r.rows.length === 1 && r.rows[0].includes('|  |'),
      r.rows[0]
    )
  }
  {
    const r = buildRows([run(905, { rollback: 'true' })], {})
    check(
      'a run with neither input name is REPORTED, not silently blanked',
      r.noTag === 1 && r.rows.length === 1,
      JSON.stringify({ noTag: r.noTag, rows: r.rows.length })
    )
  }
  {
    // 🔴 The API returns runs NEWEST FIRST (measured: page 1 descends 1655, 1646, 1645...), which
    // is why the generator reverses. The fixture must therefore be supplied in API order --
    // 907 then 906 -- or the assertion below tests nothing.
    // An earlier draft of this check read `... ? true : true` and could not fail. Caught before
    // shipping; this project has withdrawn a can-never-fail comparison once already (`#d48`).
    const r = buildRows(
      [run(907, { tag: 'sha-222222222222-prod' }), run(906, { tag: 'sha-111111111111-prod' })],
      {}
    )
    check('both rows render', r.rows.length === 2)
    check(
      'rows read forward in time -- oldest first, API order reversed',
      r.rows[0].includes('| 906 |') && r.rows[1].includes('| 907 |'),
      JSON.stringify(r.rows.map((x) => x.slice(-14)))
    )
  }
  {
    // The short-read assertion. Extracted from `fetchAllRuns` precisely so it can be exercised
    // without a stub server: a short RELEASE LEDGER is the worst instance of the truncation
    // class that has produced a wrong conclusion five times in this project.
    let died = false
    const realExit = process.exit
    const realErr = console.error
    process.exit = () => {
      died = true
      throw new Error('__died__')
    }
    console.error = () => {}
    try {
      m.assertComplete(700, 733)
    } catch (e) {
      if (e.message !== '__died__') throw e
    } finally {
      process.exit = realExit
      console.error = realErr
    }
    check('a walked/total_count mismatch is FATAL, not cosmetic', died)
    m.assertComplete(733, 733)
    check('a matching count passes', true)
  }
  {
    const r = buildRows([{ ...run(908, { tag: 'x' }), workflow_id: 'ci.yml' }], {})
    check('another workflow is not a release', r.rows.length === 0 && r.examined === 0)
  }

  console.log(failed === 0 ? '\nself-test: all fixtures pass' : `\nself-test: ${failed} FAILED`)
  return failed === 0 ? 0 : 1
}
