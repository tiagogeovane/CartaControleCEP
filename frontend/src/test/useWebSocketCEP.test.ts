import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useWebSocketCEP } from '@/hooks/useWebSocketCEP'
import { useCEPStore } from '@/stores/cepStore'
import type { NovoSubgrupoProcessadoEvent } from '@/types/websocket'

// Mock simples e robusto da API nativa WebSocket do navegador
class MockWebSocket {
  static instances: MockWebSocket[] = []
  url: string
  readyState: number = 0 // 0 = CONNECTING, 1 = OPEN, 2 = CLOSING, 3 = CLOSED
  onopen: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onerror: ((error: any) => void) | null = null
  onclose: (() => void) | null = null
  sentMessages: string[] = []

  constructor(url: string) {
    this.url = url
    this.readyState = 0 // CONNECTING
    MockWebSocket.instances.push(this)
  }

  send(data: string) {
    this.sentMessages.push(data)
  }

  close() {
    this.readyState = 3 // CLOSED
    if (this.onclose) {
      this.onclose()
    }
  }

  // Métodos auxiliares para acionar eventos durante os testes
  triggerOpen() {
    this.readyState = 1 // OPEN
    this.onopen?.()
  }

  triggerMessage(data: any) {
    const payload = typeof data === 'string' ? data : JSON.stringify(data)
    this.onmessage?.({ data: payload })
  }

  triggerClose() {
    this.readyState = 3 // CLOSED
    this.onclose?.()
  }
}

