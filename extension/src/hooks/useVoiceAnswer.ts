import { useCallback, useEffect, useRef, useState } from 'react'
import { MAX_RECORDING_SECONDS } from '../contracts'
import { api } from '../services/api'
import { cancelMicrophonePermissionRequest, requestMicrophonePermission } from '../services/microphonePermission'
import { stopSpeaking } from '../services/speech'
import { RecordingCancelledError, useRecorder } from './useRecorder'

export type VoicePhase = 'idle' | 'listening' | 'transcribing'

/**
 * Captures one spoken answer: opens the microphone, stops when the speaker pauses,
 * and returns the transcript (or null when cancelled or nothing usable was heard).
 */
export function useVoiceAnswer() {
  const recorder = useRecorder(MAX_RECORDING_SECONDS)
  const [phase, setPhase] = useState<VoicePhase>('idle')
  const [error, setError] = useState('')
  const operation = useRef(0)
  const { start, cancel: cancelRecording } = recorder

  const listen = useCallback(async (): Promise<string | null> => {
    const id = ++operation.current
    stopSpeaking()
    setError('')
    setPhase('listening')
    try {
      const permission = await requestMicrophonePermission()
      if (id !== operation.current) return null
      if (permission !== 'granted') { setPhase('idle'); return null }
      const blob = await start({ autoStop: true })
      if (id !== operation.current) return null
      setPhase('transcribing')
      const transcript = await api.transcribe(blob)
      if (id !== operation.current) return null
      setPhase('idle')
      return transcript
    } catch (reason) {
      if (id !== operation.current) return null
      if (!(reason instanceof RecordingCancelledError)) setError(reason instanceof Error ? reason.message : 'Could not capture your answer. Try again.')
      setPhase('idle')
      return null
    }
  }, [start])

  const cancel = useCallback(() => {
    operation.current += 1
    cancelMicrophonePermissionRequest()
    cancelRecording()
    setPhase('idle')
  }, [cancelRecording])

  useEffect(() => () => { operation.current += 1; cancelMicrophonePermissionRequest() }, [])

  return { phase, error, setError, listen, cancel, stop: recorder.stop, elapsed: recorder.elapsed, recorderStatus: recorder.status }
}
