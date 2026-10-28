import { Mic, Square, X } from 'lucide-react'
import { Button } from './Controls'
import { Panel } from './Shell'
import { MAX_RECORDING_SECONDS } from '../contracts'

export function RecordingPanel({ elapsed, requesting, permissionDenied = false, stopping = false, onStop, onCancel }: { elapsed: number; requesting: boolean; permissionDenied?: boolean; stopping?: boolean; onStop: () => void; onCancel: () => void }) {
  const time = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`
  const indicatorTone = permissionDenied ? 'border-[color-mix(in_srgb,var(--color-warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-warning)_8%,transparent)] text-[var(--color-warning)]' : requesting || stopping ? 'border-[var(--color-border)] bg-[var(--color-interactive)] text-[var(--color-muted)]' : 'border-[color-mix(in_srgb,var(--color-success)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-success)_8%,transparent)] text-[var(--color-success)]'
  return <Panel className="text-center">
    <div className={`relative mx-auto mb-4 mt-2 flex h-18 w-18 items-center justify-center rounded-full border ${indicatorTone}`}>
      {!requesting && !stopping && !permissionDenied && <span className="recording-pulse absolute inset-[-5px] rounded-full border border-[color-mix(in_srgb,var(--color-success)_24%,transparent)]" />}
      <Mic size={27} />
    </div>
    <p className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${permissionDenied ? 'text-[var(--color-warning)]' : !requesting && !stopping ? 'text-[var(--color-success)]' : 'text-[var(--color-muted)]'}`}>{permissionDenied ? 'Permission blocked' : requesting ? 'Requesting microphone' : stopping ? 'Finishing recording' : 'Listening'}</p>
    <p aria-label="Elapsed recording time" className="my-2 font-mono text-[28px] font-medium tracking-[-0.04em] tabular-nums">{time}</p>
    <p className="mx-auto mb-5 max-w-64 text-[11px] leading-relaxed text-[var(--color-muted)]">{permissionDenied ? 'Follow the recovery steps in the microphone permission tab, then retry there.' : requesting ? 'Complete the one-time permission step in the Chrome tab.' : `Recording stops automatically at ${MAX_RECORDING_SECONDS} seconds.`}</p>
    <div className="grid grid-cols-2 gap-2"><Button tone="quiet" icon={<X size={16} />} disabled={stopping} onClick={onCancel}>Cancel</Button><Button icon={<Square size={15} />} disabled={requesting || stopping} onClick={onStop}>{stopping ? 'Finishing…' : 'Stop'}</Button></div>
  </Panel>
}
