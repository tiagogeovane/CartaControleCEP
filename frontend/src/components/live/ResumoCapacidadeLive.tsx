import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle, AlertTriangle, XCircle, ArrowUpRight } from 'lucide-react'
import type { CartaControleResponse, SubgrupoResponse } from '@/types/api'

export interface ResumoCapacidadeLiveProps {
  carta: CartaControleResponse | null
  subgrupos: SubgrupoResponse[]
  className?: string
}

export function ResumoCapacidadeLive({
  carta,
  subgrupos,
  className = '',
}: ResumoCapacidadeLiveProps) {
  const capacidade = useMemo(() => {
    const specs = carta?.especificacoes
    if (!specs || specs.lse == null || specs.lie == null || subgrupos.length < 2) {
      return null
    }

    const n = subgrupos.length
    const media = subgrupos.reduce((acc, s) => acc + s.estatisticas.media_x, 0) / n
    const sigma = carta.limites_atuais?.sigma_estimado || 0.5

    if (sigma <= 0) return null

    const cp = (specs.lse - specs.lie) / (6 * sigma)
    const cpkSup = (specs.lse - media) / (3 * sigma)
    const cpkInf = (media - specs.lie) / (3 * sigma)
    const cpk = Math.min(cpkSup, cpkInf)

    let status: 'capaz' | 'aceitavel' | 'incapaz' = 'incapaz'
    if (cpk >= 1.33) status = 'capaz'
    else if (cpk >= 1.0) status = 'aceitavel'

    return {
      cp: Number(cp.toFixed(2)),
      cpk: Number(cpk.toFixed(2)),
      status,
      lse: specs.lse,
      lie: specs.lie,
    }
  }, [carta, subgrupos])

  // Donut SVG circumference and stroke offset (r = 52, C = 2 * PI * 52 ≈ 326.7)
  const radius = 52
  const circumference = 2 * Math.PI * radius

  // Normalização do Cpk no gráfico circular: 0 a 2.0 (1.33 representa ~66% do arco)
  const percentualArco = useMemo(() => {
    if (!capacidade) return 0
    const clamped = Math.max(0, Math.min(2.0, capacidade.cpk))
    return (clamped / 2.0) * 100
  }, [capacidade])

  const strokeDashoffset = circumference - (percentualArco / 100) * circumference

  return (
    <div
      data-testid="resumo-capacidade-live"
      className={`flex flex-col bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-xs ${className}`}
    >
      {/* Cabeçalho */}
      <div className="flex items-center justify-between pb-3.5 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            Capacidade do Processo
          </h3>
          <p className="text-2xs text-slate-400 mt-0.5">
            Performance instantânea em relação às especificações de engenharia
          </p>
        </div>

        <Link
          to="/capacidade"
          className="text-2xs text-purple-400 hover:text-purple-300 flex items-center gap-1 font-medium hover:underline cursor-pointer"
          title="Ver análise completa de capacidade"
        >
          <span>Estudo Completo</span>
          <ArrowUpRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Conteúdo: Donut Circular e Legenda */}
      {capacidade ? (
        <div className="mt-4 flex flex-col sm:flex-row items-center justify-around gap-5">
          {/* Donut SVG Estilo Nexo Tech */}
          <div className="relative w-36 h-36 flex items-center justify-center shrink-0">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 128 128">
              {/* Círculo de fundo */}
              <circle
                cx="64"
                cy="64"
                r={radius}
                className="stroke-slate-950"
                strokeWidth="12"
                fill="transparent"
              />
              {/* Arco de progresso */}
              <circle
                cx="64"
                cy="64"
                r={radius}
                stroke={
                  capacidade.status === 'capaz'
                    ? '#7C4FE0'
                    : capacidade.status === 'aceitavel'
                      ? '#F59E0B'
                      : '#EF4444'
                }
                strokeWidth="12"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
                className="transition-all duration-700 ease-out"
              />
            </svg>

            {/* Valor Central no Donut */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-2xl font-extrabold font-mono text-slate-100 tabular-nums">
                {capacidade.cpk.toFixed(2)}
              </span>
              <span className="text-3xs font-medium uppercase tracking-wider text-slate-400">
                Índice Cpk
              </span>
            </div>
          </div>

          {/* Legenda de Métricas */}
          <div className="space-y-3 flex-1">
            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                <span className="text-xs text-slate-300">Capacidade Potencial (Cp)</span>
              </div>
              <span className="text-xs font-mono font-bold text-slate-100 tabular-nums">
                {capacidade.cp.toFixed(2)}
              </span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
                <span className="text-xs text-slate-300">Capacidade Real (Cpk)</span>
              </div>
              <span className="text-xs font-mono font-bold text-purple-300 tabular-nums">
                {capacidade.cpk.toFixed(2)}
              </span>
            </div>

            {/* Badge de Status Semântico */}
            <div className="pt-1 flex items-center justify-between">
              <span className="text-2xs text-slate-400">Diagnóstico:</span>
              {capacidade.status === 'capaz' && (
                <span className="px-2 py-0.5 text-3xs font-bold font-mono rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  CAPAZ (≥ 1.33)
                </span>
              )}
              {capacidade.status === 'aceitavel' && (
                <span className="px-2 py-0.5 text-3xs font-bold font-mono rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  ACEITÁVEL (1.00 - 1.33)
                </span>
              )}
              {capacidade.status === 'incapaz' && (
                <span className="px-2 py-0.5 text-3xs font-bold font-mono rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                  <XCircle className="w-3 h-3" />
                  INCAPAZ (&lt; 1.00)
                </span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-col items-center justify-center p-6 text-center rounded-xl bg-slate-950/40 border border-dashed border-slate-800">
          <p className="text-xs text-slate-300 font-medium">Especificações não definidas</p>
          <p className="text-2xs text-slate-400 mt-1 max-w-xs">
            Configure os limites de engenharia (LIE e LSE) para calcular Cp e Cpk automaticamente em tempo real.
          </p>
          <Link
            to="/capacidade"
            className="mt-3 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-purple-300 border border-purple-500/30 transition-colors"
          >
            Configurar Tolerâncias
          </Link>
        </div>
      )}
    </div>
  )
}
