import { useState } from 'react'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { Modal } from '@/components/common/Modal'
import { Badge } from '@/components/common/Badge'
import type { AlarmeAtivo } from '@/stores/cepStore'
import { REGRAS_NELSON_METADATA } from '@/types/cep'

export interface DadosCausaEspecial {
  subgrupoNumero: number
  causaRaiz: string
  acaoCorretiva: string
  responsavel: string
}

export interface ModalCausaEspecialProps {
  isOpen: boolean
  onClose: () => void
  alarme: AlarmeAtivo | null
  onSalvar: (dados: DadosCausaEspecial) => void
  usuarioAtual?: string
}

const CAUSAS_COMUNS = [
  'Desgaste de ferramenta de corte / inserto',
  'Variação em lote de matéria-prima fornecida',
  'Oscilação térmica / pressão pneumática na linha',
  'Descalibração de transdutor / sensor de medição',
  'Falha operacional no posicionamento da peça',
  'Intervenção manual não programada de manutenção',
  'Outra causa específica',
]

export function ModalCausaEspecial({
  isOpen,
  onClose,
  alarme,
  onSalvar,
  usuarioAtual = 'Operador Linha 01',
}: ModalCausaEspecialProps) {
  const [causaRaiz, setCausaRaiz] = useState(CAUSAS_COMUNS[0])
  const [causaCustomizada, setCausaCustomizada] = useState('')
  const [acaoCorretiva, setAcaoCorretiva] = useState('')
  const [responsavel, setResponsavel] = useState(usuarioAtual)
  const [erroValidacao, setErroValidacao] = useState<string | null>(null)

  const handleResetAndClose = () => {
    setCausaRaiz(CAUSAS_COMUNS[0])
    setCausaCustomizada('')
    setAcaoCorretiva('')
    setResponsavel(usuarioAtual)
    setErroValidacao(null)
    onClose()
  }

  if (!alarme) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const causaFinal =
      causaRaiz === 'Outra causa específica' ? causaCustomizada.trim() : causaRaiz

    if (!causaFinal) {
      setErroValidacao('Por favor, especifique a causa raiz da anomalia.')
      return
    }

    if (!acaoCorretiva.trim()) {
      setErroValidacao('Informe a ação corretiva adotada para mitigar o desvio.')
      return
    }

    if (!responsavel.trim()) {
      setErroValidacao('Informe o nome do responsável pelo apontamento.')
      return
    }

    onSalvar({
      subgrupoNumero: alarme.subgrupoNumero,
      causaRaiz: causaFinal,
      acaoCorretiva: acaoCorretiva.trim(),
      responsavel: responsavel.trim(),
    })

    handleResetAndClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleResetAndClose}
      titulo={`Apontamento de Causa Especial - Subgrupo #${alarme.subgrupoNumero}`}
      descricao="Registro de causa raiz e ações corretivas para subgrupo anômalo"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Resumo das Violações */}
        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
          <div className="text-2xs text-slate-400 font-medium uppercase tracking-wider">
            Violações Detectadas:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {alarme.violacoes.map((v, i) => {
              const meta = REGRAS_NELSON_METADATA[v.codigo_regra]
              const nome = meta ? meta.nome : v.codigo_regra
              return (
                <Badge key={i} variant="fora_de_controle" className="text-2xs">
                  {v.codigo_regra}: {nome}
                </Badge>
              )
            })}
          </div>
        </div>

        {/* Mensagem de Erro */}
        {erroValidacao && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-950/60 border border-red-800/60 text-xs text-red-300">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{erroValidacao}</span>
          </div>
        )}

        {/* Causa Raiz */}
        <div className="space-y-1.5">
          <label htmlFor="select-causa-raiz" className="block text-xs font-semibold text-slate-200">
            Causa Raiz da Anomalia *
          </label>
          <select
            id="select-causa-raiz"
            value={causaRaiz}
            onChange={(e) => setCausaRaiz(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-700 text-slate-200 focus:outline-hidden focus:border-blue-500 transition-colors"
          >
            {CAUSAS_COMUNS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {causaRaiz === 'Outra causa específica' && (
            <input
              type="text"
              placeholder="Descreva a causa específica detalhadamente..."
              value={causaCustomizada}
              onChange={(e) => setCausaCustomizada(e.target.value)}
              className="w-full mt-2 px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-blue-500"
            />
          )}
        </div>

        {/* Ação Corretiva */}
        <div className="space-y-1.5">
          <label htmlFor="textarea-acao-corretiva" className="block text-xs font-semibold text-slate-200">
            Ação Corretiva Aplicada *
          </label>
          <textarea
            id="textarea-acao-corretiva"
            rows={3}
            placeholder="Descreva a intervenção realizada (ex: troca de ferramenta, reajuste de parâmetros, segregação de lote)..."
            value={acaoCorretiva}
            onChange={(e) => setAcaoCorretiva(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-blue-500 resize-none"
          />
        </div>

        {/* Responsável */}
        <div className="space-y-1.5">
          <label htmlFor="input-responsavel" className="block text-xs font-semibold text-slate-200">
            Operador / Responsável Técnico *
          </label>
          <input
            id="input-responsavel"
            type="text"
            value={responsavel}
            onChange={(e) => setResponsavel(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-700 text-slate-200 focus:outline-hidden focus:border-blue-500"
          />
        </div>

        {/* Rodapé com Ações */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-900/30 transition-all cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Salvar Apontamento</span>
          </button>
        </div>
      </form>
    </Modal>
  )
}
