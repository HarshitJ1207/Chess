import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 800,
  },
  server: {
    proxy: {
      '/api/auth': 'http://localhost:8081',
      '/api/matchmaking': 'http://localhost:8082',
      '/api/ratings': 'http://localhost:8084',
      '/api/history': 'http://localhost:8085',
      '/ws/game': {
        target: 'ws://localhost:8083',
        ws: true,
      },
    },
  },
})
