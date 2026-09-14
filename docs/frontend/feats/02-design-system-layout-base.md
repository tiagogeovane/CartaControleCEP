# Feature FEAT-02: Design System Industrial, Ergonomia IHM e Layout Base

* **Fase do Roadmap:** [Fase 2 - Design System Industrial, Ergonomia IHM e Layout Base](file:///home/tiago/Documents/Controle%20Estatistico%20de%20Processos/docs/frontend/Roadmap.md#4-fase-2-design-system-industrial-ergonomia-ihm-e-layout-base)
* **Status:** ✅ Concluído
* **Testes Automatizados:** 40 testes unitários e de integração aprovados (100% de sucesso)

---

## 1. Contexto e Motivação

O objetivo da **Fase 2** foi implementar o sistema de design industrial (IHM) e a estrutura ergonômica de telas para a interface de chão de fábrica e salas de controle. O foco esteve em garantir legibilidade rápida de métricas estatísticas sem fadiga visual, contraste semântico de segurança (conforme diretrizes internacionais de acessibilidade WCAG AA), navegação fluida e estável entre os 5 módulos da aplicação, e componentes modulares de apoio (Badges de status, Cards numéricos monoespaçados, Modais de apontamento e Toasts de notificação).

---

## 2. Decisões Arquiteturais e Padrões de Projeto

1. **Tema Industrial Dark Nativo e Tokens Semânticos (`src/index.css`):**
   * Configuração do Tailwind CSS v4 com `@theme` e paleta semântica estrita:
     * Fundo Escuro IHM: `#0F172A` (Slate 900) e Cards `#1E293B` (Slate 800).
     * Sob Controle: `#10B981` / `#34D399` (Emerald).
     * Fora de Controle / Alarme Crítico: `#EF4444` / `#F87171` (Red/Rose).
     * Alerta de Zonas $1\sigma / 2\sigma$: `#F59E0B` / `#FBBF24` (Amber).
     * Linha Central ($LC$): `#3B82F6` / `#60A5FA` (Blue).
     * Limites de Engenharia ($LSE / LIE$): `#8B5CF6` (Purple).
   * **Tipografia Anti-Jitter:** Fontes monoespaçadas (`JetBrains Mono`, `Roboto Mono`, `monospace`) para valores numéricos, medições e limites, evitando que números com larguras diferentes causem deslocamento visual na tela durante o streaming contínuo.
2. **Acessibilidade WCAG AA Comprovada:**
   * Teste matemático de luminância relativa comprovando que todas as cores de texto e status contra as superfícies escuras atendem à razão de contraste exigida $\ge 4.5:1$ (e superior a $10:1$ para o texto primário).
3. **Sidebar Retrátil Persistente:**
   * Alternância entre modo expandido ($256\text{ px}$) e colapsado ($72\text{ px}$), memorizada no `localStorage` (`cep_sidebar_collapsed`).
   * Navegação estruturada pelos 5 módulos industriais: Live CEP (`/live`), Capacidade (`/capacidade`), Ingestão (`/ingestao`), Histórico (`/historico`) e Processos (`/processos`).
4. **Topbar de Telemetria e Conectividade Reativa:**
   * Exibição visual do pulso de conexão do WebSocket (`ONLINE`, `RECONNECTING`, `OFFLINE`, `CONNECTING`).
   * Identificação da carta ativa, tipo e tamanho amostral $n$.
   * Badge dinâmico de controle estatístico (SOB CONTROLE vs FORA DE CONTROLE).
   * Botão de congelamento/pausa da visualização gráfica para auditoria de pontos.
   * Identificação do perfil de acesso (`OPERADOR`, `ENGENHEIRO`, `ADMIN`) e botão de logout.
5. **Componentes Comuns e Toast Centralizado:**
   * `Badge`: Indicadores de limites e conectividade.
   * `CardKpi`: Cards modulares para exibição destacada de métricas $\bar{\bar{X}}, \bar{R}, \hat{\sigma}, C_{pk}$.
   * `Modal`: Diálogo acessível com backdrop sombreado e controle de tecla `Escape`.
   * `ToastContainer`: Sistema de notificações reativo gerido via `toastStore`.

---

## 3. Arquivos Criados e Modificados

| Arquivo | Responsabilidade |
| :--- | :--- |
| `frontend/src/lib/utils.ts` | Função utilitária `cn` com `clsx` e `tailwind-merge` |
| `frontend/src/index.css` | Importação do Tailwind v4, tokens de tema industrial e scrollbar customizada |
| `frontend/src/components/common/Badge.tsx` | Componente Badge com variantes semânticas e pulso visual |
| `frontend/src/components/common/CardKpi.tsx` | Componente de KPI estatístico com tipografia monoespaçada |
| `frontend/src/components/common/Modal.tsx` | Diálogo modal com traps de teclado, acessibilidade ARIA e backdrop |
| `frontend/src/components/common/ToastContainer.tsx` | Contêiner de toasts flutuantes para avisos e alarmes industriais |
| `frontend/src/components/common/index.ts` | Barrel export dos componentes comuns |
| `frontend/src/stores/toastStore.ts` | Store Zustand para despacho e remoção de notificações |
| `frontend/src/components/layout/Sidebar.tsx` | Barra lateral retrátil de navegação dos módulos |
| `frontend/src/components/layout/Topbar.tsx` | Barra superior com telemetria, carta ativa e perfil |
| `frontend/src/components/layout/MainLayout.tsx` | Shell principal responsivo com Sidebar, Topbar e Toasts |
| `frontend/src/components/layout/index.ts` | Barrel export dos componentes de layout |
| `frontend/src/App.tsx` | Roteamento com React Router, QueryClientProvider e páginas de shell |
| `frontend/src/test/designSystem.test.ts` | Suíte de testes matemáticos de contraste de cores WCAG AA |
| `frontend/src/test/components.test.tsx` | Suíte de testes unitários para Badge, CardKpi, Modal e Toast |
| `frontend/src/test/layout.test.tsx` | Suíte de testes de integração para Sidebar, Topbar e MainLayout |
| `frontend/vite.config.ts` | Adição do plugin `@tailwindcss/vite` |
| `frontend/tsconfig.app.json` | Configuração de tipos para `@testing-library/jest-dom` |

---

## 4. Validação e Testes Automatizados

* **Execução da Suíte Completa Vitest:**
  ```text
  Test Files  7 passed (7)
       Tests  40 passed (40)
    Duration  3.31s
  ```
* **Compilação TypeScript e Build de Produção:**
  ```text
  tsc -b && vite build
  ✓ built in 521ms (Exit code 0)
  ```
* **Linter (oxlint):**
  ```text
  oxlint -> 0 warnings, 0 errors
  ```

---

## 5. Próximos Passos

Prosseguir para a **Fase 3: Motor Gráfico Especializado de Cartas CEP (Apache ECharts)**, implementando:
1. Componente base reutilizável integrado ao Apache ECharts com `ResizeObserver`.
2. Cartas de controle $\bar{X}-R$ e $\bar{X}-s$ com linhas $LSC, LC, LIC, LSE, LIE$ e faixas sigma sombreadas ($\pm 1\sigma, \pm 2\sigma, \pm 3\sigma$).
3. Carta de valores individuais e amplitude móvel $I-MR$.
4. Destaque luminoso pulsante para violações das 8 Regras de Nelson com tooltips detalhados.
5. Renderização incremental a 60 FPS (**[RNF02]**).
