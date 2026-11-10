import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#f8fafc',
        card: '#ffffff',
        border: '#e2e8f0',
        whatsapp: {
          50: '#f0fdf4',
          100: '#dcfce7',
          500: '#25D366',
          600: '#16a34a',
          700: '#15803d',
          teal: '#128C7E',
          dark: '#075E54',
          deep: '#008069',
        },
        daraz: {
          orange: '#FF6000',
          red: '#F53D2D',
        },
      },
    },
  },
  plugins: [],
};

export default config;
