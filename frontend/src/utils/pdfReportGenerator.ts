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

export interface SecoesRelatorioPDF {
  incluirMetadados: boolean
  incluirGrafico: boolean
  incluirLimitesControle: boolean
  incluirLimitesEspecificacao: boolean
  incluirAnaliseSigmas: boolean
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

  secoes: SecoesRelatorioPDF
}

export interface MetricasSigma {
  distanciaLscSigma: number | null
  distanciaLicSigma: number | null
  zLse: number | null
  zLie: number | null
  zMin: number | null
  cpkEquivalente: number | null
  classificacaoSigma: string
}

/**
 * Calcula a distância da Linha Central aos limites de controle e de especificação em número de Sigmas.
 */
export function calcularMetricasSigma(
  limitesControle?: LimitesControleReport | null,
  limitesEspecificacao?: LimitesEspecificacaoReport | null
): MetricasSigma {
  if (!limitesControle || !limitesControle.sigmaEstimado || limitesControle.sigmaEstimado <= 0) {
    return {
      distanciaLscSigma: null,
      distanciaLicSigma: null,
      zLse: null,
      zLie: null,
      zMin: null,
      cpkEquivalente: null,
      classificacaoSigma: 'Indisponível (Sem Sigma)',
    }
  }

  const { lc, lsc, lic, sigmaEstimado } = limitesControle
  const distanciaLscSigma = Number(((lsc - lc) / sigmaEstimado).toFixed(2))
  const distanciaLicSigma = Number(((lc - lic) / sigmaEstimado).toFixed(2))

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
        classificacaoSigma = 'Nível World-Class (6.0σ+)'
      } else if (zMin >= 4.0) {
        classificacaoSigma = 'Nível Excelente / Alta Precisão (4.0σ a 5.9σ)'
      } else if (zMin >= 3.0) {
        classificacaoSigma = 'Nível Adequado / Estável (3.0σ a 3.9σ)'
      } else if (zMin >= 2.0) {
        classificacaoSigma = 'Nível Crítico / Alto Risco (2.0σ a 2.9σ)'
      } else {
        classificacaoSigma = 'Nível Incapaz / Fora de Tolerância (< 2.0σ)'
      }
    }
  }

  return {
    distanciaLscSigma,
    distanciaLicSigma,
    zLse,
    zLie,
    zMin,
    cpkEquivalente,
    classificacaoSigma,
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

  const metricasSigma = calcularMetricasSigma(opcoes.limitesControle, opcoes.limitesEspecificacao)

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

    const metadataBody = [
      [
        'Código da Linha:',
        opcoes.codigoLinha || 'LINHA-PADRÃO',
        'Tipo da Carta:',
        opcoes.tipoCarta || 'X_R',
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
        'Limites de Controle (+/- 3σ)',
        lc ? `LSC: ${lc.lsc.toFixed(4)}${unit}` : 'N/A',
        lc ? `Linha Central (LC): ${lc.lc.toFixed(4)}${unit}` : 'N/A',
        lc ? `LIC: ${lc.lic.toFixed(4)}${unit}` : 'N/A',
        lc ? `Sigma (σ): ${lc.sigmaEstimado.toFixed(4)}${unit}` : 'N/A',
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

    const zMinStr = metricasSigma.zMin !== null ? `${metricasSigma.zMin.toFixed(2)}σ` : 'N/A'
    const zLseStr = metricasSigma.zLse !== null ? `${metricasSigma.zLse.toFixed(2)}σ` : 'N/A'
    const zLieStr = metricasSigma.zLie !== null ? `${metricasSigma.zLie.toFixed(2)}σ` : 'N/A'
    const cpkStr = metricasSigma.cpkEquivalente !== null ? metricasSigma.cpkEquivalente.toFixed(3) : 'N/A'

    const sigmaRows = [
      [
        'Distância aos Limites de Controle:',
        `+${metricasSigma.distanciaLscSigma ?? 3.0}σ (LC até LSC) | -${metricasSigma.distanciaLicSigma ?? 3.0}σ (LC até LIC)`,
      ],
      [
        'Distância aos Limites de Especificação:',
        `Superior (ZLSE): ${zLseStr} | Inferior (ZLIE): ${zLieStr}`,
      ],
      [
        'Nível Sigma do Processo (Zmin):',
        `${zMinStr} (Distância ao limite de especificação crítico mais próximo)`,
      ],
      [
        'Capacidade Equivalente (Cpk ≈ Z/3):',
        `${cpkStr} — ${metricasSigma.classificacaoSigma}`,
      ],
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
        0: { fontStyle: 'bold', fillColor: [248, 250, 252], cellWidth: 62 },
        1: { cellWidth: 120 },
      },
      body: sigmaRows,
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

    // Pega as últimas 20 amostras para caber de maneira limpa
    const ultimasAmostras = opcoes.subgrupos.slice(-25)
    const tabelaRows = ultimasAmostras.map((sg) => {
      const valsStr = sg.valores_brutos.map((v) => v.toFixed(2)).join(', ')
      const reg = sg.violacoes && sg.violacoes.length > 0
        ? sg.violacoes.map((v) => v.codigo_regra).join(', ')
        : 'Estável'
      const statusStr = sg.fora_de_controle ? 'ANOMALIA' : 'SOB CONTROLE'

      return [
        `#${String(sg.numero_subgrupo).padStart(3, '0')}`,
        sg.estatisticas.media_x.toFixed(4),
        sg.estatisticas.amplitude_r !== undefined ? sg.estatisticas.amplitude_r.toFixed(4) : (sg.estatisticas.desvio_s?.toFixed(4) ?? '-'),
        valsStr,
        statusStr,
        reg,
      ]
    })

    autoTable(doc, {
      startY: currentY,
      margin: { left: marginLeft, right: marginLeft },
      theme: 'striped',
      head: [['#', 'Média (X̄)', 'Disp (R/s)', 'Amostras', 'Condição', 'Regras Nelson']],
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
