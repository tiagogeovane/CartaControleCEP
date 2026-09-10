import { describe, expect, it } from 'vitest'
import type {
  CapacidadeResponse,
  CartaControleResponse,
  ProcessoResponse,
  SubgrupoResponse,
  TokenResponse,
} from '@/types/api'
import type {
  ConexaoEstabelecidaEvent,
  NovoSubgrupoProcessadoEvent,
} from '@/types/websocket'
import { REGRAS_NELSON_METADATA } from '@/types/cep'

describe('Fase 1 - Paridade Tipológica dos Schemas e Contratos', () => {
  it('deve aceitar payload real de ProcessoResponse do FastAPI', () => {
    const processoFixture: ProcessoResponse = {
      id: 'a1234567-89ab-cdef-0123-456789abcdef',
      nome: 'Usinagem de Virabrequins - Linha 1',
      codigo_linha: 'USIN-01',
      descricao: 'Usinagem CNC de precisão com tolerância micrométrica',
    }

    expect(processoFixture.id).toBeDefined()
    expect(processoFixture.codigo_linha).toBe('USIN-01')
  })

  it('deve aceitar payload real de TokenResponse do FastAPI', () => {
    const tokenFixture: TokenResponse = {
      access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      token_type: 'bearer',
      usuario: {
        id: 'usr-123',
        nome: 'Operador Fábrica',
        email: 'operador@industria.com',
        perfil: 'OPERADOR',
      },
    }

    expect(tokenFixture.token_type).toBe('bearer')
    expect(tokenFixture.usuario.perfil).toBe('OPERADOR')
  })

  it('deve aceitar payload real de CartaControleResponse do FastAPI', () => {
    const cartaFixture: CartaControleResponse = {
      id: 'e9b25fb4-c5a4-4a46-bdfa-bcfd35b91b93',
      processo_id: 'a1234567-89ab-cdef-0123-456789abcdef',
      tipo_carta: 'X_R',
      tamanho_subgrupo: 5,
      especificacoes: {
        lse: 26.5,
        lie: 23.5,
        valor_nominal: 25.0,
      },
      limites_atuais: {
        lc: 25.02,
        lsc: 25.78,
        lic: 24.26,
        sigma_estimado: 0.35,
      },
      modo_limites: 'DINAMICO',
      total_subgrupos: 30,
    }

    expect(cartaFixture.id).toBeDefined()
    expect(cartaFixture.limites_atuais?.sigma_estimado).toBe(0.35)
    expect(cartaFixture.especificacoes?.valor_nominal).toBe(25.0)
  })

  it('deve aceitar payload real de CapacidadeResponse do FastAPI', () => {
    const capacidadeFixture: CapacidadeResponse = {
      carta_id: 'e9b25fb4-c5a4-4a46-bdfa-bcfd35b91b93',
      processo_id: 'a1234567-89ab-cdef-0123-456789abcdef',
      tipo_carta: 'X_R',
      tamanho_subgrupo: 5,
      total_subgrupos: 25,
      amostra_estatisticamente_robusta: true,
      aviso: null,
      media_processo: 25.02,
      sigma_estimado: 0.35,
      especificacoes: {
        lse: 26.5,
        lie: 23.5,
        valor_nominal: 25.0,
      },
      limites_controle: {
        lc: 25.02,
        lsc: 25.78,
        lic: 24.26,
        sigma_estimado: 0.35,
      },
      indices: {
        cp: 1.4286,
        cpk: 1.4095,
        cpu: 1.4095,
        cpl: 1.4476,
      },
      aprovado: true,
      criterio_aprovacao: 1.33,
      classificacao: 'Excelente / Capaz',
    }

    expect(capacidadeFixture.indices.cpk).toBeGreaterThan(1.33)
    expect(capacidadeFixture.aprovado).toBe(true)
  })

  it('deve aceitar payload real de SubgrupoResponse com violações de Nelson', () => {
    const subgrupoFixture: SubgrupoResponse = {
      id: 'f1112223-3344-5566-7788-99aabbccddee',
      carta_id: 'e9b25fb4-c5a4-4a46-bdfa-bcfd35b91b93',
      numero_subgrupo: 26,
      timestamp: '2026-09-03T12:00:00Z',
      valores_brutos: [25.1, 25.5, 25.8, 25.2, 25.5],
      estatisticas: {
        media_x: 25.42,
        amplitude_r: 0.7,
        desvio_s: 0.28,
        valores_brutos: [25.1, 25.5, 25.8, 25.2, 25.5],
      },
      fora_de_controle: true,
      violacoes: [
        {
          codigo_regra: 'REGRA_1',
          descricao: 'Ponto além de 3 sigma',
          numero_subgrupo: 26,
          pontos_violadores: [25.42],
        },
      ],
    }

    expect(subgrupoFixture.fora_de_controle).toBe(true)
    expect(subgrupoFixture.violacoes[0].codigo_regra).toBe('REGRA_1')
  })

  it('deve aceitar evento de WebSocket CONEXAO_ESTABELECIDA', () => {
    const conexaoFixture: ConexaoEstabelecidaEvent = {
      event: 'CONEXAO_ESTABELECIDA',
      carta_id: 'e9b25fb4-c5a4-4a46-bdfa-bcfd35b91b93',
      status: 'online',
    }

    expect(conexaoFixture.event).toBe('CONEXAO_ESTABELECIDA')
    expect(conexaoFixture.status).toBe('online')
  })

  it('deve aceitar evento de WebSocket NOVO_SUBGRUPO_PROCESSADO', () => {
    const wsEventFixture: NovoSubgrupoProcessadoEvent = {
      event: 'NOVO_SUBGRUPO_PROCESSADO',
      carta_id: 'e9b25fb4-c5a4-4a46-bdfa-bcfd35b91b93',
      timestamp: '2026-09-03T12:00:00Z',
      numero_subgrupo: 27,
      estatisticas: {
        media_x: 25.12,
        amplitude_r: 0.45,
        desvio_s: 0.18,
        amostras_brutas: [25.0, 25.2, 25.1, 25.15, 25.15],
      },
      limites: {
        lc: 25.01,
        lsc: 25.75,
        lic: 24.27,
      },
      status_controle: {
        fora_de_controle: false,
        regras_violadas: [],
      },
      capacidade: {
        cp: 1.35,
        cpk: 1.28,
      },
    }

    expect(wsEventFixture.event).toBe('NOVO_SUBGRUPO_PROCESSADO')
    expect(wsEventFixture.numero_subgrupo).toBe(27)
  })

  it('deve possuir os metadados cadastrados para todas as 8 Regras de Nelson', () => {
    for (let i = 1; i <= 8; i++) {
      const codigo = `REGRA_${i}`
      expect(REGRAS_NELSON_METADATA[codigo]).toBeDefined()
      expect(REGRAS_NELSON_METADATA[codigo].nome).toBeTruthy()
      expect(REGRAS_NELSON_METADATA[codigo].descricao).toBeTruthy()
    }
  })
})
