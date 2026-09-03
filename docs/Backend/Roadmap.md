# Roadmap de Desenvolvimento do Backend
## Sistema de Controle Estatístico de Processos (CEP) em Tempo Real

---

## 1. Visão Geral e Estratégia de Desenvolvimento

Este documento estabelece o guia prático, passo a passo, para a implementação completa do backend da aplicação. O plano é orientado pela **Arquitetura Limpa** e pelo **Paradigma da Orientação a Objetos (OOP)** detalhados em [Backend.md](file:///home/tiago/Documents/Controle%20Estatistico%20de%20Processos/docs/Backend/Backend.md), atendendo aos requisitos funcionais e não-funcionais definidos em [Requisitos.md](file:///home/tiago/Documents/Controle%20Estatistico%20de%20Processos/docs/Requisitos.md) e [Planejamento.md](file:///home/tiago/Documents/Controle%20Estatistico%20de%20Processos/docs/Planejamento.md).

### Filosofia: Abordagem de Dentro para Fora (*Inside-Out*)
Adotaremos uma abordagem de desenvolvimento que constrói primeiro o **coração matemático e as regras de domínio** (puro Python com NumPy/SciPy), garantindo 100% de estabilidade estatística e cobertura de testes antes de integrar banco de dados, frameworks web e WebSockets:

```text
┌────────────────────────────────────────────────────────────────────────┐
│ PASSO 1: DOMÍNIO PURO & MOTOR CEP (NumPy, OOP, Strategy, Nelson)       │
│  └─ Não depende de banco nem de frameworks; 100% testável via pytest.  │
├────────────────────────────────────────────────────────────────────────┤
│ PASSO 2: PERSISTÊNCIA & BANCO DE DADOS (MySQL 8.0, SQLAlchemy, Alembic)│
│  └─ Modelos ORM, migrações e implementação do Repository Pattern.      │
├────────────────────────────────────────────────────────────────────────┤
│ PASSO 3: SERVIÇOS DE APLICAÇÃO (Casos de Uso / Orquestração)           │
│  └─ ProcessamentoSubgrupoService, regras de negócio e transações.      │
├────────────────────────────────────────────────────────────────────────┤
│ PASSO 4: COMUNICAÇÃO EM TEMPO REAL (WebSockets & ConnectionManager)    │
│  └─ Observer Pattern, streaming in-memory e broadcast reativo.         │
├────────────────────────────────────────────────────────────────────────┤
│ PASSO 5: API REST & APRESENTAÇÃO (FastAPI, Routers, DTOs Pydantic)     │
│  └─ Endpoints HTTP, autenticação JWT, validação rigorosa de entrada.   │
├────────────────────────────────────────────────────────────────────────┤
│ PASSO 6: INTEGRAÇÃO, SCRIPTS DE CARGA & DEPLOY (Docker Compose)        │
│  └─ Testes E2E, simulador de linha de fábrica e contêineres finais.    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Fase 0: Setup do Ambiente e Infraestrutura Base

O objetivo desta fase é deixar o ambiente de desenvolvimento local padronizado e com o banco de dados rodando.

### 2.1. Estrutura Inicial de Diretórios
Criar a raiz do backend conforme a arquitetura modular:
```bash
mkdir -p backend/app/{core,domain/{entities,value_objects,strategies,rules,interfaces},application/{services,events},infrastructure/{persistence/{models,repositories},real_time},api/{v1/routers,schemas}}
mkdir -p backend/tests/{unit/{domain,cep},integration,e2e}
```

### 2.2. Dependências do Backend (`backend/requirements.txt`)
Especificar dependências com versões modernas:
```text
fastapi>=0.110.0,<1.0.0
uvicorn[standard]>=0.28.0,<1.0.0
pydantic>=2.6.0,<3.0.0
pydantic-settings>=2.2.0,<3.0.0
sqlalchemy>=2.0.28,<3.0.0
asyncmy>=0.2.9,<1.0.0
alembic>=1.13.0,<2.0.0
numpy>=1.26.0,<2.0.0
scipy>=1.12.0,<2.0.0
python-jose[cryptography]>=3.3.0
passlib[bcrypt]>=1.7.4
python-multipart>=0.0.9

# Dependências de Teste e Qualidade
pytest>=8.0.0
pytest-asyncio>=0.23.0
httpx>=0.27.0
ruff>=0.3.0
```

### 2.3. Configuração do Docker Compose (`docker-compose.yml`)
Configurar o serviço do MySQL 8.0 com suporte a UTF-8 e persistência:
* Criar volume para dados do MySQL.
* Definir credenciais: banco `cep_db`, usuário `cep_user`, senha e porta `3306`.
* Adicionar healthcheck para garantir que o banco está pronto antes de subir o backend.

### 2.4. Configurações de Ambiente (`backend/app/core/config.py`)
* Implementar classe `Settings` utilizando `pydantic-settings`.
* Variáveis essenciais: `DATABASE_URL` (`mysql+asyncmy://...`), `SECRET_KEY`, `ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`.

---

## 3. Fase 1: Domínio Puro & Motor de Cálculo Estatístico (OOP + TDD)

Nesta etapa, implementa-se a lógica matemática e os padrões de projeto sem qualquer dependência externa (banco de dados ou web).

### 3.1. Implementação dos Value Objects (`backend/app/domain/value_objects/`)
1. **`limites.py`**:
   * `LimitesControle` (imutável, com validação de invariante $LIC \le LC \le LSC$).
   * `LimitesEspecificacao` ($LSE, LIE$, Valor Nominal).
2. **`estatisticas.py`**:
   * `EstatisticasSubgrupo` ($\bar{X}, R, s$, valores brutos).
3. **`capacidade.py`**:
   * `IndicesCapacidade` ($C_p, C_{pk}$).
4. **`violacao.py`**:
   * `ViolacaoRegra` (código, descrição, número do subgrupo).

### 3.2. Implementação do Strategy Pattern para Cartas (`backend/app/domain/strategies/`)
1. **`base.py`**:
   * Interface abstrata `ICartaControleStrategy` (`calcular_estatisticas`, `calcular_limites`).
2. **`xr_chart.py`**:
   * Implementação de `CartaXRStrategy` para $n \le 10$, contendo tabelas de constantes $A_2, D_3, D_4, d_2$ e cálculo via NumPy.
3. **`xs_chart.py`**:
   * Implementação de `CartaXsStrategy` para $n > 10$, com constantes $A_3, B_3, B_4, c_4$.
4. **`imr_chart.py`**:
   * Implementação de `CartaIMRStrategy` para leituras individuais ($n = 1$) com cálculo de amplitude móvel ($MR$).
5. **`factory.py`**:
   * `CartaStrategyFactory` para resolver a estratégia correta a partir do tipo e tamanho amostral.

### 3.3. Implementação do Detector das 8 Regras de Nelson (`backend/app/domain/rules/`)
1. **`base.py`**:
   * Interface abstrata `IRegraNelson` (`codigo`, `descricao`, `avaliar`).
2. **`nelson_rules.py`**:
   * Implementar as regras fundamentais:
     * **Regra 1:** Ponto fora de $3\sigma$ (além de LSC/LIC).
     * **Regra 2:** 9 pontos consecutivos do mesmo lado da linha média (LC).
     * **Regra 3:** 6 pontos consecutivos com tendência contínua (estritamente crescentes ou decrescentes).
     * **Regra 4:** 14 pontos consecutivos alternando para cima e para baixo.
     * Demais regras de zona ($2\sigma$ e $1\sigma$).
3. **`detector.py`**:
   * `DetectorRegrasNelson`: Classe agregadora (Composite) que avalia todas as regras ativas sobre os últimos subgrupos.

### 3.4. Entidades Ricas de Domínio (`backend/app/domain/entities/`)
1. **`subgrupo.py`**:
   * Entidade `Subgrupo` com identidade UUID, timestamp, amarração à carta, lista de amostras e método `adicionar_violacoes()`.
2. **`carta.py`**:
   * Entidade `CartaControle` com validação de tamanho de subgrupo, limites correntes e métodos para anexar e inspecionar subgrupos.

### 3.5. Bateria de Testes Unitários de Domínio (`backend/tests/unit/`)
* Criar testes unitários com datasets de referência de livros de CEP (ex: Montgomery).
* Validar que as fórmulas de $\bar{X}, R, s$ e limites batem exatamente com os valores de referência.
* Validar que cada regra de Nelson dispara corretamente quando submetida a sequências anômalas simuladas.

---

## 4. Fase 2: Persistência & Modelagem Relacional (MySQL 8.0)

Com o domínio pronto e testado, construímos a camada de infraestrutura de persistência.

### 4.1. Conexão Assíncrona (`backend/app/core/database.py`)
* Configurar `create_async_engine` e `async_sessionmaker` utilizando driver `asyncmy`.
* Função geradora `get_db_session()` para injeção de dependência nas rotas e serviços.

### 4.2. Mapeamento ORM (`backend/app/infrastructure/persistence/models/`)
Criar os modelos SQLAlchemy mapeando o diagrama ER estabelecido:
* `UsuarioModel` (`id`, `nome`, `email`, `senha_hash`, `perfil`).
* `ProcessoModel` (`id`, `nome`, `codigo_linha`, `descricao`).
* `CartaControleModel` (`id`, `processo_id`, `tipo_carta`, `tamanho_subgrupo`, limites LSE/LIE, limites calculados LSC/LIC/LC, modo).
* `SubgrupoModel` (`id`, `carta_id`, `numero_subgrupo`, `timestamp`, `media_x`, `amplitude_r`, `desvio_s`, `fora_de_controle`, `regras_violadas` como JSON nativo MySQL).
* `AmostraItemModel` (`id`, `subgrupo_id`, `valor_medido`, `ordem_coleta`).
* `OcorrenciaCausaEspModel` (`id`, `subgrupo_id`, `operador_id`, `causa_raiz`, `acao_corretiva`).

### 4.3. Migrações com Alembic (`backend/alembic/`)
* Inicializar Alembic com template assíncrono (`alembic init -t async alembic`).
* Configurar `env.py` do Alembic para ler o `Base.metadata` e a URL do banco a partir das configurações.
* Gerar e executar a migração inicial:
  ```bash
  alembic revision --autogenerate -m "criar_tabelas_iniciais_cep"
  alembic upgrade head
  ```

### 4.4. Implementação do Repository Pattern (`backend/app/infrastructure/persistence/repositories/`)
* Definir contratos em `domain/interfaces/repositories.py` (`ICartaControleRepository`, `ISubgrupoRepository`).
* Implementar repositórios concretos em SQLAlchemy:
  * `MySQLCartaControleRepository`: Buscar por ID com histórico, salvar e atualizar limites.
  * `MySQLSubgrupoRepository`: Inserir subgrupo com itens de amostra em transação única.
* Criar testes de integração (`backend/tests/integration/`) contra o container MySQL.

---

## 5. Fase 3: Camada de Aplicação (Use Cases & Orquestração)

Implementação dos casos de uso que intermediam a comunicação entre API, Domínio e Persistência.

### 5.1. Orquestrador Principal: `ProcessamentoSubgrupoService`
Arquivo: `backend/app/application/services/processar_subgrupo.py`
Passo a passo da execução do serviço:
1. Validar e carregar a `CartaControle` pelo ID no repositório.
2. Validar se o quantitativo de amostras corresponde estritamente ao tamanho configurado na carta.
3. Instanciar a estratégia estatística apropriada através da `CartaStrategyFactory`.
4. Calcular métricas pontuais ($\bar{X}, R, s$).
5. Se a carta estiver em modo dinâmico, recalcular limites globais com base no histórico atualizado.
6. Executar o `DetectorRegrasNelson` sobre a janela móvel de médias.
7. Construir a entidade `Subgrupo` preenchendo status de controle e anomalias.
8. Persistir de forma atômica no banco de dados via repositório.
9. Notificar os observers registrados (ex: despachante de WebSocket).

### 5.2. Gestão de Cartas e Análise de Capacidade
* `GerenciarCartaService`: Criação de carta, validação de limites de especificação e associação com processo.
* `AnaliseCapacidadeService`: Cálculo dos índices $C_p$ e $C_{pk}$ com base no desvio estimado ($\sigma$) e tolerâncias (LSE/LIE).

---

## 6. Fase 4: Tempo Real Reativo (WebSockets Nativos In-Memory)

Implementação da infraestrutura de transmissão instantânea de subgrupos calculados para o frontend.

### 6.1. Gerenciador de Conexões em Memória (`ConnectionManager`)
Arquivo: `backend/app/infrastructure/real_time/connection_manager.py`
* Estrutura interna: `_active_connections: dict[str, list[WebSocket]]` (chaveada pelo UUID da carta).
* Métodos essenciais:
  * `connect(carta_id: str, websocket: WebSocket)`: Aceita a conexão e armazena na lista da carta.
  * `disconnect(carta_id: str, websocket: WebSocket)`: Remove a conexão de forma segura e faz limpeza de lista vazia.
  * `broadcast(carta_id: str, message: dict)`: Itera de forma assíncrona sobre as conexões da carta enviando o payload JSON via `send_json()`. Trata desconexões abruptas com `try/except`.

### 6.2. Implementação do Observer de Notificação
Arquivo: `backend/app/infrastructure/real_time/websocket_observer.py`
* Implementar interface `ISubgrupoObserver`.
* Ao receber o evento de novo subgrupo processado, formata o schema JSON acordado (`NOVO_SUBGRUPO_PROCESSADO`) e chama `await connection_manager.broadcast(carta_id, payload)`.

### 6.3. Endpoint WebSocket no FastAPI
Arquivo: `backend/app/api/v1/websocket.py`
* Rota `@router.websocket("/ws/cartas/{carta_id}")`.
* Fluxo: Handshake de conexão $\to$ registro no `ConnectionManager` $\to$ loop de escuta de `ping/pong` para manter o socket vivo $\to$ desconexão limpa no bloco `finally`.

---

## 7. Fase 5: Camada de Apresentação e API REST (FastAPI)

Construção das rotas HTTP, autenticação e validações com Pydantic v2.

### 7.1. Schemas DTO com Pydantic (`backend/app/api/schemas/`)
* `UsuarioCreate`, `UsuarioResponse`, `TokenResponse`.
* `CartaControleCreate`, `CartaControleResponse`.
* `AmostraIngestaoRequest` (validação de array de floats, min_items, max_items).
* `SubgrupoResponse`, `EstatisticasResponse`, `CapacidadeResponse`.

### 7.2. Autenticação e Segurança (`backend/app/api/v1/routers/auth.py`)
* Rota `POST /api/v1/auth/register`: Cadastro de usuário.
* Rota `POST /api/v1/auth/login`: Verificação de credenciais e emissão do JWT.
* Dependência `get_current_user` para proteção de rotas privadas.

### 7.3. Rotas de Cartas e Ingestão de Dados
1. **`cartas.py`**:
   * `POST /api/v1/cartas`: Cadastra nova carta de controle.
   * `GET /api/v1/cartas/{id}`: Retorna carta, limites atuais e histórico recente.
   * `GET /api/v1/cartas/{id}/capacidade`: Retorna índices $C_p$ e $C_{pk}$.
2. **`ingestao.py`**:
   * `POST /api/v1/cartas/{id}/amostras`: Endpoint principal que recebe o subgrupo JSON e dispara o pipeline completo.
   * `POST /api/v1/cartas/{id}/importar`: Rota de carga em lote via arquivo CSV/JSON para popular cartas a partir de dados históricos.

### 7.4. Configurações Globais da API (`backend/app/main.py`)
* Configuração de CORS (`CORSMiddleware`) liberando origens do frontend React.
* Handlers customizados para exceções de domínio (mapeando para códigos HTTP 400, 404, 422 adequados).
* Inclusão dos roteadores de API com prefixo `/api/v1`.

---

## 8. Fase 6: Validação Ponta a Ponta, Simulação e Containerização

Garantir o funcionamento integrado e testes com tráfego realista.

### 8.1. Script Simulador de Linha de Produção (`backend/scripts/simulador_iot.py`)
Criar um script em Python que:
1. Autentica na API e cria uma carta de controle de teste.
2. Gera números aleatórios baseados em uma distribuição normal ($\mu = 25.0, \sigma = 0.5$).
3. A cada 2 segundos, envia um payload JSON para `POST /api/v1/cartas/{id}/amostras`.
4. Em intervalos programados, injeta anomalias artificiais (ex: degrau na média ou ponto discrepante com $\pm 4\sigma$) para testar as Regras de Nelson.

### 8.2. Testes End-to-End (E2E)
* Teste automatizado com cliente WebSocket escutando a carta enquanto o endpoint REST recebe medições.
* Validar que a latência ponta a ponta desde a requisição REST até a chegada do pacote no WebSocket é inferior a 500 ms.

### 8.3. Containerização e Dockerfile Multi-Stage
Criar `backend/Dockerfile` otimizado para produção:
```dockerfile
FROM python:3.12-slim as builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

FROM python:3.12-slim
WORKDIR /app
COPY --from=builder /root/.local /root/.local
COPY . .
ENV PATH=/root/.local/bin:$PATH
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## 9. Checklist de Conclusão do Backend

A tabela abaixo serve como painel de controle do progresso da implementação:

| Fase | Etapa / Entregável | Critério de Aceite | Status |
| :---: | :--- | :--- | :---: |
| **0** | Setup de Ambiente & Docker | MySQL 8.0 rodando no Docker e dependências instaladas | ✅ Concluído |
| **1** | Value Objects & Entidades | Classes com invariantes de validação e dataclasses imutáveis | 🔲 Pendente |
| **1** | Motor CEP ($\bar{X}-R, \bar{X}-s, I-MR$) | Testes unitários com NumPy batendo 100% com dados tabelados | 🔲 Pendente |
| **1** | Detector das 8 Regras de Nelson | Testes unitários comprovando detecção precisa de anomalias | 🔲 Pendente |
| **2** | Modelos ORM & Migrações Alembic | Tabelas criadas no MySQL com JSON nativo e FKs | 🔲 Pendente |
| **2** | Repositórios SQLAlchemy | Operações de leitura/escrita assíncronas validadas | 🔲 Pendente |
| **3** | `ProcessamentoSubgrupoService` | Fluxo orquestrado integrando motor, domínio e persistência | 🔲 Pendente |
| **4** | `ConnectionManager` & WebSocket | Conexão simultânea e broadcast de evento JSON validado | 🔲 Pendente |
| **5** | Schemas Pydantic & Routers REST | Endpoints `/cartas`, `/amostras` e `/auth` operacionais | 🔲 Pendente |
| **6** | Script Simulador & Testes E2E | Emissão contínua a cada 2s com visualização de anomalias | 🔲 Pendente |
| **6** | Dockerfile & Docker Compose | Backend e Banco subindo coordenados via `docker compose up` | 🔲 Pendente |
