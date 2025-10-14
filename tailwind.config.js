// tailwind.config.js
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    path.join(__dirname, 'index.html'),
    path.join(__dirname, 'App.tsx'),
    path.join(__dirname, 'index.tsx'),
    path.join(__dirname, 'components', '**', '*.{js,ts,jsx,tsx}'),
    path.join(__dirname, 'services', '**', '*.{js,ts,jsx,tsx}'),
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}