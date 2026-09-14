import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { ToastContainer } from '@/components/common/ToastContainer'

export interface MainLayoutProps {
  children?: React.ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('cep_sidebar_collapsed') === 'true'
    }
    return false
  })

  useEffect(() => {
    localStorage.setItem('cep_sidebar_collapsed', String(isSidebarCollapsed))
  }, [isSidebarCollapsed])

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => !prev)
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      {/* Sidebar Lateral */}
      <Sidebar isCollapsed={isSidebarCollapsed} onToggle={toggleSidebar} />

      {/* Conteúdo Principal + Topbar */}
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        <Topbar />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-950">
          {children || <Outlet />}
        </main>
      </div>

      {/* Notificações Toasts Globais */}
      <ToastContainer />
    </div>
  )
}
