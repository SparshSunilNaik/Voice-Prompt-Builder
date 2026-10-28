import type { PromptingStrategy } from '../contracts'

export function StrategySummary({ strategy }: { strategy?: PromptingStrategy }) {
  if (!strategy || !Array.isArray(strategy.success_criteria) || !Number.isInteger(strategy.max_iterations) || strategy.max_iterations < 1 || strategy.max_iterations > 5) return null
  const examples = { zero_shot: 'Zero-shot · no examples', one_shot: 'One-shot · one example', few_shot: 'Few-shot · several examples' }
  return <section aria-label="Prompting strategy" className="my-3 rounded-lg border border-[var(--color-border)] p-3 text-xs leading-relaxed">
    <h3 className="font-semibold">Prompting strategy</h3>
    <p className="mt-1">{examples[strategy.examples]} · {strategy.reasoning === 'direct' ? 'Direct response' : 'Plan and verify'}</p>
    <p>{strategy.execution === 'single_pass' ? 'Single response' : `Bounded implementation loop · up to ${strategy.max_iterations} cycles`}</p>
    <p className="mt-2 text-[var(--color-muted)]">{strategy.rationale}</p>
    {strategy.examples !== 'zero_shot' && <p className="mt-2">Examples needed: {strategy.example_requirement}</p>}
    {strategy.success_criteria.length > 0 && <ul className="mt-2 list-disc pl-4">{strategy.success_criteria.map((criterion, index) => <li key={index}>{criterion}</li>)}</ul>}
    {strategy.execution === 'bounded_iteration' && <p className="mt-2 text-[var(--color-warning)]">Execution requires tools in the destination chat. The extension generates instructions; it does not run the task.</p>}
  </section>
}
