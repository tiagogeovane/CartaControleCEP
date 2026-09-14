import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  BaseChart,
  CartaControleContainer,
  CartaIMRChart,
  CartaXRChart,
  CartaXSChart,
  ControlesCarta,
  buildChartOptionGenerico,
  buildIMRChartOption,
  buildXRChartOption,
  buildXSChartOption,
  gerarTooltipHTML,
} from '@/components/charts'
import type { BaseChartRef } from '@/components/charts/BaseChart'
import type { SubgrupoResponse } from '@/types/api'
import {
  calcularLimitesAmplitudeMovelMR,
  calcularLimitesAmplitudeR,
  calcularLimitesDesvioS,
  obterConstantesXR,
  obterConstantesXS,
} from '@/utils/cepConstants'
import { useCEPStore } from '@/stores/cepStore'
import { useEffect, useRef } from 'react'

// =========================================================================
// Mocks e Helpers de Apoio
// =========================================================================

function criarSubgrupoMock(
  numero: number,
  media: number,
  r: number,
  valores: number[] = [media],
  foraDeControle = false,
  violacoes: Array<{ codigo_regra: string; descricao: string; numero_subgrupo: number; pontos_violadores: number[] }> = []
): SubgrupoResponse {
  return {
    id: `sg-${numero}`,
    carta_id: 'carta-test-01',
    numero_subgrupo: numero,
    timestamp: new Date(2026, 8, 10, 10, numero, 0).toISOString(),
    valores_brutos: valores,
    estatisticas: {
      media_x: media,
      amplitude_r: r,
      desvio_s: r / 2.326,
      valores_brutos: valores,
    },
    fora_de_controle: foraDeControle,
    violacoes,
  }
}

