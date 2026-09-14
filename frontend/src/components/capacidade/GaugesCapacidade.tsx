import { useMemo } from 'react'
import { Gauge } from 'lucide-react'
import type { IndicesCapacidadeSchema } from '@/types/api'
import { Badge } from '@/components/common/Badge'
import { obterClassificacaoIndice } from './capacidadeHelpers'

export interface GaugesCapacidadeProps {
  indices: IndicesCapacidadeSchema | null
  classificacao?: string
  aprovado?: boolean
  criterioAprovacao?: number
  className?: string
}

interface SpeedometerDialProps {
  label: string
  sublabel: string
  valor: number | null
  criterio?: number
  min?: number
  max?: number
}

function SpeedometerDial({
  label,
  sublabel,
  valor,
  min = 0,
  max = 2.5,
}: SpeedometerDialProps) {
  const info = obterClassificacaoIndice(valor)
  const Icone = info.icone

  // Cálculo de ângulo do ponteiro: de -135deg (min=0) até +135deg (max=2.5) -> total 270deg
  const angulo = useMemo(() => {
    if (valor == null) return -135
    const clamp = Math.max(min, Math.min(max, valor))
    const ratio = (clamp - min) / (max - min)
    return -135 + ratio * 270
  }, [valor, min, max])

  return (
    <div
      data-testid={`gauge-dial-${label.toLowerCase().replace(/[^a-z0-9]/g, '')}`}
      className="flex flex-col items-center p-4 rounded-2xl bg-slate-950/70 border border-slate-800 text-center shadow-lg"
    >
      {/* Título e Subtítulo */}
      <div className="mb-2">
        <h4 className="text-sm font-bold text-slate-100 flex items-center justify-center gap-1.5 font-mono">
          <span>{label}</span>
          <span className="text-2xs font-normal text-slate-400">({sublabel})</span>
        </h4>
      </div>

      {/* Mostrador SVG Semântico */}
      <div className="relative w-48 h-32 flex items-center justify-center overflow-hidden">
        <svg viewBox="0 0 200 130" className="w-full h-full">
          {/* Arco de Fundo Cinza */}
          <path
            d="M 25 105 A 75 75 0 1 1 175 105"
            fill="none"
            stroke="#1E293B"
            strokeWidth="14"
            strokeLinecap="round"
          />

          {/* Arco 1: Incapaz (< 1.00) - Vermelho */}
          <path
            d="M 25 105 A 75 75 0 0 1 78 33"
            fill="none"
            stroke="#EF4444"
            strokeWidth="14"
            strokeDasharray="1 1"
          />

          {/* Arco 2: Aceitável (1.00 a 1.33) - Amarelo */}
          <path
            d="M 78 33 A 75 75 0 0 1 113 32"
            fill="none"
            stroke="#F59E0B"
            strokeWidth="14"
            strokeDasharray="1 1"
          />

          {/* Arco 3: Capaz (>= 1.33) - Verde */}
          <path
            d="M 113 32 A 75 75 0 0 1 175 105"
            fill="none"
            stroke="#10B981"
            strokeWidth="14"
            strokeDasharray="1 1"
          />

          {/* Marcador de Linha de Homologação (1.33) */}
          <line
            x1="113"
            y1="24"
            x2="113"
            y2="40"
            stroke="#F8FAFC"
            strokeWidth="2"
          />

          {/* Ponteiro / Indicador */}
          <g transform={`rotate(${angulo} 100 105)`}>
            <polygon
              points="98,105 102,105 100,32"
              className="fill-slate-100"
              style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))' }}
            />
            <circle cx="100" cy="105" r="7" className="fill-slate-200" />
            <circle cx="100" cy="105" r="3.5" className="fill-slate-900" />
          </g>

          {/* Rótulos dos Limites no SVG */}
          <text x="24" y="124" fill="#94A3B8" fontSize="9" fontFamily="JetBrains Mono">
            0.0
          </text>
          <text x="76" y="22" fill="#F59E0B" fontSize="8" fontFamily="JetBrains Mono">
            1.00
          </text>
          <text x="114" y="20" fill="#10B981" fontSize="8" fontFamily="JetBrains Mono" fontWeight="bold">
            1.33
          </text>
          <text x="162" y="124" fill="#94A3B8" fontSize="9" fontFamily="JetBrains Mono">
            2.5+
          </text>
        </svg>
      </div>

      {/* Valor Numérico Monoespaçado e Status */}
      <div className="mt-1 flex flex-col items-center">
        <div className={`text-2xl font-extrabold font-mono tracking-tight ${info.corTexto}`}>
          {valor != null ? valor.toFixed(2) : '--'}
        </div>

        <div className="mt-2 flex items-center gap-1.5">
          <Icone className={`w-3.5 h-3.5 ${info.corTexto}`} />
          <Badge variant={info.varianteBadge} className="text-3xs py-0.5 px-2">
            {info.texto}
          </Badge>
        </div>
      </div>
    </div>
  )
}

