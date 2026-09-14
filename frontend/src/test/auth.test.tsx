import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { Topbar } from '@/components/layout/Topbar'
import { LoginPage } from '@/pages/LoginPage'
import { authApi } from '@/services/api'
import { useAuthStore } from '@/stores/authStore'
import { useCEPStore, type AlarmeAtivo } from '@/stores/cepStore'
import type { TokenResponse, UsuarioResponse } from '@/types/api'

const mockOperador: UsuarioResponse = {
  id: 'user-op-01',
  nome: 'Lucas Operador',
  email: 'lucas@fabrica.com',
  perfil: 'OPERADOR',
}

const mockEngenheiro: UsuarioResponse = {
  id: 'user-eng-01',
  nome: 'Ana Engenheira',
  email: 'ana@fabrica.com',
  perfil: 'ENGENHEIRO',
}

const mockTokenResponse: TokenResponse = {
  access_token: 'jwt-token-valido-123456',
  token_type: 'bearer',
  usuario: mockOperador,
}

describe('Fase 6 - Autenticação, RBAC e Experiência do Usuário', () => {
  beforeEach(() => {
    localStorage.clear()
    useAuthStore.getState().logout()
    useCEPStore.getState().limparAlarmes()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('LoginPage', () => {
    it('deve renderizar campos de login e permitir alternar para cadastro', () => {
      render(
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      )

      expect(screen.getByText('CEP Industrial 4.0')).toBeInTheDocument()
      expect(screen.getByLabelText('E-mail Corporativo')).toBeInTheDocument()
      expect(screen.getByLabelText('Senha de Acesso')).toBeInTheDocument()
      expect(screen.getByText('Entrar no Sistema')).toBeInTheDocument()

      // Alternar para cadastro
      fireEvent.click(screen.getByText('Cadastrar'))
      expect(screen.getByLabelText('Nome Completo')).toBeInTheDocument()
      expect(screen.getByLabelText('Perfil de Acesso (RBAC)')).toBeInTheDocument()
      expect(screen.getByText('Concluir Cadastro')).toBeInTheDocument()
    })

    it('deve validar e-mail e senha antes de enviar formulário de login', async () => {
      render(
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      )

      // E-mail inválido
      fireEvent.change(screen.getByLabelText('E-mail Corporativo'), {
        target: { value: 'emailinvalido' },
      })
      fireEvent.change(screen.getByLabelText('Senha de Acesso'), {
        target: { value: '123' },
      })
      fireEvent.click(screen.getByText('Entrar no Sistema'))

      expect(
        screen.getByText('Informe um endereço de e-mail corporativo válido.')
      ).toBeInTheDocument()

      // Senha curta
      fireEvent.change(screen.getByLabelText('E-mail Corporativo'), {
        target: { value: 'lucas@fabrica.com' },
      })
      fireEvent.click(screen.getByText('Entrar no Sistema'))

      expect(
        screen.getByText('A senha deve possuir no mínimo 6 caracteres.')
      ).toBeInTheDocument()
    })

    it('deve autenticar usuário com sucesso e salvar dados no authStore', async () => {
      vi.spyOn(authApi, 'login').mockResolvedValue(mockTokenResponse)

      render(
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      )

      fireEvent.change(screen.getByLabelText('E-mail Corporativo'), {
        target: { value: 'lucas@fabrica.com' },
      })
      fireEvent.change(screen.getByLabelText('Senha de Acesso'), {
        target: { value: 'senhaForte123' },
      })
      fireEvent.click(screen.getByText('Entrar no Sistema'))

      await waitFor(() => {
        expect(authApi.login).toHaveBeenCalledWith({
          email: 'lucas@fabrica.com',
          senha: 'senhaForte123',
        })
        expect(useAuthStore.getState().isAuthenticated).toBe(true)
        expect(useAuthStore.getState().token).toBe('jwt-token-valido-123456')
        expect(useAuthStore.getState().usuario?.nome).toBe('Lucas Operador')
      })
    })

    it('deve permitir cadastro de novo usuário e exibir mensagem de confirmação', async () => {
      vi.spyOn(authApi, 'cadastrar').mockResolvedValue(mockEngenheiro)

      render(
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      )

      fireEvent.click(screen.getByText('Cadastrar'))

      fireEvent.change(screen.getByLabelText('Nome Completo'), {
        target: { value: 'Ana Engenheira' },
      })
      fireEvent.change(screen.getByLabelText('E-mail Corporativo'), {
        target: { value: 'ana@fabrica.com' },
      })
      fireEvent.change(screen.getByLabelText('Senha (mínimo 6 dígitos)'), {
        target: { value: 'senhaSegura123' },
      })
      fireEvent.change(screen.getByLabelText('Perfil de Acesso (RBAC)'), {
        target: { value: 'ENGENHEIRO' },
      })

      fireEvent.click(screen.getByText('Concluir Cadastro'))

      await waitFor(() => {
        expect(authApi.cadastrar).toHaveBeenCalledWith({
          nome: 'Ana Engenheira',
          email: 'ana@fabrica.com',
          senha: 'senhaSegura123',
          perfil: 'ENGENHEIRO',
        })
        expect(
          screen.getByText(
            'Usuário cadastrado com sucesso! Efetue o login para acessar o sistema.'
          )
        ).toBeInTheDocument()
      })
    })
  })

  describe('ProtectedRoute e Acesso Aberto (Admin Total)', () => {
    it('deve permitir acesso direto a rota sem redirecionar para /login (sistema sem contas)', () => {
      render(
        <MemoryRouter initialEntries={['/modulo-protegido']}>
          <Routes>
            <Route path="/login" element={<div>Tela de Login</div>} />
            <Route element={<ProtectedRoute />}>
              <Route path="/modulo-protegido" element={<div>Conteúdo Liberado</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      )

      expect(screen.getByText('Conteúdo Liberado')).toBeInTheDocument()
      expect(screen.queryByText('Tela de Login')).not.toBeInTheDocument()
    })

    it('deve permitir acesso irrestrito a módulos de gestão sem tela de bloqueio RBAC', () => {
      render(
        <MemoryRouter initialEntries={['/gestao-processos']}>
          <Routes>
            <Route
              element={<ProtectedRoute perfisPermitidos={['ENGENHEIRO', 'ADMIN']} />}
            >
              <Route path="/gestao-processos" element={<div>Painel de Engenharia</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      )

      expect(screen.getByText('Painel de Engenharia')).toBeInTheDocument()
      expect(screen.queryByTestId('acesso-negado-container')).not.toBeInTheDocument()
    })

    it('deve renderizar filhos diretamente quando passados como prop', () => {
      render(
        <MemoryRouter>
          <ProtectedRoute>
            <div data-testid="filho-direto">Acesso Direto Concedido</div>
          </ProtectedRoute>
        </MemoryRouter>
      )

      expect(screen.getByTestId('filho-direto')).toBeInTheDocument()
    })
  })

  describe('Topbar: Sirene de Alarme e Sessão', () => {
    it('deve exibir informações do usuário logado e botão de logout', () => {
      useAuthStore.getState().login('token-teste', mockOperador)

      render(
        <MemoryRouter>
          <Topbar />
        </MemoryRouter>
      )

      expect(screen.getByText('Lucas Operador')).toBeInTheDocument()
      expect(screen.getByText('OPERADOR')).toBeInTheDocument()

      const btnLogout = screen.getByLabelText('Encerrar Sessão')
      fireEvent.click(btnLogout)

      expect(useAuthStore.getState().isAuthenticated).toBe(false)
      expect(useAuthStore.getState().usuario).toBeNull()
    })

    it('deve exibir identificador de Administrador e Acesso Total por padrão', () => {
      useAuthStore.setState({
        token: 'admin-local-token',
        usuario: {
          id: '00000000-0000-0000-0000-000000000001',
          nome: 'Administrador',
          email: 'admin@cep.local',
          perfil: 'ADMIN',
        },
        isAuthenticated: true,
      })

      render(
        <MemoryRouter>
          <Topbar />
        </MemoryRouter>
      )

      expect(screen.getByText('Administrador')).toBeInTheDocument()
      expect(screen.getByText('Acesso Total (Admin)')).toBeInTheDocument()
    })

    it('deve ativar indicador de sirene visual quando houver alarmes ativos', () => {
      const mockAlarme: AlarmeAtivo = {
        id: 'alarm-test-1',
        subgrupoNumero: 15,
        timestamp: new Date().toISOString(),
        violacoes: [
          {
            codigo_regra: 'REGRA_1',
            descricao: 'Ponto fora dos limites 3-sigma',
            numero_subgrupo: 15,
            pontos_violadores: [11.2],
          },
        ],
      }

      useCEPStore.setState({ alarmesAtivos: [mockAlarme] })

      render(
        <MemoryRouter>
          <Topbar />
        </MemoryRouter>
      )

      expect(screen.getByTestId('indicador-sirene-ativa')).toBeInTheDocument()
      expect(screen.getByText('1 ALARME(S)')).toBeInTheDocument()
    })

    it('deve permitir alternar o som da sirene entre ativado e silenciado', () => {
      render(
        <MemoryRouter>
          <Topbar />
        </MemoryRouter>
      )

      const btnSom = screen.getByLabelText('Silenciar sirene sonora')
      expect(btnSom).toBeInTheDocument()

      fireEvent.click(btnSom)
      expect(screen.getByLabelText('Ativar sirene sonora')).toBeInTheDocument()
    })
  })
})
