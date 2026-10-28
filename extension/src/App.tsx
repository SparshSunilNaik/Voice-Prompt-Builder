import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Loading, Button } from './components/Controls'
import { InputPanel } from './components/InputPanel'
import { RecordingPanel } from './components/RecordingPanel'
import { Shell } from './components/Shell'
import { VoiceQuestions } from './components/VoiceQuestions'
import { RecordingCancelledError, useRecorder } from './hooks/useRecorder'
import { useWorkflow } from './hooks/useWorkflow'
import { api } from './services/api'
import { copyPrompt, getInsertionTarget, insertApprovedPrompt } from './services/insertion'
import type { InsertionTarget } from './services/messages'
import { cancelMicrophonePermissionRequest, requestMicrophonePermission } from './services/microphonePermission'
import { stopSpeaking } from './services/speech'
import { ConnectionSettings } from './components/ConnectionSettings'
import { MethodologyReview, PromptReview, QuestionsView, TranscriptReview } from './components/WorkflowViews'
import { MAX_RECORDING_SECONDS, type WorkflowStage } from './contracts'

export function App() {
  const [state, dispatch, workflowReady] = useWorkflow()
  const [notice, setNotice] = useState('')
  const [permissionPhase, setPermissionPhase] = useState<'idle' | 'checking' | 'denied'>('idle')
  const [inserting, setInserting] = useState(false)
  const [destination, setDestination] = useState<InsertionTarget | null>(null)
  useEffect(() => {
    if (!workflowReady || state.stage === 'welcome') return
    const heading = document.querySelector<HTMLElement>('h2')
    heading?.setAttribute('tabindex', '-1')
    heading?.focus()
  }, [state.stage, workflowReady])
  const recording = useRecorder(MAX_RECORDING_SECONDS)
  const operation = useRef(0)
  const retry = useRef<null | (() => void)>(null)
  const insertionPending = useRef(false)
  useEffect(() => {
    if (state.stage !== 'review') return
    let active = true
    const refresh = () => { void getInsertionTarget().then((target) => { if (active) setDestination(target) }) }
    refresh()
    window.addEventListener('focus', refresh)
    return () => { active = false; window.removeEventListener('focus', refresh) }
  }, [state.stage])
  const fail = (reason: unknown) => dispatch({ type: 'FAIL', message: reason instanceof Error ? reason.message : 'Something went wrong. Please try again.' })
  useEffect(() => () => { operation.current += 1; api.cancel(); cancelMicrophonePermissionRequest(); stopSpeaking() }, [])
  const go = (stage: WorkflowStage) => { operation.current += 1; api.cancel(); stopSpeaking(); dispatch({ type: 'SET_STAGE', stage }) }
  const reset = () => { go('welcome'); recording.cancel(); cancelMicrophonePermissionRequest(); dispatch({ type: 'RESET' }); setNotice('Saved workflow cleared.'); retry.current = null }

  const analyze = async (input = state.roughInput) => {
    setNotice('')
    const id = ++operation.current
    retry.current = () => { void analyze(input) }
    dispatch({ type: 'SET_STAGE', stage: 'analyzing' })
    try { const result = await api.analyze(input); if (id === operation.current) dispatch({ type: 'SET_ANALYSIS', analysis: result.analysis }) } catch (error) { if (id === operation.current) fail(error) }
  }
  const beginRecording = async () => {
    setNotice('')
    const id = ++operation.current
    dispatch({ type: 'SET_MODE', mode: 'voice' })
    dispatch({ type: 'SET_STAGE', stage: 'listening' })
    setPermissionPhase('checking')
    try {
      const permission = await requestMicrophonePermission(() => setPermissionPhase('denied'))
      if (id !== operation.current) return
      if (permission === 'cancelled') { setPermissionPhase('idle'); dispatch({ type: 'SET_STAGE', stage: 'welcome' }); return }
      setPermissionPhase('idle')
      const blob = await recording.start()
      if (id !== operation.current) return
      dispatch({ type: 'SET_STAGE', stage: 'transcribing' })
      const transcript = await api.transcribe(blob)
      if (id === operation.current) dispatch({ type: 'SET_TRANSCRIPT', value: transcript })
    } catch (error) { if (id === operation.current && !(error instanceof RecordingCancelledError)) fail(error) }
  }
  const cancelRecording = () => { go('welcome'); cancelMicrophonePermissionRequest(); recording.cancel(); setPermissionPhase('idle') }
  const refine = async () => {
    if (!state.analysis || !state.methodology) return
    setNotice('')
    const id = ++operation.current
    retry.current = () => { void refine() }
    dispatch({ type: 'SET_STAGE', stage: 'analyzing' })
    try {
      const result = await api.refine(state.roughInput, state.analysis, state.methodology, state.methodologyInstructions)
      if (id !== operation.current) return
      dispatch({ type: 'SET_QUESTIONS', questions: result.questions })
      if (!result.questions.length) await generate([])
    } catch (error) { if (id === operation.current) fail(error) }
  }
  const generate = async (answers = Object.values(state.answers), revision = '') => {
    if (!state.analysis || !state.methodology) return
    setNotice('')
    const id = ++operation.current
    retry.current = () => { void generate(answers, revision) }
    dispatch({ type: 'SET_STAGE', stage: 'generating' })
    try {
      const result = await api.generate(state.roughInput, state.analysis, state.methodology, answers, state.methodologyInstructions, revision ? state.finalPrompt : '', revision)
      if (id === operation.current) dispatch({ type: 'SET_PROMPT', prompt: result.prompt, assumptions: result.assumptions })
    } catch (error) { if (id === operation.current) fail(error) }
  }
  const copy = async () => setNotice(await copyPrompt(state.finalPrompt) ? 'Prompt copied to clipboard' : 'Clipboard access failed. Select the prompt and copy it manually.')
  const insert = async () => {
    if (insertionPending.current) return
    insertionPending.current = true; setInserting(true)
    const id = operation.current
    try {
      const result = await insertApprovedPrompt(state.finalPrompt, destination)
      if (id !== operation.current) return
      if (result.ok) dispatch({ type: 'SET_STAGE', stage: 'complete' })
      else setNotice(`${result.error || 'Insertion failed'} Your prompt is still here; use Copy instead.`)
    } finally { insertionPending.current = false; setInserting(false) }
  }
  const step = ['welcome', 'listening', 'transcribing', 'transcript'].includes(state.stage) ? 0 : ['analyzing', 'methodology'].includes(state.stage) ? 1 : state.stage === 'questions' ? 2 : 3
  const answerProps = { questions: state.questions, answers: state.answers, onAnswer: (questionId: string, answer: string) => dispatch({ type: 'ANSWER', questionId, answer }), onSkip: (questionId: string) => dispatch({ type: 'SKIP', questionId }), onBack: () => go('methodology'), onGenerate: () => { void generate() } }
  let view
  if (state.stage === 'welcome') view = <InputPanel value={state.roughInput} onChange={(value) => { dispatch({ type: 'SET_MODE', mode: 'text' }); dispatch({ type: 'SET_INPUT', value }) }} onContinue={() => analyze()} onRecord={beginRecording} />
  else if (state.stage === 'listening') view = <RecordingPanel elapsed={recording.elapsed} requesting={permissionPhase !== 'idle' || recording.status === 'requesting'} permissionDenied={permissionPhase === 'denied'} stopping={recording.status === 'stopping'} onStop={recording.stop} onCancel={cancelRecording} />
  else if (state.stage === 'transcribing') view = <><Loading label="Transcribing your idea…" /><Button tone="quiet" onClick={cancelRecording}>Cancel</Button></>
  else if (state.stage === 'transcript') view = <TranscriptReview value={state.roughInput} onChange={(value) => dispatch({ type: 'SET_INPUT', value })} onBack={() => go('welcome')} onContinue={() => analyze()} />
  else if (state.stage === 'analyzing') view = <><Loading label="Understanding your goal…" /><Button tone="quiet" onClick={() => go(state.analysis ? 'methodology' : 'welcome')}>Cancel</Button></>
  else if (state.stage === 'methodology' && state.analysis && state.methodology) view = <MethodologyReview analysis={state.analysis} selected={state.methodology} instructions={state.methodologyInstructions} onSelect={(methodology) => dispatch({ type: 'EDIT_METHODOLOGY', methodology })} onInstructions={(instructions) => dispatch({ type: 'EDIT_METHODOLOGY', instructions })} onBack={() => go('welcome')} onContinue={refine} />
  else if (state.stage === 'questions') view = state.inputMode === 'voice' ? <VoiceQuestions {...answerProps} onText={() => dispatch({ type: 'SET_MODE', mode: 'text' })} /> : <QuestionsView {...answerProps} />
  else if (state.stage === 'generating') view = <><Loading label="Building your prompt…" /><Button tone="quiet" onClick={() => go(state.finalPrompt ? 'review' : state.questions.length ? 'questions' : 'methodology')}>Cancel</Button></>
  else if (state.stage === 'review') view = <PromptReview prompt={state.finalPrompt} assumptions={state.assumptions} onChange={(prompt) => dispatch({ type: 'EDIT_PROMPT', prompt })} onBack={() => go(state.questions.length ? 'questions' : 'methodology')} onRegenerate={(revision) => generate(undefined, revision)} onCopy={copy} onInsert={insert} inserting={inserting} onReview={async () => { if (!state.analysis || !state.methodology) throw new Error('Return to methodology review first.'); return (await api.review(state.roughInput, state.analysis, state.methodology, Object.values(state.answers), state.finalPrompt, state.methodologyInstructions)).report }} />
  else if (state.stage === 'complete') view = <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-center"><CheckCircle2 className="mx-auto mb-3 text-[var(--color-success)]" size={34} /><h2 className="view-title">Prompt inserted</h2><p className="my-3 text-sm">Review it in the composer. It was not sent.</p><div className="grid grid-cols-2 gap-2"><Button tone="quiet" onClick={() => go('review')}>Review prompt</Button><Button onClick={reset}>New prompt</Button><Button tone="quiet" onClick={copy}>Copy prompt</Button></div></div>
  else view = <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"><AlertTriangle className="text-[var(--color-warning)]" /><h2 className="mt-2 text-sm font-semibold">We hit a snag</h2><p role="alert" className="my-3 text-sm">{state.error}</p><div className="grid grid-cols-2 gap-2"><Button onClick={() => retry.current ? retry.current() : go('welcome')}>Retry last step</Button><Button tone="quiet" onClick={() => go(state.finalPrompt ? 'review' : state.analysis ? 'methodology' : 'welcome')}>Return to saved work</Button></div></div>
  if (!workflowReady) return <Shell><Loading label="Restoring your workflow…" /></Shell>
  return <Shell step={step}><ConnectionSettings />{(notice || (state.stage !== 'error' && state.error)) && <p role="status" className="my-3 text-xs text-[var(--color-warning)]">{notice || state.error}</p>}{state.stage === 'review' && <div className="mb-3 text-xs"><p>Insert into: {destination?.title || 'No supported chat tab selected'}</p><Button tone="quiet" disabled={inserting} onClick={async () => setDestination(await getInsertionTarget())}>Refresh destination</Button></div>}{view}{state.stage !== 'welcome' && <Button className="mt-4 w-full" tone="quiet" disabled={inserting} onClick={reset}>New prompt / clear saved work</Button>}<p className="mt-4 text-[11px] text-[var(--color-muted)]">Workflow saved locally for up to 24 hours. Audio goes to Gnani; prompt text goes through OpenRouter. Use Clear saved work to delete this workflow.</p></Shell>
}
