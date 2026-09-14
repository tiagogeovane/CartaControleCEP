# Feature FEAT-06: Autenticação, Controle de Acesso e Experiência do Usuário (RBAC)

* **Fase do Roadmap:** [Fase 6 - Autenticação, Controle de Acesso e Experiência do Usuário](../Roadmap.md#8-fase-6-autentica%C3%A7%C3%A3o-controle-de-acesso-e-experi%C3%AAncia-do-usu%C3%A1rio)
* **Status:** ✅ Concluído
* **Testes Automatizados:** 108 testes unitários e de integração aprovados (100% de sucesso em 14 arquivos)

---

## 1. Contexto e Motivação

A **Fase 6** implementa a camada de segurança de acesso e governança operacional do sistema de Controle Estatístico de Processos (CEP):

1. **Autenticação Segura JWT ([RF03]):** Página dedicada (`LoginPage.tsx`) com suporte a login e autorregistro de operadores e engenheiros, integrando-se aos endpoints `/auth/login` e `/auth/register` com validação de formato de e-mail corporativo e tamanho mínimo de senha.
2. **Controle de Acesso Baseado em Perfis (RBAC - [RF03]):** Roteador de guarda de rotas (`ProtectedRoute.tsx`) que intercepta requisições não autenticadas redirecionando-as para `/login` (preservando a rota de origem para redirecionamento pós-login) e restringe módulos críticos (ex: Gestão de Processos e Cartas restrita a `ENGENHEIRO` e `ADMIN`) apresentando tela amigável de acesso negado.
3. **Sinalização Industrial e Experiência do Usuário (IHM):**
   * Topbar com identificação do usuário logado (nome e badge do perfil de acesso) e botão para encerramento de sessão (*logout*).
   * Indicador visual de **Sirene Industrial** com badge pulsante e contador de alarmes ativos em tempo real quando anomalias são detectadas pelo motor de regras.
   * Controle de áudio com alternador de ativação/silenciamento de alarmes sonoros.

---

## 2. Decisões Arquiteturais e Padrões de Projeto

### 2.1. Roteamento Protegido e Governança RBAC (`ProtectedRoute.tsx`)

* **Fluxo de Autenticação:**
  * O componente inspeciona o estado reativo `isAuthenticated` do `useAuthStore` (persistido em `localStorage` via Zustand middleware).
  * Se deslogado, emite `<Navigate to="/login" state={{ from: location }} replace />`.
* **Avaliação de Perfis (RBAC):**
  * Aceita a prop opcional `perfisPermitidos: ('OPERADOR' | 'ENGENHEIRO' | 'ADMIN')[]`.
  * Se o perfil do usuário não atender aos requisitos da rota, renderiza um painel centralizado de advertência industrial (`Acesso Restrito por Perfil (RBAC)`), informando o perfil atual do colaborador, os perfis necessários e botão de retorno seguro ao Live Studio.
* **Mapeamento em `App.tsx`:**
  * Rotas gerais acessíveis a qualquer perfil autenticado (`/live`, `/capacidade`, `/ingestao`, `/historico`).
  * Rota de gestão fabril restrita (`/processos`) com `perfisPermitidos={['ENGENHEIRO', 'ADMIN']}`.

### 2.2. Tela de Autenticação e Cadastro (`LoginPage.tsx`)

* **Interface Dual (Login / Cadastro):**
  * Alternador dinâmico de abas com transições suaves em Tailwind CSS.
  * Validações de cliente (`noValidate` para evitar tooltips nativos inconsistentes entre navegadores):
    * Validação estrita de formato de e-mail corporativo via Regex.
    * Validação de comprimento mínimo de senha ($\ge 6$ caracteres).
    * Validação de comprimento mínimo de nome ($\ge 2$ caracteres).
  * Seletor de perfil de acesso (`OPERADOR`, `ENGENHEIRO`, `ADMIN`) para ambiente de desenvolvimento e testes.
  * Redirecionamento automático pós-login para a rota originalmente requisitada ou `/live`.

### 2.3. Sinalização de Alarme e Sirene na Topbar (`Topbar.tsx`)

* **Sirene Visual de Chão de Fábrica:**
  * Avalia reativamente `alarmesAtivos.length` da `useCEPStore`.
  * Exibe badge de alta visibilidade em vermelho com ícone `Siren` pulsante e contagem de anomalias ativas.
* **Mute de Sirene Sonora:**
  * Botão de alternância com ícones `Volume2` e `VolumeX`, permitindo que o operador silencie o áudio de alarme da linha durante investigação de bancada.

---

## 3. Arquivos Criados e Modificados

| Arquivo | Responsabilidade |
| :--- | :--- |
| `frontend/src/pages/LoginPage.tsx` | Página de login e autorregistro com validações corporativas e integração JWT |
| `frontend/src/pages/index.ts` | Exportação da `LoginPage` no barrel das páginas |
| `frontend/src/components/auth/ProtectedRoute.tsx` | Componente de guarda de rotas autenticadas e restrições RBAC por perfil |
| `frontend/src/components/auth/index.ts` | Barrel export dos componentes de segurança e autenticação |
| `frontend/src/components/layout/Topbar.tsx` | Inclusão de dados de perfil, logout, sirene visual pulsante e toggle de áudio |
| `frontend/src/App.tsx` | Configuração de rotas protegidas gerais e rota `/processos` restrita por RBAC |
| `frontend/src/test/auth.test.tsx` | Suíte completa com 11 testes cobrindo login, validações, cadastro, RBAC e sirene |
| `docs/frontend/Roadmap.md` | Atualização do status da Fase 6 para concluído |
| `docs/frontend/feats/README.md` | Registro de FEAT-06 no índice de funcionalidades |

---

## 4. Validação e Qualidade

* **Vitest:** 14 arquivos de teste, 108 testes executados com 100% de sucesso.
* **Oxlint:** 0 erros e 0 avisos.
* **TypeScript (`tsc -b`):** 0 erros de tipagem.
* **Vite Build:** Build de produção gerado em `dist/` com sucesso.
