/**
 * Reading the field a rule was refused over.
 *
 * The rules endpoints answer 409/422 with ``detail: {message, field}``, but
 * FastAPI's own validation — a keyword past the length limit — answers with a
 * list of error objects instead. The form shows one inline message either way,
 * so both shapes have to arrive here as the same thing.
 */

import { describe, it, expect } from 'vitest'
import { fieldErrorOf } from '../hooks/useDocumentImportRules'

describe('fieldErrorOf', () => {
  it('reads the backend’s own message and field', () => {
    expect(
      fieldErrorOf({
        response: {
          data: {
            detail: { message: 'This keyword is already used in credits/', field: 'keyword' },
          },
        },
      })
    ).toEqual({ message: 'This keyword is already used in credits/', field: 'keyword' })
  })

  it('reads a FastAPI validation error, keeping the field it is about', () => {
    expect(
      fieldErrorOf({
        response: {
          data: {
            detail: [
              {
                type: 'value_error',
                loc: ['body', 'keyword'],
                msg: 'Value error, Keyword must be at most 40 characters',
              },
            ],
          },
        },
      })
    ).toEqual({ message: 'Keyword must be at most 40 characters', field: 'keyword' })
  })

  it('drops a field the form does not render, so the message reaches a toast', () => {
    // A model-level validator answers ["body"], a path parameter ["path", ...].
    // Keeping either as the field would file the error against an input that
    // is never drawn, and the person would be shown nothing at all.
    expect(
      fieldErrorOf({
        response: {
          data: {
            detail: [
              { type: 'value_error', loc: ['body'], msg: 'Value error, Send at least one field' },
            ],
          },
        },
      })
    ).toEqual({ message: 'Send at least one field', field: undefined })

    expect(
      fieldErrorOf({
        response: {
          data: {
            detail: [
              { type: 'int_parsing', loc: ['path', 'rule_id'], msg: 'Input should be an integer' },
            ],
          },
        },
      })
    ).toEqual({ message: 'Input should be an integer', field: undefined })
  })

  it('drops an unknown field from an object detail too', () => {
    expect(
      fieldErrorOf({
        response: { data: { detail: { message: 'Refused', field: 'folder' } } },
      })
    ).toEqual({ message: 'Refused', field: undefined })
  })

  it('keeps a plain string detail, with no field to blame', () => {
    expect(fieldErrorOf({ response: { data: { detail: 'Rule not found' } } })).toEqual({
      message: 'Rule not found',
    })
  })

  it('has nothing to say about a network failure', () => {
    expect(fieldErrorOf(new Error('Network Error'))).toBeNull()
    expect(fieldErrorOf(undefined)).toBeNull()
    expect(fieldErrorOf({ response: { data: {} } })).toBeNull()
  })
})
