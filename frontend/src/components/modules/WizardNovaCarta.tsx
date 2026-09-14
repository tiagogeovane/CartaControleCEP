import React, { useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Sparkles,
  X,
} from 'lucide-react'
import { cartasApi } from '@/services/api'
import { recomendarTipoCarta } from './wizardHelpers'
import type {
  CartaControleCreate,
  CartaControleResponse,
  ModoLimites,
  ProcessoResponse,
  TipoCarta,
} from '@/types/api'

export interface WizardNovaCartaProps {
  isOpen: boolean
  processos: ProcessoResponse[]
  processoPreSelecionadoId?: string
  onClose: () => void
  onSuccess: (novaCarta: CartaControleResponse) => void
}

export function WizardNovaCarta({
  isOpen,
  processos,
  processoPreSelecionadoId,
  onClose,
  onSuccess,
}: WizardNovaCartaProps) {
  const [processoId, setProcessoId] = useState(
    () => processoPreSelecionadoId || processos[0]?.id || ''
  )
  const [tamanhoSubgrupo, setTamanhoSubgrupo] = useState(5)
  const [tipoCarta, setTipoCarta] = useState<TipoCarta>('X_R')
  const [tipoAlteradoManualmente, setTipoAlteradoManualmente] = useState(false)
  const [modoLimites, setModoLimites] = useState<ModoLimites>('DINAMICO')

  // Limites de especificação
  const [temEspecificacoes, setTemEspecificacoes] = useState(false)
  const [lie, setLie] = useState<string>('')
  const [lse, setLse] = useState<string>('')
  const [valorNominal, setValorNominal] = useState<string>('')

  // Estados de submissão e erro
  const [erroValidacao, setErroValidacao] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen) return null

  const idProcessoEfetivo = processoId || processoPreSelecionadoId || processos[0]?.id || ''
  const recomendadoAtual = recomendarTipoCarta(tamanhoSubgrupo)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErroValidacao(null)

    if (!idProcessoEfetivo) {
      setErroValidacao('Selecione um processo industrial associado.')
      return
    }

    if (tamanhoSubgrupo < 1) {
      setErroValidacao('O tamanho do subgrupo (n) deve ser no mínimo 1.')
      return
    }

    let especificacoesPayload = null
    if (temEspecificacoes) {
      const numLie = lie !== '' ? parseFloat(lie) : null
      const numLse = lse !== '' ? parseFloat(lse) : null
      const numNominal = valorNominal !== '' ? parseFloat(valorNominal) : null

      if (numLie !== null && numLse !== null && numLie >= numLse) {
        setErroValidacao(
          'O Limite Inferior de Especificação (LIE) deve ser estritamente menor que o Limite Superior (LSE).'
        )
        return
      }

      if (
        numNominal !== null &&
        ((numLie !== null && numNominal < numLie) || (numLse !== null && numNominal > numLse))
      ) {
        setErroValidacao('O Valor Nominal / Alvo deve estar situado entre o LIE e o LSE.')
        return
      }

      especificacoesPayload = {
        lie: numLie,
        lse: numLse,
        valor_nominal: numNominal,
      }
    }

    const payload: CartaControleCreate = {
      processo_id: idProcessoEfetivo,
      tamanho_subgrupo: tamanhoSubgrupo,
      tipo_carta: tipoCarta,
      modo_limites: modoLimites,
      especificacoes: especificacoesPayload,
    }

    try {
      setIsSubmitting(true)
      const novaCarta = await cartasApi.criar(payload)
      onSuccess(novaCarta)
      onClose()
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Falha ao criar nova carta de controle no servidor.'
      setErroValidacao(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      data-testid="wizard-nova-carta-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs"
    >
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 text-slate-100 max-h-[90vh] overflow-y-auto">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">
                Criar Nova Carta de Controle [RN01]
              </h2>
              <p className="text-xs text-slate-400">
                Assistente com recomendação estatística automatizada de cartas
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mensagem de Erro */}
        {erroValidacao && (
          <div className="mt-4 p-3 rounded-xl bg-red-950/60 border border-red-800/60 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{erroValidacao}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Processo Industrial */}
          <div>
            <label htmlFor="wizard-processo" className="block text-xs font-semibold text-slate-300 mb-1">
              Processo Industrial
            </label>
            <select
              id="wizard-processo"
              value={processoId}
              onChange={(e) => setProcessoId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-700 text-slate-200 focus:outline-hidden focus:border-blue-500"
            >
              {processos.length === 0 ? (
                <option value="">Nenhum processo disponível</option>
              ) : (
                processos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.codigo_linha} - {p.nome}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Tamanho Amostral n e Recomendação */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="wizard-tamanho-n" className="block text-xs font-semibold text-slate-300 mb-1">
                Tamanho do Subgrupo (n)
              </label>
              <input
                id="wizard-tamanho-n"
                type="number"
                min={1}
                max={50}
                value={tamanhoSubgrupo}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 1
                  const seguro = Math.max(1, val)
                  setTamanhoSubgrupo(seguro)
                  if (!tipoAlteradoManualmente) {
                    setTipoCarta(recomendarTipoCarta(seguro))
                  }
                }}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-700 text-slate-200 font-mono focus:outline-hidden focus:border-blue-500"
              />
              <p className="text-3xs text-slate-400 mt-1 flex items-center gap-1">
                <HelpCircle className="w-3 h-3" />
                {tamanhoSubgrupo === 1
                  ? 'n = 1 → Carta Individual (I-MR)'
                  : tamanhoSubgrupo <= 10
                  ? '2 ≤ n ≤ 10 → Carta de Médias e Amplitude (X̄-R)'
                  : 'n > 10 → Carta de Médias e Desvio-Padrão (X̄-s)'}
              </p>
            </div>

            <div>
              <label htmlFor="wizard-tipo-carta" className="block text-xs font-semibold text-slate-300 mb-1">
                Tipo de Carta
              </label>
              <div className="relative">
                <select
                  id="wizard-tipo-carta"
                  value={tipoCarta}
                  onChange={(e) => {
                    setTipoCarta(e.target.value as TipoCarta)
                    setTipoAlteradoManualmente(true)
                  }}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-700 text-slate-200 focus:outline-hidden focus:border-blue-500"
                >
                  <option value="X_R">X̄-R (Médias e Amplitude)</option>
                  <option value="X_S">X̄-s (Médias e Desvio-Padrão)</option>
                  <option value="I_MR">I-MR (Valores Individuais)</option>
                  <option value="P">P (Proporção de Defeituosos)</option>
                  <option value="NP">NP (Número de Defeituosos)</option>
                  <option value="C">C (Defeitos por Unidade Fixo)</option>
                  <option value="U">U (Defeitos por Unidade Variável)</option>
                </select>
              </div>
              {tipoCarta === recomendadoAtual && (
                <span className="inline-flex items-center gap-1 mt-1 text-3xs font-semibold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40">
                  <CheckCircle2 className="w-3 h-3" /> Recomendado para n={tamanhoSubgrupo}
                </span>
              )}
            </div>
          </div>

          {/* Modo de Limites */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Modo de Cálculo de Limites
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setModoLimites('DINAMICO')}
                className={`px-3 py-2 text-xs rounded-xl font-medium border text-center transition-colors cursor-pointer ${
                  modoLimites === 'DINAMICO'
                    ? 'bg-blue-950/60 text-blue-300 border-blue-600'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                }`}
              >
                Dinâmico (Fase I)
                <span className="block text-3xs text-slate-500 font-normal">Recalculado a cada subgrupo</span>
              </button>
              <button
                type="button"
                onClick={() => setModoLimites('FIXO')}
                className={`px-3 py-2 text-xs rounded-xl font-medium border text-center transition-colors cursor-pointer ${
                  modoLimites === 'FIXO'
                    ? 'bg-blue-950/60 text-blue-300 border-blue-600'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                }`}
              >
                Fixo (Fase II)
                <span className="block text-3xs text-slate-500 font-normal">Limites congelados do processo</span>
              </button>
            </div>
          </div>

          {/* Limites de Especificação / Tolerâncias do Produto */}
          <div className="pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={temEspecificacoes}
                  onChange={(e) => setTemEspecificacoes(e.target.checked)}
                  className="rounded border-slate-700 text-blue-600 focus:ring-blue-500"
                />
                Definir Limites de Especificação (Capacidade Cp/Cpk)
              </label>
            </div>

            {temEspecificacoes && (
              <div className="grid grid-cols-3 gap-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <div>
                  <label htmlFor="wizard-lie" className="block text-3xs uppercase font-mono text-slate-400 mb-1">
                    LIE (Inferior)
                  </label>
                  <input
                    id="wizard-lie"
                    type="number"
                    step="any"
                    placeholder="Ex: 9.80"
                    value={lie}
                    onChange={(e) => setLie(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-900 border border-slate-700 text-slate-100 font-mono focus:outline-hidden focus:border-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="wizard-alvo" className="block text-3xs uppercase font-mono text-slate-400 mb-1">
                    Nominal / Alvo
                  </label>
                  <input
                    id="wizard-alvo"
                    type="number"
                    step="any"
                    placeholder="Ex: 10.00"
                    value={valorNominal}
                    onChange={(e) => setValorNominal(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-900 border border-slate-700 text-slate-100 font-mono focus:outline-hidden focus:border-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="wizard-lse" className="block text-3xs uppercase font-mono text-slate-400 mb-1">
                    LSE (Superior)
                  </label>
                  <input
                    id="wizard-lse"
                    type="number"
                    step="any"
                    placeholder="Ex: 10.20"
                    value={lse}
                    onChange={(e) => setLse(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-900 border border-slate-700 text-slate-100 font-mono focus:outline-hidden focus:border-blue-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Rodapé com Ações */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || processos.length === 0}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-600/20"
            >
              {isSubmitting ? 'Criando Carta...' : 'Criar Carta de Controle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
