import { useEffect, useReducer, useRef } from 'react'
import { initialWorkflow, workflowReducer, type WorkflowState } from '../state/workflow'

const KEY = 'voicePromptWorkflow'

export function useWorkflow() {
  const [state, dispatch] = useReducer(workflowReducer, initialWorkflow)
  const hydrated = useRef(false)

  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get(KEY).then((value) => {
        if (value[KEY]) dispatch({ type: 'HYDRATE', state: value[KEY] as WorkflowState })
        hydrated.current = true
      }).catch(() => { hydrated.current = true })
    } else {
      const saved = localStorage.getItem(KEY)
      if (saved) {
        try { dispatch({ type: 'HYDRATE', state: JSON.parse(saved) as WorkflowState }) } catch { localStorage.removeItem(KEY) }
      }
      hydrated.current = true
    }
  }, [])

  useEffect(() => {
    if (!hydrated.current) return
    if (typeof chrome !== 'undefined' && chrome.storage?.local) chrome.storage.local.set({ [KEY]: state }).catch(() => undefined)
    else localStorage.setItem(KEY, JSON.stringify(state))
  }, [state])

  return [state, dispatch] as const
}
