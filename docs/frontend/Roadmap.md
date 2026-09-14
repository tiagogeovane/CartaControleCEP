# Roadmap de Desenvolvimento do Frontend
## Dashboard Industrial de Controle Estatístico de Processos (CEP) em Tempo Real

---

## 1. Visão Geral e Estratégia de Desenvolvimento

Este documento estabelece o planejamento detalhado, sequencial e mensurável para a implementação completa da interface do usuário (IHM) e dashboard analítico do **Sistema de Controle Estatístico de Processos (CEP)**. O plano é orientado pela especificação arquitetural definida em [Frontend.md](file:///home/tiago/Documents/Controle%20Estatistico%20de%20Processos/docs/frontend/Frontend.md), em total consonância com as capacidades do backend documentadas em [Backend.md](file:///home/tiago/Documents/Controle%20Estatistico%20de%20Processos/docs/Backend/Backend.md) e os requisitos formais de [Requisitos.md](file:///home/tiago/Documents/Controle%20Estatistico%20de%20Processos/docs/Requisitos.md).

### Filosofia de Desenvolvimento: *Data-Driven UI & Industrial Precision*
A construção do frontend segue uma abordagem bottom-up para a camada de dados e componentização, garantindo que contratos de API, streaming WebSocket resiliente e renderização de alta frequência estejam matematicamente validados antes do acabamento estético:

```text
┌────────────────────────────────────────────────────────────────────────┐
│ FASE 0: SETUP DE AMBIENTE, TOOLING & DESIGN SYSTEM BASE                │
│  └─ Vite, TypeScript estrito, Tailwind CSS, Shadcn UI e Vitest.        │
├────────────────────────────────────────────────────────────────────────┤
│ FASE 1: TIPAGEM ESTRITA, ESTADO GLOBAL & COMUNICAÇÃO (REST/WS)         │
│  └─ DTOs espelho do Pydantic v2, Zustand, TanStack Query, useWebSocket. │
├────────────────────────────────────────────────────────────────────────┤
│ FASE 2: DESIGN SYSTEM INDUSTRIAL, ERGONOMIA IHM & LAYOUT BASE          │
│  └─ Paleta semântica IHM, Dark Mode, Sidebar, Topbar e Badges de CEP.  │
├────────────────────────────────────────────────────────────────────────┤
│ FASE 3: MOTOR GRÁFICO ESPECIALIZADO DE CEP (APACHE ECHARTS)            │
│  └─ Cartas X̄-R/X̄-s/I-MR, faixas sigma, limites e regras de Nelson.     │
├────────────────────────────────────────────────────────────────────────┤
│ FASE 4: TELAS ANALÍTICAS PRINCIPAIS (LIVE STUDIO & CAPACIDADE)         │
│  └─ Streaming 60 FPS, feed de alarmes, gauges Cp/Cpk e histograma.     │
├────────────────────────────────────────────────────────────────────────┤
│ FASE 5: MÓDULOS OPERACIONAIS DE ENTRADA & GESTÃO INDUSTRIAL            │
│  └─ Ingestão manual por teclado, carga de CSV/JSON, histórico e causas. │
├────────────────────────────────────────────────────────────────────────┤
│ FASE 6: AUTENTICAÇÃO, CONTROLE DE ACESSO & EXPERIÊNCIA DO USUÁRIO      │
│  └─ Login/JWT, RBAC (Operador vs Engenheiro), alertas visuais/sonoros. │
├────────────────────────────────────────────────────────────────────────┤
│ FASE 7: PERFORMANCE, TESTES AUTOMATIZADOS & CONTAINERIZAÇÃO            │
│  └─ Profiling 60 FPS, Vitest + RTL, Dockerfile multi-stage Nginx.      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Fase 0: Setup do Ambiente, Tooling e Infraestrutura Base

O objetivo desta fase é estabelecer uma fundação de código limpa, com compilação ultra-rápida, tipagem rigorosa e ferramentas de qualidade automatizadas.

### 2.1. Inicialização do Projeto
* Criar a aplicação dentro da pasta `frontend/` utilizando Vite com template React + TypeScript:
  ```bash
  npm create vite@latest frontend -- --template react-ts
  ```
* Configurar o gerenciador de pacotes e scripts padronizados no `package.json` (`dev`, `build`, `lint`, `test`, `preview`).

### 2.2. Dependências Centrais da Aplicação
Instalar as dependências aprovadas na arquitetura:
```text
# Núcleo e UI
react@^18.3.0 react-dom@^18.3.0
lucide-react@^0.400.0 clsx@^2.1.0 tailwind-merge@^2.3.0
class-variance-authority@^0.7.0

# Motor Gráfico
echarts@^5.5.0 echarts-for-react@^3.0.2

# Estado, Requisições e Roteamento
zustand@^4.5.0 @tanstack/react-query@^5.40.0
react-router-dom@^6.24.0 axios@^1.7.0

# Formulários e Validação
react-hook-form@^7.52.0 zod@^3.23.0 @hookform/resolvers@^3.6.0

# Ferramentas de Desenvolvimento e Testes
typescript@^5.4.0 vite@^5.3.0 tailwindcss@^3.4.0 postcss@^8.4.0 autoprefixer@^10.4.0
vitest@^1.6.0 @testing-library/react@^16.0.0 @testing-library/jest-dom@^6.4.0 jsdom@^24.1.0
eslint@^8.57.0 prettier@^3.3.0
```

### 2.3. Configuração de Compilação Estrita e Linter
* **`tsconfig.json`:** Configurar modo estrito (`strict: true`), proibição de `any` implícito (`noImplicitAny: true`), verificação estrita de nulos (`strictNullChecks: true`) e aliases de caminho (`@/*` mapeado para `./src/*`).
* **`vite.config.ts`:** Configurar resolução de alias `@` e proxy de desenvolvimento para encaminhar chamadas `/api` e `/ws` ao backend FastAPI local (`http://localhost:8000`).
* **ESLint & Prettier:** Configurar regras para prevenir re-renders desnecessários e dependências faltantes em hooks (`react-hooks/exhaustive-deps`).

### 2.4. Métricas Verificáveis de Completude da Fase 0
1. `npm run dev` inicializa o servidor de desenvolvimento em tempo inferior a **600 ms**.
2. `npm run build` executa a compilação com `tsc --noEmit` sem registrar nenhum aviso ou erro de tipagem (Exit code 0).
3. Execução de `npm run test` com Vitest configurado e teste de sanidade (`App.test.tsx`) executado com sucesso.
4. Linter e formatação executados sem inconsistências (`npm run lint` limpo).

---

## 3. Fase 1: Camada de Tipagem, Estado Global e Comunicação (REST & WebSocket)

Nesta etapa, constrói-se a camada de dados tipada que espelha os schemas Pydantic v2 do backend e gerencia o ciclo de vida da conexão de streaming em tempo real.

### 3.1. Definições de Tipos TypeScript (`src/types/`)
* **`src/types/api.ts`:** Modelos de DTOs correspondentes aos schemas do FastAPI:
  * `ProcessoResponse`, `ProcessoCreate`.
  * `CartaControleResponse`, `CartaControleCreate`, `LimitesControleSchema`, `LimitesEspecificacaoSchema`.
  * `SubgrupoResponse`, `EstatisticasResponse`, `ViolacaoRegraResponse`.
  * `CapacidadeResponse`, `IndicesCapacidadeSchema`.
  * `UsuarioResponse`, `LoginRequest`, `TokenResponse`.
* **`src/types/websocket.ts`:**
  * Tipos de eventos do WebSocket (`CONEXAO_ESTABELECIDA`, `NOVO_SUBGRUPO_PROCESSADO`).
  * Contrato do payload de novo subgrupo transmitido em tempo real.
  * Estados da conexão: `'CONNECTING' | 'ONLINE' | 'OFFLINE' | 'RECONNECTING'`.

### 3.2. Cliente HTTP Axios com Interceptor JWT (`src/services/api.ts`)
* Configurar instância Axios apontando para a baseURL `/api/v1`.
* Interceptor de requisição: injeta cabeçalho `Authorization: Bearer <token>` caso o token exista no storage.
* Interceptor de resposta: captura respostas HTTP 401 (Não Autorizado) e despacha logout automático no estado global.

### 3.3. Stores Zustand (`src/stores/`)
* **`authStore.ts`:**
  * Estado: `token`, `usuario`, `isAuthenticated`, `perfil`.
  * Ações: `login(token, usuario)`, `logout()`.
  * Persistência sincronizada com `localStorage`.
* **`cepStore.ts`:**
  * Estado: `cartaAtivaId`, `cartaDetalhes`, `subgruposHistorico` (buffer deslizante em memória com limite parametrizável, ex: 50 a 200 itens), `streamingPausado: boolean`.
  * Ações: `adicionarSubgrupo(subgrupo)`, `setBufferHistorico(subgrupos)`, `togglePausaStreaming()`, `limparBuffer()`.

### 3.4. Hook WebSocket Resiliente com Backoff Exponencial (`src/hooks/useWebSocketCEP.ts`)
* Encapsular conexão com `/ws/cartas/{carta_id}`.
* Tratar ciclo de vida completo:
  * Handshake e recepção de `CONEXAO_ESTABELECIDA`.
  * Escuta reativa do evento `NOVO_SUBGRUPO_PROCESSADO` e injeção direta no `cepStore` sem re-renderizar a árvore inteira.
  * Heartbeat periódico: envio de `ping` a cada 20 segundos para manter a conexão ativa contra timeouts de rede/proxy.
  * **Algoritmo de Reconexão:** Em caso de desconexão inesperada, disparar reconexão com intervalos progressivos (1s, 2s, 4s, 8s, até teto de 30s) e indicação visual na tela.

### 3.5. Métricas Verificáveis de Completude da Fase 1
1. **100% de paridade tipológica:** Teste unitário de compilação validando que payloads reais retornados pelos endpoints `/api/v1/cartas/{id}` e `/api/v1/cartas/{id}/capacidade` são aceitos sem cast de tipos (`as any`).
2. **Reconexão comprovada:** Teste unitário do hook `useWebSocketCEP` (via mock de WebSocket) verificando que 3 quedas intencionais de conexão disparam reconexões com tempos crescentes e alteram o estado de status para `RECONNECTING` e depois `ONLINE`.
3. **Buffer deslizante:** Teste unitário do `cepStore` comprovando que a inserção de 150 subgrupos mantém em memória exatamente a quantidade limite configurada (evitando vazamento de memória).
4. **Segurança de cabeçalho:** Teste automatizado validando a presença do token JWT no header `Authorization` em requisições disparadas pelo client `api.ts`.

---

## 4. Fase 2: Design System Industrial, Ergonomia IHM e Layout Base

Construção dos blocos visuais, sistema de cores semântico para chão de fábrica e layout estrutural da aplicação.

### 4.1. Configuração de Tema Industrial e Tailwind (`src/index.css` & `tailwind.config.js`)
* Configurar classe `dark` como padrão para atender a ambientes de chão de fábrica e salas de controle (CCT).
* Mapeamento de cores industriais:
  * Sucesso / Sob Controle: `#10B981` (Emerald 500).
  * Alarme / Fora de Controle: `#EF4444` (Red 500).
  * Alerta de Tendência / Zonas $1\sigma$ e $2\sigma$: `#F59E0B` (Amber 500).
  * Linha Média ($LC$): `#3B82F6` (Blue 500).
  * Especificações ($LSE / LIE$): `#8B5CF6` (Purple 500).
  * Superfícies Dark: Fundo `#0F172A` (Slate 900) e Cards `#1E293B` (Slate 800).
* Configuração tipográfica: `Inter` para navegação e `JetBrains Mono` / `Roboto Mono` para exibição de métricas numéricas e medições.

### 4.2. Biblioteca de Componentes Base (`src/components/common/`)
* `Badge`: Indicadores de status da carta (Sob Controle / Fora de Controle) e modo de limites (Dinâmico / Fixo).
* `CardKpi`: Cards modulares para métricas-chave ($\mu$, $\sigma$, $R$, $s$, subgrupos analisados) com fontes monoespaçadas.
* `Modal`: Componente de diálogo modal acessível (Radix UI Dialog) para inserção de dados e registro de ações.
* `ToastNotification`: Sistema de notificações rápidas para feedback de operações e disparo de alarmes.

### 4.3. Layout Estrutural da Aplicação (`src/components/layout/`)
* **Topbar:**
  * Indicador de pulso de conexão: ● Verde (ONLINE), 🟡 Amarelo (RECONECTANDO), 🔴 Vermelho (OFFLINE).
  * Seletor rápido da carta ativa e processo associado.
  * Identificação do usuário logado e botão de logout.
* **Sidebar Retrátil:**
  * Navegação rápida entre os módulos:
    1. 📊 Live CEP (`/live`)
    2. 📈 Capacidade do Processo (`/capacidade`)
    3. 📥 Ingestão de Dados (`/ingestao`)
    4. 📋 Histórico & Causas (`/historico`)
    5. ⚙️ Processos & Cartas (`/processos`)
  * Capacidade de recolhimento para maximizar a área de visualização gráfica em telas menores ou tablets industriais.

### 4.4. Métricas Verificáveis de Completude da Fase 2
1. **Acessibilidade de Contraste:** Relação de contraste das cores de texto e status contra os fundos `#0F172A` e `#1E293B` superior a **4.5:1** (conforme diretrizes WCAG AA).
2. **Estabilidade de Layout (CLS):** Teste de renderização do layout com Sidebar colapsada e expandida garantindo ausência de quebras visuais e Cumulative Layout Shift (CLS) $< 0.05$.
3. **Suíte de Testes de Componentes:** Testes unitários com React Testing Library cobrindo renderização correta de `Badge`, `CardKpi` e `Topbar` sob os diferentes estados de conexão e controle.

---

## 5. Fase 3: Motor Gráfico Especializado de Cartas CEP (Apache ECharts)

Implementação dos componentes de renderização estatística de alta precisão para as cartas de controle contínuas e individuais.

### 5.1. Componente Base de Integração ECharts (`src/components/charts/BaseChart.tsx`)
* Encapsular a inicialização e destruição do Apache ECharts com manipulação de `useRef`.
* Integração com `ResizeObserver` nativo do navegador para redimensionamento instantâneo do gráfico quando a janela ou a Sidebar mudarem de dimensão.
* Otimização para streaming: configuração de atualização com `notMerge: false` para renderização incremental (**[RNF02]**).

### 5.2. Componente de Carta $\bar{X}-R$ e $\bar{X}-s$ (`src/components/charts/CartaXRChart.tsx`, `CartaXSChart.tsx`)
* **Gráfico Superior ($\bar{X}$ - Médias dos Subgrupos):**
  * `markLine` horizontal central azul: Linha Central ($LC$).
  * `markLine` horizontal vermelha tracejada: Limites de Controle ($LSC$ e $LIC$).
  * `markLine` horizontal roxa pontilhada: Limites de Engenharia ($LSE$ e $LIE$), caso existam na carta.
  * `markArea` sombreada para zonas de dispersão normal:
    * Zona C: Faixa de $\pm 1\sigma$.
    * Zona B: Faixa de $\pm 2\sigma$.
    * Zona A: Faixa de $\pm 3\sigma$.
  * Plotagem de pontos:
    * Pontos normais em azul ciano.
    * Pontos violadores de qualquer uma das 8 Regras de Nelson destacados em **vermelho vivo com efeito pulsante** (`effectScatter`).
  * Tooltip dinâmico exibindo número do subgrupo, data/hora, valor da média ($\bar{X}$), lista de amostras brutas e regras violadas com suas descrições completas.
* **Gráfico Inferior (Dispersão - Amplitude $R$ ou Desvio $s$):**
  * Gráfico sincronizado temporalmente exibindo a variação dentro do subgrupo.
  * Linhas de limites específicos para $R$ ($LSC_R, LC_R, LIC_R$) ou $s$ ($LSC_s, LC_s, LIC_s$).

### 5.3. Componente de Carta Individual $I-MR$ (`src/components/charts/CartaIMRChart.tsx`)
* Suporte a subgrupos unitários ($n = 1$).
* Gráfico superior com leituras individuais ($X$) e gráfico inferior com a amplitude móvel ($MR = |X_i - X_{i-1}|$).

### 5.4. Controles Interativos da Carta
* Barra de zoom temporal (`dataZoom`) do tipo *inside* e *slider*.
* Seletor de janela de histórico (Últimos 30, 50, 100 subgrupos ou Todos).
* Botão de congelamento da visualização (pausa a rolagem automática para permitir investigação de amostras passadas sem perder novos dados recebidos em segundo plano).
* Botão para exportação direta do gráfico em imagem PNG de alta resolução.

### 5.5. Métricas Verificáveis de Completude da Fase 3
1. **Fidelidade Numérica:** Teste de renderização com dataset de referência do livro de Montgomery (mesmo utilizado nos testes do backend) validando que as coordenadas de $LC, LSC, LIC$ plotadas pelo ECharts coincidem com erro $< 0.001$.
2. **Identificação Visual das 8 Regras de Nelson:** Simulação de dados contendo violações da Regra 1 (além de $3\sigma$), Regra 2 (9 pontos no mesmo lado) e Regra 3 (tendência de 6 pontos) comprovando que os pontos anômalos recebem classe/estilo de alarme vermelho e tooltip detalhado.
3. **Fluidez de Redimensionamento:** Operação de redimensionamento da viewport executa o recalculo do layout do Canvas do ECharts em tempo inferior a **100 ms** sem quebra de escala.

---

## 6. Fase 4: Telas Analíticas Centrais (Live Studio e Análise de Capacidade)
* **Status:** ✅ Concluído (Documentação técnica: [FEAT-04](./feats/04-telas-analiticas-centrais.md))
* **Cobertura de Testes:** 82 testes automatizados aprovados (Vitest + React Testing Library)

Nesta fase, as cartas de controle e métricas estatísticas são orquestradas nas duas telas principais de análise do sistema.

### 6.1. Tela 1: Estúdio de CEP em Tempo Real (`src/pages/LiveStudioPage.tsx`)
* **Orquestração de Componentes:**
  * Topbar de status da carta ativa (nome da peça, linha, $n$, tipo de carta, modo dinâmico/fixo).
  * Painel com os gráficos sincronizados ($\bar{X}$ no topo, $R$ ou $s$ embaixo).
  * **Feed Lateral de Alarmes (Nelson Rule Alarms):**
    * Lista cronológica de anomalias detectadas.
    * Ao clicar em um alarme da lista, o gráfico aplica zoom automático e centraliza o ponto violador.
    * Botão direto no alarme para abrir o modal de **Apontamento de Causa Especial e Ação Corretiva** (**[RF16]**).
* **Integração com WebSocket:**
  * O componente subscreve ao hook `useWebSocketCEP(cartaAtivaId)` ao montar e cancela a subscrição ao desmontar.
  * Ingestão contínua de novos subgrupos atualizando a ponta direita do gráfico sem recarregar a tela (**[RF14]**).

### 6.2. Tela 2: Análise de Capacidade do Processo (`src/pages/CapacidadePage.tsx`)
* Consumo do endpoint `GET /api/v1/cartas/{id}/capacidade` via TanStack Query.
* **Gauges / Velocímetros de Capacidade ($C_p$ e $C_{pk}$):**
  * Mostrador visual com ponteiro e arcos coloridos:
    * Vermelho ($< 1.00$): Processo Incapaz / Crítico.
    * Amarelo ($1.00 \le C_{pk} < 1.33$): Processo Aceitável com Restrições.
    * Verde ($C_{pk} \ge 1.33$): Processo Capaz e Seguro (**[RN04]**).
* **Histograma de Frequências vs. Curva Normal Gaussiana:**
  * Histograma com as medições agrupadas em classes de frequência calculadas.
  * Curva em sino (distribuição normal de Gauss calculada a partir de $\mu$ e $\sigma$) sobreposta em linha contínua.
  * Linhas verticais indicando $LIE$, $LSE$ e Valor Nominal do cliente.
* **Banner Informativo de Suficiência Estatística (**[RN04]**):**
  * Alerta em destaque caso a carta contenha menos de 20 subgrupos, advertindo o operador de que a amostra ainda é preliminar para homologação de capacidade.

### 6.3. Métricas Verificáveis de Completude da Fase 4
1. **Validação E2E com Simulador:** Conectar o frontend ao `backend/scripts/simulador_iot.py` e verificar streaming ininterrupto durante 5 minutos, com novos subgrupos aparecendo a cada 2 segundos e anomalias sendo destacadas instantaneamente no feed lateral.
2. **Validação dos Gauges de Capacidade:** Teste com carta contendo limites de especificação comprovando apresentação de valores de $C_p$ e $C_{pk}$ idênticos aos calculados pelo backend, com classificação semântica de cor correta.
3. **Histograma Consistente:** Teste de renderização do histograma com 100 amostras comprovando que a integral visual da curva gaussiana sobreposta acompanha a distribuição das colunas de dados.

---

## 7. Fase 5: Módulos Operacionais de Ingestão e Gestão Industrial
* **Status:** ✅ Concluído (Documentação técnica: [FEAT-05](./feats/05-modulos-operacionais-ingestao-gestao.md))
* **Cobertura de Testes:** 97 testes automatizados aprovados (Vitest + React Testing Library em 13 arquivos)

Implementação das interfaces destinadas a operadores de chão de fábrica e engenheiros de processo para coleta, importação e auditoria.

### 7.1. Tela 3: Ingestão de Dados e Carga Histórica (`src/pages/IngestaoPage.tsx`)
* **Aba 1: Coleta Manual de Chão de Fábrica (**[RF06]**):**
  * Formulário dinâmico utilizando React Hook Form + Zod.
  * Renderiza exatamente $n$ campos de medição de acordo com a carta selecionada (**[RN02]**).
  * **Ergonomia de Teclado:**
    * Foco automático no primeiro campo ao carregar.
    * Tecla `Enter` avança automaticamente para a próxima medição.
    * Atalho `Ctrl + Enter` (ou `Cmd + Enter`) executa a submissão imediata.
  * Envio para `POST /api/v1/cartas/{id}/amostras`.
  * Feedback imediato por Toast sonoro/visual informando se o subgrupo foi aceito sob controle ou se disparou alarme.
* **Aba 2: Importação em Lote via Arquivo (**[RF08]**):**
  * Zona de Drag & Drop para arquivos `.csv` e `.json`.
  * Validação no navegador: confere formatação de colunas e quantidade de elementos por linha antes do upload.
  * Tabela de pré-visualização das 5 primeiras amostras para confirmação do operador.
  * Envio para `POST /api/v1/cartas/{id}/importar` com barra de progresso visual.

### 7.2. Tela 4: Histórico de Subgrupos e Registro de Causas (`src/pages/HistoricoPage.tsx`)
* Tabela de dados de alta densidade paginada (`src/components/modules/TabelaSubgrupos.tsx`).
* Colunas: Subgrupo Nº, Data/Hora, Medições Brutas, $\bar{X}$, $R$ ou $s$, Status e Violações.
* Filtro rápido de busca por subgrupos anômalos (`Apenas Fora de Controle`).
* **Modal de Apontamento de Causa Especial (**[RF16]**):**
  * Abertura ao clicar em um subgrupo sinalizado.
  * Campos para preenchimento de:
    * Causa Raiz (ex: "Desgaste de inserto de corte", "Variação de lote de matéria-prima").
    * Ação Corretiva Tomada (ex: "Troca de ferramenta e ajuste de avanço").
    * Operador Responsável.
  * Badge visual indicando causas já justificadas vs. pendentes de ação.

### 7.3. Tela 5: Gestão de Processos e Configuração de Cartas (`src/pages/ProcessosPage.tsx`)
* Listagem de processos industriais cadastrados (`GET /api/v1/processos`).
* Cadastro de novas linhas (`POST /api/v1/processos`).
* **Assistente de Criação de Carta de Controle (**[RF05]**):**
  * Seleção do processo associado.
  * Definição do tamanho do subgrupo ($n$).
  * **Aplicação Automática de Regra [RN01]:** Sugere automaticamente o tipo de carta adequado ($I-MR$ para $n=1$, $\bar{X}-R$ para $n \le 10$, $\bar{X}-s$ para $n > 10$).
  * Configuração de tolerâncias de engenharia ($LSE$, $LIE$, Valor Nominal).
  * Seleção do modo de limites: `DINAMICO` ou `FIXO`.

### 7.4. Métricas Verificáveis de Completude da Fase 5
1. **Eficiência de Digitação Operacional:** Teste de usabilidade comprovando que o operador consegue preencher um subgrupo de $n=5$ amostras e submeter via teclado em menos de **8 segundos**, sem necessidade de uso do mouse.
2. **Validação de Carga em Lote:** Importação de arquivo CSV com 50 subgrupos validada e exibida na tabela de pré-visualização em menos de **1 segundo**.
3. **Consistência de Regras de Negócio no Assistente:** Formulário de criação de carta impede submissão caso $LIE \ge LSE$ com mensagem de validação clara emitida pelo Zod.
4. **Registro de Causas Persistido:** Submissão de justificativa no modal de causa especial reflete imediatamente o status "Justificado" na tabela de histórico sem recarregar a página inteira.

---

## 8. Fase 6: Autenticação, Controle de Acesso e Experiência do Usuário
* **Status:** ✅ Concluído (Documentação técnica: [FEAT-06](./feats/06-autenticacao-rbac-experiencia-usuario.md))
* **Cobertura de Testes:** 108 testes automatizados aprovados (Vitest + React Testing Library em 14 arquivos)

Implementação da segurança de acesso, persistência de credenciais e diferenciação de permissões conforme os perfis do sistema.

### 8.1. Telas de Autenticação (`src/pages/LoginPage.tsx`)
* Formulário de Login integrado ao endpoint `POST /api/v1/auth/login`.
* Formulário de Cadastro integrado ao endpoint `POST /api/v1/auth/register`.
* Validação de formato de e-mail e comprimento mínimo de senha via Zod.
* Armazenamento seguro do token de autenticação JWT e atualização do `authStore`.

### 8.2. Proteção de Rotas e Perfis de Acesso (RBAC - [RF03])
* Criação do componente `ProtectedRoute`:
  * Redireciona usuários não autenticados para `/login`, preservando a URL tentada para redirecionamento pós-login.
* Diferenciação visual de permissões:
  * **Operador:** Acesso à visualização ao vivo (`/live`), tela de capacidade (`/capacidade`), histórico (`/historico`) e formulário de ingestão manual (`/ingestao`).
  * **Engenheiro / Administrador:** Acesso liberado para cadastro de novos processos e configuração de limites de cartas (`/processos`).

### 8.3. Refinamento de Feedback e Ergonomia de Alarme
* Notificações tipo Toast disparadas para eventos críticos de produção.
* Alarme visual em destaque na Topbar (ícone de sirene pulsante) quando o último subgrupo processado contiver violação de Nelson.
* Suporte a aviso sonoro configurável e opcional (comutador *Mute/Unmute* na Topbar) para alertar operadores a distância em estações de trabalho industriais.

### 8.4. Métricas Verificáveis de Completude da Fase 6
1. **Auth Guard Efetivo:** Tentativa de acesso direto à rota protegida `/live` via URL limpa sem token no `localStorage` resulta em redirecionamento imediato para `/login` em tempo $< 50$ ms.
2. **Controle de Acesso por Perfil:** Teste automatizado com usuário autenticado com perfil `OPERADOR` comprovando que o botão de criação de novas cartas na página `/processos` permanece oculto ou desabilitado.
3. **Persistência de Sessão:** Ao recarregar a página (`F5`), o token previamente salvo é lido e a sessão permanece ativa sem retorno involuntário à tela de login.

---

## 9. Fase 7: Performance, Testes Automatizados e Containerização
* **Status:** ✅ Concluído (Documentação técnica: [FEAT-07](./feats/07-performance-testes-containerizacao.md))
* **Cobertura de Testes:** 109 testes automatizados aprovados (80.47% de cobertura em linhas de código)

Garantir os requisitos não-funcionais de desempenho, estabilidade de memória, cobertura de testes e empacotamento em contêiner de produção.

### 9.1. Bateria de Testes Automatizados (Vitest + React Testing Library)
* **Testes Unitários:**
  * Funções utilitárias de formatação estatística, cálculo de classes de histograma e helpers de data.
  * Validações dos schemas Zod com casos válidos e inválidos.
* **Testes de Integração de Componentes:**
  * Ciclo de vida do hook `useWebSocketCEP` e buffer do `cepStore`.
  * Renderização de formulários e disparo das mutações com TanStack Query.
* **Meta de Cobertura de Código:**
  * Mínimo de **80% de cobertura de código** global no frontend, e **100% de cobertura** nos hooks de comunicação e stores.

### 9.2. Profiling de Desempenho e Estabilidade de Memória (**[RNF02]**)
* Teste de estresse com streaming contínuo:
  * Executar a ingestão de **1.000 subgrupos consecutivos** via WebSocket (1 subgrupo a cada 100 ms em ambiente de teste de estresse).
  * Monitorar uso de memória (Heap Snapshot do Chrome DevTools) para atestar ausência de vazamento de memória (*memory leaks* em event listeners ou instâncias de ECharts).
  * Comprovar que o framerate da interface se mantém estável a **60 FPS** sem congelamento perceptível (*jank*).

### 9.3. Containerização e Dockerfile Multi-Stage (`frontend/Dockerfile`)
* **Stage 1 (Builder):**
  * Imagem base `node:20-alpine`.
  * Instalação de dependências limpas (`npm ci`).
  * Compilação dos ativos de produção (`npm run build`).
* **Stage 2 (Servidor Web Nginx):**
  * Imagem base `nginx:alpine`.
  * Cópia dos artefatos compilados de `/app/dist` para `/usr/share/nginx/html`.
  * Configuração customizada do `nginx.conf`:
    * Roteamento SPA com suporte a `try_files $uri $uri/ /index.html;`.
    * Proxy reverso para requisições `/api/` e conexões WebSocket `/ws/` apontando para o contêiner do backend.
    * Compressão Gzip ativada para arquivos `.js`, `.css` e `.svg`.

### 9.4. Integração no `docker-compose.yml`
* Adicionar o serviço `frontend` ao arquivo `docker-compose.yml` existente na raiz do projeto:
  * Configurar build com contexto `./frontend`.
  * Mapear porta externa `80` (ou `3000`) para a porta `80` do contêiner Nginx.
  * Configurar dependência do serviço `backend`.

### 9.5. Métricas Verificáveis de Completude da Fase 7
1. **Suíte de Testes Aprovada:** Execução de `npm run test:run` resultando em **100% dos testes aprovados** com cobertura $\ge 80\%$.
2. **Orçamento de Bundle (Bundle Budget):** O tamanho total do pacote de produção gerado no diretório `dist/` (comprimido via Gzip) deve ser **inferior a 600 KB** (aplicando code-splitting dinâmico para os pacotes do ECharts).
3. **Deploy Integrado Unificado:** Execução do comando `docker compose up --build` na raiz do projeto sobe os três serviços (`db`, `backend`, `frontend`) com status *healthy*, permitindo abrir o navegador em `http://localhost`, fazer login e acompanhar o streaming em tempo real.

---

## 10. Matriz Consolidada de Rastreabilidade e Checklist de Conclusão

A tabela abaixo sintetiza os marcos de desenvolvimento, correlacionando as fases às entregas técnicas e seus respectivos critérios de aceitação:

| Fase | Entregável / Módulo | Requisitos Relacionados | Métrica Verificável de Completude | Status |
| :---: | :--- | :---: | :--- | :---: |
| **0** | Setup Vite, TS, Tailwind, Shadcn e Vitest | [RNF02], [RNF07] | Inicialização em < 600ms, `tsc --noEmit` exit code 0 e Vitest operacional | ✅ Concluído |
| **1** | Tipagem DTO, Axios, Zustand e `useWebSocket` | [RF02], [RF13], [RNF05] | 100% de paridade com Pydantic v2; reconexão com backoff validada em testes | ✅ Concluído |
| **2** | Design System IHM, Dark Mode, Sidebar e Topbar | Ergonomia, [RNF02] | Contraste WCAG AA $\ge 4.5:1$, CLS $< 0.05$ e responsividade desktop/tablet | ✅ Concluído |
| **3** | Componentes ECharts ($\bar{X}-R, \bar{X}-s, I-MR$) | [RF09], [RF10], [RF12], [RF15] | Precisão $< 0.001$ vs dados Montgomery; anotação visual das 8 regras de Nelson | ✅ Concluído |
| **4** | Telas Live Studio & Capacidade ($C_p / C_{pk}$) | [RF11], [RF13], [RF14], [RN04] | Streaming a 60 FPS com simulador; gauges e histograma com curva gaussiana | ✅ Concluído |
| **5** | Ingestão Manual, Upload Lote e Histórico | [RF05], [RF06], [RF08], [RF16], [RN01], [RN02] | Preenchimento manual < 8s via teclado; upload CSV validado; modal de causas | ✅ Concluído |
| **6** | Autenticação JWT, Proteção de Rotas e RBAC | [RF01], [RF02], [RF03], [RNF04] | Redirecionamento de não autenticado em < 50ms; restrição de perfil Operador | ✅ Concluído |
| **7** | Profiling 60 FPS, Cobertura $\ge 80\%$ e Docker Multi-stage | [RNF01], [RNF02], [RNF07] | 109 testes (80.47% cobertura de linhas); Compose e Nginx 100% funcionais | ✅ Concluído |
| **8** | Orquestração Full-Stack e DX | [RNF07] | Monorepo package.json com scripts dev, build, lint, test e docker compose | ✅ Concluído |
