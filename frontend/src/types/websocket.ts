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
  estatisticas: EstatisticasSubgrupoWebSocket
  limites: LimitesControleWebSocket
  status_controle: StatusControleWebSocket
  capacidade?: CapacidadeRapidaWebSocket
}

export type WebSocketIncomingMessage =
  | ConexaoEstabelecidaEvent
  | NovoSubgrupoProcessadoEvent
  | { type: 'pong' }

export interface WebSocketPingMessage {
  type: 'ping'
}
