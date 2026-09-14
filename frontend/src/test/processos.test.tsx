import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProcessosPage } from '@/pages/ProcessosPage'
import { cartasApi, processosApi } from '@/services/api'
import type { CartaControleResponse, ProcessoResponse } from '@/types/api'

const mockProcessos: ProcessoResponse[] = [
  {
    id: 'proc-01',
    nome: 'Estamparia de Chapas',
    codigo_linha: 'LINHA-01',
    descricao: 'Corte e conformação de peças automotivas',
  },
]

const mockCartas: CartaControleResponse[] = [
  {
    id: 'carta-01',
    processo_id: 'proc-01',
    tipo_carta: 'X_R',
    tamanho_subgrupo: 5,
    especificacoes: { lie: 9.8, lse: 10.2, valor_nominal: 10.0 },
    limites_atuais: { lc: 10.0, lsc: 10.15, lic: 9.85, sigma_estimado: 0.05 },
    modo_limites: 'DINAMICO',
    total_subgrupos: 30,
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

describe('ProcessosPage e WizardNovaCarta', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(processosApi, 'listar').mockResolvedValue(mockProcessos)
    vi.spyOn(processosApi, 'criar').mockResolvedValue({
      id: 'proc-02',
      nome: 'Solda TIG',
      codigo_linha: 'LINHA-02',
      descricao: null,
    })
    vi.spyOn(cartasApi, 'listar').mockResolvedValue(mockCartas)
    vi.spyOn(cartasApi, 'criar').mockResolvedValue({
      id: 'carta-02',
      processo_id: 'proc-01',
      tipo_carta: 'I_MR',
      tamanho_subgrupo: 1,
      especificacoes: null,
      limites_atuais: null,
      modo_limites: 'DINAMICO',
      total_subgrupos: 0,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('deve renderizar o catálogo de processos e cartas associadas', async () => {
    renderWithProviders(<ProcessosPage />)

    expect(screen.getByTestId('processos-page')).toBeInTheDocument()
    expect(screen.getByText('Gestão de Processos e Cartas')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('Estamparia de Chapas')).toBeInTheDocument()
      expect(screen.getByText('LINHA-01')).toBeInTheDocument()
      expect(screen.getByText('Monitorar no Live')).toBeInTheDocument()
    })
  })

  it('deve permitir abrir modal e criar um novo processo industrial [RF01]', async () => {
    renderWithProviders(<ProcessosPage />)

    await waitFor(() => {
      expect(screen.getByText('Novo Processo')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Novo Processo'))

    expect(screen.getByLabelText(/Código da Linha/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Nome do Processo/)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/Código da Linha/), {
      target: { value: 'LINHA-02' },
    })
    fireEvent.change(screen.getByLabelText(/Nome do Processo/), {
      target: { value: 'Solda TIG' },
    })

    fireEvent.click(screen.getByText('Salvar Processo'))

    await waitFor(() => {
      expect(processosApi.criar).toHaveBeenCalledWith({
        codigo_linha: 'LINHA-02',
        nome: 'Solda TIG',
        descricao: null,
      })
    })
  })

  it('deve aplicar recomendação automática de tipo de carta conforme tamanho n [RN01]', async () => {
    renderWithProviders(<ProcessosPage />)

    await waitFor(() => {
      expect(screen.getByText('Nova Carta [RN01]')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Nova Carta [RN01]'))

    expect(screen.getByTestId('wizard-nova-carta-modal')).toBeInTheDocument()

    const inputN = screen.getByLabelText('Tamanho do Subgrupo (n)')
    const selectTipo = screen.getByLabelText('Tipo de Carta') as HTMLSelectElement

    // n=5 -> default X_R
    expect(selectTipo.value).toBe('X_R')
    expect(screen.getByText('Recomendado para n=5')).toBeInTheDocument()

    // n=1 -> I_MR
    fireEvent.change(inputN, { target: { value: '1' } })
    expect(selectTipo.value).toBe('I_MR')
    expect(screen.getByText('Recomendado para n=1')).toBeInTheDocument()

    // n=12 -> X_S
    fireEvent.change(inputN, { target: { value: '12' } })
    expect(selectTipo.value).toBe('X_S')
    expect(screen.getByText('Recomendado para n=12')).toBeInTheDocument()
  })

  it('deve validar se LIE < LSE nas especificações de tolerância', async () => {
    renderWithProviders(<ProcessosPage />)

    await waitFor(() => {
      expect(screen.getByText('Nova Carta [RN01]')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Nova Carta [RN01]'))

    // Habilitar checkbox de especificações
    const checkbox = screen.getByLabelText(/Definir Limites de Especificação/)
    fireEvent.click(checkbox)

    const inputLie = screen.getByLabelText(/LIE/)
    const inputLse = screen.getByLabelText(/LSE/)

    // LIE maior que LSE (Inválido)
    fireEvent.change(inputLie, { target: { value: '10.5' } })
    fireEvent.change(inputLse, { target: { value: '9.5' } })

    fireEvent.click(screen.getByText('Criar Carta de Controle'))

    expect(
      screen.getByText(
        'O Limite Inferior de Especificação (LIE) deve ser estritamente menor que o Limite Superior (LSE).'
      )
    ).toBeInTheDocument()
    expect(cartasApi.criar).not.toHaveBeenCalled()
  })
})
