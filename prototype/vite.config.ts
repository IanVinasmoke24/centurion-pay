import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    allowedHosts: true,
    cors: true,
    headers: {
      'ngrok-skip-browser-warning': 'true',
      'Access-Control-Allow-Origin': '*',
    },
  },
  preview: {
    port: 5174,
    host: true,
    cors: true,
    headers: {
      'ngrok-skip-browser-warning': 'true',
      'Access-Control-Allow-Origin': '*',
    },
  },
})
