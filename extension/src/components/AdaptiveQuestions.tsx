import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Keyboard, Mic, RotateCcw, SkipForward } from 'lucide-react'
import type { FollowUpQuestion, PromptingStrategy } from '../contracts'
import type { FollowUpAnswer } from '../state/workflow'
import { useVoiceAnswer } from '../hooks/useVoiceAnswer'
import { matchSpokenChoice, spokenQuestion } from '../services/interview'
import { speakQuestion, stopSpeaking } from '../services/speech'
import { Button, Loading } from './Controls'
import { ListeningBar } from './ListeningBar'
import { Panel } from './Shell'
import { StrategySummary } from './StrategySummary'

interface Props {
  questions: FollowUpQuestion[]
  answers: Record<string, FollowUpAnswer>
  index: number
  voice: boolean
  asking: boolean
  error: string
  /** The interviewer decided it has enough context for the current answers. */
  done: boolean
  limit: number
  strategy?: PromptingStrategy
  onAnswer: (id: string, answer: string) => void
  /** Marks the question skipped and advances. */
  onSkip: (id: string) => void
  onNext: () => void
  onPrevious: () => void
  onBuild: () => void
  onMode: (voice: boolean) => void
}

const SPEECH_UNAVAILABLE = 'Speech playback is unavailable, so the question was not read aloud. Read it, then answer by voice or tap an option.'
const choiceClass = (selected: boolean) => `flex min-h-10 w-full items-start gap-2 rounded-lg border px-3 py-2 text-left text-[12px] leading-snug transition-colors ${selected
  ? 'border-[var(--color-accent)] bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)] text-[var(--color-text)]'
  : 'border-[var(--color-border)] bg-[var(--color-interactive)] text-[var(--color-muted)] hover:text-[var(--color-text)]'}`

