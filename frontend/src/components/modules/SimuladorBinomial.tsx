import { useId, useMemo, useState } from 'react'
import {
  Activity,
  BarChart3,
  Check,
  Dices,
  Layers,
  Plus,
  Sliders,
  Target,
} from 'lucide-react'
import type {
  CartaControleResponse,
  CriterioConformidade,
  EscopoAmostral,
  TipoArranjo,
} from '@/types/api'
import {
  calcularSimulacaoBinomialLocal,
} from '@/utils/probabilidadeBinomial'
import type { SimulacaoBinomialReport } from '@/utils/pdfReportGenerator'

export interface SimuladorBinomialProps {
  carta: CartaControleResponse | null
  unidade?: string
  simulacaoAnexada?: SimulacaoBinomialReport | null
  onAnexarAoRelatorio?: (simulacao: SimulacaoBinomialReport | null) => void
  className?: string
}

export function SimuladorBinomial({
  carta,
  unidade = 'mm',
  simulacaoAnexada,
  onAnexarAoRelatorio,
  className = '',
}: SimuladorBinomialProps) {
  // IDs acessíveis para os controles de formulário
  const baseId = useId()
  const idCriterio = `${baseId}-criterio`
  const idDistanciaZ = `${baseId}-distancia-z`
  const idTamanhoX = `${baseId}-tamanho-x`
  const idOperadorLote = `${baseId}-operador-lote`
  const idSucessosY = `${baseId}-sucessos-y`

  // 1. Estado da Simulação
  const [modoPergunta, setModoPergunta] = useState<'CONSECUTIVO' | 'LOTE'>('CONSECUTIVO')
  const [operadorLote, setOperadorLote] = useState<'EXATAMENTE' | 'PELO_MENOS' | 'NO_MAXIMO'>('PELO_MENOS')
  const [criterio, setCriterio] = useState<CriterioConformidade>('Z_SIGMAS')
  const [escopo, setEscopo] = useState<EscopoAmostral>('INDIVIDUAL')
  const [zValor, setZValor] = useState<number>(2.50)
  const [tamanhoLoteX, setTamanhoLoteX] = useState<number>(5)
  const [sucessosDesejadosY, setSucessosDesejadosY] = useState<number>(5)
  const [hoveredK, setHoveredK] = useState<number | null>(null)

  // Tipo de arranjo efetivo
  const tipoArranjo: TipoArranjo = modoPergunta === 'CONSECUTIVO' ? 'CONSECUTIVO' : operadorLote

  // Valores de referência do processo a partir da carta
  const mediaProcesso = carta?.limites_atuais?.lc ?? 25.0
  const sigmaEstimado = carta?.limites_atuais?.sigma_estimado ?? 0.5
  const tamanhoSubgrupo = carta?.tamanho_subgrupo ?? 5
  const lic = carta?.limites_atuais?.lic
  const lsc = carta?.limites_atuais?.lsc
  const lie = carta?.especificacoes?.lie
  const lse = carta?.especificacoes?.lse

  // 2. Cálculo Reativo da Simulação
  const resultado = useMemo(() => {
    return calcularSimulacaoBinomialLocal(
      {
        tipoArranjo,
        criterio,
        escopo,
        mediaProcesso,
        sigmaEstimado,
        tamanhoSubgrupo,
        tamanhoLoteX,
        sucessosDesejadosY: modoPergunta === 'CONSECUTIVO' ? tamanhoLoteX : sucessosDesejadosY,
        zValor,
        lic,
        lsc,
        lie,
        lse,
      },
      carta?.id || 'simulacao'
    )
  }, [
    tipoArranjo,
    criterio,
    escopo,
    mediaProcesso,
    sigmaEstimado,
    tamanhoSubgrupo,
    tamanhoLoteX,
    modoPergunta,
    sucessosDesejadosY,
    zValor,
    lic,
    lsc,
    lie,
    lse,
    carta?.id,
  ])

  // Verifica se a simulação atual coincide com a anexada
  const isAnexada = useMemo(() => {
    if (!simulacaoAnexada) return false
    return (
      simulacaoAnexada.tipoArranjo === tipoArranjo &&
      simulacaoAnexada.criterio === criterio &&
      simulacaoAnexada.escopo === escopo &&
      simulacaoAnexada.tamanhoLoteX === tamanhoLoteX &&
      simulacaoAnexada.sucessosDesejadosY === resultado.sucessos_desejados_y &&
      Math.abs(simulacaoAnexada.probabilidadeFinal - resultado.probabilidade_final) < 1e-4
    )
  }, [simulacaoAnexada, tipoArranjo, criterio, escopo, tamanhoLoteX, resultado])

  // Ação de Anexar / Desanexar
  const handleToggleAnexo = () => {
    if (!onAnexarAoRelatorio) return
    if (isAnexada) {
      onAnexarAoRelatorio(null)
    } else {
      const report: SimulacaoBinomialReport = {
        tipoArranjo,
        criterio,
        escopo,
        zValor: criterio === 'Z_SIGMAS' ? zValor : null,
        faixaInferior: resultado.faixa_inferior,
        faixaSuperior: resultado.faixa_superior,
        probabilidadeUnitariaP: resultado.probabilidade_unitaria_p,
        probabilidadeFalhaQ: resultado.probabilidade_falha_q,
        tamanhoLoteX: resultado.tamanho_lote_x,
        sucessosDesejadosY: resultado.sucessos_desejados_y,
        combinacoes: resultado.combinacoes,
        probabilidadeFinal: resultado.probabilidade_final,
      }
      onAnexarAoRelatorio(report)
    }
  }

  // Valor máximo da PMF para normalizar a altura das barras
  const maxProb = useMemo(() => {
    return Math.max(0.01, ...resultado.distribuicao_completa.map((p) => p.probabilidade))
  }, [resultado.distribuicao_completa])

  return (
    <div
      data-testid="simulador-binomial-container"
      className={`bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col gap-5 ${className}`}
    >
      {/* Cabeçalho do Módulo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
            <Dices className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-2">
              <span>Simulador de Arranjos Probabilísticos (Binomial)</span>
            </h2>
            <p className="text-2xs sm:text-xs text-slate-400 mt-0.5">
              Predição matemática da probabilidade de conformidade de produtos ou subgrupos sob distribuição Normal & Binomial.
            </p>
          </div>
        </div>

        {/* Botão de Anexo ao Relatório */}
        {onAnexarAoRelatorio && (
          <button
            type="button"
            onClick={handleToggleAnexo}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              isAnexada
                ? 'bg-emerald-950/70 border border-emerald-600/80 text-emerald-300 hover:bg-emerald-900/80 shadow-xs'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-900/30'
            }`}
          >
            {isAnexada ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>✓ Anexado ao Relatório</span>
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" />
                <span>+ Adicionar ao Relatório</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Grid de Configuração dos Parâmetros */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. Modo de Pergunta */}
        <div className="p-3.5 bg-slate-950/60 border border-slate-800/80 rounded-xl flex flex-col gap-2.5">
          <span className="text-2xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5 text-blue-400" />
            1. Tipo de Pergunta (Modo)
          </span>

          <div className="flex flex-col gap-2">
            <label className="flex items-start gap-2 text-xs text-slate-200 cursor-pointer">
              <input
                type="radio"
                name="modo-pergunta"
                checked={modoPergunta === 'CONSECUTIVO'}
                onChange={() => setModoPergunta('CONSECUTIVO')}
                className="mt-0.5 text-blue-500 focus:ring-0"
              />
              <div>
                <span className="font-medium">Sequência Consecutiva</span>
                <p className="text-3xs text-slate-400">X produtos seguidos sem falha (p^X)</p>
              </div>
            </label>

            <label className="flex items-start gap-2 text-xs text-slate-200 cursor-pointer">
              <input
                type="radio"
                name="modo-pergunta"
                checked={modoPergunta === 'LOTE'}
                onChange={() => setModoPergunta('LOTE')}
                className="mt-0.5 text-blue-500 focus:ring-0"
              />
              <div>
                <span className="font-medium">Arranjo em Lote</span>
                <p className="text-3xs text-slate-400">Y conformes dentro de um lote amostral X</p>
              </div>
            </label>
          </div>
        </div>

        {/* 2. Critério de Conformidade e Escopo */}
        <div className="p-3.5 bg-slate-950/60 border border-slate-800/80 rounded-xl flex flex-col gap-2.5">
          <span className="text-2xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-emerald-400" />
            2. Critério de Conformidade
          </span>

          <div className="flex flex-col gap-2">
            <div>
              <label htmlFor={idCriterio} className="text-3xs text-slate-400 block mb-1">
                Tolerância Base:
              </label>
              <select
                id={idCriterio}
                value={criterio}
                onChange={(e) => setCriterio(e.target.value as CriterioConformidade)}
                className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-medium text-slate-200 focus:outline-hidden focus:border-blue-500 cursor-pointer"
              >
                <option value="Z_SIGMAS">Dentro de ±Z Sigmas (LC ± Zσ)</option>
                <option value="LIMITES_CONTROLE">Limites de Controle (LIC / LSC)</option>
                <option value="LIMITES_ESPECIFICACAO">Limites de Engenharia (LIE / LSE)</option>
              </select>
            </div>

            {criterio === 'Z_SIGMAS' && (
              <div>
                <label htmlFor={idDistanciaZ} className="text-3xs text-slate-400 block mb-1">
                  Distância Z (sigmas):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id={idDistanciaZ}
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="6.0"
                    value={zValor}
                    onChange={(e) => setZValor(Math.max(0.1, parseFloat(e.target.value) || 2.5))}
                    className="w-20 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-slate-200"
                  />
                  <div className="flex items-center gap-1">
                    {[2.0, 2.5, 3.0].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setZValor(val)}
                        className={`px-1.5 py-0.5 text-3xs font-mono rounded-md border transition-colors cursor-pointer ${
                          zValor === val
                            ? 'bg-blue-900/60 border-blue-600 text-blue-200'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {val.toFixed(1)}σ
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div>
              <span className="text-3xs text-slate-400 block mb-1">Escopo Amostral:</span>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs text-slate-200 cursor-pointer">
                  <input
                    type="radio"
                    name="escopo-amostral"
                    checked={escopo === 'INDIVIDUAL'}
                    onChange={() => setEscopo('INDIVIDUAL')}
                    className="text-blue-500 focus:ring-0"
                  />
                  <span>Produto (X)</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs text-slate-200 cursor-pointer">
                  <input
                    type="radio"
                    name="escopo-amostral"
                    checked={escopo === 'MEDIA_SUBGRUPO'}
                    onChange={() => setEscopo('MEDIA_SUBGRUPO')}
                    className="text-blue-500 focus:ring-0"
                  />
                  <span>Média (X̄)</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Parâmetros do Lote / Sequência */}
        <div className="p-3.5 bg-slate-950/60 border border-slate-800/80 rounded-xl flex flex-col gap-2.5">
          <span className="text-2xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-purple-400" />
            3. Parâmetros do Arranjo
          </span>

          <div className="flex flex-col gap-2.5">
            <div>
              <label htmlFor={idTamanhoX} className="text-3xs text-slate-400 block mb-1">
                Tamanho da Sequência / Lote (X):
              </label>
              <input
                id={idTamanhoX}
                type="number"
                min="1"
                max="100"
                value={tamanhoLoteX}
                onChange={(e) => {
                  const val = Math.max(1, Math.min(100, parseInt(e.target.value, 10) || 1))
                  setTamanhoLoteX(val)
                  if (sucessosDesejadosY > val) setSucessosDesejadosY(val)
                }}
                className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-slate-200"
              />
            </div>

            {modoPergunta === 'LOTE' ? (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor={idOperadorLote} className="text-3xs text-slate-400 block mb-1">
                    Operador:
                  </label>
                  <select
                    id={idOperadorLote}
                    value={operadorLote}
                    onChange={(e) => setOperadorLote(e.target.value as any)}
                    className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-medium text-slate-200"
                  >
                    <option value="PELO_MENOS">Pelo menos (≥)</option>
                    <option value="EXATAMENTE">Exatamente (=)</option>
                    <option value="NO_MAXIMO">No máximo (≤)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor={idSucessosY} className="text-3xs text-slate-400 block mb-1">
                    Sucessos (Y):
                  </label>
                  <input
                    id={idSucessosY}
                    type="number"
                    min="0"
                    max={tamanhoLoteX}
                    value={sucessosDesejadosY}
                    onChange={(e) => {
                      const val = Math.max(0, Math.min(tamanhoLoteX, parseInt(e.target.value, 10) || 0))
                      setSucessosDesejadosY(val)
                    }}
                    className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-slate-200"
                  />
                </div>
              </div>
            ) : (
              <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800 text-3xs text-slate-400 flex items-center justify-between">
                <span>Sucessos Requeridos (Y):</span>
                <span className="font-mono font-bold text-slate-200">{tamanhoLoteX} (100% conformes)</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Painel Inferior Dividido: Resultados Numéricos vs Gráfico de Distribuição */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-1">
        {/* Coluna 1: Resultados Numéricos em Fonte Mono */}
        <div className="lg:col-span-5 p-4 bg-slate-950/80 border border-slate-800 rounded-xl flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-2xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-blue-400" />
              Resultado do Cálculo
            </span>
            <span className="text-3xs text-slate-500 font-mono">Normal & Binomial</span>
          </div>

          <div className="space-y-2 font-mono text-xs">
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/50 border border-slate-800/80">
              <span className="text-slate-400">Prob. Unitária (p):</span>
              <span className="font-bold text-emerald-400">
                {(resultado.probabilidade_unitaria_p * 100).toFixed(4)}%
              </span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/50 border border-slate-800/80">
              <span className="text-slate-400">
                Arranjos C({resultado.tamanho_lote_x}, {resultado.sucessos_desejados_y}):
              </span>
              <span className="font-bold text-slate-200">
                {resultado.combinacoes} {resultado.combinacoes === 1 ? 'combinação' : 'combinações'}
              </span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-blue-950/40 border border-blue-800/50">
              <span className="text-blue-300 font-medium">
                Prob. Final P({tipoArranjo === 'CONSECUTIVO' ? `X=${resultado.tamanho_lote_x}` : tipoArranjo === 'PELO_MENOS' ? `K≥${resultado.sucessos_desejados_y}` : tipoArranjo === 'NO_MAXIMO' ? `K≤${resultado.sucessos_desejados_y}` : `K=${resultado.sucessos_desejados_y}`}):
              </span>
              <span className="font-extrabold text-blue-300 text-sm">
                {(resultado.probabilidade_final * 100).toFixed(4)}%
              </span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/50 border border-slate-800/80">
              <span className="text-slate-400">Faixa Avaliada:</span>
              <span className="text-slate-200 text-2xs truncate">
                {resultado.faixa_inferior !== null && resultado.faixa_superior !== null
                  ? `[${resultado.faixa_inferior.toFixed(3)} a ${resultado.faixa_superior.toFixed(3)}] ${unidade}`
                  : resultado.faixa_superior !== null
                    ? `[<= ${resultado.faixa_superior.toFixed(3)}] ${unidade}`
                    : resultado.faixa_inferior !== null
                      ? `[>= ${resultado.faixa_inferior.toFixed(3)}] ${unidade}`
                      : 'N/D'}
              </span>
            </div>
          </div>

          <div className="text-3xs text-slate-500 leading-tight">
            * Processo com média μ = {mediaProcesso.toFixed(3)} e σ = {resultado.sigma_usado.toFixed(4)} ({escopo === 'MEDIA_SUBGRUPO' ? 'erro padrão da média' : 'desvio padrão individual'}).
          </div>
        </div>

        {/* Coluna 2: Gráfico de Distribuição Binomial Interativo */}
        <div className="lg:col-span-7 p-4 bg-slate-950/80 border border-slate-800 rounded-xl flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-2xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5 text-purple-400" />
              Gráfico de Distribuição (PMF Binomial)
            </span>
            <span className="text-3xs text-slate-400 font-mono">
              {hoveredK !== null
                ? `k = ${hoveredK}: ${(resultado.distribuicao_completa[hoveredK]?.probabilidade * 100).toFixed(4)}%`
                : 'Passe o mouse sobre as barras'}
            </span>
          </div>

          {/* Área de Barras */}
          <div className="h-36 flex items-end justify-between gap-1 sm:gap-1.5 pt-4 pb-2 px-1 border-b border-slate-800/80">
            {resultado.distribuicao_completa.map((ponto) => {
              const alturaPct = Math.max(4, Math.round((ponto.probabilidade / maxProb) * 100))
              const isHovered = hoveredK === ponto.k

              return (
                <div
                  key={ponto.k}
                  className="flex-1 flex flex-col items-center justify-end h-full group relative cursor-pointer"
                  onMouseEnter={() => setHoveredK(ponto.k)}
                  onMouseLeave={() => setHoveredK(null)}
                >
                  {/* Tooltip flutuante */}
                  <div
                    className={`absolute -top-7 px-1.5 py-0.5 rounded-md bg-slate-900 border border-slate-700 text-3xs font-mono text-slate-200 pointer-events-none transition-opacity whitespace-nowrap z-10 ${
                      isHovered ? 'opacity-100' : 'opacity-0'
                    }`}
                  >
                    k={ponto.k}: {(ponto.probabilidade * 100).toFixed(2)}%
                  </div>

                  {/* Barra */}
                  <div
                    style={{ height: `${alturaPct}%` }}
                    className={`w-full max-w-[28px] rounded-t-sm transition-all duration-200 ${
                      ponto.destaque
                        ? 'bg-blue-500 hover:bg-blue-400 shadow-xs shadow-blue-500/40 ring-1 ring-blue-400'
                        : 'bg-slate-700 hover:bg-slate-600 opacity-60 hover:opacity-100'
                    }`}
                  />
                </div>
              )
            })}
          </div>

          {/* Eixo X com valores de k */}
          <div className="flex items-center justify-between px-1 text-3xs font-mono text-slate-400">
            <span>k = 0</span>
            <span className="text-slate-500">Número de Produtos Conformes (k)</span>
            <span>k = {resultado.tamanho_lote_x}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
