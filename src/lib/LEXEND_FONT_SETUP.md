# Lexend Font Setup for PDF Generation

To use Lexend font in PDF receipts, you need to:

1. Download Lexend font files from Google Fonts:
   - Visit: https://fonts.google.com/specimen/Lexend
   - Download the font family (Regular and Bold weights)

2. Convert TTF files to base64:
   - Use an online converter or Node.js script
   - Or use this command: `base64 -i Lexend-Regular.ttf -o lexend-regular-base64.txt`

3. Update `src/lib/loadLexendFont.ts`:
   - Replace `LEXEND_REGULAR_BASE64` with your base64 string
   - Replace `LEXEND_BOLD_BASE64` with your base64 string

Alternatively, you can use a build script to automatically convert the fonts.

