import { useEffect, useReducer, useState } from 'react'
import { initialWorkflow, workflowReducer, type WorkflowState } from '../state/workflow'

const KEY = 'voicePromptWorkflow'

function loadLocalWorkflow(): WorkflowState {
  const saved = localStorage.getItem(KEY)
  if (!saved) return initialWorkflow
  try { return JSON.parse(saved) as WorkflowState } catch {
    localStorage.removeItem(KEY)
    return initialWorkflow
  }
}

export function useWorkflow() {
  const usesChromeStorage = typeof chrome !== 'undefined' && Boolean(chrome.storage?.local)
  const [state, dispatch] = useReducer(
    workflowReducer,
    undefined,
    () => usesChromeStorage ? initialWorkflow : loadLocalWorkflow(),
  )
  const [ready, setReady] = useState(!usesChromeStorage)

  useEffect(() => {
    if (!usesChromeStorage) return
    chrome.storage.local.get(KEY).then((value) => {
      if (value[KEY]) dispatch({ type: 'HYDRATE', state: value[KEY] as WorkflowState })
      setReady(true)
    }).catch(() => { setReady(true) })
  }, [usesChromeStorage])

  useEffect(() => {
    if (!ready) return
    if (usesChromeStorage) chrome.storage.local.set({ [KEY]: state }).catch(() => undefined)
    else localStorage.setItem(KEY, JSON.stringify(state))
  }, [ready, state, usesChromeStorage])

  return [state, dispatch, ready] as const
}
