import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { icon?: ReactNode; tone?: 'primary' | 'quiet' | 'danger' }

export function Button({ children, icon, tone = 'primary', className = '', ...props }: Props) {
  const tones = {
    primary: 'border border-[#aa9eff] bg-[var(--color-accent)] text-[#11131a] shadow-[0_2px_10px_rgba(155,140,255,0.16)] hover:bg-[#aa9eff] active:bg-[#8d7df0]',
    quiet: 'border border-[var(--color-border)] bg-[var(--color-interactive)] text-[var(--color-text)] hover:border-[#3a3f4d] hover:bg-[#202531] active:bg-[#171b24]',
    danger: 'border border-[color-mix(in_srgb,var(--color-warning)_32%,var(--color-border))] bg-[color-mix(in_srgb,var(--color-warning)_8%,var(--color-surface))] text-[var(--color-warning)] hover:bg-[color-mix(in_srgb,var(--color-warning)_13%,var(--color-surface))]',
  }
  return <button className={`inline-flex min-h-10 min-w-0 items-center justify-center gap-2 rounded-lg px-3.5 text-[13px] font-medium leading-none transition-colors duration-150 disabled:cursor-not-allowed disabled:border-[var(--color-border)] disabled:bg-[#151821] disabled:text-[#666d7e] disabled:shadow-none ${tones[tone]} ${className}`} {...props}>{icon}<span className="truncate">{children}</span></button>
}

export function Loading({ label }: { label: string }) {
  return <div className="flex min-h-48 flex-col items-center justify-center px-4 text-center"><div className="mb-4 h-7 w-7 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-accent)]" /><h2 className="text-sm font-medium text-[var(--color-text)]">{label}</h2><p className="mt-1.5 text-[11px] text-[var(--color-muted)]">This usually takes a few seconds.</p></div>
}
