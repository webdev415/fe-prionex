/**
 * Noto Sans Font Loader for jsPDF
 *
 * Loads Noto Sans font family for use in PDF generation.
 * Uses Google Fonts API to fetch and load the font.
 */

import jsPDF from 'jspdf'
import { NOTO_SANS_REGULAR_BASE64, NOTO_SANS_BOLD_BASE64 } from './notoSansFonts'

// Cache for loaded fonts
let notoSansRegularLoaded = false
let notoSansBoldLoaded = false

/**
 * Loads Noto Sans font from base64 strings
 * This function loads the font if base64 strings are available
 */
export function loadNotoSansFont(doc: jsPDF): void {
  try {
    // If already loaded, just return
    if (notoSansRegularLoaded && notoSansBoldLoaded) {
      return
    }

    // Check if font is already in the document
    const fonts = doc.getFontList()
    if ('NotoSans' in fonts) {
      notoSansRegularLoaded = true
      notoSansBoldLoaded = true
      return
    }

    // If we have base64 fonts, load them
    if (NOTO_SANS_REGULAR_BASE64 && NOTO_SANS_BOLD_BASE64) {
      loadNotoSansFontFromBase64(doc, NOTO_SANS_REGULAR_BASE64, NOTO_SANS_BOLD_BASE64)
    }
  } catch (error) {
    console.warn('Failed to load Noto Sans font, using fallback:', error)
  }
}

/**
 * Checks if Noto Sans font is loaded
 */
export function isNotoSansLoaded(doc: jsPDF): boolean {
  try {
    const fonts = doc.getFontList()
    return 'NotoSans' in fonts
  } catch {
    return false
  }
}

/**
 * Load Noto Sans font from base64 strings
 * Call this with base64 encoded font files
 */
export function loadNotoSansFontFromBase64(
  doc: jsPDF,
  regularBase64: string,
  boldBase64: string
): void {
  try {
    if (!regularBase64 || !boldBase64) {
      console.warn('Noto Sans font base64 strings not provided')
      return
    }

    // Add font files to virtual file system
    doc.addFileToVFS('NotoSans-Regular.ttf', regularBase64)
    doc.addFileToVFS('NotoSans-Bold.ttf', boldBase64)

    // Add fonts
    doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal')
    doc.addFont('NotoSans-Bold.ttf', 'NotoSans', 'bold')

    notoSansRegularLoaded = true
    notoSansBoldLoaded = true
  } catch (error) {
    console.warn('Failed to load Noto Sans font from base64:', error)
  }
}

// Legacy export for backwards compatibility
export const loadLexendFont = loadNotoSansFont
export const isLexendLoaded = isNotoSansLoaded
export const loadLexendFontFromBase64 = loadNotoSansFontFromBase64
