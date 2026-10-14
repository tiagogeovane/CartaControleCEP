import { useState, useMemo, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  BarChart2,
  CheckSquare,
  FileDown,
  FileText,
  Layers,
  Loader2,
  RotateCcw,
  Sliders,
  Square,
  Table,
  SlidersHorizontal,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
} from 'lucide-react'
import { Badge } from '@/components/common/Badge'
import { CartaControleContainer, type BaseChartRef } from '@/components/charts'
import { cartasApi, ingestaoApi } from '@/services/api'
import { useCEPStore } from '@/stores/cepStore'
import { useToastStore } from '@/stores/toastStore'
import {
  calcularMetricasSigma,
  gerarRelatorioPDF,
  type LimitesControleReport,
  type LimitesEspecificacaoReport,
  type SecoesRelatorioPDF,
  type SubgrupoReport,
} from '@/utils/pdfReportGenerator'
import { formatarNomeCarta } from '@/utils/formatters'

export function RelatorioPage() {
  const chartContainerRef = useRef<BaseChartRef>(null)
  const adicionarToast = useToastStore((s) => s.adicionarToast)
  const storeCartaDetalhes = useCEPStore((s) => s.cartaDetalhes)
  const storeSubgrupos = useCEPStore((s) => s.subgruposHistorico)

  const [cartaSelecionadaId, setCartaSelecionadaId] = useState<string>('')
  const [isGerando, setIsGerando] = useState(false)

  // Toggles de configuração do que deve ser incluído no relatório
  const [secoes, setSecoes] = useState<SecoesRelatorioPDF>({
    incluirMetadados: true,
    incluirGrafico: true,
    incluirLimitesControle: true,
    incluirLimitesEspecificacao: true,
    incluirAnaliseSigmas: true,
    incluirTabelaAmostras: false,
  })

  // 1. Carregar lista de cartas disponíveis
  const { data: cartas = [], isLoading: carregandoCartas } = useQuery({
    queryKey: ['cartas'],
    queryFn: () => cartasApi.listar(),
    staleTime: 30000,
  })

  // Carta ativa derivada
  const cartaAtivaId = cartaSelecionadaId || storeCartaDetalhes?.id || cartas[0]?.id || ''
  const cartaDetalhes = useMemo(
    () => cartas.find((c) => c.id === cartaAtivaId) || storeCartaDetalhes,
    [cartas, cartaAtivaId, storeCartaDetalhes]
  )

  // 2. Carregar subgrupos amostrais da carta ativa
  const { data: subgrupos = storeSubgrupos, isLoading: carregandoSubgrupos } = useQuery({
    queryKey: ['subgrupos', cartaAtivaId],
    queryFn: () => ingestaoApi.listarSubgrupos(cartaAtivaId, 100),
    enabled: Boolean(cartaAtivaId),
    staleTime: 15000,
  })

  // Normalização de Limites para o Relatório e Diagnóstico
  const limitesEfetivos: LimitesControleReport | null = useMemo(() => {
    const l = cartaDetalhes?.limites_atuais
    if (!l) return null
    return {
      lc: l.lc,
      lsc: l.lsc,
      lic: l.lic,
      sigmaEstimado: l.sigma_estimado,
    }
  }, [cartaDetalhes?.limites_atuais])

  const especificacoesEfetivas: LimitesEspecificacaoReport | null = useMemo(() => {
    const e = cartaDetalhes?.especificacoes
    if (!e) return null
    return {
      lse: e.lse,
      lie: e.lie,
      valorNominal: e.valor_nominal,
    }
  }, [cartaDetalhes?.especificacoes])

  // Diagnóstico e métricas sigma em tempo real
  const metricasSigma = useMemo(() => {
    return calcularMetricasSigma(limitesEfetivos, especificacoesEfetivas)
  }, [limitesEfetivos, especificacoesEfetivas])

  // Alternar um toggle individual
  const handleToggle = (chave: keyof SecoesRelatorioPDF) => {
    setSecoes((prev) => ({
      ...prev,
      [chave]: !prev[chave],
    }))
  }

  // Ações em massa para os toggles
  const handleSelecionarTodos = () => {
    setSecoes({
      incluirMetadados: true,
      incluirGrafico: true,
      incluirLimitesControle: true,
      incluirLimitesEspecificacao: true,
      incluirAnaliseSigmas: true,
      incluirTabelaAmostras: true,
    })
  }

  const handleRestaurarPadrao = () => {
    setSecoes({
      incluirMetadados: true,
      incluirGrafico: true,
      incluirLimitesControle: true,
      incluirLimitesEspecificacao: true,
      incluirAnaliseSigmas: true,
      incluirTabelaAmostras: false,
    })
  }

  // Executar a compilação e download do relatório PDF
  const handleGerarRelatorio = async () => {
    setIsGerando(true)
    try {
      // Capturar imagem do canvas ECharts caso o toggle de gráfico esteja ativo
      let imagemDataUrl: string | null = null
      if (secoes.incluirGrafico && chartContainerRef.current) {
        imagemDataUrl = chartContainerRef.current.getDataURL({ type: 'png', pixelRatio: 2 }) || null
      }

      // Mapear histórico de subgrupos para o relatório
      const subgruposReport: SubgrupoReport[] = (subgrupos || []).map((sg) => ({
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

      const resultado = await gerarRelatorioPDF({
        cartaId: cartaDetalhes?.id || 'N/A',
        tipoCarta: cartaDetalhes?.tipo_carta || 'X_R',
        tamanhoSubgrupo: cartaDetalhes?.tamanho_subgrupo || 5,
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
        mensagem: `Arquivo "${resultado.nomeArquivo}" exportado com sucesso.`,
      })
    } catch {
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
      descricao: 'Captura em alta resolução da carta de controle no momento da emissão.',
      icone: BarChart2,
    },
    {
      chave: 'incluirLimitesControle',
      titulo: 'Limites de Controle Estatístico',
      descricao: 'Linha Central (LC), Limites Superior (LSC), Inferior (LIC) e Sigma estimado (σ).',
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
      descricao: 'Distância da Linha Central aos limites (±3σ) e Nível Sigma de Engenharia (Z).',
      icone: Activity,
    },
    {
      chave: 'incluirMetadados',
      titulo: 'Metadados e Identificação da Linha',
      descricao: 'Identificador do processo, código da linha, tamanho amostral n e data de emissão.',
      icone: FileText,
    },
    {
      chave: 'incluirTabelaAmostras',
      titulo: 'Histórico Resumido das Amostras',
      descricao: 'Tabela complementar com as últimas medições e violações das Regras de Nelson.',
      icone: Table,
    },
  ]

  const totalSecoesAtivas = Object.values(secoes).filter(Boolean).length
  const algumaSecaoSelecionada = totalSecoesAtivas > 0

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-7xl mx-auto w-full">
      {/* 1. Cabeçalho Principal da Página */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-100">
                Gerar Relatório Técnico
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Configure os toggles das seções técnicas e exporte o documento analítico completo em formato PDF (Norma A4).
              </p>
            </div>
          </div>
        </div>

        {/* Seletor de Carta de Controle e Badges Informativos */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="select-carta-relatorio" className="text-xs text-slate-400 font-medium whitespace-nowrap">
              Carta:
            </label>
            <select
              id="select-carta-relatorio"
              value={cartaAtivaId}
              onChange={(e) => setCartaSelecionadaId(e.target.value)}
              disabled={carregandoCartas || cartas.length === 0}
              className="px-3 py-1.5 bg-slate-900 border border-slate-700/80 rounded-lg text-xs font-medium text-slate-200 focus:outline-hidden focus:border-blue-500 cursor-pointer"
            >
              {cartas.map((c) => (
                <option key={c.id} value={c.id}>
                  {formatarNomeCarta(c)}
                </option>
              ))}
            </select>
          </div>

          {cartaDetalhes && (
            <div className="flex items-center gap-2">
              <Badge variant="neutro" className="font-mono text-2xs">
                {cartaDetalhes.tipo_carta}
              </Badge>
              <Badge
                variant={cartaDetalhes.modo_limites === 'DINAMICO' ? 'dinamico' : 'fixo'}
                className="text-2xs"
              >
                {cartaDetalhes.modo_limites === 'DINAMICO' ? 'Limites Dinâmicos' : 'Limites Fixos'}
              </Badge>
            </div>
          )}
        </div>
      </div>

      {/* 2. Card de Diagnóstico e Métricas de Sigmas em Tempo Real */}
      <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-400" />
            <h2 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
              Diagnóstico de Sigmas da Carta Atual
            </h2>
          </div>
          <span className="text-2xs text-slate-400">
            Amostras carregadas: <strong className="text-slate-200 font-mono">{subgrupos.length}</strong>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl">
            <span className="text-2xs text-slate-400 block mb-0.5">Limites da Carta</span>
            <span className="font-mono text-sm sm:text-base font-bold text-blue-400">
              ±{metricasSigma.distanciaLscSigma ?? 3.0}σ
            </span>
            <span className="text-3xs text-slate-500 block mt-0.5">Faixa natural ±3 desvios</span>
          </div>

          <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl">
            <span className="text-2xs text-slate-400 block mb-0.5">Nível Sigma (Zmin)</span>
            <span className="font-mono text-sm sm:text-base font-bold text-emerald-400">
              {metricasSigma.zMin !== null ? `${metricasSigma.zMin.toFixed(2)}σ` : 'N/D'}
            </span>
            <span className="text-3xs text-slate-500 block mt-0.5">Distância à especificação crítica</span>
          </div>

          <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl">
            <span className="text-2xs text-slate-400 block mb-0.5">Cpk Equivalente</span>
            <span className="font-mono text-sm sm:text-base font-bold text-amber-400">
              {metricasSigma.cpkEquivalente !== null ? metricasSigma.cpkEquivalente.toFixed(2) : 'N/D'}
            </span>
            <span className="text-3xs text-slate-500 block mt-0.5">Índice Z / 3</span>
          </div>

          <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl">
            <span className="text-2xs text-slate-400 block mb-0.5">Classificação</span>
            <span
              className="text-xs font-semibold text-slate-200 truncate block mt-0.5"
              title={metricasSigma.classificacaoSigma}
            >
              {metricasSigma.classificacaoSigma}
            </span>
            <span className="text-3xs text-slate-500 block mt-0.5">Status de capabilidade</span>
          </div>
        </div>
      </div>

      {/* 3. Seção Principal: Painel de Toggles + Painel de Ações */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna 1 & 2: Seleção de Toggles */}
        <div className="lg:col-span-2 space-y-4">
          <div className="p-4 sm:p-5 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-4 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-purple-400" />
                  <h2 className="text-sm font-semibold text-slate-100">
                    Seções do Relatório (Toggles)
                  </h2>
                </div>
                <p className="text-2xs sm:text-xs text-slate-400 mt-0.5">
                  Ative ou desative os blocos para personalizar o conteúdo do documento PDF:
                </p>
              </div>

              {/* Botões de Ação Rápida dos Toggles */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelecionarTodos}
                  className="px-2.5 py-1 text-2xs font-medium text-purple-300 hover:text-white bg-purple-950/40 hover:bg-purple-900/40 border border-purple-800/50 rounded-lg transition-colors cursor-pointer"
                >
                  Selecionar Todos
                </button>
                <button
                  type="button"
                  onClick={handleRestaurarPadrao}
                  className="flex items-center gap-1 px-2.5 py-1 text-2xs font-medium text-slate-400 hover:text-slate-200 bg-slate-800/60 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  title="Restaurar seleção padrão"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Padrão</span>
                </button>
              </div>
            </div>

            {/* Grid dos Toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="toggles-grid">
              {opcoesToggles.map((item) => {
                const ativo = secoes[item.chave]
                const Icone = item.icone

                return (
                  <button
                    key={item.chave}
                    type="button"
                    onClick={() => handleToggle(item.chave)}
                    className={`flex items-start gap-3 p-3.5 text-left rounded-xl border transition-all cursor-pointer ${
                      ativo
                        ? 'bg-blue-950/40 border-blue-500/70 text-slate-100 shadow-xs'
                        : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:border-slate-700 hover:bg-slate-950/60'
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
                        <Icone
                          className={`w-3.5 h-3.5 shrink-0 ${
                            ativo ? 'text-blue-400' : 'text-slate-500'
                          }`}
                        />
                        <span className="truncate">{item.titulo}</span>
                      </div>
                      <p className="text-2xs text-slate-400 mt-1 leading-snug">
                        {item.descricao}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Coluna 3: Card de Ação e Parâmetros */}
        <div className="space-y-4">
          <div className="p-4 sm:p-5 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xs flex flex-col justify-between h-full">
            <div>
              <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-3">
                Resumo da Exportação
              </h3>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between p-2.5 bg-slate-950/60 border border-slate-800/80 rounded-xl">
                  <span className="text-slate-400">Seções Ativas:</span>
                  <span className="font-mono font-semibold text-slate-200">
                    {totalSecoesAtivas} de {opcoesToggles.length}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 bg-slate-950/60 border border-slate-800/80 rounded-xl">
                  <span className="text-slate-400">Formato:</span>
                  <span className="font-mono text-slate-300">A4 Retrato (PDF)</span>
                </div>

                <div className="flex items-center justify-between p-2.5 bg-slate-950/60 border border-slate-800/80 rounded-xl">
                  <span className="text-slate-400">Snapshot do Gráfico:</span>
                  <span className="flex items-center gap-1 font-medium">
                    {secoes.incluirGrafico ? (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Incluso
                      </span>
                    ) : (
                      <span className="text-slate-500 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Omitido
                      </span>
                    )}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 bg-slate-950/60 border border-slate-800/80 rounded-xl">
                  <span className="text-slate-400">Tabela de Amostras:</span>
                  <span className="font-medium">
                    {secoes.incluirTabelaAmostras ? (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Inclusa ({Math.min(subgrupos.length, 25)} pts)
                      </span>
                    ) : (
                      <span className="text-slate-500 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Omitida
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Botão de Disparo da Exportação */}
            <div className="pt-4 mt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={handleGerarRelatorio}
                disabled={isGerando || !algumaSecaoSelecionada}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-lg shadow-blue-600/20 transition-all cursor-pointer"
              >
                {isGerando ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Compilando Relatório PDF...</span>
                  </>
                ) : (
                  <>
                    <FileDown className="w-4 h-4" />
                    <span>Gerar Relatório PDF</span>
                  </>
                )}
              </button>

              {!algumaSecaoSelecionada && (
                <p className="text-3xs text-rose-400 text-center mt-2">
                  Selecione ao menos uma seção para habilitar a geração.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Visualização Prévia do Gráfico de Controle */}
      <div className="p-4 sm:p-5 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-blue-400" />
              <h2 className="text-sm font-semibold text-slate-100">
                Visualização Prévia da Carta de Controle
              </h2>
            </div>
            <p className="text-2xs sm:text-xs text-slate-400 mt-0.5">
              Esta é a representação gráfica atualizada da linha. Quando a opção "Snapshot do Gráfico Atual" estiver ativa, esta imagem será embutida no relatório:
            </p>
          </div>

          <div className="flex items-center gap-2">
            {secoes.incluirGrafico ? (
              <span className="flex items-center gap-1 px-2.5 py-1 text-2xs font-medium rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Eye className="w-3 h-3" />
                Snapshot ativo no PDF
              </span>
            ) : (
              <span className="flex items-center gap-1 px-2.5 py-1 text-2xs font-medium rounded-lg bg-slate-800 text-slate-400 border border-slate-700">
                <EyeOff className="w-3 h-3" />
                Snapshot desativado nos toggles
              </span>
            )}
          </div>
        </div>

        <div className="w-full">
          <CartaControleContainer
            ref={chartContainerRef}
            subgrupos={subgrupos}
            limites={cartaDetalhes?.limites_atuais}
            especificacoes={cartaDetalhes?.especificacoes}
            tipoCarta={cartaDetalhes?.tipo_carta}
            tamanhoSubgrupo={cartaDetalhes?.tamanho_subgrupo}
            height={460}
            mostrarControles={false}
            loading={carregandoSubgrupos}
          />
        </div>
      </div>
    </div>
  )
}
