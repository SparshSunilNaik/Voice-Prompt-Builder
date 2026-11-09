import { useEffect, useRef, useState } from 'react'
import { Mic, RefreshCw, RotateCcw } from 'lucide-react'
import type { PromptingStrategy } from '../contracts'
import { useVoiceAnswer } from '../hooks/useVoiceAnswer'
import { FEEDBACK_REASONS, reasonsFromSpeech, type FeedbackReason } from '../services/feedbackMemory'
import { speakQuestion, stopSpeaking } from '../services/speech'
import { Button } from './Controls'
import { ListeningBar } from './ListeningBar'

export interface RegenerateRequest {
  reasons: FeedbackReason[]
  note: string
  /** Set when the user picked a different prompting technique. */
  strategy?: PromptingStrategy
}

const QUESTION = 'What should change in this prompt? Pick a reason, or tell me in your own words.'
const EXAMPLES = [['zero_shot', 'Zero-shot'], ['one_shot', 'One-shot'], ['few_shot', 'Few-shot']] as const
const REASONING = [['direct', 'Direct'], ['chain_of_thought', 'Chain-of-thought'], ['decompose_and_verify', 'Decompose & verify']] as const
const BASE: PromptingStrategy = { example_count: 0, example_source: 'none', examples: 'zero_shot', reasoning: 'direct', techniques: [], execution: 'single_pass', max_iterations: 1, rationale: 'Chosen by the user after feedback.', example_requirement: 'No reference examples required.', success_criteria: [] }

function withTechnique(base: PromptingStrategy | undefined, examples: PromptingStrategy['examples'], reasoning: PromptingStrategy['reasoning']): PromptingStrategy {
  const start = base ?? BASE
  const previous = start.example_count ?? 0
  const count = examples === 'zero_shot' ? 0 : examples === 'one_shot' ? 1 : previous >= 2 ? previous : 3
  const source = count === 0 ? 'none' : start.example_source && start.example_source !== 'none' ? start.example_source : 'illustrative'
  return { ...start, examples, reasoning, example_count: count, example_source: source, rationale: `The user asked for ${examples.replace('_', '-')} with ${reasoning.replace(/_/g, ' ')} reasoning after rejecting the previous prompt.` }
}

const chip = (on: boolean) => `min-h-8 rounded-md border px-2.5 py-1 text-[11px] transition-colors ${on ? 'border-[var(--color-accent)] bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)] text-[var(--color-text)]' : 'border-[var(--color-border)] bg-[var(--color-interactive)] text-[var(--color-muted)] hover:text-[var(--color-text)]'}`

