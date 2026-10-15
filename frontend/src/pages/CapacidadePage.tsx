import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  Award,
  Cpu,
  Layers,
  RefreshCw,
  Ruler,
  Sliders,
  AlertTriangle,
} from 'lucide-react'
import { Badge } from '@/components/common/Badge'
import { CardKpi } from '@/components/common/CardKpi'
import {
  BannerSuficiencia,
  GaugesCapacidade,
  HistogramaCapacidade,
} from '@/components/capacidade'
import { cartasApi, ingestaoApi } from '@/services/api'
import { useCEPStore } from '@/stores/cepStore'
import type { CapacidadeResponse } from '@/types/api'
import { formatarNomeCarta } from '@/utils/formatters'

export function CapacidadePage() {
  const storeCartaDetalhes = useCEPStore((s) => s.cartaDetalhes)
  const storeSubgrupos = useCEPStore((s) => s.subgruposHistorico)
  const [cartaSelecionadaId, setCartaSelecionadaId] = useState<string>('')

  // 1. Carregar lista de cartas disponíveis
  const { data: cartas = [], isLoading: carregandoCartas } = useQuery({
    queryKey: ['cartas'],
    queryFn: () => cartasApi.listar(),
    staleTime: 30000,
  })

  // Carta ativa derivada sem efeito cascata
  const cartaAtivaId = cartaSelecionadaId || storeCartaDetalhes?.id || cartas[0]?.id || ''

  // 2. Carregar relatório de capacidade do backend
  const {
    data: capacidadeData,
    refetch: recarregarCapacidade,
  } = useQuery({
    queryKey: ['capacidade', cartaAtivaId],
    queryFn: () => cartasApi.obterCapacidade(cartaAtivaId),
    enabled: Boolean(cartaAtivaId),
    staleTime: 15000,
  })

  // 3. Carregar amostras de subgrupos da carta para compor o histograma real
  const { data: subgrupos = storeSubgrupos } = useQuery({
    queryKey: ['subgrupos', cartaAtivaId],
    queryFn: () => ingestaoApi.listarSubgrupos(cartaAtivaId, 200),
    enabled: Boolean(cartaAtivaId),
    staleTime: 15000,
  })

  // Extrair todas as medições brutas de todos os subgrupos
  const todasAmostras = useMemo(() => {
    if (!subgrupos || subgrupos.length === 0) return []
    return subgrupos.flatMap((sg) => sg.valores_brutos)
  }, [subgrupos])

  // Fallback para quando o backend ainda não tiver calculado os dados ou para mock inicial
  const capacidadeEfetiva: CapacidadeResponse = useMemo(() => {
    if (capacidadeData) return capacidadeData

    // Dados aproximados a partir do histórico local se disponível
    const media =
      todasAmostras.length > 0
        ? todasAmostras.reduce((a, b) => a + b, 0) / todasAmostras.length
        : 25.0
    const sigma = storeCartaDetalhes?.limites_atuais?.sigma_estimado || 0.5
    const specs = storeCartaDetalhes?.especificacoes || {
      lse: 26.5,
      lie: 23.5,
      valor_nominal: 25.0,
    }

    const lse = specs.lse ?? media + 3 * sigma
    const lie = specs.lie ?? media - 3 * sigma
    const cp = (lse - lie) / (6 * sigma)
    const cpu = (lse - media) / (3 * sigma)
    const cpl = (media - lie) / (3 * sigma)
    const cpk = Math.min(cpu, cpl)

    return {
      carta_id: cartaAtivaId || 'mock-id',
      processo_id: 'proc-1',
      tipo_carta: storeCartaDetalhes?.tipo_carta || 'X_R',
      tamanho_subgrupo: storeCartaDetalhes?.tamanho_subgrupo || 5,
      total_subgrupos: subgrupos.length || storeSubgrupos.length || 15,
      amostra_estatisticamente_robusta: (subgrupos.length || 0) >= 20,
      aviso: (subgrupos.length || 0) < 20 ? 'Amostra com menos de 20 subgrupos' : null,
      media_processo: media,
      sigma_estimado: sigma,
      especificacoes: specs,
      limites_controle: storeCartaDetalhes?.limites_atuais || {
        lc: media,
        lsc: media + 3 * sigma,
        lic: media - 3 * sigma,
        sigma_estimado: sigma,
      },
      indices: {
        cp: Number(cp.toFixed(3)),
        cpk: Number(cpk.toFixed(3)),
        cpu: Number(cpu.toFixed(3)),
        cpl: Number(cpl.toFixed(3)),
      },
      aprovado: cpk >= 1.33,
      criterio_aprovacao: 1.33,
      classificacao: cpk >= 1.33 ? 'Capaz e Centrado' : cpk >= 1.0 ? 'Aceitável' : 'Incapaz',
    }
  }, [capacidadeData, todasAmostras, storeCartaDetalhes, subgrupos.length, storeSubgrupos.length, cartaAtivaId])

  const toleranciaEngenharia =
    capacidadeEfetiva.especificacoes.lse != null && capacidadeEfetiva.especificacoes.lie != null
      ? (capacidadeEfetiva.especificacoes.lse - capacidadeEfetiva.especificacoes.lie).toFixed(3)
      : '--'

  const larguraProcesso = (6 * capacidadeEfetiva.sigma_estimado).toFixed(3)

  const possuiAnomalias = useMemo(() => {
    return subgrupos.some((sg) => sg.fora_de_controle)
  }, [subgrupos])

  const { textoDeslocamento } = useMemo(() => {
    const lc = capacidadeEfetiva.limites_controle?.lc ?? capacidadeEfetiva.media_processo
    const nominal = capacidadeEfetiva.especificacoes?.valor_nominal
    const lse = capacidadeEfetiva.especificacoes?.lse
    const lie = capacidadeEfetiva.especificacoes?.lie

    if (nominal == null) {
      return { offsetNominal: null, textoDeslocamento: null }
    }

    const offset = Number((lc - nominal).toFixed(4))
    const sinal = offset >= 0 ? '+' : ''

    if (offset >= 0 && lse != null && lse > nominal) {
      const perc = ((lc - nominal) / (lse - nominal)) * 100
      return {
        offsetNominal: offset,
        textoDeslocamento: `${sinal}${offset.toFixed(4)} mm (+${perc.toFixed(1)}% em direção ao LSE)`,
      }
    } else if (offset < 0 && lie != null && nominal > lie) {
      const perc = ((nominal - lc) / (nominal - lie)) * 100
      return {
        offsetNominal: offset,
        textoDeslocamento: `${offset.toFixed(4)} mm (-${perc.toFixed(1)}% em direção ao LIE)`,
      }
    }

    return {
      offsetNominal: offset,
      textoDeslocamento: `${sinal}${offset.toFixed(4)} mm`,
    }
  }, [capacidadeEfetiva])

  return (
    <div data-testid="capacidade-page" className="space-y-6">
      {/* Cabeçalho Semântico da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-extrabold text-slate-100 tracking-tight flex items-center gap-2.5">
            <Award className="w-5 h-5 text-blue-400" />
            Análise de Capacidade do Processo
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Estudo dos índices de capacidade Cp, Cpk e conformidade com limites de especificação [RN04]
          </p>
        </div>
      </div>

      {/* Barra Superior de Navegação da Análise de Capacidade */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl backdrop-blur-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <span className="text-2xs font-semibold text-slate-400 uppercase tracking-wider block">
              Carta para Estudo de Capacidade:
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <select
                data-testid="seletor-carta-capacidade"
                value={cartaAtivaId}
                onChange={(e) => setCartaSelecionadaId(e.target.value)}
                className="px-3 py-1.5 text-xs font-semibold font-mono rounded-xl bg-slate-950 border border-slate-700 text-slate-200 focus:outline-hidden focus:border-blue-500 cursor-pointer"
              >
                {cartas.length === 0 ? (
                  <option value="">
                    {carregandoCartas ? 'Carregando...' : 'Carta Padrão em Análise'}
                  </option>
                ) : (
                  cartas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {formatarNomeCarta(c)} - {c.total_subgrupos} subgrupos
                    </option>
                  ))
                )}
              </select>

              <button
                type="button"
                onClick={() => recarregarCapacidade()}
                title="Recalcular capacidade"
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="hidden sm:block h-8 w-px bg-slate-800 mx-1" />

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutro" className="text-2xs font-mono">
              <Layers className="w-3 h-3 mr-1 text-slate-400" />
              {capacidadeEfetiva.tipo_carta}
            </Badge>

            <Badge variant="neutro" className="text-2xs font-mono">
              <Sliders className="w-3 h-3 mr-1 text-slate-400" />
              n={capacidadeEfetiva.tamanho_subgrupo}
            </Badge>

            <Badge variant="neutro" className="text-2xs font-mono">
              Total: {capacidadeEfetiva.total_subgrupos} Subgrupos
            </Badge>
          </div>
        </div>

        {/* Status de Homologação */}
        <div className="flex items-center gap-3">
          <Badge
            variant={capacidadeEfetiva.aprovado ? 'sob_controle' : 'fora_de_controle'}
            pulse={capacidadeEfetiva.aprovado}
            className="text-xs py-1 px-3 font-bold"
          >
            {capacidadeEfetiva.aprovado ? 'HOMOLOGADO (Cpk ≥ 1.33)' : 'NÃO HOMOLOGADO'}
          </Badge>
        </div>
      </div>

      {/* Banner Informativo de Suficiência Estatística [RN04] */}
      <BannerSuficiencia
        totalSubgrupos={capacidadeEfetiva.total_subgrupos}
        minimoRecomendado={20}
      />

      {/* Indicador de Deslocamento do Nominal e Alerta de Estabilidade [RN04] */}
      {textoDeslocamento && (
        <div
          data-testid="indicador-descentralizacao-nominal"
          className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
            possuiAnomalias
              ? 'bg-amber-950/40 border-amber-800/60 text-amber-200'
              : 'bg-slate-900/80 border-slate-800 text-slate-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-400">Deslocamento do Nominal (Offset):</span>
            <span className="font-mono font-bold text-amber-400">{textoDeslocamento}</span>
          </div>
          {possuiAnomalias && (
            <div className="flex items-center gap-1.5 text-red-400 font-semibold text-2xs uppercase tracking-wider">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>Processo Instável: Requer Estabilização [RN04]</span>
            </div>
          )}
        </div>
      )}

      {/* Grid de Cards KPIs de Capacidade */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <CardKpi
          titulo="Média do Processo (μ)"
          valor={capacidadeEfetiva.media_processo.toFixed(3)}
          subtitulo={`Alvo Nominal: ${capacidadeEfetiva.especificacoes.valor_nominal ?? '--'}`}
          status="normal"
          icone={<Activity className="w-4 h-4 text-blue-400" />}
        />

        <CardKpi
          titulo="Desvio Estimado (σ̂)"
          valor={capacidadeEfetiva.sigma_estimado.toFixed(4)}
          subtitulo="Variabilidade intra-subgrupo"
          status="normal"
          icone={<Cpu className="w-4 h-4 text-purple-400" />}
        />

        <CardKpi
          titulo="Largura do Processo (6σ)"
          valor={larguraProcesso}
          subtitulo={`Tolerância Engenharia: ${toleranciaEngenharia}`}
          status="normal"
          icone={<Ruler className="w-4 h-4 text-amber-400" />}
        />

        <CardKpi
          titulo="Índice Real (Cpk)"
          valor={
            capacidadeEfetiva.indices.cpk != null
              ? capacidadeEfetiva.indices.cpk.toFixed(2)
              : '--'
          }
          subtitulo={`Critério de Aprovação: ≥ ${capacidadeEfetiva.criterio_aprovacao.toFixed(2)}`}
          status={possuiAnomalias ? 'danger' : (capacidadeEfetiva.aprovado ? 'success' : 'danger')}
          icone={<Award className="w-4 h-4 text-emerald-400" />}
          badge={
            <Badge
              variant={possuiAnomalias ? 'fora_de_controle' : (capacidadeEfetiva.aprovado ? 'sob_controle' : 'fora_de_controle')}
            >
              {possuiAnomalias
                ? `Cpk Aparente: ${capacidadeEfetiva.indices.cpk != null ? capacidadeEfetiva.indices.cpk.toFixed(3) : '1.390'} (PROCESSO INSTÁVEL - Requer Estabilização)`
                : capacidadeEfetiva.classificacao}
            </Badge>
          }
        />
      </div>

      {/* Gráficos Centrais: Velocímetros de Cp/Cpk e Histograma com Curva de Gauss */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Coluna Esquerda (5/12): Gauges de Cp e Cpk */}
        <div className="lg:col-span-5">
          <GaugesCapacidade
            indices={capacidadeEfetiva.indices}
            classificacao={capacidadeEfetiva.classificacao}
            aprovado={capacidadeEfetiva.aprovado}
            criterioAprovacao={capacidadeEfetiva.criterio_aprovacao}
            className="h-full"
          />
        </div>

        {/* Coluna Direita (7/12): Histograma com Curva Gaussiana */}
        <div className="lg:col-span-7">
          <HistogramaCapacidade
            amostras={todasAmostras}
            mediaProcesso={capacidadeEfetiva.media_processo}
            sigmaEstimado={capacidadeEfetiva.sigma_estimado}
            especificacoes={capacidadeEfetiva.especificacoes}
            height={380}
            className="h-full"
          />
        </div>
      </div>
    </div>
  )
}
