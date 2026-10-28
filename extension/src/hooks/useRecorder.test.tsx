import { StrictMode, type ReactNode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { RecordingCaptureError, useRecorder } from './useRecorder'

class FakeTrack extends EventTarget {
  kind = 'audio'
  readyState: MediaStreamTrackState = 'live'
  stop = vi.fn(() => { this.readyState = 'ended' })
  endUnexpectedly() {
    this.readyState = 'ended'
    this.dispatchEvent(new Event('ended'))
  }
}

class FakeRecorder {
  static instances: FakeRecorder[] = []
  static immediateStop = false
  static emitAudio = true
  static isTypeSupported = () => true
  state: RecordingState = 'inactive'
  mimeType = 'audio/webm;codecs=opus'
  ondataavailable: ((event: BlobEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onstop: (() => void) | null = null
  constructor() { FakeRecorder.instances.push(this) }
  start() {
    this.state = 'recording'
    if (FakeRecorder.immediateStop) queueMicrotask(() => {
      this.state = 'inactive'
      this.onstop?.()
    })
  }
  stop() {
    if (this.state === 'inactive') return
    this.state = 'inactive'
    if (FakeRecorder.emitAudio) this.ondataavailable?.({ data: new Blob(['valid-audio']) } as BlobEvent)
    this.onstop?.()
  }
  fail() { this.onerror?.(new Event('error')) }
}

let track: FakeTrack
const strictWrapper = ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>

beforeEach(() => {
  track = new FakeTrack()
  FakeRecorder.instances = []
  FakeRecorder.immediateStop = false
  FakeRecorder.emitAudio = true
  vi.stubGlobal('MediaRecorder', FakeRecorder)
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [track],
        getAudioTracks: () => [track],
      }),
    },
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

test('records until explicit stop and survives StrictMode re-renders', async () => {
  const { result, rerender } = renderHook(() => useRecorder(), { wrapper: strictWrapper })
  let recording!: Promise<Blob>
  await act(async () => { recording = result.current.start(); await Promise.resolve() })
  rerender()
  rerender()
  expect(result.current.status).toBe('recording')
  expect(FakeRecorder.instances[0].state).toBe('recording')
  act(() => result.current.stop())
  await expect(recording).resolves.toEqual(expect.objectContaining({ size: 11 }))
  expect(track.stop).toHaveBeenCalledOnce()
})

test('reports immediate unexpected recorder termination instead of returning silently', async () => {
  FakeRecorder.immediateStop = true
  const { result } = renderHook(() => useRecorder())
  let recording!: Promise<Blob>
  let failure!: unknown
  await act(async () => {
    recording = result.current.start()
    failure = await recording.catch((reason: unknown) => reason)
  })
  expect(failure).toMatchObject({ code: 'unexpected_stop' })
  expect(result.current.error).toMatch(/stopped unexpectedly/i)
})

test('reports MediaRecorder error events and releases the stream', async () => {
  const { result } = renderHook(() => useRecorder())
  let recording!: Promise<Blob>
  await act(async () => { recording = result.current.start(); await Promise.resolve() })
  const outcome = recording.catch((reason: unknown) => reason)
  act(() => FakeRecorder.instances[0].fail())
  await expect(outcome).resolves.toMatchObject({ code: 'recorder_error' })
  expect(track.stop).toHaveBeenCalledOnce()
})

test('reports denied microphone permission', async () => {
  vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValueOnce(
    new DOMException('Denied', 'NotAllowedError'),
  )
  const { result } = renderHook(() => useRecorder())
  let failure!: unknown
  await act(async () => { failure = await result.current.start().catch((reason: unknown) => reason) })
  expect(failure).toMatchObject({ code: 'permission_denied' })
  expect(result.current.status).toBe('denied')
  expect(result.current.error).toMatch(/allow microphone access/i)
})

test('timer reflects multiple seconds of active recording', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
  const { result } = renderHook(() => useRecorder())
  let recording!: Promise<Blob>
  await act(async () => { recording = result.current.start(); await Promise.resolve() })
  act(() => { vi.advanceTimersByTime(3_200) })
  expect(result.current.elapsed).toBe(3)
  act(() => result.current.stop())
  await expect(recording).resolves.toBeInstanceOf(Blob)
})

test('automatically stops at the default 30-second provider limit', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
  const { result } = renderHook(() => useRecorder())
  let recording!: Promise<Blob>
  await act(async () => { recording = result.current.start(); await Promise.resolve() })
  act(() => { vi.advanceTimersByTime(30_000) })
  await expect(recording).resolves.toBeInstanceOf(Blob)
  expect(result.current.elapsed).toBe(30)
  expect(result.current.status).toBe('idle')
  expect(track.stop).toHaveBeenCalledOnce()
})

test('rejects an empty recording after Stop', async () => {
  FakeRecorder.emitAudio = false
  const { result } = renderHook(() => useRecorder())
  let recording!: Promise<Blob>
  await act(async () => { recording = result.current.start(); await Promise.resolve() })
  const outcome = recording.catch((reason: unknown) => reason)
  act(() => result.current.stop())
  await expect(outcome).resolves.toMatchObject({ code: 'empty_recording' })
  expect(result.current.error).toMatch(/no audio was captured/i)
})

test('reports unexpected microphone track termination', async () => {
  const { result } = renderHook(() => useRecorder())
  let recording!: Promise<Blob>
  await act(async () => { recording = result.current.start(); await Promise.resolve() })
  const outcome = recording.catch((reason: unknown) => reason)
  act(() => track.endUnexpectedly())
  await expect(outcome).resolves.toMatchObject({ code: 'track_ended' })
  expect(result.current.error).toMatch(/capture ended unexpectedly/i)
})

test('uses a typed capture error for overlapping recording attempts', async () => {
  const { result } = renderHook(() => useRecorder())
  let recording!: Promise<Blob>
  await act(async () => { recording = result.current.start(); await Promise.resolve() })
  await expect(result.current.start()).rejects.toBeInstanceOf(RecordingCaptureError)
  act(() => result.current.stop())
  await recording
})