export function RegenerateFeedback({ voice, strategy, initialNote = '', onSubmit, onCancel }: { voice: boolean; strategy?: PromptingStrategy; initialNote?: string; onSubmit: (request: RegenerateRequest) => void; onCancel: () => void }) {
  const [reasons, setReasons] = useState<FeedbackReason[]>([])
  const [note, setNote] = useState(initialNote)
  const [examples, setExamples] = useState<PromptingStrategy['examples']>(strategy?.examples ?? 'zero_shot')
  const [reasoning, setReasoning] = useState<PromptingStrategy['reasoning']>(strategy?.reasoning ?? 'direct')
  const [speechError, setSpeechError] = useState('')
  const capture = useVoiceAnswer()
  const turn = useRef(0)
  const { listen, cancel } = capture

  const toggle = (reason: FeedbackReason) => setReasons((current) => current.includes(reason) ? current.filter((item) => item !== reason) : [...current, reason])
  const hear = async () => {
    const transcript = await listen()
    if (!transcript) return
    setNote((current) => (current.trim() ? `${current.trim()} ${transcript}` : transcript).slice(0, 5000))
    const implied = reasonsFromSpeech(transcript)
    if (implied.length) setReasons((current) => [...new Set([...current, ...implied])])
  }
  // In voice mode, ask what was wrong and listen without another click.
  // Only reports through callbacks, so it is safe to start from an effect.
  const speakThenListen = () => {
    const id = ++turn.current
    const next = () => { if (id === turn.current) void hear() }
    speakQuestion(QUESTION, () => { if (id !== turn.current) return; setSpeechError('Speech playback is unavailable. Tell me what to change, or pick a reason.'); next() }, next)
  }
  const askAloud = () => { setSpeechError(''); speakThenListen() }
  const interrupt = () => { turn.current += 1; stopSpeaking(); if (capture.phase !== 'idle') cancel() }
  useEffect(() => {
    if (voice) speakThenListen()
    return () => { turn.current += 1; stopSpeaking(); cancel() }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ask once when the form opens
  }, [])

  const techniqueChanged = reasons.includes('wrong_technique') && (examples !== (strategy?.examples ?? 'zero_shot') || reasoning !== (strategy?.reasoning ?? 'direct'))
  const ready = reasons.length > 0 || note.trim().length > 0
  const busy = capture.phase !== 'idle'
  return <section aria-label="Regeneration feedback" className="mt-3 rounded-xl border border-[color-mix(in_srgb,var(--color-accent)_35%,var(--color-border))] bg-[var(--color-surface)] p-3">
    <h3 className="text-[13px] font-semibold">What should change?</h3>
    <p className="mt-1 text-[11px] text-[var(--color-muted)]">Your feedback rewrites this prompt and is remembered, so later prompts avoid the same problems.</p>
    <div role="group" aria-label="What was wrong" className="mt-2.5 flex flex-wrap gap-1.5">
      {FEEDBACK_REASONS.map((reason) => <button key={reason.id} aria-pressed={reasons.includes(reason.id)} className={chip(reasons.includes(reason.id))} onClick={() => { interrupt(); toggle(reason.id) }}>{reason.label}</button>)}
    </div>
    {reasons.includes('wrong_technique') && <div className="mt-3 space-y-2 text-[11px]">
      <div role="group" aria-label="Use examples" className="flex flex-wrap items-center gap-1.5"><span className="w-16 text-[var(--color-muted)]">Examples</span>{EXAMPLES.map(([value, label]) => <button key={value} aria-pressed={examples === value} className={chip(examples === value)} onClick={() => setExamples(value)}>{label}</button>)}</div>
      <div role="group" aria-label="Use reasoning" className="flex flex-wrap items-center gap-1.5"><span className="w-16 text-[var(--color-muted)]">Reasoning</span>{REASONING.map(([value, label]) => <button key={value} aria-pressed={reasoning === value} className={chip(reasoning === value)} onClick={() => setReasoning(value)}>{label}</button>)}</div>
    </div>}
    <textarea aria-label="What to change" maxLength={5000} value={note} onFocus={() => { if (busy) interrupt() }} onChange={(event) => setNote(event.target.value)} className="editor mt-3 min-h-20" placeholder={voice ? 'Your spoken feedback appears here. You can edit it.' : 'Tell us what to change (optional if you picked a reason)'} />
    <ListeningBar phase={capture.phase} status={capture.recorderStatus} elapsed={capture.elapsed} onDone={capture.stop} onCancel={interrupt} />
    {(capture.error || speechError) && !busy && <p role="alert" className="mt-2 text-xs text-[var(--color-warning)]">{capture.error || speechError}</p>}
    <>
      {!busy && (voice
        ? <Button className="mt-2 w-full" tone="quiet" icon={<RotateCcw size={14} />} onClick={askAloud}>Ask again &amp; listen</Button>
        : <Button className="mt-2 w-full" tone="quiet" icon={<Mic size={14} />} onClick={() => { interrupt(); void hear() }}>Say it instead</Button>)}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button tone="quiet" onClick={() => { interrupt(); onCancel() }}>Cancel</Button>
        <Button icon={<RefreshCw size={14} />} disabled={!ready} onClick={() => { interrupt(); onSubmit({ reasons, note: note.trim(), strategy: techniqueChanged ? withTechnique(strategy, examples, reasoning) : undefined }) }}>Regenerate with feedback</Button>
      </div>
    </>
  </section>
}
