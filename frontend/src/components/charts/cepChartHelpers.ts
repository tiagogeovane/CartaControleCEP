import type { EChartsOption } from 'echarts'
import type {
  LimitesControleSchema,
  LimitesEspecificacaoSchema,
  SubgrupoResponse,
} from '@/types/api'
import { REGRAS_NELSON_METADATA } from '@/types/cep'
import {
  calcularLimitesAmplitudeMovelMR,
  calcularLimitesAmplitudeR,
  calcularLimitesDesvioS,
  obterConstantesXR,
  obterConstantesXS,
  type LimitesDispersao,
} from '@/utils/cepConstants'

export interface BuildCEPOptionsParams {
  subgrupos: SubgrupoResponse[]
  limites?: LimitesControleSchema | null
  especificacoes?: LimitesEspecificacaoSchema | null
  tamanhoSubgrupo: number
  janelaZoom?: number | 'todos'
}

/**
 * Formata tooltip HTML acessível com detalhes analíticos do subgrupo e Regras de Nelson
 */
export function gerarTooltipHTML(
  subgrupo: SubgrupoResponse,
  tipoDispersaoNome: string,
  tipoDispersaoValor: number
): string {
  const dataFormatada = new Date(subgrupo.timestamp).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  let html = `
    <div style="font-family: 'JetBrains Mono', monospace; font-size: 12px; min-width: 220px; color: #F8FAFC;">
      <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #334155; padding-bottom: 4px; margin-bottom: 6px;">
        <span style="font-weight: 700; color: #60A5FA;">Subgrupo #${subgrupo.numero_subgrupo}</span>
        <span style="color: #94A3B8;">${dataFormatada}</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
        <span style="color: #94A3B8;">Média (X̄):</span>
        <span style="font-weight: 600; color: #F8FAFC;">${subgrupo.estatisticas.media_x.toFixed(4)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
        <span style="color: #94A3B8;">${tipoDispersaoNome}:</span>
        <span style="font-weight: 600; color: #F8FAFC;">${tipoDispersaoValor.toFixed(4)}</span>
      </div>
      <div style="margin-top: 4px; padding-top: 4px; border-top: 1px solid #1E293B;">
        <span style="color: #94A3B8; font-size: 11px;">Amostras:</span>
        <span style="color: #CBD5E1; font-size: 11px;">[${subgrupo.valores_brutos.map((v) => v.toFixed(2)).join(', ')}]</span>
      </div>
  `

  if (subgrupo.fora_de_controle || (subgrupo.violacoes && subgrupo.violacoes.length > 0)) {
    html += `
      <div style="margin-top: 8px; padding-top: 6px; border-top: 1px dashed #EF4444;">
        <div style="color: #EF4444; font-weight: 700; margin-bottom: 4px;">🚨 ANOMALIA DETECTADA:</div>
    `
    if (subgrupo.violacoes && subgrupo.violacoes.length > 0) {
      subgrupo.violacoes.forEach((v) => {
        const meta = REGRAS_NELSON_METADATA[v.codigo_regra]
        const nomeRegra = meta ? meta.nome : v.codigo_regra
        html += `
          <div style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 4px; padding: 3px 6px; margin-bottom: 3px;">
            <span style="color: #F87171; font-weight: 600;">${nomeRegra}</span>
            <div style="color: #E2E8F0; font-size: 10px; margin-top: 2px;">${v.descricao}</div>
          </div>
        `
      })
    } else {
      html += `
        <div style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 4px; padding: 3px 6px; margin-bottom: 3px;">
          <span style="color: #F87171; font-weight: 600;">Ponto Fora de Controle Estatístico</span>
        </div>
      `
    }
    html += `</div>`
  }

  html += `</div>`
  return html
}

/**
 * Cria a configuração ECharts completa para gráficos sincronizados (Média + Dispersão)
 */
