import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  History,
} from 'lucide-react'
import { CardKpi } from '@/components/common/CardKpi'
import { ModalCausaEspecial, type DadosCausaEspecial } from '@/components/live/ModalCausaEspecial'
import { TabelaSubgrupos } from '@/components/modules/TabelaSubgrupos'
import { cartasApi, ingestaoApi } from '@/services/api'
import { useCEPStore, type AlarmeAtivo } from '@/stores/cepStore'
import type { CartaControleResponse, SubgrupoResponse } from '@/types/api'
import { formatarNomeCarta } from '@/utils/formatters'

export function HistoricoPage() {
  const { cartaDetalhes, cartaAtivaId, setCartaAtiva } = useCEPStore()
  const [cartas, setCartas] = useState<CartaControleResponse[]>([])
  const [cartaSelecionada, setCartaSelecionada] = useState<CartaControleResponse | null>(null)
  const [subgrupos, setSubgrupos] = useState<SubgrupoResponse[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Modal de Causa Especial
  const [alarmeModal, setAlarmeModal] = useState<AlarmeAtivo | null>(null)
  const [modalCausaAberto, setModalCausaAberto] = useState(false)
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null)

  // Carregar lista de cartas
  useEffect(() => {
    let montado = true
    async function carregarCartas() {
      try {
        const lista = await cartasApi.listar()
        if (!montado) return
        setCartas(lista)

        if (cartaAtivaId) {
          const encontrada = lista.find((c) => c.id === cartaAtivaId)
          if (encontrada) setCartaSelecionada(encontrada)
          else if (lista.length > 0) setCartaSelecionada(lista[0])
        } else if (lista.length > 0) {
          setCartaSelecionada(lista[0])
          setCartaAtiva(lista[0])
        }
      } catch {
        if (cartaDetalhes) setCartaSelecionada(cartaDetalhes)
      }
    }
    carregarCartas()
    return () => {
      montado = false
    }
  }, [cartaAtivaId, cartaDetalhes, setCartaAtiva])

  // Carregar subgrupos da carta selecionada
  useEffect(() => {
    if (!cartaSelecionada) return
    let montado = true

    async function carregarSubgrupos() {
      setIsLoading(true)
      try {
        const dados = await ingestaoApi.listarSubgrupos(cartaSelecionada!.id, 500)
        if (!montado) return
        setSubgrupos(dados)
      } catch {
        // Se a API falhar ou não houver dados, mantém vazio
        if (montado) setSubgrupos([])
      } finally {
        if (montado) setIsLoading(false)
      }
    }

    carregarSubgrupos()
    return () => {
      montado = false
    }
  }, [cartaSelecionada])

  const handleTrocarCarta = (cartaId: string) => {
    const carta = cartas.find((c) => c.id === cartaId) || null
    setCartaSelecionada(carta)
    if (carta) setCartaAtiva(carta)
  }

  // Estatísticas calculadas
  const metricas = useMemo(() => {
    const total = subgrupos.length
    if (total === 0) {
      return { total: 0, anomalias: 0, taxaAnomalia: 0, mediaGeral: 0 }
    }

    const anomalias = subgrupos.filter((s) => s.fora_de_controle).length
    const taxaAnomalia = (anomalias / total) * 100
    const somaMedias = subgrupos.reduce((acc, s) => acc + s.estatisticas.media_x, 0)
    const mediaGeral = somaMedias / total

    return { total, anomalias, taxaAnomalia, mediaGeral }
  }, [subgrupos])

  // Apontamento de Causa
  const handleAbrirApontamento = (sg: SubgrupoResponse) => {
    setAlarmeModal({
      id: `sg-alarm-${sg.id || sg.numero_subgrupo}`,
      subgrupoNumero: sg.numero_subgrupo,
      timestamp: sg.timestamp,
      violacoes: sg.violacoes,
    })
    setModalCausaAberto(true)
  }

  const handleSalvarCausa = (dados: DadosCausaEspecial) => {
    setMensagemSucesso(
      `Causa especial do Subgrupo #${dados.subgrupoNumero} gravada com sucesso por ${dados.responsavel}.`
    )
    setTimeout(() => setMensagemSucesso(null), 5000)
  }

  // Exportação CSV [RF12]
  const handleExportarCSV = () => {
    if (subgrupos.length === 0) return

    const n = cartaSelecionada?.tamanho_subgrupo || 5
    const rotuloDisp = n === 1 ? 'MR' : n > 10 ? 's' : 'R'

    const cabecalho = [
      'Subgrupo',
      'Timestamp',
      'Valores_Amostrais',
      'Media_X',
      `Dispersao_${rotuloDisp}`,
      'Fora_De_Controle',
      'Violacoes_Regras',
    ]

    const linhas = subgrupos.map((sg) => {
      const disp =
        n > 10 ? sg.estatisticas.desvio_s : sg.estatisticas.amplitude_r
      const violacoesTexto = sg.violacoes
        .map((v) => `${v.codigo_regra}(${v.descricao})`)
        .join(' | ')

      return [
        sg.numero_subgrupo,
        `"${sg.timestamp}"`,
        `"${sg.valores_brutos.join(';')}"`,
        sg.estatisticas.media_x.toFixed(4),
        disp.toFixed(4),
        sg.fora_de_controle ? 'SIM' : 'NAO',
        `"${violacoesTexto}"`,
      ].join(',')
    })

    const csvContent = 'data:text/csv;charset=utf-8,' + [cabecalho.join(','), ...linhas].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute(
      'download',
      `historico_subgrupos_${cartaSelecionada?.id.substring(0, 8) || 'dados'}.csv`
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div data-testid="historico-page" className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <History className="w-6 h-6 text-blue-500" />
            Histórico Analítico de Subgrupos
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Registro cronológico das medições fabris, anomalias e causas especiais [RF11, RF12, RF16]
          </p>
        </div>

        {/* Seletor de Carta */}
        <div className="flex items-center gap-2">
          <label htmlFor="select-carta-historico" className="text-xs font-semibold text-slate-400 whitespace-nowrap">
            Carta Analisada:
          </label>
          <select
            id="select-carta-historico"
            value={cartaSelecionada?.id || ''}
            onChange={(e) => handleTrocarCarta(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl bg-slate-900 border border-slate-700 text-slate-200 focus:outline-hidden focus:border-blue-500"
          >
            {cartas.length === 0 ? (
              <option value="">Nenhuma carta cadastrada</option>
            ) : (
              cartas.map((c) => (
                <option key={c.id} value={c.id}>
                  {formatarNomeCarta(c)} - {c.total_subgrupos} subgrupos
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      {/* Alerta de Sucesso */}
      {mensagemSucesso && (
        <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{mensagemSucesso}</span>
        </div>
      )}

      {/* Cards de Métricas do Histórico */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <CardKpi
          titulo="Total de Subgrupos"
          valor={metricas.total}
          icone={<Clock className="w-4 h-4" />}
          subtitulo="Medições coletadas"
        />
        <CardKpi
          titulo="Anomalias Detectadas"
          valor={metricas.anomalias}
          icone={<AlertTriangle className="w-4 h-4" />}
          subtitulo={`${metricas.taxaAnomalia.toFixed(1)}% fora de controle`}
          status={metricas.anomalias > 0 ? 'danger' : 'normal'}
        />
        <CardKpi
          titulo="Média Geral (X̄̄)"
          valor={metricas.mediaGeral > 0 ? metricas.mediaGeral.toFixed(3) : '--'}
          subtitulo="Média de todas as amostras"
        />
        <CardKpi
          titulo="Exportação CSV"
          valor={subgrupos.length > 0 ? 'Disponível' : 'Vazio'}
          icone={<Download className="w-4 h-4" />}
          subtitulo="RFC 4180 com violações"
        />
      </div>

      {/* Tabela de Alta Densidade */}
      {isLoading ? (
        <div className="p-12 border border-slate-800 rounded-2xl bg-slate-900/40 text-center text-slate-400 text-xs">
          Carregando histórico amostral...
        </div>
      ) : (
        <TabelaSubgrupos
          subgrupos={subgrupos}
          cartaAtiva={cartaSelecionada}
          onApontarCausa={handleAbrirApontamento}
          onExportarCSV={handleExportarCSV}
        />
      )}

      {/* Modal de Apontamento de Causa Especial */}
      <ModalCausaEspecial
        isOpen={modalCausaAberto}
        onClose={() => setModalCausaAberto(false)}
        alarme={alarmeModal}
        onSalvar={handleSalvarCausa}
      />
    </div>
  )
}
