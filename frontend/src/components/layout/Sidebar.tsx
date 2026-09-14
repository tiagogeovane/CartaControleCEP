import { useState, useEffect } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  Activity,
  BarChart3,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  Cpu,
  Layers,
  Sliders,
  UploadCloud,
} from 'lucide-react'
import { cartasApi } from '@/services/api'
import { useCEPStore } from '@/stores/cepStore'
import type { CartaControleResponse } from '@/types/api'
import { cn } from '@/lib/utils'
import { formatarNomeCarta } from '@/utils/formatters'

export interface SidebarProps {
  isCollapsed: boolean
  onToggle: () => void
  className?: string
}

interface NavItem {
  label: string
  to: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
}

const navItems: NavItem[] = [
  {
    label: 'Live CEP',
    to: '/live',
    icon: Activity,
    badge: 'LIVE',
  },
  {
    label: 'Capacidade',
    to: '/capacidade',
    icon: BarChart3,
  },
  {
    label: 'Ingestão de Dados',
    to: '/ingestao',
    icon: UploadCloud,
  },
  {
    label: 'Histórico & Causas',
    to: '/historico',
    icon: ClipboardList,
  },
  {
    label: 'Processos & Cartas',
    to: '/processos',
    icon: Cpu,
  },
]

export function Sidebar({ isCollapsed, onToggle, className }: SidebarProps) {
  const [cartasDisponiveis, setCartasDisponiveis] = useState<CartaControleResponse[]>([])
  const [cartasSubmenuAberto, setCartasSubmenuAberto] = useState(true)

  const cartaAtivaId = useCEPStore((s) => s.cartaAtivaId)
  const setCartaAtiva = useCEPStore((s) => s.setCartaAtiva)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    let montado = true
    cartasApi
      .listar()
      .then((res) => {
        if (montado && res) {
          setCartasDisponiveis(res)
        }
      })
      .catch(() => {
        // Fallback silencioso caso a API ainda não esteja respondendo
      })
    return () => {
      montado = false
    }
  }, [cartaAtivaId])

  const handleSelecionarCarta = (carta: CartaControleResponse) => {
    setCartaAtiva(carta)
    if (location.pathname !== '/live') {
      navigate('/live')
    }
  }

  return (
    <aside
      aria-label="Navegação Principal"
      className={cn(
        'relative flex flex-col bg-slate-900 border-r border-slate-800 transition-all duration-300 ease-in-out shrink-0 select-none z-30',
        isCollapsed ? 'w-18' : 'w-72',
        className
      )}
    >
      {/* Brand Header */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-[#7C4FE0] to-[#9548D9] text-white shadow-md shadow-purple-950/40 shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col truncate">
              <span className="font-bold text-sm tracking-wider text-slate-100 uppercase">
                CEP Industrial
              </span>
              <span className="text-2xs text-slate-400 tracking-tight">
                Controle em Tempo Real
              </span>
            </div>
          )}
        </div>

        {/* Toggle Button */}
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            'flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 border border-transparent hover:border-slate-700 transition-colors cursor-pointer',
            isCollapsed && 'mx-auto mt-2'
          )}
          aria-label={isCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
          title={isCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 py-4 px-2 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon

          return (
            <div key={item.to} className="space-y-1">
              <NavLink
                to={item.to}
                title={isCollapsed ? item.label : undefined}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group relative cursor-pointer',
                    isActive
                      ? 'bg-gradient-to-r from-[#7C4FE0] to-[#9548D9] text-white shadow-md shadow-purple-900/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/70'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={cn(
                        'w-5 h-5 shrink-0 transition-transform group-hover:scale-105',
                        isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                      )}
                    />

                    {!isCollapsed && (
                      <span className="truncate flex-1 tracking-tight">
                        {item.label}
                      </span>
                    )}

                    {!isCollapsed && item.badge && (
                      <span
                        className={cn(
                          'px-1.5 py-0.5 text-3xs font-semibold rounded',
                          isActive
                            ? 'bg-white/20 text-white'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        )}
                      >
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </NavLink>

              {/* Submenu "Cartas de Controle" logo abaixo de Live CEP */}
              {item.to === '/live' && !isCollapsed && (
                <div className="pt-1 pb-1 px-1">
                  <button
                    type="button"
                    onClick={() => setCartasSubmenuAberto((prev) => !prev)}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 rounded-lg transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <Sliders className="w-3.5 h-3.5 text-purple-400" />
                      <span>Cartas de Controle</span>
                    </span>
                    {cartasSubmenuAberto ? (
                      <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                    )}
                  </button>

                  {/* Lista de Cartas Disponíveis */}
                  {cartasSubmenuAberto && (
                    <div className="mt-1 ml-4 pl-2 border-l border-slate-800 space-y-1">
                      {cartasDisponiveis.length === 0 ? (
                        <div className="py-1 px-2 text-3xs text-slate-500 italic">
                          Nenhuma carta cadastrada
                        </div>
                      ) : (
                        cartasDisponiveis.map((carta) => {
                          const isCartaAtiva = carta.id === cartaAtivaId

                          return (
                            <button
                              key={carta.id}
                              type="button"
                              onClick={() => handleSelecionarCarta(carta)}
                              className={cn(
                                'w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center justify-between group cursor-pointer',
                                isCartaAtiva
                                  ? 'bg-purple-600/30 text-purple-200 font-semibold border border-purple-500/40 shadow-xs'
                                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                              )}
                            >
                              <span className="truncate">
                                {formatarNomeCarta(carta)}
                              </span>
                              <span
                                className={cn(
                                  'text-3xs px-1 rounded',
                                  carta.modo_limites === 'DINAMICO'
                                    ? 'text-purple-300'
                                    : 'text-slate-500'
                                )}
                              >
                                {carta.modo_limites === 'DINAMICO' ? 'DYN' : 'FIX'}
                              </span>
                            </button>
                          )
                        })
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-3 border-t border-slate-800/80 text-center">
        {!isCollapsed ? (
          <div className="text-2xs text-slate-400 font-mono tracking-wider">
            IHM OPERACIONAL v2.0
          </div>
        ) : (
          <div className="w-2 h-2 mx-auto rounded-full bg-slate-700" />
        )}
      </div>
    </aside>
  )
}

