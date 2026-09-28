/*!
 * @license MIT
 * Derived from QR Code generator library (TypeScript),
 * Copyright (c) Project Nayuki (MIT License),
 * https://www.nayuki.io/page/qr-code-generator-library
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 * - The above copyright notice and this permission notice shall be included in
 *   all copies or substantial portions of the Software.
 * - The Software is provided "as is", without warranty of any kind, express or
 *   implied, including but not limited to the warranties of merchantability,
 *   fitness for a particular purpose and noninfringement. In no event shall the
 *   authors or copyright holders be liable for any claim, damages or other
 *   liability, whether in an action of contract, tort or otherwise, arising from,
 *   out of or in connection with the Software or the use or other dealings in the
 *   Software.
 */

/**
 * A QR code encoder for the sign-in QR (Epic 19 API-6, story 19.17) — byte
 * mode, error correction level M, versions 1–10 (up to 213 bytes; a sign-in
 * `qr_payload` is about 100). The CRM web has no QR library, and the QR must
 * not come from an external service: it carries a live single-use secret.
 *
 * The steps follow ISO/IEC 18004 in the order of Project Nayuki's reference
 * generator (MIT, notice above): function patterns, data + Reed–Solomon blocks, zigzag
 * placement, the mask with the lowest penalty, format and version bits. The
 * matrices are pinned in the tests against the Python `qrcode` library.
 *
 * The text is encoded as UTF-8 bytes, unchanged — the phone compares it
 * character for character with what the server issued.
 */

/** `modules[y][x]`, `true` = dark. No quiet zone: the renderer adds it. */
export type QrMatrix = boolean[][]

export const QR_MAX_VERSION = 10

/** Error correction level M, index = version (1–10). */
const ECC_CODEWORDS_PER_BLOCK = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26]
const NUM_ERROR_CORRECTION_BLOCKS = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5]
/** Level M in the format bits (L = 1, M = 0, Q = 3, H = 2). */
const FORMAT_BITS_M = 0

const PENALTY_N1 = 3
const PENALTY_N2 = 3
const PENALTY_N3 = 40
const PENALTY_N4 = 10

function bit(value: number, index: number): boolean {
  return ((value >>> index) & 1) !== 0
}

/** Data modules of a version, function patterns and format/version bits excluded. */
function rawDataModules(version: number): number {
  let result = (16 * version + 128) * version + 64
  if (version >= 2) {
    const numAlign = Math.floor(version / 7) + 2
    result -= (25 * numAlign - 10) * numAlign - 55
    if (version >= 7) result -= 36
  }
  return result
}

function dataCodewords(version: number): number {
  return (
    Math.floor(rawDataModules(version) / 8) -
    ECC_CODEWORDS_PER_BLOCK[version] * NUM_ERROR_CORRECTION_BLOCKS[version]
  )
}

function alignmentPositions(version: number, size: number): number[] {
  if (version === 1) return []
  const numAlign = Math.floor(version / 7) + 2
  const step = Math.floor((version * 8 + numAlign * 3 + 5) / (numAlign * 4 - 4)) * 2
  const result = [6]
  for (let pos = size - 7; result.length < numAlign; pos -= step) result.splice(1, 0, pos)
  return result
}

// ── Reed–Solomon over GF(2^8), polynomial 0x11D ─────────────────────────────

function gfMultiply(x: number, y: number): number {
  let z = 0
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d)
    z ^= ((y >>> i) & 1) * x
  }
  return z
}

function rsDivisor(degree: number): number[] {
  const result: number[] = new Array<number>(degree - 1).fill(0)
  result.push(1)
  let root = 1
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = gfMultiply(result[j], root)
      if (j + 1 < result.length) result[j] ^= result[j + 1]
    }
    root = gfMultiply(root, 0x02)
  }
  return result
}

function rsRemainder(data: readonly number[], divisor: readonly number[]): number[] {
  const result = divisor.map(() => 0)
  for (const byte of data) {
    const factor = byte ^ (result.shift() as number)
    result.push(0)
    divisor.forEach((coefficient, i) => {
      result[i] ^= gfMultiply(coefficient, factor)
    })
  }
  return result
}

// ── Data codewords ──────────────────────────────────────────────────────────

