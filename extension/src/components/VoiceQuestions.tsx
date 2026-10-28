import { useEffect, useRef, useState } from 'react'
import { MAX_RECORDING_SECONDS, type FollowUpQuestion } from '../contracts'
import type { FollowUpAnswer } from '../state/workflow'
import { RecordingCancelledError, useRecorder } from '../hooks/useRecorder'
import { cancelMicrophonePermissionRequest, requestMicrophonePermission } from '../services/microphonePermission'
import { api } from '../services/api'
import { speakQuestion, stopSpeaking } from '../services/speech'
import { Button, Loading } from './Controls'
import { Panel } from './Shell'
import { RecordingPanel } from './RecordingPanel'

interface Props {
  questions: FollowUpQuestion[]
  answers: Record<string, FollowUpAnswer>
  onAnswer: (id: string, answer: string) => void
  onSkip: (id: string) => void
  onBack: () => void
  onGenerate: () => void
  onText: () => void
}

export function VoiceQuestions({ questions, answers, onAnswer, onSkip, onBack, onGenerate, onText }: Props) {
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<'ready' | 'recording' | 'transcribing'>('ready')
  const [error, setError] = useState('')
  const recorder = useRecorder(MAX_RECORDING_SECONDS)
  const operation = useRef(0)
  const question = questions[index]
  const answer = question ? answers[question.id] : undefined
  useEffect(() => {
    if (question) speakQuestion(`Question ${index + 1}. ${question.question}`, () => setError('Speech playback is unavailable. Try Read question again, record an answer, or switch to text.'))
    return stopSpeaking
  }, [question, index])
  useEffect(() => () => { operation.current += 1; cancelMicrophonePermissionRequest(); stopSpeaking() }, [])
  const cancel = () => {
    operation.current += 1
    cancelMicrophonePermissionRequest()
    recorder.cancel()
    setPhase('ready')
  }
  const record = async () => {
    const id = ++operation.current
    stopSpeaking()
    setError('')
    setPhase('recording')
    try {
      const permission = await requestMicrophonePermission()
      if (id !== operation.current) return
      if (permission !== 'granted') { setPhase('ready'); return }
      const blob = await recorder.start()
      if (id !== operation.current) return
      setPhase('transcribing')
      const transcript = await api.transcribe(blob)
      if (id !== operation.current) return
      onAnswer(question.id, transcript)
      setPhase('ready')
    } catch (reason) {
      if (id !== operation.current) return
      if (!(reason instanceof RecordingCancelledError)) setError(reason instanceof Error ? reason.message : 'Could not capture your answer. Try again.')
      setPhase('ready')
    }
  }
  const next = () => setIndex(index + 1)
  if (!question) return <Panel><h2 className="view-title">Answers ready</h2><p className="my-3 text-sm">Your confirmed answers will guide the prompt.</p><Button onClick={onGenerate}>Build prompt</Button><Button tone="quiet" onClick={() => setIndex(Math.max(0, questions.length - 1))}>Review answers</Button></Panel>
  return <>
    <p className="eyebrow">Voice clarification · {index + 1} of {questions.length}</p>
    <h2 className="view-title">Let’s clarify your idea</h2>
    <Panel className="mt-3"><h3 className="text-sm font-semibold">{question.question}</h3><p className="mt-2 text-xs text-[var(--color-muted)]">{question.relevance}</p>{question.choices.length > 0 && <p className="mt-2 text-xs">Suggestions: {question.choices.join(' · ')}</p>}<p className="mt-2 text-xs text-[var(--color-muted)]">Listen to the question, then record your answer. Review the transcript before continuing.</p></Panel>
    {error && <p role="alert" className="my-3 text-xs text-[var(--color-warning)]">{error}</p>}
    {phase === 'recording' ? <RecordingPanel elapsed={recorder.elapsed} requesting={recorder.status === 'requesting' || recorder.status === 'idle'} stopping={recorder.status === 'stopping'} onStop={recorder.stop} onCancel={cancel} /> : phase === 'transcribing' ? <><Loading label="Transcribing your answer…" /><Button tone="quiet" onClick={cancel}>Cancel transcription</Button></> : <>
      <div className="my-3 grid grid-cols-2 gap-2"><Button tone="quiet" onClick={() => { setError(''); if (!speakQuestion(question.question, () => setError('Speech playback failed.'))) setError('Speech playback unavailable.') }}>Read question again</Button><Button onClick={record}>Record answer</Button></div>
      <textarea aria-label="Spoken answer transcript" maxLength={5000} className="editor min-h-24" value={answer?.answer ?? ''} placeholder="Your spoken answer appears here. You can correct it." onChange={(event) => onAnswer(question.id, event.target.value)} />
      <div className="mt-3 grid grid-cols-2 gap-2"><Button tone="quiet" onClick={() => { onSkip(question.id); next() }}>Skip question</Button><Button disabled={!answer?.answer.trim()} onClick={next}>{index + 1 === questions.length ? 'Review answers' : 'Use answer & next'}</Button></div>
      <div className="mt-2 grid grid-cols-2 gap-2"><Button tone="quiet" onClick={index ? () => setIndex(index - 1) : onBack}>Back</Button><Button tone="quiet" onClick={onText}>Switch to text</Button></div>
    </>}
  </>
}
