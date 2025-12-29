/**
 * Script to download and convert Lexend fonts to base64
 * 
 * Run this script to download Lexend fonts from Google Fonts
 * and convert them to base64 format for use in jsPDF
 * 
 * Usage: node scripts/load-lexend-fonts.js
 */

const https = require('https')
const fs = require('fs')
const path = require('path')

const FONTS_DIR = path.join(__dirname, '../public/fonts')
const OUTPUT_FILE = path.join(__dirname, '../src/lib/lexendFonts.ts')

// Google Fonts API URLs for Lexend
const LEXEND_REGULAR_URL = 'https://fonts.gstatic.com/s/lexend/v19/wlptgvRKaS76F8bUY1VQjKYNZQv0.woff2'
const LEXEND_BOLD_URL = 'https://fonts.gstatic.com/s/lexend/v19/wlptgvRKaS76F8bUY1VQjKYNZQv0.woff2'

// Note: The above URLs are examples. You need to get the actual TTF file URLs
// Visit: https://fonts.google.com/specimen/Lexend
// Download the TTF files and place them in public/fonts/ directory

function downloadFile(url, filepath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath)
    https.get(url, (response) => {
      if (response.statusCode === 200) {
        response.pipe(file)
        file.on('finish', () => {
          file.close()
          resolve()
        })
      } else {
        reject(new Error(`Failed to download: ${response.statusCode}`))
      }
    }).on('error', (err) => {
      fs.unlink(filepath, () => {})
      reject(err)
    })
  })
}

function fileToBase64(filepath) {
  const fileBuffer = fs.readFileSync(filepath)
  return fileBuffer.toString('base64')
}

async function main() {
  console.log('Lexend Font Loader Script')
  console.log('========================')
  console.log('')
  console.log('This script helps you set up Lexend fonts for PDF generation.')
  console.log('')
  console.log('To use Lexend fonts:')
  console.log('1. Download Lexend-Regular.ttf and Lexend-Bold.ttf from Google Fonts')
  console.log('2. Place them in the public/fonts/ directory')
  console.log('3. Run this script to convert them to base64')
  console.log('')
  
  // Check if fonts directory exists
  if (!fs.existsSync(FONTS_DIR)) {
    fs.mkdirSync(FONTS_DIR, { recursive: true })
    console.log(`Created fonts directory: ${FONTS_DIR}`)
  }

  const regularPath = path.join(FONTS_DIR, 'Lexend-Regular.ttf')
  const boldPath = path.join(FONTS_DIR, 'Lexend-Bold.ttf')

  if (!fs.existsSync(regularPath) || !fs.existsSync(boldPath)) {
    console.log('Font files not found. Please download them first.')
    console.log('Visit: https://fonts.google.com/specimen/Lexend')
    console.log(`Place files in: ${FONTS_DIR}`)
    return
  }

  console.log('Converting fonts to base64...')
  
  try {
    const regularBase64 = fileToBase64(regularPath)
    const boldBase64 = fileToBase64(boldPath)

    const output = `/**
 * Lexend Font Base64 Strings
 * 
 * Auto-generated from TTF font files
 * DO NOT EDIT MANUALLY
 */

export const LEXEND_REGULAR_BASE64 = \`${regularBase64}\`

export const LEXEND_BOLD_BASE64 = \`${boldBase64}\`
`

    fs.writeFileSync(OUTPUT_FILE, output)
    console.log(`✓ Successfully generated: ${OUTPUT_FILE}`)
    console.log('')
    console.log('Next steps:')
    console.log('1. Import these constants in loadLexendFont.ts')
    console.log('2. Use loadLexendFontFromBase64() to load the fonts')
  } catch (error) {
    console.error('Error converting fonts:', error)
  }
}

if (require.main === module) {
  main().catch(console.error)
}

module.exports = { fileToBase64 }

