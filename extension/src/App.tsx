import { Mic, Sparkles } from 'lucide-react'

export function App() {
  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <header className="mb-10 flex items-center gap-3">
        <div className="rounded-2xl bg-violet-500/20 p-2 text-violet-300"><Sparkles size={22} /></div>
        <div><h1 className="font-semibold">Voice Prompt Builder</h1><p className="text-xs text-slate-400">Think aloud. Prompt precisely.</p></div>
      </header>
      <section className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur">
        <p className="mb-2 text-sm font-medium text-violet-300">What do you want to accomplish?</p>
        <textarea aria-label="Rough prompt" className="min-h-40 w-full resize-none bg-transparent text-base outline-none" placeholder="Type a rough idea, or record your voice…" />
        <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-3 font-medium"><Mic size={18} /> Record idea</button>
      </section>
    </main>
  )
}
