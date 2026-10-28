import { beforeEach, expect, test, vi } from 'vitest'
import { chatGptAdapter } from './chatgpt'
import { claudeAdapter } from './claude'
import { firstVisible, insertWithAdapter } from './editor'
import { geminiAdapter } from './gemini'
import { adapterForHostname } from '.'

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

test('Gemini adapter preserves multiline text without clicking send', async () => {
  document.body.innerHTML = '<rich-textarea><div class="ql-editor" contenteditable="true"></div></rich-textarea><button aria-label="Send message">Send</button>'
  const send = vi.fn()
  document.querySelector('button')?.addEventListener('click', send)
  expect(await insertWithAdapter(geminiAdapter, 'Goal\n- first\n- second')).toBe(true)
  expect(document.querySelector('.ql-editor')?.textContent).toBe('Goal\n- first\n- second')
  expect(send).not.toHaveBeenCalled()
})

test('reports failed verification and maps only exact supported domains', async () => {
  expect(await insertWithAdapter(geminiAdapter, 'Prompt')).toBe(false)
  expect(adapterForHostname('gemini.google.com')?.platform).toBe('Gemini')
  expect(adapterForHostname('gemini.google.com.evil.example')).toBeUndefined()
})

test('protects existing drafts and ignores editors hidden by ancestors or readonly', async () => {
  document.body.innerHTML = '<section hidden><textarea id="prompt-textarea"></textarea></section><textarea data-id="root" readonly></textarea>'
  expect(firstVisible(['textarea'])).toBeNull()
  document.body.innerHTML = '<textarea id="prompt-textarea">My unfinished draft</textarea>'
  expect(await insertWithAdapter(chatGptAdapter, 'A new prompt')).toBe(false)
  expect((document.querySelector('textarea') as HTMLTextAreaElement).value).toBe('My unfinished draft')
})

test('detects delayed controlled-editor rollback instead of reporting success', async () => {
  document.body.innerHTML = '<textarea id="prompt-textarea"></textarea>'
  const editor = document.querySelector('textarea')!
  editor.addEventListener('input', () => setTimeout(() => { editor.value = '' }, 30))
  expect(await insertWithAdapter(chatGptAdapter, 'A new prompt')).toBe(false)
})
