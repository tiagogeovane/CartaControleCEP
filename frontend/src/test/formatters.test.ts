import { describe, expect, it } from 'vitest'
import { formatarNomeCarta } from '../utils/formatters'

describe('formatarNomeCarta', () => {
  it('deve formatar carta padrão com ID completo no formato "TIPO_CARTA XXXX (n = Y)"', () => {
    const carta = {
      id: 'a8550df4-bdf3-457c-b48f-a2fc48581f62',
      tipo_carta: 'X_R',
      tamanho_subgrupo: 5,
    }
    expect(formatarNomeCarta(carta)).toBe('X_R a855 (n = 5)')
  })

  it('deve formatar corretamente carta I_MR com n=1', () => {
    const carta = {
      id: '3f2b1c4d-9999-0000-1111-222233334444',
      tipo_carta: 'I_MR',
      tamanho_subgrupo: 1,
    }
    expect(formatarNomeCarta(carta)).toBe('I_MR 3f2b (n = 1)')
  })

  it('deve formatar corretamente carta X_S com n=15', () => {
    const carta = {
      id: 'd9e8f7a6-1234-5678-9abc-def012345678',
      tipo_carta: 'X_S',
      tamanho_subgrupo: 15,
    }
    expect(formatarNomeCarta(carta)).toBe('X_S d9e8 (n = 15)')
  })

  it('deve utilizar fallback gracioso quando ID for indefinido ou vazio', () => {
    expect(formatarNomeCarta({ tipo_carta: 'X_R', tamanho_subgrupo: 5 })).toBe(
      'X_R (n = 5)'
    )
    expect(
      formatarNomeCarta({ id: '', tipo_carta: 'X_R', tamanho_subgrupo: 5 })
    ).toBe('X_R (n = 5)')
  })

  it('deve tratar objetos nulos ou indefinidos', () => {
    expect(formatarNomeCarta(null)).toBe('Carta N/A')
    expect(formatarNomeCarta(undefined)).toBe('Carta N/A')
  })
})
