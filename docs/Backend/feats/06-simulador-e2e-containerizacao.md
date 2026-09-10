# FEAT-06: Simulador IoT, Testes End-to-End (E2E) & Containerização Final

* **Fase do Roadmap:** [Fase 6 - Validação Ponta a Ponta, Simulação e Containerização](../Roadmap.md#8-fase-6-validação-ponta-a-ponta-simulação-e-containerização)
* **Status:** ✅ Concluído
* **Data de Execução:** 09/09/2026

---

## 1. Visão Geral e Contexto

A **Fase 6** encerra a construção do backend do **Sistema de Controle Estatístico de Processos (CEP)**, consolidando a integração entre todas as camadas da **Clean Architecture** (Domínio Puro, Persistência Relacional, Casos de Uso de Aplicação, Tempo Real com WebSockets e API REST).

Os principais objetivos entregues nesta etapa incluem:
1. **Simulador de Linha de Produção IoT (`simulador_iot.py`):** Emissor autônomo de telemetria em alta frequência com auto-provisionamento de processos/cartas e injeção programada de perturbações estatísticas para testar as 8 Regras de Nelson.
2. **Suíte de Testes End-to-End (E2E) (`test_pipeline_e2e.py`):** Validação ponta a ponta do fluxo REST $\to$ Banco $\to$ WebSocket, com aferição estrita do requisito não-funcional de latência **[RNF01]** (< 500 ms) e testes de concorrência com múltiplos clientes simultâneos.
3. **Containerização Pronta para Produção:** Construção de `Dockerfile` multi-stage otimizado e orquestração completa via `docker-compose.yml` com migração automática do Alembic e healthchecks coordenados entre banco de dados e backend.

---

## 2. O que Foi Implementado

### 2.1. Simulador de Linha de Produção IoT (`backend/scripts/simulador_iot.py`)
Script modular para testes de estresse, demonstrações interativas e alimentação contínua de dashboards:

* **Auto-Provisionamento e Conexão:**
  * Validação de integridade do servidor através do endpoint `/health`.
  * Autenticação automática ou registro instantâneo do operador de telemetria.
  * Localização ou criação automática de processo industrial (`CNC-SIM-01`) e carta de controle ($\bar{X}-R$ com $n=5$, tolerâncias industriais calculadas e limites dinâmicos).
* **Geração Estocástica & Perturbações Controladas:**
  * Geração normal $\mathcal{N}(\mu=25.0, \sigma=0.5)$ em operação padrão estável.
  * Injeção periódica programada a cada 40 subgrupos para simular falhas industriais reais:
    * **Regra 1:** Outlier além de $3.5\sigma$ ($\mu + 4.2\sigma$), disparando alerta imediato.
    * **Regra 2:** Deslocamento sustentado de média ($\mu + 1.8\sigma$) por 9 subgrupos consecutivos.
    * **Regra 3:** Tendência de aquecimento/desgaste com 6 subgrupos estritamente crescentes.
* **Métricas de Rede e Saída Visual:**
  * Medição em microssegundos da latência de cada requisição HTTP de ingestão.
  * Formatação no terminal com cores ANSI, exibindo médias $\bar{X}$, amplitudes $R$, status de controle e regras violadas.
  * Relatório consolidado ao finalizar (Ctrl+C), com contagem de subgrupos sob controle vs fora de controle, distribuição de violações e latências mínima, média e máxima.
* **Parâmetros de CLI (`argparse`):**
  * `--url`: URL base da API (padrão: `http://localhost:8000`).
  * `-i / --intervalo`: Intervalo entre amostras em segundos (padrão: `2.0s`).
  * `-n / --limite`: Quantidade de subgrupos a emitir (`0` para execução infinita contínua).
  * `-m / --media`: Média nominal do processo (padrão: `25.0`).
  * `-s / --desvio`: Desvio padrão nominal (padrão: `0.5`).
  * `--sem-anomalias`: Flag para desativar a injeção de falhas e rodar apenas dados sob controle.

---

### 2.2. Testes End-to-End (E2E) de Latência e Concorrência (`backend/tests/e2e/test_pipeline_e2e.py`)
Bateria de testes automatizados com cobertura de cenários reais de ponta a ponta:

1. **`test_e2e_fluxo_completo_e_latencia_tempo_real`:**
   * Registra usuário, autentica, cria processo fabril e carta $\bar{X}-R$.
   * Conecta cliente WebSocket em `/ws/cartas/{carta_id}` e valida handshake `CONEXAO_ESTABELECIDA`.
   * Envia sequência de 5 subgrupos estáveis via `POST /api/v1/cartas/{carta_id}/amostras`.
   * Recebe em tempo real o pacote `NOVO_SUBGRUPO_PROCESSADO` via WebSocket.
   * **Validação de Latência [RNF01]:** Mede o tempo decorrido desde o envio da requisição REST até a recepção do pacote no WebSocket, comprovando conformidade com o limite de 500 ms (latência média observada: ~50 ms).
2. **`test_e2e_deteccao_anomalia_regras_nelson_via_websocket`:**
   * Envia ponto de perturbação extrema ($\bar{X} > LSC$).
   * Valida que o evento transmitido pelo WebSocket contém `status_controle.fora_de_controle: True` e inclui `REGRA_1` na lista de `regras_violadas`.
3. **`test_e2e_concorrencia_multiplos_clientes_websocket`:**
   * Abre simultaneamente 3 conexões WebSocket independentes para a mesma carta.
   * Dispara uma ingestão REST e valida que todos os 3 clientes recebem concorrentemente o broadcast idêntico.
4. **`test_e2e_rejeicao_tamanho_invalido_rn02`:**
   * Envia subgrupo com 3 medições quando o configurado na carta é 5.
   * Valida resposta HTTP 422 Unprocessable Content e comprova que o canal WebSocket permanece limpo sem dados corrompidos.
5. **`test_e2e_importacao_lote_e_capacidade_processo`:**
   * Importa lote em massa com 25 subgrupos históricos via `POST /api/v1/cartas/{carta_id}/importar`.
   * Consulta `GET /api/v1/cartas/{carta_id}/capacidade` e valida o cálculo de $C_p$ e $C_{pk}$ com dados históricos consolidados.

---

### 2.3. Containerização Multi-Stage & Orquestração Docker

1. **Dockerfile Otimizado (`backend/Dockerfile`):**
   * **Stage 1 (`builder`):** Imagem base `python:3.12-slim` com `build-essential` instalando dependências com `--user --no-cache-dir`.
   * **Stage 2 (`final`):** Imagem enxuta sem compiladores, copiando apenas as dependências pré-instaladas de `/root/.local`.
   * **Startup Turnkey:** Executa migrações estruturais do banco (`alembic upgrade head`) antes de subir o servidor Uvicorn ASGI na porta `8000`.
2. **`.dockerignore`:**
   * Isola o contexto de build de ambientes locais (`.venv`, `__pycache__`, `.git`, `.pytest_cache`).
3. **`docker-compose.yml`:**
   * Serviço `db` (MySQL 8.0) com persistência em volume `cep_mysql_data` e healthcheck nativo com `mysqladmin ping`.
   * Serviço `backend` orquestrado com `depends_on: db: condition: service_healthy`.
   * Variáveis de ambiente configuráveis para banco, portas e segurança.
   * Healthcheck HTTP no endpoint `/health` via Python nativo sem depender de ferramentas extras de SO.

---

## 3. Estrutura de Arquivos da Entrega

```text
Controle Estatistico de Processos/
├── docker-compose.yml                           # Orquestração do banco e backend
├── .dockerignore                                # Exclusão de artefatos no build
├── backend/
│   ├── Dockerfile                               # Build multi-stage enxuto para produção
│   ├── .dockerignore                            # Exclusão de arquivos locais do backend
│   ├── scripts/
│   │   ├── simulador_iot.py                     # [NOVO] Emissor contínuo de telemetria e anomalias
│   │   └── visualizar_motor_cep.py              # Script visualizador do motor estatístico
│   └── tests/
│       └── e2e/
│           ├── __init__.py
│           └── test_pipeline_e2e.py             # [NOVO] Testes E2E de latência, anomalias e concorrência
└── docs/Backend/feats/
    └── 06-simulador-e2e-containerizacao.md      # [NOVO] Esta documentação
```

---

## 4. Validação e Qualidade

* **Suíte Completa de Testes (`pytest`):**
  * **159 testes passando com 100% de sucesso:**
    * 5 testes End-to-End (`test_pipeline_e2e.py`).
    * 13 testes de integração de API, banco e WebSocket (`backend/tests/integration/`).
    * 141 testes unitários de domínio, motor estatístico e regras de Nelson (`backend/tests/unit/`).
  * **Tempo total de execução:** ~8.2 segundos.
* **Aferição de Latência [RNF01]:**
  * Ingestão HTTP $\to$ Atualização de Limites Dinâmicos $\to$ Regras de Nelson $\to$ Gravação MySQL $\to$ Broadcast WebSocket: **~50 ms** (muito abaixo do teto de 500 ms).
* **Análise Estática & Linter (`ruff check .`):**
  * **0 erros / 0 avisos** (`All checks passed!`).
