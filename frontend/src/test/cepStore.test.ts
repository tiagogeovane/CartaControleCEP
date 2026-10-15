import { beforeEach, describe, expect, it } from 'vitest'
import { useCEPStore } from '@/stores/cepStore'
import type { SubgrupoResponse } from '@/types/api'
import type { NovoSubgrupoProcessadoEvent } from '@/types/websocket'

describe('Fase 1 - Store Zustand CEP (Buffer Deslizante e Estado Reativo)', () => {
  beforeEach(() => {
    const store = useCEPStore.getState()
    store.limparBuffer()
    store.limparAlarmes()
    store.setCartaAtiva(null)
    store.setLimiteBuffer(100)
    store.setStreamingPausado(false)
  })

  it('deve inicializar com valores padrão esperados', () => {
    const state = useCEPStore.getState()
    expect(state.cartaAtivaId).toBeNull()
    expect(state.subgruposHistorico).toHaveLength(0)
    expect(state.limiteBuffer).toBe(100)
    expect(state.streamingPausado).toBe(false)
    expect(state.statusConexao).toBe('OFFLINE')
    expect(state.alarmesAtivos).toHaveLength(0)
  })

  it('deve limitar o buffer deslizante estritamente ao tamanho configurado (150 itens em limite 100)', () => {
    const store = useCEPStore.getState()
    store.setLimiteBuffer(100)

    // Inserir 150 subgrupos sequenciais
    for (let i = 1; i <= 150; i++) {
      const subgrupo: SubgrupoResponse = {
        id: `sg-${i}`,
        carta_id: 'carta-test-id',
        numero_subgrupo: i,
        timestamp: new Date().toISOString(),
        valores_brutos: [25.0, 25.1, 24.9, 25.2, 25.0],
        estatisticas: {
          media_x: 25.04,
          amplitude_r: 0.3,
          desvio_s: 0.11,
          valores_brutos: [25.0, 25.1, 24.9, 25.2, 25.0],
        },
        fora_de_controle: false,
        violacoes: [],
      }
      useCEPStore.getState().adicionarSubgrupo(subgrupo)
    }

    const finalState = useCEPStore.getState()
    // Deve manter exatamente 100 itens
    expect(finalState.subgruposHistorico).toHaveLength(100)

    // O primeiro item do buffer deve ser o subgrupo 51
    expect(finalState.subgruposHistorico[0].numero_subgrupo).toBe(51)
    // O último item do buffer deve ser o subgrupo 150
    expect(finalState.subgruposHistorico[99].numero_subgrupo).toBe(150)
    expect(finalState.ultimoSubgrupo?.numero_subgrupo).toBe(150)
  })

  it('deve converter e normalizar automaticamente eventos NovoSubgrupoProcessadoEvent', () => {
    const wsEvent: NovoSubgrupoProcessadoEvent = {
      event: 'NOVO_SUBGRUPO_PROCESSADO',
      carta_id: 'carta-uuid-1',
      timestamp: '2026-09-03T14:30:00Z',
      numero_subgrupo: 42,
      estatisticas: {
        media_x: 26.55,
        amplitude_r: 0.88,
        desvio_s: 0.35,
        amostras_brutas: [26.2, 26.8, 26.5, 26.4, 26.9],
      },
      limites: {
        lc: 25.0,
        lsc: 25.75,
        lic: 24.25,
      },
      status_controle: {
        fora_de_controle: true,
        regras_violadas: [
          {
            codigo_regra: 'REGRA_1',
            descricao: 'Ponto fora dos limites de controle',
            numero_subgrupo: 42,
            pontos_violadores: [26.55],
          },
        ],
      },
    }

    useCEPStore.getState().adicionarSubgrupo(wsEvent)

    const state = useCEPStore.getState()
    expect(state.subgruposHistorico).toHaveLength(1)
    const sg = state.subgruposHistorico[0]
    expect(sg.numero_subgrupo).toBe(42)
    expect(sg.fora_de_controle).toBe(true)
    expect(sg.estatisticas.media_x).toBe(26.55)
    expect(sg.violacoes).toHaveLength(1)

    // Deve registrar o alarme ativo
    expect(state.alarmesAtivos).toHaveLength(1)
    expect(state.alarmesAtivos[0].subgrupoNumero).toBe(42)
    expect(state.alarmesAtivos[0].violacoes[0].codigo_regra).toBe('REGRA_1')
  })

  it('deve alternar e configurar o estado de pausa do streaming', () => {
    const store = useCEPStore.getState()
    expect(store.streamingPausado).toBe(false)

    store.togglePausaStreaming()
    expect(useCEPStore.getState().streamingPausado).toBe(true)

    store.togglePausaStreaming()
    expect(useCEPStore.getState().streamingPausado).toBe(false)

    store.setStreamingPausado(true)
    expect(useCEPStore.getState().streamingPausado).toBe(true)
  })

  it('deve atualizar limites dinâmicos da carta ativa ao receber evento com limites', () => {
    const store = useCEPStore.getState()
    store.setCartaAtiva({
      id: 'carta-123',
      processo_id: 'proc-123',
      tipo_carta: 'X_R',
      tamanho_subgrupo: 5,
      especificacoes: null,
      limites_atuais: {
        lc: 25.0,
        lsc: 25.8,
        lic: 24.2,
        sigma_estimado: 0.3,
      },
      modo_limites: 'DINAMICO',
      total_subgrupos: 10,
    })

    const wsEvent: NovoSubgrupoProcessadoEvent = {
      event: 'NOVO_SUBGRUPO_PROCESSADO',
      carta_id: 'carta-123',
      timestamp: '2026-09-03T15:00:00Z',
      numero_subgrupo: 11,
      estatisticas: {
        media_x: 25.2,
        amplitude_r: 0.4,
        desvio_s: 0.15,
        amostras_brutas: [25.1, 25.3, 25.2, 25.2, 25.2],
      },
      limites: {
        lc: 25.05,
        lsc: 25.85,
        lic: 24.25,
        sigma_estimado: 0.32,
      },
      status_controle: {
        fora_de_controle: false,
        regras_violadas: [],
      },
    }

    useCEPStore.getState().adicionarSubgrupo(wsEvent)

    const updatedCarta = useCEPStore.getState().cartaDetalhes
    expect(updatedCarta?.limites_atuais?.lc).toBe(25.05)
    expect(updatedCarta?.limites_atuais?.lsc).toBe(25.85)
    expect(updatedCarta?.limites_atuais?.sigma_estimado).toBe(0.32)
    expect(updatedCarta?.total_subgrupos).toBe(11)
  })

  it('deve inicializar cartaDetalhes se for nula ao receber evento com limites', () => {
    useCEPStore.setState({ cartaDetalhes: null })

    const wsEvent: NovoSubgrupoProcessadoEvent = {
      event: 'NOVO_SUBGRUPO_PROCESSADO',
      carta_id: 'carta-999',
      timestamp: '2026-09-03T15:05:00Z',
      numero_subgrupo: 20,
      estatisticas: {
        media_x: 4.0,
        amplitude_r: 2.0,
        desvio_s: 1.0,
        amostras_brutas: [4.0],
      },
      limites: {
        lc: 4.0,
        lsc: 10.0,
        lic: 0.0,
        sigma_estimado: 2.0,
      },
      status_controle: {
        fora_de_controle: false,
        regras_violadas: [],
      },
    }

    useCEPStore.getState().adicionarSubgrupo(wsEvent)

    const carta = useCEPStore.getState().cartaDetalhes
    expect(carta).not.toBeNull()
    expect(carta?.id).toBe('carta-999')
    expect(carta?.limites_atuais?.lc).toBe(4.0)
    expect(carta?.limites_atuais?.lsc).toBe(10.0)
    expect(carta?.limites_atuais?.sigma_estimado).toBe(2.0)
    expect(carta?.total_subgrupos).toBe(20)
  })
})
