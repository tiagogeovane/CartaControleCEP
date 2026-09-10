import { useCallback, useEffect, useRef, useState } from 'react'
import { useCEPStore } from '@/stores/cepStore'
import type {
  NovoSubgrupoProcessadoEvent,
  WebSocketConnectionStatus,
  WebSocketIncomingMessage,
} from '@/types/websocket'

export interface UseWebSocketCEPOptions {
  autoReconnect?: boolean
  maxReconnectAttempts?: number
  heartbeatIntervalMs?: number
  onEvent?: (event: WebSocketIncomingMessage) => void
  onNovoSubgrupo?: (subgrupo: NovoSubgrupoProcessadoEvent) => void
}

export function useWebSocketCEP(
  cartaId: string | null | undefined,
  options: UseWebSocketCEPOptions = {}
) {
  const {
    autoReconnect = true,
    maxReconnectAttempts = 10,
    heartbeatIntervalMs = 20000,
    onEvent,
    onNovoSubgrupo,
  } = options

  // Estado único e centralizado obtido diretamente da store Zustand
  const status = useCEPStore((state) => state.statusConexao)
  const streamingPausado = useCEPStore((state) => state.streamingPausado)
  const togglePausa = useCEPStore((state) => state.togglePausaStreaming)

  const [ultimoEvento, setUltimoEvento] = useState<WebSocketIncomingMessage | null>(null)

  const socketRef = useRef<WebSocket | null>(null)
  const reconnectAttemptRef = useRef<number>(0)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isManuallyClosedRef = useRef<boolean>(false)
  const conectarRef = useRef<() => void>(() => {})

  const atualizarStatus = useCallback((novoStatus: WebSocketConnectionStatus) => {
    useCEPStore.getState().setStatusConexao(novoStatus)
  }, [])

  const limparTimers = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current)
      heartbeatIntervalRef.current = null
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
  }, [])

  const construirUrlWebSocket = useCallback((id: string) => {
    const envWsUrl = import.meta.env.VITE_WS_URL
    if (envWsUrl) {
      const base = envWsUrl.endsWith('/') ? envWsUrl.slice(0, -1) : envWsUrl
      return `${base}/ws/cartas/${id}`
    }

    if (typeof window !== 'undefined') {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      return `${protocol}//${window.location.host}/ws/cartas/${id}`
    }

    return `ws://localhost:8000/ws/cartas/${id}`
  }, [])

  const conectar = useCallback(() => {
    if (!cartaId) {
      atualizarStatus('OFFLINE')
      return
    }

    limparTimers()

    // Fecha e limpa listeners de conexão anterior para evitar disparos acidentais
    if (socketRef.current) {
      try {
        socketRef.current.onopen = null
        socketRef.current.onmessage = null
        socketRef.current.onerror = null
        socketRef.current.onclose = null
        socketRef.current.close()
      } catch {
        // Ignora erros ao fechar socket anterior
      }
      socketRef.current = null
    }

    isManuallyClosedRef.current = false
    const statusInicial = reconnectAttemptRef.current > 0 ? 'RECONNECTING' : 'CONNECTING'
    atualizarStatus(statusInicial)

    try {
      const url = construirUrlWebSocket(cartaId)
      const ws = new WebSocket(url)
      socketRef.current = ws

      ws.onopen = () => {
        reconnectAttemptRef.current = 0
        // Inicia heartbeat periódico (ping)
        heartbeatIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }))
          }
        }, heartbeatIntervalMs)
      }

      ws.onmessage = (event) => {
        try {
          const dados: WebSocketIncomingMessage = JSON.parse(event.data)
          setUltimoEvento(dados)
          onEvent?.(dados)

          if ('event' in dados) {
            if (dados.event === 'CONEXAO_ESTABELECIDA') {
              atualizarStatus('ONLINE')
            } else if (dados.event === 'NOVO_SUBGRUPO_PROCESSADO') {
              useCEPStore.getState().adicionarSubgrupo(dados)
              onNovoSubgrupo?.(dados)
            }
          }
        } catch {
          // Trata respostas em texto puro como 'pong'
          if (typeof event.data === 'string' && event.data.trim().toLowerCase() === 'pong') {
            // Heartbeat confirmado
          }
        }
      }

      ws.onerror = () => {
        // O evento de erro precede o onclose, que fará a reconexão
      }

      ws.onclose = () => {
        limparTimers()

        if (isManuallyClosedRef.current) {
          atualizarStatus('OFFLINE')
          return
        }

        if (autoReconnect && reconnectAttemptRef.current < maxReconnectAttempts) {
          reconnectAttemptRef.current += 1
          atualizarStatus('RECONNECTING')

          // Algoritmo de Exponential Backoff: min(1000 * 2^(tentativa - 1), 30000)
          const delay = Math.min(
            1000 * Math.pow(2, reconnectAttemptRef.current - 1),
            30000
          )

          reconnectTimeoutRef.current = setTimeout(() => {
            conectarRef.current()
          }, delay)
        } else {
          atualizarStatus('OFFLINE')
        }
      }
    } catch {
      atualizarStatus('OFFLINE')
    }
  }, [
    cartaId,
    limparTimers,
    atualizarStatus,
    construirUrlWebSocket,
    heartbeatIntervalMs,
    onEvent,
    onNovoSubgrupo,
    autoReconnect,
    maxReconnectAttempts,
  ])

  useEffect(() => {
    conectarRef.current = conectar
  }, [conectar])

  const desconectar = useCallback(() => {
    isManuallyClosedRef.current = true
    limparTimers()
    if (socketRef.current) {
      socketRef.current.onopen = null
      socketRef.current.onmessage = null
      socketRef.current.onerror = null
      socketRef.current.onclose = null
      socketRef.current.close()
      socketRef.current = null
    }
    atualizarStatus('OFFLINE')
  }, [limparTimers, atualizarStatus])

  const reconectar = useCallback(() => {
    reconnectAttemptRef.current = 0
    conectar()
  }, [conectar])

  useEffect(() => {
    conectar()

    return () => {
      isManuallyClosedRef.current = true
      limparTimers()
      if (socketRef.current) {
        socketRef.current.onopen = null
        socketRef.current.onmessage = null
        socketRef.current.onerror = null
        socketRef.current.onclose = null
        socketRef.current.close()
        socketRef.current = null
      }
    }
  }, [conectar, limparTimers])

  return {
    status,
    ultimoEvento,
    streamingPausado,
    togglePausa,
    reconectar,
    desconectar,
  }
}
