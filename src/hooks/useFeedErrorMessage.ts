import { useTranslation } from 'react-i18next'
import { isTransientFailure } from '@/lib/api'
import { getErrorMessage, getErrorStatus, hasResponseDetail } from '@/lib/errors'

/**
 * Every report tab's i18n section, and the ONLY prefixes this hook may be
 * asked for.
 *
 * A tab reads its prefix from here rather than writing the string at the call
 * site, and the parameter type below is the union of these VALUES — so a
 * thirteenth tab cannot invent `pages.reports.newFeed` in passing; it has to
 * add it here, where `feedErrorKeys.test.ts` will immediately demand the four
 * keys in both dictionaries.
 *
 * That test is the actual point of this constant, and the reason it is not
 * just a `string` parameter. The hook builds its keys by CONCATENATION
 * (`${prefix}.unavailable`), which is invisible to a static key scanner — the
 * kind of key `pages/Credit/__tests__/i18nKeys.test.ts` deliberately skips —
 * so a typo would not fail a build, it would put `pages.reports.promisesFeeed.
 * unavailable` in front of an operator. Before this hook every one of those
 * keys was a literal in a tab and a reader could grep it; the extraction is
 * what creates the hole, so it also brings the gate.
 *
 * Keyed by tab, not an array, so the call site reads as a name
 * (`FEED_ERROR_KEY_PREFIXES.callbacksFeed`) and a prefix belonging to the
 * WRONG tab is visible in review. The keys are the locale section names, which
 * are not always the feature-folder names (`lowVerification`, `processing`,
 * `verification`) — the sections are older than the folders and renaming one
 * would touch both dictionaries for nothing.
 */
export const FEED_ERROR_KEY_PREFIXES = {
  processing: 'pages.reports.processing',
  verification: 'pages.reports.verification',
  lowVerification: 'pages.reports.lowVerification',
  searcherFollowup: 'pages.reports.searcherFollowup',
  inboundFollowup: 'pages.reports.inboundFollowup',
  contactTag: 'pages.reports.contactTag',
  communicationGap: 'pages.reports.communicationGap',
  operatorPromises: 'pages.reports.operatorPromises',
  outboundCalls: 'pages.reports.outboundCalls',
  promisesDaily: 'pages.reports.promisesDaily',
  promisesFeed: 'pages.reports.promisesFeed',
  callbacksFeed: 'pages.reports.callbacksFeed',
} as const

/** A prefix that exists in the registry — see the constant's docstring. */
export type FeedErrorKeyPrefix =
  (typeof FEED_ERROR_KEY_PREFIXES)[keyof typeof FEED_ERROR_KEY_PREFIXES]

export interface FeedErrorMessage {
  /** Ready to render: localized, or the server's own sentence on a 400. */
  errorMessage: string
  /** The server's sentence to show UNDER the message, or null. */
  errorDetail: string | null
  /** 403 — the tab hides its retry button, retrying cannot help. */
  isForbidden: boolean
}

