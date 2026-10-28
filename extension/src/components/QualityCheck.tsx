import { useState } from 'react'
import type { PromptQualityReview } from '../contracts'
import { Button } from './Controls'
import { StrategySummary } from './StrategySummary'

export function QualityCheck({ prompt, review, onRevision }: { prompt: string; review: () => Promise<PromptQualityReview>; onRevision: (value: string) => void }) {
  const [result, setResult] = useState<{ prompt: string; report: PromptQualityReview } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const check = async () => {
    if (busy) return
    setBusy(true); setError('')
    try { setResult({ prompt, report: await review() }) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Quality review failed. Try again.') }
    finally { setBusy(false) }
  }
  const report = result?.prompt === prompt ? result.report : null
  return <section className="mt-4 border-t border-[var(--color-border)] pt-3" aria-label="Prompt quality check">
    <Button tone="quiet" className="w-full" disabled={busy || prompt.trim().length < 10} onClick={check}>{busy ? 'Checking prompt quality…' : 'Check quality & strategy'}</Button>
    <p className="mt-2 text-[11px] text-[var(--color-muted)]">Uses a model review and a bounded check of any proposed issues. It checks instructions and strategy; it does not prove the task will succeed or execute tests.</p>
    {busy && <p role="status" className="mt-2 text-xs">Reviewing requirements, missing inputs and execution strategy…</p>}
    {error && <p role="alert" className="mt-2 text-xs text-[var(--color-warning)]">{error}</p>}
    {report && <div className="mt-3 text-xs leading-relaxed">
      <h3 className="text-sm font-semibold">{({ ready: 'Review found no blocking issues', needs_revision: 'Review suggests revisions', needs_input: 'Review suggests clarifying inputs' })[report.verdict]}</h3>
      {report.strengths.length > 0 && <ul className="mt-2 list-disc pl-4">{report.strengths.map((text, index) => <li key={index}>{text}</li>)}</ul>}
      {report.issues.map((issue, index) => <div key={index} className="mt-2 rounded-lg border border-[var(--color-border)] p-2"><strong>{issue.severity.toUpperCase()}: {issue.issue}</strong><p>{issue.improvement}</p>{issue.evidence && <blockquote className="mt-1 border-l border-[var(--color-border)] pl-2 text-[var(--color-muted)]">Evidence: {issue.evidence}</blockquote>}</div>)}
      {report.missing_inputs.length > 0 && <p className="mt-2 text-[var(--color-warning)]">Context to check: {report.missing_inputs.join('; ')}</p>}
      <StrategySummary strategy={report.recommended_strategy} />{report.review_notes && report.review_notes.length > 0 && <details className="my-2"><summary>Review verification notes</summary><ul className="list-disc pl-4">{report.review_notes.map((note, index) => <li key={index}>{note}</li>)}</ul></details>}
      {report.issues.length > 0 && <Button tone="quiet" className="w-full" onClick={() => onRevision(`Address these review suggestions without inventing requirements or resolving skipped choices: ${report.issues.map((issue) => issue.improvement).join('; ')}`)}>Use suggestions as revision instructions</Button>}
    </div>}
    {result && !report && <p className="mt-2 text-xs text-[var(--color-warning)]">The prompt has changed. Run the quality check again.</p>}
  </section>
}
