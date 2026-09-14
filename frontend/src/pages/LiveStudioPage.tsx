import { useEffect, useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  BarChart3,
  Cpu,
  Layers,
  Radio,
  RefreshCw,
  Sliders,
} from 'lucide-react'
import { Badge } from '@/components/common/Badge'
import { CardKpi } from '@/components/common/CardKpi'
import { CartaControleContainer } from '@/components/charts'
import {
  FeedAlarmes,
  ModalCausaEspecial,
  DistribuicaoRegrasNelson,
  ResumoCapacidadeLive,
  type DadosCausaEspecial,
} from '@/components/live'
import { cartasApi, ingestaoApi } from '@/services/api'
import { useCEPStore, type AlarmeAtivo } from '@/stores/cepStore'
import { useToastStore } from '@/stores/toastStore'
import { useWebSocketCEP } from '@/hooks/useWebSocketCEP'
import { formatarNomeCarta } from '@/utils/formatters'

export function LiveStudioPage() {
  const [cartaSelecionadaId, setCartaSelecionadaId] = useState<string>('')
  const [alarmeParaApontamento, setAlarmeParaApontamento] = useState<AlarmeAtivo | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Store Zustand
  const cartaDetalhesStore = useCEPStore((s) => s.cartaDetalhes)
  const setCartaDetalhes = useCEPStore((s) => s.setCartaDetalhes)
  const subgrupos = useCEPStore((s) => s.subgruposHistorico)
  const setBufferHistorico = useCEPStore((s) => s.setBufferHistorico)
  const alarmesAtivos = useCEPStore((s) => s.alarmesAtivos)
  const removerAlarme = useCEPStore((s) => s.removerAlarme)
  const limparAlarmes = useCEPStore((s) => s.limparAlarmes)
  const statusConexao = useCEPStore((s) => s.statusConexao)
  const adicionarToast = useToastStore((s) => s.adicionarToast)

  // 1. Carregar lista de cartas disponíveis via TanStack Query
  const { data: cartas = [], isLoading: carregandoCartas } = useQuery({
    queryKey: ['cartas'],
    queryFn: () => cartasApi.listar(),
    staleTime: 30000,
  })

  // Carta efetiva derivada
  const cartaAtivaId = cartaSelecionadaId || cartas[0]?.id || ''
  const cartaDetalhes = useMemo(
    () => cartas.find((c) => c.id === cartaAtivaId) || cartaDetalhesStore,
    [cartas, cartaAtivaId, cartaDetalhesStore]
  )

  // 2. Carregar histórico inicial quando a carta selecionada mudar
  const { data: historicoInicial, refetch: recarregarHistorico } = useQuery({
    queryKey: ['subgrupos', cartaAtivaId],
    queryFn: () => ingestaoApi.listarSubgrupos(cartaAtivaId, 100),
    enabled: Boolean(cartaAtivaId),
    staleTime: 10000,
  })

  useEffect(() => {
    if (historicoInicial && historicoInicial.length > 0) {
      setBufferHistorico(historicoInicial)
    }
  }, [historicoInicial, setBufferHistorico])

  // 3. Subscrição contínua ao WebSocket da carta ativa
  useWebSocketCEP(cartaAtivaId, {
    autoReconnect: true,
  })

  // Estatísticas e KPIs calculados da sessão
  const metricas = useMemo(() => {
    if (subgrupos.length === 0) {
      return {
        mediaGeral: '--',
        dispersaoMedia: '--',
        sigma: '--',
        rotuloDispersao: 'R̄',
        foraDeControle: false,
        sparkMedia: [] as number[],
        sparkDispersao: [] as number[],
        sparkSigma: [] as number[],
        sparkSubgrupos: [] as number[],
        varMedia: undefined as string | undefined,
        varMediaPositiva: true,
        varDisp: undefined as string | undefined,
        varDispPositiva: true,
        varSigma: undefined as string | undefined,
        varSigmaPositiva: true,
      }
    }

    const n = cartaDetalhes?.tamanho_subgrupo || 5
    const rotuloDispersao = n === 1 ? 'MR̄' : n > 10 ? 's̄' : 'R̄'

    const somaMedia = subgrupos.reduce((acc, sg) => acc + sg.estatisticas.media_x, 0)
    const mediaGeral = (somaMedia / subgrupos.length).toFixed(3)

    const somaDisp = subgrupos.reduce((acc, sg) => {
      if (n > 10) return acc + sg.estatisticas.desvio_s
      return acc + sg.estatisticas.amplitude_r
    }, 0)
    const dispersaoMedia = (somaDisp / subgrupos.length).toFixed(3)

    const sigmaVal = cartaDetalhes?.limites_atuais?.sigma_estimado
      ? cartaDetalhes.limites_atuais.sigma_estimado.toFixed(3)
      : (parseFloat(dispersaoMedia) / (n === 1 ? 1.128 : 2.326)).toFixed(3)

    const foraDeControle = subgrupos.some((sg) => sg.fora_de_controle)

    // Sparklines dos últimos 15 subgrupos
    const recentSubgrupos = subgrupos.slice(-15)
    const sparkMedia = recentSubgrupos.map((sg) => sg.estatisticas.media_x)
    const sparkDispersao = recentSubgrupos.map((sg) =>
      n > 10 ? sg.estatisticas.desvio_s : sg.estatisticas.amplitude_r
    )
    const d2 = n === 1 ? 1.128 : 2.326
    const sparkSigma = recentSubgrupos.map((sg) =>
      n > 10 ? sg.estatisticas.desvio_s : sg.estatisticas.amplitude_r / d2
    )
    const sparkSubgrupos = recentSubgrupos.map((_, i) => i + 1)

    // Variações percentuais no intervalo recente
    const calcVar = (arr: number[]) => {
      if (arr.length < 2) return undefined
      const first = arr[0]
      const last = arr[arr.length - 1]
      if (first === 0) return undefined
      const pct = ((last - first) / Math.abs(first)) * 100
      return Number(pct.toFixed(1))
    }

    const varMediaNum = calcVar(sparkMedia)
    const varDispNum = calcVar(sparkDispersao)
    const varSigmaNum = calcVar(sparkSigma)

    return {
      mediaGeral,
      dispersaoMedia,
      sigma: sigmaVal,
      rotuloDispersao,
      foraDeControle,
      sparkMedia,
      sparkDispersao,
      sparkSigma,
      sparkSubgrupos,
      varMedia: varMediaNum != null ? `${Math.abs(varMediaNum)}%` : undefined,
      varMediaPositiva: varMediaNum != null ? varMediaNum >= 0 : true,
      varDisp: varDispNum != null ? `${Math.abs(varDispNum)}%` : undefined,
      varDispPositiva: varDispNum != null ? varDispNum <= 0 : true, // Menor dispersão é positivo
      varSigma: varSigmaNum != null ? `${Math.abs(varSigmaNum)}%` : undefined,
      varSigmaPositiva: varSigmaNum != null ? varSigmaNum <= 0 : true, // Menor sigma é positivo
    }
  }, [subgrupos, cartaDetalhes])

  const handleSelectCarta = (novaId: string) => {
    setCartaSelecionadaId(novaId)
    const carta = cartas.find((c) => c.id === novaId)
    if (carta) {
      setCartaDetalhes(carta)
    }
  }

  const handleAbrirApontamento = (alarme: AlarmeAtivo) => {
    setAlarmeParaApontamento(alarme)
    setIsModalOpen(true)
  }

  const handleSalvarApontamento = (dados: DadosCausaEspecial) => {
    if (alarmeParaApontamento) {
      removerAlarme(alarmeParaApontamento.id)
    }

    adicionarToast({
      tipo: 'success',
      titulo: 'Apontamento Registrado',
      mensagem: `Causa especial registrada para o subgrupo #${dados.subgrupoNumero} com sucesso.`,
    })
  }

  return (
    <div data-testid="live-studio-page" className="space-y-6">
      {/* Cabeçalho Semântico da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-extrabold text-slate-100 tracking-tight flex items-center gap-2.5">
            <Radio className="w-5 h-5 text-emerald-400" />
            Live CEP Studio
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Monitoramento estatístico em tempo real com regras de Nelson e feed de anomalias
          </p>
        </div>
      </div>

      {/* Barra de Status e Seletor Superior */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl backdrop-blur-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <span className="text-2xs font-semibold text-slate-400 uppercase tracking-wider block">
              Carta Ativa:
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <select
                data-testid="seletor-carta-ativa"
                value={cartaAtivaId}
                onChange={(e) => handleSelectCarta(e.target.value)}
                className="px-3 py-1.5 text-xs font-semibold font-mono rounded-xl bg-slate-950 border border-slate-700 text-slate-200 focus:outline-hidden focus:border-blue-500 cursor-pointer"
              >
                {cartas.length === 0 ? (
                  <option value="">
                    {carregandoCartas ? 'Carregando cartas...' : 'Carta Padrão (Simulador)'}
                  </option>
                ) : (
                  cartas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {formatarNomeCarta(c)} - {c.modo_limites}
                    </option>
                  ))
                )}
              </select>

              <button
                type="button"
                onClick={() => recarregarHistorico()}
                title="Recarregar histórico"
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="hidden sm:block h-8 w-px bg-slate-800 mx-1" />

          {/* Badges de Metadados da Carta */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutro" className="text-2xs font-mono">
              <Layers className="w-3 h-3 mr-1 text-slate-400" />
              Tipo: {cartaDetalhes?.tipo_carta || 'X_R'}
            </Badge>

            <Badge variant="neutro" className="text-2xs font-mono">
              <Sliders className="w-3 h-3 mr-1 text-slate-400" />
              Amostra: n={cartaDetalhes?.tamanho_subgrupo || 5}
            </Badge>

            <Badge
              variant={cartaDetalhes?.modo_limites === 'FIXO' ? 'neutro' : 'alerta'}
              className="text-2xs font-mono"
            >
              Modo: {cartaDetalhes?.modo_limites || 'DINÂMICO'}
            </Badge>
          </div>
        </div>

        {/* Telemetria e Pulso de Streaming */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800">
            <Radio
              className={`w-3.5 h-3.5 ${
                statusConexao === 'ONLINE'
                  ? 'text-emerald-400 animate-pulse'
                  : statusConexao === 'RECONNECTING'
                    ? 'text-amber-400 animate-spin'
                    : 'text-red-400'
              }`}
            />
            <span className="text-2xs font-mono font-medium text-slate-300">
              WebSocket: {statusConexao}
            </span>
          </div>

          <Badge
            variant={metricas.foraDeControle ? 'fora_de_controle' : 'sob_controle'}
            pulse={!metricas.foraDeControle}
            className="text-xs py-1 px-2.5 font-bold"
          >
            {metricas.foraDeControle ? 'FORA DE CONTROLE' : 'SOB CONTROLE'}
          </Badge>
        </div>
      </div>

      {/* Fileira de 4 Cards de KPI com Sparklines Reais e Variações Percentuais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <CardKpi
          titulo="Média Global X̄̄"
          valor={metricas.mediaGeral}
          subtitulo={`LC: ${cartaDetalhes?.limites_atuais?.lc.toFixed(3) || metricas.mediaGeral}`}
          status="normal"
          icone={<Activity className="w-4 h-4 text-blue-400" />}
          sparklineData={metricas.sparkMedia}
          variacao={
            metricas.varMedia
              ? { valor: metricas.varMedia, positivo: metricas.varMediaPositiva }
              : undefined
          }
        />
        <CardKpi
          titulo={`Dispersão Média ${metricas.rotuloDispersao}`}
          valor={metricas.dispersaoMedia}
          subtitulo="Variação interna do subgrupo"
          status="normal"
          icone={<BarChart3 className="w-4 h-4 text-emerald-400" />}
          sparklineData={metricas.sparkDispersao}
          variacao={
            metricas.varDisp
              ? { valor: metricas.varDisp, positivo: metricas.varDispPositiva }
              : undefined
          }
        />
        <CardKpi
          titulo="Desvio Estimado σ̂"
          valor={metricas.sigma}
          subtitulo="Variabilidade natural do processo"
          status="normal"
          icone={<Cpu className="w-4 h-4 text-purple-400" />}
          sparklineData={metricas.sparkSigma}
          variacao={
            metricas.varSigma
              ? { valor: metricas.varSigma, positivo: metricas.varSigmaPositiva }
              : undefined
          }
        />
        <CardKpi
          titulo="Subgrupos Processados"
          valor={String(subgrupos.length)}
          subtitulo={`${alarmesAtivos.length} violações registradas`}
          status={alarmesAtivos.length > 0 ? 'warning' : 'success'}
          icone={<Layers className="w-4 h-4 text-slate-400" />}
          badge={
            <Badge variant={alarmesAtivos.length > 0 ? 'fora_de_controle' : 'sob_controle'}>
              {alarmesAtivos.length > 0 ? `${alarmesAtivos.length} ALARMES` : 'ESTÁVEL'}
            </Badge>
          }
          sparklineData={metricas.sparkSubgrupos}
        />
      </div>

      {/* Gráfico Herói: Carta de Controle com Barra de Resumo de Estágio e Limites */}
      <div className="w-full">
        <CartaControleContainer height={540} />
      </div>

      {/* Fileira Inferior: Distribuição de Violações, Donut de Capacidade e Feed de Alarmes */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 items-start">
        {/* Painel 1: Ranking e Distribuição de Violações por Regra de Nelson */}
        <DistribuicaoRegrasNelson
          subgrupos={subgrupos}
          alarmes={alarmesAtivos}
          className="h-full"
        />

        {/* Painel 2: Donut de Capacidade e Tolerâncias de Engenharia */}
        <ResumoCapacidadeLive
          carta={cartaDetalhes}
          subgrupos={subgrupos}
          className="h-full"
        />

        {/* Painel 3: Feed de Alarmes Operacionais com Apontamento de Causa Especial */}
        <FeedAlarmes
          alarmes={alarmesAtivos}
          onApontarCausa={handleAbrirApontamento}
          onLimparAlarmes={limparAlarmes}
          className="h-full"
        />
      </div>

      {/* Modal de Apontamento de Causa Especial */}
      <ModalCausaEspecial
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        alarme={alarmeParaApontamento}
        onSalvar={handleSalvarApontamento}
      />
    </div>
  )
}
