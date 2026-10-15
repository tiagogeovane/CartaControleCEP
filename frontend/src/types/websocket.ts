/**
 * Contratos de Mensagens e Ciclo de Vida do WebSocket Reativo (/ws/cartas/{id}).
 */
import type { ViolacaoRegraResponse } from './api'

export type WebSocketConnectionStatus = 'CONNECTING' | 'ONLINE' | 'OFFLINE' | 'RECONNECTING'

export interface ConexaoEstabelecidaEvent {
  event: 'CONEXAO_ESTABELECIDA'
  carta_id: string
  status: string
}

export interface EstatisticasSubgrupoWebSocket {
  media_x: number
  amplitude_r: number
  desvio_s: number
  amostras_brutas: number[]
}

export interface LimitesControleWebSocket {
  lc: number
  lsc: number
  lic: number
  sigma_estimado?: number
  lc_dispersao?: number | null
  lsc_dispersao?: number | null
  lic_dispersao?: number | null
}

export interface StatusControleWebSocket {
  fora_de_controle: boolean
  regras_violadas: ViolacaoRegraResponse[]
}

export interface CapacidadeRapidaWebSocket {
  cp?: number | null
  cpk?: number | null
}

export interface NovoSubgrupoProcessadoEvent {
  event: 'NOVO_SUBGRUPO_PROCESSADO'
  carta_id: string
  timestamp: string
  numero_subgrupo: number
  modo_limites?: 'DINAMICO' | 'FIXO'
  estatisticas: EstatisticasSubgrupoWebSocket
  limites: LimitesControleWebSocket
  status_controle: StatusControleWebSocket
  capacidade?: CapacidadeRapidaWebSocket
}

export interface ModoLimitesAlteradoEvent {
  event: 'MODO_LIMITES_ALTERADO'
  carta_id: string
  modo_limites: 'DINAMICO' | 'FIXO'
}

export type WebSocketIncomingMessage =
  | ConexaoEstabelecidaEvent
  | NovoSubgrupoProcessadoEvent
  | ModoLimitesAlteradoEvent
  | { type: 'pong' }

export interface WebSocketPingMessage {
  type: 'ping'
}

