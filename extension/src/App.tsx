import { useReducer } from 'react'
import { InputPanel } from './components/InputPanel'
import { RecordingPanel } from './components/RecordingPanel'
import { Shell } from './components/Shell'
import { useRecorder } from './hooks/useRecorder'
import { initialWorkflow, workflowReducer } from './state/workflow'

export function App() {
  const [state, dispatch] = useReducer(workflowReducer, initialWorkflow)
  const recording = useRecorder(60)
  const beginRecording = async () => {
    dispatch({ type: 'SET_STAGE', stage: 'listening' })
    const blob = await recording.start()
    dispatch({ type: 'SET_STAGE', stage: blob ? 'transcribing' : 'welcome' })
  }
  const cancelRecording = () => {
    recording.cancel()
    dispatch({ type: 'SET_STAGE', stage: 'welcome' })
  }
  return (
    <Shell>{state.stage === 'listening'
      ? <RecordingPanel elapsed={recording.elapsed} requesting={recording.status === 'requesting'} onStop={recording.stop} onCancel={cancelRecording} />
      : <InputPanel value={state.roughInput} onChange={(value) => dispatch({ type: 'SET_INPUT', value })} onContinue={() => dispatch({ type: 'SET_STAGE', stage: 'analyzing' })} onRecord={beginRecording} />}
    </Shell>
  )
}
