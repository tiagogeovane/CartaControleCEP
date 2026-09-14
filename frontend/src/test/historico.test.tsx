import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HistoricoPage } from '@/pages/HistoricoPage'
import { cartasApi, ingestaoApi } from '@/services/api'
import { useCEPStore } from '@/stores/cepStore'
import type { CartaControleResponse, SubgrupoResponse } from '@/types/api'

const mockCarta: CartaControleResponse = {
  id: 'carta-hist-01',
  processo_id: 'proc-hist-01',
  tipo_carta: 'X_R',
  tamanho_subgrupo: 3,
  especificacoes: { lie: 9.5, lse: 10.5, valor_nominal: 10.0 },
  limites_atuais: { lc: 10.0, lsc: 10.4, lic: 9.6, sigma_estimado: 0.15 },
  modo_limites: 'DINAMICO',
  total_subgrupos: 2,
}

const mockSubgrupos: SubgrupoResponse[] = [
  {
    id: 'sg-hist-1',
    carta_id: 'carta-hist-01',
    numero_subgrupo: 1,
    timestamp: '2026-09-10T10:00:00.000Z',
    valores_brutos: [10.0, 10.1, 9.9],
    estatisticas: {
      media_x: 10.0,
      amplitude_r: 0.2,
      desvio_s: 0.1,
      valores_brutos: [10.0, 10.1, 9.9],
    },
    fora_de_controle: false,
    violacoes: [],
  },
  {
    id: 'sg-hist-2',
    carta_id: 'carta-hist-01',
    numero_subgrupo: 2,
    timestamp: '2026-09-10T10:15:00.000Z',
    valores_brutos: [10.7, 10.8, 10.9],
    estatisticas: {
      media_x: 10.8,
      amplitude_r: 0.2,
      desvio_s: 0.1,
      valores_brutos: [10.7, 10.8, 10.9],
    },
    fora_de_controle: true,
    violacoes: [
      {
        codigo_regra: 'REGRA_1',
        descricao: 'Ponto fora dos limites 3-sigma',
        numero_subgrupo: 2,
        pontos_violadores: [10.8],
      },
    ],
  },
]

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('HistoricoPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useCEPStore.getState().setCartaAtiva(mockCarta)
    vi.spyOn(cartasApi, 'listar').mockResolvedValue([mockCarta])
    vi.spyOn(ingestaoApi, 'listarSubgrupos').mockResolvedValue(mockSubgrupos)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('deve renderizar o cabeçalho, KPIs e a tabela de subgrupos', async () => {
    renderWithProviders(<HistoricoPage />)

    expect(screen.getByTestId('historico-page')).toBeInTheDocument()
    expect(screen.getByText('Histórico Analítico de Subgrupos')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('Total de Subgrupos')).toBeInTheDocument()
      expect(screen.getByTestId('linha-subgrupo-1')).toBeInTheDocument()
      expect(screen.getByTestId('linha-subgrupo-2')).toBeInTheDocument()
    })
  })

  it('deve filtrar subgrupos ao clicar no botão "Apenas Anomalias"', async () => {
    renderWithProviders(<HistoricoPage />)

    await waitFor(() => {
      expect(screen.getByTestId('linha-subgrupo-1')).toBeInTheDocument()
      expect(screen.getByTestId('linha-subgrupo-2')).toBeInTheDocument()
    })

    const btnAnomalias = screen.getByText('Apenas Anomalias')
    fireEvent.click(btnAnomalias)

    expect(screen.queryByTestId('linha-subgrupo-1')).not.toBeInTheDocument()
    expect(screen.getByTestId('linha-subgrupo-2')).toBeInTheDocument()
  })

  it('deve abrir o modal de Causa Especial ao clicar em "Apontar Causa" no subgrupo anômalo [RF16]', async () => {
    renderWithProviders(<HistoricoPage />)

    await waitFor(() => {
      expect(screen.getByTestId('linha-subgrupo-2')).toBeInTheDocument()
    })

    const btnApontar = screen.getByText('Apontar Causa')
    fireEvent.click(btnApontar)

    expect(screen.getByText(/Apontamento de Causa Especial/)).toBeInTheDocument()
    expect(screen.getByText('Causa Raiz da Anomalia *')).toBeInTheDocument()
  })

  it('deve disparar exportação para CSV ao clicar em "Exportar CSV" [RF12]', async () => {
    renderWithProviders(<HistoricoPage />)

    await waitFor(() => {
      expect(screen.getByText('Exportar CSV')).toBeInTheDocument()
      expect(screen.getByTestId('linha-subgrupo-1')).toBeInTheDocument()
    })

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    const btnExportar = screen.getByText('Exportar CSV')
    fireEvent.click(btnExportar)

    expect(clickSpy).toHaveBeenCalled()
    clickSpy.mockRestore()
  })
})
