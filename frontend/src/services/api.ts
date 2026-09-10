import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/stores/authStore'
import type {
  AmostraIngestaoRequest,
  CapacidadeResponse,
  CartaControleCreate,
  CartaControleResponse,
  ImportacaoLoteRequest,
  ImportacaoLoteResponse,
  LoginRequest,
  ModoLimitesUpdate,
  ProcessoCreate,
  ProcessoResponse,
  SubgrupoResponse,
  TokenResponse,
  UsuarioCreate,
  UsuarioResponse,
} from '@/types/api'

// Obter URL base do backend FastAPI (com fallback para /api/v1 através do proxy do Vite)
const baseURL = import.meta.env.VITE_API_URL || '/api/v1'

export const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
})

// ============================================================================
// Interceptors: Injeção de Token JWT e Tratamento de Desconexão por Expiração
// ============================================================================

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Busca token prioritariamente da store Zustand ou fallback do localStorage
    const token =
      useAuthStore.getState().token ||
      (typeof window !== 'undefined' ? localStorage.getItem('cep_auth_token') : null)

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }

    return config
  },
  (error: AxiosError) => {
    return Promise.reject(error)
  }
)

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Token expirado ou inválido: encerra sessão
      useAuthStore.getState().logout()
    }
    return Promise.reject(error)
  }
)

// ============================================================================
// Serviços da Camada de Apresentação e Negócio
// ============================================================================

export const authApi = {
  login: async (dados: LoginRequest): Promise<TokenResponse> => {
    const { data } = await api.post<TokenResponse>('/auth/login', dados)
    return data
  },

  cadastrar: async (dados: UsuarioCreate): Promise<UsuarioResponse> => {
    const { data } = await api.post<UsuarioResponse>('/auth/register', dados)
    return data
  },

  obterPerfil: async (): Promise<UsuarioResponse> => {
    const { data } = await api.get<UsuarioResponse>('/auth/me')
    return data
  },
}

export const processosApi = {
  listar: async (): Promise<ProcessoResponse[]> => {
    const { data } = await api.get<ProcessoResponse[]>('/processos')
    return data
  },

  obterPorId: async (id: string): Promise<ProcessoResponse> => {
    const { data } = await api.get<ProcessoResponse>(`/processos/${id}`)
    return data
  },

  criar: async (dados: ProcessoCreate): Promise<ProcessoResponse> => {
    const { data } = await api.post<ProcessoResponse>('/processos', dados)
    return data
  },
}

export const cartasApi = {
  listar: async (processoId?: string): Promise<CartaControleResponse[]> => {
    const params = processoId ? { processo_id: processoId } : undefined
    const { data } = await api.get<CartaControleResponse[]>('/cartas', { params })
    return data
  },

  obterPorId: async (cartaId: string): Promise<CartaControleResponse> => {
    const { data } = await api.get<CartaControleResponse>(`/cartas/${cartaId}`)
    return data
  },

  criar: async (dados: CartaControleCreate): Promise<CartaControleResponse> => {
    const { data } = await api.post<CartaControleResponse>('/cartas', dados)
    return data
  },

  obterCapacidade: async (cartaId: string, criterio = 1.33): Promise<CapacidadeResponse> => {
    const { data } = await api.get<CapacidadeResponse>(`/cartas/${cartaId}/capacidade`, {
      params: { criterio },
    })
    return data
  },

  alternarModoLimites: async (
    cartaId: string,
    dados: ModoLimitesUpdate
  ): Promise<CartaControleResponse> => {
    const { data } = await api.patch<CartaControleResponse>(`/cartas/${cartaId}/modo`, dados)
    return data
  },
}

export const ingestaoApi = {
  ingerirAmostra: async (
    cartaId: string,
    dados: AmostraIngestaoRequest
  ): Promise<SubgrupoResponse> => {
    const { data } = await api.post<SubgrupoResponse>(`/cartas/${cartaId}/amostras`, dados)
    return data
  },

  importarLote: async (
    cartaId: string,
    dados: ImportacaoLoteRequest
  ): Promise<ImportacaoLoteResponse> => {
    const { data } = await api.post<ImportacaoLoteResponse>(`/cartas/${cartaId}/importar`, dados)
    return data
  },

  listarSubgrupos: async (cartaId: string, limite?: number): Promise<SubgrupoResponse[]> => {
    const params = limite ? { limite } : undefined
    const { data } = await api.get<SubgrupoResponse[]>(`/cartas/${cartaId}/subgrupos`, { params })
    return data
  },
}
