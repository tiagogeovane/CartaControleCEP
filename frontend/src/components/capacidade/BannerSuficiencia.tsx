import { AlertTriangle, Info } from 'lucide-react'

export interface BannerSuficienciaProps {
  totalSubgrupos: number
  minimoRecomendado?: number
  className?: string
}

export function BannerSuficiencia({
  totalSubgrupos,
  minimoRecomendado = 20,
  className = '',
}: BannerSuficienciaProps) {
  if (totalSubgrupos >= minimoRecomendado) {
    return null
  }

  return (
    <div
      data-testid="banner-suficiencia"
      className={`flex items-start gap-3 p-4 rounded-2xl bg-amber-950/40 border border-amber-800/60 text-amber-200 shadow-lg backdrop-blur-xs ${className}`}
    >
      <div className="p-2 rounded-xl bg-amber-900/60 border border-amber-700/50 text-amber-400 shrink-0 mt-0.5">
        <AlertTriangle className="w-5 h-5 animate-pulse" />
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-bold text-amber-300">
            Amostra Estatisticamente Preliminar (Regra [RN04])
          </h4>
          <span className="px-2 py-0.5 text-3xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full">
            {totalSubgrupos} / {minimoRecomendado} Subgrupos
          </span>
        </div>

        <p className="text-xs text-amber-200/90 leading-relaxed font-sans">
          A literatura técnica de CEP (Montgomery) e as normas de qualidade industrial recomendam uma série mínima de <strong>{minimoRecomendado} subgrupos</strong> para estabilidade amostral e homologação formal dos índices <strong>Cp</strong> e <strong>Cpk</strong>. Os valores calculados abaixo possuem caráter provisório para monitoramento preliminar.
        </p>

        <div className="flex items-center gap-1.5 text-2xs text-amber-400/80 pt-0.5 font-mono">
          <Info className="w-3.5 h-3.5" />
          <span>Colete mais {minimoRecomendado - totalSubgrupos} subgrupos para homologar o processo com suficiência estatística.</span>
        </div>
      </div>
    </div>
  )
}
