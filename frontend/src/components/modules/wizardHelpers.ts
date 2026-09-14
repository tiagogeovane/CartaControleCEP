import type { TipoCarta } from '@/types/api'

/**
 * Aplica a regra de negócio [RN01] para seleção automatizada da carta de controle:
 * - n = 1: I-MR (Individual e Amplitude Móvel)
 * - 2 <= n <= 10: X̄-R (Médias e Amplitude)
 * - n > 10: X̄-s (Médias e Desvio-Padrão)
 */
export function recomendarTipoCarta(n: number): TipoCarta {
  if (n <= 1) return 'I_MR'
  if (n <= 10) return 'X_R'
  return 'X_S'
}
