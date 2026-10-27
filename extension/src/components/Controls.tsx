import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { icon?: ReactNode; tone?: 'primary' | 'quiet' | 'danger' }

export function Button({ children, icon, tone = 'primary', className = '', ...props }: Props) {
  const tones = {
    primary: 'bg-gradient-to-r from-violet-600 to-blue-600 text-white shadow-lg shadow-violet-950/40 hover:brightness-110',
    quiet: 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10',
    danger: 'border border-red-400/20 bg-red-500/10 text-red-200 hover:bg-red-500/20',
  }
  return <button className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${tones[tone]} ${className}`} {...props}>{icon}{children}</button>
}

export function Loading({ label }: { label: string }) {
  return <div className="flex min-h-64 flex-col items-center justify-center text-center"><div className="mb-5 h-11 w-11 animate-spin rounded-full border-2 border-violet-400/20 border-t-violet-400" /><h2 className="font-medium">{label}</h2><p className="mt-2 text-xs text-slate-500">This usually takes a few seconds.</p></div>
}
