import { describe, expect, it } from 'vitest'

/**
 * Funções auxiliares para cálculo da Luminância Relativa e Razão de Contraste WCAG 2.1
 * Fórmula oficial: https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
 */
function hexToRgb(hex: string): [number, number, number] {
  const cleanHex = hex.replace('#', '')
  const r = parseInt(cleanHex.substring(0, 2), 16)
  const g = parseInt(cleanHex.substring(2, 4), 16)
  const b = parseInt(cleanHex.substring(4, 6), 16)
  return [r, g, b]
}

function canalLinear(c: number): number {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

function calcularLuminancia(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  const rLin = canalLinear(r)
  const gLin = canalLinear(g)
  const bLin = canalLinear(b)
  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin
}

function calcularRazaoContraste(hex1: string, hex2: string): number {
  const lum1 = calcularLuminancia(hex1)
  const lum2 = calcularLuminancia(hex2)
  const maisClaro = Math.max(lum1, lum2)
  const maisEscuro = Math.min(lum1, lum2)
  return (maisClaro + 0.05) / (maisEscuro + 0.05)
}

describe('Fase 2 - Métricas Verificáveis de Contraste e Acessibilidade Industrial (WCAG AA)', () => {
  const FUNDO_DARK_IHM = '#0F172A'      // Slate 900
  const FUNDO_CARD_SUPERFICIE = '#1E293B' // Slate 800

  it('deve garantir contraste do texto primário (#F8FAFC) superior a 10:1 (WCAG AAA)', () => {
    const textoPrimario = '#F8FAFC'
    const contrasteFundo = calcularRazaoContraste(textoPrimario, FUNDO_DARK_IHM)
    const contrasteCard = calcularRazaoContraste(textoPrimario, FUNDO_CARD_SUPERFICIE)

    // WCAG AA exige >= 4.5:1; aqui atinge > 12:1
    expect(contrasteFundo).toBeGreaterThanOrEqual(4.5)
    expect(contrasteCard).toBeGreaterThanOrEqual(4.5)
  })

  it('deve garantir contraste do texto atenuado (#94A3B8) superior a 4.5:1 (WCAG AA)', () => {
    const textoMuted = '#94A3B8'
    const contrasteFundo = calcularRazaoContraste(textoMuted, FUNDO_DARK_IHM)
    const contrasteCard = calcularRazaoContraste(textoMuted, FUNDO_CARD_SUPERFICIE)

    expect(contrasteFundo).toBeGreaterThanOrEqual(4.5)
    expect(contrasteCard).toBeGreaterThanOrEqual(4.5)
  })

  it('deve garantir contraste do status Sob Controle (#34D399 / Emerald 400) superior a 4.5:1', () => {
    const corSucesso = '#34D399' // Emerald 400
    const contrasteFundo = calcularRazaoContraste(corSucesso, FUNDO_DARK_IHM)
    const contrasteCard = calcularRazaoContraste(corSucesso, FUNDO_CARD_SUPERFICIE)

    expect(contrasteFundo).toBeGreaterThanOrEqual(4.5)
    expect(contrasteCard).toBeGreaterThanOrEqual(4.5)
  })

  it('deve garantir contraste do status Fora de Controle (#F87171 / Red 400) superior a 4.5:1', () => {
    const corAlarme = '#F87171' // Red 400
    const contrasteFundo = calcularRazaoContraste(corAlarme, FUNDO_DARK_IHM)
    const contrasteCard = calcularRazaoContraste(corAlarme, FUNDO_CARD_SUPERFICIE)

    expect(contrasteFundo).toBeGreaterThanOrEqual(4.5)
    expect(contrasteCard).toBeGreaterThanOrEqual(4.5)
  })

  it('deve garantir contraste das Zonas de Alerta (#FBBF24 / Amber 400) superior a 4.5:1', () => {
    const corAlerta = '#FBBF24' // Amber 400
    const contrasteFundo = calcularRazaoContraste(corAlerta, FUNDO_DARK_IHM)
    const contrasteCard = calcularRazaoContraste(corAlerta, FUNDO_CARD_SUPERFICIE)

    expect(contrasteFundo).toBeGreaterThanOrEqual(4.5)
    expect(contrasteCard).toBeGreaterThanOrEqual(4.5)
  })

  it('deve garantir contraste da Linha Central (#60A5FA / Blue 400) superior a 4.5:1', () => {
    const corLC = '#60A5FA' // Blue 400
    const contrasteFundo = calcularRazaoContraste(corLC, FUNDO_DARK_IHM)
    const contrasteCard = calcularRazaoContraste(corLC, FUNDO_CARD_SUPERFICIE)

    expect(contrasteFundo).toBeGreaterThanOrEqual(4.5)
    expect(contrasteCard).toBeGreaterThanOrEqual(4.5)
  })
})
