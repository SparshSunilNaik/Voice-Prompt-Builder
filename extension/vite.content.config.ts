import { defineConfig } from 'vite'
import { resolve } from 'node:path'

// Manifest content scripts execute as classic scripts: never emit shared imports.
export default defineConfig({
  build: {
    outDir: 'dist', emptyOutDir: false,
    lib: { entry: resolve(import.meta.dirname, 'src/content/index.ts'), name: 'VoicePromptContent', formats: ['iife'], fileName: () => 'content.js' },
  },
})