describe('Fase 1 - Hook useWebSocketCEP e Reconexão por Exponential Backoff', () => {
  const originalWebSocket = globalThis.WebSocket

  beforeEach(() => {
    vi.useFakeTimers()
    MockWebSocket.instances = []
    // Define o mock no escopo global
    // @ts-ignore
    globalThis.WebSocket = MockWebSocket as any
    // Mock de WebSocket.OPEN
    // @ts-ignore
    globalThis.WebSocket.OPEN = 1

    useCEPStore.getState().limparBuffer()
    useCEPStore.getState().limparAlarmes()
    useCEPStore.getState().setStatusConexao('OFFLINE')
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    globalThis.WebSocket = originalWebSocket
  })

  it('deve inicializar conexão e definir status CONNECTING', () => {
    const { result } = renderHook(() => useWebSocketCEP('carta-123'))

    expect(MockWebSocket.instances).toHaveLength(1)
    expect(MockWebSocket.instances[0].url).toContain('/ws/cartas/carta-123')
    expect(result.current.status).toBe('CONNECTING')
    expect(useCEPStore.getState().statusConexao).toBe('CONNECTING')
  })

  it('deve transicionar para ONLINE após handshake CONEXAO_ESTABELECIDA', () => {
    const { result } = renderHook(() => useWebSocketCEP('carta-123'))
    const ws = MockWebSocket.instances[0]

    act(() => {
      ws.triggerOpen()
      ws.triggerMessage({
        event: 'CONEXAO_ESTABELECIDA',
        carta_id: 'carta-123',
        status: 'online',
      })
    })

    expect(result.current.status).toBe('ONLINE')
    expect(useCEPStore.getState().statusConexao).toBe('ONLINE')
  })

  it('deve despachar NOVO_SUBGRUPO_PROCESSADO diretamente para a store cepStore', () => {
    const { result } = renderHook(() => useWebSocketCEP('carta-123'))
    const ws = MockWebSocket.instances[0]

    act(() => {
      ws.triggerOpen()
      ws.triggerMessage({
        event: 'CONEXAO_ESTABELECIDA',
        carta_id: 'carta-123',
        status: 'online',
      })
    })

    const novoSubgrupoEvent: NovoSubgrupoProcessadoEvent = {
      event: 'NOVO_SUBGRUPO_PROCESSADO',
      carta_id: 'carta-123',
      timestamp: '2026-09-03T12:00:00Z',
      numero_subgrupo: 1,
      estatisticas: {
        media_x: 25.1,
        amplitude_r: 0.5,
        desvio_s: 0.2,
        amostras_brutas: [25.0, 25.1, 25.2],
      },
      limites: {
        lc: 25.0,
        lsc: 25.8,
        lic: 24.2,
      },
      status_controle: {
        fora_de_controle: false,
        regras_violadas: [],
      },
    }

    act(() => {
      ws.triggerMessage(novoSubgrupoEvent)
    })

    expect(result.current.ultimoEvento).toEqual(novoSubgrupoEvent)
    const storeState = useCEPStore.getState()
    expect(storeState.subgruposHistorico).toHaveLength(1)
    expect(storeState.subgruposHistorico[0].numero_subgrupo).toBe(1)
  })

  it('deve enviar heartbeat periódico (ping) para manter conexão viva', () => {
    renderHook(() => useWebSocketCEP('carta-123', { heartbeatIntervalMs: 10000 }))
    const ws = MockWebSocket.instances[0]

    act(() => {
      ws.triggerOpen()
    })

    expect(ws.sentMessages).toHaveLength(0)

    // Avança 10 segundos
    act(() => {
      vi.advanceTimersByTime(10000)
    })

    expect(ws.sentMessages).toHaveLength(1)
    expect(JSON.parse(ws.sentMessages[0])).toEqual({ type: 'ping' })

    // Avança mais 10 segundos
    act(() => {
      vi.advanceTimersByTime(10000)
    })

    expect(ws.sentMessages).toHaveLength(2)
  })

  it('deve disparar reconexão com Exponential Backoff progressivo em quedas inesperadas', () => {
    const { result } = renderHook(() =>
      useWebSocketCEP('carta-123', { autoReconnect: true, maxReconnectAttempts: 5 })
    )

    const ws1 = MockWebSocket.instances[0]
    act(() => {
      ws1.triggerOpen()
      ws1.triggerMessage({
        event: 'CONEXAO_ESTABELECIDA',
        carta_id: 'carta-123',
        status: 'online',
      })
    })
    expect(result.current.status).toBe('ONLINE')

    // 1ª Queda inesperada (queda do socket)
    act(() => {
      ws1.triggerClose()
    })

    // Status deve mudar imediatamente para RECONNECTING
    expect(result.current.status).toBe('RECONNECTING')

    // 1ª tentativa: delay = 1000 * 2^0 = 1000ms
    act(() => {
      vi.advanceTimersByTime(999)
    })
    // Ainda não deve ter criado nova instância
    expect(MockWebSocket.instances).toHaveLength(1)

    act(() => {
      vi.advanceTimersByTime(1)
    })
    // Nova instância criada (2ª conexão)
    expect(MockWebSocket.instances).toHaveLength(2)

    // 2ª Queda
    const ws2 = MockWebSocket.instances[1]
    act(() => {
      ws2.triggerClose()
    })
    expect(result.current.status).toBe('RECONNECTING')

    // 2ª tentativa: delay = 1000 * 2^1 = 2000ms
    act(() => {
      vi.advanceTimersByTime(1999)
    })
    expect(MockWebSocket.instances).toHaveLength(2)

    act(() => {
      vi.advanceTimersByTime(1)
    })
    // 3ª conexão criada
    expect(MockWebSocket.instances).toHaveLength(3)

    // 3ª Queda
    const ws3 = MockWebSocket.instances[2]
    act(() => {
      ws3.triggerClose()
    })

    // 3ª tentativa: delay = 1000 * 2^2 = 4000ms
    act(() => {
      vi.advanceTimersByTime(3999)
    })
    expect(MockWebSocket.instances).toHaveLength(3)

    act(() => {
      vi.advanceTimersByTime(1)
    })
    // 4ª conexão criada
    expect(MockWebSocket.instances).toHaveLength(4)

    // Reconecta com sucesso
    const ws4 = MockWebSocket.instances[3]
    act(() => {
      ws4.triggerOpen()
      ws4.triggerMessage({
        event: 'CONEXAO_ESTABELECIDA',
        carta_id: 'carta-123',
        status: 'online',
      })
    })

    expect(result.current.status).toBe('ONLINE')
  })

  it('não deve tentar reconectar se o usuário chamar desconectar() explicitamente', () => {
    const { result } = renderHook(() => useWebSocketCEP('carta-123'))
    const ws = MockWebSocket.instances[0]

    act(() => {
      ws.triggerOpen()
    })

    act(() => {
      result.current.desconectar()
    })

    expect(result.current.status).toBe('OFFLINE')

    // Avança o tempo
    act(() => {
      vi.advanceTimersByTime(30000)
    })

    // Não deve ter criado novas instâncias
    expect(MockWebSocket.instances).toHaveLength(1)
  })
})
