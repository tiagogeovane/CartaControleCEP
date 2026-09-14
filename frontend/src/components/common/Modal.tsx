import React, { useEffect, useId } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  titulo: string
  descricao?: string
  children: React.ReactNode
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const maxWidthMap = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
}

export function Modal({
  isOpen,
  onClose,
  titulo,
  descricao,
  children,
  maxWidth = 'md',
  className,
}: ModalProps) {
  const titleId = useId()
  const descId = useId()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    if (isOpen) {
      document.body.style.overflow = 'hidden'
      window.addEventListener('keydown', handleKeyDown)
    } else {
      document.body.style.overflow = ''
    }

    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descricao ? descId : undefined}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Janela Modal */}
      <div
        className={cn(
          'relative w-full bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-6 z-10 animate-in zoom-in-95 duration-150',
          maxWidthMap[maxWidth],
          className
        )}
      >
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h2
              id={titleId}
              className="text-lg font-semibold text-slate-100 tracking-tight"
            >
              {titulo}
            </h2>
            {descricao && (
              <p id={descId} className="mt-1 text-sm text-slate-400">
                {descricao}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Fechar diálogo"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo do Conteúdo */}
        <div className="mt-4">{children}</div>
      </div>
    </div>
  )
}
