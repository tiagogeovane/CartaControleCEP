import { describe, expect, it } from 'vitest'
import { isCartaAtributo } from '@/types/cep'
import { buildAtributosChartOption, gerarTooltipHTMLAtributos } from '@/components/charts/cepChartHelpers'
import { calcularMetricasSigma } from '@/utils/pdfReportGenerator'
import type { LimitesControle, Subgrupo } from '@/types'

// Helper para mock de subgrupos compatível com SubgrupoResponse
function criarSubgrupoAtributoMock(
  numero: number,
  taxaOuContagem: number,
  valores: number[] = [taxaOuContagem],
  foraDeControle = false,
  violacoes: Subgrupo['violacoes'] = []
): Subgrupo {
  return {
    id: `sg-${numero}`,
    carta_id: 'carta-p-01',
    numero_subgrupo: numero,
    timestamp: new Date(2026, 9, 15, 10, numero, 0).toISOString(),
    valores_brutos: valores,
    estatisticas: {
      media_x: taxaOuContagem,
      amplitude_r: taxaOuContagem * (valores.length > 1 ? valores.length : 50),
      desvio_s: 0.05,
      valores_brutos: valores,
    },
    fora_de_controle: foraDeControle,
    violacoes,
  }
}

describe('Frontend - Cartas de Controle por Atributos (P e C)', () => {
  // =========================================================================
  // 1. Identificação de Tipos de Cartas de Atributos
  // =========================================================================
  describe('isCartaAtributo', () => {
    it('deve identificar corretamente cartas de atributos P e C', () => {
      expect(isCartaAtributo('P')).toBe(true)
      expect(isCartaAtributo('C')).toBe(true)
      expect(isCartaAtributo('X_R')).toBe(false)
      expect(isCartaAtributo('X_S')).toBe(false)
      expect(isCartaAtributo('I_MR')).toBe(false)
    })
  })

  // =========================================================================
  // 2. Construção de Opções do ECharts (buildAtributosChartOption)
  // =========================================================================
  describe('buildAtributosChartOption', () => {
    it('deve gerar configuração de gráfico com grid único ocupando 100% da altura', () => {
      const limites: LimitesControle = {
        lc: 0.10,
        lsc: 0.20,
        lic: 0.0,
        lc_dispersao: 0.0,
        lsc_dispersao: 0.0,
        lic_dispersao: 0.0,
        sigma_estimado: 0.0333,
      }

      const subgrupos: Subgrupo[] = [
        criarSubgrupoAtributoMock(1, 0.08, [0, 1, 0, 0, 1]),
        criarSubgrupoAtributoMock(2, 0.12, [0, 0, 1, 1, 0]),
      ]

      const option = buildAtributosChartOption({
        subgrupos,
        limites,
        tipoCarta: 'P',
        tamanhoSubgrupo: 50,
        janelaZoom: 'todos',
      })

      // Grid único ocupando a altura disponível
      const grids = option.grid as any[]
      expect(grids).toBeDefined()
      expect(grids).toHaveLength(1)
      expect(grids[0].bottom).toBe('15%')
      expect(grids[0].top).toBe('12%')

      // Apenas um eixo X e um eixo Y
      const xAxes = option.xAxis as any[]
      expect(xAxes).toBeDefined()
      expect(xAxes).toHaveLength(1)
      expect(xAxes[0].type).toBe('category')
      expect(xAxes[0].data).toEqual(['#001', '#002'])

      const yAxes = option.yAxis as any[]
      expect(yAxes).toBeDefined()
      expect(yAxes).toHaveLength(1)
      expect(yAxes[0].name).toBe('Proporção de Defeituosos (p)')
    })

    it('deve configurar séries, linhas de controle e marcadores de anomalia para Carta P', () => {
      const limites: LimitesControle = {
        lc: 0.10,
        lsc: 0.20,
        lic: 0.0,
        sigma_estimado: 0.0333,
      }

      const subgrupos: Subgrupo[] = [
        criarSubgrupoAtributoMock(1, 0.08, [0, 1]),
        criarSubgrupoAtributoMock(2, 0.25, [1, 1], true, [
          {
            codigo_regra: 'REGRA_1',
            descricao: 'Ponto além de 3 sigma (0.25 > 0.20)',
            numero_subgrupo: 2,
            pontos_violadores: [0.25],
          },
        ]),
      ]

      const option = buildAtributosChartOption({
        subgrupos,
        limites,
        tipoCarta: 'P',
        tamanhoSubgrupo: 50,
      })

      const series = option.series as any[]
      expect(series).toBeDefined()
      expect(series).toHaveLength(2)

      // Série 0: Linha principal
      expect(series[0].name).toBe('Proporção de Defeituosos (p)')
      expect(series[0].type).toBe('line')
      expect(series[0].data).toEqual([0.08, 0.25])
      expect(series[0].markLine).toBeDefined()
      expect(series[0].markArea).toBeDefined()

      // Série 1: Efeito Scatter de Anomalias
      expect(series[1].name).toBe('Anomalias')
      expect(series[1].type).toBe('effectScatter')
      expect(series[1].itemStyle.color).toBe('#EF4444')
      expect(series[1].data).toHaveLength(1)
      expect(series[1].data[0]).toEqual([1, 0.25])
    })

    it('deve configurar eixos e títulos apropriados para Carta C', () => {
      const subgrupos: Subgrupo[] = [
        criarSubgrupoAtributoMock(1, 4, [4]),
        criarSubgrupoAtributoMock(2, 2, [2]),
      ]

      const option = buildAtributosChartOption({
        subgrupos,
        tipoCarta: 'C',
        tamanhoSubgrupo: 1,
      })

      const yAxes = option.yAxis as any[]
      expect(yAxes[0].name).toBe('Quantidade de Defeitos (c)')

      const series = option.series as any[]
      expect(series[0].name).toBe('Quantidade de Defeitos (c)')
    })
  })

  // =========================================================================
  // 3. Formatação de Tooltips Enriquecidos (gerarTooltipHTMLAtributos)
  // =========================================================================
  describe('gerarTooltipHTMLAtributos', () => {
    it('deve gerar tooltip contextualizado para Carta P com proporção, percentual e contagem', () => {
      const subgrupo = criarSubgrupoAtributoMock(5, 0.12, [0, 1, 0, 0, 1, 1])
      subgrupo.estatisticas.amplitude_r = 6 // 6 defeituosos

      const html = gerarTooltipHTMLAtributos(subgrupo, 'P', 50)

      expect(html).toContain('Subgrupo #005')
      expect(html).toContain('Proporção (p):')
      expect(html).toContain('0.1200 (12.0%)')
      expect(html).toContain('Defeituosos:')
      expect(html).toContain('6 de 50')
    })

    it('deve exibir detalhes de anomalia e regras de Nelson no tooltip', () => {
      const subgrupo = criarSubgrupoAtributoMock(7, 0.28, [1, 1], true, [
        {
          codigo_regra: 'REGRA_1',
          descricao: '1 ponto além de 3 sigma',
          numero_subgrupo: 7,
          pontos_violadores: [0.28],
        },
      ])

      const html = gerarTooltipHTMLAtributos(subgrupo, 'P', 50)

      expect(html).toContain('🚨 ANOMALIA DETECTADA:')
      expect(html).toContain('1 Ponto Além de 3 Sigma')
      expect(html).toContain('1 ponto além de 3 sigma')
    })

    it('deve gerar tooltip contextualizado para Carta C com contagem inteira de defeitos', () => {
      const subgrupo = criarSubgrupoAtributoMock(3, 5, [5])

      const html = gerarTooltipHTMLAtributos(subgrupo, 'C', 1)

      expect(html).toContain('Subgrupo #003')
      expect(html).toContain('Total de Defeitos (c):')
      expect(html).toContain('5')
      expect(html).not.toContain('🚨 ANOMALIA DETECTADA:')
    })

    it('deve exibir mensagem padrão de anomalia quando fora de controle sem violações específicas', () => {
      const subgrupo = criarSubgrupoAtributoMock(8, 12, [12], true, [])

      const html = gerarTooltipHTMLAtributos(subgrupo, 'C', 1)

      expect(html).toContain('🚨 ANOMALIA DETECTADA:')
      expect(html).toContain('Ponto Fora de Controle Estatístico')
    })
  })

  // =========================================================================
  // 4. Métricas Sigma e Relatório PDF para Atributos
  // =========================================================================
  describe('calcularMetricasSigma para Cartas de Atributos', () => {
    it('deve calcular métricas de sigma para Carta P utilizando sigma_estimado diretamente', () => {
      const metricas = calcularMetricasSigma(
        {
          lc: 0.10,
          lsc: 0.20,
          lic: 0.0,
          sigmaEstimado: 0.03333,
        },
        null,
        50,
        false,
        '',
        'P'
      )

      // Para cartas de atributos, o erro padrão não deve ser dividido por sqrt(n) novamente
      expect(metricas.distanciaLscSigmaXBarra).toBe(3.0)
      expect(metricas.distanciaLicSigmaXBarra).toBe(3.0)
      expect(metricas.distanciaLscSigmaIndiv).toBe(3.0)
      expect(metricas.distanciaLicSigmaIndiv).toBe(3.0)
    })

    it('deve calcular sigmas assimétricos fidedignos para Carta C com truncamento em 0.0', () => {
      // Linha Central = 4.0, Sigma = 2.0 -> LSC = 4 + 3*2 = 10, LIC = max(0, 4 - 3*2) = 0.0
      const metricas = calcularMetricasSigma(
        {
          lc: 4.0,
          lsc: 10.0,
          lic: 0.0,
          sigmaEstimado: 2.0,
        },
        null,
        1,
        false,
        '',
        'C'
      )

      expect(metricas.distanciaLscSigmaIndiv).toBe(3.0)
      expect(metricas.distanciaLicSigmaIndiv).toBe(2.0)
      expect(metricas.distanciaLscSigmaXBarra).toBe(3.0)
      expect(metricas.distanciaLicSigmaXBarra).toBe(2.0)
    })
  })
})