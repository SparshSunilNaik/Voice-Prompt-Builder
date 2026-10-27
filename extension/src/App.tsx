import { useState } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Loading, Button } from './components/Controls'
import { InputPanel } from './components/InputPanel'
import { RecordingPanel } from './components/RecordingPanel'
import { Shell } from './components/Shell'
import { RecordingCancelledError, useRecorder } from './hooks/useRecorder'
import { useWorkflow } from './hooks/useWorkflow'
import { api, ApiError } from './services/api'
import { copyPrompt, insertApprovedPrompt } from './services/insertion'
import {
  cancelMicrophonePermissionRequest,
  requestMicrophonePermission,
} from './services/microphonePermission'
import { MethodologyReview, PromptReview, QuestionsView, TranscriptReview } from './components/WorkflowViews'

export function App() {
  const [state, dispatch, workflowReady] = useWorkflow()
  const [notice, setNotice] = useState('')
  const [permissionPhase, setPermissionPhase] = useState<'idle' | 'checking' | 'denied'>('idle')
  const recording = useRecorder(60)
  const fail = (reason: unknown) => dispatch({
    type: 'FAIL',
    message: reason instanceof ApiError || reason instanceof Error
      ? reason.message
      : 'Something went wrong. Please try again.',
  })

  const analyze = async (input = state.roughInput) => {
    dispatch({ type: 'SET_STAGE', stage: 'analyzing' })
    try { dispatch({ type: 'SET_ANALYSIS', analysis: (await api.analyze(input)).analysis }) } catch (error) { fail(error) }
  }
  const beginRecording = async () => {
    dispatch({ type: 'SET_STAGE', stage: 'listening' })
    setPermissionPhase('checking')
    try {
      const permission = await requestMicrophonePermission(() => setPermissionPhase('denied'))
      if (permission === 'cancelled') {
        setPermissionPhase('idle')
        dispatch({ type: 'SET_STAGE', stage: 'welcome' })
        return
      }
      setPermissionPhase('idle')
      const blob = await recording.start()
      dispatch({ type: 'SET_STAGE', stage: 'transcribing' })
      dispatch({ type: 'SET_TRANSCRIPT', value: await api.transcribe(blob) })
    } catch (error) {
      if (!(error instanceof RecordingCancelledError)) fail(error)
    }
  }
  const cancelRecording = () => {
    cancelMicrophonePermissionRequest()
    recording.cancel()
    setPermissionPhase('idle')
    dispatch({ type: 'SET_STAGE', stage: 'welcome' })
  }

  const refine = async () => {
    if (!state.analysis || !state.methodology) return
    dispatch({ type: 'SET_STAGE', stage: 'analyzing' })
    try {
      const result = await api.refine(state.roughInput, state.analysis, state.methodology, state.methodologyInstructions)
      dispatch({ type: 'SET_QUESTIONS', questions: result.questions })
      if (!result.questions.length) await generate([])
    } catch (error) { fail(error) }
  }

  const generate = async (answers = Object.values(state.answers), revision = '') => {
    if (!state.analysis || !state.methodology) return
    dispatch({ type: 'SET_STAGE', stage: 'generating' })
    try {
      const result = await api.generate(state.roughInput, state.analysis, state.methodology, answers, state.methodologyInstructions, revision ? state.finalPrompt : '', revision)
      dispatch({ type: 'SET_PROMPT', prompt: result.prompt, assumptions: result.assumptions })
    } catch (error) { fail(error) }
  }

  const copy = async () => {
    const copied = await copyPrompt(state.finalPrompt)
    setNotice(copied ? 'Prompt copied to clipboard' : 'Clipboard access failed. Select the prompt and copy it manually.')
  }

  const insert = async () => {
    const result = await insertApprovedPrompt(state.finalPrompt)
    if (result.ok) dispatch({ type: 'SET_STAGE', stage: 'complete' })
    else setNotice(`${result.error || 'Insertion failed'} Your prompt is still here; use Copy instead.`)
  }

  const step = ['welcome', 'listening', 'transcribing', 'transcript'].includes(state.stage) ? 0 : ['analyzing', 'methodology'].includes(state.stage) ? 1 : state.stage === 'questions' ? 2 : 3
  let view
  if (state.stage === 'welcome') view = <InputPanel value={state.roughInput} onChange={(value) => dispatch({ type: 'SET_INPUT', value })} onContinue={() => analyze()} onRecord={beginRecording} />
  else if (state.stage === 'listening') view = <RecordingPanel elapsed={recording.elapsed} requesting={permissionPhase !== 'idle' || recording.status === 'requesting'} permissionDenied={permissionPhase === 'denied'} stopping={recording.status === 'stopping'} onStop={recording.stop} onCancel={cancelRecording} />
  else if (state.stage === 'transcribing') view = <Loading label="Transcribing your idea…" />
  else if (state.stage === 'transcript') view = <TranscriptReview value={state.roughInput} onChange={(value) => dispatch({ type: 'SET_INPUT', value })} onBack={() => dispatch({ type: 'SET_STAGE', stage: 'welcome' })} onContinue={() => analyze()} />
  else if (state.stage === 'analyzing') view = <Loading label="Understanding your goal…" />
  else if (state.stage === 'methodology' && state.analysis && state.methodology) view = <MethodologyReview analysis={state.analysis} selected={state.methodology} instructions={state.methodologyInstructions} onSelect={(methodology) => dispatch({ type: 'EDIT_METHODOLOGY', methodology })} onInstructions={(instructions) => dispatch({ type: 'EDIT_METHODOLOGY', instructions })} onBack={() => dispatch({ type: 'SET_STAGE', stage: 'welcome' })} onContinue={refine} />
  else if (state.stage === 'questions') view = <QuestionsView questions={state.questions} answers={state.answers} onAnswer={(questionId, answer) => dispatch({ type: 'ANSWER', questionId, answer })} onSkip={(questionId) => dispatch({ type: 'SKIP', questionId })} onBack={() => dispatch({ type: 'SET_STAGE', stage: 'methodology' })} onGenerate={() => generate()} />
  else if (state.stage === 'generating') view = <Loading label="Building your prompt…" />
  else if (state.stage === 'review') view = <PromptReview prompt={state.finalPrompt} assumptions={state.assumptions} onChange={(prompt) => dispatch({ type: 'EDIT_PROMPT', prompt })} onBack={() => dispatch({ type: 'SET_STAGE', stage: state.questions.length ? 'questions' : 'methodology' })} onRegenerate={() => generate(undefined, 'Create an improved alternative while preserving confirmed decisions.')} onCopy={copy} onInsert={insert} />
  else if (state.stage === 'complete') view = <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-10 text-center"><CheckCircle2 className="mx-auto mb-3 text-[var(--color-success)]" size={34} /><h2 className="view-title">Prompt inserted</h2><p className="mt-1.5 text-[13px] text-[var(--color-muted)]">Review it in the composer. It was not sent.</p></div>
  else view = <div className="rounded-xl border border-[color-mix(in_srgb,var(--color-warning)_25%,var(--color-border))] bg-[var(--color-surface)] p-4 text-left"><div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 shrink-0 text-[var(--color-warning)]" size={19} /><div className="min-w-0"><h2 className="text-sm font-semibold">We hit a snag</h2><p role="alert" className="mt-1 text-xs leading-relaxed text-[var(--color-muted)]">{state.error}</p></div></div><Button className="mt-4 w-full" onClick={() => dispatch({ type: 'SET_STAGE', stage: state.roughInput ? 'welcome' : 'welcome' })}>Try again</Button></div>

  if (!workflowReady) return <Shell><Loading label="Restoring your workflow…" /></Shell>
  return <Shell step={step}>{notice && <button onClick={() => setNotice('')} className="mb-3 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-interactive)] px-3 py-2 text-left text-[11px] leading-relaxed text-[var(--color-text)] transition-colors hover:border-[#3a3f4d]">{notice}</button>}{view}</Shell>
}
