import { forwardRef, useMemo } from 'react'
import type {
  LimitesControleSchema,
  LimitesEspecificacaoSchema,
  SubgrupoResponse,
} from '@/types/api'
import { BaseChart, type BaseChartRef } from './BaseChart'
import { buildXRChartOption } from './cepChartHelpers'

export interface CartaChartProps {
  subgrupos: SubgrupoResponse[]
  limites?: LimitesControleSchema | null
  especificacoes?: LimitesEspecificacaoSchema | null
  tamanhoSubgrupo: number
  janelaZoom?: number | 'todos'
  loading?: boolean
  className?: string
  height?: number | string
}

export const CartaXRChart = forwardRef<BaseChartRef, CartaChartProps>(
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
        buildXRChartOption({
          subgrupos,
          limites,
          especificacoes,
          tamanhoSubgrupo,
          janelaZoom,
        }),
      [subgrupos, limites, especificacoes, tamanhoSubgrupo, janelaZoom]
    )

    return (
      <div data-testid="carta-xr-chart" className="w-full">
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

CartaXRChart.displayName = 'CartaXRChart'