/** Mode indicator, character count, the bytes, terminator and padding. */
function dataCodewordsOf(bytes: Uint8Array, version: number): number[] {
  const capacityBits = dataCodewords(version) * 8
  const bits: number[] = []
  const push = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1)
  }
  push(0b0100, 4)
  push(bytes.length, version <= 9 ? 8 : 16)
  bytes.forEach((byte) => push(byte, 8))
  push(0, Math.min(4, capacityBits - bits.length))
  push(0, (8 - (bits.length % 8)) % 8)
  for (let pad = 0xec; bits.length < capacityBits; pad ^= 0xec ^ 0x11) push(pad, 8)

  const codewords: number[] = []
  for (let i = 0; i < bits.length; i += 8) {
    codewords.push(bits.slice(i, i + 8).reduce((byte, b) => (byte << 1) | b, 0))
  }
  return codewords
}

/** Split into blocks, append each block's ECC, interleave. */
function withEccInterleaved(data: readonly number[], version: number): number[] {
  const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[version]
  const blockEccLen = ECC_CODEWORDS_PER_BLOCK[version]
  const rawCodewords = Math.floor(rawDataModules(version) / 8)
  const numShortBlocks = numBlocks - (rawCodewords % numBlocks)
  const shortBlockLen = Math.floor(rawCodewords / numBlocks)
  const divisor = rsDivisor(blockEccLen)

  const blocks: number[][] = []
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const block = data.slice(k, k + shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1))
    k += block.length
    const ecc = rsRemainder(block, divisor)
    if (i < numShortBlocks) block.push(0)
    blocks.push(block.concat(ecc))
  }

  const result: number[] = []
  for (let i = 0; i < blocks[0].length; i++) {
    blocks.forEach((block, j) => {
      // The placeholder byte of a short block is not a codeword.
      if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) result.push(block[i])
    })
  }
  return result
}

// ── The matrix ──────────────────────────────────────────────────────────────

class QrGrid {
  readonly version: number
  readonly size: number
  readonly modules: QrMatrix
  readonly isFunction: boolean[][]

  constructor(version: number) {
    this.version = version
    const size = version * 4 + 17
    this.size = size
    this.modules = Array.from({ length: size }, () => new Array<boolean>(size).fill(false))
    this.isFunction = Array.from({ length: size }, () => new Array<boolean>(size).fill(false))
  }

  setFunction(x: number, y: number, dark: boolean) {
    this.modules[y][x] = dark
    this.isFunction[y][x] = true
  }

  drawFunctionPatterns() {
    const { size } = this
    for (let i = 0; i < size; i++) {
      this.setFunction(6, i, i % 2 === 0)
      this.setFunction(i, 6, i % 2 === 0)
    }
    this.drawFinder(3, 3)
    this.drawFinder(size - 4, 3)
    this.drawFinder(3, size - 4)

    const positions = alignmentPositions(this.version, size)
    const last = positions.length - 1
    positions.forEach((cx, i) => {
      positions.forEach((cy, j) => {
        // The three corners hold the finder patterns.
        if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            this.setFunction(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1)
          }
        }
      })
    })

    this.drawFormatBits(0) // reserves the area; redrawn with the chosen mask
    this.drawVersionBits()
  }

  drawFinder(cx: number, cy: number) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx
        const y = cy + dy
        const distance = Math.max(Math.abs(dx), Math.abs(dy))
        if (x >= 0 && x < this.size && y >= 0 && y < this.size) {
          this.setFunction(x, y, distance !== 2 && distance !== 4)
        }
      }
    }
  }

  drawFormatBits(mask: number) {
    const data = (FORMAT_BITS_M << 3) | mask
    let rem = data
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537)
    const bits = ((data << 10) | rem) ^ 0x5412
    const { size } = this

    for (let i = 0; i <= 5; i++) this.setFunction(8, i, bit(bits, i))
    this.setFunction(8, 7, bit(bits, 6))
    this.setFunction(8, 8, bit(bits, 7))
    this.setFunction(7, 8, bit(bits, 8))
    for (let i = 9; i < 15; i++) this.setFunction(14 - i, 8, bit(bits, i))

    for (let i = 0; i < 8; i++) this.setFunction(size - 1 - i, 8, bit(bits, i))
    for (let i = 8; i < 15; i++) this.setFunction(8, size - 15 + i, bit(bits, i))
    this.setFunction(8, size - 8, true) // the dark module
  }

  drawVersionBits() {
    if (this.version < 7) return
    let rem = this.version
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25)
    const bits = (this.version << 12) | rem
    for (let i = 0; i < 18; i++) {
      const a = this.size - 11 + (i % 3)
      const b = Math.floor(i / 3)
      this.setFunction(a, b, bit(bits, i))
      this.setFunction(b, a, bit(bits, i))
    }
  }

  drawCodewords(codewords: readonly number[]) {
    const { size } = this
    let i = 0
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5 // skip the vertical timing column
      for (let vert = 0; vert < size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j
          const upward = ((right + 1) & 2) === 0
          const y = upward ? size - 1 - vert : vert
          if (!this.isFunction[y][x] && i < codewords.length * 8) {
            this.modules[y][x] = bit(codewords[i >>> 3], 7 - (i & 7))
            i++
          }
        }
      }
    }
  }

  /** XOR is its own inverse: applying the same mask twice undoes it. */
  applyMask(mask: number) {
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        if (!this.isFunction[y][x] && maskBit(mask, x, y)) this.modules[y][x] = !this.modules[y][x]
      }
    }
  }

  penalty(): number {
    const { size, modules } = this
    let result = 0
    const line = (at: (i: number) => boolean) => {
      let runColor = false
      let run = 0
      const history = [0, 0, 0, 0, 0, 0, 0]
      for (let i = 0; i < size; i++) {
        if (at(i) === runColor) {
          run++
          if (run === 5) result += PENALTY_N1
          else if (run > 5) result++
        } else {
          addRun(history, run, size)
          if (!runColor) result += finderLikeCount(history) * PENALTY_N3
          runColor = at(i)
          run = 1
        }
      }
      if (runColor) {
        addRun(history, run, size)
        run = 0
      }
      addRun(history, run + size, size) // the light quiet zone ends the line
      result += finderLikeCount(history) * PENALTY_N3
    }
    for (let y = 0; y < size; y++) line((x) => modules[y][x])
    for (let x = 0; x < size; x++) line((y) => modules[y][x])

    let dark = 0
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const color = modules[y][x]
        if (color) dark++
        if (
          x < size - 1 &&
          y < size - 1 &&
          color === modules[y][x + 1] &&
          color === modules[y + 1][x] &&
          color === modules[y + 1][x + 1]
        ) {
          result += PENALTY_N2
        }
      }
    }
    const total = size * size
    result += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * PENALTY_N4
    return result
  }
}

