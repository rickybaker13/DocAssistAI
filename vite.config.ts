import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 8080,
    strictPort: true,
  },
  // Ensure /redirect.html is served correctly
  publicDir: 'public',
  // Handle /redirect route - serve redirect.html
  build: {
    rollupOptions: {
      input: {
        main: './index.html',
        redirect: './public/redirect.html',
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
})