export function buildChartOptionGenerico(
  params: BuildCEPOptionsParams,
  configDispersao: {
    tituloDispersao: string
    nomeMetrica: string
    extrairValor: (sg: SubgrupoResponse, index: number, all: SubgrupoResponse[]) => number
    calcularLimites: (valores: number[], n: number) => LimitesDispersao
    calcularLimitesMediaFallback?: (
      mediaX: number,
      limitesDisp: LimitesDispersao,
      n: number
    ) => { lsc: number; lic: number; sigma: number }
  }
): EChartsOption {
  const { subgrupos, limites, especificacoes, tamanhoSubgrupo, janelaZoom = 'todos' } = params

  const categorias = subgrupos.map((sg) => `#${sg.numero_subgrupo}`)
  const dadosMedia = subgrupos.map((sg) => sg.estatisticas.media_x)
  const dadosDispersao = subgrupos.map((sg, idx, arr) => configDispersao.extrairValor(sg, idx, arr))

  // Subgrupos anômalos (para destacar com effectScatter pulsante)
  const anomaliasMedia = subgrupos
    .map((sg, index) => {
      if (sg.fora_de_controle || (sg.violacoes && sg.violacoes.length > 0)) {
        return [index, sg.estatisticas.media_x]
      }
      return null
    })
    .filter((item): item is [number, number] => item !== null)

  // Limites de Dispersão
  const limitesDisp = configDispersao.calcularLimites(dadosDispersao, tamanhoSubgrupo)

  // Limites da Linha Superior (Média)
  const mediaCalculada = dadosMedia.length > 0 ? dadosMedia.reduce((a, b) => a + b, 0) / dadosMedia.length : 0
  const fallback = configDispersao.calcularLimitesMediaFallback
    ? configDispersao.calcularLimitesMediaFallback(mediaCalculada, limitesDisp, tamanhoSubgrupo)
    : { lsc: mediaCalculada + 1, lic: mediaCalculada - 1, sigma: 1 / 3 }

  const lc = limites?.lc ?? mediaCalculada
  const lsc = limites?.lsc ?? fallback.lsc
  const lic = limites?.lic ?? fallback.lic
  const sigma = limites?.sigma_estimado ?? fallback.sigma

  // Linhas de Referência markLine da Média (X̄)
  const markLineMediaData: any[] = [
    {
      name: 'LC',
      yAxis: lc,
      lineStyle: { color: '#3B82F6', width: 2, type: 'solid' },
      label: { formatter: `LC: ${lc.toFixed(3)}`, position: 'insideEndTop', color: '#60A5FA', fontSize: 10 },
    },
    {
      name: 'LSC',
      yAxis: lsc,
      lineStyle: { color: '#EF4444', width: 1.5, type: 'dashed' },
      label: { formatter: `LSC: ${lsc.toFixed(3)}`, position: 'insideEndTop', color: '#F87171', fontSize: 10 },
    },
    {
      name: 'LIC',
      yAxis: lic,
      lineStyle: { color: '#EF4444', width: 1.5, type: 'dashed' },
      label: { formatter: `LIC: ${lic.toFixed(3)}`, position: 'insideEndBottom', color: '#F87171', fontSize: 10 },
    },
  ]

  if (especificacoes?.lse != null) {
    markLineMediaData.push({
      name: 'LSE',
      yAxis: especificacoes.lse,
      lineStyle: { color: '#8B5CF6', width: 1.5, type: 'dotted' },
      label: { formatter: `LSE: ${especificacoes.lse.toFixed(2)}`, position: 'insideEndTop', color: '#A78BFA', fontSize: 10 },
    })
  }
  if (especificacoes?.lie != null) {
    markLineMediaData.push({
      name: 'LIE',
      yAxis: especificacoes.lie,
      lineStyle: { color: '#8B5CF6', width: 1.5, type: 'dotted' },
      label: { formatter: `LIE: ${especificacoes.lie.toFixed(2)}`, position: 'insideEndBottom', color: '#A78BFA', fontSize: 10 },
    })
  }

  // Zonas Sigma (A, B, C) via markArea
  const markAreaZonas: any[] = [
    // Zona C (± 1 sigma)
    [
      { yAxis: lc - sigma, itemStyle: { color: 'rgba(59, 130, 246, 0.05)' } },
      { yAxis: lc + sigma },
    ],
    // Zona B (+1 a +2 sigma e -1 a -2 sigma)
    [
      { yAxis: lc + sigma, itemStyle: { color: 'rgba(245, 158, 11, 0.05)' } },
      { yAxis: lc + 2 * sigma },
    ],
    [
      { yAxis: lc - 2 * sigma, itemStyle: { color: 'rgba(245, 158, 11, 0.05)' } },
      { yAxis: lc - sigma },
    ],
    // Zona A (+2 a +3 sigma e -2 a -3 sigma)
    [
      { yAxis: lc + 2 * sigma, itemStyle: { color: 'rgba(239, 68, 68, 0.05)' } },
      { yAxis: lc + 3 * sigma },
    ],
    [
      { yAxis: lc - 3 * sigma, itemStyle: { color: 'rgba(239, 68, 68, 0.05)' } },
      { yAxis: lc - 2 * sigma },
    ],
  ]

  // Linhas markLine da Dispersão
  const markLineDispersaoData: any[] = [
    {
      name: 'LC',
      yAxis: limitesDisp.lc,
      lineStyle: { color: '#3B82F6', width: 1.5, type: 'solid' },
      label: { formatter: `LC: ${limitesDisp.lc.toFixed(3)}`, position: 'insideEndTop', color: '#60A5FA', fontSize: 10 },
    },
    {
      name: 'LSC',
      yAxis: limitesDisp.lsc,
      lineStyle: { color: '#EF4444', width: 1.5, type: 'dashed' },
      label: { formatter: `LSC: ${limitesDisp.lsc.toFixed(3)}`, position: 'insideEndTop', color: '#F87171', fontSize: 10 },
    },
    {
      name: 'LIC',
      yAxis: limitesDisp.lic,
      lineStyle: { color: '#EF4444', width: 1.5, type: 'dashed' },
      label: { formatter: `LIC: ${limitesDisp.lic.toFixed(3)}`, position: 'insideEndBottom', color: '#F87171', fontSize: 10 },
    },
  ]

  // Calcular intervalo de zoom inicial
  let startPercent = 0
  if (typeof janelaZoom === 'number' && subgrupos.length > janelaZoom) {
    startPercent = ((subgrupos.length - janelaZoom) / subgrupos.length) * 100
  }

  return {
    backgroundColor: 'transparent',
    animation: false, // Performance ultra rápida para streaming
    axisPointer: {
      link: [{ xAxisIndex: 'all' }],
      label: { backgroundColor: '#1E293B', color: '#F8FAFC' },
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#0F172A',
      borderColor: '#334155',
      borderWidth: 1,
      padding: 10,
      formatter: (params: any) => {
        const itemIndex = params[0]?.dataIndex
        if (itemIndex == null || !subgrupos[itemIndex]) return ''
        const sg = subgrupos[itemIndex]
        return gerarTooltipHTML(sg, configDispersao.nomeMetrica, configDispersao.extrairValor(sg, itemIndex, subgrupos))
      },
    },
    grid: [
      { left: 60, right: 30, top: '8%', height: '42%' },
      { left: 60, right: 30, top: '58%', height: '32%' },
    ],
    xAxis: [
      {
        type: 'category',
        gridIndex: 0,
        data: categorias,
        axisLine: { lineStyle: { color: '#334155' } },
        axisLabel: { show: false },
      },
      {
        type: 'category',
        gridIndex: 1,
        data: categorias,
        axisLine: { lineStyle: { color: '#334155' } },
        axisLabel: { color: '#94A3B8', fontSize: 10, fontFamily: 'JetBrains Mono' },
      },
    ],
    yAxis: [
      {
        type: 'value',
        gridIndex: 0,
        name: 'Média (X̄)',
        nameTextStyle: { color: '#94A3B8', fontSize: 11 },
        scale: true,
        splitLine: { lineStyle: { color: '#1E293B', opacity: 0.7 } },
        axisLabel: { color: '#94A3B8', fontSize: 10, fontFamily: 'JetBrains Mono' },
      },
      {
        type: 'value',
        gridIndex: 1,
        name: configDispersao.tituloDispersao,
        nameTextStyle: { color: '#94A3B8', fontSize: 11 },
        scale: true,
        splitLine: { lineStyle: { color: '#1E293B', opacity: 0.7 } },
        axisLabel: { color: '#94A3B8', fontSize: 10, fontFamily: 'JetBrains Mono' },
      },
    ],
    dataZoom: [
      {
        type: 'inside',
        xAxisIndex: [0, 1],
        start: startPercent,
        end: 100,
      },
      {
        type: 'slider',
        xAxisIndex: [0, 1],
        bottom: 5,
        height: 16,
        borderColor: '#334155',
        backgroundColor: '#0F172A',
        fillerColor: 'rgba(59, 130, 246, 0.2)',
        handleStyle: { color: '#3B82F6' },
        textStyle: { color: '#94A3B8', fontSize: 9 },
        start: startPercent,
        end: 100,
      },
    ],
    series: [
      // Série 0: Linha Contínua da Média (X̄)
      {
        name: 'Média (X̄)',
        type: 'line',
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: dadosMedia,
        smooth: 0.25,
        symbol: 'circle',
        symbolSize: 6,
        itemStyle: { color: '#38BDF8' },
        lineStyle: { width: 2, color: '#38BDF8' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(56, 189, 248, 0.12)' },
              { offset: 1, color: 'rgba(56, 189, 248, 0.00)' },
            ],
          },
        },
        markLine: {
          silent: true,
          symbol: 'none',
          data: markLineMediaData,
        },
        markArea: {
          silent: true,
          data: markAreaZonas,
        },
      },
      // Série 1: Efeito Pulsante para Violações de Nelson (X̄)
      {
        name: 'Anomalias',
        type: 'effectScatter',
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: anomaliasMedia,
        symbolSize: 12,
        rippleEffect: { scale: 3, brushType: 'stroke' },
        itemStyle: { color: '#EF4444' },
        zlevel: 5,
      },
      // Série 2: Linha Contínua da Dispersão
      {
        name: configDispersao.tituloDispersao,
        type: 'line',
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: dadosDispersao,
        smooth: 0.25,
        symbol: 'circle',
        symbolSize: 5,
        itemStyle: { color: '#34D399' },
        lineStyle: { width: 1.5, color: '#34D399' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(52, 211, 153, 0.10)' },
              { offset: 1, color: 'rgba(52, 211, 153, 0.00)' },
            ],
          },
        },
        markLine: {
          silent: true,
          symbol: 'none',
          data: markLineDispersaoData,
        },
      },
    ],
  }
}

