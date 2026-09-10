/**
 * Tipos e DTOs que espelham com precisão os Schemas Pydantic v2 do Backend FastAPI.
 */

// ==========================================
// Módulo de Autenticação e Usuários
// ==========================================

export type PerfilUsuario = 'OPERADOR' | 'ENGENHEIRO' | 'ADMIN'

export interface UsuarioResponse {
  id: string
  nome: string
  email: string
  perfil: PerfilUsuario | string
}

export interface UsuarioCreate {
  nome: string
  email: string
  senha: string
  perfil?: PerfilUsuario | string
}

export interface LoginRequest {
  email: string
  senha: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
  usuario: UsuarioResponse
}

// ==========================================
// Módulo de Processos Industriais
// ==========================================

export interface ProcessoCreate {
  nome: string
  codigo_linha: string
  descricao?: string | null
}

export interface ProcessoResponse {
  id: string
  nome: string
  codigo_linha: string
  descricao: string | null
}

// ==========================================
// Módulo de Cartas de Controle e Limites
// ==========================================

export type TipoCarta = 'X_R' | 'X_S' | 'I_MR' | 'P' | 'NP' | 'C' | 'U'
export type ModoLimites = 'DINAMICO' | 'FIXO'

export interface LimitesEspecificacaoSchema {
  lse: number | null
  lie: number | null
  valor_nominal: number | null
}

export interface LimitesControleSchema {
  lc: number
  lsc: number
  lic: number
  sigma_estimado: number
}

export interface CartaControleCreate {
  processo_id: string
  tamanho_subgrupo: number
  tipo_carta?: TipoCarta | string | null
  especificacoes?: LimitesEspecificacaoSchema | null
  modo_limites?: ModoLimites
}

export interface CartaControleResponse {
  id: string
  processo_id: string
  tipo_carta: TipoCarta | string
  tamanho_subgrupo: number
  especificacoes: LimitesEspecificacaoSchema | null
  limites_atuais: LimitesControleSchema | null
  modo_limites: ModoLimites
  total_subgrupos: number
}

export interface ModoLimitesUpdate {
  modo_limites: ModoLimites
}

// ==========================================
// Módulo de Capacidade do Processo (Cp, Cpk)
// ==========================================

export interface IndicesCapacidadeSchema {
  cp: number | null
  cpk: number | null
  cpu: number | null
  cpl: number | null
}

export interface CapacidadeResponse {
  carta_id: string
  processo_id: string
  tipo_carta: string
  tamanho_subgrupo: number
  total_subgrupos: number
  amostra_estatisticamente_robusta: boolean
  aviso: string | null
  media_processo: number
  sigma_estimado: number
  especificacoes: LimitesEspecificacaoSchema
  limites_controle: LimitesControleSchema
  indices: IndicesCapacidadeSchema
  aprovado: boolean
  criterio_aprovacao: number
  classificacao: string
}

// ==========================================
// Módulo de Subgrupos e Ingestão Amostral
// ==========================================

export interface AmostraIngestaoRequest {
  valores: number[]
  numero_subgrupo?: number | null
  timestamp?: string | null
}

export interface ViolacaoRegraResponse {
  codigo_regra: string
  descricao: string
  numero_subgrupo: number
  pontos_violadores: number[]
}

export interface EstatisticasResponse {
  media_x: number
  amplitude_r: number
  desvio_s: number
  valores_brutos: number[]
}

export interface SubgrupoResponse {
  id: string
  carta_id: string
  numero_subgrupo: number
  timestamp: string
  valores_brutos: number[]
  estatisticas: EstatisticasResponse
  fora_de_controle: boolean
  violacoes: ViolacaoRegraResponse[]
}

export interface ImportacaoLoteRequest {
  amostras: number[][]
}

export interface ImportacaoLoteResponse {
  carta_id: string
  total_importados: number
  subgrupos: SubgrupoResponse[]
}
