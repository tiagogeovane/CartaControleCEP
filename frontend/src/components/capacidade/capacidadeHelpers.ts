import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react'

export interface ClassificacaoIndiceInfo {
  texto: string
  corTexto: string
  corBg: string
  corBorda: string
  varianteBadge: 'sob_controle' | 'fora_de_controle' | 'alerta' | 'neutro'
  icone: typeof CheckCircle
}

export function obterClassificacaoIndice(valor: number | null): ClassificacaoIndiceInfo {
  if (valor == null || isNaN(valor)) {
    return {
      texto: 'INDETERMINADO',
      corTexto: 'text-slate-400',
      corBg: 'bg-slate-800',
      corBorda: 'border-slate-700',
      varianteBadge: 'neutro',
      icone: AlertTriangle,
    }
  }

  if (valor < 1.0) {
    return {
      texto: 'INCAPAZ (< 1.00)',
      corTexto: 'text-red-400',
      corBg: 'bg-red-950/60',
      corBorda: 'border-red-800/60',
      varianteBadge: 'fora_de_controle',
      icone: XCircle,
    }
  }

  if (valor < 1.33) {
    return {
      texto: 'ACEITÁVEL (1.00 a 1.33)',
      corTexto: 'text-amber-400',
      corBg: 'bg-amber-950/60',
      corBorda: 'border-amber-800/60',
      varianteBadge: 'alerta',
      icone: AlertTriangle,
    }
  }

  return {
    texto: 'CAPAZ E SEGURO (≥ 1.33)',
    corTexto: 'text-emerald-400',
    corBg: 'bg-emerald-950/60',
    corBorda: 'border-emerald-800/60',
    varianteBadge: 'sob_controle',
    icone: CheckCircle,
  }
}

/**
 * Função densidade de probabilidade da distribuição normal gaussiana
 */
export function pdfNormal(x: number, media: number, sigma: number): number {
  if (sigma <= 0) return 0
  const exp = -0.5 * Math.pow((x - media) / sigma, 2)
  return (1 / (sigma * Math.sqrt(2 * Math.PI))) * Math.exp(exp)
}

export interface ClasseHistograma {
  min: number
  max: number
  centro: number
  rotulo: string
  contagem: number
}

export function calcularClassesHistograma(
  valores: number[],
  numClasses = 12
): {
  bins: ClasseHistograma[]
  larguraClasse: number
} {
  if (valores.length === 0) {
    return { bins: [], larguraClasse: 0 }
  }

  const minVal = Math.min(...valores)
  const maxVal = Math.max(...valores)
  const amplitude = maxVal - minVal

  if (amplitude === 0) {
    return {
      bins: [
        {
          min: minVal - 0.5,
          max: maxVal + 0.5,
          centro: minVal,
          rotulo: minVal.toFixed(2),
          contagem: valores.length,
        },
      ],
      larguraClasse: 1,
    }
  }

  const larguraClasse = amplitude / numClasses
  const bins = Array.from({ length: numClasses }, (_, i) => {
    const min = minVal + i * larguraClasse
    const max = min + larguraClasse
    const centro = min + larguraClasse / 2
    return {
      min,
      max,
      centro,
      rotulo: centro.toFixed(3),
      contagem: 0,
    }
  })

  valores.forEach((v) => {
    let index = Math.floor((v - minVal) / larguraClasse)
    if (index >= numClasses) index = numClasses - 1
    if (index < 0) index = 0
    bins[index].contagem++
  })

  return { bins, larguraClasse }
}
