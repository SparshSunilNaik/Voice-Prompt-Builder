import { useState } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Loading, Button } from './components/Controls'
import { InputPanel } from './components/InputPanel'
import { RecordingPanel } from './components/RecordingPanel'
import { Shell } from './components/Shell'
import { useRecorder } from './hooks/useRecorder'
import { useWorkflow } from './hooks/useWorkflow'
import { api, ApiError } from './services/api'
import { MethodologyReview, PromptReview, QuestionsView, TranscriptReview } from './components/WorkflowViews'

export function App() {
  const [state, dispatch] = useWorkflow()
  const [notice, setNotice] = useState('')
  const recording = useRecorder(60)
  const fail = (reason: unknown) => dispatch({ type: 'FAIL', message: reason instanceof ApiError ? reason.message : 'Something went wrong. Please try again.' })

  const analyze = async (input = state.roughInput) => {
    dispatch({ type: 'SET_STAGE', stage: 'analyzing' })
    try { dispatch({ type: 'SET_ANALYSIS', analysis: (await api.analyze(input)).analysis }) } catch (error) { fail(error) }
  }
  const beginRecording = async () => {
    dispatch({ type: 'SET_STAGE', stage: 'listening' })
    const blob = await recording.start()
    if (!blob) { dispatch({ type: 'SET_STAGE', stage: 'welcome' }); return }
    dispatch({ type: 'SET_STAGE', stage: 'transcribing' })
    try { dispatch({ type: 'SET_TRANSCRIPT', value: await api.transcribe(blob) }) } catch (error) { fail(error) }
  }
  const cancelRecording = () => {
    recording.cancel()
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
    try { await navigator.clipboard.writeText(state.finalPrompt); setNotice('Prompt copied to clipboard') }
    catch { setNotice('Clipboard access failed. Select the prompt and copy it manually.') }
  }

  const step = ['welcome', 'listening', 'transcribing', 'transcript'].includes(state.stage) ? 0 : ['analyzing', 'methodology'].includes(state.stage) ? 1 : state.stage === 'questions' ? 2 : 3
  let view
  if (state.stage === 'welcome') view = <InputPanel value={state.roughInput} onChange={(value) => dispatch({ type: 'SET_INPUT', value })} onContinue={() => analyze()} onRecord={beginRecording} />
  else if (state.stage === 'listening') view = <RecordingPanel elapsed={recording.elapsed} requesting={recording.status === 'requesting'} onStop={recording.stop} onCancel={cancelRecording} />
  else if (state.stage === 'transcribing') view = <Loading label="Transcribing your idea…" />
  else if (state.stage === 'transcript') view = <TranscriptReview value={state.roughInput} onChange={(value) => dispatch({ type: 'SET_INPUT', value })} onBack={() => dispatch({ type: 'SET_STAGE', stage: 'welcome' })} onContinue={() => analyze()} />
  else if (state.stage === 'analyzing') view = <Loading label="Understanding your goal…" />
  else if (state.stage === 'methodology' && state.analysis && state.methodology) view = <MethodologyReview analysis={state.analysis} selected={state.methodology} instructions={state.methodologyInstructions} onSelect={(methodology) => dispatch({ type: 'EDIT_METHODOLOGY', methodology })} onInstructions={(instructions) => dispatch({ type: 'EDIT_METHODOLOGY', instructions })} onBack={() => dispatch({ type: 'SET_STAGE', stage: 'welcome' })} onContinue={refine} />
  else if (state.stage === 'questions') view = <QuestionsView questions={state.questions} answers={state.answers} onAnswer={(questionId, answer) => dispatch({ type: 'ANSWER', questionId, answer })} onSkip={(questionId) => dispatch({ type: 'SKIP', questionId })} onBack={() => dispatch({ type: 'SET_STAGE', stage: 'methodology' })} onGenerate={() => generate()} />
  else if (state.stage === 'generating') view = <Loading label="Building your prompt…" />
  else if (state.stage === 'review') view = <PromptReview prompt={state.finalPrompt} assumptions={state.assumptions} onChange={(prompt) => dispatch({ type: 'EDIT_PROMPT', prompt })} onBack={() => dispatch({ type: 'SET_STAGE', stage: state.questions.length ? 'questions' : 'methodology' })} onRegenerate={() => generate(undefined, 'Create an improved alternative while preserving confirmed decisions.')} onCopy={copy} onInsert={copy} />
  else if (state.stage === 'complete') view = <div className="py-16 text-center"><CheckCircle2 className="mx-auto mb-4 text-emerald-300" size={44} /><h2 className="view-title">Prompt inserted</h2><p className="mt-2 text-sm text-slate-400">Review it in the composer. It was not sent.</p></div>
  else view = <div className="py-12 text-center"><AlertTriangle className="mx-auto mb-4 text-amber-300" size={40} /><h2 className="view-title">We hit a snag</h2><p role="alert" className="mx-auto mt-2 max-w-xs text-sm text-slate-400">{state.error}</p><Button className="mt-6" onClick={() => dispatch({ type: 'SET_STAGE', stage: state.roughInput ? 'welcome' : 'welcome' })}>Try again</Button></div>

  return <Shell step={step}>{notice && <button onClick={() => setNotice('')} className="mb-3 w-full rounded-xl border border-blue-400/20 bg-blue-500/10 p-2 text-xs text-blue-200">{notice}</button>}{view}</Shell>
}
