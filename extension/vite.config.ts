import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        microphonePermission: resolve(import.meta.dirname, 'microphone-permission.html'),
        background: resolve(import.meta.dirname, 'src/background/index.ts'),
        content: resolve(import.meta.dirname, 'src/content/index.ts'),
      },
      output: { entryFileNames: '[name].js', chunkFileNames: 'assets/[name]-[hash].js' },
    },
  },
  test: { environment: 'jsdom', setupFiles: './src/test/setup.ts' },
})
