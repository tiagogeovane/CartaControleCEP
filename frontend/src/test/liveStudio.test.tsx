import { act, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FeedAlarmes, ModalCausaEspecial } from '@/components/live'
import { LiveStudioPage } from '@/pages/LiveStudioPage'
import { cartasApi, ingestaoApi } from '@/services/api'
import { useCEPStore, type AlarmeAtivo } from '@/stores/cepStore'
import { useToastStore } from '@/stores/toastStore'
import type { CartaControleResponse, SubgrupoResponse } from '@/types/api'

// Mock de WebSocket nativo
class MockWebSocket {
  static instances: MockWebSocket[] = []
  url: string
  readyState: number = 1 // OPEN
  onopen: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onerror: ((error: any) => void) | null = null
  onclose: (() => void) | null = null
  sentMessages: string[] = []

  constructor(url: string) {
    this.url = url
    MockWebSocket.instances.push(this)
    setTimeout(() => {
      this.readyState = 1
      this.onopen?.()
    }, 0)
  }

  send(data: string) {
    this.sentMessages.push(data)
  }

  close() {
    this.readyState = 3
    this.onclose?.()
  }
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
}

function criarAlarmeMock(numero: number, regra: string = 'REGRA_1'): AlarmeAtivo {
  return {
    id: `alarme-${numero}-${regra}`,
    subgrupoNumero: numero,
    timestamp: new Date(2026, 8, 10, 14, 30, 0).toISOString(),
    violacoes: [
      {
        codigo_regra: regra,
        descricao: 'Ponto fora dos limites de 3-sigma (LSC/LIC)',
        numero_subgrupo: numero,
        pontos_violadores: [numero],
      },
    ],
  }
}

