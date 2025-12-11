import type { Config } from 'tailwindcss'
import tailwindcssAnimate from 'tailwindcss-animate'

const config: Config = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Lexend', 'sans-serif'],
      },
      fontSize: {
        // Display sizes
        '2xl-display': ['72px', { lineHeight: '125%' }],
        'xl-display': ['60px', { lineHeight: '125%' }],
        'lg-display': ['48px', { lineHeight: '126%' }],
        'md-display': ['36px', { lineHeight: '129%' }],
        'sm-display': ['30px', { lineHeight: '120%' }],
        'xs-display': ['24px', { lineHeight: '132%' }],
        // Text sizes
        'text-xl': ['20px', { lineHeight: '150%' }],
        'text-lg': ['18px', { lineHeight: '155%' }],
        'text-md': ['16px', { lineHeight: '150%' }],
        'text-sm': ['14px', { lineHeight: '140%' }],
        'text-xs': ['12px', { lineHeight: '150%' }],
      },
      colors: {
        // PRIMARY (Light Blue #0CA8EB) - CTAs, links, focus states, interactive elements
        primary: {
          50: '#F0F9FF',
          100: '#E0F2FE',
          200: '#B9E7FE',
          300: '#7CD4FD',
          400: '#36C0FA',
          500: '#0CA8EB', // Main CTA color - Official Design System
          600: '#008FD6',
          700: '#016AA3',
          800: '#065A86',
          900: '#0B4B6F',
          950: '#07304A',
        },
        // INFORMATION (Blue #3B82F6) - Info messages, secondary actions, informational badges
        information: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6', // Info color - Official Design System
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A',
          950: '#172E54',
        },
        // DARK (Dark Gray/Black) - Text, dark backgrounds, headers
        dark: {
          50: '#366A80',
          100: '#28576A',
          200: '#1F4150',
          300: '#152F3A',
          400: '#0B1B22',
          500: '#050D11',
          600: '#040B0E',
          700: '#02090B',
          800: '#02090B',
          900: '#000000',
          950: '#000000',
        },
        // GRAY (Neutral Gray) - Borders, dividers, disabled states, secondary text
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
        // LIGHT (Light Gray/White) - Light backgrounds, cards, panels
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
        // SUCCESS (Green #22C55E) - Success messages, positive feedback, completed states
        success: {
          50: '#F0FDF4',
          100: '#DCFCE7',
          200: '#BBF7D0',
          300: '#86EFAC',
          400: '#4ADE80',
          500: '#22C55E', // Success color - Official Design System
          600: '#16A34A',
          700: '#15803D',
          800: '#166534',
          900: '#14532D',
          950: '#052E14',
        },
        // WARNING (Yellow #EAB308) - Warning messages, caution states, pending actions
        warning: {
          50: '#FEFCE8',
          100: '#FEF9C3',
          200: '#FEF08A',
          300: '#FDE047',
          400: '#FACC15',
          500: '#EAB308', // Warning color - Official Design System
          600: '#CA8A04',
          700: '#A16207',
          800: '#854D0E',
          900: '#713F12',
          950: '#422306',
        },
        // ERROR (Red #EF4444) - Error messages, destructive actions, validation failures
        error: {
          50: '#FEF2F2',
          100: '#FEE2E2',
          200: '#FECACA',
          300: '#FCA5A5',
          400: '#F87171',
          500: '#EF4444', // Error color - Official Design System
          600: '#DC2626',
          700: '#B91C1C',
          800: '#991B1B',
          900: '#7F1D1D',
          950: '#450A0A',
        },
        // SECONDARY (Green #10B981) - NOT IN USE - Reserved for future
        secondary: {
          50: '#ECFDF5',
          100: '#D1FAE5',
          200: '#A7F3D0',
          300: '#6EE7B7',
          400: '#34D399',
          500: '#10B981', // Not in use - Official Design System
          600: '#059669',
          700: '#047857',
          800: '#065F46',
          900: '#064E3B',
          950: '#022C22',
        },
        // TERTIARY (Purple #8B5CF6) - NOT IN USE - Reserved for future
        tertiary: {
          50: '#FAF5FF',
          100: '#F3E8FF',
          200: '#E9D5FF',
          300: '#D8B4FE',
          400: '#C084FC',
          500: '#8B5CF6', // Not in use - Official Design System
          600: '#7C3AED',
          700: '#6D28D9',
          800: '#5B21B6',
          900: '#4C1D95',
          950: '#2E1065',
        },
        // BLACK - True black
        black: '#000000',
        // WHITE - True white
        white: '#FFFFFF',
      },
      boxShadow: {
        'sm': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'md': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        'lg': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        'xl': '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
        '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
        'card': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
      },
      borderRadius: {
        'sm': '4px',
        'md': '8px',
        'lg': '12px',
        'xl': '16px',
        '2xl': '24px',
      },
    },
  },
  plugins: [tailwindcssAnimate],
}

export default config
