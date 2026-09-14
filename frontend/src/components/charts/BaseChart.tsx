import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react'
import * as echarts from 'echarts'
import { cn } from '@/lib/utils'

export interface BaseChartRef {
  getInstance: () => echarts.ECharts | null
  getDataURL: (opts?: { type?: string; pixelRatio?: number }) => string | null
  resize: () => void
}

export interface BaseChartProps {
  option: echarts.EChartsOption
  notMerge?: boolean
  lazyUpdate?: boolean
  loading?: boolean
  onChartReady?: (instance: echarts.ECharts) => void
  onEvents?: Record<string, (params: any) => void>
  className?: string
  height?: number | string
  style?: React.CSSProperties
}

export const BaseChart = forwardRef<BaseChartRef, BaseChartProps>(
  (
    {
      option,
      notMerge = false,
      lazyUpdate = false,
      loading = false,
      onChartReady,
      onEvents,
      className,
      height = '100%',
      style,
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const chartInstanceRef = useRef<echarts.ECharts | null>(null)

    useImperativeHandle(ref, () => ({
      getInstance: () => chartInstanceRef.current,
      getDataURL: (opts) => {
        if (!chartInstanceRef.current) return null
        return chartInstanceRef.current.getDataURL({
          type: opts?.type as any || 'png',
          pixelRatio: opts?.pixelRatio || 2,
          backgroundColor: '#0F172A',
        })
      },
      resize: () => {
        chartInstanceRef.current?.resize()
      },
    }))

    // Inicialização da instância ECharts
    useEffect(() => {
      const container = containerRef.current
      if (!container) return

      let chart = echarts.getInstanceByDom(container)
      if (!chart) {
        chart = echarts.init(container, 'dark', {
          renderer: 'canvas',
        })
      }
      chartInstanceRef.current = chart
      onChartReady?.(chart)

      // Registrar callbacks de eventos
      if (onEvents && chart) {
        Object.entries(onEvents).forEach(([eventName, handler]) => {
          chart.on(eventName, handler)
        })
      }

      // Observer de redimensionamento responsivo
      const resizeObserver = new ResizeObserver(() => {
        chart.resize()
      })
      resizeObserver.observe(container)

      return () => {
        resizeObserver.disconnect()
        if (onEvents && chart) {
          Object.entries(onEvents).forEach(([eventName, handler]) => {
            chart.off(eventName, handler)
          })
        }
        chart.dispose()
        chartInstanceRef.current = null
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Atualização reativa de opções (com notMerge configurável para streaming incremental)
    useEffect(() => {
      const chart = chartInstanceRef.current
      if (!chart) return

      chart.setOption(option, {
        notMerge,
        lazyUpdate,
      })
    }, [option, notMerge, lazyUpdate])

    // Controle de estado de carregamento
    useEffect(() => {
      const chart = chartInstanceRef.current
      if (!chart) return

      if (loading) {
        chart.showLoading({
          text: 'Carregando dados...',
          color: '#3B82F6',
          textColor: '#94A3B8',
          maskColor: 'rgba(15, 23, 42, 0.6)',
        })
      } else {
        chart.hideLoading()
      }
    }, [loading])

    return (
      <div
        ref={containerRef}
        className={cn('w-full select-none', className)}
        style={{ height, minHeight: typeof height === 'number' ? `${height}px` : height, ...style }}
      />
    )
  }
)

BaseChart.displayName = 'BaseChart'
