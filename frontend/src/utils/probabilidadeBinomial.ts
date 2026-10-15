import type {
  CriterioConformidade,
  EscopoAmostral,
  PontoDistribuicaoSchema,
  SimulacaoBinomialResponse,
  TipoArranjo,
} from '@/types/api'

/**
 * Aproximação analítica de Abramowitz & Stegun da Função Erro erf(x)
 * Erro absoluto máximo < 1.5e-7, ideal para física, estatística e computação gráfica.
 */
export function erf(x: number): number {
  if (x === 0) return 0
  const sign = x > 0 ? 1 : -1
  const absX = Math.abs(x)

  const a1 = 0.254829592
  const a2 = -0.284496736
  const a3 = 1.421413741
  const a4 = -1.453152027
  const a5 = 1.061405429
  const p = 0.3275911

  const t = 1.0 / (1.0 + p * absX)
  const y =
    1.0 -
    ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX)

  return sign * y
}

/**
 * Função de Distribuição Acumulada da Normal Padrão Φ(z) = 0.5 * (1 + erf(z / sqrt(2)))
 */
export function normalCDF(z: number): number {
  return 0.5 * (1.0 + erf(z / Math.SQRT2))
}

/**
 * Coeficiente Binomial C(n, k) = n! / (k! * (n - k)!)
 */
export function combinacoes(n: number, k: number): number {
  if (k < 0 || k > n) return 0
  if (k === 0 || k === n) return 1
  const c = Math.min(k, n - k)
  let res = 1
  for (let i = 1; i <= c; i++) {
    res = (res * (n - i + 1)) / i
  }
  return Math.round(res)
}

/**
 * Função de Massa de Probabilidade (PMF) Binomial P(K = k)
 */
export function calcularPMF(n: number, k: number, p: number): number {
  if (p >= 1.0) return k === n ? 1.0 : 0.0
  if (p <= 0.0) return k === 0 ? 1.0 : 0.0
  const comb = combinacoes(n, k)
  return comb * Math.pow(p, k) * Math.pow(1.0 - p, n - k)
}

export interface ParametrosCalculoLocal {
  tipoArranjo: TipoArranjo
  criterio: CriterioConformidade
  escopo: EscopoAmostral
  mediaProcesso: number
  sigmaEstimado: number
  tamanhoSubgrupo: number
  tamanhoLoteX: number
  sucessosDesejadosY: number
  zValor?: number | null
  lic?: number | null
  lsc?: number | null
  lie?: number | null
  lse?: number | null
}

/**
 * Executa o cálculo de simulação binomial localmente com reatividade instantânea
 */
