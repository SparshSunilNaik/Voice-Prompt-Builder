import { chatGptAdapter } from './chatgpt'
import { claudeAdapter } from './claude'
import { insertWithAdapter } from './editor'
import type { PlatformAdapter } from './types'

const adapters: PlatformAdapter[] = [chatGptAdapter, claudeAdapter]

export async function insertForPage(prompt: string): Promise<{ ok: boolean; platform?: string; error?: string }> {
  const adapter = adapters.find(({ hostname }) => hostname === location.hostname)
  if (!adapter) return { ok: false, error: 'This site does not have a registered composer adapter.' }
  const inserted = await insertWithAdapter(adapter, prompt)
  return inserted
    ? { ok: true, platform: adapter.platform }
    : { ok: false, platform: adapter.platform, error: `${adapter.platform} composer not found or insertion could not be verified.` }
}
