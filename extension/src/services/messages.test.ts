import { expect, test } from 'vitest'
import { isInsertMessage, supportedHostname } from './messages'

test('validates explicit insertion approval and prompt bounds', () => {
  expect(isInsertMessage({ type: 'INSERT_PROMPT', prompt: 'Approved prompt', approved: true })).toBe(true)
  expect(isInsertMessage({ type: 'INSERT_PROMPT', prompt: 'No approval' })).toBe(false)
  expect(isInsertMessage({ type: 'INSERT_PROMPT', prompt: '', approved: true })).toBe(false)
})

test('allows only exact supported hostnames', () => {
  expect(supportedHostname('https://chatgpt.com/c/1')).toBe(true)
  expect(supportedHostname('https://evil-chatgpt.com/')).toBe(false)
  expect(supportedHostname('chrome://extensions')).toBe(false)
})
