import { useMemo, useState } from 'react'
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  Search,
} from 'lucide-react'
import { Badge } from '@/components/common/Badge'
import type { CartaControleResponse, SubgrupoResponse } from '@/types/api'

export interface TabelaSubgruposProps {
  subgrupos: SubgrupoResponse[]
  cartaAtiva?: CartaControleResponse | null
  onApontarCausa?: (subgrupo: SubgrupoResponse) => void
  onExportarCSV?: () => void
  className?: string
}

export function TabelaSubgrupos({
  subgrupos,
  cartaAtiva,
  onApontarCausa,
  onExportarCSV,
  className = '',
}: TabelaSubgruposProps) {
  const [apenasForaDeControle, setApenasForaDeControle] = useState(false)
  const [termoBusca, setTermoBusca] = useState('')
  const [paginaAtual, setPaginaAtual] = useState(1)
  const [itensPorPagina, setItensPorPagina] = useState(15)

  // Filtragem combinada
  const subgruposFiltrados = useMemo(() => {
    return subgrupos.filter((sg) => {
      if (apenasForaDeControle && !sg.fora_de_controle) {
        return false
      }
      if (termoBusca.trim()) {
        const busca = termoBusca.toLowerCase()
        const numeroMatch = sg.numero_subgrupo.toString().includes(busca)
        const regraMatch = sg.violacoes.some(
          (v) =>
            v.codigo_regra.toLowerCase().includes(busca) ||
            v.descricao.toLowerCase().includes(busca)
        )
        if (!numeroMatch && !regraMatch) return false
      }
      return true
    })
  }, [subgrupos, apenasForaDeControle, termoBusca])

  // Paginação
  const totalPaginas = Math.max(1, Math.ceil(subgruposFiltrados.length / itensPorPagina))
  const indiceInicio = (paginaAtual - 1) * itensPorPagina
  const subgruposPaginados = subgruposFiltrados.slice(indiceInicio, indiceInicio + itensPorPagina)

  const n = cartaAtiva?.tamanho_subgrupo || 5
  const rotuloDispersao = n === 1 ? 'MR' : n > 10 ? 's' : 'R'

  return (
    <div
      data-testid="tabela-subgrupos-container"
      className={`flex flex-col bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl backdrop-blur-xs ${className}`}
    >
      {/* Barra Superior de Filtros e Busca */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          {/* Campo de Busca */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar subgrupo ou regra..."
              value={termoBusca}
              onChange={(e) => {
                setTermoBusca(e.target.value)
                setPaginaAtual(1)
              }}
              className="pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-950 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-blue-500"
            />
          </div>

          {/* Toggle Apenas Fora de Controle */}
          <button
            type="button"
            onClick={() => {
              setApenasForaDeControle(!apenasForaDeControle)
              setPaginaAtual(1)
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl font-medium border transition-colors cursor-pointer ${
              apenasForaDeControle
                ? 'bg-red-950/60 text-red-400 border-red-800/60'
                : 'bg-slate-950 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Apenas Anomalias</span>
          </button>
        </div>

        {/* Exportação CSV e Total */}
        <div className="flex items-center gap-3">
          <span className="text-2xs font-mono text-slate-400">
            Total: {subgruposFiltrados.length} subgrupos
          </span>

          {onExportarCSV && (
            <button
              type="button"
              onClick={onExportarCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabela de Alta Densidade */}
      <div className="overflow-x-auto mt-3">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950/70 text-slate-400 uppercase font-mono text-3xs tracking-wider border-b border-slate-800">
            <tr>
              <th className="py-2.5 px-3">Subgrupo Nº</th>
              <th className="py-2.5 px-3">Data / Hora</th>
              <th className="py-2.5 px-3">Medições Amostrais</th>
              <th className="py-2.5 px-3">Média (X̄)</th>
              <th className="py-2.5 px-3">Dispersão ({rotuloDispersao})</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3">Violações de Regra</th>
              <th className="py-2.5 px-3 text-right">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {subgruposPaginados.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-400 font-sans">
                  Nenhum subgrupo encontrado para os critérios selecionados.
                </td>
              </tr>
            ) : (
              subgruposPaginados.map((sg) => {
                const dataHora = new Date(sg.timestamp).toLocaleString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })

                const valorDispersao =
                  n > 10
                    ? sg.estatisticas.desvio_s
                    : sg.estatisticas.amplitude_r

                return (
                  <tr
                    key={sg.id || sg.numero_subgrupo}
                    data-testid={`linha-subgrupo-${sg.numero_subgrupo}`}
                    className={`hover:bg-slate-800/40 transition-colors ${
                      sg.fora_de_controle ? 'bg-red-950/20' : ''
                    }`}
                  >
                    <td className="py-2.5 px-3 font-bold text-slate-100">
                      #{sg.numero_subgrupo}
                    </td>
                    <td className="py-2.5 px-3 text-2xs text-slate-400">
                      {dataHora}
                    </td>
                    <td className="py-2.5 px-3 text-2xs text-slate-300 max-w-[200px] truncate" title={sg.valores_brutos.map((v) => Number(v.toFixed(4)).toFixed(3)).join(', ')}>
                      [{sg.valores_brutos.map((v) => Number(v.toFixed(4)).toFixed(3)).join(', ')}]
                    </td>
                    <td className="py-2.5 px-3 font-bold text-blue-400">
                      {sg.estatisticas.media_x.toFixed(3)}
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">
                      {valorDispersao.toFixed(3)}
                    </td>
                    <td className="py-2.5 px-3">
                      <Badge
                        variant={sg.fora_de_controle ? 'fora_de_controle' : 'sob_controle'}
                        className="text-3xs py-0.5 px-1.5"
                      >
                        {sg.fora_de_controle ? 'FORA DE CONTROLE' : 'SOB CONTROLE'}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3">
                      {sg.violacoes.length === 0 ? (
                        <span className="text-3xs text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Nenhuma
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {sg.violacoes.map((v) => (
                            <span
                              key={v.codigo_regra}
                              title={v.descricao}
                              className="px-1.5 py-0.5 text-3xs font-bold bg-red-950/60 text-red-400 border border-red-800/60 rounded"
                            >
                              {v.codigo_regra}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-sans">
                      {sg.fora_de_controle && onApontarCausa ? (
                        <button
                          type="button"
                          onClick={() => onApontarCausa(sg)}
                          className="px-2 py-1 text-2xs font-semibold rounded-lg bg-red-900/40 hover:bg-red-800/60 text-red-300 border border-red-700/50 transition-colors cursor-pointer"
                        >
                          Apontar Causa
                        </button>
                      ) : (
                        <span className="text-3xs text-slate-500 font-mono">--</span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Controles de Paginação */}
      {totalPaginas > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 mt-3 border-t border-slate-800 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span>Itens por página:</span>
            <select
              value={itensPorPagina}
              onChange={(e) => {
                setItensPorPagina(Number(e.target.value))
                setPaginaAtual(1)
              }}
              className="px-2 py-1 text-xs rounded-lg bg-slate-950 border border-slate-700 text-slate-200"
            >
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-slate-500 font-mono text-2xs ml-2">
              (Exibindo {indiceInicio + 1}–{Math.min(indiceInicio + itensPorPagina, subgruposFiltrados.length)} de {subgruposFiltrados.length})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono">
              Página {paginaAtual} de {totalPaginas}
            </span>
            <button
              type="button"
              disabled={paginaAtual <= 1}
              onClick={() => setPaginaAtual((p) => Math.max(1, p - 1))}
              className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={paginaAtual >= totalPaginas}
              onClick={() => setPaginaAtual((p) => Math.min(totalPaginas, p + 1))}
              className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
