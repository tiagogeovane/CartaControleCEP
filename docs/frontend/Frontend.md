# Arquitetura e Tecnologias do Frontend
## Dashboard Industrial de Controle Estatístico de Processos (CEP) em Tempo Real

---

## 1. Visão Geral e Contexto do Produto

O **Frontend do Sistema de Controle Estatístico de Processos (CEP)** é a camada de interface homem-máquina (IHM) e telemetria analítica voltada para operadores de chão de fábrica, engenheiros de controle de qualidade e gestores industriais.

Seu propósito central é fornecer **visibilidade instantânea, intuitiva e de alta precisão** do comportamento estatístico das linhas de produção, processando fluxos contínuos de medições transmitidos pelo backend FastAPI através de WebSockets em tempo real.

### Objetivos Críticos de Experiência e Desempenho
1. **Streaming em Tempo Real Sem Travamentos:** Renderização contínua de novos subgrupos via WebSocket com taxa estável de 60 FPS (**[RNF02]**), sem recarregar a tela ou reconstruir o gráfico inteiro do zero.
2. **Visualização Científica Especializada:** Apresentação clara de cartas $\bar{X}-R$, $\bar{X}-s$ e $I-MR$, faixas de dispersão sigma ($\pm 1\sigma, \pm 2\sigma, \pm 3\sigma$), limites de especificação ($LSE/LIE$) e identificação imediata das **8 Regras de Nelson**.
3. **Análise de Capacidade Integrada:** Gráficos de histograma com ajuste de curva de distribuição normal e medidores (gauges) dos índices $C_p$ e $C_{pk}$ (**[RN04]**).
4. **Ingestão Ágil e Operacional:** Interfaces para entrada rápida manual de amostras por operadores (**[RF06]**) e upload em lote de matrizes históricas CSV/JSON (**[RF08]**).
5. **Ergonomia e Design Industrial:** Interface limpa, com Dark Mode nativo para reduzir fadiga visual em monitores de chão de fábrica e salas de controle (CCT), além de responsividade para tablets industriais.

---

## 2. Sugestões e Avaliação de Tecnologias para o Frontend

