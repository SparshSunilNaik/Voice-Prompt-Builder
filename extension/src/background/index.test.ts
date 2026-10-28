import { beforeEach, expect, test, vi } from 'vitest'

let handler: (message: unknown, sender: chrome.runtime.MessageSender, response: (value: unknown) => void) => boolean
let send: ReturnType<typeof vi.fn>
const root = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop/'
beforeEach(async () => {
  vi.resetModules()
  send = vi.fn().mockResolvedValue({ ok: true, platform: 'ChatGPT' })
  vi.stubGlobal('chrome', {
    runtime: { id: 'abcdefghijklmnopabcdefghijklmnop', getURL: (path: string) => root + path, onMessage: { addListener: (listener: typeof handler) => { handler = listener } }, sendMessage: vi.fn().mockResolvedValue(undefined) },
    storage: { local: { setAccessLevel: vi.fn().mockResolvedValue(undefined) } },
    action: { onClicked: { addListener: vi.fn() } },
    sidePanel: { open: vi.fn().mockResolvedValue(undefined) },
    tabs: { query: vi.fn().mockResolvedValue([{ id: 7, url: 'https://chatgpt.com/c/1', title: 'My chat' }]), sendMessage: send, onRemoved: { addListener: vi.fn() } },
  })
  await import('./index')
})

const panel = () => ({ id: chrome.runtime.id, url: root + 'index.html' })
test('routes an approved prompt only to the displayed unchanged destination', async () => {
  const reply = vi.fn()
  expect(handler({ type: 'INSERT_PROMPT', prompt: 'A reviewed prompt', approved: true, targetTabId: 7, targetUrl: 'https://chatgpt.com/c/1' }, panel(), reply)).toBe(true)
  await vi.waitFor(() => expect(reply).toHaveBeenCalledWith({ ok: true, platform: 'ChatGPT' }))
  expect(send).toHaveBeenCalledOnce()
})
test('rejects navigation after approval and messages forged by a content script', async () => {
  const message = { type: 'INSERT_PROMPT', prompt: 'A reviewed prompt', approved: true, targetTabId: 7, targetUrl: 'https://chatgpt.com/c/old' }
  const reply = vi.fn()
  handler(message, panel(), reply)
  await vi.waitFor(() => expect(reply).toHaveBeenCalledWith(expect.objectContaining({ ok: false })))
  expect(send).not.toHaveBeenCalled()
  expect(handler(message, { id: chrome.runtime.id, url: 'https://chatgpt.com/c/1' }, reply)).toBe(false)
})
test('reports the destination for review without inserting anything', async () => {
  const reply = vi.fn()
  handler({ type: 'GET_INSERT_TARGET' }, panel(), reply)
  await vi.waitFor(() => expect(reply).toHaveBeenCalledWith({ tabId: 7, url: 'https://chatgpt.com/c/1', title: 'My chat' }))
  expect(send).not.toHaveBeenCalled()
})
