import React, { useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  Keyboard,
  Send,
  Sparkles,
  Upload,
  UploadCloud,
} from 'lucide-react'
import { Badge } from '@/components/common/Badge'
import { cartasApi, ingestaoApi } from '@/services/api'
import { useCEPStore } from '@/stores/cepStore'
import type { CartaControleResponse, SubgrupoResponse } from '@/types/api'
import { formatarNomeCarta } from '@/utils/formatters'

export function IngestaoPage() {
  const { cartaDetalhes, cartaAtivaId, setCartaAtiva, adicionarSubgrupo } = useCEPStore()
  const [cartas, setCartas] = useState<CartaControleResponse[]>([])
  const [cartaSelecionada, setCartaSelecionada] = useState<CartaControleResponse | null>(
    () => useCEPStore.getState().cartaDetalhes
  )
  const prevCartaIdRef = useRef<string | null>(useCEPStore.getState().cartaDetalhes?.id || null)
  const [abaAtiva, setAbaAtiva] = useState<'manual' | 'lote'>('manual')

  // --- Estado da Ingestão Manual ---
  const n = cartaSelecionada?.tamanho_subgrupo || 5
  const [valoresManuais, setValoresManuais] = useState<string[]>(() => Array(n).fill(''))
  const [isSubmittingManual, setIsSubmittingManual] = useState(false)
  const [ultimoResultadoManual, setUltimoResultadoManual] = useState<SubgrupoResponse | null>(null)
  const [erroManual, setErroManual] = useState<string | null>(null)
  const inputsRef = useRef<(HTMLInputElement | null)[]>([])

  // --- Estado da Importação em Lote ---
  const [arquivoSelecionado, setArquivoSelecionado] = useState<File | null>(null)
  const [loteParseado, setLoteParseado] = useState<number[][] | null>(null)
  const [erroLote, setErroLote] = useState<string | null>(null)
  const [isSubmittingLote, setIsSubmittingLote] = useState(false)
  const [resultadoLote, setResultadoLote] = useState<{
    total: number
    anomalias: number
  } | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Carregar cartas disponíveis
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
          else if (lista.length > 0) setCartaSelecionada((prev) => prev || lista[0])
        } else if (lista.length > 0) {
          setCartaSelecionada((prev) => prev || lista[0])
          setCartaAtiva(lista[0])
        }
      } catch {
        // Fallback silencioso ou manter cartaDetalhes do store
        if (cartaDetalhes) setCartaSelecionada((prev) => prev || cartaDetalhes)
      }
    }
    carregarCartas()
    return () => {
      montado = false
    }
  }, [cartaAtivaId, cartaDetalhes, setCartaAtiva])

  // Ajustar tamanho dos inputs quando a carta mudar
  useEffect(() => {
    if (cartaSelecionada && cartaSelecionada.id !== prevCartaIdRef.current) {
      prevCartaIdRef.current = cartaSelecionada.id
      const novoN = cartaSelecionada.tamanho_subgrupo || 5
      setValoresManuais(Array(novoN).fill(''))
      inputsRef.current = inputsRef.current.slice(0, novoN)
      setUltimoResultadoManual(null)
      setErroManual(null)
      setLoteParseado(null)
      setArquivoSelecionado(null)
      setResultadoLote(null)
    }
  }, [cartaSelecionada])

  // Mudar carta selecionada
  const handleTrocarCarta = (cartaId: string) => {
    const carta = cartas.find((c) => c.id === cartaId) || null
    setCartaSelecionada(carta)
    if (carta) setCartaAtiva(carta)
  }

  // --- Manipulação Manual: Navegação por Teclado [RF06] ---
  const handleInputChange = (index: number, valor: string) => {
    const novos = [...valoresManuais]
    novos[index] = valor
    setValoresManuais(novos)
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Ctrl + Enter ou Meta + Enter: Submeter imediatamente
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSubmeterManual()
      return
    }

    // Enter simples: avança para o próximo input
    if (e.key === 'Enter') {
      e.preventDefault()
      if (index < n - 1) {
        inputsRef.current[index + 1]?.focus()
        inputsRef.current[index + 1]?.select()
      } else {
        handleSubmeterManual()
      }
    }
  }

  const handleSubmeterManual = async () => {
    if (!cartaSelecionada) {
      setErroManual('Selecione uma carta de controle antes de prosseguir.')
      return
    }

    // Validar se todos os valores foram preenchidos
    const numeros: number[] = []
    for (let i = 0; i < n; i++) {
      const v = valoresManuais[i]?.trim().replace(',', '.')
      const num = parseFloat(v)
      if (isNaN(num)) {
        setErroManual(`Amostra #${i + 1} contém um valor numérico inválido ou em branco.`)
        inputsRef.current[i]?.focus()
        return
      }
      numeros.push(num)
    }

    setErroManual(null)
    try {
      setIsSubmittingManual(true)
      const subgrupo = await ingestaoApi.ingerirAmostra(cartaSelecionada.id, {
        valores: numeros,
      })

      setUltimoResultadoManual(subgrupo)
      adicionarSubgrupo(subgrupo)

      // Limpar campos e focar no primeiro input para a próxima leitura sem retirar as mãos do teclado
      setValoresManuais(Array(n).fill(''))
      setTimeout(() => {
        inputsRef.current[0]?.focus()
      }, 50)
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Erro ao registrar subgrupo na API de Ingestão.'
      setErroManual(msg)
    } finally {
      setIsSubmittingManual(false)
    }
  }

  // --- Manipulação Lote: Parse e Envio [RF08] ---
  const processarArquivoTexto = (conteudo: string, nomeArquivo: string) => {
    setErroLote(null)
    setResultadoLote(null)

    try {
      if (nomeArquivo.endsWith('.json')) {
        const json = JSON.parse(conteudo)
        const amostrasArray = Array.isArray(json)
          ? json
          : json.amostras || json.subgrupos || json.dados
        if (!Array.isArray(amostrasArray)) {
          throw new Error('Formato JSON inválido. Esperado array de amostras [[...], [...]]')
        }

        const linhasValidadas: number[][] = []
        for (let i = 0; i < amostrasArray.length; i++) {
          const linha = amostrasArray[i]
          if (!Array.isArray(linha) || linha.length !== n) {
            throw new Error(
              `Linha ${i + 1} tem ${linha?.length || 0} itens. Esperado subgrupo com n=${n}.`
            )
          }
          linhasValidadas.push(linha.map((val) => Number(val)))
        }
        setLoteParseado(linhasValidadas)
      } else {
        // CSV / TXT
        const linhas = conteudo
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter((l) => l.length > 0)

        const linhasValidadas: number[][] = []
        for (let i = 0; i < linhas.length; i++) {
          // Separar por vírgula, ponto-e-vírgula ou tabulação/espaços múltiplos
          const tokens = linhas[i]
            .split(/[,;\t]+/)
            .map((t) => t.trim().replace(',', '.'))
            .filter((t) => t.length > 0)

          // Se for cabeçalho com texto, pular primeira linha
          if (i === 0 && tokens.some((t) => isNaN(parseFloat(t)))) {
            continue
          }

          if (tokens.length !== n) {
            throw new Error(
              `Linha ${i + 1} do CSV possui ${tokens.length} colunas. O subgrupo atual requer n=${n}.`
            )
          }

          const numeros = tokens.map((t) => {
            const val = parseFloat(t)
            if (isNaN(val)) throw new Error(`Linha ${i + 1}: valor não numérico "${t}"`)
            return val
          })
          linhasValidadas.push(numeros)
        }

        if (linhasValidadas.length === 0) {
          throw new Error('Nenhum dado válido encontrado no arquivo.')
        }

        setLoteParseado(linhasValidadas)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao processar arquivo'
      setErroLote(msg)
      setLoteParseado(null)
    }
  }

  const handleArquivoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setArquivoSelecionado(file)
    const reader = new FileReader()
    reader.onload = (event) => {
      const conteudo = event.target?.result as string
      processarArquivoTexto(conteudo, file.name)
    }
    reader.readAsText(file)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    setArquivoSelecionado(file)
    const reader = new FileReader()
    reader.onload = (event) => {
      const conteudo = event.target?.result as string
      processarArquivoTexto(conteudo, file.name)
    }
    reader.readAsText(file)
  }

  const handleSubmeterLote = async () => {
    if (!cartaSelecionada || !loteParseado || loteParseado.length === 0) return

    try {
      setIsSubmittingLote(true)
      setErroLote(null)
      const res = await ingestaoApi.importarLote(cartaSelecionada.id, {
        amostras: loteParseado,
      })

      const anomalias = res.subgrupos.filter((sg) => sg.fora_de_controle).length
      setResultadoLote({
        total: res.total_importados,
        anomalias,
      })

      // Atualizar o buffer da store
      res.subgrupos.forEach((sg) => adicionarSubgrupo(sg))

      // Limpar seleção
      setLoteParseado(null)
      setArquivoSelecionado(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao enviar lote de amostras.'
      setErroLote(msg)
    } finally {
      setIsSubmittingLote(false)
    }
  }

  return (
    <div data-testid="ingestao-page" className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <UploadCloud className="w-6 h-6 text-blue-500" />
            Ingestão de Dados e Telemetria
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Entrada manual em tempo real e importação em lote de subgrupos amostrais [RF06, RF08]
          </p>
        </div>

        {/* Seletor de Carta */}
        <div className="flex items-center gap-2">
          <label htmlFor="select-carta-ingestao" className="text-xs font-semibold text-slate-400 whitespace-nowrap">
            Carta Ativa:
          </label>
          <select
            id="select-carta-ingestao"
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

      {/* Navegação de Abas */}
      <div className="flex border-b border-slate-800 gap-2">
        <button
          type="button"
          onClick={() => setAbaAtiva('manual')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
            abaAtiva === 'manual'
              ? 'border-blue-500 text-blue-400 bg-slate-900/40'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Keyboard className="w-4 h-4" />
          <span>Entrada Manual do Operador [RF06]</span>
        </button>

        <button
          type="button"
          onClick={() => setAbaAtiva('lote')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
            abaAtiva === 'lote'
              ? 'border-blue-500 text-blue-400 bg-slate-900/40'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Importação em Lote CSV/JSON [RF08]</span>
        </button>
      </div>

      {/* ABA 1: ENTRADA MANUAL */}
      {abaAtiva === 'manual' && (
        <div className="space-y-6">
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <span>Registro de Subgrupo Amostral</span>
                  <Badge variant="neutro" className="text-3xs font-mono">
                    n = {n} amostras
                  </Badge>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Navegue entre campos com <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-300 font-mono text-3xs">Enter</kbd> ou submeta diretamente com <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-300 font-mono text-3xs">Ctrl + Enter</kbd>.
                </p>
              </div>

              <div className="text-xs font-mono text-slate-400 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
                Tipo: <span className="text-blue-400 font-bold">{cartaSelecionada?.tipo_carta || 'N/A'}</span> | Modo: {cartaSelecionada?.modo_limites || 'DINAMICO'}
              </div>
            </div>

            {erroManual && (
              <div className="mt-4 p-3 rounded-xl bg-red-950/60 border border-red-800/60 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{erroManual}</span>
              </div>
            )}

            {/* Inputs de Amostras */}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSubmeterManual()
              }}
              className="mt-6 space-y-6"
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {Array.from({ length: n }).map((_, i) => (
                  <div key={i} className="space-y-1">
                    <label
                      htmlFor={`amostra-input-${i}`}
                      className="block text-3xs font-mono uppercase text-slate-400 font-bold"
                    >
                      Amostra #{i + 1}
                    </label>
                    <input
                      id={`amostra-input-${i}`}
                      ref={(el) => {
                        inputsRef.current[i] = el
                      }}
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={valoresManuais[i] || ''}
                      onChange={(e) => handleInputChange(i, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(i, e)}
                      className="w-full px-3 py-2 text-sm font-mono text-slate-100 bg-slate-950 border border-slate-700 rounded-xl focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-center"
                    />
                  </div>
                ))}
              </div>

              {/* Botão de Envio */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setValoresManuais(Array(n).fill(''))}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                >
                  Limpar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingManual || !cartaSelecionada}
                  className="flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer disabled:opacity-50 shadow-lg shadow-blue-600/20"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmittingManual ? 'Enviando...' : 'Gravar Subgrupo (Ctrl+Enter)'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Feedback Visual do Último Subgrupo Ingerido */}
          {ultimoResultadoManual && (
            <div
              data-testid="feedback-subgrupo-manual"
              className={`p-4 rounded-2xl border transition-all ${
                ultimoResultadoManual.fora_de_controle
                  ? 'bg-red-950/40 border-red-800/80 text-red-200'
                  : 'bg-emerald-950/40 border-emerald-800/80 text-emerald-200'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  {ultimoResultadoManual.fora_de_controle ? (
                    <AlertCircle className="w-6 h-6 text-red-400 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                  )}
                  <div>
                    <h3 className="text-sm font-bold">
                      Subgrupo #{ultimoResultadoManual.numero_subgrupo} processado com sucesso
                    </h3>
                    <p className="text-xs opacity-80 mt-0.5">
                      Média (X̄): {ultimoResultadoManual.estatisticas.media_x.toFixed(3)} |{' '}
                      {n > 10 ? 'Desvio (s)' : 'Amplitude (R)'}:{' '}
                      {(n > 10
                        ? ultimoResultadoManual.estatisticas.desvio_s
                        : ultimoResultadoManual.estatisticas.amplitude_r
                      ).toFixed(3)}
                    </p>
                  </div>
                </div>

                <Badge
                  variant={
                    ultimoResultadoManual.fora_de_controle
                      ? 'fora_de_controle'
                      : 'sob_controle'
                  }
                  className="text-xs py-1 px-2.5"
                >
                  {ultimoResultadoManual.fora_de_controle
                    ? 'FORA DE CONTROLE'
                    : 'SOB CONTROLE'}
                </Badge>
              </div>

              {ultimoResultadoManual.fora_de_controle &&
                ultimoResultadoManual.violacoes.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-red-800/40 flex flex-wrap gap-2 items-center">
                    <span className="text-2xs font-semibold text-red-300">Violações:</span>
                    {ultimoResultadoManual.violacoes.map((v) => (
                      <span
                        key={v.codigo_regra}
                        className="px-2 py-0.5 rounded bg-red-900/60 border border-red-700 text-3xs font-mono font-bold text-red-200"
                        title={v.descricao}
                      >
                        {v.codigo_regra}: {v.descricao}
                      </span>
                    ))}
                  </div>
                )}
            </div>
          )}
        </div>
      )}

      {/* ABA 2: IMPORTAÇÃO EM LOTE */}
      {abaAtiva === 'lote' && (
        <div className="space-y-6">
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-xs">
            <div className="pb-4 border-b border-slate-800">
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-blue-400" />
                <span>Upload de Arquivo (CSV ou JSON)</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Importe históricos industriais em massa. Cada linha deve conter exatamente {n}{' '}
                valores numéricos.
              </p>
            </div>

            {/* Zona de Drop */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="mt-6 border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-2xl p-8 text-center cursor-pointer bg-slate-950/40 hover:bg-slate-950/80 transition-all"
            >
              <Upload className="w-10 h-10 mx-auto text-slate-500 mb-2" />
              <p className="text-xs font-semibold text-slate-200">
                {arquivoSelecionado
                  ? `Arquivo carregado: ${arquivoSelecionado.name}`
                  : 'Arraste e solte o arquivo aqui, ou clique para selecionar'}
              </p>
              <p className="text-3xs text-slate-500 mt-1">Suporta .csv, .txt ou .json</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt,.json"
                onChange={handleArquivoChange}
                className="hidden"
              />
            </div>

            {erroLote && (
              <div className="mt-4 p-3 rounded-xl bg-red-950/60 border border-red-800/60 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{erroLote}</span>
              </div>
            )}

            {/* Pré-visualização dos Dados Parseados */}
            {loteParseado && (
              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300">
                    Pré-visualização ({loteParseado.length} subgrupos identificados)
                  </span>
                  <span className="text-3xs font-mono text-slate-500">
                    Mostrando até os 5 primeiros
                  </span>
                </div>

                <div className="overflow-x-auto bg-slate-950 rounded-xl border border-slate-800 p-2">
                  <table className="w-full text-xs font-mono text-slate-300">
                    <thead>
                      <tr className="border-b border-slate-800 text-3xs text-slate-500 uppercase text-left">
                        <th className="p-2">Linha</th>
                        {Array.from({ length: n }).map((_, idx) => (
                          <th key={idx} className="p-2">
                            X{idx + 1}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {loteParseado.slice(0, 5).map((linha, lIdx) => (
                        <tr key={lIdx} className="border-b border-slate-900">
                          <td className="p-2 text-slate-500">#{lIdx + 1}</td>
                          {linha.map((val, vIdx) => (
                            <td key={vIdx} className="p-2 text-blue-400">
                              {val.toFixed(2)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Botão de Enviar Lote */}
                <div className="flex justify-end pt-3">
                  <button
                    type="button"
                    onClick={handleSubmeterLote}
                    disabled={isSubmittingLote}
                    className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer disabled:opacity-50 shadow-lg shadow-blue-600/20"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>
                      {isSubmittingLote
                        ? 'Processando Lote...'
                        : `Importar ${loteParseado.length} Subgrupos`}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* Resumo da Importação */}
            {resultadoLote && (
              <div className="mt-6 p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-100">
                      Lote importado com sucesso!
                    </h4>
                    <p className="text-2xs text-slate-400">
                      {resultadoLote.total} subgrupos ingeridos na base analítica.
                    </p>
                  </div>
                </div>

                {resultadoLote.anomalias > 0 ? (
                  <Badge variant="fora_de_controle" className="text-xs">
                    {resultadoLote.anomalias} anomalias detectadas
                  </Badge>
                ) : (
                  <Badge variant="sob_controle" className="text-xs">
                    Processo sob controle
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