Abaixo é apresentada a análise comparativa de mercado para cada camada do frontend, fundamentando a seleção da stack recomendada:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND STACK RECOMENDADA                      │
├────────────────────────────────┬───────────────────────────────────────┤
│ Core & Runtime                 │ React 18 / 19 + TypeScript + Vite     │
├────────────────────────────────┼───────────────────────────────────────┤
│ Motor Gráfico CEP              │ Apache ECharts (echarts-for-react)    │
├────────────────────────────────┼───────────────────────────────────────┤
│ Estilização & UI Kit           │ Tailwind CSS + Shadcn UI + Lucide     │
├────────────────────────────────┼───────────────────────────────────────┤
│ Gerenciamento de Estado Global │ Zustand (Leve, direto e in-memory)    │
├────────────────────────────────┼───────────────────────────────────────┤
│ Gerenciamento de API REST      │ TanStack Query (React Query v5)       │
├────────────────────────────────┼───────────────────────────────────────┤
│ Tempo Real (WebSockets)        │ Hook Nativo useWebSocket com Backoff  │
├────────────────────────────────┼───────────────────────────────────────┤
│ Formulários & Validação        │ React Hook Form + Zod                 │
├────────────────────────────────┼───────────────────────────────────────┤
│ Roteamento                     │ React Router v6 / v7                  │
└────────────────────────────────┴───────────────────────────────────────┘
```

---

### 2.1. Framework e Plataforma Base

| Tecnologia | Vantagens para o Projeto CEP | Desvantagens / Restrições | Veredito |
| :--- | :--- | :--- | :---: |
| **React + Vite + TypeScript** | Ecossistema gigantesco de componentes, integração exemplar com Apache ECharts, compilação ultra-rápida via Rollup/esbuild, tipagem estrita sincronizada com o backend Python. | Requer planejamento cuidadoso de re-renders em fluxos de alta frequência. | **Recomendada (Oficial)** |
| **Vue 3 + Vite** | Excelente reatividade fina e sintaxe intuitiva de Single File Components. | Ecossistema de bibliotecas especializadas em gráficos estatísticos menor que o React. | *Alternativa Válida* |
| **Next.js (App Router)** | SSR e SSG robustos para portais públicos e SEO. | Overhead desnecessário de servidor Node.js para um dashboard industrial autenticado e local; complexidade extra para WebSockets. | *Não Recomendada* |
| **Svelte 5** | Reatividade compilada sem Virtual DOM, bundle ultra enxuto. | Menor disponibilidade de wrappers maduros e documentação para ECharts e design systems industriais. | *Desaconselhada* |

> **Decisão:** Adotar **React + Vite + TypeScript**. O ecossistema garante longevidade, máxima aderência à documentação de requisitos ([Requisitos.md](file:///home/tiago/Documents/Controle%20Estatistico%20de%20Processos/docs/Requisitos.md)) e suporte fluido a WebSockets e bibliotecas gráficas pesadas.

---

### 2.2. Motor Gráfico para Cartas de Controle CEP (Pilar Crítico)

O gráfico de CEP exige recursos muito específicos: múltiplas linhas de referência horizontais ($LC, LSC, LIC, LSE, LIE$), sombreamento de 3 zonas de desvio padrão em cada lado, marcação de pontos violadores com cores contrastantes, tooltips ricos e streaming incremental.

| Biblioteca | Renderização e Desempenho | Recursos de CEP e Limites | Streaming Incremental | Veredito |
| :--- | :--- | :--- | :--- | :---: |
| **Apache ECharts** | **Canvas / SVG** acelerado por hardware; renderiza milhares de pontos com suavidade. | **Perfeito:** `markLine` para limites, `markArea` para zonas sigma, `visualMap` para colorir anomalias. | **Nativo:** suporta `notMerge: false` e append contínuo a 60 FPS. | **Recomendada (Oficial)** |
| **Plotly.js** | Baseado em D3/WebGL; muito comum em ciência de dados e Python. | Bom suporte a estatística, porém customizações finas de zonas sigma são verbosas. | Moderado; bundle pesado (> 3 MB) e taxa de atualização mais lenta. | *Desaconselhada* |
| **Chart.js** | Canvas simples, leve para gráficos comuns (barras/linhas simples). | Limitado; adicionar faixas sigma e múltiplas referências exige plugins adicionais frágeis. | Suporta streaming, mas degrada performance acima de 500 pontos. | *Inadequada* |
| **Recharts** | Declarativo em React, baseado em SVG puro. | Bom para dashboards comerciais simples. SVG sobrecarrega a árvore DOM com muitos pontos. | Queda visível de framerate com atualizações frequentes de telemetria. | *Inadequada* |
| **D3.js Puro** | Flexibilidade absoluta; controle total de cada pixel. | Exige construir do zero eixos, responsividade, zoom/pan, crosshairs e tooltips. | Excelente, mas custo de desenvolvimento e manutenção exorbitante. | *Inviável* |

> **Decisão:** **Apache ECharts (`echarts` e `echarts-for-react`)**. É o padrão da indústria para aplicações de telemetria e CEP, oferecendo ferramentas nativas de zoom (`dataZoom`), download de imagem do gráfico, troca de visualização e performance impecável em streaming.

---

### 2.3. Estilização, Design System e Ícones

* **Tailwind CSS (v3 / v4):**
  * Estilização utilitária atômica, zero runtime overhead no navegador.
  * Facilidade para configurar paleta de cores corporativa/industrial (alertas, zonas sigma e estados de controle).
  * Suporte trivial e robusto para **Dark Mode** via classe `dark`.
* **Shadcn UI (baseado em Radix UI):**
  * Componentes headless acessíveis (WAI-ARIA), copiáveis diretamente para o código fonte do projeto (sem dependência engessada de pacotes externos).
  * Diálogos/Modais (para apontamento de causas especiais), Dropdowns, Tooltips, Tabs, Badges de status e Toasts de notificação de alarme.
* **Lucide React:**
  * Pacote moderno, leve e consistente de ícones vetoriais (sensores, alertas, engrenagens, gráficos, tendências, relatórios).

---

### 2.4. Gerenciamento de Estado e Camada de Dados

1. **Estado Global da Aplicação com Zustand:**
   * Biblioteca minimalista (< 2 KB) baseada em hooks, sem a cerimônia e boilerplate do Redux.
   * Ideal para armazenar:
     * Sessão do usuário logado e token JWT.
     * Lista de cartas ativas e carta atualmente selecionada no painel.
     * Histórico em memória de subgrupos da carta atual (buffer deslizante).
     * Preferências de interface (Dark/Light mode, pausa no streaming, limites do zoom).
2. **Requisições REST com TanStack Query (React Query v5):**
   * Cache automático e invalidação inteligente para dados transacionais (listar processos, listar cartas, consultar índices de capacidade $C_p/C_{pk}$).
   * Mutações assíncronas com tratamento de carregamento, erro e feedback visual imediato para o usuário.
3. **Comunicação em Tempo Real com Hook Customizado (`useWebSocketCEP`):**
   * Encapsula a API nativa `WebSocket` do navegador.
   * Tratamento de ciclo de vida: handshake inicial, escuta do evento `NOVO_SUBGRUPO_PROCESSADO`, envio periódico de `ping` (keep-alive) e reconexão automática resiliente com algoritmo de **Exponential Backoff**.

---

### 2.5. Formulários, Validação e Roteamento

* **React Hook Form + Zod:**
  * Validação no cliente espelhando exatamente os esquemas do Pydantic v2 do backend (ex: conferir se o número de amostras inseridas coincide estritamente com o $n$ configurado na carta antes de enviar a requisição HTTP).
  * Desempenho sem re-renderizações a cada caractere digitado.
* **React Router (v6 / v7):**
  * Rotas protegidas (Auth Guard redirecionando para `/login` se o token não existir ou estiver expirado).
  * Layout base compartilhado com Sidebar retrátil e Topbar de telemetria.

---

## 3. Arquitetura de Telas do Dashboard

O frontend deve ser organizado em **5 módulos visuais principais**:

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│ [Topbar] Status da Conexão: ● ONLINE | Carta: USINAGEM-01 | Usuário: Operador   │
├──────────────┬──────────────────────────────────────────────────────────────────┤
│ [Sidebar]    │ [ÁREA PRINCIPAL DE CONTEÚDO]                                     │
│              │                                                                  │
│ 📊 Live CEP  │ 1. VISÃO LIVE CEP:                                               │
│ 📈 Capacidade│   • Gráfico Principal: Média X-barra (LSC, LC, LIC + Zonas A/B/C)│
│ 📥 Ingestão  │   • Gráfico Secundário: Amplitude R ou Desvio s                  │
│ 📋 Histórico │   • Painel Lateral: Alertas das Regras de Nelson + KPIs Rápidos │
│ ⚙️ Processos │                                                                  │
│ 🚪 Sair      │ 2. PAINEL DE CONTROLE RÁPIDO: Pausar, Zoom, Exportar, Alternar   │
└──────────────┴──────────────────────────────────────────────────────────────────┘
```

