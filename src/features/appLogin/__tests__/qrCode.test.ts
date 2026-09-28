import { describe, expect, it } from 'vitest'
import { encodeQr, type QrMatrix } from '../lib/qrCode'

/**
 * The encoder is pinned module for module against the Python `qrcode` library
 * (8.x, `ERROR_CORRECT_M`, byte mode, `border=0`, `mask_pattern=0..7`): each
 * number below is the FNV-1a of that library's matrix written row by row as
 * `0`/`1`. A single wrong module — a misplaced bit, a wrong ECC byte, a format
 * bit off — changes it, and a phone would not read such a code.
 */
function fnv1a(matrix: QrMatrix): number {
  let hash = 0x811c9dc5
  for (const row of matrix) {
    for (const dark of row) {
      hash ^= dark ? 0x31 : 0x30
      hash = Math.imul(hash, 0x01000193) >>> 0
    }
  }
  return hash
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
/** Byte capacity of versions 1–10 at level M: each text fills its version exactly. */
const CAPACITY = [14, 26, 42, 62, 84, 106, 122, 152, 180, 213]

function filling(version: number): string {
  return Array.from(
    { length: CAPACITY[version - 1] },
    (_, i) => ALPHABET[(i * 7 + version) % ALPHABET.length]
  ).join('')
}

const REFERENCE: Record<number, number[]> = {
  1: [
    0x31c28a4d, 0xaaeca17b, 0x05c621f7, 0x8f537f49, 0x001f972f, 0xdd7468bd, 0xdcafa025, 0x1b5937d7,
  ],
  2: [
    0xf09b91c5, 0xaa9c47f7, 0xf8f0e5c7, 0xe646d739, 0xeb3a91f3, 0x9ba47dae, 0xb0e2de6d, 0xc0bf5bb7,
  ],
  3: [
    0x9b2c0319, 0x6ff90abf, 0xfdf6aef2, 0x317aa765, 0x8e573876, 0x2ede72ce, 0x12b19619, 0x29203c5f,
  ],
  4: [
    0x3a340873, 0x1a316759, 0x02681d78, 0xa4ca8334, 0x7017dc41, 0xcffe851f, 0xc0db948c, 0x763f058e,
  ],
  5: [
    0xbfefa3ed, 0xda4a9687, 0x6117a1ef, 0x4db9795d, 0x885ea2b3, 0x286b4692, 0x395d932d, 0xae212a9b,
  ],
  6: [
    0x7866540b, 0x28afc8e5, 0x3c857c24, 0xf40331cb, 0xc1ba0d34, 0x6a281468, 0xa45436cf, 0xba5cdc75,
  ],
  7: [
    0x5f77b885, 0xa6f59efa, 0x246f36e7, 0x0bac2ec1, 0x82b17bb3, 0x48f1c23d, 0x4efc5e61, 0xf3573b33,
  ],
  8: [
    0x21a4c0b5, 0xf781a52a, 0x464eee07, 0x91457355, 0xb347da37, 0x982cfc8a, 0xcb005ec9, 0x98cb29e7,
  ],
  9: [
    0x1487c52b, 0xcdb56e00, 0xe487052d, 0x2a5c1048, 0x7a2682ed, 0xb5cc5d74, 0x56ab6e70, 0x6620704e,
  ],
  10: [
    0x7f5a3467, 0x36f200f4, 0x3f15afc1, 0x81b86abb, 0x64185885, 0x7cdaa4b7, 0x95be0377, 0x00c52551,
  ],
}

/** The shape of a real `qr_payload` (API-6): 94 bytes → version 6. */
const SIGN_IN_PAYLOAD =
  'prionex-app-login-qr/v1|dev|AbCdEfGhIjKlMnOpQrStUv|0123456789abcdefghijklmnopqrstuvwxyzABCDEFG'
const SIGN_IN_REFERENCE = [
  0x445b1d39, 0xbc252197, 0x3130a986, 0x1a08029d, 0x1c69616e, 0xb531aa76, 0xc8ce612d, 0xe104bef3,
]

describe('encodeQr', () => {
  it.each(Object.entries(REFERENCE))(
    'version %s matches the reference module for module under every mask',
    (version, hashes) => {
      const text = filling(Number(version))
      hashes.forEach((hash, mask) => {
        const matrix = encodeQr(text, { mask })
        expect(matrix).toHaveLength(Number(version) * 4 + 17)
        expect(fnv1a(matrix)).toBe(hash)
      })
    }
  )

  it('draws a sign-in payload as is (version 6) and matches the reference', () => {
    SIGN_IN_REFERENCE.forEach((hash, mask) => {
      expect(fnv1a(encodeQr(SIGN_IN_PAYLOAD, { mask }))).toBe(hash)
    })
  })

  it('encodes the text as UTF-8 bytes', () => {
    expect(fnv1a(encodeQr('Вхід ✓', { mask: 0 }))).toBe(0x1e85402b)
  })

  it('picks the smallest version that holds the text', () => {
    expect(encodeQr(filling(1))).toHaveLength(21)
    expect(encodeQr(`${filling(1)}x`)).toHaveLength(25)
    expect(encodeQr(SIGN_IN_PAYLOAD)).toHaveLength(41)
  })

  it('chooses one of the eight valid masks by itself', () => {
    const auto = fnv1a(encodeQr(SIGN_IN_PAYLOAD))
    expect(SIGN_IN_REFERENCE).toContain(auto)
  })

  it('is deterministic', () => {
    expect(encodeQr(SIGN_IN_PAYLOAD)).toEqual(encodeQr(SIGN_IN_PAYLOAD))
  })

  it('refuses a text longer than version 10-M holds', () => {
    expect(() => encodeQr('x'.repeat(214))).toThrow(RangeError)
  })

  it('has the three finder patterns in the corners', () => {
    const matrix = encodeQr(SIGN_IN_PAYLOAD)
    const size = matrix.length
    const finder = (x0: number, y0: number) =>
      Array.from({ length: 7 }, (_, dy) =>
        Array.from({ length: 7 }, (_, dx) => (matrix[y0 + dy][x0 + dx] ? '#' : '.')).join('')
      )
    const expected = ['#######', '#.....#', '#.###.#', '#.###.#', '#.###.#', '#.....#', '#######']
    expect(finder(0, 0)).toEqual(expected)
    expect(finder(size - 7, 0)).toEqual(expected)
    expect(finder(0, size - 7)).toEqual(expected)
  })
})
