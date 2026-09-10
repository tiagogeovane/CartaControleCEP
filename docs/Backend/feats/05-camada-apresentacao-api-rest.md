# FEAT-05: Camada de Apresentação & API REST (FastAPI)

* **Fase do Roadmap:** [Fase 5 - Camada de Apresentação e API REST (FastAPI)](../Roadmap.md#7-fase-5-camada-de-apresentação-e-api-rest-fastapi)
* **Status:** ✅ Concluído
* **Data de Execução:** 09/09/2026

---

## 1. Visão Geral e Contexto

Esta entrega implementa a **Camada de Apresentação HTTP / API REST** do **Sistema de Controle Estatístico de Processos (CEP)**, expondo todos os serviços de aplicação e domínio através de endpoints padronizados, seguros e documentados com **FastAPI** e **Pydantic v2**.

A camada atende diretamente aos requisitos funcionais e de segurança ([RF01], [RF02], [RF03], [RF04], [RF05], [RF07], [RF08], [RF11], [RNF04], [RNF05]):
* Validação estrita de contratos de entrada e saída via DTOs tipados.
* Autenticação assíncrona por **JWT (JSON Web Tokens)** e hashing seguro de senhas com **bcrypt**.
* Ingestão de medições industriais pontuais e em lote com resposta em tempo sub-milissegundo.
* Handlers globais que traduzem exceções de domínio em códigos HTTP semânticos (400, 404, 422).

---

## 2. O que Foi Implementado

### 2.1. Núcleo de Segurança Criptográfica (`backend/app/core/security.py`)
* **Hashing Nativo de Senhas:** Funções `gerar_hash_senha(senha)` e `verificar_senha(plana, hash)` utilizando diretamente a biblioteca `bcrypt`, eliminando incompatibilidades legadas e garantindo alta performance de verificação.
* **Geração e Decodificação de JWT:** `criar_token_acesso(dados, expira_delta)` e `decodificar_token(token)` utilizando algoritmo `HS256` configurável via `Settings`.

---

### 2.2. DTOs e Schemas com Pydantic v2 (`backend/app/api/schemas/`)
Modelos com validação rigorosa de tipos, restrições e documentação OpenAPI:

1. **Autenticação & Usuário (`auth.py`):**
   * `UsuarioCreate`: Nome, e-mail único, senha e perfil (`OPERADOR`, `ENGENHEIRO`, `ADMIN`).
   * `UsuarioResponse`: Exibição segura de perfil sem expor hash da senha.
   * `LoginRequest` & `TokenResponse`: Emissão e retorno de token Bearer.
2. **Processos Industriais (`processo.py`):**
   * `ProcessoCreate`: Nome da linha, código da linha e descrição técnica.
   * `ProcessoResponse`: Objeto representativo da linha fabril.
3. **Cartas de Controle & Capacidade (`carta.py`):**
   * `LimitesEspecificacaoSchema`: Tolerâncias $LSE, LIE$ e Valor Nominal.
   * `LimitesControleSchema`: $LC, LSC, LIC$ e $\hat{\sigma}$.
   * `CartaControleCreate` & `CartaControleResponse`: Parametrização completa e retorno agregado.
   * `ModoLimitesUpdate`: Alternância de modo (`DINAMICO` ou `FIXO`).
   * `CapacidadeResponse`: Relatório analítico com $C_p, C_{pk}, C_{pu}, C_{pl}$, status de aprovação e avisos da regra [RN04].
4. **Ingestão & Telemetria (`subgrupo.py`):**
   * `AmostraIngestaoRequest`: Array numérico `valores` (validação `min_length=1`), carimbo de data/hora e número de subgrupo opcional.
   * `SubgrupoResponse`: Retorno completo com estatísticas ($\bar{X}, R, s$), flag `fora_de_controle` e lista de `violacoes`.
   * `ImportacaoLoteRequest` & `ImportacaoLoteResponse`: Carga em lote de dados históricos pré-coletados.

---

### 2.3. Injeção de Dependências (`backend/app/api/deps.py`)
Provedores desacoplados baseados em Clean Architecture e inversão de dependência (**DIP**):

* Provedores de repositórios: `get_usuario_repository`, `get_processo_repository`, `get_carta_repository`, `get_subgrupo_repository`.
* Provedores de casos de uso: `get_gerenciar_carta_service`, `get_analise_capacidade_service`, `get_processamento_subgrupo_service` (já acoplado ao `WebSocketNotificationObserver`).
* Autenticação e Segurança: `oauth2_scheme` e `get_current_user` com validação de token Bearer.

---

### 2.4. Endpoints REST da API v1 (`backend/app/api/v1/routers/`)

1. **Roteador de Autenticação (`/api/v1/auth`):**
   * `POST /register`: Cadastra novo operador ou engenheiro (HTTP 201). Retorna 400 se o e-mail já existir.
   * `POST /login`: Valida credenciais e emite JWT Bearer (HTTP 200).
   * `POST /token`: Endpoint compatível com OAuth2 Password Form para login direto no Swagger UI (`/docs`).
   * `GET /me`: Consulta perfil e dados do usuário logado (exige Bearer token).

2. **Roteador de Processos Industriais (`/api/v1/processos`):**
   * `POST /`: Cadastra nova linha produtiva (exige autenticação).
   * `GET /`: Lista processos industriais cadastrados.
   * `GET /{id}`: Detalha processo industrial por ID (HTTP 404 caso não exista).

3. **Roteador de Cartas de Controle (`/api/v1/cartas`):**
   * `POST /`: Cria nova carta vinculada a um processo (HTTP 201), aplicando resolução automática de tipo via [RN01] caso não fornecido.
   * `GET /`: Lista cartas cadastradas com suporte a filtro query `processo_id`.
   * `GET /{id}`: Retorna a carta, seus limites atuais e total de subgrupos.
   * `GET /{id}/capacidade`: Retorna os índices de capabilidade $C_p$ e $C_{pk}$ e relatório analítico de estabilidade fabril ([RF11], [RN04]).
   * `PATCH /{id}/especificacoes`: Atualiza os limites de especificação de engenharia ($LSE, LIE$).
   * `PATCH /{id}/modo`: Alterna o modo de cálculo de limites entre `DINAMICO` e `FIXO`.

4. **Roteador de Ingestão de Telemetria (`/api/v1/cartas`):**
   * `POST /{id}/amostras`: Endpoint principal de ingestão fabril em tempo real ([RF07]). Valida tamanho do subgrupo [RN02], recalcula limites, detecta violações das 8 Regras de Nelson, persiste no MySQL e transmite via WebSocket em tempo real. Retorna HTTP 201 com o subgrupo processado.
   * `POST /{id}/importar`: Carga em massa de histórico pré-coletado ([RF08]) com persistência em lote e atualização final de limites.
   * `GET /{id}/subgrupos`: Consulta o histórico cronológico dos subgrupos com paginação por limite.

---

### 2.5. Ponto de Entrada Global (`backend/app/main.py`)
* Inclusão e prefixação de todos os roteadores sob `/api/v1`.
* Exception Handlers customizados que interceptam exceções de domínio e retornam JSON padronizado:
  * `EntidadeNaoEncontradaError` $\to$ HTTP 404 Not Found.
  * `AmostraInvalidaError` $\to$ HTTP 422 Unprocessable Content.
  * `EspecificacoesNaoDefinidasError`, `DadosInsuficientesError`, `DominioException` $\to$ HTTP 400 Bad Request.

---

## 3. Relação de Arquivos Criados e Modificados

| Arquivo | Ação | Responsabilidade |
| :--- | :---: | :--- |
| `backend/app/core/security.py` | Criado | Criptografia bcrypt e emissão/validação de JWT |
| `backend/app/core/database.py` | Modificado | Configuração de engine com NullPool para robustez assíncrona |
| `backend/app/api/deps.py` | Criado | Injeção de dependências para repositórios, serviços e auth |
| `backend/app/api/schemas/auth.py` | Criado | Schemas de autenticação e usuários |
| `backend/app/api/schemas/processo.py` | Criado | Schemas de processo industrial |
| `backend/app/api/schemas/carta.py` | Criado | Schemas de carta de controle e índices de capacidade |
| `backend/app/api/schemas/subgrupo.py` | Criado | Schemas de ingestão, telemetria e subgrupos |
| `backend/app/api/schemas/__init__.py` | Criado | Exportação unificada dos DTOs Pydantic |
| `backend/app/api/v1/routers/auth.py` | Criado | Rotas de cadastro, login e `/me` |
| `backend/app/api/v1/routers/processos.py` | Criado | Rotas de processos industriais |
| `backend/app/api/v1/routers/cartas.py` | Criado | Rotas de cartas, especificações e capacidade |
| `backend/app/api/v1/routers/ingestao.py` | Criado | Rotas de ingestão `/amostras` e `/importar` |
| `backend/app/api/v1/routers/__init__.py` | Criado | Exportação unificada dos roteadores v1 |
| `backend/app/main.py` | Modificado | App FastAPI com CORS, exception handlers e rotas v1 |
| `backend/tests/unit/core/test_security.py` | Criado | Testes unitários de bcrypt e tokens JWT |
| `backend/tests/integration/test_api_auth.py` | Criado | Testes de integração de registro, login e proteção JWT |
| `backend/tests/integration/test_api_processos.py` | Criado | Testes de integração do CRUD de processos |
| `backend/tests/integration/test_api_cartas.py` | Criado | Testes de integração de cartas, tolerâncias e capacidade |
| `backend/tests/integration/test_api_ingestao.py` | Criado | Testes de integração de ingestão, Nelson e carga em lote |

---

## 4. Validação e Testes

1. **Bateria Completa de Testes:**
   * **Total de Testes:** **154 testes executados e aprovados** (`pytest`).
   * **Cobertura:** Autenticação JWT, integridade referencial, telemetria em tempo real, validação [RN01], [RN02] e [RN04], importação em lote e streaming de WebSockets.
   * **Tempo de Execução:** ~6.2s.

2. **Auditoria de Código Estático (Linter):**
   * Comando: `ruff check .`
   * Resultado: **All checks passed!** (0 avisos ou erros).

---

## 5. Próximos Passos (Fase 6 do Roadmap)

Com todas as camadas do backend implementadas (Domínio, Persistência, Aplicação, WebSockets e API REST), a etapa final é a **Fase 6: Integração, Scripts de Carga & Deploy (Docker Compose)**:
* Script simulador de linha de fábrica IoT (`backend/scripts/simulador_iot.py`) com emissão contínua e injeção controlada de causas especiais de Nelson.
* Teste ponta a ponta (E2E) de latência e concorrência.
* Criação do `Dockerfile` multi-stage para o backend e atualização de `docker-compose.yml`.
