import React, { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Lock,
  LogIn,
  Mail,
  ShieldCheck,
  User,
  UserPlus,
} from 'lucide-react'
import { authApi } from '@/services/api'
import { useAuthStore } from '@/stores/authStore'
import type { PerfilUsuario } from '@/types/api'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const loginStore = useAuthStore((s) => s.login)

  const [modo, setModo] = useState<'login' | 'cadastro'>('login')

  // Campos de Login
  const [emailLogin, setEmailLogin] = useState('')
  const [senhaLogin, setSenhaLogin] = useState('')

  // Campos de Cadastro
  const [nomeCadastro, setNomeCadastro] = useState('')
  const [emailCadastro, setEmailCadastro] = useState('')
  const [senhaCadastro, setSenhaCadastro] = useState('')
  const [perfilCadastro, setPerfilCadastro] = useState<PerfilUsuario>('OPERADOR')

  // Estados de feedback
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const destinoRedirecionamento =
    (location.state as { from?: { pathname?: string } })?.from?.pathname || '/live'

  const validarEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro(null)
    setSucesso(null)

    if (!validarEmail(emailLogin)) {
      setErro('Informe um endereço de e-mail corporativo válido.')
      return
    }

    if (senhaLogin.length < 6) {
      setErro('A senha deve possuir no mínimo 6 caracteres.')
      return
    }

    try {
      setIsSubmitting(true)
      const res = await authApi.login({
        email: emailLogin.trim(),
        senha: senhaLogin,
      })

      loginStore(res.access_token, res.usuario)
      navigate(destinoRedirecionamento, { replace: true })
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Falha na autenticação. Verifique seu e-mail e senha.'
      setErro(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCadastro = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro(null)
    setSucesso(null)

    if (nomeCadastro.trim().length < 2) {
      setErro('O nome completo deve ter pelo menos 2 caracteres.')
      return
    }

    if (!validarEmail(emailCadastro)) {
      setErro('Informe um endereço de e-mail corporativo válido.')
      return
    }

    if (senhaCadastro.length < 6) {
      setErro('A senha deve conter pelo menos 6 caracteres.')
      return
    }

    try {
      setIsSubmitting(true)
      await authApi.cadastrar({
        nome: nomeCadastro.trim(),
        email: emailCadastro.trim(),
        senha: senhaCadastro,
        perfil: perfilCadastro,
      })

      setSucesso('Usuário cadastrado com sucesso! Efetue o login para acessar o sistema.')
      setModo('login')
      setEmailLogin(emailCadastro.trim())
      setSenhaLogin('')
      setNomeCadastro('')
      setEmailCadastro('')
      setSenhaCadastro('')
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Erro ao cadastrar novo usuário. O e-mail pode já estar em uso.'
      setErro(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      data-testid="login-page-container"
      className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 selection:bg-blue-600 selection:text-white"
    >
      <div className="w-full max-w-md space-y-6">
        {/* Marca e Título da IHM Industrial */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-500/30 text-blue-400 shadow-xl shadow-blue-500/5">
            <Activity className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100">
            CEP Industrial 4.0
          </h1>
          <p className="text-xs text-slate-400">
            Controle Estatístico de Processos em Tempo Real
          </p>
        </div>

        {/* Card de Formulário */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xs space-y-6">
          {/* Abas Login / Cadastro */}
          <div className="grid grid-cols-2 p-1 bg-slate-950 rounded-2xl border border-slate-800 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setModo('login')
                setErro(null)
              }}
              className={`py-2 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                modo === 'login'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Acessar</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setModo('cadastro')
                setErro(null)
              }}
              className={`py-2 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                modo === 'cadastro'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Cadastrar</span>
            </button>
          </div>

          {/* Mensagens de Alerta */}
          {erro && (
            <div
              data-testid="alerta-erro-auth"
              className="p-3 rounded-xl bg-red-950/60 border border-red-800/60 text-red-300 text-xs flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{erro}</span>
            </div>
          )}

          {sucesso && (
            <div
              data-testid="alerta-sucesso-auth"
              className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-xs flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{sucesso}</span>
            </div>
          )}

          {/* FORMULÁRIO DE LOGIN */}
          {modo === 'login' ? (
            <form onSubmit={handleLogin} noValidate className="space-y-4">
              <div>
                <label htmlFor="login-email" className="block text-xs font-semibold text-slate-300 mb-1.5">
                  E-mail Corporativo
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    placeholder="operador@industria.com.br"
                    value={emailLogin}
                    onChange={(e) => setEmailLogin(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 text-xs rounded-xl bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="login-senha" className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Senha de Acesso
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    id="login-senha"
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={senhaLogin}
                    onChange={(e) => setSenhaLogin(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 text-xs rounded-xl bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-lg shadow-blue-600/20 cursor-pointer disabled:opacity-50"
              >
                <LogIn className="w-4 h-4" />
                <span>{isSubmitting ? 'Autenticando...' : 'Entrar no Sistema'}</span>
              </button>
            </form>
          ) : (
            /* FORMULÁRIO DE CADASTRO */
            <form onSubmit={handleCadastro} noValidate className="space-y-4">
              <div>
                <label htmlFor="cadastro-nome" className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Nome Completo
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    id="cadastro-nome"
                    type="text"
                    placeholder="Eng. Carlos Silva"
                    value={nomeCadastro}
                    onChange={(e) => setNomeCadastro(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 text-xs rounded-xl bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="cadastro-email" className="block text-xs font-semibold text-slate-300 mb-1.5">
                  E-mail Corporativo
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    id="cadastro-email"
                    type="email"
                    placeholder="carlos.silva@industria.com.br"
                    value={emailCadastro}
                    onChange={(e) => setEmailCadastro(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 text-xs rounded-xl bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="cadastro-senha" className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Senha (mínimo 6 dígitos)
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    id="cadastro-senha"
                    type="password"
                    placeholder="••••••••"
                    value={senhaCadastro}
                    onChange={(e) => setSenhaCadastro(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 text-xs rounded-xl bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="cadastro-perfil" className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Perfil de Acesso (RBAC)
                </label>
                <div className="relative">
                  <ShieldCheck className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <select
                    id="cadastro-perfil"
                    value={perfilCadastro}
                    onChange={(e) => setPerfilCadastro(e.target.value as PerfilUsuario)}
                    className="w-full pl-10 pr-3 py-2.5 text-xs rounded-xl bg-slate-950 border border-slate-700 text-slate-100 focus:outline-hidden focus:border-blue-500 transition-colors"
                  >
                    <option value="OPERADOR">Operador (Coleta e Monitoramento)</option>
                    <option value="ENGENHEIRO">Engenheiro (Configurações e Cartas)</option>
                    <option value="ADMIN">Administrador (Acesso Irrestrito)</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-lg shadow-blue-600/20 cursor-pointer disabled:opacity-50"
              >
                <UserPlus className="w-4 h-4" />
                <span>{isSubmitting ? 'Cadastrando...' : 'Concluir Cadastro'}</span>
              </button>
            </form>
          )}
        </div>

        {/* Rodapé informativo */}
        <div className="text-center text-3xs text-slate-500 font-mono">
          Ambiente protegido por Token JWT e Controle RBAC [RF03]
        </div>
      </div>
    </div>
  )
}
