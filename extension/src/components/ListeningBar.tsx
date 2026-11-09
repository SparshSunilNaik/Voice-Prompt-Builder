import { Mic, Square, X } from 'lucide-react'
import type { VoicePhase } from '../hooks/useVoiceAnswer'
import type { RecorderStatus } from '../hooks/useRecorder'
import { Button } from './Controls'

/** Compact hands-free listening indicator that keeps the question and options visible. */
export function ListeningBar({ phase, status, elapsed, onDone, onCancel }: { phase: VoicePhase; status: RecorderStatus; elapsed: number; onDone: () => void; onCancel: () => void }) {
  if (phase === 'idle') return null
  const recording = phase === 'listening' && status === 'recording'
  const label = phase === 'transcribing' ? 'Transcribing your answer…' : status === 'stopping' ? 'Finishing…' : recording ? 'Listening — answer now, then pause' : 'Opening microphone…'
  return <div role="status" aria-live="polite" className="my-3 flex items-center gap-3 rounded-xl border border-[color-mix(in_srgb,var(--color-success)_30%,var(--color-border))] bg-[color-mix(in_srgb,var(--color-success)_6%,var(--color-surface))] p-3">
    <span className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-[var(--color-success)] ${recording ? 'border-[color-mix(in_srgb,var(--color-success)_40%,transparent)]' : 'border-[var(--color-border)] text-[var(--color-muted)]'}`}>
      {recording && <span className="recording-pulse absolute inset-[-4px] rounded-full border border-[color-mix(in_srgb,var(--color-success)_24%,transparent)]" />}
      <Mic size={16} />
    </span>
    <div className="min-w-0 flex-1">
      <p className="text-[12px] font-medium">{label}</p>
      {phase === 'listening' && <p className="text-[10px] text-[var(--color-muted)]">{elapsed}s · stops when you pause, or tap an option</p>}
    </div>
    {phase === 'listening' && <div className="flex shrink-0 gap-1.5">
      <Button tone="quiet" aria-label="Stop listening" icon={<X size={14} />} onClick={onCancel} className="min-h-8 px-2" />
      <Button aria-label="Done speaking" icon={<Square size={13} />} disabled={!recording} onClick={onDone} className="min-h-8 px-2.5">Done</Button>
    </div>}
    {phase === 'transcribing' && <Button tone="quiet" onClick={onCancel} className="min-h-8 px-2.5">Cancel</Button>}
  </div>
}
