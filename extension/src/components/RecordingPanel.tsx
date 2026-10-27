import { Mic, Square, X } from 'lucide-react'
import { Button } from './Controls'
import { Panel } from './Shell'

export function RecordingPanel({ elapsed, requesting, onStop, onCancel }: { elapsed: number; requesting: boolean; onStop: () => void; onCancel: () => void }) {
  const time = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`
  return <Panel className="text-center">
    <div className="relative mx-auto mb-6 mt-4 flex h-24 w-24 items-center justify-center rounded-full bg-red-500/10">
      {!requesting && <span className="absolute inset-0 animate-ping rounded-full border border-red-400/20" />}
      <Mic className={requesting ? 'text-slate-500' : 'text-red-300'} size={34} />
    </div>
    <p className="text-xs font-medium uppercase tracking-[0.2em] text-red-300">{requesting ? 'Requesting microphone' : 'Listening'}</p>
    <p aria-label="Elapsed recording time" className="my-3 font-mono text-3xl font-light tabular-nums">{time}</p>
    <p className="mb-6 text-xs text-slate-500">Recording stops automatically at 60 seconds.</p>
    <div className="grid grid-cols-2 gap-2"><Button tone="quiet" icon={<X size={16} />} onClick={onCancel}>Cancel</Button><Button icon={<Square size={15} />} disabled={requesting} onClick={onStop}>Stop</Button></div>
  </Panel>
}
