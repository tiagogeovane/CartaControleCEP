import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

export interface LimitesControleReport {
  lc: number
  lsc: number
  lic: number
  sigmaEstimado: number
}

export interface LimitesEspecificacaoReport {
  lse: number | null
  lie: number | null
  valorNominal: number | null
}

export interface SubgrupoReport {
  numero_subgrupo: number
  valores_brutos: number[]
  estatisticas: {
    media_x: number
    amplitude_r?: number
    desvio_s?: number
  }
  fora_de_controle: boolean
  violacoes?: Array<{ codigo_regra: string; descricao?: string }>
}

export interface SimulacaoBinomialReport {
  tipoArranjo: 'CONSECUTIVO' | 'EXATAMENTE' | 'PELO_MENOS' | 'NO_MAXIMO'
  criterio: 'Z_SIGMAS' | 'LIMITES_CONTROLE' | 'LIMITES_ESPECIFICACAO'
  escopo: 'INDIVIDUAL' | 'MEDIA_SUBGRUPO'
  zValor?: number | null
  faixaInferior: number | null
  faixaSuperior: number | null
  probabilidadeUnitariaP: number
  probabilidadeFalhaQ: number
  tamanhoLoteX: number
  sucessosDesejadosY: number
  combinacoes: number
  probabilidadeFinal: number
}

export interface SecoesRelatorioPDF {
  incluirMetadados: boolean
  incluirGrafico: boolean
  incluirLimitesControle: boolean
  incluirLimitesEspecificacao: boolean
  incluirAnaliseSigmas: boolean
  incluirSimulacaoBinomial?: boolean
  incluirTabelaAmostras: boolean
}

export interface RelatorioPDFOpcoes {
  cartaId: string
  tipoCarta: string
  tamanhoSubgrupo: number
  codigoLinha?: string
  nomeProcesso?: string
  unidade?: string
  dataGeracao?: string
  totalSubgrupos?: number
  modoLimites?: string

  limitesControle?: LimitesControleReport | null
  limitesEspecificacao?: LimitesEspecificacaoReport | null
  imagemGrafico?: string | null
  subgrupos?: SubgrupoReport[]
  simulacaoBinomial?: SimulacaoBinomialReport | null

  secoes: SecoesRelatorioPDF
}

export interface MetricasSigma {
  distanciaLscSigma: number | null
  distanciaLicSigma: number | null
  distanciaLscSigmaXBarra?: number | null
  distanciaLicSigmaXBarra?: number | null
  distanciaLscSigmaIndiv?: number | null
  distanciaLicSigmaIndiv?: number | null
  zLse: number | null
  zLie: number | null
  zMin: number | null
  cpkEquivalente: number | null
  classificacaoSigma: string
  offsetNominal?: number | null
  percentualDeslocamento?: number | null
  textoDeslocamento?: string | null
  possuiAnomalias?: boolean
  rotuloCpk?: string
}

/**
 * Calcula a distância da Linha Central aos limites de controle e de especificação em número de Sigmas.
 */
