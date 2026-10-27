import { firstVisible } from './editor'
import type { PlatformAdapter } from './types'

export const claudeAdapter: PlatformAdapter = {
  platform: 'Claude',
  hostname: 'claude.ai',
  findComposer: (document) => firstVisible([
    '[data-testid="chat-input"] [contenteditable="true"]',
    'div.ProseMirror[contenteditable="true"]',
    'fieldset [contenteditable="true"][role="textbox"]',
    'textarea[placeholder*="Claude" i]',
  ], document),
}
