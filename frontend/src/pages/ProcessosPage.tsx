import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  AlertCircle,
  Cpu,
  Factory,
  Layers,
  Plus,
  Radio,
  Sparkles,
} from 'lucide-react'
import { Badge } from '@/components/common/Badge'
import { CardKpi } from '@/components/common/CardKpi'
import { WizardNovaCarta } from '@/components/modules/WizardNovaCarta'
import { cartasApi, processosApi } from '@/services/api'
import { useCEPStore } from '@/stores/cepStore'
import type { CartaControleResponse, ProcessoCreate, ProcessoResponse } from '@/types/api'
import { formatarNomeCarta } from '@/utils/formatters'

export function ProcessosPage() {
  const navigate = useNavigate()
  const { setCartaAtiva } = useCEPStore()

  const [processos, setProcessos] = useState<ProcessoResponse[]>([])
  const [cartas, setCartas] = useState<CartaControleResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  // Modal de Criação de Processo
  const [modalNovoProcessoAberto, setModalNovoProcessoAberto] = useState(false)
  const [novoNome, setNovoNome] = useState('')
  const [novoCodigoLinha, setNovoCodigoLinha] = useState('')
  const [novaDescricao, setNovaDescricao] = useState('')
  const [isCriandoProcesso, setIsCriandoProcesso] = useState(false)
  const [erroModalProcesso, setErroModalProcesso] = useState<string | null>(null)

  // Modal Wizard de Nova Carta
  const [wizardCartaAberto, setWizardCartaAberto] = useState(false)
  const [processoSelecionadoParaCarta, setProcessoSelecionadoParaCarta] = useState<string | undefined>()

  const carregarDados = async () => {
    try {
      setIsLoading(true)
      setErro(null)
      const [listaProcessos, listaCartas] = await Promise.all([
        processosApi.listar(),
        cartasApi.listar(),
      ])
      setProcessos(listaProcessos)
      setCartas(listaCartas)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao carregar processos e cartas.'
      setErro(msg)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    let montado = true
    async function inicializar() {
      try {
        const [listaProcessos, listaCartas] = await Promise.all([
          processosApi.listar(),
          cartasApi.listar(),
        ])
        if (!montado) return
        setProcessos(listaProcessos)
        setCartas(listaCartas)
      } catch (err: unknown) {
        if (!montado) return
        const msg = err instanceof Error ? err.message : 'Falha ao carregar processos e cartas.'
        setErro(msg)
      } finally {
        if (montado) setIsLoading(false)
      }
    }
    inicializar()
    return () => {
      montado = false
    }
  }, [])

  const handleCriarProcesso = async (e: React.FormEvent) => {
    e.preventDefault()
    setErroModalProcesso(null)

    if (!novoNome.trim() || !novoCodigoLinha.trim()) {
      setErroModalProcesso('Nome do processo e código da linha são obrigatórios.')
      return
    }

    try {
      setIsCriandoProcesso(true)
      const payload: ProcessoCreate = {
        nome: novoNome.trim(),
        codigo_linha: novoCodigoLinha.trim().toUpperCase(),
        descricao: novaDescricao.trim() || null,
      }
      await processosApi.criar(payload)
      setNovoNome('')
      setNovoCodigoLinha('')
      setNovaDescricao('')
      setModalNovoProcessoAberto(false)
      await carregarDados()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar processo industrial.'
      setErroModalProcesso(msg)
    } finally {
      setIsCriandoProcesso(false)
    }
  }

  const handleAbrirNoLive = (carta: CartaControleResponse) => {
    setCartaAtiva(carta)
    navigate('/live')
  }

  const handleAbrirWizard = (processoId?: string) => {
    setProcessoSelecionadoParaCarta(processoId)
    setWizardCartaAberto(true)
  }

  return (
    <div data-testid="processos-page" className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <Cpu className="w-6 h-6 text-blue-500" />
            Gestão de Processos e Cartas
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Configuração de linhas de produção, regras e limites estatísticos [RF01, RF02, RF05, RN01]
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setModalNovoProcessoAberto(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
          >
            <Factory className="w-4 h-4" />
            <span>Novo Processo</span>
          </button>

          <button
            type="button"
            onClick={() => handleAbrirWizard()}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer shadow-lg shadow-blue-600/20"
          >
            <Sparkles className="w-4 h-4" />
            <span>Nova Carta [RN01]</span>
          </button>
        </div>
      </div>

      {/* Alerta de Erro */}
      {erro && (
        <div className="p-3 rounded-xl bg-red-950/60 border border-red-800/60 text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{erro}</span>
        </div>
      )}

      {/* KPIs Gerais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <CardKpi
          titulo="Linhas & Processos"
          valor={processos.length}
          icone={<Factory className="w-4 h-4" />}
          subtitulo="Processos monitorados"
        />
        <CardKpi
          titulo="Total de Cartas"
          valor={cartas.length}
          icone={<Layers className="w-4 h-4" />}
          subtitulo="Cartas de controle ativas"
        />
        <CardKpi
          titulo="Modo Dinâmico (Fase I)"
          valor={cartas.filter((c) => c.modo_limites === 'DINAMICO').length}
          icone={<Activity className="w-4 h-4" />}
          subtitulo="Limites auto-ajustáveis"
        />
        <CardKpi
          titulo="Modo Fixo (Fase II)"
          valor={cartas.filter((c) => c.modo_limites === 'FIXO').length}
          icone={<Radio className="w-4 h-4" />}
          subtitulo="Limites homologados"
        />
      </div>

      {/* Lista de Processos e Suas Cartas */}
      {isLoading ? (
        <div className="p-12 border border-slate-800 rounded-2xl bg-slate-900/40 text-center text-slate-400 text-xs">
          Carregando catálogo de processos industriais...
        </div>
      ) : processos.length === 0 ? (
        <div className="p-12 border border-slate-800 rounded-2xl bg-slate-900/40 text-center space-y-3">
          <Factory className="w-10 h-10 text-slate-500 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-200">
            Nenhum processo industrial cadastrado
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Cadastre o primeiro processo ou linha de montagem para criar cartas de controle estatístico.
          </p>
          <button
            type="button"
            onClick={() => setModalNovoProcessoAberto(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 text-white cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Cadastrar Primeiro Processo</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {processos.map((proc) => {
            const cartasDoProcesso = cartas.filter((c) => c.processo_id === proc.id)

            return (
              <div
                key={proc.id}
                data-testid={`card-processo-${proc.id}`}
                className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-xs space-y-4"
              >
                {/* Linha de Identificação do Processo */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-blue-600/15 border border-blue-500/30 text-blue-400 font-mono font-bold text-xs">
                      {proc.codigo_linha}
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-slate-100">{proc.nome}</h2>
                      <p className="text-2xs text-slate-400">
                        {proc.descricao || 'Sem descrição cadastrada'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAbrirWizard(proc.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer self-start sm:self-auto"
                  >
                    <Plus className="w-3.5 h-3.5 text-blue-400" />
                    <span>Adicionar Carta</span>
                  </button>
                </div>

                {/* Cartas do Processo */}
                <div className="space-y-2">
                  <h3 className="text-3xs uppercase font-mono tracking-wider text-slate-400 font-bold">
                    Cartas de Controle Associadas ({cartasDoProcesso.length})
                  </h3>

                  {cartasDoProcesso.length === 0 ? (
                    <p className="text-xs text-slate-500 italic py-2">
                      Nenhuma carta configurada para esta linha. Clique em "Adicionar Carta" para iniciar.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {cartasDoProcesso.map((carta) => (
                        <div
                          key={carta.id}
                          className="bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-xl p-3 space-y-2 transition-colors flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold font-mono text-blue-400">
                                {formatarNomeCarta(carta)}
                              </span>
                              <Badge
                                variant={
                                  carta.modo_limites === 'DINAMICO' ? 'alerta' : 'neutro'
                                }
                                className="text-3xs"
                              >
                                {carta.modo_limites}
                              </Badge>
                            </div>

                            <div className="mt-2 space-y-1 text-2xs text-slate-400 font-mono">
                              <div>Tamanho subgrupo (n): {carta.tamanho_subgrupo}</div>
                              <div>Total subgrupos: {carta.total_subgrupos}</div>
                              {carta.especificacoes ? (
                                <div className="text-slate-300">
                                  LIE: {carta.especificacoes.lie ?? '--'} | LSE:{' '}
                                  {carta.especificacoes.lse ?? '--'}
                                </div>
                              ) : (
                                <div className="text-slate-500 italic">Sem limites de especificação</div>
                              )}
                            </div>
                          </div>

                          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-end">
                            <button
                              type="button"
                              onClick={() => handleAbrirNoLive(carta)}
                              className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
                            >
                              <span>Monitorar no Live</span>
                              <Activity className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal de Criação de Processo */}
      {modalNovoProcessoAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 text-slate-100">
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Factory className="w-5 h-5 text-blue-400" />
              Novo Processo Industrial
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Cadastre uma nova linha ou posto operacional de fabricação
            </p>

            {erroModalProcesso && (
              <div className="mt-4 p-3 rounded-xl bg-red-950/60 border border-red-800/60 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{erroModalProcesso}</span>
              </div>
            )}

            <form onSubmit={handleCriarProcesso} className="mt-4 space-y-4">
              <div>
                <label htmlFor="codigo-linha-input" className="block text-xs font-semibold text-slate-300 mb-1">
                  Código da Linha *
                </label>
                <input
                  id="codigo-linha-input"
                  type="text"
                  placeholder="Ex: LINHA-04"
                  value={novoCodigoLinha}
                  onChange={(e) => setNovoCodigoLinha(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-700 text-slate-200 font-mono focus:outline-hidden focus:border-blue-500 uppercase"
                />
              </div>

              <div>
                <label htmlFor="nome-processo-input" className="block text-xs font-semibold text-slate-300 mb-1">
                  Nome do Processo *
                </label>
                <input
                  id="nome-processo-input"
                  type="text"
                  placeholder="Ex: Soldagem Robotizada TIG"
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-700 text-slate-200 focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label htmlFor="descricao-processo-input" className="block text-xs font-semibold text-slate-300 mb-1">
                  Descrição (Opcional)
                </label>
                <textarea
                  id="descricao-processo-input"
                  rows={3}
                  placeholder="Detalhes operacionais da linha..."
                  value={novaDescricao}
                  onChange={(e) => setNovaDescricao(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-700 text-slate-200 focus:outline-hidden focus:border-blue-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalNovoProcessoAberto(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isCriandoProcesso}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 text-white cursor-pointer disabled:opacity-50"
                >
                  {isCriandoProcesso ? 'Criando...' : 'Salvar Processo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Wizard de Nova Carta de Controle */}
      <WizardNovaCarta
        isOpen={wizardCartaAberto}
        processos={processos}
        processoPreSelecionadoId={processoSelecionadoParaCarta}
        onClose={() => setWizardCartaAberto(false)}
        onSuccess={async () => {
          await carregarDados()
        }}
      />
    </div>
  )
}
