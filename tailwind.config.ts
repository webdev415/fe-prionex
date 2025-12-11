import type { Config } from 'tailwindcss'
import tailwindcssAnimate from 'tailwindcss-animate'

/**
 * Tailwind CSS v4 Configuration
 *
 * Colors and theme values are now defined in src/index.css using @theme directive.
 * This config file is kept minimal, only containing content paths and plugins.
 *
 * See: src/index.css for the complete theme configuration.
 */
const config: Config = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  plugins: [tailwindcssAnimate],
}

export default config
