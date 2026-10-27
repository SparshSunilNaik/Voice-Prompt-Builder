import { CheckCircle2, ExternalLink, Mic, ShieldAlert, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '../components/Controls'
import { currentMicrophonePermission } from '../services/microphonePermission'
import type { MicrophonePermissionStatus } from '../services/messages'

type PageState = 'checking' | 'ready' | 'requesting' | 'granted' | 'denied' | 'error'

async function report(status: MicrophonePermissionStatus) {
  await chrome.runtime.sendMessage({ type: 'MICROPHONE_PERMISSION_PAGE_RESULT', status })
}

export function MicrophonePermissionPage() {
  const [state, setState] = useState<PageState>('checking')
  const [detail, setDetail] = useState('')

  useEffect(() => {
    void currentMicrophonePermission().then((permission) => {
      if (permission === 'granted') {
        setState('granted')
        void report('granted')
      } else {
        setState(permission === 'denied' ? 'denied' : 'ready')
      }
    })
  }, [])

  const requestAccess = async () => {
    setState('requesting')
    setDetail('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((track) => track.stop())
      setState('granted')
      await report('granted')
    } catch (reason) {
      const denied = reason instanceof DOMException
        && (reason.name === 'NotAllowedError' || reason.name === 'SecurityError')
      setState(denied ? 'denied' : 'error')
      setDetail(denied
        ? 'Chrome blocked microphone access for this extension.'
        : 'Chrome could not access a microphone. Check the selected input device and try again.')
      await report('denied')
    }
  }

  const cancel = async () => {
    await report('cancelled')
  }

  const openSettings = () => {
    void chrome.tabs.create({ url: 'chrome://settings/content/microphone' })
  }

  return <main className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] p-6 text-[var(--color-text)]">
    <section className="w-full max-w-lg rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[0_12px_36px_rgba(0,0,0,0.24)]">
      <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-interactive)] text-[var(--color-accent)]"><Mic size={22} /></div>
      <p className="eyebrow">One-time Chrome permission</p>
      <h1 className="text-2xl font-semibold">Allow microphone access</h1>
      <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-muted)]">Voice Prompt Builder records only after you press Speak. Audio is sent to your local backend for transcription and is not stored by the extension.</p>

      {(state === 'checking' || state === 'requesting') && <div className="mt-5 rounded-lg border border-[var(--color-border)] bg-[var(--color-interactive)] p-3 text-[13px] text-[var(--color-text)]">{state === 'checking' ? 'Checking Chrome microphone permission…' : 'Complete the Chrome permission prompt…'}</div>}

      {(state === 'ready' || state === 'error') && <div className="mt-5 space-y-3">
        {state === 'error' && <p role="alert" className="rounded-lg border border-[color-mix(in_srgb,var(--color-warning)_25%,var(--color-border))] bg-[color-mix(in_srgb,var(--color-warning)_7%,var(--color-surface))] p-3 text-[13px] text-[var(--color-warning)]">{detail}</p>}
        <Button className="w-full" icon={<Mic size={17} />} onClick={requestAccess}>Allow microphone</Button>
        <Button className="w-full" tone="quiet" icon={<X size={16} />} onClick={cancel}>Not now</Button>
      </div>}

      {state === 'denied' && <div className="mt-5" role="alert">
        <div className="rounded-lg border border-[color-mix(in_srgb,var(--color-warning)_25%,var(--color-border))] bg-[color-mix(in_srgb,var(--color-warning)_7%,var(--color-surface))] p-3">
          <div className="flex items-center gap-2 text-[13px] font-medium text-[var(--color-warning)]"><ShieldAlert size={17} /> Microphone permission is blocked</div>
          <p className="mt-2 text-xs leading-relaxed text-[var(--color-muted)]">{detail || 'Chrome currently blocks microphone access for this extension.'} Open Chrome microphone settings, enable “Sites can ask to use your microphone,” remove any blocked Voice Prompt Builder entry, then return here and retry.</p>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Button tone="quiet" icon={<ExternalLink size={15} />} onClick={openSettings}>Open settings</Button>
          <Button icon={<Mic size={16} />} onClick={requestAccess}>Retry permission</Button>
        </div>
        <Button className="mt-2 w-full" tone="quiet" onClick={cancel}>Cancel voice input</Button>
      </div>}

      {state === 'granted' && <div className="mt-5 rounded-lg border border-[color-mix(in_srgb,var(--color-success)_25%,var(--color-border))] bg-[color-mix(in_srgb,var(--color-success)_7%,var(--color-surface))] p-4 text-center text-[var(--color-success)]">
        <CheckCircle2 className="mx-auto mb-3" size={30} />
        <p className="font-medium">Microphone access allowed</p>
        <p className="mt-1 text-xs text-[var(--color-muted)]">This tab will close and recording will continue in the side panel.</p>
      </div>}
    </section>
  </main>
}
