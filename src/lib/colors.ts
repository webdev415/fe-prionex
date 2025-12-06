/**
 * Color Utilities
 *
 * Centralized color definitions matching Tailwind config.
 * Use these for inline styles and dynamic color values.
 */

export const colors = {
  // Primary colors
  primary: {
    50: '#F0F9FF',
    100: '#E0F2FE',
    200: '#B9E7FE',
    300: '#BBFB5B', // Accent color
    400: '#36C0FA',
    500: '#0CA8EB',
    600: '#008FD6',
    700: '#016AA3',
    800: '#065A86',
    900: '#0B4B6F',
    950: '#07304A',
  },
  // Secondary colors (teal/dark green)
  secondary: {
    50: '#E6F5F4',
    100: '#CCEBE9',
    200: '#99D7D3',
    300: '#66C3BD',
    400: '#33AFA7',
    500: '#009B91',
    600: '#007C73',
    700: '#236260',
    800: '#204E4D',
    900: '#1A3F3E',
    950: '#0F2524',
  },
  // Accent colors (lime green)
  accent: {
    50: '#F9FDF5',
    100: '#F3FCEB',
    200: '#E7F9D7',
    300: '#DBF6C3',
    400: '#CFF3AF',
    500: '#BBFB5B',
    600: '#96C949',
    700: '#709737',
    800: '#4B6424',
    900: '#253212',
    950: '#121909',
  },
  // Gray colors
  gray: {
    50: '#F7F7F7',
    100: '#EDEDED',
    200: '#DFDFDF',
    300: '#C8C8C8',
    400: '#ADADAD',
    500: '#A1A1A1',
    600: '#888888',
    700: '#7B7B7B',
    800: '#676767',
    900: '#545454',
    950: '#363636',
  },
  // Neutral/Dark colors
  neutral: {
    dark: {
      500: '#05040D',
    },
  },
  // Light colors
  light: {
    50: '#F2F3F0',
    100: '#EBECE8',
    200: '#CDCFD4',
    300: '#ABAFB5',
    400: '#81858F',
    500: '#6D727D',
    600: '#575A63',
    700: '#4A4D54',
    800: '#424448',
    900: '#3A3B3F',
    950: '#242528',
  },
} as const

/**
 * Get color value by path (e.g., 'primary.300' or 'gray.700')
 */
export function getColor(path: string): string {
  const [category, shade] = path.split('.')
  const colorCategory = colors[category as keyof typeof colors]
  if (!colorCategory) return path
  return colorCategory[shade as keyof typeof colorCategory] || path
}