export function calcularSimulacaoBinomialLocal(
  params: ParametrosCalculoLocal,
  cartaId = 'local'
): SimulacaoBinomialResponse {
  const {
    tipoArranjo,
    criterio,
    escopo,
    mediaProcesso,
    sigmaEstimado,
    tamanhoSubgrupo,
    tamanhoLoteX,
    zValor = 2.5,
    lic,
    lsc,
    lie,
    lse,
  } = params

  let yEfetivo = params.sucessosDesejadosY
  if (tipoArranjo === 'CONSECUTIVO') {
    yEfetivo = tamanhoLoteX
  }

  // 1. Determinação da dispersão a ser usada
  const sigmaUsado =
    escopo === 'MEDIA_SUBGRUPO'
      ? sigmaEstimado / Math.sqrt(Math.max(1, tamanhoSubgrupo))
      : sigmaEstimado

  // 2. Determinação da probabilidade unitária p e limites de faixa
  let faixaInf: number | null = null
  let faixaSup: number | null = null
  let p = 0.9973

  if (criterio === 'Z_SIGMAS') {
    const z = zValor && zValor > 0 ? zValor : 2.5
    faixaInf = mediaProcesso - z * sigmaUsado
    faixaSup = mediaProcesso + z * sigmaUsado
    p = erf(z / Math.SQRT2)
  } else if (criterio === 'LIMITES_CONTROLE') {
    faixaInf = lic !== undefined && lic !== null ? lic : mediaProcesso - 3 * sigmaUsado
    faixaSup = lsc !== undefined && lsc !== null ? lsc : mediaProcesso + 3 * sigmaUsado
    const zInf = (faixaInf - mediaProcesso) / sigmaUsado
    const zSup = (faixaSup - mediaProcesso) / sigmaUsado
    p = normalCDF(zSup) - normalCDF(zInf)
  } else if (criterio === 'LIMITES_ESPECIFICACAO') {
    faixaInf = lie !== undefined ? lie : null
    faixaSup = lse !== undefined ? lse : null

    const phiSup = faixaSup !== null ? normalCDF((faixaSup - mediaProcesso) / sigmaUsado) : 1.0
    const phiInf = faixaInf !== null ? normalCDF((faixaInf - mediaProcesso) / sigmaUsado) : 0.0
    p = phiSup - phiInf
  }

  p = Math.max(0.0, Math.min(1.0, p))
  const q = Math.max(0.0, Math.min(1.0, 1.0 - p))

  // 3. Distribuição Completa de k = 0 até X
  const distribuicao: PontoDistribuicaoSchema[] = []
  for (let k = 0; k <= tamanhoLoteX; k++) {
    const probK = calcularPMF(tamanhoLoteX, k, p)

    let destaque = false
    if (tipoArranjo === 'CONSECUTIVO' || tipoArranjo === 'EXATAMENTE') {
      destaque = k === yEfetivo
    } else if (tipoArranjo === 'PELO_MENOS') {
      destaque = k >= yEfetivo
    } else if (tipoArranjo === 'NO_MAXIMO') {
      destaque = k <= yEfetivo
    }

    distribuicao.push({
      k,
      probabilidade: parseFloat(probK.toFixed(6)),
      destaque,
    })
  }

  // 4. Combinações e Probabilidade Final
  const comb = combinacoes(tamanhoLoteX, yEfetivo)
  let probFinal = 0.0

  if (tipoArranjo === 'CONSECUTIVO') {
    probFinal = Math.pow(p, tamanhoLoteX)
  } else if (tipoArranjo === 'EXATAMENTE') {
    probFinal = calcularPMF(tamanhoLoteX, yEfetivo, p)
  } else if (tipoArranjo === 'PELO_MENOS') {
    probFinal = distribuicao
      .filter((pt) => pt.k >= yEfetivo)
      .reduce((acc, curr) => acc + curr.probabilidade, 0)
  } else if (tipoArranjo === 'NO_MAXIMO') {
    probFinal = distribuicao
      .filter((pt) => pt.k <= yEfetivo)
      .reduce((acc, curr) => acc + curr.probabilidade, 0)
  }

  probFinal = Math.max(0.0, Math.min(1.0, probFinal))

  return {
    carta_id: cartaId,
    tipo_arranjo: tipoArranjo,
    criterio,
    escopo,
    media_processo: parseFloat(mediaProcesso.toFixed(4)),
    sigma_usado: parseFloat(sigmaUsado.toFixed(6)),
    z_valor: criterio === 'Z_SIGMAS' ? zValor ?? null : null,
    faixa_inferior: faixaInf !== null ? parseFloat(faixaInf.toFixed(4)) : null,
    faixa_superior: faixaSup !== null ? parseFloat(faixaSup.toFixed(4)) : null,
    probabilidade_unitaria_p: parseFloat(p.toFixed(6)),
    probabilidade_falha_q: parseFloat(q.toFixed(6)),
    tamanho_lote_x: tamanhoLoteX,
    sucessos_desejados_y: yEfetivo,
    combinacoes: tipoArranjo === 'CONSECUTIVO' ? 1 : comb,
    probabilidade_final: parseFloat(probFinal.toFixed(6)),
    distribuicao_completa: distribuicao,
  }
}
