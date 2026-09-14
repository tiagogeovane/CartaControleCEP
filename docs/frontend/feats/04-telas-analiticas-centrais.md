# Feature FEAT-04: Telas Analíticas Centrais - Live Studio e Análise de Capacidade

* **Fase do Roadmap:** [Fase 4 - Telas Analíticas Centrais (Live Studio e Análise de Capacidade)](../Roadmap.md#6-fase-4-telas-anal%C3%ADticas-centrais-live-studio-e-an%C3%A1lise-de-capacidade)
* **Status:** ✅ Concluído
* **Testes Automatizados:** 82 testes unitários e de integração aprovados (100% de sucesso em 10 arquivos)

---

## 1. Contexto e Motivação

A **Fase 4** representa o núcleo analítico e operacional da IHM industrial de Controle Estatístico de Processos (CEP). O objetivo principal foi consolidar os blocos do Design System (Fase 2) e o motor gráfico de alta performance em Apache ECharts (Fase 3) em duas experiências de tela integradas, responsivas e voltadas para chão de fábrica e salas de controle (CCT):

1. **Live CEP Studio (`/live`):** Ambiente de monitoramento em tempo real conectado via WebSocket resiliente com streaming contínuo a 60 FPS (**[RNF02]**), exibindo gráficos sincronizados ($\bar{X}-R, \bar{X}-s, I-MR$), cards de KPI calculados dinamicamente ($\bar{\bar{X}}, \bar{R}/\bar{s}/\bar{MR}, \hat{\sigma}$, contagem de subgrupos), feed cronológico de anomalias com violações das 8 Regras de Nelson e fluxo completo de apontamento de causa especial e ações corretivas (**[RF16]**).
2. **Análise de Capacidade do Processo (`/capacidade`):** Módulo dedicado à avaliação da capabilidade do processo industrial (**[RN04]**), consumindo os cálculos estatísticos do backend (`GET /api/v1/cartas/{id}/capacidade`) com mostradores em velocímetro (*Speedometer Gauges*) para os índices de capacidade potencial ($C_p$) e real centrado ($C_{pk}$), métricas unilaterais ($C_{pu}, C_{pl}$), histograma de frequências agrupadas com sobreposição da curva normal teórica de Gauss e banner de advertência para amostras preliminares com menos de 20 subgrupos (**[RN04]**).

---

## 2. Decisões Arquiteturais e Padrões de Projeto

### 2.1. Live CEP Studio (`LiveStudioPage.tsx` e submódulo `components/live/`)

1. **Subscrição Reativa Desacoplada (`useWebSocketCEP`):**
   * Ao montar a página para uma carta ativa selecionada, o hook `useWebSocketCEP(cartaAtivaId)` inicia a subscrição com reconexão automática e heartbeat de 20 segundos.
   * A recepção de mensagens `NOVO_SUBGRUPO_PROCESSADO` atualiza diretamente o buffer do `cepStore` sem provocar re-renders em cascata nos seletores e componentes estáticos.
2. **Feed Cronológico de Alarmes das Regras de Nelson (`FeedAlarmes.tsx`):**
   * Apresenta as ocorrências anômalas recentes com identificação do subgrupo, horário formatado, badges de severidade e código oficial da regra violada com sua descrição canônica.
   * Botão interativo para focar no subgrupo violador e botão de ação direta para abrir o formulário de causa especial (**[RF16]**).
   * Estado amigável de *Processo Sob Controle* exibido quando não há desvios ativos.
3. **Modal de Apontamento de Causa Especial e Ação Corretiva (`ModalCausaEspecial.tsx` - [RF16]):**
   * Diálogo modal acessível construído sobre o componente `Modal`, apresentando resumo das violações estatísticas detectadas.
   * Catálogo de causas comuns de chão de fábrica (desgaste de ferramenta, lote de matéria-prima, oscilação térmica/pressão, descalibração de sensor, erro operacional) com opção para descrição livre detalhada.
   * Validação rigorosa dos campos obrigatórios (causa, ação corretiva executada e operador/responsável).
   * Integração com a `toastStore` para notificação visual de sucesso após o registro.

### 2.2. Análise de Capacidade do Processo (`CapacidadePage.tsx` e submódulo `components/capacidade/`)

1. **Separação de Helpers Puros e Ergonomia React Fast Refresh (`capacidadeHelpers.ts`):**
   * Funções de classificação (`obterClassificacaoIndice`), cálculo da densidade normal de Gauss (`pdfNormal`) e particionamento em classes (`calcularClassesHistograma`) isoladas em arquivo utilitário puro para evitar alertas de *fast refresh* e facilitar cobertura de testes unitários isolados.
2. **Velocímetros Analógicos Industriais em SVG Semântico (`GaugesCapacidade.tsx`):**
   * Mostradores vetoriais SVG com arco de 270 graus (-135° a +135°) calibrados de 0 a 2.5+:
     * **Zona Vermelha (< 1.00):** Processo Incapaz / Não Conforme com alto risco de refugo.
     * **Zona Amarela (1.00 a 1.33):** Processo Aceitável com advertência operacional.
     * **Zona Verde (≥ 1.33):** Processo Capaz e Seguro homologado formalmente (**[RN04]**).
   * Ponteiro rotativo dinâmico com sombra e marcação de homologação no ponto crítico $1.33$.
   * Exibição monoespaçada do valor numérico com precisão de duas casas decimais e painel complementar com índices unilaterais $C_{pu}$ e $C_{pl}$.
3. **Histograma de Frequências com Curva Gaussiana Teórica (`HistogramaCapacidade.tsx`):**
   * Composição com Apache ECharts via `BaseChart`:
     * Série de barras (`bar`) agrupando medições amostrais em classes calculadas dinamicamente.
     * Série de linha suave (`line`, `smooth: true`) sobrepondo a função densidade de probabilidade (PDF) escalonada para o volume de amostras: $C(x) = N \cdot h \cdot f(x)$.
     * Linhas de referência verticais (`markLine`) para Limite Inferior de Engenharia ($LIE$), Limite Superior de Engenharia ($LSE$), Valor Nominal (Alvo) e Média do Processo ($\mu$).
     * Algoritmo de síntese gaussiana (Box-Muller) para renderização consistente mesmo em cartas recém-criadas sem amostras históricas completas.
4. **Banner de Suficiência Amostral (`BannerSuficiencia.tsx` - [RN04]):**
   * Alerta visual destacado em tom âmbar que avalia se a carta possui no mínimo 20 subgrupos coletados.
   * Caso o total de subgrupos seja inferior a 20, instrui o operador sobre o caráter preliminar do estudo e calcula a quantidade faltante para homologação formal.
5. **Roteamento e Navegação Declarativa (`App.tsx`):**
   * Associação das rotas `/live` e `/capacidade` no `BrowserRouter` com renderização dentro do `MainLayout`.

---

## 3. Arquivos Criados e Modificados

| Arquivo | Responsabilidade |
| :--- | :--- |
| `frontend/src/components/live/FeedAlarmes.tsx` | Lista cronológica de anomalias com regras de Nelson, badges de severidade e gatilho de apontamento |
| `frontend/src/components/live/ModalCausaEspecial.tsx` | Formulário modal acessível para registro de causas especiais e ações corretivas (**[RF16]**) |
| `frontend/src/components/live/index.ts` | Barrel export dos componentes do módulo Live CEP |
| `frontend/src/components/capacidade/capacidadeHelpers.ts` | Funções matemáticas puras: classificação de índices, PDF Gaussiana e cálculo de classes do histograma |
| `frontend/src/components/capacidade/BannerSuficiencia.tsx` | Banner informativo e de advertência para suficiência amostral mínima de 20 subgrupos (**[RN04]**) |
| `frontend/src/components/capacidade/GaugesCapacidade.tsx` | Velocímetros analógicos SVG de $C_p$ e $C_{pk}$ com zonas de conformidade industrial e métricas $C_{pu}/C_{pl}$ |
| `frontend/src/components/capacidade/HistogramaCapacidade.tsx` | Histograma ECharts com sobreposição teórica da curva de Gauss e markLines de especificação |
| `frontend/src/components/capacidade/index.ts` | Barrel export dos componentes e helpers de capacidade do processo |
| `frontend/src/pages/LiveStudioPage.tsx` | Página analítica central de Live Studio CEP com orquestração de gráficos, streaming, KPIs e alarmes |
| `frontend/src/pages/CapacidadePage.tsx` | Página de Estudo de Capacidade com consumo de API, seletores, velocímetros e histograma |
| `frontend/src/pages/index.ts` | Barrel export das páginas da aplicação |
| `frontend/src/App.tsx` | Mapeamento das rotas analíticas centrais `/live` e `/capacidade` |
| `frontend/src/test/capacidade.test.tsx` | Suíte completa com 12 testes unitários e de integração cobrindo helpers, banner, gauges, histograma e página |
| `frontend/src/test/liveStudio.test.tsx` | Suíte com 8 testes unitários e de integração cobrindo feed de alarmes, modal RF16 e página Live Studio |
| `docs/frontend/Roadmap.md` | Atualização do status da Fase 4 para concluído |
| `docs/frontend/feats/README.md` | Registro de FEAT-04 no índice de funcionalidades |

---

## 4. Validação e Testes Automatizados

A implementação da Fase 4 foi submetida a uma bateria rigorosa de testes automatizados com Vitest, React Testing Library e verificações estáticas de tipos e qualidade de código:

1. **Métricas Verificadas em `capacidade.test.tsx` (12 testes):**
   * Classificação correta por faixas: nulo/NaN $\to$ `INDETERMINADO`, $< 1.00 \to$ `INCAPAZ`, $1.00 \le x < 1.33 \to$ `ACEITÁVEL`, $\ge 1.33 \to$ `CAPAZ E SEGURO`.
   * Propriedades matemáticas da PDF normal: valor nulo para $\sigma \le 0$, valor máximo no centro $\mu$, simetria perfeita em $\mu \pm \delta$ e decaimento assintótico nas caudas.
   * Algoritmo de particionamento de bins para histogramas e conservação da contagem total de amostras.
   * Comportamento condicional de `BannerSuficiencia`: ausente para $\ge 20$ subgrupos e ativado com contadores precisos para $< 20$ subgrupos (**[RN04]**).
   * Renderização dos gauges analógicos com status de homologação (`PROCESSO HOMOLOGADO` vs `NÃO CONFORME`).
   * Renderização do componente `HistogramaCapacidade` e presença de Canvas ECharts com amostras reais e sintéticas.
   * Integração assíncrona da `CapacidadePage` com TanStack Query e disparo manual de recalcular via botão de atualização.

2. **Métricas Verificadas em `liveStudio.test.tsx` (8 testes):**
   * Renderização do estado vazio do feed de alarmes (*Processo Sob Controle*).
   * Renderização da lista de violações com horário, identificadores de subgrupo e disparo de callbacks de foco e limpeza.
   * Validação de campos obrigatórios no `ModalCausaEspecial` (**[RF16]**), impedindo submissão de formulário inconsistente.
   * Registro com causa pré-definida e descrição customizada via campo aberto.
   * Integração da `LiveStudioPage` com WebSocket mockado, KPIs calculados e abertura do modal disparando toast de notificação.

3. **Resultado Global da Suíte de Testes (Vitest):**
   ```text
   Test Files  10 passed (10)
        Tests  82 passed (82)
     Duration  10.25s
   ```

4. **Verificação de Compilação TypeScript e Build Vite:**
   ```text
   tsc -b && vite build
   ✓ built in 1.34s (Exit code 0, zero erros de tipagem)
   ```

5. **Linter Estrito (oxlint):**
   ```text
   oxlint
   0 warnings, 0 errors (Exit code 0)
   ```

---

## 5. Próximos Passos (Fase 5)

Com a conclusão da **Fase 4**, o sistema passa a dispor do núcleo gráfico e analítico completo. A próxima etapa do roadmap é a **Fase 5: Módulos Operacionais de Ingestão e Gestão Industrial**:
* Tela de Ingestão Manual com teclado industrial e validação de limites de engenharia (`IngestaoPage.tsx` - [RF09]).
* Upload e parsing de arquivos CSV e JSON com pré-visualização de subgrupos e cálculo de médias pré-inserção (`ImportacaoLotePage.tsx` - [RF10]).
* Tela de Gerenciamento de Processos e Cartas (`ProcessosPage.tsx` - [RF01], [RF02], [RF05]).
* Tela de Histórico e Auditoria com filtros temporais e exportação de relatórios em CSV/PDF (`HistoricoPage.tsx` - [RF11], [RF12]).
