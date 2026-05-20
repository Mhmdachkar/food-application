import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: '#FF8C1A',
          light: '#FFB366',
          dark: '#E67A00',
        },
        background: '#F8F8F8',
        card: '#FFFFFF',
        overlay: 'rgba(0, 0, 0, 0.5)',
        primary: '#1A1A2E',
        secondary: '#8E8E93',
        tertiary: '#C7C7CC',
        inverse: '#FFFFFF',
        border: {
          DEFAULT: '#E5E5EA',
          light: '#F2F2F7',
        },
        divider: '#E5E5EA',
        success: {
          DEFAULT: '#34C759',
          light: '#E8F8EC',
        },
        warning: {
          DEFAULT: '#FF9500',
          light: '#FFF4E5',
        },
        danger: {
          DEFAULT: '#FF3B30',
          light: '#FFEBE9',
        },
        info: {
          DEFAULT: '#007AFF',
          light: '#E5F1FF',
        },
        shimmer: '#F0F0F0',
      },
      borderRadius: {
        xs: '8px',
        sm: '12px',
        md: '16px',
        lg: '20px',
        xl: '24px',
        '2xl': '28px',
        btn: '24px',
      },
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '24px',
        xl: '32px',
        '2xl': '48px',
      },
    },
  },
  plugins: [],
};

export default config;
