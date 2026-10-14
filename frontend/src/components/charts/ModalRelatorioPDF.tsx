import React, { useState, useMemo } from 'react'
import {
  FileDown,
  FileText,
  BarChart2,
  Sliders,
  CheckSquare,
  Square,
  Activity,
  Layers,
  Table,
  Loader2,
} from 'lucide-react'
import { Modal } from '@/components/common/Modal'
import { useToastStore } from '@/stores/toastStore'
import {
  calcularMetricasSigma,
  gerarRelatorioPDF,
  type LimitesControleReport,
  type LimitesEspecificacaoReport,
  type SecoesRelatorioPDF,
  type SubgrupoReport,
} from '@/utils/pdfReportGenerator'
import type {
  CartaControleResponse,
  LimitesControleSchema,
  LimitesEspecificacaoSchema,
  SubgrupoResponse,
} from '@/types/api'

export interface ModalRelatorioPDFProps {
  isOpen: boolean
  onClose: () => void
  cartaDetalhes?: CartaControleResponse | null
  subgrupos?: SubgrupoResponse[]
  limites?: LimitesControleSchema | null
  especificacoes?: LimitesEspecificacaoSchema | null
  tipoCarta?: string
  tamanhoSubgrupo?: number
  getChartImage?: () => string | null | undefined
}

