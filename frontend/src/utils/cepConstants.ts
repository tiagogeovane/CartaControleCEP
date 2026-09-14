/**
 * Constantes tabeladas normalizadas da literatura (Montgomery) para CEP
 * Suporte a cartas X_R (n=2..10), X_s (n>10) e I_MR (n=1)
 */

export const CONSTANTES_XR: Record<
  number,
  { a2: number; d2: number; d3: number; d4: number }
> = {
  2: { a2: 1.88, d2: 1.128, d3: 0.0, d4: 3.267 },
  3: { a2: 1.023, d2: 1.693, d3: 0.0, d4: 2.574 },
  4: { a2: 0.729, d2: 2.059, d3: 0.0, d4: 2.282 },
  5: { a2: 0.577, d2: 2.326, d3: 0.0, d4: 2.114 },
  6: { a2: 0.483, d2: 2.534, d3: 0.0, d4: 2.004 },
  7: { a2: 0.419, d2: 2.704, d3: 0.076, d4: 1.924 },
  8: { a2: 0.373, d2: 2.847, d3: 0.136, d4: 1.864 },
  9: { a2: 0.337, d2: 2.97, d3: 0.184, d4: 1.816 },
  10: { a2: 0.308, d2: 3.078, d3: 0.223, d4: 1.777 },
}

export const CONSTANTES_XS: Record<
  number,
  { a3: number; c4: number; b3: number; b4: number }
> = {
  11: { a3: 0.927, c4: 0.9754, b3: 0.321, b4: 1.679 },
  12: { a3: 0.886, c4: 0.9776, b3: 0.354, b4: 1.646 },
  13: { a3: 0.85, c4: 0.9794, b3: 0.382, b4: 1.618 },
  14: { a3: 0.817, c4: 0.981, b3: 0.406, b4: 1.594 },
  15: { a3: 0.789, c4: 0.9823, b3: 0.428, b4: 1.572 },
  16: { a3: 0.763, c4: 0.9835, b3: 0.448, b4: 1.552 },
  17: { a3: 0.739, c4: 0.9845, b3: 0.466, b4: 1.534 },
  18: { a3: 0.718, c4: 0.9854, b3: 0.482, b4: 1.518 },
  19: { a3: 0.698, c4: 0.9862, b3: 0.497, b4: 1.503 },
  20: { a3: 0.68, c4: 0.9869, b3: 0.51, b4: 1.49 },
  25: { a3: 0.606, c4: 0.9896, b3: 0.565, b4: 1.435 },
}

export function obterConstantesXR(n: number) {
  const nValido = Math.max(2, Math.min(10, n))
  return CONSTANTES_XR[nValido] ?? CONSTANTES_XR[5]
}

export function obterConstantesXS(n: number) {
  const chaves = Object.keys(CONSTANTES_XS).map(Number)
  const chaveMaisProxima = chaves.reduce((prev, curr) =>
    Math.abs(curr - n) < Math.abs(prev - n) ? curr : prev
  )
  return CONSTANTES_XS[chaveMaisProxima]
}

export interface LimitesDispersao {
  lic: number
  lc: number
  lsc: number
}

export function calcularLimitesAmplitudeR(
  rBarra: number,
  n: number
): LimitesDispersao {
  const { d3, d4 } = obterConstantesXR(n)
  return {
    lic: Number((d3 * rBarra).toFixed(4)),
    lc: Number(rBarra.toFixed(4)),
    lsc: Number((d4 * rBarra).toFixed(4)),
  }
}

export function calcularLimitesDesvioS(
  sBarra: number,
  n: number
): LimitesDispersao {
  const { b3, b4 } = obterConstantesXS(n)
  return {
    lic: Number((b3 * sBarra).toFixed(4)),
    lc: Number(sBarra.toFixed(4)),
    lsc: Number((b4 * sBarra).toFixed(4)),
  }
}

export function calcularLimitesAmplitudeMovelMR(mrBarra: number): LimitesDispersao {
  // D3(2) = 0.0, D4(2) = 3.267
  return {
    lic: 0,
    lc: Number(mrBarra.toFixed(4)),
    lsc: Number((3.267 * mrBarra).toFixed(4)),
  }
}