### 3.1. Tela 1: Estúdio de CEP em Tempo Real (Live Studio - Tela Principal)
* **Cabeçalho da Carta:** Identificador da carta, processo associado, tipo ($\bar{X}-R, \bar{X}-s, I-MR$), tamanho do subgrupo ($n$) e badge de status dinâmico (**VERDE: Sob Controle** / **VERMELHO: Fora de Controle**).
* **Gráfico $\bar{X}$ (Média do Subgrupo):**
  * Linha central ($LC$) em azul escuro.
  * Limites de controle calculados ($LSC$ e $LIC$) em linhas tracejadas vermelhas.
  * Limites de especificação de engenharia ($LSE$ e $LIE$) em linhas tracejadas roxas.
  * Zonas sigma sombreadas: Zona C ($\pm 1\sigma$), Zona B ($\pm 2\sigma$) e Zona A ($\pm 3\sigma$).
  * Pontos normais plotados em azul; pontos que violam qualquer regra de Nelson destacados em **vermelho vivo com pulsar luminoso** e tooltip detalhado.
* **Gráfico de Dispersão ($R$ ou $s$):**
  * Gráfico sincronizado verticalmente exibindo a variação dentro do subgrupo.
* **Barra de Ações do Gráfico:**
  * Botão de "Pausar/Retomar Streaming" (para inspecionar pontos anteriores sem deslocamento da tela).
  * Seletor de janela de visualização (Últimos 30, 50, 100 subgrupos ou Todos).
  * Botão de exportação da carta em imagem PNG de alta resolução.
