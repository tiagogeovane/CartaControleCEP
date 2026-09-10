# Feature FEAT-01: Tipagem Estrita, Estado Global e Comunicação (REST & WebSocket)

* **Fase do Roadmap:** [Fase 1 - Camada de Tipagem, Estado Global e Comunicação (REST & WebSocket)](file:///home/tiago/Documents/Controle%20Estatistico%20de%20Processos/docs/frontend/Roadmap.md#3-fase-1-camada-de-tipagem-estado-global-e-comunicação-rest--websocket)
* **Status:** ✅ Concluído
* **Testes Automatizados:** 24 testes unitários e de integração aprovados (100% de sucesso)

---

## 1. Contexto e Motivação

O objetivo da **Fase 1** foi estabelecer toda a infraestrutura de dados e comunicação do frontend React com o backend FastAPI. Isso inclui contratos rigorosos em TypeScript espelhando os esquemas Pydantic v2, stores reativas em memória com Zustand para gerenciamento da sessão do usuário e buffer deslizante de subgrupos, cliente HTTP Axios com injeção automática de JWT e tratamento de expiração (401), além do hook customizado `useWebSocketCEP` dotado de reconexão resiliente via algoritmo de **Exponential Backoff** e suporte a **Heartbeat (ping/pong)**.

---

## 2. Decisões Arquiteturais e Padrões de Projeto

1. **Paridade Tipológica Estrita (Zero `any`):**
   * Todas as interfaces em `src/types/api.ts` espelham os retornos e requisições dos endpoints do FastAPI (`CartaControleResponse`, `SubgrupoResponse`, `CapacidadeResponse`, `ProcessoResponse`).
   * Metadados completos das 8 Regras de Nelson centralizados em `src/types/cep.ts`.
2. **Buffer Deslizante em Memória (Zustand):**
   * A store `useCEPStore` mantém um histórico fixado em no máximo $N$ subgrupos (padrão 100 itens), descartando automaticamente amostras antigas à medida que novos subgrupos são recebidos via WebSocket, prevenindo estouro de memória e queda de performance de renderização.
   * Suporte a congelamento de visualização (`streamingPausado`).
3. **Segurança e Interceptors HTTP:**
   * O cliente Axios (`src/services/api.ts`) injeta o cabeçalho `Authorization: Bearer <token>` a partir da store Zustand (`authStore`), com fallback síncrono para `localStorage`.
   * Interceptor de resposta captura status HTTP 401 e realiza logout atômico limpando os estados da aplicação.
4. **Resiliência de Tempo Real (WebSockets + Backoff Exponencial):**
   * O hook `useWebSocketCEP` encapsula a conexão nativa com `/ws/cartas/{carta_id}`.
   * Disparo automático de heartbeat `ping` a cada 20 segundos.
   * Em caso de queda não intencional, calcula atrasos progressivos de reconexão ($1\text{s}, 2\text{s}, 4\text{s}, 8\text{s}, \dots$ até teto de $30\text{s}$), atualizando o status do sistema de forma reativa para `RECONNECTING` e posteriormente `ONLINE`.

---

## 3. Arquivos Criados e Modificados

| Arquivo | Responsabilidade |
| :--- | :--- |
| `frontend/src/types/api.ts` | DTOs e tipos de dados da API REST (Pydantic v2 mirror) |
| `frontend/src/types/websocket.ts` | Contratos dos eventos e payloads do WebSocket em tempo real |
| `frontend/src/types/cep.ts` | Metadados e constantes estatísticas das Regras de Nelson e Zonas Sigma |
| `frontend/src/types/index.ts` | Barrel export dos tipos do sistema |
| `frontend/src/stores/authStore.ts` | Store Zustand para sessão JWT e autenticação de usuários com persistência |
| `frontend/src/stores/cepStore.ts` | Store Zustand para dados da carta ativa, buffer deslizante e alarmes de anomalia |
| `frontend/src/stores/index.ts` | Barrel export das stores |
| `frontend/src/services/api.ts` | Instância Axios com interceptors e métodos tipados de API (auth, cartas, processos, ingestao) |
| `frontend/src/services/index.ts` | Barrel export de services |
| `frontend/src/hooks/useWebSocketCEP.ts` | Hook de WebSocket com Exponential Backoff, heartbeat e single source of truth |
| `frontend/src/hooks/index.ts` | Barrel export de hooks |
| `frontend/src/test/types.test.ts` | Suíte de testes de compatibilidade tipológica |
| `frontend/src/test/cepStore.test.ts` | Suíte de testes do buffer deslizante e alarmes da store |
| `frontend/src/test/api.test.ts` | Suíte de testes do cliente Axios e interceptors JWT |
| `frontend/src/test/useWebSocketCEP.test.ts` | Suíte de testes de reconexão, ping/pong e eventos do WebSocket |
| `frontend/vite.config.ts` | Configuração de alias `@`, proxy de desenvolvimento e Vitest |
| `frontend/tsconfig.app.json` | Configuração de paths `@/*` para TypeScript 6 |

---

## 4. Validação e Testes Automatizados

* **Execução da Suíte Vitest:**
  ```text
  Test Files  4 passed (4)
       Tests  24 passed (24)
    Duration  1.76s
  ```
* **Compilação TypeScript e Build Vite:**
  ```text
  tsc -b && vite build
  ✓ built in 217ms (Exit code 0)
  ```
* **Linter (oxlint):**
  ```text
  oxlint -> 0 warnings, 0 errors
  ```

---

## 5. Próximos Passos

Prosseguir para a **Fase 2: Design System Industrial, Ergonomia IHM e Layout Base**, implementando:
1. Componentes visuais utilitários (Shadcn UI / Radix UI).
2. Tema Dark Mode padrão chão de fábrica.
3. Topbar de telemetria com indicador de status de conexão WebSocket reativo.
4. Sidebar retrátil de navegação pelos 5 módulos industriais.
