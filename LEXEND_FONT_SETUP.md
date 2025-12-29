# Lexend Font Setup for PDF Receipts

To use Lexend font in PDF receipts (matching the template design), follow these steps:

## Option 1: Quick Setup (Recommended)

1. **Download Lexend Font Files:**
   - Visit: https://fonts.google.com/specimen/Lexend
   - Click "Download family"
   - Extract the ZIP file
   - You need: `Lexend-Regular.ttf` and `Lexend-Bold.ttf`

2. **Place Font Files:**
   - Create directory: `public/fonts/` (if it doesn't exist)
   - Copy `Lexend-Regular.ttf` and `Lexend-Bold.ttf` to `public/fonts/`

3. **Convert to Base64:**
   - Run the conversion script:
     ```bash
     node scripts/load-lexend-fonts.js
     ```
   - This will generate `src/lib/lexendFonts.ts` with base64 encoded fonts

4. **Done!** The PDF generator will now use Lexend font automatically.

## Option 2: Manual Base64 Conversion

If you prefer to convert manually:

1. **Convert TTF to Base64:**
   - Use an online tool: https://base64.guru/converter/encode/file
   - Or use command line:
     ```bash
     base64 -i Lexend-Regular.ttf -o lexend-regular-base64.txt
     base64 -i Lexend-Bold.ttf -o lexend-bold-base64.txt
     ```

2. **Update `src/lib/lexendFonts.ts`:**
   - Create the file if it doesn't exist
   - Add the base64 strings:
     ```typescript
     export const LEXEND_REGULAR_BASE64 = `[paste base64 here]`
     export const LEXEND_BOLD_BASE64 = `[paste base64 here]`
     ```

## Fallback

If Lexend fonts are not available, the PDF generator will automatically fall back to Helvetica font, which is very similar and will still produce professional-looking receipts.

## Verification

To verify Lexend font is loaded:
1. Open browser console
2. Generate a PDF receipt
3. Check for any warnings about font loading
4. If no warnings appear, Lexend is being used

## Notes

- The font files are not included in the repository to keep it lightweight
- Lexend font is free and open source (SIL Open Font License)
- The PDF generator will work with or without Lexend fonts (uses Helvetica as fallback)

