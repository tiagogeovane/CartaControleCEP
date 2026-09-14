import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MainLayout } from '@/components/layout/MainLayout'
import {
  LiveStudioPage,
  CapacidadePage,
  IngestaoPage,
  HistoricoPage,
  ProcessosPage,
} from '@/pages'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Redirecionamento de compatibilidade: login não é mais necessário */}
          <Route path="/login" element={<Navigate to="/live" replace />} />

          <Route path="/" element={<MainLayout />}>
            <Route index element={<Navigate to="/live" replace />} />

            {/* Todas as rotas operacionais e de engenharia abertas com acesso irrestrito */}
            <Route path="live" element={<LiveStudioPage />} />
            <Route path="capacidade" element={<CapacidadePage />} />
            <Route path="ingestao" element={<IngestaoPage />} />
            <Route path="historico" element={<HistoricoPage />} />
            <Route path="processos" element={<ProcessosPage />} />

            <Route path="*" element={<Navigate to="/live" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
