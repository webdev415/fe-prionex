/**
 * Noto Sans Font Loader for jsPDF
 *
 * Loads Noto Sans font to support Ukrainian characters (₴ symbol)
 * Falls back gracefully if font is not available
 */

import type { jsPDF } from 'jspdf'

/**
 * Load Noto Sans font into jsPDF document
 * This is a stub - in production, you would load the actual font file
 * For now, it gracefully handles the case where font is not available
 */
export function loadNotoSansFont(doc: jsPDF): void {
  try {
    // In a real implementation, you would load the font file here
    // For example:
    // const fontData = require('./fonts/NotoSans-Regular.ttf')
    // doc.addFileToVFS('NotoSans-Regular.ttf', fontData)
    // doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal')

    // Check if font is already loaded
    const fonts = doc.getFontList()
    if ('NotoSans' in fonts) {
      return // Font already loaded
    }

    // If font is not available, jsPDF will fall back to helvetica
    // The renderCurrency function will handle the ₴ symbol gracefully
    console.warn('Noto Sans font not loaded. Using helvetica fallback.')
  } catch (error) {
    console.warn('Failed to load Noto Sans font:', error)
    // Font loading failed, but PDF generation can continue with helvetica
  }
}