describe('Fase 3 - Motor Gráfico de Cartas CEP (Apache ECharts)', () => {
  // =======================================================================
  // 1. Constantes Estatísticas Tabeladas (Montgomery)
  // =======================================================================
  describe('Constantes Tabeladas de CEP (Montgomery)', () => {
    it('deve retornar constantes corretas para Carta X-R (n = 2 a 10)', () => {
      const n5 = obterConstantesXR(5)
      expect(n5.a2).toBe(0.577)
      expect(n5.d2).toBe(2.326)
      expect(n5.d3).toBe(0.0)
      expect(n5.d4).toBe(2.114)

      const n3 = obterConstantesXR(3)
      expect(n3.a2).toBe(1.023)
      expect(n3.d4).toBe(2.574)

      const n10 = obterConstantesXR(10)
      expect(n10.a2).toBe(0.308)
      expect(n10.d3).toBe(0.223)
      expect(n10.d4).toBe(1.777)
    })

    it('deve retornar constantes para Carta X-s (n > 10)', () => {
      const n12 = obterConstantesXS(12)
      expect(n12.a3).toBe(0.886)
      expect(n12.b3).toBe(0.354)
      expect(n12.b4).toBe(1.646)
      expect(n12.c4).toBe(0.9776)
    })

    it('deve calcular limites de dispersão para R, s e MR com precisão', () => {
      // n=5, R_barra = 0.0325 -> LSC_R = 2.114 * 0.0325 = 0.068705, LIC_R = 0
      const limR = calcularLimitesAmplitudeR(0.0325, 5)
      expect(Math.abs(limR.lsc - 0.0687)).toBeLessThan(0.001)
      expect(limR.lc).toBe(0.0325)
      expect(limR.lic).toBe(0.0)

      // s_barra = 1.25, n=12 -> b3=0.354, b4=1.646
      const limS = calcularLimitesDesvioS(1.25, 12)
      expect(limS.lic).toBe(Number((0.354 * 1.25).toFixed(4)))
      expect(limS.lsc).toBe(Number((1.646 * 1.25).toFixed(4)))

      // MR_barra = 0.5 -> LSC_MR = 3.267 * 0.5 = 1.6335, LIC_MR = 0
      const limMR = calcularLimitesAmplitudeMovelMR(0.5)
      expect(limMR.lic).toBe(0)
      expect(limMR.lc).toBe(0.5)
      expect(Math.abs(limMR.lsc - 1.6335)).toBeLessThan(0.001)
    })
  })

  // =======================================================================
  // 2. Métrica Verificável 1: Fidelidade Numérica com Dataset de Montgomery
  // =======================================================================
  describe('Métrica 1: Fidelidade Numérica vs Dataset Montgomery (Erro < 0.001)', () => {
    it('deve calcular e plotar coordenadas de LC, LSC e LIC com erro < 0.001 para Carta X-R (Exemplo 6.1)', () => {
      // Exemplo Montgomery 6.1:
      // x_dupla_barra = 1.5056, R_barra = 0.0325, n = 5
      // A2 = 0.577, D3 = 0, D4 = 2.114
      // Esperado: LSC = 1.5244, LIC = 1.4869, LC = 1.5056
      // Esperado R: LSC_R = 0.0687, LIC_R = 0.0, LC_R = 0.0325
      const subgrupos = [
        criarSubgrupoMock(1, 1.5056, 0.0325, [1.50, 1.52, 1.49, 1.51, 1.53]),
      ]

      const options = buildXRChartOption({
        subgrupos,
        tamanhoSubgrupo: 5,
        limites: {
          lc: 1.5056,
          lsc: 1.5244,
          lic: 1.4869,
          sigma_estimado: 0.014,
        },
      })

      // Série 0 = Média (X̄)
      const serieMedia = (options.series as any[])[0]
      const markLinesMedia = serieMedia.markLine.data

      const markLC = markLinesMedia.find((m: any) => m.name === 'LC')
      const markLSC = markLinesMedia.find((m: any) => m.name === 'LSC')
      const markLIC = markLinesMedia.find((m: any) => m.name === 'LIC')

      expect(Math.abs(markLC.yAxis - 1.5056)).toBeLessThan(0.001)
      expect(Math.abs(markLSC.yAxis - 1.5244)).toBeLessThan(0.001)
      expect(Math.abs(markLIC.yAxis - 1.4869)).toBeLessThan(0.001)

      // Série 2 = Dispersão (Amplitude R)
      const serieDispersao = (options.series as any[])[2]
      const markLinesDisp = serieDispersao.markLine.data

      const markLCR = markLinesDisp.find((m: any) => m.name === 'LC')
      const markLSCR = markLinesDisp.find((m: any) => m.name === 'LSC')
      const markLICR = markLinesDisp.find((m: any) => m.name === 'LIC')

      expect(Math.abs(markLCR.yAxis - 0.0325)).toBeLessThan(0.001)
      expect(Math.abs(markLSCR.yAxis - 0.0687)).toBeLessThan(0.001)
      expect(markLICR.yAxis).toBe(0.0)
    })

    it('deve calcular limites matemáticos corretos via fallback quando limites backend forem omitidos', () => {
      const subgrupos = [
        criarSubgrupoMock(1, 1.5056, 0.0325),
      ]

      const options = buildXRChartOption({
        subgrupos,
        tamanhoSubgrupo: 5,
        limites: null, // Sem limites explícitos
      })

      const serieMedia = (options.series as any[])[0]
      const markLines = serieMedia.markLine.data

      const markLSC = markLines.find((m: any) => m.name === 'LSC')
      const markLIC = markLines.find((m: any) => m.name === 'LIC')

      // 1.5056 + 0.577 * 0.0325 = 1.52435
      expect(Math.abs(markLSC.yAxis - 1.5244)).toBeLessThan(0.001)
      // 1.5056 - 0.577 * 0.0325 = 1.48685
      expect(Math.abs(markLIC.yAxis - 1.4869)).toBeLessThan(0.001)
    })

    it('deve incluir limites de engenharia (LSE / LIE) quando fornecidos nas especificações', () => {
      const subgrupos = [criarSubgrupoMock(1, 10.0, 0.5)]
      const options = buildXRChartOption({
        subgrupos,
        tamanhoSubgrupo: 5,
        especificacoes: {
          lse: 12.0,
          lie: 8.0,
          valor_nominal: 10.0,
        },
      })

      const serieMedia = (options.series as any[])[0]
      const markLines = serieMedia.markLine.data

      const markLSE = markLines.find((m: any) => m.name === 'LSE')
      const markLIE = markLines.find((m: any) => m.name === 'LIE')

      expect(markLSE).toBeDefined()
      expect(markLSE.yAxis).toBe(12.0)
      expect(markLIE).toBeDefined()
      expect(markLIE.yAxis).toBe(8.0)
    })
  })

  // =======================================================================
  // 3. Métrica Verificável 2: Identificação Visual das Regras de Nelson
  // =======================================================================
  describe('Métrica 2: Identificação Visual das Regras de Nelson e Efeito Pulsante', () => {
    it('deve identificar violações da Regra 1 (além de 3 sigma), Regra 2 (9 mesmo lado) e Regra 3 (tendência 6 pontos)', () => {
      const subgrupos: SubgrupoResponse[] = [
        criarSubgrupoMock(1, 10.0, 0.5),
        criarSubgrupoMock(2, 14.5, 0.8, [14.5], true, [
          {
            codigo_regra: 'REGRA_1',
            descricao: 'Ponto além de 3 sigma (14.5 > LSC 13.0)',
            numero_subgrupo: 2,
            pontos_violadores: [14.5],
          },
        ]),
        criarSubgrupoMock(3, 10.2, 0.4),
        criarSubgrupoMock(4, 11.2, 0.6, [11.2], true, [
          {
            codigo_regra: 'REGRA_2',
            descricao: '9 pontos consecutivos acima da média',
            numero_subgrupo: 4,
            pontos_violadores: [10.5, 10.8, 11.0, 11.2],
          },
        ]),
        criarSubgrupoMock(5, 12.0, 0.5, [12.0], true, [
          {
            codigo_regra: 'REGRA_3',
            descricao: '6 pontos em tendência ascendente contínua',
            numero_subgrupo: 5,
            pontos_violadores: [9.0, 9.5, 10.0, 10.5, 11.0, 12.0],
          },
        ]),
      ]

      const options = buildXRChartOption({
        subgrupos,
        tamanhoSubgrupo: 5,
        limites: { lc: 10.0, lsc: 13.0, lic: 7.0, sigma_estimado: 1.0 },
      })

      // Série 1 é o effectScatter reservado para anomalias
      const serieAnomalias = (options.series as any[])[1]
      expect(serieAnomalias.type).toBe('effectScatter')
      expect(serieAnomalias.itemStyle.color).toBe('#EF4444')
      expect(serieAnomalias.rippleEffect.scale).toBe(3)

      // Deve conter exatamente os índices dos 3 subgrupos com anomalia: #2 (idx 1), #4 (idx 3), #5 (idx 4)
      const anomaliasData = serieAnomalias.data
      expect(anomaliasData).toHaveLength(3)
      expect(anomaliasData[0]).toEqual([1, 14.5])
      expect(anomaliasData[1]).toEqual([3, 11.2])
      expect(anomaliasData[2]).toEqual([4, 12.0])
    })

    it('deve gerar tooltip formatado com os metadados oficiais das regras de Nelson', () => {
      const sgViolador = criarSubgrupoMock(15, 16.2, 0.9, [16.1, 16.3], true, [
        {
          codigo_regra: 'REGRA_1',
          descricao: '1 ponto além de 3 sigma',
          numero_subgrupo: 15,
          pontos_violadores: [16.2],
        },
      ])

      const html = gerarTooltipHTML(sgViolador, 'Amplitude (R)', 0.9)

      expect(html).toContain('Subgrupo #15')
      expect(html).toContain('16.2000')
      expect(html).toContain('Amplitude (R)')
      expect(html).toContain('🚨 ANOMALIA DETECTADA')
      expect(html).toContain('1 Ponto Além de 3 Sigma')
      expect(html).toContain('1 ponto além de 3 sigma')
    })
  })

  // =======================================================================
  // 4. Cartas Específicas: X̄-s e I-MR
  // =======================================================================
  describe('Cartas Especializadas: X̄-s e I-MR', () => {
    it('deve configurar Carta X̄-s com dispersão baseada no desvio padrão (s)', () => {
      const subgrupos = [
        criarSubgrupoMock(1, 50.0, 1.2),
        criarSubgrupoMock(2, 51.5, 1.4),
      ]

      const options = buildXSChartOption({
        subgrupos,
        tamanhoSubgrupo: 15,
      })

      expect((options.series as any[])[2].name).toBe('Desvio Padrão (s)')
      expect((options.yAxis as any[])[1].name).toBe('Desvio Padrão (s)')
    })

    it('deve configurar Carta I-MR com Amplitude Móvel calculada entre observações sucessivas', () => {
      // Três leituras individuais: X1 = 10.0, X2 = 12.0, X3 = 11.0
      // MR2 = |12.0 - 10.0| = 2.0
      // MR3 = |11.0 - 12.0| = 1.0
      const subgrupos = [
        criarSubgrupoMock(1, 10.0, 0.0, [10.0]),
        criarSubgrupoMock(2, 12.0, 0.0, [12.0]),
        criarSubgrupoMock(3, 11.0, 0.0, [11.0]),
      ]

      const options = buildIMRChartOption({
        subgrupos,
        tamanhoSubgrupo: 1,
      })

      const serieMR = (options.series as any[])[2]
      expect(serieMR.name).toBe('Amplitude Móvel (MR)')
      // Valores de MR plotados: [0, 2.0, 1.0]
      expect(serieMR.data[0]).toBe(0)
      expect(serieMR.data[1]).toBe(2.0)
      expect(serieMR.data[2]).toBe(1.0)
    })

    it('deve renderizar CartaXRChart isoladamente', () => {
      render(
        <CartaXRChart
          subgrupos={[criarSubgrupoMock(1, 10, 0.5)]}
          tamanhoSubgrupo={5}
        />
      )
      expect(screen.getByTestId('carta-xr-chart')).toBeInTheDocument()
    })

    it('deve renderizar CartaXSChart isoladamente', () => {
      render(
        <CartaXSChart
          subgrupos={[criarSubgrupoMock(1, 10, 0.5)]}
          tamanhoSubgrupo={15}
        />
      )
      expect(screen.getByTestId('carta-xs-chart')).toBeInTheDocument()
    })

    it('deve renderizar CartaIMRChart isoladamente', () => {
      render(
        <CartaIMRChart
          subgrupos={[criarSubgrupoMock(1, 10, 0.0)]}
          tamanhoSubgrupo={1}
        />
      )
      expect(screen.getByTestId('carta-imr-chart')).toBeInTheDocument()
    })

    it('deve permitir construção customizada de opções via buildChartOptionGenerico', () => {
      const customOption = buildChartOptionGenerico(
        {
          subgrupos: [criarSubgrupoMock(1, 10, 2)],
          tamanhoSubgrupo: 5,
        },
        {
          tituloDispersao: 'Custom Disp',
          nomeMetrica: 'Custom',
          extrairValor: () => 1,
          calcularLimites: () => ({ lc: 1, lsc: 2, lic: 0 }),
        }
      )
      expect(customOption.series).toHaveLength(3)
    })
  })

  // =======================================================================
  // 5. Métrica Verificável 3: Fluidez de Redimensionamento (< 100 ms)
  // =======================================================================
  describe('Métrica 3: Fluidez de Redimensionamento (< 100 ms)', () => {
    it('deve invocar resize da instância em tempo inferior a 100 ms', () => {
      let resizeFn: (() => void) | null = null

      function TestComponent() {
        const chartRef = useRef<BaseChartRef>(null)
        useEffect(() => {
          resizeFn = () => chartRef.current?.resize()
        }, [])
        return (
          <BaseChart
            ref={chartRef}
            option={{ series: [] }}
            height={400}
          />
        )
      }

      render(<TestComponent />)

      expect(resizeFn).not.toBeNull()

      const inicio = performance.now()
      resizeFn!()
      const duracao = performance.now() - inicio

      expect(duracao).toBeLessThan(100)
    })
  })

  // =======================================================================
  // 6. Controles Interativos da Carta e Exportação PNG
  // =======================================================================
  describe('Controles Interativos da Carta (ControlesCarta)', () => {
    it('deve disparar callbacks de troca de janela, pausa e exportação', () => {
      const onSelectJanela = vi.fn()
      const onTogglePausa = vi.fn()
      const onExportarPNG = vi.fn()

      const { rerender } = render(
        <ControlesCarta
          janelaSelecionada={30}
          onSelectJanela={onSelectJanela}
          streamingPausado={false}
          onTogglePausa={onTogglePausa}
          onExportarPNG={onExportarPNG}
          totalSubgrupos={85}
        />
      )

      expect(screen.getByText('(85 subgrupos)')).toBeInTheDocument()

      // Troca de janela para 50 pts
      const btn50 = screen.getByText('50 pts')
      fireEvent.click(btn50)
      expect(onSelectJanela).toHaveBeenCalledWith(50)

      // Clique em Congelar
      const btnCongelar = screen.getByText('Congelar')
      fireEvent.click(btnCongelar)
      expect(onTogglePausa).toHaveBeenCalledTimes(1)

      // Re-renderizar como pausado -> deve exibir "Retomar"
      rerender(
        <ControlesCarta
          janelaSelecionada={50}
          onSelectJanela={onSelectJanela}
          streamingPausado={true}
          onTogglePausa={onTogglePausa}
          onExportarPNG={onExportarPNG}
          totalSubgrupos={85}
        />
      )
      expect(screen.getByText('Retomar')).toBeInTheDocument()

      // Clique em Exportar PNG
      const btnExportar = screen.getByText('Exportar PNG')
      fireEvent.click(btnExportar)
      expect(onExportarPNG).toHaveBeenCalledTimes(1)
    })
  })

  // =======================================================================
  // 7. Container Orquestrador (CartaControleContainer) e Seleção Dinâmica
  // =======================================================================
  describe('Container Orquestrador (CartaControleContainer)', () => {
    it('deve renderizar empty-state amigável quando lista de subgrupos estiver vazia', () => {
      render(<CartaControleContainer subgrupos={[]} />)

      expect(screen.getByTestId('carta-empty-state')).toBeInTheDocument()
      expect(screen.getByText('Aguardando Amostras e Telemetria')).toBeInTheDocument()
    })

    it('deve renderizar CartaXRChart quando n estiver entre 2 e 10', () => {
      const subgrupos = [criarSubgrupoMock(1, 10.0, 0.5, [10, 10, 10, 10, 10])]
      render(
        <CartaControleContainer
          subgrupos={subgrupos}
          tamanhoSubgrupo={5}
        />
      )

      expect(screen.getByTestId('carta-xr-chart')).toBeInTheDocument()
    })

    it('deve renderizar CartaXSChart quando n > 10', () => {
      const subgrupos = [criarSubgrupoMock(1, 10.0, 0.5, new Array(15).fill(10))]
      render(
        <CartaControleContainer
          subgrupos={subgrupos}
          tamanhoSubgrupo={15}
        />
      )

      expect(screen.getByTestId('carta-xs-chart')).toBeInTheDocument()
    })

    it('deve renderizar CartaIMRChart quando n = 1', () => {
      const subgrupos = [criarSubgrupoMock(1, 10.0, 0.0, [10])]
      render(
        <CartaControleContainer
          subgrupos={subgrupos}
          tamanhoSubgrupo={1}
        />
      )

      expect(screen.getByTestId('carta-imr-chart')).toBeInTheDocument()
    })

    it('deve sincronizar com cepStore quando props não forem passadas', () => {
      act(() => {
        useCEPStore.getState().setBufferHistorico([
          criarSubgrupoMock(1, 20.0, 1.0, [20, 20, 20]),
        ])
        useCEPStore.getState().setCartaDetalhes({
          id: 'carta-store',
          processo_id: 'proc-1',
          tipo_carta: 'X_R',
          tamanho_subgrupo: 3,
          especificacoes: null,
          limites_atuais: { lc: 20.0, lsc: 21.0, lic: 19.0, sigma_estimado: 0.33 },
          modo_limites: 'DINAMICO',
          total_subgrupos: 1,
        })
      })

      render(<CartaControleContainer />)
      expect(screen.getByTestId('carta-xr-chart')).toBeInTheDocument()
    })
  })

  // =======================================================================
  // 8. BaseChart: Ciclo de Vida e Métodos Imperativos
  // =======================================================================
  describe('BaseChart: Métodos Imperativos e Ciclo de Vida ECharts', () => {
    it('deve expor getInstance, getDataURL e resize via ref', () => {
      let refInstance: BaseChartRef | null = null

      function Test() {
        const ref = useRef<BaseChartRef>(null)
        useEffect(() => {
          refInstance = ref.current
        }, [])
        return (
          <BaseChart
            ref={ref}
            option={{ series: [] }}
            height={350}
          />
        )
      }

      const { unmount } = render(<Test />)

      expect(refInstance).toBeDefined()
      if (refInstance) {
        expect(typeof (refInstance as BaseChartRef).getInstance).toBe('function')
        expect(typeof (refInstance as BaseChartRef).getDataURL).toBe('function')
        expect(typeof (refInstance as BaseChartRef).resize).toBe('function')
      }

      // Desmontar sem erros
      unmount()
    })
  })
})
