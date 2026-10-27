import { afterEach, expect, test, vi } from 'vitest'
import { copyPrompt, insertApprovedPrompt } from './insertion'

afterEach(() => vi.unstubAllGlobals())

test('always attaches explicit user approval', async () => {
  const sendMessage = vi.fn().mockResolvedValue({ ok: true, platform: 'ChatGPT' })
  vi.stubGlobal('chrome', { runtime: { sendMessage } })
  await expect(insertApprovedPrompt('Approved prompt')).resolves.toMatchObject({ ok: true })
  expect(sendMessage).toHaveBeenCalledWith({ type: 'INSERT_PROMPT', prompt: 'Approved prompt', approved: true })
})

test('returns an accurate fallback error when messaging fails', async () => {
  vi.stubGlobal('chrome', { runtime: { sendMessage: vi.fn().mockRejectedValue(new Error('No receiver')) } })
  await expect(insertApprovedPrompt('Keep this prompt')).resolves.toEqual({ ok: false, error: 'Could not contact the active tab.' })
})

test('clipboard fallback reports success and denied access', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  await expect(copyPrompt('Manual fallback')).resolves.toBe(true)
  expect(writeText).toHaveBeenCalledWith('Manual fallback')
  writeText.mockRejectedValueOnce(new DOMException('Denied', 'NotAllowedError'))
  await expect(copyPrompt('Still available')).resolves.toBe(false)
})
