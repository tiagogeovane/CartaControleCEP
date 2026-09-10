# Feature FEAT-00: Setup Inicial do Projeto, Tooling e Infraestrutura de Testes

* **Fase do Roadmap:** [Fase 0 - Setup do Ambiente, Tooling e Infraestrutura Base](file:///home/tiago/Documents/Controle%20Estatistico%20de%20Processos/docs/frontend/Roadmap.md#2-fase-0-setup-do-ambiente-tooling-e-infraestrutura-base)
* **Status:** ✅ Concluído
* **Ambiente:** Node.js v22+, Vite 8, React 19, TypeScript 6, Vitest 5, Oxlint

---

## 1. Contexto e Motivação

O objetivo da **Fase 0** foi estabelecer a infraestrutura base do frontend na pasta `frontend/`, configurando ferramentas modernas de alta produtividade, suporte a execução rápida de testes unitários e compilação rigorosa do TypeScript para garantir a qualidade de código desde o primeiro dia.

---

## 2. Configurações e Decisões Técnicas

1. **Scaffolding e Build Tool:**
   * Aplicação inicializada com Vite + React + TypeScript.
   * Compilação e bundling otimizados (`tsc -b && vite build`) gerando builds em torno de 200 ms.
2. **Resolução de Módulos e Alias `@/*`:**
   * Configuração de resolução de caminhos em `tsconfig.app.json` mapeando `@/*` para `./src/*`.
   * Configuração correspondente em `vite.config.ts` com `path.resolve(import.meta.dirname, './src')`.
3. **Proxy de Desenvolvimento para API e WebSockets:**
   * Encaminhamento transparente de `/api` para `http://localhost:8000`.
   * Encaminhamento de `/ws` para `ws://localhost:8000` com suporte nativo a WebSockets (`ws: true`).
4. **Infraestrutura de Testes Automatizados:**
   * Configuração do Vitest com ambiente `jsdom` e setup com `@testing-library/jest-dom`.
   * Adição dos scripts `test` e `test:watch` no `package.json`.
5. **Linter Rápido:**
   * Oxlint configurado para detecção instantânea de violações de código e regras de React Compiler.

---

## 3. Arquivos Criados e Modificados

| Arquivo | Descrição |
| :--- | :--- |
| `frontend/package.json` | Definição de dependências e scripts de execução/testes |
| `frontend/vite.config.ts` | Configuração do Vite, resolução de alias, proxy e runner do Vitest |
| `frontend/tsconfig.app.json` | Configurações do compilador TypeScript com paths `@/*` |
| `frontend/src/test/setup.ts` | Arquivo de inicialização de asserções do jest-dom |

---

## 4. Validação

* `npm run build`: Exit code 0 (212 ms).
* `npm run lint`: Exit code 0 (0 warnings, 0 errors).
* `npm test`: Suíte Vitest operacional.
