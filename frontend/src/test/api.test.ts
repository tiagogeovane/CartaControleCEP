import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api, authApi, cartasApi, ingestaoApi, processosApi } from '@/services/api'
import { useAuthStore } from '@/stores/authStore'
import type { InternalAxiosRequestConfig } from 'axios'

describe('Fase 1 - Cliente Axios e Interceptors de Autenticação JWT', () => {
  beforeEach(() => {
    localStorage.clear()
    useAuthStore.getState().logout()
    vi.restoreAllMocks()
  })

  it('deve sincronizar token no localStorage e estado Zustand ao efetuar login', () => {
    const fakeToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake.payload'
    const fakeUser = {
      id: 'user-uuid-1',
      nome: 'Operador Linha 1',
      email: 'operador@fabrica.ind.br',
      perfil: 'OPERADOR',
    }

    useAuthStore.getState().login(fakeToken, fakeUser)

    expect(useAuthStore.getState().isAuthenticated).toBe(true)
    expect(useAuthStore.getState().token).toBe(fakeToken)
    expect(localStorage.getItem('cep_auth_token')).toBe(fakeToken)

    useAuthStore.getState().logout()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(useAuthStore.getState().token).toBeNull()
    expect(localStorage.getItem('cep_auth_token')).toBeNull()
  })

  it('deve injetar cabeçalho Authorization com token Bearer no interceptor de requisição', async () => {
    const fakeToken = 'meu-token-jwt-seguro-123'
    useAuthStore.getState().setToken(fakeToken)

    // Acessa os interceptors registrados no axios instance
    const requestInterceptor = (api.interceptors.request as any).handlers[0]
    expect(requestInterceptor).toBeDefined()

    const mockConfig: InternalAxiosRequestConfig = {
      headers: {} as any,
    } as InternalAxiosRequestConfig

    const resultConfig = await requestInterceptor.fulfilled(mockConfig)
    expect(resultConfig.headers.Authorization).toBe(`Bearer ${fakeToken}`)
  })

  it('não deve injetar Authorization se não houver token ativo', async () => {
    useAuthStore.getState().logout()

    const requestInterceptor = (api.interceptors.request as any).handlers[0]
    const mockConfig: InternalAxiosRequestConfig = {
      headers: {} as any,
    } as InternalAxiosRequestConfig

    const resultConfig = await requestInterceptor.fulfilled(mockConfig)
    expect(resultConfig.headers.Authorization).toBeUndefined()
  })

  it('deve disparar logout automático no interceptor de resposta ao capturar status HTTP 401', async () => {
    const fakeToken = 'token-que-ira-expirar'
    useAuthStore.getState().setToken(fakeToken)
    expect(useAuthStore.getState().isAuthenticated).toBe(true)

    const responseInterceptor = (api.interceptors.response as any).handlers[0]
    expect(responseInterceptor).toBeDefined()

    const error401 = {
      response: {
        status: 401,
        data: { detail: 'Token expirado ou inválido' },
      },
    }

    try {
      await responseInterceptor.rejected(error401)
    } catch {
      // Rejeição esperada
    }

    // A sessão deve ter sido limpa
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(useAuthStore.getState().token).toBeNull()
    expect(localStorage.getItem('cep_auth_token')).toBeNull()
  })

  it('deve expor todos os métodos de API tipados conforme o roadmap', () => {
    expect(typeof authApi.login).toBe('function')
    expect(typeof authApi.cadastrar).toBe('function')
    expect(typeof authApi.obterPerfil).toBe('function')

    expect(typeof processosApi.listar).toBe('function')
    expect(typeof processosApi.criar).toBe('function')
    expect(typeof processosApi.obterPorId).toBe('function')

    expect(typeof cartasApi.listar).toBe('function')
    expect(typeof cartasApi.criar).toBe('function')
    expect(typeof cartasApi.obterPorId).toBe('function')
    expect(typeof cartasApi.obterCapacidade).toBe('function')
    expect(typeof cartasApi.alternarModoLimites).toBe('function')

    expect(typeof ingestaoApi.ingerirAmostra).toBe('function')
    expect(typeof ingestaoApi.importarLote).toBe('function')
    expect(typeof ingestaoApi.listarSubgrupos).toBe('function')
  })
})
