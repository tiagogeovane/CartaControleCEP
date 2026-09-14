import React from 'react'
import { cn } from '@/lib/utils'

export type BadgeVariant =
  | 'sob_controle'
  | 'fora_de_controle'
  | 'alerta'
  | 'neutro'
  | 'dinamico'
  | 'fixo'
  | 'online'
  | 'reconnecting'
  | 'offline'
  | 'connecting'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  pulse?: boolean
  children: React.ReactNode
}

const variantStyles: Record<BadgeVariant, string> = {
  sob_controle: 'bg-emerald-950/80 text-emerald-400 border-emerald-700/60',
  fora_de_controle: 'bg-red-950/80 text-red-400 border-red-700/60 font-semibold',
  alerta: 'bg-amber-950/80 text-amber-400 border-amber-700/60',
  neutro: 'bg-slate-800 text-slate-300 border-slate-700',
  dinamico: 'bg-blue-950/80 text-blue-400 border-blue-700/60',
  fixo: 'bg-purple-950/80 text-purple-400 border-purple-700/60',
  online: 'bg-emerald-950/80 text-emerald-300 border-emerald-600/60',
  reconnecting: 'bg-amber-950/80 text-amber-300 border-amber-600/60',
  offline: 'bg-red-950/80 text-red-300 border-red-600/60',
  connecting: 'bg-blue-950/80 text-blue-300 border-blue-600/60',
}

const dotColors: Record<BadgeVariant, string> = {
  sob_controle: 'bg-emerald-400',
  fora_de_controle: 'bg-red-400',
  alerta: 'bg-amber-400',
  neutro: 'bg-slate-400',
  dinamico: 'bg-blue-400',
  fixo: 'bg-purple-400',
  online: 'bg-emerald-400',
  reconnecting: 'bg-amber-400',
  offline: 'bg-red-400',
  connecting: 'bg-blue-400',
}

export function Badge({
  variant = 'neutro',
  pulse = false,
  children,
  className,
  ...props
}: BadgeProps) {
  const showDot = [
    'sob_controle',
    'fora_de_controle',
    'alerta',
    'online',
    'reconnecting',
    'offline',
    'connecting',
  ].includes(variant)

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border tracking-wide transition-colors',
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {showDot && (
        <span
          className={cn(
            'w-2 h-2 rounded-full',
            dotColors[variant],
            pulse && 'animate-pulse'
          )}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  )
}
