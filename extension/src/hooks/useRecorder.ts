import { useCallback, useEffect, useRef, useState } from 'react'

export type RecorderStatus = 'idle' | 'requesting' | 'recording' | 'stopping' | 'denied' | 'error'

const preferredTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus']

export function useRecorder(maxSeconds = 60) {
  const [status, setStatus] = useState<RecorderStatus>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const recorder = useRef<MediaRecorder | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const chunks = useRef<Blob[]>([])
  const cancelled = useRef(false)
  const completion = useRef<((blob: Blob | null) => void) | null>(null)

  const release = useCallback(() => {
    stream.current?.getTracks().forEach((track) => track.stop())
    stream.current = null
  }, [])

  const stop = useCallback(() => {
    if (recorder.current?.state === 'recording') {
      setStatus('stopping')
      recorder.current.stop()
    }
  }, [])

  const cancel = useCallback(() => {
    cancelled.current = true
    if (recorder.current?.state === 'recording') recorder.current.stop()
    else release()
    setStatus('idle')
    setElapsed(0)
  }, [release])

  const start = useCallback(async (): Promise<Blob | null> => {
    setStatus('requesting')
    setError(null)
    setElapsed(0)
    cancelled.current = false
    chunks.current = []
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } })
      stream.current = media
      const mimeType = preferredTypes.find((type) => MediaRecorder.isTypeSupported(type))
      const active = new MediaRecorder(media, mimeType ? { mimeType } : undefined)
      recorder.current = active
      const result = new Promise<Blob | null>((resolve) => { completion.current = resolve })
      active.ondataavailable = (event) => { if (event.data.size) chunks.current.push(event.data) }
      active.onerror = () => { setError('Recording failed. Please try again.'); setStatus('error'); release(); completion.current?.(null) }
      active.onstop = () => {
        const blob = cancelled.current ? null : new Blob(chunks.current, { type: active.mimeType || 'audio/webm' })
        release()
        setStatus('idle')
        completion.current?.(blob && blob.size ? blob : null)
        completion.current = null
      }
      active.start(250)
      setStatus('recording')
      return result
    } catch (reason) {
      release()
      const denied = reason instanceof DOMException && (reason.name === 'NotAllowedError' || reason.name === 'SecurityError')
      setStatus(denied ? 'denied' : 'error')
      setError(denied ? 'Microphone permission was denied. You can still type your request.' : 'Microphone is unavailable. You can still type your request.')
      return null
    }
  }, [release])

  useEffect(() => {
    if (status !== 'recording') return
    const timer = window.setInterval(() => setElapsed((value) => {
      if (value + 1 >= maxSeconds) stop()
      return Math.min(value + 1, maxSeconds)
    }), 1000)
    return () => window.clearInterval(timer)
  }, [maxSeconds, status, stop])

  useEffect(() => () => { cancelled.current = true; release() }, [release])

  return { status, elapsed, error, start, stop, cancel }
}
