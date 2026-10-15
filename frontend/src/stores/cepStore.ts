import { create } from 'zustand'
import type {
  CartaControleResponse,
  LimitesControleSchema,
  SubgrupoResponse,
  ViolacaoRegraResponse,
} from '@/types/api'
import type {
  NovoSubgrupoProcessadoEvent,
  WebSocketConnectionStatus,
} from '@/types/websocket'

export interface AlarmeAtivo {
  id: string
  subgrupoNumero: number
  timestamp: string
  violacoes: ViolacaoRegraResponse[]
}

export interface CEPState {
  // Estado Principal
  cartaAtivaId: string | null
  cartaDetalhes: CartaControleResponse | null
  subgruposHistorico: SubgrupoResponse[]
  ultimoSubgrupo: SubgrupoResponse | null
  limiteBuffer: number
  streamingPausado: boolean
  statusConexao: WebSocketConnectionStatus
  alarmesAtivos: AlarmeAtivo[]

  // Ações
  setCartaAtiva: (carta: CartaControleResponse | null) => void
  setCartaDetalhes: (carta: CartaControleResponse | null) => void
  setBufferHistorico: (subgrupos: SubgrupoResponse[]) => void
  adicionarSubgrupo: (item: SubgrupoResponse | NovoSubgrupoProcessadoEvent) => void
  togglePausaStreaming: () => void
  setStreamingPausado: (pausado: boolean) => void
  setStatusConexao: (status: WebSocketConnectionStatus) => void
  setLimiteBuffer: (limite: number) => void
  limparBuffer: () => void
  setModoLimites: (modo: 'DINAMICO' | 'FIXO') => void
  removerAlarme: (id: string) => void
  limparAlarmes: () => void
}

function normalizarSubgrupo(
  item: SubgrupoResponse | NovoSubgrupoProcessadoEvent
): SubgrupoResponse {
  if ('id' in item) {
    return item
  }

  return {
    id: `ws-${item.numero_subgrupo}-${item.timestamp}`,
    carta_id: item.carta_id,
    numero_subgrupo: item.numero_subgrupo,
    timestamp: item.timestamp,
    valores_brutos: item.estatisticas.amostras_brutas,
    estatisticas: {
      media_x: item.estatisticas.media_x,
      amplitude_r: item.estatisticas.amplitude_r,
      desvio_s: item.estatisticas.desvio_s,
      valores_brutos: item.estatisticas.amostras_brutas,
    },
    fora_de_controle: item.status_controle.fora_de_controle,
    violacoes: item.status_controle.regras_violadas,
  }
}