export function calcularMetricasSigma(
  limitesControle?: LimitesControleReport | null,
  limitesEspecificacao?: LimitesEspecificacaoReport | null,
  tamanhoSubgrupo: number = 5,
  possuiAnomalias: boolean = false,
  unidade: string = '',
  tipoCarta?: string
): MetricasSigma {
  if (!limitesControle || !limitesControle.sigmaEstimado || limitesControle.sigmaEstimado <= 0) {
    return {
      distanciaLscSigma: null,
      distanciaLicSigma: null,
      distanciaLscSigmaXBarra: null,
      distanciaLicSigmaXBarra: null,
      distanciaLscSigmaIndiv: null,
      distanciaLicSigmaIndiv: null,
      zLse: null,
      zLie: null,
      zMin: null,
      cpkEquivalente: null,
      classificacaoSigma: 'Indisponível (Sem Sigma)',
      offsetNominal: null,
      percentualDeslocamento: null,
      textoDeslocamento: null,
      possuiAnomalias,
      rotuloCpk: 'Indisponível (Sem Sigma)',
    }
  }

  const isAtributo = tipoCarta === 'P' || tipoCarta === 'C'
  const { lc, lsc, lic, sigmaEstimado } = limitesControle
  const n = Math.max(1, tamanhoSubgrupo)
  const erroPadraoMedia = isAtributo ? sigmaEstimado : sigmaEstimado / Math.sqrt(n)

  const distanciaLscSigmaXBarra = Number(((lsc - lc) / erroPadraoMedia).toFixed(2))
  const distanciaLicSigmaXBarra = Number(((lc - lic) / erroPadraoMedia).toFixed(2))
  const distanciaLscSigmaIndiv = Number(((lsc - lc) / sigmaEstimado).toFixed(2))
  const distanciaLicSigmaIndiv = Number(((lc - lic) / sigmaEstimado).toFixed(2))

  const distanciaLscSigma = distanciaLscSigmaIndiv
  const distanciaLicSigma = distanciaLicSigmaIndiv

  let zLse: number | null = null
  let zLie: number | null = null
  let zMin: number | null = null
  let cpkEquivalente: number | null = null
  let classificacaoSigma = 'Limites de Engenharia Não Definidos'

  if (limitesEspecificacao) {
    if (limitesEspecificacao.lse !== null && limitesEspecificacao.lse !== undefined) {
      zLse = Number(((limitesEspecificacao.lse - lc) / sigmaEstimado).toFixed(2))
    }
    if (limitesEspecificacao.lie !== null && limitesEspecificacao.lie !== undefined) {
      zLie = Number(((lc - limitesEspecificacao.lie) / sigmaEstimado).toFixed(2))
    }

    if (zLse !== null && zLie !== null) {
      zMin = Math.min(zLse, zLie)
    } else if (zLse !== null) {
      zMin = zLse
    } else if (zLie !== null) {
      zMin = zLie
    }

    if (zMin !== null) {
      cpkEquivalente = Number((zMin / 3).toFixed(3))

      if (zMin >= 6.0) {
        classificacaoSigma = 'Nível World-Class (6.0 sigma+)'
      } else if (zMin >= 4.0) {
        classificacaoSigma = 'Nível Excelente / Alta Precisão (4.0 sigma a 5.9 sigma)'
      } else if (zMin >= 3.0) {
        classificacaoSigma = 'Nível Adequado / Estável (3.0 sigma a 3.9 sigma)'
      } else if (zMin >= 2.0) {
        classificacaoSigma = 'Nível Crítico / Alto Risco (2.0 sigma a 2.9 sigma)'
      } else {
        classificacaoSigma = 'Nível Incapaz / Fora de Tolerância (< 2.0 sigma)'
      }
    }
  }

  let offsetNominal: number | null = null
  let percentualDeslocamento: number | null = null
  let textoDeslocamento: string | null = null

  if (
    limitesEspecificacao &&
    limitesEspecificacao.valorNominal !== null &&
    limitesEspecificacao.valorNominal !== undefined
  ) {
    const nominal = limitesEspecificacao.valorNominal
    const unitStr = unidade ? ` ${unidade}` : ''
    offsetNominal = Number((lc - nominal).toFixed(4))
    const sinal = offsetNominal >= 0 ? '+' : ''

    if (offsetNominal >= 0) {
      if (
        limitesEspecificacao.lse !== null &&
        limitesEspecificacao.lse !== undefined &&
        limitesEspecificacao.lse > nominal
      ) {
        const perc = ((lc - nominal) / (limitesEspecificacao.lse - nominal)) * 100
        percentualDeslocamento = Number(perc.toFixed(1))
        textoDeslocamento = `${sinal}${offsetNominal.toFixed(4)}${unitStr} (+${percentualDeslocamento.toFixed(1)}% em direção ao LSE)`
      } else {
        textoDeslocamento = `${sinal}${offsetNominal.toFixed(4)}${unitStr}`
      }
    } else {
      if (
        limitesEspecificacao.lie !== null &&
        limitesEspecificacao.lie !== undefined &&
        nominal > limitesEspecificacao.lie
      ) {
        const perc = ((nominal - lc) / (nominal - limitesEspecificacao.lie)) * 100
        percentualDeslocamento = Number(perc.toFixed(1))
        textoDeslocamento = `${offsetNominal.toFixed(4)}${unitStr} (-${percentualDeslocamento.toFixed(1)}% em direção ao LIE)`
      } else {
        textoDeslocamento = `${offsetNominal.toFixed(4)}${unitStr}`
      }
    }
  }

  let rotuloCpk = classificacaoSigma
  if (possuiAnomalias && cpkEquivalente !== null) {
    rotuloCpk = `Cpk Aparente: ${cpkEquivalente.toFixed(3)} (PROCESSO INSTÁVEL - Requer Estabilização)`
  }

  return {
    distanciaLscSigma,
    distanciaLicSigma,
    distanciaLscSigmaXBarra,
    distanciaLicSigmaXBarra,
    distanciaLscSigmaIndiv,
    distanciaLicSigmaIndiv,
    zLse,
    zLie,
    zMin,
    cpkEquivalente,
    classificacaoSigma,
    offsetNominal,
    percentualDeslocamento,
    textoDeslocamento,
    possuiAnomalias,
    rotuloCpk,
  }
}

