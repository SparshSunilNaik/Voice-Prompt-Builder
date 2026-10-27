import { useReducer } from 'react'
import { InputPanel } from './components/InputPanel'
import { Shell } from './components/Shell'
import { initialWorkflow, workflowReducer } from './state/workflow'

export function App() {
  const [state, dispatch] = useReducer(workflowReducer, initialWorkflow)
  return (
    <Shell><InputPanel value={state.roughInput} onChange={(value) => dispatch({ type: 'SET_INPUT', value })} onContinue={() => dispatch({ type: 'SET_STAGE', stage: 'analyzing' })} onRecord={() => dispatch({ type: 'SET_STAGE', stage: 'listening' })} /></Shell>
  )
}
