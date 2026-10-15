import { describe, expect, it } from 'vitest'
import {
  calcularPMF,
  calcularSimulacaoBinomialLocal,
  combinacoes,
  erf,
  normalCDF,
} from '@/utils/probabilidadeBinomial'

describe('Utilitário de Probabilidade Binomial', () => {
  it('deve calcular erf(x) e normalCDF(z) com alta precisão', () => {
    // erf(0) = 0
    expect(erf(0)).toBe(0)
    // normalCDF(0) = 0.5
    expect(normalCDF(0)).toBe(0.5)

    // erf(2.5 / sqrt(2)) ~ 0.98758
    const z25 = 2.5 / Math.SQRT2
    expect(parseFloat(erf(z25).toFixed(4))).toBe(0.9876)

    // erf(3.0 / sqrt(2)) ~ 0.9973
    const z30 = 3.0 / Math.SQRT2
    expect(parseFloat(erf(z30).toFixed(4))).toBe(0.9973)

    // normalCDF(3) - normalCDF(-3) ~ 0.9973
    expect(parseFloat((normalCDF(3) - normalCDF(-3)).toFixed(4))).toBe(0.9973)
  })

  it('deve calcular combinações C(n, k)', () => {
    expect(combinacoes(5, 5)).toBe(1)
    expect(combinacoes(5, 0)).toBe(1)
    expect(combinacoes(5, 1)).toBe(5)
    expect(combinacoes(5, 2)).toBe(10)
    expect(combinacoes(10, 3)).toBe(120)
  })

  it('deve calcular PMF binomial pontual', () => {
    // n=4, p=0.5 -> k=2 -> 6 * 0.5^4 = 6/16 = 0.375
    expect(calcularPMF(4, 2, 0.5)).toBe(0.375)
    // n=5, p=1.0 -> k=5 -> 1.0
    expect(calcularPMF(5, 5, 1.0)).toBe(1.0)
    expect(calcularPMF(5, 4, 1.0)).toBe(0.0)
  })

  it('deve reproduzir com perfeição o exemplo da especificação do usuário', () => {
    // Exemplo: Z = 2.50, X = 5, Consecutivo -> p = 98.7581%, P(X=5) = 93.9412%
    const res = calcularSimulacaoBinomialLocal({
      tipoArranjo: 'CONSECUTIVO',
      criterio: 'Z_SIGMAS',
      escopo: 'INDIVIDUAL',
      mediaProcesso: 10.0,
      sigmaEstimado: 0.06,
      tamanhoSubgrupo: 5,
      tamanhoLoteX: 5,
      sucessosDesejadosY: 5,
      zValor: 2.50,
    })

    expect(res.probabilidade_unitaria_p).toBeCloseTo(0.987581, 4)
    expect(res.combinacoes).toBe(1)
    expect(res.probabilidade_final).toBeCloseTo(0.939412, 4)
    expect(res.faixa_inferior).toBe(9.85)
    expect(res.faixa_superior).toBe(10.15)
    expect(res.distribuicao_completa.length).toBe(6)
    expect(res.distribuicao_completa[5].destaque).toBe(true)
    expect(res.distribuicao_completa[4].destaque).toBe(false)
  })

  it('deve calcular corretamente para arranjo em lote com operadores', () => {
    // Lote de 4 peças, p=0.5
    const baseParams = {
      criterio: 'Z_SIGMAS' as const,
      escopo: 'INDIVIDUAL' as const,
      mediaProcesso: 10.0,
      sigmaEstimado: 1.0,
      tamanhoSubgrupo: 5,
      tamanhoLoteX: 4,
      zValor: 0.67448975, // p ~ 0.5
    }

    const resPeloMenos = calcularSimulacaoBinomialLocal({
      ...baseParams,
      tipoArranjo: 'PELO_MENOS',
      sucessosDesejadosY: 3,
    })
    // P(K >= 3) = P(3) + P(4) = 4/16 + 1/16 = 5/16 = 0.3125
    expect(resPeloMenos.probabilidade_final).toBeCloseTo(0.3125, 4)
    expect(resPeloMenos.distribuicao_completa[3].destaque).toBe(true)
    expect(resPeloMenos.distribuicao_completa[4].destaque).toBe(true)
    expect(resPeloMenos.distribuicao_completa[2].destaque).toBe(false)

    const resNoMaximo = calcularSimulacaoBinomialLocal({
      ...baseParams,
      tipoArranjo: 'NO_MAXIMO',
      sucessosDesejadosY: 1,
    })
    // P(K <= 1) = P(0) + P(1) = 5/16 = 0.3125
    expect(resNoMaximo.probabilidade_final).toBeCloseTo(0.3125, 4)
    expect(resNoMaximo.distribuicao_completa[0].destaque).toBe(true)
    expect(resNoMaximo.distribuicao_completa[1].destaque).toBe(true)
  })
})
