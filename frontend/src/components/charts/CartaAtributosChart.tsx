import { forwardRef, useMemo } from 'react'
import type {
  LimitesControleSchema,
  LimitesEspecificacaoSchema,
  SubgrupoResponse,
} from '@/types/api'
import { BaseChart, type BaseChartRef } from './BaseChart'
import { buildAtributosChartOption } from './cepChartHelpers'

export interface CartaAtributosChartProps {
  subgrupos: SubgrupoResponse[]
  limites?: LimitesControleSchema | null
  especificacoes?: LimitesEspecificacaoSchema | null
  tamanhoSubgrupo: number
  tipoCarta?: 'P' | 'C' | string
  janelaZoom?: number | 'todos'
  loading?: boolean
  className?: string
  height?: number | string
}

export const CartaAtributosChart = forwardRef<BaseChartRef, CartaAtributosChartProps>(
  (
    {
      subgrupos,
      limites,
      tamanhoSubgrupo,
      tipoCarta = 'P',
      janelaZoom = 'todos',
      loading = false,
      className,
      height = 560,
    },
    ref
  ) => {
    const option = useMemo(
      () =>
        buildAtributosChartOption({
          subgrupos,
          limites,
          tipoCarta,
          tamanhoSubgrupo,
          janelaZoom,
        }),
      [subgrupos, limites, tipoCarta, tamanhoSubgrupo, janelaZoom]
    )

    return (
      <div data-testid="carta-atributos-chart" className="w-full">
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

CartaAtributosChart.displayName = 'CartaAtributosChart'
