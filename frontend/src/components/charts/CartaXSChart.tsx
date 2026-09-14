import { forwardRef, useMemo } from 'react'
import { BaseChart, type BaseChartRef } from './BaseChart'
import { buildXSChartOption } from './cepChartHelpers'
import type { CartaChartProps } from './CartaXRChart'

export const CartaXSChart = forwardRef<BaseChartRef, CartaChartProps>(
  (
    {
      subgrupos,
      limites,
      especificacoes,
      tamanhoSubgrupo,
      janelaZoom = 'todos',
      loading = false,
      className,
      height = 560,
    },
    ref
  ) => {
    const option = useMemo(
      () =>
        buildXSChartOption({
          subgrupos,
          limites,
          especificacoes,
          tamanhoSubgrupo,
          janelaZoom,
        }),
      [subgrupos, limites, especificacoes, tamanhoSubgrupo, janelaZoom]
    )

    return (
      <div data-testid="carta-xs-chart" className="w-full">
        <BaseChart
          ref={ref}
          option={option}
          loading={loading}
          className={className}
          height={height}
          notMerge={false}
        />
      </div>
    )
  }
)

CartaXSChart.displayName = 'CartaXSChart'
