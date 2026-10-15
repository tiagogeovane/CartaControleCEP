import { Download, FileText, Lock, Pause, Play, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ControlesCartaProps {
  janelaSelecionada: number | 'todos'
  onSelectJanela: (janela: number | 'todos') => void
  streamingPausado: boolean
  onTogglePausa: () => void
  onExportarPNG: () => void
  onGerarRelatorioPDF?: () => void
  totalSubgrupos: number
  modoLimites?: 'DINAMICO' | 'FIXO'
  className?: string
}

const opcoesJanela: Array<{ label: string; valor: number | 'todos' }> = [
  { label: '30 pts', valor: 30 },
  { label: '50 pts', valor: 50 },
  { label: '100 pts', valor: 100 },
  { label: 'Todos', valor: 'todos' },
]

export function ControlesCarta({
  janelaSelecionada,
  onSelectJanela,
  streamingPausado,
  onTogglePausa,
  onExportarPNG,
  onGerarRelatorioPDF,
  totalSubgrupos,
  modoLimites,
  className,
}: ControlesCartaProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-900/90 border border-slate-800 rounded-xl',
        className
      )}
    >
      {/* Seletor de Janela de Visualização */}
      <div className="flex items-center gap-1.5">
        <span className="text-2xs uppercase tracking-wider text-slate-400 font-medium mr-1 hidden sm:inline">
          Janela:
        </span>
        <div className="inline-flex rounded-lg bg-slate-950 p-0.5 border border-slate-800">
          {opcoesJanela.map((opcao) => {
            const isAtivo = janelaSelecionada === opcao.valor
            return (
              <button
                key={String(opcao.valor)}
                type="button"
                onClick={() => onSelectJanela(opcao.valor)}
                className={cn(
                  'px-2.5 py-1 text-xs font-mono rounded-md transition-all cursor-pointer',
                  isAtivo
                    ? 'bg-blue-600 text-white font-semibold shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                )}
              >
                {opcao.label}
              </button>
            )
          })}
        </div>
        <span className="text-2xs text-slate-400 font-mono ml-2 hidden md:inline">
          ({totalSubgrupos} subgrupos)
        </span>
      </div>

      {/* Indicador de Modo dos Limites de Controle */}
      {modoLimites && (
        <div className="flex items-center">
          {modoLimites === 'FIXO' ? (
            <span
              data-testid="badge-modo-fixo"
              className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg bg-purple-950/80 text-purple-300 border border-purple-700/70 shadow-xs"
              title="Modo FIXO: Os limites de controle foram calibrados e permanecem rigorosamente congelados para acompanhamento contínuo da produção."
            >
              <Lock className="w-3.5 h-3.5 text-purple-400" />
              <span>Limites Fixos (Acompanhamento)</span>
            </span>
          ) : (
            <span
              data-testid="badge-modo-dinamico"
              className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg bg-blue-950/80 text-blue-300 border border-blue-700/70 shadow-xs"
              title="Modo DINÂMICO: Os limites de controle são recalculados iterativamente com cada novo subgrupo nesta fase de calibração."
            >
              <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
              <span>Limites Dinâmicos (Calibração)</span>
            </span>
          )}
        </div>
      )}

      {/* Ações: Congelar e Exportar */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onTogglePausa}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer',
            streamingPausado
              ? 'bg-amber-950/80 text-amber-300 border-amber-700/80 hover:bg-amber-900/90'
              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
          )}
          title={streamingPausado ? 'Retomar rolagem contínua' : 'Congelar tela para análise'}
        >
          {streamingPausado ? (
            <>
              <Play className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span>Retomar</span>
            </>
          ) : (
            <>
              <Pause className="w-3.5 h-3.5 text-slate-400" />
              <span>Congelar</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onExportarPNG}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 hover:text-white transition-colors cursor-pointer"
          title="Exportar imagem PNG da carta em alta resolução"
        >
          <Download className="w-3.5 h-3.5 text-slate-400" />
          <span className="hidden sm:inline">Exportar PNG</span>
        </button>

        {onGerarRelatorioPDF && (
          <button
            type="button"
            onClick={onGerarRelatorioPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600/20 text-blue-300 border border-blue-500/40 hover:bg-blue-600/30 hover:text-white transition-colors cursor-pointer"
            title="Personalizar e gerar relatório técnico completo em PDF"
          >
            <FileText className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">Relatório PDF</span>
          </button>
        )}
      </div>
    </div>
  )
}