/**
 * Construtor para Carta X̄-R
 */
export function buildXRChartOption(params: BuildCEPOptionsParams): EChartsOption {
  return buildChartOptionGenerico(params, {
    tituloDispersao: 'Amplitude (R)',
    nomeMetrica: 'Amplitude (R)',
    extrairValor: (sg) => sg.estatisticas.amplitude_r,
    calcularLimites: (valores, n) => {
      const mediaR = valores.length > 0 ? valores.reduce((a, b) => a + b, 0) / valores.length : 0
      return calcularLimitesAmplitudeR(mediaR, n)
    },
    calcularLimitesMediaFallback: (mediaX, limitesDisp, n) => {
      const { a2, d2 } = obterConstantesXR(n)
      const rBarra = limitesDisp.lc
      return {
        lsc: Number((mediaX + a2 * rBarra).toFixed(4)),
        lic: Number((mediaX - a2 * rBarra).toFixed(4)),
        sigma: d2 > 0 ? Number((rBarra / d2).toFixed(4)) : Math.abs(a2 * rBarra) / 3,
      }
    },
  })
}

/**
 * Construtor para Carta X̄-s
 */
export function buildXSChartOption(params: BuildCEPOptionsParams): EChartsOption {
  return buildChartOptionGenerico(params, {
    tituloDispersao: 'Desvio Padrão (s)',
    nomeMetrica: 'Desvio Padrão (s)',
    extrairValor: (sg) => sg.estatisticas.desvio_s,
    calcularLimites: (valores, n) => {
      const mediaS = valores.length > 0 ? valores.reduce((a, b) => a + b, 0) / valores.length : 0
      return calcularLimitesDesvioS(mediaS, n)
    },
    calcularLimitesMediaFallback: (mediaX, limitesDisp, n) => {
      const { a3, c4 } = obterConstantesXS(n)
      const sBarra = limitesDisp.lc
      return {
        lsc: Number((mediaX + a3 * sBarra).toFixed(4)),
        lic: Number((mediaX - a3 * sBarra).toFixed(4)),
        sigma: c4 > 0 ? Number((sBarra / c4).toFixed(4)) : Math.abs(a3 * sBarra) / 3,
      }
    },
  })
}