/**
 * Gera e baixa o Relatório Técnico em PDF da Carta de Controle formatado em A4 Retrato.
 */
export async function gerarRelatorioPDF(opcoes: RelatorioPDFOpcoes): Promise<{
  sucesso: boolean
  nomeArquivo: string
  metricasSigma: MetricasSigma
}> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const possuiAnomalias = (opcoes.subgrupos || []).some((sg) => sg.fora_de_controle)
  const metricasSigma = calcularMetricasSigma(
    opcoes.limitesControle,
    opcoes.limitesEspecificacao,
    opcoes.tamanhoSubgrupo,
    possuiAnomalias,
    opcoes.unidade || '',
    opcoes.tipoCarta
  )

  const agora = new Date()
  const dataFormatada =
    opcoes.dataGeracao ||
    agora.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const marginLeft = 14
  const contentWidth = pageWidth - marginLeft * 2
  let currentY = 14

  // 1. Cabeçalho Corporativo
  doc.setFillColor(15, 23, 42) // slate-900
  doc.rect(0, 0, pageWidth, 28, 'F')

  doc.setFillColor(37, 99, 235) // blue-600 (linha de destaque)
  doc.rect(0, 26.5, pageWidth, 1.5, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('CONTROLE ESTATÍSTICO DE PROCESSOS (CEP)', marginLeft, 12)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(148, 163, 184) // slate-400
  doc.text('Relatório Técnico de Estabilidade, Limites Operacionais e Nível Sigma', marginLeft, 18)

  doc.setFontSize(8)
  doc.setTextColor(203, 213, 225) // slate-300
  doc.text(`Emissão: ${dataFormatada}`, pageWidth - marginLeft, 18, { align: 'right' })

  currentY = 35

  // 2. Metadados do Processo e da Carta
  if (opcoes.secoes.incluirMetadados) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(15, 23, 42)
    doc.text('1. Informações Gerais do Processo e da Carta', marginLeft, currentY)
    currentY += 4

    let tipoCartaDesc = opcoes.tipoCarta || 'X_R'
    if (opcoes.tipoCarta === 'P') {
      tipoCartaDesc = 'P (Proporção Binomial)'
    } else if (opcoes.tipoCarta === 'C') {
      tipoCartaDesc = 'C (Contagem Poisson)'
    } else if (opcoes.tipoCarta === 'X_R') {
      tipoCartaDesc = 'X-R (Médias e Amplitudes)'
    } else if (opcoes.tipoCarta === 'X_S') {
      tipoCartaDesc = 'X-S (Médias e Desvios)'
    } else if (opcoes.tipoCarta === 'I_MR') {
      tipoCartaDesc = 'I-MR (Individuais e Amplitude Móvel)'
    }

    const metadataBody = [
      [
        'Código da Linha:',
        opcoes.codigoLinha || 'LINHA-PADRÃO',
        'Tipo da Carta:',
        tipoCartaDesc,
      ],
      [
        'Nome do Processo:',
        opcoes.nomeProcesso || 'Processo de Monitoramento',
        'Tamanho Subgrupo (n):',
        String(opcoes.tamanhoSubgrupo || 5),
      ],
      [
        'Identificador (UUID):',
        opcoes.cartaId || 'N/A',
        'Modo de Limites:',
        opcoes.modoLimites || 'DINÂMICO',
      ],
      [
        'Total de Subgrupos:',
        String(opcoes.totalSubgrupos ?? opcoes.subgrupos?.length ?? 0),
        'Unidade de Medida:',
        opcoes.unidade || 'mm',
      ],
    ]

    autoTable(doc, {
      startY: currentY,
      margin: { left: marginLeft, right: marginLeft },
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 2,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
      },
      columnStyles: {
        0: { fontStyle: 'bold', fillColor: [248, 250, 252], cellWidth: 38 },
        1: { cellWidth: 53 },
        2: { fontStyle: 'bold', fillColor: [248, 250, 252], cellWidth: 43 },
        3: { cellWidth: 48 },
      },
      body: metadataBody,
    })

    currentY = (doc as any).lastAutoTable.finalY + 7
  }

  // 3. Tabela de Limites de Controle e Especificação
  if (opcoes.secoes.incluirLimitesControle || opcoes.secoes.incluirLimitesEspecificacao) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(15, 23, 42)
    doc.text('2. Parâmetros Estatísticos e Limites Operacionais', marginLeft, currentY)
    currentY += 4

    const unit = opcoes.unidade ? ` ${opcoes.unidade}` : ''
    const limitesRows: string[][] = []

    if (opcoes.secoes.incluirLimitesControle) {
      const lc = opcoes.limitesControle
      limitesRows.push([
        'Limites de Controle (+/- 3 sigma)',
        lc ? `LSC: ${lc.lsc.toFixed(4)}${unit}` : 'N/A',
        lc ? `Linha Central (LC): ${lc.lc.toFixed(4)}${unit}` : 'N/A',
        lc ? `LIC: ${lc.lic.toFixed(4)}${unit}` : 'N/A',
        lc ? `Sigma (s): ${lc.sigmaEstimado.toFixed(4)}${unit}` : 'N/A',
      ])
    }

    if (opcoes.secoes.incluirLimitesEspecificacao) {
      const le = opcoes.limitesEspecificacao
      const lseStr = le?.lse !== null && le?.lse !== undefined ? `${le.lse.toFixed(4)}${unit}` : 'Não definido'
      const lieStr = le?.lie !== null && le?.lie !== undefined ? `${le.lie.toFixed(4)}${unit}` : 'Não definido'
      const nomStr = le?.valorNominal !== null && le?.valorNominal !== undefined ? `${le.valorNominal.toFixed(4)}${unit}` : 'N/A'
      const tolStr =
        le?.lse !== null && le?.lie !== null && le?.lse !== undefined && le?.lie !== undefined
          ? `${(le.lse - le.lie).toFixed(4)}${unit}`
          : 'N/A'

      limitesRows.push([
        'Limites de Engenharia',
        `LSE: ${lseStr}`,
        `Nominal: ${nomStr}`,
        `LIE: ${lieStr}`,
        `Tolerância: ${tolStr}`,
      ])
    }

    autoTable(doc, {
      startY: currentY,
      margin: { left: marginLeft, right: marginLeft },
      theme: 'grid',
      head: [['Categoria', 'Superior', 'Central / Nominal', 'Inferior', 'Dispersão / Tolerância']],
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        cellPadding: 2.5,
      },
      styles: {
        fontSize: 8,
        cellPadding: 2.5,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
      },
      columnStyles: {
        0: { fontStyle: 'bold', fillColor: [248, 250, 252], cellWidth: 44 },
      },
      body: limitesRows,
    })

    currentY = (doc as any).lastAutoTable.finalY + 7
  }

  // 4. Análise de Sigmas do Processo
  if (opcoes.secoes.incluirAnaliseSigmas) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(15, 23, 42)
    doc.text('3. Análise de Sigmas do Processo (Distâncias da Linha Central)', marginLeft, currentY)
    currentY += 4

    const zMinStr = metricasSigma.zMin !== null ? `${metricasSigma.zMin.toFixed(2)} sigma` : 'N/A'
    const zLseStr = metricasSigma.zLse !== null ? `${metricasSigma.zLse.toFixed(2)} sigma` : 'N/A'
    const cpkStr = metricasSigma.cpkEquivalente !== null ? metricasSigma.cpkEquivalente.toFixed(3) : 'N/A'

    const isAtributo = opcoes.tipoCarta === 'P' || opcoes.tipoCarta === 'C'
    let distLimitesControleStr = 'N/A'
    if (opcoes.limitesControle) {
      if (isAtributo) {
        const dLsc = (metricasSigma.distanciaLscSigma ?? 3.0).toFixed(2)
        const dLic = (metricasSigma.distanciaLicSigma ?? 3.0).toFixed(2)
        distLimitesControleStr = dLsc === dLic ? `${dLsc} sigma` : `+${dLsc}σ / -${dLic}σ`
      } else {
        const distLscX = (metricasSigma.distanciaLscSigmaXBarra ?? 3.0).toFixed(2)
        distLimitesControleStr = `${distLscX} sigma`
      }
    }

    const cpkTexto = possuiAnomalias
      ? `Cpk Aparente: ${cpkStr} (PROCESSO INSTÁVEL - Requer Estabilização)`
      : `${cpkStr} — ${metricasSigma.classificacaoSigma}`

    const sigmaRows: string[][] = [
      [
        'Distância aos Limites de Controle:',
        distLimitesControleStr,
      ],
      [
        'Distância aos Limites de Especificação:',
        zLseStr,
      ],
      [
        'Nível Sigma do Processo (Zmin):',
        zMinStr,
      ],
      [
        'Capacidade Equivalente (Cpk):',
        cpkTexto,
      ],
    ]

    if (metricasSigma.textoDeslocamento) {
      sigmaRows.push([
        'Deslocamento do Nominal (Offset):',
        metricasSigma.textoDeslocamento,
      ])
    }

    autoTable(doc, {
      startY: currentY,
      margin: { left: marginLeft, right: marginLeft },
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 2.2,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
      },
      columnStyles: {
        0: { fontStyle: 'bold', fillColor: [248, 250, 252], cellWidth: 68 },
        1: { cellWidth: 114 },
      },
      body: sigmaRows,
    })

    currentY = (doc as any).lastAutoTable.finalY + 7
  }

  // 4. Simulação Probabilística Binomial de Conformidade
  if (opcoes.secoes.incluirSimulacaoBinomial && opcoes.simulacaoBinomial) {
    const sim = opcoes.simulacaoBinomial
    const alturaDisponivel = pageHeight - currentY - 20
    if (alturaDisponivel < 45) {
      doc.addPage()
      currentY = 16
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(15, 23, 42)
    doc.text('Análise Probabilística Binomial (Predição de Conformidade)', marginLeft, currentY)
    currentY += 4

    let tipoDesc = 'Sequência Consecutiva Sem Falhas'
    if (sim.tipoArranjo === 'EXATAMENTE') {
      tipoDesc = `Exatamente ${sim.sucessosDesejadosY} conformes em lote de ${sim.tamanhoLoteX}`
    } else if (sim.tipoArranjo === 'PELO_MENOS') {
      tipoDesc = `Pelo menos ${sim.sucessosDesejadosY} conformes em lote de ${sim.tamanhoLoteX} (≥ ${sim.sucessosDesejadosY})`
    } else if (sim.tipoArranjo === 'NO_MAXIMO') {
      tipoDesc = `No máximo ${sim.sucessosDesejadosY} conformes em lote de ${sim.tamanhoLoteX} (≤ ${sim.sucessosDesejadosY})`
    } else {
      tipoDesc = `${sim.tamanhoLoteX} produtos consecutivos sem falha`
    }

    let critDesc = 'Dentro de Z Sigmas da Linha Central'
    if (sim.criterio === 'LIMITES_CONTROLE') critDesc = 'Dentro dos Limites de Controle (LIC e LSC)'
    if (sim.criterio === 'LIMITES_ESPECIFICACAO') critDesc = 'Dentro dos Limites de Engenharia (LIE e LSE)'

    const faixaTexto =
      sim.faixaInferior !== null && sim.faixaSuperior !== null
        ? `[${sim.faixaInferior.toFixed(3)} a ${sim.faixaSuperior.toFixed(3)}]`
        : sim.faixaSuperior !== null
          ? `[<= ${sim.faixaSuperior.toFixed(3)}]`
          : sim.faixaInferior !== null
            ? `[>= ${sim.faixaInferior.toFixed(3)}]`
            : 'N/D'

    const simRows: string[][] = [
      ['Tipo de Pergunta / Arranjo:', tipoDesc],
      ['Critério de Tolerância:', critDesc],
      [
        'Escopo Amostral:',
        sim.escopo === 'MEDIA_SUBGRUPO' ? 'Média de Subgrupo (X̄)' : 'Produto Individual (X)',
      ],
      ['Faixa Numérica Avaliada:', `${faixaTexto} (p = ${(sim.probabilidadeUnitariaP * 100).toFixed(4)}%)`],
      [
        'Tamanho da Amostra / Lote (X):',
        `${sim.tamanhoLoteX} itens (C(${sim.tamanhoLoteX}, ${sim.sucessosDesejadosY}) = ${sim.combinacoes} combinação${sim.combinacoes > 1 ? 'ões' : ''})`,
      ],
      ['Probabilidade Resultante P:', `${(sim.probabilidadeFinal * 100).toFixed(4)}%`],
    ]

    autoTable(doc, {
      startY: currentY,
      margin: { left: marginLeft, right: marginLeft },
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 2.2,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
      },
      columnStyles: {
        0: { fontStyle: 'bold', fillColor: [248, 250, 252], cellWidth: 68 },
        1: { cellWidth: 114 },
      },
      body: simRows,
    })

    currentY = (doc as any).lastAutoTable.finalY + 7
  }

  // 5. Imagem do Gráfico de Controle
  if (opcoes.secoes.incluirGrafico && opcoes.imagemGrafico) {
    const alturaDisponivel = pageHeight - currentY - 20
    const alturaGraficoDesejada = 80

    // Se não houver espaço suficiente na página atual para o gráfico, quebra para página 2
    if (alturaDisponivel < alturaGraficoDesejada) {
      doc.addPage()
      currentY = 16
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(15, 23, 42)
    doc.text('4. Gráfico de Controle em Tempo Real (Snapshot no Momento da Emissão)', marginLeft, currentY)
    currentY += 4

    try {
      const chartWidth = contentWidth
      const chartHeight = 78
      doc.setDrawColor(203, 213, 225)
      doc.setLineWidth(0.3)
      doc.rect(marginLeft, currentY, chartWidth, chartHeight)

      doc.addImage(opcoes.imagemGrafico, 'PNG', marginLeft, currentY, chartWidth, chartHeight)
      currentY += chartHeight + 3

      doc.setFont('helvetica', 'italic')
      doc.setFontSize(7.5)
      doc.setTextColor(100, 116, 139)
      doc.text(
        '* Figura 1: Visualização gráfica capturada do painel ECharts contendo os limites e subgrupos da sessão.',
        marginLeft,
        currentY
      )
      currentY += 7
    } catch {
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(8)
      doc.setTextColor(239, 68, 68)
      doc.text('Não foi possível renderizar a imagem do gráfico no documento.', marginLeft, currentY)
      currentY += 6
    }
  }

  // 6. Tabela de Amostras Recentes (Opcional)
  if (opcoes.secoes.incluirTabelaAmostras && opcoes.subgrupos && opcoes.subgrupos.length > 0) {
    // Geralmente a tabela de subgrupos vai em nova página se o gráfico estiver presente
    if (currentY > 160) {
      doc.addPage()
      currentY = 16
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(15, 23, 42)
    doc.text('5. Histórico Recente de Subgrupos Amostrais', marginLeft, currentY)
    currentY += 4

    // Pega as últimas 25 amostras para caber de maneira limpa
    const ultimasAmostras = opcoes.subgrupos.slice(-25)
    const isCartaP = opcoes.tipoCarta === 'P'
    const isCartaC = opcoes.tipoCarta === 'C'

    const tabelaRows = ultimasAmostras.map((sg) => {
      let valsStr = ''
      if (isCartaP || isCartaC) {
        valsStr = sg.valores_brutos.map((v) => String(Math.round(v))).join(', ')
      } else {
        valsStr = sg.valores_brutos.map((v) => Number(v.toFixed(4)).toFixed(3)).join(', ')
      }

      const reg = sg.violacoes && sg.violacoes.length > 0
        ? sg.violacoes.map((v) => v.codigo_regra).join(', ')
        : 'Estável'
      const statusStr = sg.fora_de_controle ? 'ANOMALIA' : 'SOB CONTROLE'

      let mediaCol = sg.estatisticas.media_x.toFixed(4)
      let dispCol = '-'
      if (isCartaP) {
        mediaCol = sg.estatisticas.media_x.toFixed(4)
        const defeitos = Math.round(
          sg.estatisticas.amplitude_r ?? (sg.estatisticas.media_x * sg.valores_brutos.length)
        )
        dispCol = `${defeitos} def`
      } else if (isCartaC) {
        mediaCol = String(Math.round(sg.estatisticas.media_x))
        dispCol = sg.estatisticas.desvio_s !== undefined ? sg.estatisticas.desvio_s.toFixed(2) : '-'
      } else {
        dispCol = sg.estatisticas.amplitude_r !== undefined
          ? sg.estatisticas.amplitude_r.toFixed(4)
          : (sg.estatisticas.desvio_s?.toFixed(4) ?? '-')
      }

      return [
        `#${String(sg.numero_subgrupo).padStart(3, '0')}`,
        mediaCol,
        dispCol,
        valsStr,
        statusStr,
        reg,
      ]
    })

    const headMedia = isCartaP ? 'Taxa (p)' : isCartaC ? 'Contagem (c)' : 'Média (X)'
    const headDisp = isCartaP ? 'Defeitos (d)' : isCartaC ? 'Desvio (σc)' : 'Disp (R/s)'

    autoTable(doc, {
      startY: currentY,
      margin: { left: marginLeft, right: marginLeft },
      theme: 'striped',
      head: [['#', headMedia, headDisp, 'Amostras', 'Condição', 'Regras Nelson']],
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.5,
        cellPadding: 2,
      },
      styles: {
        fontSize: 7,
        cellPadding: 1.8,
        textColor: [30, 41, 59],
      },
      columnStyles: {
        0: { cellWidth: 14, fontStyle: 'bold' },
        1: { cellWidth: 22 },
        2: { cellWidth: 22 },
        3: { cellWidth: 62 },
        4: { cellWidth: 28 },
        5: { cellWidth: 34 },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 4) {
          if (data.cell.raw === 'ANOMALIA') {
            data.cell.styles.textColor = [220, 38, 38] // red-600
            data.cell.styles.fontStyle = 'bold'
          } else {
            data.cell.styles.textColor = [22, 163, 74] // green-600
          }
        }
      },
      body: tabelaRows,
    })

    currentY = (doc as any).lastAutoTable.finalY + 6

    // Legenda resumindo o significado de cada Regra de Nelson
    const alturaDisponivelLegenda = pageHeight - currentY - 20
    const alturaEstimadaLegenda = 48
    if (alturaDisponivelLegenda < alturaEstimadaLegenda) {
      doc.addPage()
      currentY = 16
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(15, 23, 42)
    doc.text('Legenda das Regras de Nelson (Identificação de Causas Especiais)', marginLeft, currentY)
    currentY += 3.5

    const legendaNelsonRows = [
      ['Regra 1', '1 ponto fora dos limites de 3 sigma (além de LSC ou LIC).'],
      ['Regra 2', '9 pontos consecutivos do mesmo lado da Linha Central.'],
      ['Regra 3', '6 pontos consecutivos continuamente crescentes ou decrescentes.'],
      ['Regra 4', '14 pontos consecutivos alternando para cima e para baixo.'],
      ['Regra 5', '2 de 3 pontos consecutivos além de 2 sigma do mesmo lado da Linha Central.'],
      ['Regra 6', '4 de 5 pontos consecutivos além de 1 sigma do mesmo lado da Linha Central.'],
      ['Regra 7', '15 pontos consecutivos dentro de 1 sigma da Linha Central (Zona C).'],
      ['Regra 8', '8 pontos consecutivos além de 1 sigma em ambos os lados sem nenhum na Zona C.'],
      ['Regra Disp', '1 ponto fora dos limites de controle de dispersão (amplitude R ou desvio s além de LSC/LIC).'],
    ]

    autoTable(doc, {
      startY: currentY,
      margin: { left: marginLeft, right: marginLeft },
      theme: 'grid',
      head: [['Identificador', 'Resumo da Regra de Nelson / Causa Especial']],
      headStyles: {
        fillColor: [51, 65, 85],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7,
        cellPadding: 1.6,
      },
      styles: {
        fontSize: 6.5,
        cellPadding: 1.4,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 26, fillColor: [248, 250, 252] },
        1: { cellWidth: 156 },
      },
      body: legendaNelsonRows,
    })

    currentY = (doc as any).lastAutoTable.finalY + 7
  }

  // 7. Numeração de Páginas e Rodapé
  const totalPaginas = doc.getNumberOfPages()
  for (let i = 1; i <= totalPaginas; i++) {
    doc.setPage(i)
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.3)
    doc.line(marginLeft, pageHeight - 12, pageWidth - marginLeft, pageHeight - 12)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(148, 163, 184)
    doc.text('Sistema CEP — Controle Estatístico de Processos Industrial em Tempo Real', marginLeft, pageHeight - 7)
    doc.text(`Página ${i} de ${totalPaginas}`, pageWidth - marginLeft, pageHeight - 7, { align: 'right' })
  }

  // 8. Salvar arquivo
  const codLinha = (opcoes.codigoLinha || 'PROCESSO').replace(/[^a-zA-Z0-9_-]/g, '_')
  const tipo = (opcoes.tipoCarta || 'CEP').replace(/[^a-zA-Z0-9_-]/g, '_')
  const ts = agora.toISOString().slice(0, 10)
  const nomeArquivo = `relatorio-cep-${codLinha}-${tipo}-${ts}.pdf`

  doc.save(nomeArquivo)

  return {
    sucesso: true,
    nomeArquivo,
    metricasSigma,
  }
}
