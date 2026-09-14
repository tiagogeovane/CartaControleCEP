import React, { useMemo } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { cn } from '@/lib/utils'

export type CardKpiStatus = 'normal' | 'success' | 'warning' | 'danger'

export interface CardKpiVariacao {
  valor: string | number
  positivo?: boolean
  texto?: string
}

export interface CardKpiProps extends React.HTMLAttributes<HTMLDivElement> {
  titulo: string
  valor: string | number
  subtitulo?: string
  icone?: React.ReactNode
  status?: CardKpiStatus
  badge?: React.ReactNode
  variacao?: CardKpiVariacao
  sparklineData?: number[]
  sparklineColor?: string
}

const statusBorderStyles: Record<CardKpiStatus, string> = {
  normal: 'border-slate-800/90 hover:border-slate-700',
  success: 'border-emerald-800/40 hover:border-emerald-700/60',
  warning: 'border-amber-800/40 hover:border-amber-700/60',
  danger: 'border-rose-800/50 hover:border-rose-700/70',
}

const statusTextStyles: Record<CardKpiStatus, string> = {
  normal: 'text-slate-100',
  success: 'text-emerald-400',
  warning: 'text-amber-400',
  danger: 'text-rose-400',
}

function MiniSparkline({
  data,
  color = '#10B981',
  width = 92,
  height = 34,
}: {
  data?: number[]
  color?: string
  width?: number
  height?: number
}) {
  const pontos = useMemo(() => {
    const raw = data && data.length >= 2 ? data : [12, 14, 11, 16, 13, 19, 17, 22]
    const min = Math.min(...raw)
    const max = Math.max(...raw)
    const range = max - min || 1
    const padY = 3
    const drawHeight = height - padY * 2

    return raw.map((val, idx) => {
      const x = (idx / (raw.length - 1)) * width
      const y = height - padY - ((val - min) / range) * drawHeight
      return { x, y }
    })
  }, [data, width, height])

  const { linePath, areaPath } = useMemo(() => {
    if (pontos.length < 2) return { linePath: '', areaPath: '' }
    let d = `M ${pontos[0].x.toFixed(1)} ${pontos[0].y.toFixed(1)}`

    for (let i = 0; i < pontos.length - 1; i++) {
      const p0 = pontos[i === 0 ? i : i - 1]
      const p1 = pontos[i]
      const p2 = pontos[i + 1]
      const p3 = pontos[i + 2] || p2

      const cp1x = p1.x + (p2.x - p0.x) / 6
      const cp1y = p1.y + (p2.y - p0.y) / 6
      const cp2x = p2.x - (p3.x - p1.x) / 6
      const cp2y = p2.y - (p3.y - p1.y) / 6

      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
    }

    const lastX = pontos[pontos.length - 1].x.toFixed(1)
    const area = `${d} L ${lastX} ${height} L 0 ${height} Z`
    return { linePath: d, areaPath: area }
  }, [pontos, height])

  const gradId = useMemo(
    () => `spark-grad-${Math.random().toString(36).slice(2, 9)}`,
    []
  )

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible shrink-0"
      style={{ width, height }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function CardKpi({
  titulo,
  valor,
  subtitulo,
  icone,
  status = 'normal',
  badge,
  variacao,
  sparklineData,
  sparklineColor,
  className,
  ...props
}: CardKpiProps) {
  const sparkColor = useMemo(() => {
    if (sparklineColor) return sparklineColor
    if (status === 'danger') return '#EF4444'
    if (status === 'warning') return '#F59E0B'
    if (status === 'success') return '#10B981'
    if (variacao) {
      return variacao.positivo ? '#10B981' : '#EF4444'
    }
    return '#8B5CF6'
  }, [sparklineColor, status, variacao])

  return (
    <div
      className={cn(
        'bg-slate-800/80 border rounded-2xl p-5 shadow-xs backdrop-blur-xs transition-all duration-200 flex flex-col justify-between hover:bg-slate-800/95',
        statusBorderStyles[status],
        className
      )}
      {...props}
    >
      {/* Topo do Card: Ícone em pílula + Rótulo + Badge */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5 truncate">
          {icone && (
            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-slate-900/90 border border-slate-700/60 text-slate-300 shrink-0 shadow-2xs">
              {icone}
            </div>
          )}
          <span className="text-xs font-semibold text-slate-300 truncate">
            {titulo}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {badge}
        </div>
      </div>

      {/* Conteúdo: Valor Principal + Variação & Sparkline */}
      <div className="flex items-end justify-between gap-3 mt-1">
        <div className="min-w-0">
          <span
            className={cn(
              'text-2xl sm:text-3xl font-bold font-mono tracking-tight tabular-nums block leading-tight',
              statusTextStyles[status]
            )}
          >
            {valor}
          </span>

          {subtitulo && (
            <p className="mt-1 text-xs text-slate-400 font-mono truncate">
              {subtitulo}
            </p>
          )}
        </div>

        {/* Lado Direito: Variação Percentual + Mini Sparkline */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {variacao && (
            <div
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-mono font-medium border',
                variacao.positivo
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
              )}
            >
              {variacao.positivo ? (
                <ArrowUp className="w-3 h-3" />
              ) : (
                <ArrowDown className="w-3 h-3" />
              )}
              <span>{variacao.valor}</span>
            </div>
          )}

          {/* Mini Sparkline estilizado */}
          <MiniSparkline
            data={sparklineData}
            color={sparkColor}
            width={88}
            height={30}
          />
        </div>
      </div>
    </div>
  )
}