export function AdaptiveQuestions(props: Props) {
  const { questions, answers, index, voice, asking, error, done, limit, strategy, onAnswer, onSkip, onNext, onPrevious, onBuild, onMode } = props
  const question = questions[index] as FollowUpQuestion | undefined
  const answer = question ? answers[question.id] : undefined
  const capture = useVoiceAnswer()
  const [speechError, setSpeechError] = useState('')
  const [heard, setHeard] = useState<{ questionId: string; transcript: string; choice: number } | null>(null)
  // Invalidates a pending "listen after speaking" whenever the user acts or the question changes.
  const turn = useRef(0)
  const answerText = useRef('')
  // Declared before the speaking effect so it is current when a new question is read aloud.
  useEffect(() => { answerText.current = answer?.answer ?? '' })
  const { listen, cancel: cancelCapture } = capture

  const captureAnswer = async (target: FollowUpQuestion) => {
    setHeard(null)
    const transcript = await listen()
    if (!transcript) return
    const choice = matchSpokenChoice(transcript, target.choices)
    onAnswer(target.id, choice >= 0 ? target.choices[choice] : transcript)
    setHeard({ questionId: target.id, transcript, choice })
    speakQuestion(choice >= 0 ? `Selected option ${choice + 1}: ${target.choices[choice]}.` : 'Got it. I noted your answer.', () => undefined)
  }
  // Voice mode is hands-free: read the question and options, then listen straight away.
  const askAloud = (target: FollowUpQuestion, position: number, listenAfter: boolean) => {
    const id = ++turn.current
    setSpeechError('')
    const next = () => { if (id === turn.current && listenAfter) void captureAnswer(target) }
    speakQuestion(spokenQuestion(position, target.question, target.choices), () => { if (id !== turn.current) return; setSpeechError(SPEECH_UNAVAILABLE); next() }, next)
  }
  const interrupt = () => { turn.current += 1; stopSpeaking(); if (capture.phase !== 'idle') cancelCapture() }

  const questionId = question?.id
  useEffect(() => {
    if (!voice || !question || asking) return
    // speakQuestion reports through callbacks, so no state is set synchronously here.
    askAloud(question, index + 1, !answerText.current.trim())
    return () => { turn.current += 1; stopSpeaking(); cancelCapture() }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per question, not per render
  }, [questionId, voice, asking])

  if (asking) return <Loading label={index === 0 && !questions.length ? 'Planning your first question…' : 'Thinking about your next question…'} />

  if (!question) {
    const asked = questions.filter((q) => answers[q.id])
    return <>
      <p className="eyebrow">Clarification complete</p>
      <h2 className="view-title">{done ? 'Ready to build your prompt' : 'Answers so far'}</h2>
      {error && <p role="alert" className="my-3 text-xs text-[var(--color-warning)]">{error}</p>}
      {asked.length > 0 && <Panel className="mt-3"><ul className="space-y-2 text-xs">{asked.map((q) => <li key={q.id}><span className="text-[var(--color-muted)]">{q.question}</span><br /><strong className="font-medium">{answers[q.id].skipped || !answers[q.id].answer.trim() ? 'Skipped' : answers[q.id].answer}</strong></li>)}</ul></Panel>}
      <StrategySummary strategy={strategy} title="Prompting techniques (adapted to your answers)" />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button tone="quiet" icon={<ArrowLeft size={16} />} onClick={onPrevious}>Back</Button>
        <Button icon={<ArrowRight size={16} />} onClick={onBuild}>Build prompt</Button>
        {!done && questions.length < limit && <Button className="col-span-2" tone="quiet" onClick={onNext}>Ask another question</Button>}
      </div>
    </>
  }

  const selected = question.choices.indexOf(answer?.answer ?? '')
  const custom = selected >= 0 ? '' : answer?.answer ?? ''
  const lastHeard = heard?.questionId === question.id ? heard : null
  const busy = capture.phase !== 'idle'
  const problem = error || capture.error || speechError
  return <>
    <p className="eyebrow">{voice ? 'Voice clarification' : 'Clarification'} · question {index + 1} · adapts to your answers</p>
    <h2 className="view-title">Let’s sharpen your idea</h2>
    <Panel className="mt-3">
      <h3 className="text-[13px] font-semibold leading-snug">{question.question}</h3>
      <p className="mt-1 text-[10px] leading-relaxed text-[var(--color-muted)]">{question.relevance}</p>
      {question.choices.length > 0 && <div role="group" aria-label="Answer options" className="mt-3 space-y-1.5">
        {question.choices.map((choice, position) => <button key={choice} aria-pressed={selected === position} onClick={() => { interrupt(); onAnswer(question.id, choice) }} className={choiceClass(selected === position)}>
          <span className="font-semibold text-[var(--color-accent)]">{position + 1}.</span><span>{choice}</span>
        </button>)}
      </div>}
      <input maxLength={5000} aria-label={`Answer: ${question.question}`} className="mt-2.5 min-h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[13px] text-[var(--color-text)] outline-none transition-colors placeholder:text-[#666d7e] focus:border-[var(--color-accent)]" value={custom} placeholder={question.choices.length ? 'Or type your own answer' : 'Type your answer'} onFocus={() => { if (busy) interrupt() }} onChange={(event) => onAnswer(question.id, event.target.value)} />
      {lastHeard && <p role="status" className="mt-2 text-[11px] text-[var(--color-muted)]">Heard “{lastHeard.transcript}”{lastHeard.choice >= 0 ? <> → selected option {lastHeard.choice + 1}</> : ' → kept as your own answer'}</p>}
    </Panel>
    <ListeningBar phase={capture.phase} status={capture.recorderStatus} elapsed={capture.elapsed} onDone={capture.stop} onCancel={interrupt} />
    {problem && !busy && <p role="alert" className="my-3 text-xs text-[var(--color-warning)]">{problem}</p>}
    {/* Navigation stays available while listening; any action stops the microphone first. */}
    <>
      {!busy && (voice
        ? <Button className="mt-3 w-full" tone="quiet" icon={<RotateCcw size={14} />} onClick={() => askAloud(question, index + 1, true)}>Repeat question &amp; listen</Button>
        : <Button className="mt-3 w-full" tone="quiet" icon={<Mic size={15} />} onClick={() => { interrupt(); void captureAnswer(question) }}>Answer by voice</Button>)}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button tone="quiet" icon={<SkipForward size={14} />} onClick={() => { interrupt(); onSkip(question.id) }}>Skip question</Button>
        <Button icon={<ArrowRight size={16} />} disabled={!answer?.answer.trim()} onClick={() => { interrupt(); onNext() }}>Next</Button>
        <Button tone="quiet" icon={<ArrowLeft size={16} />} onClick={() => { interrupt(); onPrevious() }}>Back</Button>
        <Button tone="quiet" onClick={() => { interrupt(); onBuild() }}>Build prompt now</Button>
      </div>
      <Button className="mt-2 w-full" tone="quiet" icon={voice ? <Keyboard size={14} /> : <Mic size={14} />} onClick={() => { interrupt(); onMode(!voice) }}>{voice ? 'Switch to text' : 'Switch to voice'}</Button>
    </>
  </>
}
