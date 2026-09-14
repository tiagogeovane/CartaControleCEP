import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IngestaoPage } from '@/pages/IngestaoPage'
import { cartasApi, ingestaoApi } from '@/services/api'
import { useCEPStore } from '@/stores/cepStore'
import type { CartaControleResponse, SubgrupoResponse } from '@/types/api'

const mockCarta: CartaControleResponse = {
  id: 'carta-ingest-01',
  processo_id: 'proc-01',
  tipo_carta: 'X_R',
  tamanho_subgrupo: 3,
  especificacoes: { lie: 9.5, lse: 10.5, valor_nominal: 10.0 },
  limites_atuais: { lc: 10.0, lsc: 10.4, lic: 9.6, sigma_estimado: 0.15 },
  modo_limites: 'DINAMICO',
  total_subgrupos: 10,
}

const mockSubgrupoSobControle: SubgrupoResponse = {
  id: 'sg-resp-01',
  carta_id: 'carta-ingest-01',
  numero_subgrupo: 11,
  timestamp: new Date().toISOString(),
  valores_brutos: [10.1, 10.0, 9.9],
  estatisticas: {
    media_x: 10.0,
    amplitude_r: 0.2,
    desvio_s: 0.1,
    valores_brutos: [10.1, 10.0, 9.9],
  },
  fora_de_controle: false,
  violacoes: [],
}

const mockSubgrupoForaControle: SubgrupoResponse = {
  id: 'sg-resp-02',
  carta_id: 'carta-ingest-01',
  numero_subgrupo: 12,
  timestamp: new Date().toISOString(),
  valores_brutos: [10.8, 10.9, 10.7],
  estatisticas: {
    media_x: 10.8,
    amplitude_r: 0.2,
    desvio_s: 0.1,
    valores_brutos: [10.8, 10.9, 10.7],
  },
  fora_de_controle: true,
  violacoes: [
    {
      codigo_regra: 'REGRA_1',
      descricao: 'Ponto fora dos limites de 3-sigma (LSC/LIC)',
      numero_subgrupo: 12,
      pontos_violadores: [10.8],
    },
  ],
}

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

