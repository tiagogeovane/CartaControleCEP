import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Badge } from '@/components/common/Badge'
import { CardKpi } from '@/components/common/CardKpi'
import { Modal } from '@/components/common/Modal'
import { ToastContainer } from '@/components/common/ToastContainer'
import { useToastStore } from '@/stores/toastStore'

describe('Fase 2 - Componentes Base do Design System', () => {
  it('deve renderizar Badge com diferentes variantes semânticas', () => {
    const { rerender } = render(<Badge variant="sob_controle">SOB CONTROLE</Badge>)
    expect(screen.getByText('SOB CONTROLE')).toBeInTheDocument()

    rerender(<Badge variant="fora_de_controle">FORA DE CONTROLE</Badge>)
    expect(screen.getByText('FORA DE CONTROLE')).toBeInTheDocument()

    rerender(<Badge variant="online" pulse>ONLINE</Badge>)
    expect(screen.getByText('ONLINE')).toBeInTheDocument()
  })

  it('deve renderizar CardKpi com formatação monoespaçada e status', () => {
    render(
      <CardKpi
        titulo="Média Global X̄̄"
        valor="25.042 mm"
        subtitulo="LSC: 25.75 | LIC: 24.25"
        status="success"
      />
    )

    expect(screen.getByText('Média Global X̄̄')).toBeInTheDocument()
    const valorEl = screen.getByText('25.042 mm')
    expect(valorEl).toBeInTheDocument()
    expect(valorEl).toHaveClass('font-mono')
    expect(screen.getByText('LSC: 25.75 | LIC: 24.25')).toBeInTheDocument()
  })

  it('deve controlar abertura, fechamento e tecla Escape no Modal', () => {
    const onClose = vi.fn()
    const { rerender } = render(
      <Modal isOpen={false} onClose={onClose} titulo="Apontamento de Causa">
        <p>Conteúdo do Modal</p>
      </Modal>
    )

    // Fechado
    expect(screen.queryByText('Apontamento de Causa')).not.toBeInTheDocument()

    // Aberto
    rerender(
      <Modal isOpen={true} onClose={onClose} titulo="Apontamento de Causa" descricao="Registro operacional">
        <p>Conteúdo do Modal</p>
      </Modal>
    )

    expect(screen.getByText('Apontamento de Causa')).toBeInTheDocument()
    expect(screen.getByText('Registro operacional')).toBeInTheDocument()
    expect(screen.getByText('Conteúdo do Modal')).toBeInTheDocument()

    // Dispara tecla Escape
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)

    // Clique no botão fechar
    const btnFechar = screen.getByLabelText('Fechar diálogo')
    fireEvent.click(btnFechar)
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('deve exibir e descartar notificações ToastContainer via toastStore', () => {
    render(<ToastContainer />)

    act(() => {
      useToastStore.getState().adicionarToast({
        tipo: 'warning',
        titulo: 'Violação Regra 1',
        mensagem: 'Subgrupo 32 ultrapassou limite 3 sigma',
        duracao: 0, // Sem auto-close nos testes
      })
    })

    expect(screen.getByText('Violação Regra 1')).toBeInTheDocument()
    expect(screen.getByText('Subgrupo 32 ultrapassou limite 3 sigma')).toBeInTheDocument()

    const btnFecharToast = screen.getByLabelText('Fechar notificação')
    fireEvent.click(btnFecharToast)

    expect(screen.queryByText('Violação Regra 1')).not.toBeInTheDocument()
  })
})
