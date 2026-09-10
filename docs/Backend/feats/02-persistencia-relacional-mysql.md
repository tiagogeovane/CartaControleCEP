# FEAT-02: Persistência Relacional & Repositórios (MySQL 8.0)

* **Fase do Roadmap:** [Fase 2 - Persistência & Modelagem Relacional (MySQL 8.0)](../Roadmap.md#4-fase-2-persistência--modelagem-relacional-mysql-80)
* **Status:** ✅ Concluído
* **Data de Execução:** 03/09/2026

---

## 1. Visão Geral e Contexto

Esta entrega implementa a camada de infraestrutura de persistência de dados do **Sistema de Controle Estatístico de Processos (CEP)**, conectando o núcleo de domínio matemático puro implementado na [FEAT-01](./01-dominio-motor-cep.md) ao banco de dados relacional **MySQL 8.0**.

A modelagem segue rigorosamente a **Clean Architecture** e o **Princípio da Inversão de Dependência (DIP)**: as entidades de domínio continuam completamente livres de qualquer dependência ou acoplamento com o ORM SQLAlchemy ou drivers de banco. Toda a responsabilidade de mapeamento objeto-relacional, gerenciamento de transações ACID e consultas assíncronas reside na camada de infraestrutura, exposta através de implementações concretas dos contratos de repositório (`ICartaControleRepository`, `ISubgrupoRepository`, `IProcessoRepository` e `IUsuarioRepository`).

---

## 2. O que Foi Implementado

### 2.1. Conexão Assíncrona e Sessão de Banco (`backend/app/core/database.py`)
* Configuração do motor assíncrono `create_async_engine` utilizando o driver de alta performance `asyncmy` sobre o MySQL 8.0 (`settings.DATABASE_URL`).
* Pool de conexões otimizado com `pool_pre_ping=True`, `pool_size=10` e `max_overflow=20` para lidar com requisições concorrentes de telemetria industrial.
* Fábrica de sessões assíncronas `async_sessionmaker` configurada com `expire_on_commit=False`.
* Gerador `get_db_session()` para injeção de dependência assíncrona nas rotas do FastAPI e serviços de aplicação, com bloco transacional seguro (`try/commit/except rollback/finally close`).

---

### 2.2. Modelagem Relacional ORM SQLAlchemy 2.0 (`backend/app/infrastructure/persistence/models/`)
Implementação moderna utilizando anotações de tipo `Mapped` e `mapped_column` do SQLAlchemy 2.0, com chaves estrangeiras com regras estritas de cascata e carregamento assíncrono preemptivo (`lazy="selectin"`):

1. **`Base`** (`base.py`): Classe base declarativa herdando de `DeclarativeBase`.
2. **`UsuarioModel`** (`usuario.py`):
   * Tabela `usuarios`.
   * Campos: `id` (VARCHAR(36), PK), `nome` (VARCHAR(150)), `email` (VARCHAR(150), UNIQUE, INDEX), `senha_hash` (VARCHAR(255)), `perfil` (VARCHAR(50), padrão `OPERADOR`).
3. **`ProcessoModel`** (`processo.py`):
   * Tabela `processos`.
   * Campos: `id` (VARCHAR(36), PK), `nome` (VARCHAR(150)), `codigo_linha` (VARCHAR(50), INDEX), `descricao` (TEXT).
   * Relacionamento `cartas` com exclusão em cascata.
4. **`CartaControleModel`** (`carta.py`):
   * Tabela `cartas_controle`.
   * Campos: `id` (VARCHAR(36), PK), `processo_id` (FK -> `processos.id`, CASCADE, INDEX), `tipo_carta` (VARCHAR(30)), `tamanho_subgrupo` (INT).
   * Limites de especificação: `limite_superior_esp`, `limite_inferior_esp`, `valor_nominal` (FLOAT).
   * Limites de controle calculados: `lsc_calculado`, `lic_calculado`, `lc_calculado`, `sigma_estimado` (FLOAT).
   * `modo_limites` (VARCHAR(20), padrão `DINAMICO`).
   * Relacionamento ordenado com `subgrupos`.
5. **`SubgrupoModel`** (`subgrupo.py`):
   * Tabela `subgrupos`.
   * Campos: `id` (VARCHAR(36), PK), `carta_id` (FK -> `cartas_controle.id`, CASCADE, INDEX), `numero_subgrupo` (INT, INDEX), `timestamp` (DATETIME(timezone=True)).
   * Estatísticas: `media_x`, `amplitude_r`, `desvio_s` (FLOAT), `fora_de_controle` (BOOLEAN).
   * Coluna `regras_violadas`: Mapeada como `JSON().with_variant(MySQLJSON, "mysql")` para persistência nativa e consultas JSON de alta performance no MySQL 8.0.
   * Restrição de unicidade: `UniqueConstraint("carta_id", "numero_subgrupo", name="uq_subgrupo_carta_numero")`.
   * Relacionamentos com `amostras` e `ocorrencias`.
6. **`AmostraItemModel`** (`amostra.py`):
   * Tabela `amostras_itens`.
   * Campos: `id` (VARCHAR(36), PK), `subgrupo_id` (FK -> `subgrupos.id`, CASCADE, INDEX), `valor_medido` (FLOAT), `ordem_coleta` (INT).
7. **`OcorrenciaCausaEspModel`** (`ocorrencia.py`):
   * Tabela `ocorrencias_causa_esp`.
   * Campos: `id` (VARCHAR(36), PK), `subgrupo_id` (FK -> `subgrupos.id`, CASCADE, INDEX), `operador_id` (FK -> `usuarios.id`, SET NULL, INDEX), `regra_violada` (VARCHAR(50)), `causa_raiz_identificada` (TEXT), `acao_corretiva_tomada` (TEXT), `timestamp_resolucao` (DATETIME).

---

### 2.3. Mappers Bidirecionais de Domínio (`backend/app/infrastructure/persistence/mappers.py`)
Módulo dedicado para isolar e traduzir modelos ORM em entidades puras e vice-versa:

* **`subgrupo_model_to_entity` & `subgrupo_entity_to_model`**: Converte os registros relacionais de subgrupo e suas medições filhas em entidades `Subgrupo` com seus Value Objects `EstatisticasSubgrupo` e lista de `ViolacaoRegra`, garantindo consistência de fuso horário UTC.
* **`carta_model_to_entity` & `carta_entity_to_model`**: Reconstrói a entidade agregadora `CartaControle`, restaurando `LimitesEspecificacao` e `LimitesControle` (incluindo `sigma_estimado`) e histórico ordenado de subgrupos.
* **`processo_model_to_entity` & `processo_entity_to_model`**: Mapeamento limpo da entidade `Processo`.
* **`usuario_model_to_entity` & `usuario_entity_to_model`**: Mapeamento da entidade `Usuario`.

---

### 2.4. Migrações de Banco com Alembic (`backend/alembic/`)
* Inicialização do ambiente de migração com suporte assíncrono (`alembic init -t async backend/alembic`).
* Configuração de `backend/alembic/env.py` para:
  1. Adicionar o diretório `backend` ao `sys.path`.
  2. Ler a conexão oficial de `settings.DATABASE_URL`.
  3. Vincular o `target_metadata` ao `Base.metadata` de todos os modelos unificados.
* Geração e aplicação da migração inicial:
  * **Revisão:** `656b5cdd1144` (`656b5cdd1144_criar_tabelas_iniciais_cep.py`).
  * **Execução:** `alembic upgrade head` executado com sucesso no MySQL 8.0, criando as 6 tabelas oficiais com todas as FKs, índices e tipos JSON nativos.

---

### 2.5. Implementação do Repository Pattern (`backend/app/infrastructure/persistence/repositories/`)
Implementação concreta dos contratos assíncronos de repositório:

* **`MySQLCartaControleRepository`** (`carta_repository.py`):
  * `obter_por_id`: Carrega a carta com histórico de subgrupos e medições via `selectinload` em única operação assíncrona.
  * `salvar`: Persiste nova carta ou atualiza atributos e limites de carta existente.
  * `listar_todas`: Lista cartas do sistema com suporte a filtro opcional por processo.
  * `atualizar_limites`: Atualização pontual e rápida dos limites estatísticos calculados sem necessidade de recarregar entidades completas.
* **`MySQLSubgrupoRepository`** (`subgrupo_repository.py`):
  * `salvar`: Insere o subgrupo e todas as medições individuais (`amostras_itens`) em transação atômica única.
  * `salvar_em_lote`: Inserção em lote para importação em massa de dados históricos.
  * `listar_por_carta`: Consulta histórica com ordenação cronológica e suporte a limite (`limite=N` para recuperar a janela dos N subgrupos mais recentes para o detector de regras de Nelson).
* **`MySQLProcessoRepository`** (`processo_repository.py`):
  * Gestão completa de linhas produtivas (`obter_por_id`, `salvar`, `listar_todos`).
* **`MySQLUsuarioRepository`** (`usuario_repository.py`):
  * Gestão de usuários (`obter_por_id`, `obter_por_email`, `salvar`, `listar_todos`).

---

## 3. Decisões Técnicas e Incidentes Resolvidos

### 3.1. Detecção de Tabelas Órfãs e Consentimento Seguro
Durante a inicialização do Alembic, foi identificado que o banco local continha tabelas residuais de uma prova de conceito anterior com 0 registros e uma revisão órfã na tabela `alembic_version` (`0bffbec0b55b`). 

Em estrito cumprimento das diretrizes de prevenção contra perda de dados acidental (*accidental-data-loss-prevention*), foi solicitada a autorização explícita do usuário antes de realizar o reset das tabelas vazias locais. Após a aprovação do usuário, o schema foi limpo e o Alembic gerou a migração oficial `656b5cdd1144` a partir dos modelos canônicos da Fase 2.

### 3.2. Formatação e Linter Estrito (Ruff)
Todos os arquivos gerados e configurados foram auditados e formatados conforme as regras do Ruff (ordenamento de imports, modernização de type annotations com `X | Y` do Python 3.10+ e remoção de pass desnecessários), atingindo 0 erros no comando `ruff check .`.

---

## 4. Relação Completa de Arquivos Criados e Modificados

| Arquivo | Ação | Responsabilidade |
| :--- | :---: | :--- |
| `backend/app/core/database.py` | Criado | Motor assíncrono `create_async_engine`, sessão e generator `get_db_session()` |
| `backend/app/domain/entities/usuario.py` | Criado | Entidade de domínio `Usuario` com validação de nome, e-mail e hash |
| `backend/app/domain/entities/__init__.py` | Modificado | Exportação da entidade `Usuario` |
| `backend/app/domain/interfaces/repositories.py` | Modificado | Inclusão do contrato `IUsuarioRepository` |
| `backend/app/domain/interfaces/__init__.py` | Modificado | Exportação do contrato `IUsuarioRepository` |
| `backend/app/infrastructure/persistence/models/base.py` | Criado | `DeclarativeBase` do SQLAlchemy 2.0 |
| `backend/app/infrastructure/persistence/models/usuario.py` | Criado | Modelo ORM `UsuarioModel` (`usuarios`) |
| `backend/app/infrastructure/persistence/models/processo.py` | Criado | Modelo ORM `ProcessoModel` (`processos`) |
| `backend/app/infrastructure/persistence/models/carta.py` | Criado | Modelo ORM `CartaControleModel` (`cartas_controle`) |
| `backend/app/infrastructure/persistence/models/subgrupo.py` | Criado | Modelo ORM `SubgrupoModel` com JSON nativo e FK CASCADE |
| `backend/app/infrastructure/persistence/models/amostra.py` | Criado | Modelo ORM `AmostraItemModel` (`amostras_itens`) |
| `backend/app/infrastructure/persistence/models/ocorrencia.py` | Criado | Modelo ORM `OcorrenciaCausaEspModel` (`ocorrencias_causa_esp`) |
| `backend/app/infrastructure/persistence/models/__init__.py` | Modificado | Exportação unificada dos modelos ORM |
| `backend/app/infrastructure/persistence/mappers.py` | Criado | Tradução bidirecional desacoplada entre entidades e modelos ORM |
| `backend/app/infrastructure/persistence/repositories/carta_repository.py` | Criado | `MySQLCartaControleRepository` |
| `backend/app/infrastructure/persistence/repositories/subgrupo_repository.py` | Criado | `MySQLSubgrupoRepository` |
| `backend/app/infrastructure/persistence/repositories/processo_repository.py` | Criado | `MySQLProcessoRepository` |
| `backend/app/infrastructure/persistence/repositories/usuario_repository.py` | Criado | `MySQLUsuarioRepository` |
| `backend/app/infrastructure/persistence/repositories/__init__.py` | Criado | Exportação unificada dos repositórios |
| `backend/alembic.ini` | Criado | Configuração do Alembic |
| `backend/alembic/env.py` | Criado | Configuração assíncrona do Alembic com `Base.metadata` e `settings` |
| `backend/alembic/versions/656b5cdd1144_criar_tabelas_iniciais_cep.py` | Criado | Migração inicial de schema |
| `backend/tests/integration/test_database_connection.py` | Modificado | Teste de conexão e teste do generator `get_db_session()` |
| `backend/tests/integration/test_repositories.py` | Criado | 5 testes de integração com MySQL 8.0 para todos os repositórios |
| `backend/tests/unit/domain/test_entities.py` | Modificado | Inclusão de testes da entidade `Usuario` |
| `backend/tests/unit/domain/test_interfaces.py` | Modificado | Inclusão de testes de assinatura para `IUsuarioRepository` |
| `docs/Backend/Roadmap.md` | Modificado | Atualização dos checkboxes da Fase 2 para Concluído |
| `docs/Backend/feats/README.md` | Modificado | Atualização do índice de features marcando FEAT-02 como concluída |
| `docs/Backend/feats/02-persistencia-relacional-mysql.md` | Criado | Este documento descritivo |

---

## 5. Resultados de Validação

### 5.1. Execução de Testes Automatizados (`pytest`)
Execução completa dos testes unitários e de integração contra o container MySQL 8.0:

```text
============================= test session starts ==============================
platform linux -- Python 3.10.12, pytest-9.1.1, pluggy-1.6.0
rootdir: /home/tiago/Documents/Controle Estatistico de Processos
configfile: pytest.ini
testpaths: backend/tests
plugins: cov-7.1.0, asyncio-1.4.0, anyio-4.15.0
asyncio: mode=auto, debug=False
collected 114 items

backend/tests/integration/test_database_connection.py ..                 [  1%]
backend/tests/integration/test_repositories.py .....                     [  6%]
backend/tests/unit/cep/test_capacidade.py ......                         [ 11%]
backend/tests/unit/cep/test_imr_chart.py ..........                      [ 20%]
backend/tests/unit/cep/test_nelson_rules.py .......................      [ 40%]
backend/tests/unit/cep/test_xr_chart.py ..........                       [ 49%]
backend/tests/unit/cep/test_xs_chart.py ..........                       [ 57%]
backend/tests/unit/domain/test_entities.py ............................  [ 82%]
backend/tests/unit/domain/test_interfaces.py ...                         [ 85%]
backend/tests/unit/domain/test_value_objects.py ................         [ 99%]
backend/tests/unit/test_config.py .                                      [100%]

================================ tests coverage ================================
TOTAL: 1077 statements, 28 missed, 97% COVERAGE
============================= 114 passed in 2.50s ==============================
```

### 5.2. Checagem de Qualidade de Código (`ruff`)
```text
./backend/.venv/bin/ruff check .
All checks passed!
```

---

## 6. O que Ainda Falta / Próximos Passos

Com a conclusão da **Fase 2**, toda a infraestrutura de persistência relacional está implementada, testada e validada no MySQL 8.0.

O próximo passo no desenvolvimento é a **Fase 3: Camada de Aplicação (Use Cases & Orquestração)**:
1. **`ProcessamentoSubgrupoService` (`backend/app/application/services/processar_subgrupo.py`):**
   * Orquestrador central que recebe a telemetria bruta da carta, valida conformidade do subgrupo [RN02], invoca a estratégia estatística (`CartaStrategyFactory`), avalia as 8 regras de Nelson (`DetectorRegrasNelson`), recalcula limites dinâmicos se aplicável, persiste via repositório e despacha notificação reativa via Observer.
2. **`GerenciarCartaService` (`backend/app/application/services/gerenciar_carta.py`):**
   * Cadastro, configuração de tolerâncias de engenharia e amarração a processos.
3. **`AnaliseCapacidadeService` (`backend/app/application/services/analise_capacidade.py`):**
   * Cálculo e emissão dos relatórios de índices de capacidade do processo ($C_p, C_{pk}, C_{pu}, C_{pl}$).
4. **Eventos de Aplicação (`backend/app/application/events/subgrupo_events.py`):**
   * Definição do payload do evento de subgrupo processado que alimentará os WebSockets na Fase 4.
