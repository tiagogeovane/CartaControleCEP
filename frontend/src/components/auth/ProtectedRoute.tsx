import React from 'react'
import { Outlet } from 'react-router-dom'
import type { PerfilUsuario } from '@/types/api'

export interface ProtectedRouteProps {
  perfisPermitidos?: (PerfilUsuario | string)[]
  children?: React.ReactNode
}

/**
 * Em um sistema aberto (sem necessidade de login e com acesso irrestrito de administrador),
 * ProtectedRoute permite acesso direto a todos os módulos da aplicação.
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  return children ? <>{children}</> : <Outlet />
}

