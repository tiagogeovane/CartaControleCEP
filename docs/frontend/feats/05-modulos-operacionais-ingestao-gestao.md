# Feature FEAT-05: Módulos Operacionais - Ingestão, Histórico e Gestão de Processos

* **Fase do Roadmap:** [Fase 5 - Módulos Operacionais e Gestão Fabril](../Roadmap.md#7-fase-5-m%C3%B3dulos-operacionais-e-gest%C3%A3o-fabril)
* **Status:** ✅ Concluído
* **Testes Automatizados:** 97 testes unitários e de integração aprovados (100% de sucesso em 13 arquivos)

---

## 1. Contexto e Motivação

A **Fase 5** expande a IHM de Controle Estatístico de Processos (CEP) com as ferramentas operacionais de chão de fábrica e gestão industrial:

1. **Ingestão Manual com Navegação por Teclado ([RF06]):** Interface otimizada para operadores em postos fabris, permitindo digitação rápida de subgrupos amostrais com navegação automática via tecla <kbd>Enter</kbd> e submissão direta via atalho de teclado <kbd>Ctrl + Enter</kbd>, fornecendo feedback visual imediato de conformidade e violação de limites.
2. **Importação em Lote via Arquivos CSV/JSON ([RF08]):** Área de upload com drag-and-drop e parser no cliente para processamento massivo de medições históricas, com validação de colunas ($n$ amostras por subgrupo), tabela de pré-visualização e envio em lote para a API analítica.
3. **Histórico Analítico e Apontamento de Causas Especiais ([RF11, RF12, RF16]):** Tabela de alta densidade (`TabelaSubgrupos`) com busca textual, filtro de anomalias, badges das regras de Nelson violadas, integração com o modal de apontamento de causa especial e exportação de dados para CSV compatível com a norma RFC 4180.
4. **Gestão de Processos e Assistente de Criação de Cartas ([RF01, RF02, RF05, RN01]):** Catálogo de linhas fabris e processos industriais, com assistente modal inteligente (`WizardNovaCarta`) que aplica a regra estatística **[RN01]** para recomendar automaticamente o tipo de carta de controle em função do tamanho amostral $n$, além de validar as tolerâncias de engenharia ($LIE < LSE$).

---

## 2. Decisões Arquiteturais e Padrões de Projeto

### 2.1. Ingestão de Dados e Telemetria (`IngestaoPage.tsx`)

* **Navegação Ergonômica por Teclado [RF06]:**
  * O array de inputs numéricos adapta-se dinamicamente ao tamanho amostral $n$ da carta de controle ativa.
  * O pressionamento de <kbd>Enter</kbd> em um campo transfere o foco e seleciona automaticamente o conteúdo do próximo input via referências (`useRef`).
  * No último campo, ou através do atalho global <kbd>Ctrl + Enter</kbd> (ou <kbd>Cmd + Enter</kbd>), o subgrupo é submetido imediatamente à API (`ingestaoApi.ingerirAmostra`).
  * Após a submissão, os campos são limpos e o foco retorna ao primeiro input para a próxima leitura de bancada, mantendo as mãos do operador exclusivamente no teclado numérico.
* **Feedback Visual Instantâneo:**
  * Subgrupos sob controle exibem banner de confirmação em verde com métricas resumidas ($\bar{X}, R/s$).
  * Subgrupos fora de controle disparam alerta visual destacado em vermelho com as violações de regras estatísticas identificadas pelo motor analítico.
* **Importação Massiva em Lote [RF08]:**
  * Zona de transferência drag-and-drop que aceita `.csv`, `.txt` e `.json`.
  * Sanitização de delimitadores (vírgula, ponto-e-vírgula, tabulação) e normalização de separadores decimais.
  * Pré-visualização das 5 primeiras linhas antes da confirmação do envio.

### 2.2. Histórico e Auditoria Analítica (`HistoricoPage.tsx` e `TabelaSubgrupos.tsx`)

* **Tabela de Alta Densidade Informacional:**
  * Componente `TabelaSubgrupos` paginado com exibição monoespaçada de subgrupo, timestamp formatado, valores brutos, média ($\bar{X}$), dispersão ($R$, $s$ ou $MR$ conforme $n$), status de controle e badges de violações.
  * Filtro instantâneo por busca de texto (número do subgrupo ou código da regra) e alternador "Apenas Anomalias".
* **Apontamento de Causa Especial e Mitigação [RF16]:**
  * Linhas anômalas contam com botão de ação rápida "Apontar Causa", abrindo o `ModalCausaEspecial` pré-populado com os metadados do subgrupo.
* **Exportação CSV Conforme RFC 4180 [RF12]:**
  * Geração dinâmica em memória de arquivo CSV com escape de delimitadores e strings, permitindo download direto para auditoria e relatórios gerenciais externos.

### 2.3. Gestão Fabril e Wizard de Cartas (`ProcessosPage.tsx`, `WizardNovaCarta.tsx`, `wizardHelpers.ts`)

* **Recomendação Automatizada por Tamanho Amostral [RN01]:**
  * Função pura `recomendarTipoCarta(n)` isolada em `wizardHelpers.ts`:
    * $n = 1 \to$ Carta Individual e Amplitude Móvel (`I_MR`)
    * $2 \le n \le 10 \to$ Carta de Médias e Amplitude (`X_R`)
    * $n > 10 \to$ Carta de Médias e Desvio-Padrão (`X_S`)
  * Atualização instantânea do tipo recomendado na alteração do campo $n$, com badge visual indicando conformidade com a norma [RN01] e flexibilidade para sobreposição manual pelo engenheiro.
* **Validação de Tolerâncias e Engenharia de Produto:**
  * Validação rígida que exige que o Limite Inferior de Especificação ($LIE$) seja estritamente menor que o Limite Superior ($LSE$), prevenindo configurações inconsistentes de capacidade ($C_p / C_{pk}$).

---

## 3. Arquivos Criados e Modificados

| Arquivo | Responsabilidade |
| :--- | :--- |
| `frontend/src/components/modules/wizardHelpers.ts` | Função pura `recomendarTipoCarta` implementando a regra estatística [RN01] |
| `frontend/src/components/modules/WizardNovaCarta.tsx` | Modal assistente para parametrização e criação de cartas de controle com validação de tolerâncias |
| `frontend/src/components/modules/TabelaSubgrupos.tsx` | Tabela analítica de alta densidade com paginação, filtros, badges de regra e gatilho de apontamento |
| `frontend/src/components/modules/index.ts` | Barrel export dos componentes operacionais |
| `frontend/src/pages/IngestaoPage.tsx` | Página com abas para Ingestão Manual [RF06] e Importação em Lote [RF08] |
| `frontend/src/pages/HistoricoPage.tsx` | Página de Histórico Analítico com KPIs, tabela densa, apontamento [RF16] e exportação CSV [RF12] |
| `frontend/src/pages/ProcessosPage.tsx` | Página de Gestão de Processos Industriais [RF01, RF02, RF05] e orquestração de cartas |
| `frontend/src/pages/index.ts` | Barrel export atualizado com as novas páginas |
| `frontend/src/App.tsx` | Roteamento declarativo das rotas `/ingestao`, `/historico` e `/processos` |
| `frontend/src/test/ingestao.test.tsx` | 7 testes unitários e de integração para navegação por teclado e upload de arquivos |
| `frontend/src/test/historico.test.tsx` | 4 testes cobrindo filtros de tabela, apontamento de causa e exportação CSV |
| `frontend/src/test/processos.test.tsx` | 4 testes cobrindo CRUD de processos, recomendação [RN01] e validações de engenharia |
| `docs/frontend/Roadmap.md` | Atualização do status da Fase 5 para concluído |
| `docs/frontend/feats/README.md` | Registro de FEAT-05 no índice de funcionalidades |

---

## 4. Validação e Qualidade

* **Vitest:** 13 arquivos de teste, 97 testes executados com 100% de sucesso.
* **Oxlint:** 0 erros e 0 avisos de linting.
* **TypeScript Compiler (`tsc -b`):** 0 erros de tipagem estática.
* **Vite Build:** Build de produção gerado com sucesso em `dist/`.
