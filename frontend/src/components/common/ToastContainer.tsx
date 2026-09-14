import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { useToastStore, type ToastTipo } from '@/stores/toastStore'
import { cn } from '@/lib/utils'

const tipoConfig: Record<
  ToastTipo,
  { bg: string; border: string; text: string; icon: React.ReactNode }
> = {
  success: {
    bg: 'bg-emerald-950/95',
    border: 'border-emerald-700/60',
    text: 'text-emerald-200',
    icon: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
  },
  warning: {
    bg: 'bg-amber-950/95',
    border: 'border-amber-700/60',
    text: 'text-amber-200',
    icon: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />,
  },
  error: {
    bg: 'bg-red-950/95',
    border: 'border-red-700/60',
    text: 'text-red-200',
    icon: <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />,
  },
  info: {
    bg: 'bg-slate-900/95',
    border: 'border-slate-700/80',
    text: 'text-slate-200',
    icon: <Info className="w-5 h-5 text-blue-400 shrink-0" />,
  },
}

export function ToastContainer() {
  const { toasts, removerToast } = useToastStore()

  if (toasts.length === 0) return null

  return (
    <div
      aria-live="polite"
      aria-label="Notificações do sistema"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
    >
      {toasts.map((toast) => {
        const config = tipoConfig[toast.tipo]

        return (
          <div
            key={toast.id}
            role="alert"
            className={cn(
              'pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-xl backdrop-blur-md transition-all duration-300 animate-in slide-in-from-bottom-5',
              config.bg,
              config.border
            )}
          >
            {config.icon}
            <div className="flex-1 min-w-0">
              <h3 className={cn('text-sm font-semibold tracking-tight', config.text)}>
                {toast.titulo}
              </h3>
              {toast.mensagem && (
                <p className="mt-0.5 text-xs text-slate-300/90 leading-relaxed break-words">
                  {toast.mensagem}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => removerToast(toast.id)}
              className="text-slate-400 hover:text-slate-200 p-1 rounded-md transition-colors cursor-pointer"
              aria-label="Fechar notificação"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