* **Feed Lateral de Ocorrências (Nelson Alarms):**
  * Lista cronológica de anomalias disparadas.
  * Ao clicar em um alarme, a tela dá zoom no ponto correspondente e permite abrir o modal para **Apontamento de Causa Especial e Ação Corretiva** (**[RF10]**).

---

### 3.2. Tela 2: Análise de Capacidade do Processo ($C_p / C_{pk}$)
* **Gauges / Velocímetros de Capacidade:**
  * Indicadores de $C_p$ e $C_{pk}$ com faixas de cor (< 1.0 Crítico / Vermelho, 1.0 a 1.33 Atenção / Amarelo, $\ge 1.33$ Capaz / Verde).
* **Histograma de Frequências vs. Curva Normal:**
  * Barras do histograma das medições empíricas.
  * Curva em sino (Gaussiana teórica) sobreposta para checagem visual de assimetria ou curtose.
  * Linhas verticais destacando $LIE$, $LSE$ e Valor Nominal do cliente.
* **Quadro de Métricas Estatísticas:**
  * Média global ($\mu$), desvio padrão estimado ($\hat{\sigma}$), $C_{pu}$, $C_{pl}$, e taxa estimada de não-conformidade (PPM / Peças por Milhão).
  * Mensagem de alerta automático caso o processo não esteja sob controle estatístico (**[RN04]**).

---

### 3.3. Tela 3: Ingestão de Dados e Carga Histórica
* **Aba 1 - Coleta Manual em Chão de Fábrica ([RF06]):**
  * Formulário dinâmico que gera exatamente $n$ campos de medição de acordo com o subgrupo configurado na carta.
  * Navegação facilitada por teclado (`Enter` avança para a próxima medição).
  * Botão de envio rápido com atalho de teclado (`Ctrl + Enter`).
* **Aba 2 - Importação em Lote via Arquivo ([RF08]):**
  * Zona de arrastar e soltar (Drag & Drop) para arquivos `.csv` e `.json`.
  * Pré-visualização dos dados em tabela antes da confirmação do envio.
  * Barra de progresso de upload e relatório de processamento.

---

### 3.4. Tela 4: Histórico de Subgrupos e Registro de Causas
* Tabela de dados de alta densidade com paginação e busca por subgrupo ou data.
* Colunas: Nº Subgrupo, Data/Hora, Valores Medidos, $\bar{X}$, $R$, Desvio $s$, Status e Regras Violadas.
* Filtro rápido por subgrupos anômalos.
* Indicador visual de causas especiais já justificadas vs. pendentes de ação corretiva.

---

### 3.5. Tela 5: Gestão de Processos e Configuração de Cartas
* Listagem de linhas industriais cadastradas.
* Assistente de criação de novas cartas de controle com:
  * Seleção automática ou manual do tipo de carta baseado no tamanho do subgrupo (**[RN01]**).
  * Definição de limites de especificação ($LSE, LIE$ e Valor Nominal).
  * Alternância entre modo de limites **DINÂMICO** (recalculado a cada novo subgrupo) e **FIXO** (travado para operação contínua).

---

## 4. Identidade Visual e Ergonomia Industrial

Para garantir legibilidade rápida em ambientes industriais, adotaremos uma paleta com convenção semântica padronizada de controle de qualidade:

| Elemento Visual | Cor Hexadecimal | Significado / Uso |
| :--- | :---: | :--- |
| **Status Sob Controle** | `#10B981` (Emerald) | Processo operando dentro dos parâmetros de estabilidade estatística. |
| **Status Fora de Controle** | `#EF4444` (Rose/Red) | Violação de limites de 3 sigma ou violação de regras de Nelson. |
| **Zonas de Alerta (2σ / 1σ)** | `#F59E0B` (Amber) | Faixas intermediárias para identificação de tendências e agrupamentos. |
| **Linha Média (LC)** | `#3B82F6` (Blue) | Média central histórica do processo industrial ($\bar{\bar{X}}$ ou $\bar{X}$). |
| **Limites de Especificação** | `#8B5CF6` (Purple) | Tolerâncias de projeto de engenharia ($LSE / LIE$). |
| **Fundo Dark (Padrão IHM)** | `#0F172A` (Slate 900) | Fundo escuro para monitoramento contínuo em turnos noturnos/chão de fábrica. |
| **Superfícies de Cards** | `#1E293B` (Slate 800) | Contraste refinado para leitura rápida sem ofuscamento. |

