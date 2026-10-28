import { chatGptAdapter } from './chatgpt'
import { claudeAdapter } from './claude'
import { editorValue, insertWithAdapter } from './editor'
import { geminiAdapter } from './gemini'
import type { PlatformAdapter } from './types'

const adapters: PlatformAdapter[] = [chatGptAdapter, claudeAdapter, geminiAdapter]

export function adapterForHostname(hostname: string): PlatformAdapter | undefined {
  return adapters.find((adapter) => adapter.hostname === hostname)
}

export async function insertForPage(prompt: string): Promise<{ ok: boolean; platform?: string; error?: string }> {
  const adapter = adapterForHostname(location.hostname)
  if (!adapter) return { ok: false, error: 'This site does not have a registered composer adapter.' }
  const composer = adapter.findComposer(document)
  if (composer && editorValue(composer).trim() && editorValue(composer).trim() !== prompt.trim()) return { ok: false, platform: adapter.platform, error: 'Your composer already contains a draft. Copy this prompt, or clear the existing draft yourself before inserting.' }
  const inserted = await insertWithAdapter(adapter, prompt)
  return inserted
    ? { ok: true, platform: adapter.platform }
    : { ok: false, platform: adapter.platform, error: `${adapter.platform} composer not found or insertion could not be verified.` }
}
