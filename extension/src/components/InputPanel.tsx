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
    <div className="mb-4"><p className="eyebrow">Start with the idea</p><h2 className="text-[22px] font-semibold leading-[1.2] tracking-[-0.025em]">What do you want to accomplish?</h2><p className="mt-2 text-[13px] leading-relaxed text-[var(--color-muted)]">Rough is perfect. We’ll ask only what matters.</p></div>
    <Panel>
      <textarea maxLength={20000} autoFocus aria-label="Rough prompt" value={value} onChange={(event) => onChange(event.target.value)} className="min-h-36 w-full resize-none bg-transparent text-sm leading-[1.65] text-[var(--color-text)] outline-none placeholder:text-[#666d7e]" placeholder="Type a rough idea, or record your voice…" />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button tone="quiet" icon={<Mic size={17} />} onClick={onRecord}>Speak</Button>
        <Button icon={<ArrowRight size={17} />} disabled={value.trim().length < 3} onClick={onContinue}>Continue</Button>
      </div>
    </Panel>
    <p className="mt-3 text-center text-[10px] text-[var(--color-muted)]">Voice uses Gnani transcription. Questions follow your chosen input mode.</p>
  </>
}
