import { forwardRef, useMemo } from 'react'
import { BaseChart, type BaseChartRef } from './BaseChart'
import { buildIMRChartOption } from './cepChartHelpers'
import type { CartaChartProps } from './CartaXRChart'

export const CartaIMRChart = forwardRef<BaseChartRef, CartaChartProps>(
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
        buildIMRChartOption({
          subgrupos,
          limites,
          especificacoes,
          tamanhoSubgrupo,
          janelaZoom,
        }),
      [subgrupos, limites, especificacoes, tamanhoSubgrupo, janelaZoom]
    )

    return (
      <div data-testid="carta-imr-chart" className="w-full">
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

CartaIMRChart.displayName = 'CartaIMRChart'
