import { useMemo } from 'react'
import { ShieldCheck, AlertCircle } from 'lucide-react'
import { REGRAS_NELSON_METADATA } from '@/types/cep'
import type { SubgrupoResponse } from '@/types/api'
import type { AlarmeAtivo } from '@/stores/cepStore'

export interface DistribuicaoRegrasNelsonProps {
  subgrupos: SubgrupoResponse[]
  alarmes?: AlarmeAtivo[]
  className?: string
}

export function DistribuicaoRegrasNelson({
  subgrupos,
  alarmes = [],
  className = '',
}: DistribuicaoRegrasNelsonProps) {
  // Contabilizar violações por regra a partir dos subgrupos e dos alarmes
  const estatisticasRegras = useMemo(() => {
    const contagens: Record<string, number> = {
      REGRA_1: 0,
      REGRA_2: 0,
      REGRA_3: 0,
      REGRA_4: 0,
      REGRA_5: 0,
      REGRA_6: 0,
      REGRA_7: 0,
      REGRA_8: 0,
    }

    // Contabilizar de subgrupos históricos
    subgrupos.forEach((sg) => {
      if (sg.violacoes) {
        sg.violacoes.forEach((v) => {
          if (contagens[v.codigo_regra] !== undefined) {
            contagens[v.codigo_regra] += 1
          }
        })
      }
    })

    // Complementar com alarmes ativos em tempo real se ainda não computados
    alarmes.forEach((al) => {
      al.violacoes.forEach((v) => {
        // Evitar duplicar se o subgrupo já estiver no buffer
        const jaComputado = subgrupos.some(
          (sg) => sg.numero_subgrupo === al.subgrupoNumero
        )
        if (!jaComputado && contagens[v.codigo_regra] !== undefined) {
          contagens[v.codigo_regra] += 1
        }
      })
    })

    const lista = Object.entries(REGRAS_NELSON_METADATA).map(([key, meta]) => ({
      key,
      codigoNumero: key.replace('REGRA_', 'R'),
      nome: meta.nome,
      severidade: meta.severidade,
      ocorrencias: contagens[key] || 0,
    }))

    const totalOcorrencias = lista.reduce((sum, item) => sum + item.ocorrencias, 0)
    const maxOcorrencias = Math.max(...lista.map((i) => i.ocorrencias), 1)

    // Ordenar: primeiro as que têm mais ocorrências, mantendo ordem de regra se empatadas
    lista.sort((a, b) => b.ocorrencias - a.ocorrencias)

    return {
      lista,
      totalOcorrencias,
      maxOcorrencias,
    }
  }, [subgrupos, alarmes])

  return (
    <div
      data-testid="distribuicao-regras-nelson"
      className={`flex flex-col bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-xs ${className}`}
    >
      {/* Cabeçalho */}
      <div className="flex items-center justify-between pb-3.5 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            Violações por Regra de Nelson
          </h3>
          <p className="text-2xs text-slate-400 mt-0.5">
            Distribuição e ranking de anomalias estatísticas detectadas
          </p>
        </div>

        <div className="flex items-center gap-2">
          {estatisticasRegras.totalOcorrencias > 0 ? (
            <span className="px-2 py-0.5 text-xs font-mono font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30 rounded-full flex items-center gap-1.5">
              <AlertCircle className="w-3 h-3" />
              {estatisticasRegras.totalOcorrencias} violações
            </span>
          ) : (
            <span className="px-2 py-0.5 text-xs font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-full flex items-center gap-1.5">
              <ShieldCheck className="w-3 h-3" />
              0 anomalias
            </span>
          )}
        </div>
      </div>

      {/* Lista de Barras Horizontais */}
      <div className="mt-4 space-y-3">
        {estatisticasRegras.lista.map((regra) => {
          const porcentagemLargura =
            estatisticasRegras.totalOcorrencias > 0
              ? Math.max((regra.ocorrencias / estatisticasRegras.maxOcorrencias) * 100, 3)
              : 0

          const temOcorrencia = regra.ocorrencias > 0

          return (
            <div
              key={regra.key}
              className="flex items-center gap-3 group transition-colors"
            >
              {/* Identificador da Regra */}
              <div className="w-28 sm:w-36 shrink-0 flex items-center gap-1.5">
                <span
                  className={`px-1.5 py-0.5 text-3xs font-mono font-bold rounded-md border ${
                    regra.severidade === 'CRITICA'
                      ? 'bg-rose-950/60 text-rose-400 border-rose-800/60'
                      : 'bg-purple-950/60 text-purple-300 border-purple-800/60'
                  }`}
                >
                  {regra.codigoNumero}
                </span>
                <span
                  className="text-xs text-slate-300 font-medium truncate"
                  title={regra.nome}
                >
                  {regra.nome}
                </span>
              </div>

              {/* Barra de Progresso Horizontal Estilo Nexo Tech */}
              <div className="flex-1 h-3 rounded-full bg-slate-950 border border-slate-800/80 p-0.5 overflow-hidden flex items-center">
                {temOcorrencia ? (
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      regra.severidade === 'CRITICA'
                        ? 'bg-gradient-to-r from-rose-500 to-amber-500'
                        : 'bg-gradient-to-r from-[#7C4FE0] to-[#9548D9]'
                    }`}
                    style={{ width: `${porcentagemLargura}%` }}
                  />
                ) : (
                  <div className="h-full w-0 bg-slate-800 rounded-full" />
                )}
              </div>

              {/* Contador Numérico */}
              <div className="w-14 text-right shrink-0">
                <span
                  className={`text-xs font-mono font-bold tabular-nums ${
                    temOcorrencia ? 'text-slate-200' : 'text-slate-500'
                  }`}
                >
                  {regra.ocorrencias}{' '}
                  <span className="text-3xs font-normal text-slate-500">oc.</span>
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