export const useCEPStore = create<CEPState>((set, get) => ({
  cartaAtivaId: null,
  cartaDetalhes: null,
  subgruposHistorico: [],
  ultimoSubgrupo: null,
  limiteBuffer: 100,
  streamingPausado: false,
  statusConexao: 'OFFLINE',
  alarmesAtivos: [],

  setCartaAtiva: (carta: CartaControleResponse | null) => {
    set({
      cartaAtivaId: carta ? carta.id : null,
      cartaDetalhes: carta,
      subgruposHistorico: [],
      ultimoSubgrupo: null,
      alarmesAtivos: [],
      statusConexao: 'OFFLINE',
    })
  },

  setCartaDetalhes: (carta: CartaControleResponse | null) => {
    set({ cartaDetalhes: carta })
  },

  setBufferHistorico: (subgrupos: SubgrupoResponse[]) => {
    const limite = get().limiteBuffer
    const bufferAjustado =
      subgrupos.length > limite ? subgrupos.slice(subgrupos.length - limite) : [...subgrupos]
    const ultimo = bufferAjustado.length > 0 ? bufferAjustado[bufferAjustado.length - 1] : null

    // Extrair alarmes existentes nos subgrupos fornecidos
    const novosAlarmes: AlarmeAtivo[] = []
    bufferAjustado.forEach((sg) => {
      if (sg.fora_de_controle && sg.violacoes.length > 0) {
        novosAlarmes.push({
          id: `alarm-${sg.id || sg.numero_subgrupo}`,
          subgrupoNumero: sg.numero_subgrupo,
          timestamp: sg.timestamp,
          violacoes: sg.violacoes,
        })
      }
    })

    set({
      subgruposHistorico: bufferAjustado,
      ultimoSubgrupo: ultimo,
      alarmesAtivos: novosAlarmes,
    })
  },

  adicionarSubgrupo: (item: SubgrupoResponse | NovoSubgrupoProcessadoEvent) => {
    const state = get()
    const normalizado = normalizarSubgrupo(item)
    const limite = state.limiteBuffer

    // Se o streaming estiver pausado, ainda mantemos em buffer mas sem necessariamente redefinir janela
    const novoHistorico = [...state.subgruposHistorico, normalizado]
    const bufferFinal =
      novoHistorico.length > limite
        ? novoHistorico.slice(novoHistorico.length - limite)
        : novoHistorico

    // Detectar anomalias para adicionar à lista de alarmes
    let novosAlarmes = state.alarmesAtivos
    if (normalizado.fora_de_controle && normalizado.violacoes.length > 0) {
      const alarme: AlarmeAtivo = {
        id: `alarm-${normalizado.id || normalizado.numero_subgrupo}-${Date.now()}`,
        subgrupoNumero: normalizado.numero_subgrupo,
        timestamp: normalizado.timestamp,
        violacoes: normalizado.violacoes,
      }
      novosAlarmes = [alarme, ...state.alarmesAtivos].slice(0, 50)
    }

    // Atualizar limites da carta caso venham no evento do WebSocket
    let cartaAtualizada = state.cartaDetalhes
    if ('limites' in item && item.limites) {
      const novosLimites: LimitesControleSchema = {
        lc: item.limites.lc,
        lsc: item.limites.lsc,
        lic: item.limites.lic,
        sigma_estimado:
          item.limites.sigma_estimado ??
          cartaAtualizada?.limites_atuais?.sigma_estimado ??
          0,
        lc_dispersao:
          item.limites.lc_dispersao ??
          cartaAtualizada?.limites_atuais?.lc_dispersao ??
          null,
        lsc_dispersao:
          item.limites.lsc_dispersao ??
          cartaAtualizada?.limites_atuais?.lsc_dispersao ??
          null,
        lic_dispersao:
          item.limites.lic_dispersao ??
          cartaAtualizada?.limites_atuais?.lic_dispersao ??
          null,
      }

      const modoLimitesItem =
        'modo_limites' in item && item.modo_limites
          ? item.modo_limites
          : cartaAtualizada?.modo_limites || 'DINAMICO'

      if (cartaAtualizada) {
        cartaAtualizada = {
          ...cartaAtualizada,
          limites_atuais: novosLimites,
          modo_limites: modoLimitesItem,
          total_subgrupos: cartaAtualizada.total_subgrupos + 1,
        }
      } else {
        cartaAtualizada = {
          id: item.carta_id,
          processo_id: '',
          tipo_carta: 'X_R',
          tamanho_subgrupo: item.estatisticas?.amostras_brutas?.length || 5,
          especificacoes: null,
          limites_atuais: novosLimites,
          modo_limites: modoLimitesItem,
          total_subgrupos: item.numero_subgrupo || 1,
        }
      }
    }

    set({
      subgruposHistorico: bufferFinal,
      ultimoSubgrupo: normalizado,
      alarmesAtivos: novosAlarmes,
      cartaDetalhes: cartaAtualizada,
    })
  },

  togglePausaStreaming: () => {
    set((state) => ({ streamingPausado: !state.streamingPausado }))
  },

  setStreamingPausado: (pausado: boolean) => {
    set({ streamingPausado: pausado })
  },

  setStatusConexao: (status: WebSocketConnectionStatus) => {
    set({ statusConexao: status })
  },

  setLimiteBuffer: (limite: number) => {
    const limiteSeguro = Math.max(10, Math.min(1000, limite))
    const state = get()
    const ajustado =
      state.subgruposHistorico.length > limiteSeguro
        ? state.subgruposHistorico.slice(state.subgruposHistorico.length - limiteSeguro)
        : state.subgruposHistorico
    set({
      limiteBuffer: limiteSeguro,
      subgruposHistorico: ajustado,
    })
  },

  limparBuffer: () => {
    set({
      subgruposHistorico: [],
      ultimoSubgrupo: null,
    })
  },

  setModoLimites: (modo: 'DINAMICO' | 'FIXO') => {
    const state = get()
    if (state.cartaDetalhes) {
      set({
        cartaDetalhes: {
          ...state.cartaDetalhes,
          modo_limites: modo,
        },
      })
    }
  },

  removerAlarme: (id: string) => {
    set((state) => ({
      alarmesAtivos: state.alarmesAtivos.filter((a) => a.id !== id),
    }))
  },

  limparAlarmes: () => {
    set({ alarmesAtivos: [] })
  },
}))