function maskBit(mask: number, x: number, y: number): boolean {
  switch (mask) {
    case 0:
      return (x + y) % 2 === 0
    case 1:
      return y % 2 === 0
    case 2:
      return x % 3 === 0
    case 3:
      return (x + y) % 3 === 0
    case 4:
      return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0
    case 5:
      return ((x * y) % 2) + ((x * y) % 3) === 0
    case 6:
      return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0
    default:
      return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0
  }
}

/** Run lengths of one line, newest first; the first run gets the quiet zone. */
function addRun(history: number[], run: number, size: number) {
  history.pop()
  history.unshift(history[0] === 0 ? run + size : run)
}

/** 1:1:3:1:1 dark-light runs with 4 light modules on one side (finder look-alike). */
function finderLikeCount(history: readonly number[]): number {
  const n = history[1]
  const core =
    n > 0 && history[2] === n && history[3] === n * 3 && history[4] === n && history[5] === n
  return (
    (core && history[0] >= n * 4 && history[6] >= n ? 1 : 0) +
    (core && history[6] >= n * 4 && history[0] >= n ? 1 : 0)
  )
}

/**
 * The smallest version (1–10) that holds the text at level M. `mask` forces a
 * mask pattern (0–7) — for the tests; by default the lowest penalty wins.
 * Throws a `RangeError` when the text is too long.
 */
export function encodeQr(text: string, options: { mask?: number } = {}): QrMatrix {
  const bytes = new TextEncoder().encode(text)
  let version = 1
  // 4 bits of mode + the character count (8 bits up to version 9, then 16).
  while (
    version <= QR_MAX_VERSION &&
    4 + (version <= 9 ? 8 : 16) + bytes.length * 8 > dataCodewords(version) * 8
  ) {
    version++
  }
  if (version > QR_MAX_VERSION) {
    throw new RangeError(`QR text of ${bytes.length} bytes exceeds version ${QR_MAX_VERSION}-M`)
  }

  const grid = new QrGrid(version)
  grid.drawFunctionPatterns()
  grid.drawCodewords(withEccInterleaved(dataCodewordsOf(bytes, version), version))

  let mask = options.mask
  if (mask === undefined) {
    let best = Infinity
    for (let candidate = 0; candidate < 8; candidate++) {
      grid.applyMask(candidate)
      grid.drawFormatBits(candidate)
      const score = grid.penalty()
      if (score < best) {
        best = score
        mask = candidate
      }
      grid.applyMask(candidate)
    }
  }
  const chosen = mask ?? 0
  grid.applyMask(chosen)
  grid.drawFormatBits(chosen)
  return grid.modules
}
