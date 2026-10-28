import { useEffect, useState } from 'react'
import { getBackendToken, setBackendToken } from '../services/api'
import { Button } from './Controls'

export function ConnectionSettings() {
  const [token, setToken] = useState('')
  const [message, setMessage] = useState('')
  useEffect(() => { void getBackendToken().then(setToken).catch(() => setMessage('Connection settings could not be restored.')) }, [])
  return <details className="mb-4 rounded-lg border border-[var(--color-border)] p-3">
    <summary className="cursor-pointer text-xs">Backend connection</summary>
    <p className="my-2 text-xs text-[var(--color-muted)]">Paste the single-line local token from the project’s .backend-token file (also printed at startup). Do not paste a Gnani or OpenRouter API key here. This token is kept for this browser session.</p>
    <input aria-label="Backend access token" type="password" autoComplete="off" maxLength={256} value={token} onChange={(event) => setToken(event.target.value)} className="editor" />
    <Button className="mt-2" tone="quiet" onClick={async () => { try { await setBackendToken(token); setMessage('Connection token saved for this browser session.') } catch { setMessage('Could not save the connection token. Try again.') } }}>Save connection</Button>
    {message && <p role="status" className="mt-2 text-xs">{message}</p>}
  </details>
}
