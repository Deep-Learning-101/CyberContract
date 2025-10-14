import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    host: '0.0.0.0', // 或寫 true
    port: 3000,
  },
  // This allows the use of process.env.API_KEY in the client-side code.
  // When building, it will replace process.env.API_KEY with the value of
  // the VITE_API_KEY environment variable.
  define: {
    'process.env.API_KEY': JSON.stringify(process.env.VITE_API_KEY)
  }
})