describe('IngestaoPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useCEPStore.getState().setCartaAtiva(mockCarta)
    vi.spyOn(cartasApi, 'listar').mockResolvedValue([mockCarta])
    vi.spyOn(ingestaoApi, 'ingerirAmostra').mockResolvedValue(mockSubgrupoSobControle)
    vi.spyOn(ingestaoApi, 'importarLote').mockResolvedValue({
      carta_id: 'carta-ingest-01',
      total_importados: 2,
      subgrupos: [mockSubgrupoSobControle, mockSubgrupoForaControle],
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('deve renderizar o cabeçalho e abas de navegação', async () => {
    renderWithProviders(<IngestaoPage />)

    expect(screen.getByTestId('ingestao-page')).toBeInTheDocument()
    expect(screen.getByText('Ingestão de Dados e Telemetria')).toBeInTheDocument()
    expect(screen.getByText('Entrada Manual do Operador [RF06]')).toBeInTheDocument()
    expect(screen.getByText('Importação em Lote CSV/JSON [RF08]')).toBeInTheDocument()
  })

  it('deve renderizar campos amostrais conforme o tamanho do subgrupo n', async () => {
    renderWithProviders(<IngestaoPage />)

    await waitFor(() => {
      expect(screen.getByLabelText('Amostra #1')).toBeInTheDocument()
      expect(screen.getByLabelText('Amostra #2')).toBeInTheDocument()
      expect(screen.getByLabelText('Amostra #3')).toBeInTheDocument()
    })
  })

  it('deve suportar navegação por tecla Enter entre os inputs amostrais [RF06]', async () => {
    renderWithProviders(<IngestaoPage />)

    await waitFor(() => {
      expect(screen.getByLabelText('Amostra #1')).toBeInTheDocument()
    })

    const input1 = screen.getByLabelText('Amostra #1')
    const input2 = screen.getByLabelText('Amostra #2')

    input1.focus()
    fireEvent.change(input1, { target: { value: '10.1' } })
    fireEvent.keyDown(input1, { key: 'Enter', code: 'Enter' })

    expect(document.activeElement).toBe(input2)
  })

  it('deve validar valores ausentes ou não numéricos na submissão manual', async () => {
    renderWithProviders(<IngestaoPage />)

    await waitFor(() => {
      expect(screen.getByLabelText('Amostra #1')).toBeInTheDocument()
    })

    const btnSubmit = screen.getByText('Gravar Subgrupo (Ctrl+Enter)')
    fireEvent.click(btnSubmit)

    expect(
      screen.getByText('Amostra #1 contém um valor numérico inválido ou em branco.')
    ).toBeInTheDocument()
    expect(ingestaoApi.ingerirAmostra).not.toHaveBeenCalled()
  })

  it('deve submeter subgrupo manual com sucesso e exibir feedback positivo [RF06]', async () => {
    renderWithProviders(<IngestaoPage />)

    await waitFor(() => {
      expect(screen.getByLabelText('Amostra #1')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('Amostra #1'), { target: { value: '10.1' } })
    fireEvent.change(screen.getByLabelText('Amostra #2'), { target: { value: '10.0' } })
    fireEvent.change(screen.getByLabelText('Amostra #3'), { target: { value: '9.9' } })

    const btnSubmit = screen.getByText('Gravar Subgrupo (Ctrl+Enter)')
    fireEvent.click(btnSubmit)

    await waitFor(() => {
      expect(ingestaoApi.ingerirAmostra).toHaveBeenCalledWith('carta-ingest-01', {
        valores: [10.1, 10.0, 9.9],
      })
      expect(screen.getByTestId('feedback-subgrupo-manual')).toBeInTheDocument()
      expect(screen.getByText('SOB CONTROLE')).toBeInTheDocument()
    })
  })

  it('deve exibir alerta crítico e badge de anomalia quando subgrupo violar regras [RF06]', async () => {
    vi.spyOn(ingestaoApi, 'ingerirAmostra').mockResolvedValueOnce(mockSubgrupoForaControle)

    renderWithProviders(<IngestaoPage />)

    await waitFor(() => {
      expect(screen.getByLabelText('Amostra #1')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('Amostra #1'), { target: { value: '10.8' } })
    fireEvent.change(screen.getByLabelText('Amostra #2'), { target: { value: '10.9' } })
    fireEvent.change(screen.getByLabelText('Amostra #3'), { target: { value: '10.7' } })

    const input3 = screen.getByLabelText('Amostra #3')
    fireEvent.keyDown(input3, { key: 'Enter', ctrlKey: true })

    await waitFor(() => {
      expect(screen.getByText('FORA DE CONTROLE')).toBeInTheDocument()
      expect(screen.getByText(/REGRA_1/)).toBeInTheDocument()
    })
  })

  it('deve alternar para aba de importação em lote e exibir dropzone [RF08]', async () => {
    renderWithProviders(<IngestaoPage />)

    const tabLote = screen.getByText('Importação em Lote CSV/JSON [RF08]')
    fireEvent.click(tabLote)

    expect(screen.getByText('Upload de Arquivo (CSV ou JSON)')).toBeInTheDocument()
    expect(
      screen.getByText('Arraste e solte o arquivo aqui, ou clique para selecionar')
    ).toBeInTheDocument()
  })

  it('deve processar upload de arquivo CSV em lote e submeter amostras [RF08]', async () => {
    renderWithProviders(<IngestaoPage />)

    const tabLote = screen.getByText('Importação em Lote CSV/JSON [RF08]')
    fireEvent.click(tabLote)

    const file = new File(['10.0,10.1,9.9\n10.5,10.6,10.4'], 'amostras.csv', { type: 'text/csv' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    expect(input).toBeInTheDocument()

    class MockFileReader {
      onload: ((e: { target: { result: string } }) => void) | null = null
      readAsText() {
        setTimeout(() => {
          this.onload?.({ target: { result: '10.0,10.1,9.9\n10.5,10.6,10.4' } })
        }, 0)
      }
    }
    vi.stubGlobal('FileReader', MockFileReader)

    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText(/Pré-visualização/)).toBeInTheDocument()
      expect(screen.getByText('Importar 2 Subgrupos')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Importar 2 Subgrupos'))

    await waitFor(() => {
      expect(ingestaoApi.importarLote).toHaveBeenCalledWith('carta-ingest-01', {
        amostras: [
          [10.0, 10.1, 9.9],
          [10.5, 10.6, 10.4],
        ],
      })
      expect(screen.getByText('Lote importado com sucesso!')).toBeInTheDocument()
    })
  })
})

