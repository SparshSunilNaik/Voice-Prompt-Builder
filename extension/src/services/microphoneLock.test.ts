import { afterEach, expect, test, vi } from 'vitest'
import { acquireMicrophone } from './microphoneLock'

afterEach(() => vi.unstubAllGlobals())
test('holds a cross-window capture lock until release and rejects a second recording', async () => {
  let locked = false
  const request = vi.fn(async (_name, _options, callback) => {
    if (locked) return callback(null)
    locked = true
    try { return await callback({ name: 'voice-prompt-microphone' }) } finally { locked = false }
  })
  Object.defineProperty(navigator, 'locks', { configurable: true, value: { request } })
  const release = await acquireMicrophone()
  await expect(acquireMicrophone()).rejects.toThrow(/another.*recording/i)
  release()
  await vi.waitFor(() => expect(locked).toBe(false))
  const again = await acquireMicrophone()
  again()
  Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined })
})