export function ModalRelatorioPDF({
  isOpen,
  onClose,
  cartaDetalhes,
  subgrupos = [],
  limites: limitesProp,
  especificacoes: especificacoesProp,
  tipoCarta = 'X_R',
  tamanhoSubgrupo = 5,
  getChartImage,
}: ModalRelatorioPDFProps) {
  const adicionarToast = useToastStore((s) => s.adicionarToast)
  const [isGerando, setIsGerando] = useState(false)

  // Toggles de seções a serem incluídas no documento
  const [secoes, setSecoes] = useState<SecoesRelatorioPDF>({
    incluirMetadados: true,
    incluirGrafico: true,
    incluirLimitesControle: true,
    incluirLimitesEspecificacao: true,
    incluirAnaliseSigmas: true,
    incluirTabelaAmostras: false,
  })

  // Normalização de dados
  const limitesEfetivos: LimitesControleReport | null = useMemo(() => {
    const l = limitesProp || cartaDetalhes?.limites_atuais
    if (!l) return null
    return {
      lc: l.lc,
      lsc: l.lsc,
      lic: l.lic,
      sigmaEstimado: l.sigma_estimado,
    }
  }, [limitesProp, cartaDetalhes?.limites_atuais])

  const especificacoesEfetivas: LimitesEspecificacaoReport | null = useMemo(() => {
    const e = especificacoesProp || cartaDetalhes?.especificacoes
    if (!e) return null
    return {
      lse: e.lse,
      lie: e.lie,
      valorNominal: e.valor_nominal,
    }
  }, [especificacoesProp, cartaDetalhes?.especificacoes])

  // Cálculo prévio dos sigmas para exibição em tempo real na tela do modal
  const metricasSigma = useMemo(() => {
    return calcularMetricasSigma(limitesEfetivos, especificacoesEfetivas)
  }, [limitesEfetivos, especificacoesEfetivas])

  const handleToggle = (chave: keyof SecoesRelatorioPDF) => {
    setSecoes((prev) => ({
      ...prev,
      [chave]: !prev[chave],
    }))
  }

  const handleGerar = async () => {
    setIsGerando(true)
    try {
      // 1. Capturar imagem do canvas ECharts no exato momento do clique
      let imagemDataUrl: string | null = null
      if (secoes.incluirGrafico && getChartImage) {
        imagemDataUrl = getChartImage() || null
      }

      // 2. Mapear subgrupos para o formato do relatório
      const subgruposReport: SubgrupoReport[] = subgrupos.map((sg) => ({
        numero_subgrupo: sg.numero_subgrupo,
        valores_brutos: sg.valores_brutos,
        estatisticas: {
          media_x: sg.estatisticas.media_x,
          amplitude_r: sg.estatisticas.amplitude_r,
          desvio_s: sg.estatisticas.desvio_s,
        },
        fora_de_controle: sg.fora_de_controle,
        violacoes: sg.violacoes?.map((v) => ({
          codigo_regra: v.codigo_regra,
          descricao: v.descricao,
        })),
      }))

      // 3. Executar gerador do PDF
      const resultado = await gerarRelatorioPDF({
        cartaId: cartaDetalhes?.id || 'N/A',
        tipoCarta: tipoCarta || cartaDetalhes?.tipo_carta || 'X_R',
        tamanhoSubgrupo: tamanhoSubgrupo || cartaDetalhes?.tamanho_subgrupo || 5,
        totalSubgrupos: subgrupos.length || cartaDetalhes?.total_subgrupos || 0,
        modoLimites: cartaDetalhes?.modo_limites || 'DINÂMICO',
        limitesControle: limitesEfetivos,
        limitesEspecificacao: especificacoesEfetivas,
        imagemGrafico: imagemDataUrl,
        subgrupos: subgruposReport,
        secoes,
      })

      adicionarToast({
        tipo: 'success',
        titulo: 'Relatório PDF Gerado',
        mensagem: `Arquivo "${resultado.nomeArquivo}" baixado com sucesso.`,
      })

      onClose()
    } catch (erro) {
      adicionarToast({
        tipo: 'error',
        titulo: 'Falha na Geração do PDF',
        mensagem: 'Ocorreu um erro ao construir o documento PDF. Tente novamente.',
      })
    } finally {
      setIsGerando(false)
    }
  }

  const opcoesToggles: Array<{
    chave: keyof SecoesRelatorioPDF
    titulo: string
    descricao: string
    icone: React.ComponentType<{ className?: string }>
  }> = [
    {
      chave: 'incluirGrafico',
      titulo: 'Snapshot do Gráfico Atual',
      descricao: 'Foto do gráfico de controle capturada no momento do clique em alta definição.',
      icone: BarChart2,
    },
    {
      chave: 'incluirLimitesControle',
      titulo: 'Limites de Controle Estatístico',
      descricao: 'Valores calculados de Linha Central (LC), LSC, LIC e desvio padrão sigma (σ).',
      icone: Sliders,
    },
    {
      chave: 'incluirLimitesEspecificacao',
      titulo: 'Limites de Especificação de Engenharia',
      descricao: 'Tolerâncias de projeto do produto: LSE, LIE, Valor Nominal e campo de tolerância.',
      icone: Layers,
    },
    {
      chave: 'incluirAnaliseSigmas',
      titulo: 'Cálculo de Sigmas do Processo',
      descricao: 'Distância da Linha Central aos limites de controle (±3σ) e Nível Sigma de Engenharia (Z).',
      icone: Activity,
    },
    {
      chave: 'incluirMetadados',
      titulo: 'Metadados e Identificação da Linha',
      descricao: 'Código da linha, processo industrial, tamanho amostral n e data/hora de emissão.',
      icone: FileText,
    },
    {
      chave: 'incluirTabelaAmostras',
      titulo: 'Histórico Resumido das Amostras',
      descricao: 'Tabela complementar contendo as últimas medições e violações das Regras de Nelson.',
      icone: Table,
    },
  ]

  const algumaSecaoSelecionada = Object.values(secoes).some(Boolean)

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      titulo="Gerar Relatório Técnico em PDF"
      descricao="Configure os elementos visuais e estatísticos que farão parte do documento exportado."
      maxWidth="lg"
    >
      <div className="space-y-5">
        {/* Card Informativo com Resumo de Sigmas em Tempo Real */}
        <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-blue-400" />
            <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
              Diagnóstico de Sigmas da Carta Atual
            </h4>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="p-2 bg-slate-900 border border-slate-800 rounded-lg">
              <span className="text-2xs text-slate-400 block">Limites da Carta</span>
              <span className="font-mono font-semibold text-blue-400">
                ±{metricasSigma.distanciaLscSigma ?? 3.0}σ
              </span>
            </div>
            <div className="p-2 bg-slate-900 border border-slate-800 rounded-lg">
              <span className="text-2xs text-slate-400 block">Nível Sigma (Zmin)</span>
              <span className="font-mono font-semibold text-emerald-400">
                {metricasSigma.zMin !== null ? `${metricasSigma.zMin.toFixed(2)}σ` : 'N/D'}
              </span>
            </div>
            <div className="p-2 bg-slate-900 border border-slate-800 rounded-lg">
              <span className="text-2xs text-slate-400 block">Cpk Equivalente</span>
              <span className="font-mono font-semibold text-amber-400">
                {metricasSigma.cpkEquivalente !== null ? metricasSigma.cpkEquivalente.toFixed(2) : 'N/D'}
              </span>
            </div>
            <div className="p-2 bg-slate-900 border border-slate-800 rounded-lg">
              <span className="text-2xs text-slate-400 block">Classificação</span>
              <span className="text-2xs font-medium text-slate-300 truncate block" title={metricasSigma.classificacaoSigma}>
                {metricasSigma.classificacaoSigma}
              </span>
            </div>
          </div>
        </div>

        {/* Lista de Toggles Selecionáveis */}
        <div>
          <h4 className="text-xs font-medium text-slate-300 mb-2">
            Selecione as seções a incluir no PDF:
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
            {opcoesToggles.map((item) => {
              const ativo = secoes[item.chave]
              const Icone = item.icone

              return (
                <button
                  key={item.chave}
                  type="button"
                  onClick={() => handleToggle(item.chave)}
                  className={`flex items-start gap-3 p-3 text-left rounded-xl border transition-all cursor-pointer ${
                    ativo
                      ? 'bg-blue-950/30 border-blue-600/60 text-slate-100 shadow-xs'
                      : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {ativo ? (
                      <CheckSquare className="w-4 h-4 text-blue-400" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-600" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 font-medium text-xs text-slate-200">
                      <Icone className={`w-3.5 h-3.5 shrink-0 ${ativo ? 'text-blue-400' : 'text-slate-500'}`} />
                      <span>{item.titulo}</span>
                    </div>
                    <p className="text-2xs text-slate-400 mt-0.5 leading-snug">
                      {item.descricao}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Rodapé e Ações */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isGerando}
            className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleGerar}
            disabled={isGerando || !algumaSecaoSelecionada}
            className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-md transition-all cursor-pointer"
          >
            {isGerando ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Gerando PDF...</span>
              </>
            ) : (
              <>
                <FileDown className="w-4 h-4" />
                <span>Gerar Relatório PDF</span>
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  )
}
