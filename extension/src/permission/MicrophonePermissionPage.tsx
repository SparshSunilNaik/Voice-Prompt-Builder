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

  return <main className="flex min-h-screen items-center justify-center bg-[#090a0f] p-6 text-slate-100">
    <section className="w-full max-w-lg rounded-3xl border border-white/10 bg-white/[0.055] p-8 shadow-2xl shadow-black/30 backdrop-blur-xl">
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-300"><Mic size={28} /></div>
      <p className="eyebrow">One-time Chrome permission</p>
      <h1 className="text-2xl font-semibold">Allow microphone access</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-400">Voice Prompt Builder records only after you press Speak. Audio is sent to your local backend for transcription and is not stored by the extension.</p>

      {(state === 'checking' || state === 'requesting') && <div className="mt-7 rounded-2xl border border-blue-400/15 bg-blue-500/10 p-4 text-sm text-blue-100">{state === 'checking' ? 'Checking Chrome microphone permission…' : 'Complete the Chrome permission prompt…'}</div>}

      {(state === 'ready' || state === 'error') && <div className="mt-7 space-y-4">
        {state === 'error' && <p role="alert" className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100">{detail}</p>}
        <Button className="w-full" icon={<Mic size={17} />} onClick={requestAccess}>Allow microphone</Button>
        <Button className="w-full" tone="quiet" icon={<X size={16} />} onClick={cancel}>Not now</Button>
      </div>}

      {state === 'denied' && <div className="mt-7" role="alert">
        <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-100"><ShieldAlert size={17} /> Microphone permission is blocked</div>
          <p className="mt-2 text-xs leading-relaxed text-amber-100/70">{detail || 'Chrome currently blocks microphone access for this extension.'} Open Chrome microphone settings, enable “Sites can ask to use your microphone,” remove any blocked Voice Prompt Builder entry, then return here and retry.</p>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Button tone="quiet" icon={<ExternalLink size={15} />} onClick={openSettings}>Open settings</Button>
          <Button icon={<Mic size={16} />} onClick={requestAccess}>Retry permission</Button>
        </div>
        <Button className="mt-2 w-full" tone="quiet" onClick={cancel}>Cancel voice input</Button>
      </div>}

      {state === 'granted' && <div className="mt-7 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-5 text-center text-emerald-100">
        <CheckCircle2 className="mx-auto mb-3" size={30} />
        <p className="font-medium">Microphone access allowed</p>
        <p className="mt-1 text-xs text-emerald-100/70">This tab will close and recording will continue in the side panel.</p>
      </div>}
    </section>
  </main>
}