/**
 * The failure ladder every report tab walks, in one place.
 *
 * Twelve tabs turned the same `query.error` into the same four outcomes —
 * nine with three predicates, three with two (see the behaviour change below)
 * — in near-identical ten-line blocks. The rungs are
 * not tab knowledge — they are how THIS client reads THIS backend's failures —
 * and twelve copies of a four-branch rule is twelve places to disagree the day
 * a rung moves. What IS tab knowledge (which 503s an endpoint words, whether
 * the server's sentence is fit to show) stays in the tabs.
 *
 * THE RUNGS, in evaluation order:
 *
 * 1. transient (`isTransientFailure`) → the tab's «temporarily unavailable»;
 * 2. 403 → the tab's «no permission» (and `isForbidden`, so the tab can drop
 *    its retry button — retrying a permission is pointless);
 * 3. 400 WITH a detail → the server's own sentence, verbatim and untranslated;
 * 4. anything else → the tab's generic localized title.
 *
 * ORDER IS NOT LOAD-BEARING TODAY, which is worth stating because it looks
 * like it is. `isTransientFailure` (api.ts) is true only for 502/503/504 or
 * for a network code with NO response at all, and `getErrorStatus` reports a
 * status only when there IS a response — so "transient" and "400 or 403"
 * cannot both hold, and no reordering of rungs 1-3 could change an outcome.
 * That is a fact about `TRANSIENT_RETRY_STATUSES`, i.e. about somebody else's
 * set: add 429 to it and the rungs start overlapping. The cross-product is
 * pinned as a table in this hook's suite (including 500, which is NOT
 * transient — "simplifying" the predicate to `status >= 500` would change what
 * all twelve tabs show, at once), so the day that set moves, the table says so.
 *
 * WHY THE 400 IS GATED ON `hasResponseDetail` and not on the status alone:
 * `getErrorMessage` has no concept of "nothing to say" — with a body-less 400
 * (a proxy that stripped it) it degrades to axios' own untranslated "Request
 * failed with status code 400", which is not a sentence to put in front of a
 * Ukrainian-speaking operator. The gate is the whole reason that predicate
 * exists (`lib/errors.ts`, which explains it line by line).
 *
 * ⚠️ THIS UNIFIES A REAL DIVERGENCE. Nine tabs gated their 400 on the
 * predicate; three — client processing, low-verification and third-party
 * verification — checked only `errorStatus === 400` and so did show the axios
 * sentence on a body-less 400. Adopting the gate everywhere CHANGES what those
 * three show, deliberately: that was a defect, not a local design, and their
 * three suites each pin the new behaviour with a test written for this change
 * (their existing 400 tests all send a detail, so they would have stayed green
 * either way — which is exactly why the new ones had to be written).
 *
 * NOT MEMOIZED, and that is not an oversight. `t()` runs during render, so a
 * language switch — which happens WITHOUT a remount on this page — re-renders
 * the tab and re-translates the message for free. Caching the result on
 * `[error, keyPrefix]` would leave the previous language's sentence on screen
 * until the query failed again. The suite pins that with a render under a
 * changed translator.
 *
 * `errorDetail` IS RETURNED, NOT RENDERED. Seven tabs show the server's 503
 * sentence under the localized one (the flavours differ and whoever is asked
 * "what does it say?" needs to tell an outage from a timeout); five do not —
 * the communication-gap and contact-tag feeds by an explicit decision, because
 * their 503 texts are worded for the people who run the services and name
 * internal knobs, and client-processing, low-verification and third-party
 * verification because they never had the branch at all. That is a rendering decision, and it stays in the JSX of the tab that
 * makes it — a flag here would move it into a hook that renders nothing.
 * It is a separate field for the same reason it is never translated: it is the
 * SERVER's string, and concatenating it into the localized one would produce a
 * sentence half in each language.
 *
 * @param error `query.error` — the whole query object would be a wider
 *   contract than the one thing this reads, and would tie the hook to the
 *   query client's generics.
 * @param keyPrefix the tab's i18n section, from `FEED_ERROR_KEY_PREFIXES`.
 */
export function useFeedErrorMessage(
  error: unknown,
  keyPrefix: FeedErrorKeyPrefix
): FeedErrorMessage {
  const { t } = useTranslation('common')

  const status = getErrorStatus(error)
  const isForbidden = status === 403
  const isUnavailable = isTransientFailure(error)
  const hasDetail = hasResponseDetail(error)

  const errorMessage = isUnavailable
    ? t(`${keyPrefix}.unavailable`)
    : isForbidden
      ? t(`${keyPrefix}.forbidden`)
      : status === 400 && hasDetail
        ? getErrorMessage(error)
        : t(`${keyPrefix}.error.title`)

  return {
    errorMessage,
    // Absent when the failure carries no usable body — a dropped connection,
    // or a gateway error whose body came from the proxy and not from our
    // service. A 502 WITH a service detail does quote it (pinned in the
    // suite); the status alone decides nothing here.
    errorDetail: isUnavailable && hasDetail ? getErrorMessage(error) : null,
    isForbidden,
  }
}
