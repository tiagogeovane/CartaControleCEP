import { useState } from 'react'
import {
  Bell,
  LogOut,
  Pause,
  Play,
  Radio,
  Search,
  ShieldCheck,
  Siren,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { Badge, type BadgeVariant } from '@/components/common/Badge'
import { useAuthStore } from '@/stores/authStore'
import { useCEPStore } from '@/stores/cepStore'
import type { WebSocketConnectionStatus } from '@/types/websocket'
import { formatarNomeCarta } from '@/utils/formatters'

export interface TopbarProps {
  onLogout?: () => void
  onToggleAlertsModal?: () => void
}

const statusVariantMap: Record<WebSocketConnectionStatus, BadgeVariant> = {
  ONLINE: 'online',
  RECONNECTING: 'reconnecting',
  OFFLINE: 'offline',
  CONNECTING: 'connecting',
}

const statusTextMap: Record<WebSocketConnectionStatus, string> = {
  ONLINE: 'ONLINE',
  RECONNECTING: 'RECONECTANDO',
  OFFLINE: 'OFFLINE',
  CONNECTING: 'CONECTANDO',
}

export function Topbar({ onLogout, onToggleAlertsModal }: TopbarProps) {
  const { usuario, logout } = useAuthStore()
  const {
    cartaDetalhes,
    statusConexao,
    streamingPausado,
    togglePausaStreaming,
    ultimoSubgrupo,
    alarmesAtivos,
  } = useCEPStore()

  const [somSilenciado, setSomSilenciado] = useState(false)
  const [termoBusca, setTermoBusca] = useState('')

  const handleLogout = () => {
    logout()
    onLogout?.()
  }

  const foraDeControle = ultimoSubgrupo?.fora_de_controle ?? false

  return (
    <header className="h-16 bg-slate-950/90 border-b border-slate-800/60 px-4 sm:px-6 flex items-center justify-between gap-4 shrink-0 z-20 backdrop-blur-xs">
      {/* Lado Esquerdo: Telemetria e Carta Ativa */}
      <div className="flex items-center gap-3 sm:gap-4 overflow-hidden">
        {/* Status de Conexão WebSocket */}
        <Badge
          variant={statusVariantMap[statusConexao]}
          pulse={statusConexao === 'ONLINE' || statusConexao === 'RECONNECTING'}
          className="font-mono text-2xs uppercase"
        >
          {statusTextMap[statusConexao]}
        </Badge>

        {/* Informações da Carta Ativa */}
        {cartaDetalhes ? (
          <div className="flex items-center gap-2 truncate">
            <span className="hidden sm:inline text-xs text-slate-400 font-medium">
              Carta:
            </span>
            <span className="text-xs sm:text-sm font-semibold text-slate-100 truncate font-mono">
              {formatarNomeCarta(cartaDetalhes)}
            </span>
            <Badge
              variant={cartaDetalhes.modo_limites === 'DINAMICO' ? 'dinamico' : 'fixo'}
              className="text-3xs hidden md:inline-flex"
            >
              {cartaDetalhes.modo_limites}
            </Badge>
          </div>
        ) : (
          <span className="text-xs text-slate-400 italic hidden sm:inline">
            Nenhuma carta selecionada
          </span>
        )}

        {/* Badge de Estabilidade Estatística */}
        {ultimoSubgrupo && (
          <Badge
            variant={foraDeControle ? 'fora_de_controle' : 'sob_controle'}
            pulse={foraDeControle}
            className="hidden lg:inline-flex text-2xs uppercase"
          >
            {foraDeControle ? 'FORA DE CONTROLE' : 'SOB CONTROLE'}
          </Badge>
        )}
      </div>

      {/* Centro: Barra de Busca Rápida (inspirada na referência) */}
      <div className="hidden md:flex items-center flex-1 max-w-sm mx-4">
        <div className="relative w-full">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={termoBusca}
            onChange={(e) => setTermoBusca(e.target.value)}
            placeholder='Buscar "Processo, carta ou linha..."'
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-900 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-purple-500/60 transition-colors"
          />
        </div>
      </div>

      {/* Lado Direito: Ações Operacionais e Perfil */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Botão Pausar / Retomar Streaming */}
        <button
          type="button"
          onClick={togglePausaStreaming}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
            streamingPausado
              ? 'bg-amber-950/80 text-amber-400 border-amber-700/60 hover:bg-amber-900/90'
              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
          }`}
          title={
            streamingPausado
              ? 'Streaming pausado. Clique para retomar'
              : 'Pausar atualização visual'
          }
        >
          {streamingPausado ? (
            <>
              <Play className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              <span className="hidden md:inline">Retomar</span>
            </>
          ) : (
            <>
              <Pause className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden md:inline">Congelar</span>
            </>
          )}
        </button>

        {/* Indicador de Sirene Industrial e Mute de Áudio */}
        <div className="flex items-center gap-1">
          {alarmesAtivos.length > 0 && (
            <div
              data-testid="indicador-sirene-ativa"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-red-950/80 border border-red-600/70 text-red-300 font-mono text-3xs font-bold animate-pulse shadow-lg shadow-red-950/50"
            >
              <Siren className="w-3.5 h-3.5 text-red-400 shrink-0 animate-bounce" />
              <span>{alarmesAtivos.length} ALARME(S)</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => setSomSilenciado(!somSilenciado)}
            className={`p-2 rounded-lg transition-colors cursor-pointer ${
              somSilenciado
                ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                : 'text-amber-400 hover:text-amber-300 hover:bg-slate-800'
            }`}
            aria-label={somSilenciado ? 'Ativar sirene sonora' : 'Silenciar sirene sonora'}
            title={somSilenciado ? 'Sirene Sonora Desativada' : 'Sirene Sonora Ativa'}
          >
            {somSilenciado ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Botão de Alarmes */}
        {onToggleAlertsModal && (
          <button
            type="button"
            onClick={onToggleAlertsModal}
            className="relative p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Alarmes e Ocorrências"
            title="Alarmes Ativos"
          >
            <Bell className="w-4 h-4" />
            {alarmesAtivos.length > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
              </span>
            )}
          </button>
        )}

        <div className="h-4 w-px bg-slate-800 mx-1 hidden sm:block" />

        {/* Perfil do Usuário */}
        {usuario ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/40 text-blue-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="hidden sm:flex flex-col text-left">
              <span className="text-xs font-semibold text-slate-200 leading-tight">
                {usuario.nome}
              </span>
              <span className="text-3xs text-blue-400 font-bold uppercase font-mono tracking-wider">
                {usuario.perfil === 'ADMIN' ? 'Acesso Total (Admin)' : usuario.perfil}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <Radio className="w-3.5 h-3.5 text-slate-400 animate-pulse" />
            <span className="hidden sm:inline">Modo Monitoramento</span>
          </div>
        )}

        {/* Botão Logout */}
        {usuario && (
          <button
            type="button"
            onClick={handleLogout}
            className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800/80 transition-colors cursor-pointer"
            aria-label="Encerrar Sessão"
            title="Sair do sistema"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  )
}
