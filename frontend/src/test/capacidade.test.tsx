import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BannerSuficiencia,
  GaugesCapacidade,
  HistogramaCapacidade,
  calcularClassesHistograma,
  obterClassificacaoIndice,
  pdfNormal,
} from '@/components/capacidade'
import { CapacidadePage } from '@/pages/CapacidadePage'
import { cartasApi, ingestaoApi } from '@/services/api'
import { useCEPStore } from '@/stores/cepStore'
import type { CapacidadeResponse, CartaControleResponse, SubgrupoResponse } from '@/types/api'

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
}

describe('Fase 4 - Análise de Capacidade do Processo (Cp, Cpk, Histograma e Regra RN04)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    useCEPStore.getState().setCartaAtiva(null)
    useCEPStore.getState().setBufferHistorico([])
  })

  // =========================================================================
  // 1. Helpers Matemáticos e Estatísticos (capacidadeHelpers)
  // =========================================================================
  describe('Helpers de Capacidade (capacidadeHelpers)', () => {
    it('deve classificar índices de capacidade corretamente por faixas', () => {
      // Nulo ou NaN
      const nulo = obterClassificacaoIndice(null)
      expect(nulo.texto).toBe('INDETERMINADO')
      expect(nulo.varianteBadge).toBe('neutro')

      const nanVal = obterClassificacaoIndice(NaN)
      expect(nanVal.texto).toBe('INDETERMINADO')

      // Incapaz (< 1.00)
      const incapaz = obterClassificacaoIndice(0.85)
      expect(incapaz.texto).toBe('INCAPAZ (< 1.00)')
      expect(incapaz.varianteBadge).toBe('fora_de_controle')

      // Aceitável (1.00 a 1.33)
      const aceitavel = obterClassificacaoIndice(1.2)
      expect(aceitavel.texto).toBe('ACEITÁVEL (1.00 a 1.33)')
      expect(aceitavel.varianteBadge).toBe('alerta')

      // Capaz e Seguro (>= 1.33)
      const capaz = obterClassificacaoIndice(1.45)
      expect(capaz.texto).toBe('CAPAZ E SEGURO (≥ 1.33)')
      expect(capaz.varianteBadge).toBe('sob_controle')
    })

    it('deve calcular a PDF Gaussiana normal com propriedades matemáticas esperadas', () => {
      // Sigma <= 0
      expect(pdfNormal(10, 10, 0)).toBe(0)
      expect(pdfNormal(10, 10, -1)).toBe(0)

      // No ponto central (x = média), densidade é máxima: 1 / (sigma * sqrt(2*PI))
      const media = 20.0
      const sigma = 2.0
      const densidadeCentro = pdfNormal(media, media, sigma)
      const esperadoCentro = 1 / (sigma * Math.sqrt(2 * Math.PI))
      expect(Math.abs(densidadeCentro - esperadoCentro)).toBeLessThan(1e-5)

      // Simetria: f(media - delta) === f(media + delta)
      const fEsquerda = pdfNormal(media - 1.5, media, sigma)
      const fDireita = pdfNormal(media + 1.5, media, sigma)
      expect(Math.abs(fEsquerda - fDireita)).toBeLessThan(1e-9)

      // Decaimento para valores distantes
      const fLonge = pdfNormal(media + 6.0, media, sigma)
      expect(densidadeCentro > fLonge).toBe(true)
    })

    it('deve particionar amostras em classes para o histograma', () => {
      // Vazio
      const vazio = calcularClassesHistograma([])
      expect(vazio.bins).toEqual([])
      expect(vazio.larguraClasse).toBe(0)

      // Valor uniforme (amplitude zero)
      const uniforme = calcularClassesHistograma([10, 10, 10, 10])
      expect(uniforme.bins).toHaveLength(1)
      expect(uniforme.bins[0].contagem).toBe(4)

      // Dados distribuídos
      const dados = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]
      const { bins, larguraClasse } = calcularClassesHistograma(dados, 5)
      expect(bins.length).toBeGreaterThan(0)
      expect(larguraClasse).toBeGreaterThan(0)

      const totalContagens = bins.reduce((sum, b) => sum + b.contagem, 0)
      expect(totalContagens).toBe(dados.length)
    })
  })

  // =========================================================================
  // 2. Banner de Suficiência Amostral (Regra RN04)
  // =========================================================================
  describe('BannerSuficiencia [RN04]', () => {
    it('não deve renderizar nada se o total de subgrupos atingir ou superar o mínimo recomendado', () => {
      const { container } = render(
        <BannerSuficiencia totalSubgrupos={25} minimoRecomendado={20} />
      )
      expect(container.firstChild).toBeNull()

      const { container: containerExato } = render(
        <BannerSuficiencia totalSubgrupos={20} minimoRecomendado={20} />
      )
      expect(containerExato.firstChild).toBeNull()
    })

    it('deve renderizar alerta com regra [RN04] e subgrupos faltantes se < 20', () => {
      render(<BannerSuficiencia totalSubgrupos={12} minimoRecomendado={20} />)

      expect(screen.getByTestId('banner-suficiencia')).toBeInTheDocument()
      expect(
        screen.getByText('Amostra Estatisticamente Preliminar (Regra [RN04])')
      ).toBeInTheDocument()
      expect(screen.getByText('12 / 20 Subgrupos')).toBeInTheDocument()
      expect(
        screen.getByText(/Colete mais 8 subgrupos para homologar o processo com suficiência estatística\./i)
      ).toBeInTheDocument()
    })
  })

  // =========================================================================
  // 3. Velocímetros de Capacidade (GaugesCapacidade)
  // =========================================================================
  describe('GaugesCapacidade', () => {
    it('deve renderizar os mostradores Cp e Cpk com status PROCESSO HOMOLOGADO para Cpk >= 1.33', () => {
      render(
        <GaugesCapacidade
          indices={{
            cp: 1.52,
            cpk: 1.41,
            cpu: 1.45,
            cpl: 1.41,
          }}
          classificacao="Processo Altamente Capaz"
          criterioAprovacao={1.33}
        />
      )

      expect(screen.getByTestId('gauges-capacidade-container')).toBeInTheDocument()
      expect(screen.getByText('1.52')).toBeInTheDocument()
      expect(screen.getByText('1.41')).toBeInTheDocument()
      expect(screen.getByText('PROCESSO HOMOLOGADO')).toBeInTheDocument()
      expect(screen.getByText('Processo Altamente Capaz')).toBeInTheDocument()
      expect(screen.getByText('1.450')).toBeInTheDocument() // Cpu
    })

    it('deve renderizar status NÃO CONFORME para processo incapaz (Cpk < 1.33)', () => {
      render(
        <GaugesCapacidade
          indices={{
            cp: 0.95,
            cpk: 0.82,
            cpu: 0.82,
            cpl: 1.08,
          }}
          criterioAprovacao={1.33}
        />
      )

      expect(screen.getByText('0.95')).toBeInTheDocument()
      expect(screen.getByText('0.82')).toBeInTheDocument()
      expect(screen.getByText('NÃO CONFORME')).toBeInTheDocument()
      expect(screen.getAllByText('INCAPAZ (< 1.00)').length).toBeGreaterThan(0)
    })

    it('deve exibir placeholders seguros quando os índices forem nulos', () => {
      render(<GaugesCapacidade indices={null} />)

      const placeholders = screen.getAllByText('--')
      expect(placeholders.length).toBeGreaterThan(0)
      expect(screen.getAllByText('INDETERMINADO').length).toBe(2)
    })
  })

  // =========================================================================
  // 4. Histograma com Curva Gaussiana Teórica (HistogramaCapacidade)
  // =========================================================================
  describe('HistogramaCapacidade', () => {
    it('deve renderizar o gráfico BaseChart com dados reais e linhas de especificação', () => {
      const amostras = [19.8, 20.0, 20.1, 19.9, 20.2, 20.0, 19.7, 20.3, 20.1, 19.9]
      const { container } = render(
        <HistogramaCapacidade
          amostras={amostras}
          mediaProcesso={20.0}
          sigmaEstimado={0.2}
          especificacoes={{
            lse: 20.6,
            lie: 19.4,
            valor_nominal: 20.0,
          }}
        />
      )

      expect(screen.getByTestId('histograma-capacidade-container')).toBeInTheDocument()
      expect(container.querySelector('canvas')).toBeInTheDocument()
    })

    it('deve simular amostras gaussianas automaticamente quando lista fornecida for vazia', () => {
      const { container } = render(
        <HistogramaCapacidade
          amostras={[]}
          mediaProcesso={50.0}
          sigmaEstimado={1.5}
          especificacoes={{
            lse: 55.0,
            lie: 45.0,
            valor_nominal: 50.0,
          }}
        />
      )

      expect(screen.getByTestId('histograma-capacidade-container')).toBeInTheDocument()
      expect(container.querySelector('canvas')).toBeInTheDocument()
    })
  })

  // =========================================================================
  // 5. Página Completa de Capacidade (CapacidadePage)
  // =========================================================================
  describe('CapacidadePage', () => {
    const mockCartas: CartaControleResponse[] = [
      {
        id: 'carta-test-01',
        processo_id: 'proc-01',
        tipo_carta: 'X_R',
        tamanho_subgrupo: 5,
        modo_limites: 'DINAMICO',
        total_subgrupos: 15,
        limites_atuais: {
          lc: 25.0,
          lsc: 25.8,
          lic: 24.2,
          sigma_estimado: 0.28,
        },
        especificacoes: {
          lie: 24.0,
          lse: 26.0,
          valor_nominal: 25.0,
        },
      },
    ]

    const mockCapacidade: CapacidadeResponse = {
      carta_id: 'carta-test-01',
      processo_id: 'proc-01',
      tipo_carta: 'X_R',
      tamanho_subgrupo: 5,
      total_subgrupos: 15,
      amostra_estatisticamente_robusta: false,
      aviso: 'Amostra preliminar com menos de 20 subgrupos',
      media_processo: 25.02,
      sigma_estimado: 0.27,
      especificacoes: {
        lie: 24.0,
        lse: 26.0,
        valor_nominal: 25.0,
      },
      limites_controle: {
        lc: 25.0,
        lsc: 25.8,
        lic: 24.2,
        sigma_estimado: 0.27,
      },
      indices: {
        cp: 1.23,
        cpk: 1.21,
        cpu: 1.21,
        cpl: 1.25,
      },
      aprovado: false,
      criterio_aprovacao: 1.33,
      classificacao: 'Capaz com Ressalvas',
    }

    const mockSubgrupos: SubgrupoResponse[] = Array.from({ length: 15 }, (_, i) => ({
      id: `sg-${i + 1}`,
      carta_id: 'carta-test-01',
      numero_subgrupo: i + 1,
      timestamp: new Date(2026, 8, 10, 10, i, 0).toISOString(),
      valores_brutos: [24.9, 25.0, 25.1, 25.0, 25.2],
      estatisticas: {
        media_x: 25.04,
        amplitude_r: 0.3,
        desvio_s: 0.12,
        valores_brutos: [24.9, 25.0, 25.1, 25.0, 25.2],
      },
      fora_de_controle: false,
      violacoes: [],
    }))

    it('deve renderizar a página de capacidade com dados da carta e banner de suficiência', async () => {
      vi.spyOn(cartasApi, 'listar').mockResolvedValue(mockCartas)
      vi.spyOn(cartasApi, 'obterCapacidade').mockResolvedValue(mockCapacidade)
      vi.spyOn(ingestaoApi, 'listarSubgrupos').mockResolvedValue(mockSubgrupos)

      const queryClient = createQueryClient()

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <CapacidadePage />
          </MemoryRouter>
        </QueryClientProvider>
      )

      // Título e seletor da carta
      expect(
        screen.getByRole('heading', { name: 'Análise de Capacidade do Processo' })
      ).toBeInTheDocument()

      // Banner de suficiência deve aparecer pois total_subgrupos = 15 < 20
      const banner = await screen.findByTestId('banner-suficiencia')
      expect(banner).toBeInTheDocument()
      expect(screen.getByText(/15 \/ 20 Subgrupos/i)).toBeInTheDocument()

      // Velocímetros de capacidade
      expect(await screen.findByTestId('gauges-capacidade-container')).toBeInTheDocument()
      expect(await screen.findByText('1.23')).toBeInTheDocument() // Cp
      const cpkElements = await screen.findAllByText('1.21') // Cpk (CardKpi e Gauge)
      expect(cpkElements.length).toBeGreaterThan(0)

      // Classificação oficial do processo (CardKpi e GaugesCapacidade)
      const classifElements = await screen.findAllByText('Capaz com Ressalvas')
      expect(classifElements.length).toBeGreaterThan(0)
    })

    it('deve permitir recarregar a análise de capacidade manualmente pelo botão de atualizar', async () => {
      const obterCapacidadeSpy = vi.spyOn(cartasApi, 'obterCapacidade').mockResolvedValue(mockCapacidade)
      vi.spyOn(cartasApi, 'listar').mockResolvedValue(mockCartas)
      vi.spyOn(ingestaoApi, 'listarSubgrupos').mockResolvedValue(mockSubgrupos)

      const queryClient = createQueryClient()

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <CapacidadePage />
          </MemoryRouter>
        </QueryClientProvider>
      )

      await screen.findByTestId('gauges-capacidade-container')

      const btnRecarregar = screen.getByRole('button', { name: /Recalcular/i })
      fireEvent.click(btnRecarregar)

      expect(obterCapacidadeSpy).toHaveBeenCalled()
    })
  })
})
