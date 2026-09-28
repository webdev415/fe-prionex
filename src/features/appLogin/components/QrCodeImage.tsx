import { useMemo } from 'react'
import { piiHiddenProps } from '@/lib/openreplay/pii'
import { encodeQr } from '../lib/qrCode'

/** The light margin a scanner needs around the code, in modules (ISO/IEC 18004). */
const QUIET_ZONE = 4

interface QrCodeImageProps {
  /** Drawn byte for byte; never shown as text, never put in an attribute. */
  value: string
  /** Accessible name — a description, not the value. */
  label: string
  className?: string
}

/** One path for the whole code: each row's dark runs as rectangles. */
function darkModulesPath(value: string): { path: string; dimension: number } | null {
  let matrix: boolean[][]
  try {
    matrix = encodeQr(value)
  } catch {
    return null
  }
  const parts: string[] = []
  matrix.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (!row[x]) continue
      let run = 1
      while (x + run < row.length && row[x + run]) run++
      parts.push(`M${x + QUIET_ZONE} ${y + QUIET_ZONE}h${run}v1h-${run}z`)
      x += run - 1
    }
  })
  return { path: parts.join(''), dimension: matrix.length + QUIET_ZONE * 2 }
}

/**
 * The sign-in QR as an inline SVG — no image service, no network request.
 * Black on white whatever the theme: phone scanners expect dark modules on a
 * light ground. The block is hidden from session replay (`data-openreplay-hidden`
 * keeps its size and drops its children): the code is a live sign-in secret.
 */
export function QrCodeImage({ value, label, className }: QrCodeImageProps) {
  const drawing = useMemo(() => darkModulesPath(value), [value])
  if (!drawing) return null

  return (
    <div {...piiHiddenProps} className={className}>
      <svg
        role="img"
        aria-label={label}
        viewBox={`0 0 ${drawing.dimension} ${drawing.dimension}`}
        shapeRendering="crispEdges"
        className="block h-full w-full"
        data-testid="app-qr-login-code"
      >
        <rect width={drawing.dimension} height={drawing.dimension} fill="#ffffff" />
        <path d={drawing.path} fill="#000000" />
      </svg>
    </div>
  )
}

export default QrCodeImage
