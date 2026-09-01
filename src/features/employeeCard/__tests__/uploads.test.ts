/**
 * Anything sent as a file has to say so.
 *
 * The shared client declares ``application/json`` for every request, and that
 * default survives a FormData body: the file goes as multipart bytes labelled
 * JSON, and the server answers 422 because it cannot find a body it can read.
 * The avatar upload already names the type for this reason; these two did not,
 * which is why importing a survey failed and why no document had ever been
 * uploaded.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const post = vi.hoisted(() => vi.fn())

vi.mock('@/lib/api', () => ({ default: { post } }))

const { importSurveys, uploadDocument } = await import('../api/employeeCardApi')

const file = () => new File(['a,b\n1,2\n'], 'answers.csv', { type: 'text/csv' })

/** The options axios was handed on the last call. */
const sentWith = () => post.mock.calls[0][2]

describe('sending a file', () => {
  beforeEach(() => {
    post.mockReset().mockResolvedValue({ data: {} })
  })

  it('imports a survey as multipart, not as JSON', async () => {
    await importSurveys(file(), 'Q2 2024')

    expect(sentWith()?.headers?.['Content-Type']).toBe('multipart/form-data')
  })

  it('uploads a document as multipart, not as JSON', async () => {
    await uploadDocument(7, file())

    expect(sentWith()?.headers?.['Content-Type']).toBe('multipart/form-data')
  })

  it('carries the file and the survey name in the body', async () => {
    await importSurveys(file(), 'Q2 2024')

    const body = post.mock.calls[0][1] as FormData
    expect(body.get('survey_name')).toBe('Q2 2024')
    expect(body.get('file')).toBeInstanceOf(File)
  })
})
