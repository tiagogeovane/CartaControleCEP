import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  calcularMetricasSigma,
  gerarRelatorioPDF,
  type RelatorioPDFOpcoes,
} from '@/utils/pdfReportGenerator'
import { ModalRelatorioPDF } from '@/components/charts/ModalRelatorioPDF'
import { ControlesCarta } from '@/components/charts/ControlesCarta'
import { RelatorioPage } from '@/pages/RelatorioPage'
import { cartasApi, ingestaoApi } from '@/services/api'
import { useCEPStore } from '@/stores/cepStore'
import { useToastStore } from '@/stores/toastStore'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import autoTable from 'jspdf-autotable'

// Mock de jsPDF e autoTable
vi.mock('jspdf', () => {
  const saveMock = vi.fn()
  const textMock = vi.fn()
  const rectMock = vi.fn()
  const lineMock = vi.fn()
  const addPageMock = vi.fn()
  const setPageMock = vi.fn()
  const addImageMock = vi.fn()
  const setFontMock = vi.fn()
  const setFontSizeMock = vi.fn()
  const setTextColorMock = vi.fn()
  const setFillColorMock = vi.fn()
  const setDrawColorMock = vi.fn()
  const setLineWidthMock = vi.fn()

  class MockJsPDF {
    internal = {
      pageSize: {
        getWidth: () => 210,
        getHeight: () => 297,
      },
    }
    save = saveMock
    text = textMock
    rect = rectMock
    line = lineMock
    addPage = addPageMock
    setPage = setPageMock
    addImage = addImageMock
    setFont = setFontMock
    setFontSize = setFontSizeMock
    setTextColor = setTextColorMock
    setFillColor = setFillColorMock
    setDrawColor = setDrawColorMock
    setLineWidth = setLineWidthMock
    getNumberOfPages = () => 1
    lastAutoTable = { finalY: 50 }
  }

  return { jsPDF: MockJsPDF }
})

vi.mock('jspdf-autotable', () => {
  return {
    default: vi.fn().mockImplementation((doc: any) => {
      doc.lastAutoTable = { finalY: 60 }
    }),
  }
})

