import { firstVisible } from './editor'
import type { PlatformAdapter } from './types'

export const chatGptAdapter: PlatformAdapter = {
  platform: 'ChatGPT',
  hostname: 'chatgpt.com',
  findComposer: (document) => firstVisible([
    '#prompt-textarea[contenteditable="true"]',
    'textarea#prompt-textarea',
    'textarea[data-id="root"]',
    'form [contenteditable="true"][role="textbox"]',
  ], document),
}