* **Tipografia:** Uso de fontes sem serifa modernas para navegação (`Inter`) e **fontes monoespaçadas** (`JetBrains Mono` / `Roboto Mono`) para todas as tabelas numéricas e cards de métricas estatísticas, evitando trepidação de layout durante atualizações de streaming.

---

## 5. Estrutura Proposta de Diretórios do Frontend

```text
frontend/
├── public/
│   └── favicon.ico
├── src/
│   ├── assets/
│   ├── components/
│   │   ├── charts/                     # Componentes ECharts reutilizáveis
│   │   │   ├── CartaXRChart.tsx        # Carta X-barra e R
│   │   │   ├── CartaXSChart.tsx        # Carta X-barra e s
│   │   │   ├── CartaIMRChart.tsx       # Carta de Valores Individuais I-MR
│   │   │   └── HistogramaCapacidade.tsx# Histograma com curva gaussiana
│   │   ├── common/                     # Botões, Badges, Modais, Cards
│   │   ├── layout/                     # Sidebar, Topbar, Layout Base
│   │   └── modules/                    # Componentes específicos de negócio
│   │       ├── FormIngestaoManual.tsx  # Coleta de dados manual
│   │       ├── UploadLoteModal.tsx     # Importação de arquivos CSV/JSON
│   │       ├── TabelaSubgrupos.tsx     # Histórico de subgrupos
│   │       └── ModalApontamentoCausa.tsx # Registro de causas especiais
│   ├── hooks/
│   │   ├── useWebSocketCEP.ts          # Hook do WebSocket com reconexão automática
│   │   ├── useCartas.ts                # Consultas REST via TanStack Query
│   │   └── useCapacidade.ts            # Métricas Cp e Cpk
│   ├── pages/
│   │   ├── LoginPage.tsx               # Autenticação de operadores/engenheiros
│   │   ├── LiveStudioPage.tsx          # Tela principal de telemetria em tempo real
│   │   ├── CapacidadePage.tsx          # Análise de capacidade do processo
│   │   ├── IngestaoPage.tsx            # Telas de inserção de dados
│   │   └── ProcessosPage.tsx           # Configuração de linhas e cartas
│   ├── services/
│   │   ├── api.ts                      # Instância Axios / Fetch com interceptor de JWT
│   │   └── websocket.ts                # Gerenciador do ciclo de vida WebSocket
│   ├── stores/
│   │   ├── authStore.ts                # Estado de autenticação Zustand
│   │   └── cepStore.ts                 # Buffer em memória e carta ativa
│   ├── types/
│   │   ├── api.ts                      # Tipos de resposta REST (espelho dos schemas Pydantic)
│   │   ├── cep.ts                      # Estatísticas, limites e violações de regras
│   │   └── websocket.ts                # Contratos dos eventos em tempo real
│   ├── App.tsx                         # Definição de rotas e providers
│   └── main.tsx                        # Ponto de entrada da aplicação React
├── Dockerfile                          # Build multi-stage Nginx para produção
├── index.html
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

---

## 6. Próximos Passos Sugeridos

1. **Criação do Roadmap do Frontend (`docs/frontend/Roadmap.md`):** Detalhar as etapas sequenciais de desenvolvimento (Setup base $\to$ Integração de API/WebSocket $\to$ Construção dos Gráficos ECharts $\to$ Telas Operacionais $\to$ Containerização).
2. **Setup do Projeto Frontend (`frontend/`):** Inicialização da estrutura Vite + React + TypeScript com Tailwind CSS e bibliotecas essenciais.
3. **Validação do Fluxo Integrado:** Conectar o frontend inicial à API REST e ao WebSocket do backend já em funcionamento.
