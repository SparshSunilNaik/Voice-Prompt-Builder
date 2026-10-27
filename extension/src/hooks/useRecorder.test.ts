import { act, renderHook } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { useRecorder } from './useRecorder'

class FakeRecorder {
  static isTypeSupported = () => true
  state: RecordingState = 'inactive'
  mimeType = 'audio/webm;codecs=opus'
  ondataavailable: ((event: BlobEvent) => void) | null = null
  onerror: (() => void) | null = null
  onstop: (() => void) | null = null
  start() { this.state = 'recording' }
  stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob(['voice']) } as BlobEvent); this.onstop?.() }
}

const trackStop = vi.fn()

beforeEach(() => {
  trackStop.mockClear()
  vi.stubGlobal('MediaRecorder', FakeRecorder)
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: trackStop }] }) } })
})

test('requests permission only when start is called and releases tracks after stop', async () => {
  const { result } = renderHook(() => useRecorder())
  expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled()
  let recording!: Promise<Blob | null>
  await act(async () => { recording = result.current.start(); await Promise.resolve() })
  expect(result.current.status).toBe('recording')
  act(() => result.current.stop())
  await expect(recording).resolves.toBeInstanceOf(Blob)
  expect(trackStop).toHaveBeenCalledOnce()
})

test('reports denied microphone permission', async () => {
  vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValueOnce(new DOMException('Denied', 'NotAllowedError'))
  const { result } = renderHook(() => useRecorder())
  await act(async () => { await result.current.start() })
  expect(result.current.status).toBe('denied')
  expect(result.current.error).toMatch(/denied/i)
})