describe('Fase 4 - Live CEP Studio (Feed de Alarmes, Modal de Causa Especial e LiveStudioPage)', () => {
  const originalWebSocket = globalThis.WebSocket

  beforeEach(() => {
    vi.restoreAllMocks()
    MockWebSocket.instances = []
    // @ts-ignore
    globalThis.WebSocket = MockWebSocket as any

    useCEPStore.getState().setCartaAtiva(null)
    useCEPStore.getState().setBufferHistorico([])
    useCEPStore.getState().limparAlarmes()
    useCEPStore.getState().setStatusConexao('ONLINE')
    useToastStore.getState().limparToasts()
  })

  afterEach(() => {
    globalThis.WebSocket = originalWebSocket
  })

  // =========================================================================
  // 1. Feed de Alarmes (FeedAlarmes)
  // =========================================================================
  describe('FeedAlarmes', () => {
    it('deve renderizar empty-state quando não houver alarmes ativos', () => {
      const onApontarCausa = vi.fn()
      render(<FeedAlarmes alarmes={[]} onApontarCausa={onApontarCausa} />)

      expect(screen.getByTestId('feed-alarmes')).toBeInTheDocument()
      expect(screen.getByTestId('feed-empty-state')).toBeInTheDocument()
      expect(screen.getByText('Processo Sob Controle')).toBeInTheDocument()
      expect(
        screen.getByText(/Nenhuma anomalia ou violação estatística detectada no histórico recente\./i)
      ).toBeInTheDocument()
    })

    it('deve renderizar lista de alarmes ativos com metadados e acionar callbacks', () => {
      const onApontarCausa = vi.fn()
      const onLimparAlarmes = vi.fn()
      const onFocarSubgrupo = vi.fn()

      const alarmes = [
        criarAlarmeMock(15, 'REGRA_1'),
        criarAlarmeMock(18, 'REGRA_2'),
      ]

      render(
        <FeedAlarmes
          alarmes={alarmes}
          onApontarCausa={onApontarCausa}
          onLimparAlarmes={onLimparAlarmes}
          onFocarSubgrupo={onFocarSubgrupo}
        />
      )

      expect(screen.getByText('Feed de Alarmes')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument() // Contador
      expect(screen.getByTestId('alarme-item-15')).toBeInTheDocument()
      expect(screen.getByTestId('alarme-item-18')).toBeInTheDocument()

      // Clicar em Focar Subgrupo
      const btnSubgrupo = screen.getByRole('button', { name: 'Subgrupo #15' })
      fireEvent.click(btnSubgrupo)
      expect(onFocarSubgrupo).toHaveBeenCalledWith(15)

      // Clicar em Apontar Causa
      const botoesApontar = screen.getAllByRole('button', { name: /Apontar Causa/i })
      fireEvent.click(botoesApontar[0])
      expect(onApontarCausa).toHaveBeenCalledWith(alarmes[0])

      // Clicar no botão de limpar alarmes
      const btnLimpar = screen.getByTitle('Limpar histórico de alarmes')
      fireEvent.click(btnLimpar)
      expect(onLimparAlarmes).toHaveBeenCalledTimes(1)
    })
  })

  // =========================================================================
  // 2. Modal de Apontamento de Causa Especial (ModalCausaEspecial - [RF16])
  // =========================================================================
  describe('ModalCausaEspecial [RF16]', () => {
    it('não deve renderizar quando isOpen for false ou alarme for null', () => {
      const onSalvar = vi.fn()
      const onClose = vi.fn()

      const { container } = render(
        <ModalCausaEspecial
          isOpen={false}
          onClose={onClose}
          alarme={null}
          onSalvar={onSalvar}
        />
      )
      expect(container.firstChild).toBeNull()
    })

    it('deve validar formulário e exigir preenchimento de campos obrigatórios', () => {
      const onSalvar = vi.fn()
      const onClose = vi.fn()
      const alarme = criarAlarmeMock(22, 'REGRA_1')

      render(
        <ModalCausaEspecial
          isOpen={true}
          onClose={onClose}
          alarme={alarme}
          onSalvar={onSalvar}
        />
      )

      expect(screen.getByText(/Apontamento de Causa Especial - Subgrupo #22/i)).toBeInTheDocument()

      // Tentar submeter sem preencher a ação corretiva
      const btnSalvar = screen.getByRole('button', { name: /Salvar Apontamento/i })
      fireEvent.click(btnSalvar)

      expect(
        screen.getByText('Informe a ação corretiva adotada para mitigar o desvio.')
      ).toBeInTheDocument()
      expect(onSalvar).not.toHaveBeenCalled()
    })

    it('deve submeter apontamento com causa pré-definida com sucesso', () => {
      const onSalvar = vi.fn()
      const onClose = vi.fn()
      const alarme = criarAlarmeMock(22, 'REGRA_1')

      render(
        <ModalCausaEspecial
          isOpen={true}
          onClose={onClose}
          alarme={alarme}
          onSalvar={onSalvar}
          usuarioAtual="Engenheiro Carlos"
        />
      )

      // Preencher ação corretiva
      const textareaAcao = screen.getByLabelText(/Ação Corretiva Aplicada/i)
      fireEvent.change(textareaAcao, {
        target: { value: 'Troca de ferramenta desgastada e reajuste de zero-peça' },
      })

      // Submeter formulário
      const btnSalvar = screen.getByRole('button', { name: /Salvar Apontamento/i })
      fireEvent.click(btnSalvar)

      expect(onSalvar).toHaveBeenCalledWith({
        subgrupoNumero: 22,
        causaRaiz: 'Desgaste de ferramenta de corte / inserto',
        acaoCorretiva: 'Troca de ferramenta desgastada e reajuste de zero-peça',
        responsavel: 'Engenheiro Carlos',
      })
      expect(onClose).toHaveBeenCalled()
    })

    it('deve permitir causa customizada quando "Outra causa específica" for selecionada', () => {
      const onSalvar = vi.fn()
      const onClose = vi.fn()
      const alarme = criarAlarmeMock(25, 'REGRA_2')

      render(
        <ModalCausaEspecial
          isOpen={true}
          onClose={onClose}
          alarme={alarme}
          onSalvar={onSalvar}
        />
      )

      // Selecionar "Outra causa específica"
      const selectCausa = screen.getByRole('combobox')
      fireEvent.change(selectCausa, { target: { value: 'Outra causa específica' } })

      // Campo adicional de causa personalizada deve aparecer
      const inputCustom = screen.getByPlaceholderText(/Descreva a causa específica/i)
      fireEvent.change(inputCustom, { target: { value: 'Pico de tensão na rede da concessionária' } })

      const textareaAcao = screen.getByLabelText(/Ação Corretiva Aplicada/i)
      fireEvent.change(textareaAcao, {
        target: { value: 'Reinicialização do inversor de frequência e teste em vazio' },
      })

      const btnSalvar = screen.getByRole('button', { name: /Salvar Apontamento/i })
      fireEvent.click(btnSalvar)

      expect(onSalvar).toHaveBeenCalledWith(
        expect.objectContaining({
          subgrupoNumero: 25,
          causaRaiz: 'Pico de tensão na rede da concessionária',
          acaoCorretiva: 'Reinicialização do inversor de frequência e teste em vazio',
        })
      )
    })
  })

  // =========================================================================
  // 3. Página Live CEP Studio (LiveStudioPage)
  // =========================================================================
  describe('LiveStudioPage', () => {
    const mockCartas: CartaControleResponse[] = [
      {
        id: 'carta-live-01',
        processo_id: 'proc-live-01',
        tipo_carta: 'X_R',
        tamanho_subgrupo: 5,
        modo_limites: 'DINAMICO',
        total_subgrupos: 2,
        limites_atuais: {
          lc: 50.0,
          lsc: 50.5,
          lic: 49.5,
          sigma_estimado: 0.17,
        },
        especificacoes: {
          lie: 49.0,
          lse: 51.0,
          valor_nominal: 50.0,
        },
      },
    ]

    const mockSubgrupos: SubgrupoResponse[] = [
      {
        id: 'sg-live-1',
        carta_id: 'carta-live-01',
        numero_subgrupo: 1,
        timestamp: new Date(2026, 8, 10, 10, 0, 0).toISOString(),
        valores_brutos: [50.1, 49.9, 50.0, 50.2, 49.8],
        estatisticas: {
          media_x: 50.0,
          amplitude_r: 0.4,
          desvio_s: 0.15,
          valores_brutos: [50.1, 49.9, 50.0, 50.2, 49.8],
        },
        fora_de_controle: false,
        violacoes: [],
      },
      {
        id: 'sg-live-2',
        carta_id: 'carta-live-01',
        numero_subgrupo: 2,
        timestamp: new Date(2026, 8, 10, 10, 5, 0).toISOString(),
        valores_brutos: [50.8, 50.9, 50.7, 50.8, 51.0],
        estatisticas: {
          media_x: 50.84,
          amplitude_r: 0.3,
          desvio_s: 0.11,
          valores_brutos: [50.8, 50.9, 50.7, 50.8, 51.0],
        },
        fora_de_controle: true,
        violacoes: [
          {
            codigo_regra: 'REGRA_1',
            descricao: '1 ponto fora de 3-sigma (LSC)',
            numero_subgrupo: 2,
            pontos_violadores: [2],
          },
        ],
      },
    ]

    it('deve renderizar a página do Live Studio com conexão, KPIs, gráfico e feed de alarmes', async () => {
      vi.spyOn(cartasApi, 'listar').mockResolvedValue(mockCartas)
      vi.spyOn(ingestaoApi, 'listarSubgrupos').mockResolvedValue(mockSubgrupos)

      const queryClient = createQueryClient()

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <LiveStudioPage />
          </MemoryRouter>
        </QueryClientProvider>
      )

      // Cabeçalho da página
      expect(screen.getByRole('heading', { name: 'Live CEP Studio' })).toBeInTheDocument()
      expect(await screen.findByText(/WebSocket:/i)).toBeInTheDocument()

      // Cards de KPI
      expect(screen.getByText('Média Global X̄̄')).toBeInTheDocument()
      expect(screen.getByText(/Dispersão Média/i)).toBeInTheDocument()
      expect(screen.getByText('Subgrupos Processados')).toBeInTheDocument()

      // Feed de Alarmes
      expect(await screen.findByTestId('feed-alarmes')).toBeInTheDocument()
    })

    it('deve abrir modal de causa especial a partir de alarme no feed e registrar causa com toast', async () => {
      vi.spyOn(cartasApi, 'listar').mockResolvedValue(mockCartas)
      vi.spyOn(ingestaoApi, 'listarSubgrupos').mockResolvedValue(mockSubgrupos)

      // Adicionar um alarme ativo na store
      act(() => {
        useCEPStore.setState({
          alarmesAtivos: [criarAlarmeMock(2, 'REGRA_1')],
        })
      })

      const queryClient = createQueryClient()

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <LiveStudioPage />
          </MemoryRouter>
        </QueryClientProvider>
      )

      // Alarme deve aparecer no Feed
      const btnApontar = await screen.findByRole('button', { name: /Apontar Causa/i })
      fireEvent.click(btnApontar)

      // Modal deve estar aberto
      expect(screen.getByText(/Apontamento de Causa Especial - Subgrupo #2/i)).toBeInTheDocument()

      // Preencher ação corretiva no modal
      const textareaAcao = screen.getByLabelText(/Ação Corretiva Aplicada/i)
      fireEvent.change(textareaAcao, { target: { value: 'Intervenção preventiva executada' } })

      // Submeter
      const btnSalvar = screen.getByRole('button', { name: /Salvar Apontamento/i })
      fireEvent.click(btnSalvar)

      // Toast deve ter sido acionado
      const toasts = useToastStore.getState().toasts
      expect(toasts.length).toBeGreaterThan(0)
      expect(toasts[0].titulo).toContain('Apontamento Registrado')
    })
  })
})
