export interface CartaIdentificavel {
  id?: string | null
  tipo_carta?: string | null
  tamanho_subgrupo?: number | null
}

/**
 * Formata o identificador visual da carta no formato padrão do sistema:
 * Exemplo: "X_R a855 (n = 5)"
 */
export function formatarNomeCarta(carta?: CartaIdentificavel | null): string {
  if (!carta) return 'Carta N/A'
  const tipo = carta.tipo_carta || 'X_R'
  const n = carta.tamanho_subgrupo ?? 5
  const shortId = carta.id ? carta.id.substring(0, 4) : ''

  if (shortId) {
    return `${tipo} ${shortId} (n = ${n})`
  }
  return `${tipo} (n = ${n})`
}
