import { useCallback, useEffect, useRef, useState } from 'react'

export type RecorderStatus = 'idle' | 'requesting' | 'recording' | 'stopping' | 'denied' | 'error'
type StopReason = 'user' | 'cancel' | 'timeout' | 'failure' | null

const preferredTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus']

export class RecordingCaptureError extends Error {
  constructor(message: string, readonly code: string) {
    super(message)
    this.name = 'RecordingCaptureError'
  }
}

export class RecordingCancelledError extends Error {
  constructor() {
    super('Recording was cancelled')
    this.name = 'RecordingCancelledError'
  }
}

function debugLifecycle(event: string, details?: Record<string, unknown>) {
  if (import.meta.env.DEV) console.debug('[voice-recorder]', event, details ?? {})
}

export function useRecorder(maxSeconds = 60) {
  const [status, setStatus] = useState<RecorderStatus>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const recorder = useRef<MediaRecorder | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const chunks = useRef<Blob[]>([])
  const stopReason = useRef<StopReason>(null)
  const captureFailure = useRef<RecordingCaptureError | null>(null)
  const completion = useRef<{
    resolve: (blob: Blob) => void
    reject: (reason: Error) => void
  } | null>(null)
  const startedAt = useRef(0)
  const session = useRef(0)
  const trackEndHandlers = useRef(new Map<MediaStreamTrack, () => void>())

  const release = useCallback(() => {
    const activeStream = stream.current
    stream.current = null
    if (activeStream) {
      activeStream.getTracks().forEach((track) => {
        const handler = trackEndHandlers.current.get(track)
        if (handler) track.removeEventListener('ended', handler)
        trackEndHandlers.current.delete(track)
        if (track.readyState !== 'ended') track.stop()
      })
    }
    recorder.current = null
    debugLifecycle('stream cleanup executed')
  }, [])

  const rejectCapture = useCallback((failure: RecordingCaptureError) => {
    captureFailure.current = failure
    stopReason.current = 'failure'
    setError(failure.message)
    setStatus('error')
    const active = recorder.current
    if (active && active.state !== 'inactive') {
      active.stop()
    } else {
      release()
      completion.current?.reject(failure)
      completion.current = null
    }
  }, [release])

  const stopWithReason = useCallback((reason: 'user' | 'timeout') => {
    const active = recorder.current
    if (active?.state === 'recording' || active?.state === 'paused') {
      stopReason.current = reason
      setStatus('stopping')
      debugLifecycle(reason === 'timeout' ? 'recording timeout requested' : 'stop requested')
      active.stop()
    }
  }, [])

  const stop = useCallback(() => stopWithReason('user'), [stopWithReason])

  const cancel = useCallback(() => {
    debugLifecycle('cancellation requested')
    session.current += 1
    stopReason.current = 'cancel'
    const active = recorder.current
    if (active && active.state !== 'inactive') active.stop()
    else release()
    setStatus('idle')
    setElapsed(0)
  }, [release])

  const start = useCallback(async (): Promise<Blob> => {
    if (recorder.current && recorder.current.state !== 'inactive') {
      throw new RecordingCaptureError('A recording is already in progress.', 'already_recording')
    }
    const currentSession = session.current + 1
    session.current = currentSession
    setStatus('requesting')
    setError(null)
    setElapsed(0)
    stopReason.current = null
    captureFailure.current = null
    chunks.current = []
    debugLifecycle('permission request started')

    let media: MediaStream
    try {
      media = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      })
      debugLifecycle('permission granted')
    } catch (reason) {
      const denied = reason instanceof DOMException
        && (reason.name === 'NotAllowedError' || reason.name === 'SecurityError')
      const failure = new RecordingCaptureError(
        denied
          ? 'Microphone permission was denied. Allow microphone access for the extension, then try again.'
          : 'The microphone could not be opened. Check that another application is not using it.',
        denied ? 'permission_denied' : 'microphone_unavailable',
      )
      setStatus(denied ? 'denied' : 'error')
      setError(failure.message)
      debugLifecycle(denied ? 'permission denied' : 'permission request failed', { category: failure.code })
      throw failure
    }

    if (session.current !== currentSession) {
      media.getTracks().forEach((track) => track.stop())
      throw new RecordingCancelledError()
    }

    stream.current = media
    debugLifecycle('stream acquired', { tracks: media.getAudioTracks().length })
    const mimeType = preferredTypes.find((type) => MediaRecorder.isTypeSupported(type))
    let active: MediaRecorder
    try {
      active = new MediaRecorder(media, mimeType ? { mimeType } : undefined)
    } catch (reason) {
      release()
      const failure = new RecordingCaptureError(
        'Chrome could not create an audio recorder for this microphone.',
        'recorder_creation_failed',
      )
      setStatus('error')
      setError(failure.message)
      debugLifecycle('recorder creation failed', { exception: reason instanceof Error ? reason.name : 'unknown' })
      throw failure
    }
    recorder.current = active
    debugLifecycle('MediaRecorder created', { mimeType: active.mimeType || 'browser-default' })

    const result = new Promise<Blob>((resolve, reject) => { completion.current = { resolve, reject } })
    media.getTracks().forEach((track) => {
      const ended = () => {
        if (stream.current === media && stopReason.current === null) {
          debugLifecycle('track ended event', { kind: track.kind })
          rejectCapture(new RecordingCaptureError(
            'Microphone capture ended unexpectedly. Check Chrome microphone permissions and try again.',
            'track_ended',
          ))
        }
      }
      trackEndHandlers.current.set(track, ended)
      track.addEventListener('ended', ended, { once: true })
    })
    active.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.current.push(event.data)
    }
    active.onerror = () => {
      debugLifecycle('MediaRecorder error event')
      rejectCapture(new RecordingCaptureError(
        'Chrome reported an audio recording error. Reconnect the microphone and try again.',
        'recorder_error',
      ))
    }
    active.onstop = () => {
      const reason = stopReason.current
      const failure = captureFailure.current
      const blob = new Blob(chunks.current, { type: active.mimeType || 'audio/webm' })
      debugLifecycle('recorder stopped', { reason: reason ?? 'unexpected', bytes: blob.size })
      release()
      setElapsed(startedAt.current ? Math.min(maxSeconds, Math.floor((Date.now() - startedAt.current) / 1000)) : 0)
      if (reason === 'cancel') {
        setStatus('idle')
        completion.current?.reject(new RecordingCancelledError())
      } else if (failure) {
        setStatus('error')
        completion.current?.reject(failure)
      } else if (reason === null) {
        const unexpected = new RecordingCaptureError(
          'Recording stopped unexpectedly. Keep the side panel open and check microphone permissions.',
          'unexpected_stop',
        )
        setError(unexpected.message)
        setStatus('error')
        completion.current?.reject(unexpected)
      } else if (blob.size === 0) {
        const empty = new RecordingCaptureError(
          'No audio was captured. Speak after the recording indicator appears, then press Stop.',
          'empty_recording',
        )
        setError(empty.message)
        setStatus('error')
        completion.current?.reject(empty)
      } else {
        setStatus('idle')
        completion.current?.resolve(blob)
      }
      completion.current = null
    }

    try {
      active.start(250)
      startedAt.current = Date.now()
      setStatus('recording')
      debugLifecycle('recorder started')
    } catch (reason) {
      const failure = new RecordingCaptureError(
        'Chrome could not start audio recording. Refresh the extension and try again.',
        'recorder_start_failed',
      )
      setError(failure.message)
      setStatus('error')
      release()
      completion.current = null
      debugLifecycle('recorder start failed', { exception: reason instanceof Error ? reason.name : 'unknown' })
      throw failure
    }
    return result
  }, [maxSeconds, rejectCapture, release])

  useEffect(() => {
    if (status !== 'recording') return
    const timer = window.setInterval(() => {
      const seconds = Math.floor((Date.now() - startedAt.current) / 1000)
      setElapsed(Math.min(seconds, maxSeconds))
      if (seconds >= maxSeconds) stopWithReason('timeout')
    }, 250)
    return () => window.clearInterval(timer)
  }, [maxSeconds, status, stopWithReason])

  useEffect(() => () => {
    session.current += 1
    if (recorder.current && recorder.current.state !== 'inactive') {
      stopReason.current = 'cancel'
      recorder.current.stop()
    } else {
      release()
    }
  }, [release])

  return { status, elapsed, error, start, stop, cancel }
}