/**
 * Construtor para Carta I-MR (Valores Individuais e Amplitude Móvel)
 */
export function buildIMRChartOption(params: BuildCEPOptionsParams): EChartsOption {
  return buildChartOptionGenerico(params, {
    tituloDispersao: 'Amplitude Móvel (MR)',
    nomeMetrica: 'Amplitude Móvel (MR)',
    extrairValor: (sg, index, all) =>
      index > 0 && all && all[index - 1]
        ? Math.abs(sg.estatisticas.media_x - all[index - 1].estatisticas.media_x)
        : 0,
    calcularLimites: (valores) => {
      const valoresValidos = valores.length > 1 ? valores.slice(1) : valores
      const mediaMR = valoresValidos.length > 0 ? valoresValidos.reduce((a, b) => a + b, 0) / valoresValidos.length : 0
      return calcularLimitesAmplitudeMovelMR(mediaMR)
    },
    calcularLimitesMediaFallback: (mediaX, limitesDisp) => {
      const mrBarra = limitesDisp.lc
      const fator = 3.0 / 1.128
      return {
        lsc: Number((mediaX + fator * mrBarra).toFixed(4)),
        lic: Number((mediaX - fator * mrBarra).toFixed(4)),
        sigma: Number((mrBarra / 1.128).toFixed(4)),
      }
    },
  })
}
