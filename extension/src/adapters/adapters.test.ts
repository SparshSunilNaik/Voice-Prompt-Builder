import { beforeEach, expect, test, vi } from 'vitest'
import { chatGptAdapter } from './chatgpt'
import { claudeAdapter } from './claude'
import { insertWithAdapter } from './editor'

beforeEach(() => {
  document.body.replaceChildren()
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1 })
})

test('ChatGPT adapter inserts multiline text into its identified textarea without submitting', async () => {
  document.body.innerHTML = '<form><textarea id="prompt-textarea"></textarea><button type="submit">Send</button></form>'
  const submit = vi.fn()
  document.querySelector('form')?.addEventListener('submit', submit)
  expect(await insertWithAdapter(chatGptAdapter, 'First line\nSecond line')).toBe(true)
  expect((document.querySelector('textarea') as HTMLTextAreaElement).value).toBe('First line\nSecond line')
  expect(submit).not.toHaveBeenCalled()
})

test('Claude adapter uses only its contenteditable composer', async () => {
  document.body.innerHTML = '<div contenteditable="true">Unrelated</div><div class="ProseMirror" contenteditable="true"></div>'
  expect(await insertWithAdapter(claudeAdapter, 'Approved prompt')).toBe(true)
  expect(document.querySelector('.ProseMirror')?.textContent).toBe('Approved prompt')
  expect(document.querySelector('div')?.textContent).toBe('Unrelated')
})