describe('Feature - Relatório Técnico em PDF e Análise de Sigmas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useToastStore.setState({ toasts: [] })
  })

  // =========================================================================
  // 1. Testes de Cálculo dos Sigmas do Processo
  // =========================================================================
  describe('calcularMetricasSigma', () => {
    it('deve calcular corretamente as distâncias da LC aos limites de controle e especificações', () => {
      const limitesControle = {
        lc: 25.0,
        lsc: 26.5,
        lic: 23.5,
        sigmaEstimado: 0.5,
      }
      const limitesEspecificacao = {
        lse: 27.0,
        lie: 23.0,
        valorNominal: 25.0,
      }

      const res = calcularMetricasSigma(limitesControle, limitesEspecificacao)

      // Distâncias aos limites de controle: (26.5 - 25) / 0.5 = 3.0σ
      expect(res.distanciaLscSigma).toBe(3.0)
      expect(res.distanciaLicSigma).toBe(3.0)

      // Distâncias aos limites de engenharia: (27 - 25) / 0.5 = 4.0σ, (25 - 23) / 0.5 = 4.0σ
      expect(res.zLse).toBe(4.0)
      expect(res.zLie).toBe(4.0)
      expect(res.zMin).toBe(4.0)
      expect(res.cpkEquivalente).toBe(1.333)
      expect(res.classificacaoSigma).toContain('Excelente')
    })

    it('deve identificar o Z_min como o lado mais crítico quando o processo estiver descentralizado', () => {
      const limitesControle = {
        lc: 25.2,
        lsc: 26.7,
        lic: 23.7,
        sigmaEstimado: 0.5,
      }
      const limitesEspecificacao = {
        lse: 26.5, // mais próximo da LC (distância 1.3 -> Z = 2.6σ)
        lie: 23.0, // mais distante da LC (distância 2.2 -> Z = 4.4σ)
        valorNominal: 25.0,
      }

      const res = calcularMetricasSigma(limitesControle, limitesEspecificacao)

      expect(res.zLse).toBe(2.6)
      expect(res.zLie).toBe(4.4)
      expect(res.zMin).toBe(2.6)
      expect(res.cpkEquivalente).toBe(0.867)
      expect(res.classificacaoSigma).toContain('Crítico')
    })

    it('deve retornar valores nulos graciosamente quando não houver sigma estimado válido', () => {
      const res = calcularMetricasSigma(null, null)
      expect(res.distanciaLscSigma).toBeNull()
      expect(res.distanciaLicSigma).toBeNull()
      expect(res.zMin).toBeNull()
      expect(res.cpkEquivalente).toBeNull()
      expect(res.classificacaoSigma).toContain('Indisponível')
    })

    it('deve distinguir a distância aos limites em termos de erro padrão da média e sigma individual, calcular offset e alertar processo instável', () => {
      const limitesControle = {
        lc: 4.9607,
        lsc: 4.9733,
        lic: 4.9481,
        sigmaEstimado: 0.0094,
      }
      const limitesEspecificacao = {
        lse: 5.0000,
        lie: 4.9000,
        valorNominal: 4.9500,
      }

      const res = calcularMetricasSigma(limitesControle, limitesEspecificacao, 5, true, 'mm')

      expect(res.distanciaLscSigmaXBarra).toBe(3.0)
      expect(res.distanciaLicSigmaXBarra).toBe(3.0)
      expect(res.distanciaLscSigmaIndiv).toBe(1.34)
      expect(res.distanciaLicSigmaIndiv).toBe(1.34)
      expect(res.offsetNominal).toBe(0.0107)
      expect(res.textoDeslocamento).toContain('+0.0107 mm')
      expect(res.textoDeslocamento).toContain('LSE')
      expect(res.possuiAnomalias).toBe(true)
      expect(res.rotuloCpk).toContain('PROCESSO INSTÁVEL - Requer Estabilização')
    })
  })

  // =========================================================================
  // 2. Testes de Geração do PDF
  // =========================================================================
  describe('gerarRelatorioPDF', () => {
    it('deve gerar o documento PDF e acionar o download com nome padronizado', async () => {
      const opcoes: RelatorioPDFOpcoes = {
        cartaId: 'carta-uuid-1234',
        tipoCarta: 'X_R',
        tamanhoSubgrupo: 5,
        codigoLinha: 'LINHA-CNC-01',
        nomeProcesso: 'Usinagem de Precisão',
        unidade: 'mm',
        limitesControle: {
          lc: 25.0,
          lsc: 26.5,
          lic: 23.5,
          sigmaEstimado: 0.5,
        },
        limitesEspecificacao: {
          lse: 27.0,
          lie: 23.0,
          valorNominal: 25.0,
        },
        imagemGrafico: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        secoes: {
          incluirMetadados: true,
          incluirGrafico: true,
          incluirLimitesControle: true,
          incluirLimitesEspecificacao: true,
          incluirAnaliseSigmas: true,
          incluirTabelaAmostras: false,
        },
      }

      const resultado = await gerarRelatorioPDF(opcoes)

      expect(resultado.sucesso).toBe(true)
      expect(resultado.nomeArquivo).toContain('relatorio-cep-LINHA-CNC-01-X_R')
      expect(resultado.metricasSigma.zMin).toBe(4.0)
    })

    it('deve formatar amostras brutas com 3 casas decimais e exibir anomalia de dispersão na tabela do relatório', async () => {
      const opcoes: RelatorioPDFOpcoes = {
        cartaId: 'carta-uuid-1234',
        tipoCarta: 'X_R',
        tamanhoSubgrupo: 5,
        codigoLinha: 'LINHA-01',
        nomeProcesso: 'Calibração',
        unidade: 'mm',
        limitesControle: {
          lc: 4.9607,
          lsc: 4.9733,
          lic: 4.9481,
          sigmaEstimado: 0.0094,
        },
        limitesEspecificacao: {
          lse: 5.0000,
          lie: 4.9000,
          valorNominal: 4.9500,
        },
        secoes: {
          incluirMetadados: false,
          incluirGrafico: false,
          incluirLimitesControle: false,
          incluirLimitesEspecificacao: false,
          incluirAnaliseSigmas: false,
          incluirTabelaAmostras: true,
        },
        subgrupos: [
          {
            numero_subgrupo: 9,
            valores_brutos: [4.942, 4.998, 4.950, 4.971, 4.945],
            estatisticas: {
              media_x: 4.9612,
              amplitude_r: 0.0560,
            },
            fora_de_controle: true,
            violacoes: [{ codigo_regra: 'REGRA_1_DISP', descricao: 'Dispersao fora dos limites' }],
          },
          {
            numero_subgrupo: 18,
            valores_brutos: [4.970, 4.971, 4.972, 4.969, 4.970],
            estatisticas: {
              media_x: 4.9710,
              amplitude_r: 0.0070,
            },
            fora_de_controle: false,
          },
        ],
      }

      const res = await gerarRelatorioPDF(opcoes)
      expect(res.sucesso).toBe(true)

      const calls = (autoTable as any).mock.calls
      const tabelaCall = calls.find((c: any) =>
        c[1]?.head?.[0]?.includes('Média (X)')
      )
      expect(tabelaCall).toBeDefined()
      const body = tabelaCall[1].body
      expect(body).toHaveLength(2)

      expect(body[0][0]).toBe('#009')
      expect(body[0][4]).toBe('ANOMALIA')
      expect(body[0][5]).toBe('REGRA_1_DISP')

      expect(body[1][0]).toBe('#018')
      expect(body[1][3]).toBe('4.970, 4.971, 4.972, 4.969, 4.970')
      expect(body[1][4]).toBe('SOB CONTROLE')

      // Validação da legenda das regras de Nelson anexada junto ao histórico de amostras
      const legendaCall = calls.find((c: any) =>
        c[1]?.head?.[0]?.includes('Resumo da Regra de Nelson / Causa Especial')
      )
      expect(legendaCall).toBeDefined()
      const legendaBody = legendaCall[1].body
      expect(legendaBody.length).toBeGreaterThanOrEqual(8)
      expect(legendaBody[0][0]).toBe('Regra 1')
      expect(legendaBody[0][1]).toContain('3 sigma')
      expect(legendaBody[1][0]).toBe('Regra 2')
      expect(legendaBody[1][1]).toContain('9 pontos')
    })

    it('deve formatar as células da Seção 3 estritamente com formato "x sigma" e sem textos desnecessários', async () => {
      const opcoes: RelatorioPDFOpcoes = {
        cartaId: 'carta-uuid-1234',
        tipoCarta: 'I_MR',
        tamanhoSubgrupo: 1,
        limitesControle: {
          lc: 25.0,
          lsc: 26.5,
          lic: 23.5,
          sigmaEstimado: 0.5,
        },
        limitesEspecificacao: {
          lse: 27.0,
          lie: 23.0,
          valorNominal: 25.0,
        },
        secoes: {
          incluirMetadados: false,
          incluirGrafico: false,
          incluirLimitesControle: false,
          incluirLimitesEspecificacao: false,
          incluirAnaliseSigmas: true,
          incluirTabelaAmostras: false,
        },
      }

      const res = await gerarRelatorioPDF(opcoes)
      expect(res.sucesso).toBe(true)

      const calls = (autoTable as any).mock.calls
      const sigmaCall = calls.find((c: any) =>
        c[1]?.body?.some((row: string[]) => row[0]?.includes('Distância aos Limites de Controle'))
      )
      expect(sigmaCall).toBeDefined()
      const body = sigmaCall[1].body

      const rowControle = body.find((r: string[]) => r[0] === 'Distância aos Limites de Controle:')
      expect(rowControle[1]).toBe('3.00 sigma')

      const rowEspec = body.find((r: string[]) => r[0] === 'Distância aos Limites de Especificação:')
      expect(rowEspec[1]).toBe('4.00 sigma')

      const rowZmin = body.find((r: string[]) => r[0] === 'Nível Sigma do Processo (Zmin):')
      expect(rowZmin[1]).toBe('4.00 sigma')
    })
  })

  // =========================================================================
  // 3. Testes do Componente ModalRelatorioPDF
  // =========================================================================
  describe('ModalRelatorioPDF Component', () => {
    const mockCarta = {
      id: 'carta-test-id-1',
      processo_id: 'proc-id-1',
      tipo_carta: 'X_R',
      tamanho_subgrupo: 5,
      modo_limites: 'DINAMICO',
      total_subgrupos: 30,
      limites_atuais: {
        lc: 5.0,
        lsc: 5.3,
        lic: 4.7,
        sigma_estimado: 0.1,
      },
      especificacoes: {
        lse: 5.4,
        lie: 4.6,
        valor_nominal: 5.0,
      },
    }

    it('deve renderizar o modal com os toggles e a prévia de sigmas da carta', () => {
      render(
        <ModalRelatorioPDF
          isOpen={true}
          onClose={vi.fn()}
          cartaDetalhes={mockCarta as any}
          tipoCarta="X_R"
          tamanhoSubgrupo={5}
        />
      )

      expect(screen.getByText('Gerar Relatório Técnico em PDF')).toBeInTheDocument()
      expect(screen.getByText('Diagnóstico de Sigmas da Carta Atual')).toBeInTheDocument()
      expect(screen.getByText('±3σ')).toBeInTheDocument()
      expect(screen.getByText('4.00σ')).toBeInTheDocument() // Z = (5.4 - 5.0) / 0.1 = 4.0σ

      // Toggles presentes
      expect(screen.getByText('Snapshot do Gráfico Atual')).toBeInTheDocument()
      expect(screen.getByText('Limites de Controle Estatístico')).toBeInTheDocument()
      expect(screen.getByText('Limites de Especificação de Engenharia')).toBeInTheDocument()
      expect(screen.getByText('Cálculo de Sigmas do Processo')).toBeInTheDocument()
      expect(screen.getByText('Metadados e Identificação da Linha')).toBeInTheDocument()
      expect(screen.getByText('Histórico Resumido das Amostras')).toBeInTheDocument()
    })

    it('deve alternar os toggles de seleção e acionar a geração com toast de sucesso', async () => {
      const onClose = vi.fn()
      const mockGetChartImage = vi.fn().mockReturnValue('data:image/png;base64,dummy')

      render(
        <ModalRelatorioPDF
          isOpen={true}
          onClose={onClose}
          cartaDetalhes={mockCarta as any}
          getChartImage={mockGetChartImage}
        />
      )

      // Clica para alternar um toggle (desativar metadados)
      const toggleMetadados = screen.getByText('Metadados e Identificação da Linha')
      fireEvent.click(toggleMetadados)

      // Clica no botão de gerar relatório
      const btnGerar = screen.getByRole('button', { name: /Gerar Relatório PDF/i })
      fireEvent.click(btnGerar)

      await waitFor(() => {
        expect(onClose).toHaveBeenCalled()
      })

      const toasts = useToastStore.getState().toasts
      expect(toasts.some((t) => t.titulo === 'Relatório PDF Gerado')).toBe(true)
    })

    it('não deve renderizar nada quando isOpen for falso', () => {
      const { container } = render(
        <ModalRelatorioPDF
          isOpen={false}
          onClose={vi.fn()}
        />
      )
      expect(container).toBeEmptyDOMElement()
    })
  })

  // =========================================================================
  // 4. Testes do Botão em ControlesCarta
  // =========================================================================
  describe('ControlesCarta - Botão Relatório PDF', () => {
    it('deve renderizar o botão "Relatório PDF" e disparar o callback ao ser clicado', () => {
      const onGerarPDF = vi.fn()

      render(
        <ControlesCarta
          janelaSelecionada={30}
          onSelectJanela={vi.fn()}
          streamingPausado={false}
          onTogglePausa={vi.fn()}
          onExportarPNG={vi.fn()}
          onGerarRelatorioPDF={onGerarPDF}
          totalSubgrupos={25}
        />
      )

      const btnPDF = screen.getByTitle('Personalizar e gerar relatório técnico completo em PDF')
      expect(btnPDF).toBeInTheDocument()
      expect(btnPDF).toHaveTextContent('Relatório PDF')

      fireEvent.click(btnPDF)
      expect(onGerarPDF).toHaveBeenCalledTimes(1)
    })
  })

  // =========================================================================
  // 5. Testes da Página Dedicada RelatorioPage
  // =========================================================================
  describe('RelatorioPage Component', () => {
    function createQueryClient() {
      return new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      })
    }

    const mockCartas = [
      {
        id: 'carta-page-1',
        processo_id: 'proc-1',
        tipo_carta: 'X_R',
        tamanho_subgrupo: 5,
        modo_limites: 'DINAMICO',
        total_subgrupos: 30,
        limites_atuais: {
          lc: 25.0,
          lsc: 26.5,
          lic: 23.5,
          sigma_estimado: 0.5,
        },
        especificacoes: {
          lse: 27.0,
          lie: 23.0,
          valor_nominal: 25.0,
        },
      },
    ]

    const mockSubgrupos = [
      {
        id: 'sg-1',
        carta_id: 'carta-page-1',
        numero_subgrupo: 1,
        timestamp: '2026-10-13T12:00:00Z',
        valores_brutos: [25.1, 24.9, 25.0, 25.2, 24.8],
        estatisticas: {
          media_x: 25.0,
          amplitude_r: 0.4,
          desvio_s: 0.15,
        },
        fora_de_controle: false,
        violacoes: [],
      },
    ]

    it('deve renderizar a página de relatórios com o seletor de carta, diagnósticos e os 6 toggles', async () => {
      vi.spyOn(cartasApi, 'listar').mockResolvedValue(mockCartas as any)
      vi.spyOn(ingestaoApi, 'listarSubgrupos').mockResolvedValue(mockSubgrupos as any)
      useCEPStore.getState().setCartaAtiva(mockCartas[0] as any)

      const queryClient = createQueryClient()
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <RelatorioPage />
          </MemoryRouter>
        </QueryClientProvider>
      )

      expect(screen.getByRole('heading', { name: 'Gerar Relatório Técnico' })).toBeInTheDocument()
      expect(screen.getByText('Diagnóstico de Sigmas da Carta Atual')).toBeInTheDocument()
      expect(screen.getByText('Seções do Relatório (Toggles)')).toBeInTheDocument()

      // Verificar presença dos 7 toggles
      expect(screen.getByText('Snapshot do Gráfico Atual')).toBeInTheDocument()
      expect(screen.getByText('Limites de Controle Estatístico')).toBeInTheDocument()
      expect(screen.getByText('Limites de Especificação de Engenharia')).toBeInTheDocument()
      expect(screen.getByText('Cálculo de Sigmas do Processo')).toBeInTheDocument()
      expect(screen.getByText('Metadados e Identificação da Linha')).toBeInTheDocument()
      expect(screen.getByText('Histórico Resumido das Amostras')).toBeInTheDocument()
      expect(screen.getByText('Simulação Probabilística Binomial')).toBeInTheDocument()

      // Resumo da Exportação
      expect(screen.getByText('Resumo da Exportação')).toBeInTheDocument()
      expect(screen.getByText('6 de 7')).toBeInTheDocument()
    })

    it('deve alternar os toggles e permitir selecionar todos ou restaurar padrão', async () => {
      vi.spyOn(cartasApi, 'listar').mockResolvedValue(mockCartas as any)
      vi.spyOn(ingestaoApi, 'listarSubgrupos').mockResolvedValue(mockSubgrupos as any)
      useCEPStore.getState().setCartaAtiva(mockCartas[0] as any)

      const queryClient = createQueryClient()
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <RelatorioPage />
          </MemoryRouter>
        </QueryClientProvider>
      )

      // Clicar em "Selecionar Todos"
      const btnSelecionarTodos = screen.getByRole('button', { name: 'Selecionar Todos' })
      fireEvent.click(btnSelecionarTodos)
      expect(screen.getByText('7 de 7')).toBeInTheDocument()

      // Clicar em "Padrão"
      const btnPadrao = screen.getByRole('button', { name: /Padrão/i })
      fireEvent.click(btnPadrao)
      expect(screen.getByText('6 de 7')).toBeInTheDocument()

      // Clicar em um toggle específico
      const toggleGrafico = screen.getByText('Snapshot do Gráfico Atual')
      fireEvent.click(toggleGrafico)
      expect(screen.getByText('5 de 7')).toBeInTheDocument()
    })

    it('deve acionar a geração de relatório PDF com toast ao clicar no botão', async () => {
      vi.spyOn(cartasApi, 'listar').mockResolvedValue(mockCartas as any)
      vi.spyOn(ingestaoApi, 'listarSubgrupos').mockResolvedValue(mockSubgrupos as any)
      useCEPStore.getState().setCartaAtiva(mockCartas[0] as any)

      const queryClient = createQueryClient()
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <RelatorioPage />
          </MemoryRouter>
        </QueryClientProvider>
      )

      const btnGerar = screen.getByRole('button', { name: /Gerar Relatório PDF/i })
      fireEvent.click(btnGerar)

      await waitFor(() => {
        const toasts = useToastStore.getState().toasts
        expect(toasts.some((t) => t.titulo === 'Relatório PDF Gerado')).toBe(true)
      })
    })
  })
})

