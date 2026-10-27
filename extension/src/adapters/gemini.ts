import { firstVisible } from './editor'
import type { PlatformAdapter } from './types'

export const geminiAdapter: PlatformAdapter = {
  platform: 'Gemini',
  hostname: 'gemini.google.com',
  findComposer: (document) => firstVisible([
    'rich-textarea .ql-editor[contenteditable="true"]',
    '[data-placeholder*="Gemini" i][contenteditable="true"]',
    '[aria-label*="prompt" i][contenteditable="true"]',
    'textarea[aria-label*="prompt" i]',
  ], document),
}
