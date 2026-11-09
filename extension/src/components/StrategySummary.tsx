import type { PromptingStrategy, SupportingTechnique } from '../contracts'

const TECHNIQUES: Record<SupportingTechnique, string> = {
  role_prompting: 'Role prompting',
  structured_output: 'Structured output',
  step_back: 'Step-back principles',
  self_consistency: 'Self-consistency',
  self_critique: 'Self-critique',
  constraint_checklist: 'Constraint checklist',
}

function exampleLabel(strategy: PromptingStrategy): string {
  const count = strategy.example_count ?? (strategy.examples === 'one_shot' ? 1 : strategy.examples === 'few_shot' ? 3 : 0)
  if (strategy.examples === 'zero_shot') return 'Zero-shot · no examples'
  const source = strategy.example_source === 'user_supplied' ? 'of your examples' : 'illustrative example'
  return strategy.examples === 'one_shot' ? `One-shot · 1 ${source}` : `Few-shot · ${count} ${source}${strategy.example_source === 'user_supplied' ? '' : 's'}`
}

const REASONING: Record<PromptingStrategy['reasoning'], string> = {
  direct: 'Direct answer',
  chain_of_thought: 'Chain-of-thought · step-by-step reasoning',
  decompose_and_verify: 'Decompose & verify',
}

export function StrategySummary({ strategy, title = 'Prompting strategy' }: { strategy?: PromptingStrategy; title?: string }) {
  if (!strategy || !Array.isArray(strategy.success_criteria) || !Number.isInteger(strategy.max_iterations) || strategy.max_iterations < 1 || strategy.max_iterations > 5) return null
  const chips = [exampleLabel(strategy), REASONING[strategy.reasoning] ?? strategy.reasoning, ...(strategy.techniques ?? []).map((technique) => TECHNIQUES[technique] ?? technique)]
  return <section aria-label="Prompting strategy" className="my-3 rounded-lg border border-[var(--color-border)] p-3 text-xs leading-relaxed">
    <h3 className="font-semibold">{title}</h3>
    <ul aria-label="Prompting techniques" className="mt-2 flex flex-wrap gap-1.5">{chips.map((chip) => <li key={chip} className="rounded-md border border-[color-mix(in_srgb,var(--color-accent)_35%,var(--color-border))] px-2 py-0.5 text-[11px] text-[var(--color-text)]">{chip}</li>)}</ul>
    <p className="mt-2">{strategy.execution === 'single_pass' ? 'Single response' : `Bounded implementation loop · up to ${strategy.max_iterations} cycles`}</p>
    <p className="mt-2 text-[var(--color-muted)]">{strategy.rationale}</p>
    {strategy.examples !== 'zero_shot' && <p className="mt-2">{strategy.example_source === 'user_supplied' ? 'Examples to supply' : 'Generated examples will show'}: {strategy.example_requirement}</p>}
    {strategy.success_criteria.length > 0 && <ul className="mt-2 list-disc pl-4">{strategy.success_criteria.map((criterion, index) => <li key={index}>{criterion}</li>)}</ul>}
    {strategy.execution === 'bounded_iteration' && <p className="mt-2 text-[var(--color-warning)]">Execution requires tools in the destination chat. The extension generates instructions; it does not run the task.</p>}
  </section>
}
