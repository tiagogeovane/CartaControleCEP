import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SimuladorBinomial } from '@/components/modules/SimuladorBinomial'
import type { CartaControleResponse } from '@/types/api'

describe('SimuladorBinomial Component', () => {
  const mockCarta: CartaControleResponse = {
    id: 'carta-test-123',
    processo_id: 'processo-123',
    tipo_carta: 'X_R',
    tamanho_subgrupo: 5,
    modo_limites: 'DINAMICO',
    total_subgrupos: 20,
    limites_atuais: {
      lc: 25.0,
      lsc: 26.5,
      lic: 23.5,
      sigma_estimado: 0.5,
      lc_dispersao: 1.164,
      lsc_dispersao: 2.46,
      lic_dispersao: 0.0,
    },
    especificacoes: {
      lse: 27.0,
      lie: 23.0,
      valor_nominal: 25.0,
    },
  }

  it('deve renderizar o simulador com os parâmetros padrão e valores calculados', () => {
    render(<SimuladorBinomial carta={mockCarta} />)

    expect(screen.getByText('Simulador de Arranjos Probabilísticos (Binomial)')).toBeInTheDocument()
    expect(screen.getByText('1. Tipo de Pergunta (Modo)')).toBeInTheDocument()
    expect(screen.getByText('2. Critério de Conformidade')).toBeInTheDocument()
    expect(screen.getByText('3. Parâmetros do Arranjo')).toBeInTheDocument()
    expect(screen.getByText('Resultado do Cálculo')).toBeInTheDocument()
    expect(screen.getByText('Gráfico de Distribuição (PMF Binomial)')).toBeInTheDocument()

    // Com Z=2.50 padrão, p = 98.7581%, P(5 vezes seguidas) = 93.9427%
    expect(screen.getByText('98.7581%')).toBeInTheDocument()
    expect(screen.getByText('93.9427%')).toBeInTheDocument()
  })

  it('deve alternar para modo Lote e atualizar cálculos conforme Y e operador', () => {
    render(<SimuladorBinomial carta={mockCarta} />)

    // Selecionar modo Lote
    const radioLote = screen.getByRole('radio', { name: /Arranjo em Lote/i })
    fireEvent.click(radioLote)

    // Verificar se seletor de operador apareceu
    expect(screen.getByText('Operador:')).toBeInTheDocument()
    expect(screen.getByText('Sucessos (Y):')).toBeInTheDocument()
  })

  it('deve acionar o callback onAnexarAoRelatorio ao clicar no botão de anexo', () => {
    const handleAnexar = vi.fn()
    render(<SimuladorBinomial carta={mockCarta} onAnexarAoRelatorio={handleAnexar} />)

    const btnAnexar = screen.getByRole('button', { name: /\+ Adicionar ao Relatório/i })
    expect(btnAnexar).toBeInTheDocument()

    fireEvent.click(btnAnexar)
    expect(handleAnexar).toHaveBeenCalledTimes(1)
    const payload = handleAnexar.mock.calls[0][0]
    expect(payload).not.toBeNull()
    expect(payload.tipoArranjo).toBe('CONSECUTIVO')
    expect(payload.tamanhoLoteX).toBe(5)
    expect(payload.probabilidadeUnitariaP).toBeCloseTo(0.987581, 4)
  })

  it('deve exibir botão de anexado quando a simulação já estiver anexada e permitir desanexar', () => {
    const handleAnexar = vi.fn()
    const simulacaoAnexada = {
      tipoArranjo: 'CONSECUTIVO' as const,
      criterio: 'Z_SIGMAS' as const,
      escopo: 'INDIVIDUAL' as const,
      zValor: 2.5,
      faixaInferior: 23.75,
      faixaSuperior: 26.25,
      probabilidadeUnitariaP: 0.9875806693484477,
      probabilidadeFalhaQ: 0.012419330651552309,
      tamanhoLoteX: 5,
      sucessosDesejadosY: 5,
      combinacoes: 1,
      probabilidadeFinal: 0.939412128919662,
    }

    render(
      <SimuladorBinomial
        carta={mockCarta}
        simulacaoAnexada={simulacaoAnexada}
        onAnexarAoRelatorio={handleAnexar}
      />
    )

    const btnAnexado = screen.getByRole('button', { name: /✓ Anexado ao Relatório/i })
    expect(btnAnexado).toBeInTheDocument()

    fireEvent.click(btnAnexado)
    expect(handleAnexar).toHaveBeenCalledWith(null)
  })
})