export function GaugesCapacidade({
  indices,
  classificacao,
  aprovado,
  criterioAprovacao = 1.33,
  className = '',
}: GaugesCapacidadeProps) {
  const cp = indices?.cp ?? null
  const cpk = indices?.cpk ?? null
  const cpu = indices?.cpu ?? null
  const cpl = indices?.cpl ?? null

  const isAprovado = aprovado ?? (cpk != null && cpk >= criterioAprovacao)

  return (
    <div
      data-testid="gauges-capacidade-container"
      className={`flex flex-col gap-4 p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl backdrop-blur-xs ${className}`}
    >
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-blue-950/60 border border-blue-800/60 text-blue-400">
            <Gauge className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100">
              Velocímetros de Capacidade do Processo
            </h3>
            <p className="text-2xs text-slate-400">
              Índices Potencial (Cp) e Real Centrado (Cpk) conforme Regra [RN04]
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-2xs text-slate-400 font-mono">
            Critério: Cpk ≥ {criterioAprovacao.toFixed(2)}
          </span>
          <Badge
            variant={isAprovado ? 'sob_controle' : 'fora_de_controle'}
            pulse={isAprovado}
            className="text-xs font-bold"
          >
            {isAprovado ? 'PROCESSO HOMOLOGADO' : 'NÃO CONFORME'}
          </Badge>
        </div>
      </div>

      {/* Mostradores Lado a Lado */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SpeedometerDial
          label="Cp"
          sublabel="Capacidade Potencial"
          valor={cp}
          criterio={criterioAprovacao}
        />
        <SpeedometerDial
          label="Cpk"
          sublabel="Capacidade Real"
          valor={cpk}
          criterio={criterioAprovacao}
        />
      </div>

      {/* Métricas Unilaterais Complementares (CPU / CPL) e Diagnóstico */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
          <span className="text-3xs text-slate-400 font-medium uppercase tracking-wider block">
            Índice Superior (Cpu)
          </span>
          <span className="text-base font-bold font-mono text-slate-200 block mt-0.5">
            {cpu != null ? cpu.toFixed(3) : '--'}
          </span>
          <span className="text-3xs text-slate-500 font-mono block mt-0.5">
            Margem vs LSE
          </span>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
          <span className="text-3xs text-slate-400 font-medium uppercase tracking-wider block">
            Índice Inferior (Cpl)
          </span>
          <span className="text-base font-bold font-mono text-slate-200 block mt-0.5">
            {cpl != null ? cpl.toFixed(3) : '--'}
          </span>
          <span className="text-3xs text-slate-500 font-mono block mt-0.5">
            Margem vs LIE
          </span>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
          <span className="text-3xs text-slate-400 font-medium uppercase tracking-wider block">
            Classificação Oficial
          </span>
          <span className="text-xs font-bold text-blue-400 block mt-1 truncate">
            {classificacao || (isAprovado ? 'Capaz e Centrado' : 'Incapaz')}
          </span>
          <span className="text-3xs text-slate-500 font-mono block mt-0.5">
            Conforme literatura
          </span>
        </div>
      </div>
    </div>
  )
}
