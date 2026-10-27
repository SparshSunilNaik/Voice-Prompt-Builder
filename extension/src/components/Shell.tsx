import { Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'

const steps = ['Capture', 'Understand', 'Clarify', 'Build']

export function Shell({ children, step = 0 }: { children: ReactNode; step?: number }) {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[var(--color-bg)] p-4 text-[var(--color-text)]">
      <div className="pointer-events-none absolute -right-20 -top-24 h-48 w-48 rounded-full bg-[color-mix(in_srgb,var(--color-accent)_8%,transparent)] blur-3xl" />
      <header className="relative mb-4 flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-accent)]"><Sparkles size={16} /></div>
        <div className="min-w-0"><h1 className="truncate text-[13px] font-semibold tracking-[-0.01em]">Voice Prompt Builder</h1><p className="text-[10px] text-[var(--color-muted)]">Think aloud. Prompt precisely.</p></div>
      </header>
      <nav aria-label="Workflow progress" className="relative mb-5 flex gap-2 border-b border-[var(--color-border)] pb-2.5">
        {steps.map((label, index) => <div key={label} className="min-w-0 flex-1"><div className={`mb-1.5 h-px transition-colors ${index < step ? 'bg-[#4a5060]' : index === step ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)]'}`} /><span className={`block truncate text-[9px] font-medium ${index === step ? 'text-[var(--color-text)]' : 'text-[var(--color-muted)]'}`}>{label}</span></div>)}
      </nav>
      <div className="relative animate-rise">{children}</div>
    </main>
  )
}

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[0_8px_28px_rgba(0,0,0,0.18)] ${className}`}>{children}</section>
}
