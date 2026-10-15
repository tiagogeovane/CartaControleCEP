import { useState, useRef, useMemo, forwardRef, useImperativeHandle } from 'react'
import { Activity } from 'lucide-react'
import type {
  LimitesControleSchema,
  LimitesEspecificacaoSchema,
  SubgrupoResponse,
  TipoCarta,
} from '@/types/api'
import { useCEPStore } from '@/stores/cepStore'
import { useToastStore } from '@/stores/toastStore'
import type { BaseChartRef } from './BaseChart'
import { ControlesCarta } from './ControlesCarta'
import { CartaXRChart } from './CartaXRChart'
import { CartaXSChart } from './CartaXSChart'
import { CartaIMRChart } from './CartaIMRChart'
import { CartaAtributosChart } from './CartaAtributosChart'
import { ModalRelatorioPDF } from './ModalRelatorioPDF'

export interface CartaControleContainerProps {
  subgrupos?: SubgrupoResponse[]
  limites?: LimitesControleSchema | null
  especificacoes?: LimitesEspecificacaoSchema | null
  tipoCarta?: TipoCarta | string
  tamanhoSubgrupo?: number
  loading?: boolean
  height?: number | string
  mostrarControles?: boolean
  className?: string
}

export const CartaControleContainer = forwardRef<BaseChartRef, CartaControleContainerProps>(
  function CartaControleContainer(
    {
      subgrupos: subgruposProp,
      limites: limitesProp,
      especificacoes: especificacoesProp,
      tipoCarta: tipoCartaProp,
      tamanhoSubgrupo: tamanhoSubgrupoProp,
      loading = false,
      height = 560,
      mostrarControles = true,
      className,
    }: CartaControleContainerProps,
    forwardedRef
  ) {
    const chartRef = useRef<BaseChartRef>(null)

    useImperativeHandle(
      forwardedRef,
      () => ({
        getInstance: () => chartRef.current?.getInstance() ?? null,
        getDataURL: (opts) => chartRef.current?.getDataURL(opts) ?? null,
        resize: () => chartRef.current?.resize(),
      }),
      []
    )

    const [janelaSelecionada, setJanelaSelecionada] = useState<number | 'todos'>(30)
  const [isModalRelatorioAberto, setIsModalRelatorioAberto] = useState(false)

  // Consumir estado global caso não seja provido explicitamente via props
  const storeSubgrupos = useCEPStore((s) => s.subgruposHistorico)
  const storeCartaDetalhes = useCEPStore((s) => s.cartaDetalhes)
  const streamingPausado = useCEPStore((s) => s.streamingPausado)
  const togglePausaStreaming = useCEPStore((s) => s.togglePausaStreaming)
  const adicionarToast = useToastStore((s) => s.adicionarToast)

  const subgrupos = subgruposProp ?? storeSubgrupos
  const limites = limitesProp !== undefined ? limitesProp : storeCartaDetalhes?.limites_atuais
  const especificacoes =
    especificacoesProp !== undefined ? especificacoesProp : storeCartaDetalhes?.especificacoes
  const tamanhoSubgrupo =
    tamanhoSubgrupoProp ?? storeCartaDetalhes?.tamanho_subgrupo ?? (subgrupos[0]?.valores_brutos.length || 5)
  const modoLimites = storeCartaDetalhes?.modo_limites || 'DINAMICO'

  // Determinar o tipo efetivo da carta (X_R, X_S ou I_MR)
  const tipoCarta = useMemo(() => {
    if (tipoCartaProp) return tipoCartaProp
    if (storeCartaDetalhes?.tipo_carta) return storeCartaDetalhes.tipo_carta

    if (tamanhoSubgrupo === 1) return 'I_MR'
    if (tamanhoSubgrupo > 10) return 'X_S'
    return 'X_R'
  }, [tipoCartaProp, storeCartaDetalhes?.tipo_carta, tamanhoSubgrupo])

  // Exportar imagem PNG em alta resolução
  const handleExportarPNG = () => {
    try {
      const url = chartRef.current?.getDataURL({ type: 'png', pixelRatio: 2 })
      if (!url) {
        adicionarToast({
          tipo: 'warning',
          titulo: 'Exportação indisponível',
          mensagem: 'O canvas do gráfico ainda não está pronto para captura.',
        })
        return
      }

      const link = document.createElement('a')
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      link.download = `carta-cep-${tipoCarta}-${timestamp}.png`
      link.href = url
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      adicionarToast({
        tipo: 'success',
        titulo: 'Exportação Concluída',
        mensagem: 'Imagem PNG da carta exportada com sucesso em alta resolução.',
      })
    } catch {
      adicionarToast({
        tipo: 'error',
        titulo: 'Falha na Exportação',
        mensagem: 'Não foi possível gerar a imagem da carta de controle.',
      })
    }
  }

  const renderChart = () => {
    if (subgrupos.length === 0 && !loading) {
      return (
        <div
          data-testid="carta-empty-state"
          className="flex flex-col items-center justify-center p-12 border border-slate-800 rounded-2xl bg-slate-950/40 text-center min-h-[420px]"
        >
          <div className="p-3 rounded-full bg-slate-900 border border-slate-800 mb-3">
            <Activity className="w-8 h-8 text-blue-500 animate-pulse" />
          </div>
          <h4 className="text-base font-semibold text-slate-200">
            Aguardando Amostras e Telemetria
          </h4>
          <p className="text-xs text-slate-400 max-w-sm mt-1">
            Nenhum subgrupo foi registrado para esta carta até o momento. Conecte o simulador IoT ou faça a ingestão manual de medições.
          </p>
        </div>
      )
    }

    const commonProps = {
      ref: chartRef,
      subgrupos,
      limites,
      especificacoes,
      tamanhoSubgrupo,
      janelaZoom: janelaSelecionada,
      loading,
      height,
    }

    switch (tipoCarta) {
      case 'X_S':
        return <CartaXSChart {...commonProps} />
      case 'I_MR':
        return <CartaIMRChart {...commonProps} />
      case 'P':
      case 'C':
        return <CartaAtributosChart {...commonProps} tipoCarta={tipoCarta} />
      case 'X_R':
      default:
        return <CartaXRChart {...commonProps} />
    }
  }

  // Métricas do estágio atual para barra de resumo inferior
  const summaryMetrics = useMemo(() => {
    if (subgrupos.length === 0) return null
    const total = subgrupos.length
    const fora = subgrupos.filter(
      (s) => s.fora_de_controle || (s.violacoes && s.violacoes.length > 0)
    ).length
    const taxaConformidade =
      total > 0 ? (((total - fora) / total) * 100).toFixed(1) : '100.0'

    const mediaX = subgrupos.reduce((a, b) => a + b.estatisticas.media_x, 0) / total
    const lcVal = limites?.lc ?? mediaX
    const lscVal = limites?.lsc
    const licVal = limites?.lic
    const sigmaVal = limites?.sigma_estimado

    return {
      total,
      fora,
      taxaConformidade,
      lc: lcVal.toFixed(3),
      lsc: lscVal != null ? lscVal.toFixed(3) : '--',
      lic: licVal != null ? licVal.toFixed(3) : '--',
      sigma: sigmaVal != null ? sigmaVal.toFixed(3) : '--',
      modoLimites,
    }
  }, [subgrupos, limites, modoLimites])

  return (
    <div
      data-testid="carta-controle-container"
      className={`flex flex-col gap-3.5 w-full ${className ?? ''}`}
    >
      {mostrarControles && (
        <ControlesCarta
          janelaSelecionada={janelaSelecionada}
          onSelectJanela={setJanelaSelecionada}
          streamingPausado={streamingPausado}
          onTogglePausa={togglePausaStreaming}
          onExportarPNG={handleExportarPNG}
          onGerarRelatorioPDF={() => setIsModalRelatorioAberto(true)}
          totalSubgrupos={subgrupos.length}
          modoLimites={modoLimites}
        />
      )}

      <div className="relative w-full rounded-2xl bg-slate-900/80 border border-slate-800 p-3 sm:p-5 shadow-xl backdrop-blur-xs">
        {renderChart()}

        {/* Barra de Resumo de Estágio e Limites da Carta */}
        {summaryMetrics && (
          <div
            data-testid="estagio-resumo-bar"
            className="mt-4 pt-3.5 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5"
          >
            <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-950/50 border border-slate-800/60">
              <span className="text-3xs font-medium text-slate-400 uppercase tracking-wider">
                LSC (3σ Sup.)
              </span>
              <span className="text-sm font-bold font-mono text-rose-400 mt-0.5 tabular-nums">
                {summaryMetrics.lsc}
              </span>
            </div>
            <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-950/50 border border-slate-800/60">
              <span className="text-3xs font-medium text-slate-400 uppercase tracking-wider">
                Linha Central (LC)
              </span>
              <span className="text-sm font-bold font-mono text-blue-400 mt-0.5 tabular-nums">
                {summaryMetrics.lc}
              </span>
            </div>
            <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-950/50 border border-slate-800/60">
              <span className="text-3xs font-medium text-slate-400 uppercase tracking-wider">
                LIC (3σ Inf.)
              </span>
              <span className="text-sm font-bold font-mono text-rose-400 mt-0.5 tabular-nums">
                {summaryMetrics.lic}
              </span>
            </div>
            <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-950/50 border border-slate-800/60">
              <span className="text-3xs font-medium text-slate-400 uppercase tracking-wider">
                Desvio σ̂
              </span>
              <span className="text-sm font-bold font-mono text-purple-400 mt-0.5 tabular-nums">
                {summaryMetrics.sigma}
              </span>
            </div>
            <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-950/50 border border-slate-800/60">
              <span className="text-3xs font-medium text-slate-400 uppercase tracking-wider">
                Subgrupos
              </span>
              <span className="text-sm font-bold font-mono text-slate-200 mt-0.5 tabular-nums">
                {summaryMetrics.total}
              </span>
            </div>
            <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-950/50 border border-slate-800/60">
              <span className="text-3xs font-medium text-slate-400 uppercase tracking-wider">
                Conformidade
              </span>
              <span
                className={`text-sm font-bold font-mono mt-0.5 tabular-nums ${
                  Number(summaryMetrics.taxaConformidade) >= 95
                    ? 'text-emerald-400'
                    : 'text-amber-400'
                }`}
              >
                {summaryMetrics.taxaConformidade}%
              </span>
            </div>
            <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-950/50 border border-slate-800/60">
              <span className="text-3xs font-medium text-slate-400 uppercase tracking-wider">
                Modo Limites
              </span>
              <span
                data-testid="resumo-modo-limites"
                className={`text-xs font-bold font-mono mt-0.5 tabular-nums ${
                  summaryMetrics.modoLimites === 'FIXO'
                    ? 'text-purple-400'
                    : 'text-blue-400'
                }`}
              >
                {summaryMetrics.modoLimites === 'FIXO' ? '🔒 FIXO' : '📈 DINÂMICO'}
              </span>
            </div>
          </div>
        )}
      </div>

      <ModalRelatorioPDF
        isOpen={isModalRelatorioAberto}
        onClose={() => setIsModalRelatorioAberto(false)}
        cartaDetalhes={storeCartaDetalhes}
        subgrupos={subgrupos}
        limites={limites}
        especificacoes={especificacoes}
        tipoCarta={tipoCarta}
        tamanhoSubgrupo={tamanhoSubgrupo}
        getChartImage={() => chartRef.current?.getDataURL({ type: 'png', pixelRatio: 2 })}
      />
    </div>
  )
})

