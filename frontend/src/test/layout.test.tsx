import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MainLayout } from '@/components/layout/MainLayout'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { useAuthStore } from '@/stores/authStore'
import { useCEPStore } from '@/stores/cepStore'

describe('Fase 2 - Layout IHM Industrial (Sidebar, Topbar e MainLayout)', () => {
  beforeEach(() => {
    localStorage.clear()
    useAuthStore.getState().logout()
    useCEPStore.getState().setCartaAtiva(null)
    useCEPStore.getState().setStatusConexao('ONLINE')
    useCEPStore.getState().setStreamingPausado(false)
  })

  it('deve renderizar a Sidebar simplificada com Live CEP, Capacidade e Gerar Relatório', () => {
    const onToggle = vi.fn()
    render(
      <MemoryRouter>
        <Sidebar isCollapsed={false} onToggle={onToggle} />
      </MemoryRouter>
    )

    expect(screen.getByText('CEP Industrial')).toBeInTheDocument()
    expect(screen.getByText('Live CEP')).toBeInTheDocument()
    expect(screen.getByText('Capacidade')).toBeInTheDocument()
    expect(screen.getByText('Gerar Relatório')).toBeInTheDocument()

    // Valida que as abas desnecessárias foram removidas do menu lateral
    expect(screen.queryByText('Ingestão de Dados')).not.toBeInTheDocument()
    expect(screen.queryByText('Histórico & Causas')).not.toBeInTheDocument()
    expect(screen.queryByText('Processos & Cartas')).not.toBeInTheDocument()

    const btnToggle = screen.getByLabelText('Recolher menu lateral')
    fireEvent.click(btnToggle)
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('deve renderizar a Sidebar colapsada de forma compacta (w-18) sem quebra de layout', () => {
    const onToggle = vi.fn()
    const { container } = render(
      <MemoryRouter>
        <Sidebar isCollapsed={true} onToggle={onToggle} />
      </MemoryRouter>
    )

    const aside = container.querySelector('aside')
    expect(aside).toHaveClass('w-18')
    expect(screen.queryByText('CEP Industrial')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Expandir menu lateral')).toBeInTheDocument()
  })

  it('deve renderizar Topbar com telemetria, dados da carta e status da conexão', () => {
    useCEPStore.getState().setCartaAtiva({
      id: 'carta-test-id',
      processo_id: 'proc-1',
      tipo_carta: 'X_R',
      tamanho_subgrupo: 5,
      especificacoes: null,
      limites_atuais: {
        lc: 25.0,
        lsc: 25.75,
        lic: 24.25,
        sigma_estimado: 0.3,
      },
      modo_limites: 'DINAMICO',
      total_subgrupos: 15,
    })
    useCEPStore.getState().setStatusConexao('ONLINE')

    render(<Topbar />)

    expect(screen.getByText('ONLINE')).toBeInTheDocument()
    expect(screen.getByText(/X_R/i)).toBeInTheDocument()
    expect(screen.getByText(/DINAMICO/i)).toBeInTheDocument()
  })

  it('deve alternar pausa de streaming ao clicar no botão na Topbar', () => {
    render(<Topbar />)

    expect(useCEPStore.getState().streamingPausado).toBe(false)
    const btnPausar = screen.getByText('Congelar')
    fireEvent.click(btnPausar)

    expect(useCEPStore.getState().streamingPausado).toBe(true)
    expect(screen.getByText('Retomar')).toBeInTheDocument()
  })

  it('deve renderizar perfil do usuário e disparar logout', () => {
    useAuthStore.getState().login('fake-token', {
      id: 'usr-1',
      nome: 'Eng. Roberto Mendes',
      email: 'roberto@qualidade.ind.br',
      perfil: 'ENGENHEIRO',
    })

    const onLogout = vi.fn()
    render(<Topbar onLogout={onLogout} />)

    expect(screen.getByText('Eng. Roberto Mendes')).toBeInTheDocument()
    expect(screen.getByText('ENGENHEIRO')).toBeInTheDocument()

    const btnLogout = screen.getByTitle('Sair do sistema')
    fireEvent.click(btnLogout)

    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(onLogout).toHaveBeenCalledTimes(1)
  })

  it('deve renderizar MainLayout com filhos e persistir estado de colapso no localStorage', () => {
    render(
      <MemoryRouter>
        <MainLayout>
          <div data-testid="conteudo-teste">Área de Visualização Gráfica</div>
        </MainLayout>
      </MemoryRouter>
    )

    expect(screen.getByTestId('conteudo-teste')).toBeInTheDocument()

    const btnToggle = screen.getByLabelText('Recolher menu lateral')
    fireEvent.click(btnToggle)

    expect(localStorage.getItem('cep_sidebar_collapsed')).toBe('true')
  })
})
