import { ArrowRight, Mic } from 'lucide-react'
import { Button } from './Controls'
import { Panel } from './Shell'

interface Props {
  value: string
  onChange: (value: string) => void
  onContinue: () => void
  onRecord: () => void
}

export function InputPanel({ value, onChange, onContinue, onRecord }: Props) {
  return <>
    <div className="mb-5"><p className="mb-1 text-xs font-medium uppercase tracking-[0.18em] text-violet-300">Start with the idea</p><h2 className="text-2xl font-semibold leading-tight">What do you want to accomplish?</h2><p className="mt-2 text-sm leading-relaxed text-slate-400">Rough is perfect. We’ll ask only what matters.</p></div>
    <Panel>
      <textarea autoFocus aria-label="Rough prompt" value={value} onChange={(event) => onChange(event.target.value)} className="min-h-40 w-full resize-none bg-transparent text-[15px] leading-relaxed text-slate-100 outline-none placeholder:text-slate-600" placeholder="Type a rough idea, or record your voice…" />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button tone="quiet" icon={<Mic size={17} />} onClick={onRecord}>Speak</Button>
        <Button icon={<ArrowRight size={17} />} disabled={value.trim().length < 3} onClick={onContinue}>Continue</Button>
      </div>
    </Panel>
    <p className="mt-4 text-center text-[11px] text-slate-600">Your audio is discarded immediately after transcription.</p>
  </>
}
