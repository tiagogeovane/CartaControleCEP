import { AlertTriangle, CheckCircle2, FileText, Trash2 } from 'lucide-react'
import type { AlarmeAtivo } from '@/stores/cepStore'
import { REGRAS_NELSON_METADATA } from '@/types/cep'
import { Badge } from '@/components/common/Badge'

export interface FeedAlarmesProps {
  alarmes: AlarmeAtivo[]
  onApontarCausa: (alarme: AlarmeAtivo) => void
  onLimparAlarmes?: () => void
  onFocarSubgrupo?: (subgrupoNumero: number) => void
  className?: string
}

export function FeedAlarmes({
  alarmes,
  onApontarCausa,
  onLimparAlarmes,
  onFocarSubgrupo,
  className = '',
}: FeedAlarmesProps) {
  return (
    <aside
      data-testid="feed-alarmes"
      className={`flex flex-col bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl backdrop-blur-xs ${className}`}
    >
      {/* Cabeçalho do Feed */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-red-950/60 border border-red-800/60 text-red-400">
            <AlertTriangle className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              Feed de Alarmes
              {alarmes.length > 0 && (
                <span className="px-1.5 py-0.5 text-xs font-mono font-bold bg-red-500/20 text-red-400 border border-red-500/30 rounded-full">
                  {alarmes.length}
                </span>
              )}
            </h3>
            <p className="text-2xs text-slate-400">Violações das Regras de Nelson</p>
          </div>
        </div>

        {alarmes.length > 0 && onLimparAlarmes && (
          <button
            type="button"
            onClick={onLimparAlarmes}
            title="Limpar histórico de alarmes"
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Lista Cronológica de Alarmes */}
      <div className="flex-1 overflow-y-auto mt-3 space-y-2.5 max-h-[500px] pr-1 scrollbar-thin">
        {alarmes.length === 0 ? (
          <div
            data-testid="feed-empty-state"
            className="flex flex-col items-center justify-center py-10 text-center text-slate-400"
          >
            <div className="p-2.5 rounded-full bg-emerald-950/40 border border-emerald-800/40 mb-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
            <p className="text-xs font-medium text-slate-300">Processo Sob Controle</p>
            <p className="text-2xs text-slate-400 mt-0.5 max-w-[200px]">
              Nenhuma anomalia ou violação estatística detectada no histórico recente.
            </p>
          </div>
        ) : (
          alarmes.map((alarme) => {
            const dataHora = new Date(alarme.timestamp).toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })

            return (
              <div
                key={alarme.id}
                data-testid={`alarme-item-${alarme.subgrupoNumero}`}
                className="p-3 rounded-xl bg-slate-950/60 border border-red-900/40 hover:border-red-700/60 transition-all group"
              >
                {/* Cabeçalho do Card de Alarme */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onFocarSubgrupo?.(alarme.subgrupoNumero)}
                      className="text-xs font-mono font-bold text-blue-400 hover:text-blue-300 hover:underline cursor-pointer"
                      title="Clique para focar no ponto da carta"
                    >
                      Subgrupo #{alarme.subgrupoNumero}
                    </button>
                    <span className="text-2xs text-slate-400 font-mono">({dataHora})</span>
                  </div>
                  <Badge variant="fora_de_controle" className="text-3xs py-0.5 px-1.5">
                    ANOMALIA
                  </Badge>
                </div>

                {/* Lista de Regras Violadas */}
                <div className="space-y-1.5 mb-2.5">
                  {alarme.violacoes.map((v, i) => {
                    const meta = REGRAS_NELSON_METADATA[v.codigo_regra]
                    const nome = meta ? meta.nome : v.codigo_regra
                    const isCritica = meta?.severidade === 'CRITICA'

                    return (
                      <div
                        key={i}
                        className={`text-2xs p-1.5 rounded-md border ${
                          isCritica
                            ? 'bg-red-950/40 border-red-800/60 text-red-300'
                            : 'bg-amber-950/30 border-amber-800/40 text-amber-300'
                        }`}
                      >
                        <div className="font-semibold flex items-center justify-between">
                          <span>{nome}</span>
                          <span className="text-3xs opacity-80">{v.codigo_regra}</span>
                        </div>
                        <p className="text-slate-300 mt-0.5 leading-tight font-sans text-3xs">
                          {v.descricao}
                        </p>
                      </div>
                    )
                  })}
                </div>

                {/* Ação: Registrar Causa Especial */}
                <button
                  type="button"
                  onClick={() => onApontarCausa(alarme)}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2.5 text-2xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                >
                  <FileText className="w-3 h-3 text-slate-400 group-hover:text-blue-400" />
                  <span>Apontar Causa & Ação</span>
                </button>
              </div>
            )
          })
        )}
      </div>
    </aside>
  )
}
