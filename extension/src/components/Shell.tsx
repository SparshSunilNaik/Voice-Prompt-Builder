import { Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'

const steps = ['Capture', 'Understand', 'Clarify', 'Build']

export function Shell({ children, step = 0 }: { children: ReactNode; step?: number }) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#090a0f] p-5 text-slate-100">
      <div className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-violet-600/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-24 h-64 w-64 rounded-full bg-blue-600/15 blur-3xl" />
      <header className="relative mb-7 flex items-center gap-3">
        <div className="rounded-2xl border border-violet-400/20 bg-violet-500/15 p-2.5 text-violet-300 shadow-lg shadow-violet-950"><Sparkles size={20} /></div>
        <div><h1 className="text-sm font-semibold tracking-wide">Voice Prompt Builder</h1><p className="text-[11px] text-slate-500">Think aloud. Prompt precisely.</p></div>
      </header>
      <nav aria-label="Workflow progress" className="relative mb-6 flex gap-1.5">
        {steps.map((label, index) => <div key={label} className="min-w-0 flex-1"><div className={`mb-1 h-1 rounded-full transition-colors ${index <= step ? 'bg-gradient-to-r from-violet-500 to-blue-500' : 'bg-white/10'}`} /><span className={`text-[9px] ${index === step ? 'text-slate-300' : 'text-slate-600'}`}>{label}</span></div>)}
      </nav>
      <div className="relative animate-rise">{children}</div>
    </main>
  )
}

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-3xl border border-white/10 bg-white/[0.055] p-5 shadow-2xl shadow-black/30 backdrop-blur-xl ${className}`}>{children}</section>
}
