# FEAT-00: Setup do Ambiente e Infraestrutura Base

* **Fase do Roadmap:** [Fase 0 - Setup do Ambiente e Infraestrutura Base](../Roadmap.md#2-fase-0-setup-do-ambiente-e-infraestrutura-base)
* **Status:** ✅ Concluído
* **Data de Execução:** 03/09/2026

---

## 1. Visão Geral e Contexto

Esta alteração estabelece o alicerce de desenvolvimento para o backend do **Sistema de Controle Estatístico de Processos (CEP)**. O objetivo foi padronizar o ambiente local, criar a estrutura de diretórios segundo a **Clean Architecture**, configurar o container de banco de dados relacional **MySQL 8.0** com persistência e healthcheck, isolar as dependências em ambiente virtual e garantir que os testes automatizados básicos e checagens de linter estejam 100% operacionais.

---

## 2. Alterações Realizadas

### 2.1. Estrutura Modular de Diretórios
Foi criada a árvore de diretórios do backend conforme a arquitetura modular em camadas orientada a objetos (Clean Architecture / Ports & Adapters), com arquivos `__init__.py` adicionados para qualificar cada módulo como pacote Python:

* `backend/app/core/`: Configurações globais e gerenciamento de banco.
* `backend/app/domain/`: Núcleo puro de regras estatísticas e de negócio:
  * `entities/`: Entidades de domínio ricas (`CartaControle`, `Subgrupo`, etc.).
  * `value_objects/`: Objetos de valor imutáveis (`LimitesControle`, `EstatisticasSubgrupo`, etc.).
  * `strategies/`: Implementações do Strategy Pattern para cartas ($\bar{X}-R, \bar{X}-s, I-MR$).
  * `rules/`: Specification Pattern para as 8 Regras de Nelson.
  * `interfaces/`: Contratos abstratos (repositórios e observers).
* `backend/app/application/`: Casos de uso e orquestração (`services`, `events`).
* `backend/app/infrastructure/`: Adaptadores externos:
  * `persistence/`: Modelos ORM SQLAlchemy e implementações concretas de repositórios.
  * `real_time/`: Gerenciador de conexões WebSocket em memória (`ConnectionManager`).
* `backend/app/api/`: Camada de apresentação REST e WebSocket (rotas `v1/routers` e esquemas Pydantic `schemas`).
* `backend/tests/`: Bateria de testes automatizados (`unit/domain`, `unit/cep`, `integration`, `e2e`).

### 2.2. Gestão de Dependências e Ambiente Virtual
* Criado o arquivo `backend/requirements.txt` especificando versões modernas e compatíveis:
  * **Framework Web & Validação:** `fastapi`, `uvicorn[standard]`, `pydantic`, `pydantic-settings`.
  * **Persistência Assíncrona:** `sqlalchemy`, `asyncmy`, `alembic`.
  * **Cálculo Científico / CEP:** `numpy`, `scipy`.
  * **Segurança & Criptografia:** `python-jose[cryptography]`, `passlib[bcrypt]`, `python-multipart`.
  * **Testes & Qualidade:** `pytest`, `pytest-asyncio`, `httpx`, `ruff`.
* Criado o ambiente virtual Python em `backend/.venv` e executada a instalação completa das dependências.

### 2.3. Configuração do Docker Compose & MySQL 8.0
* Criado o arquivo `docker-compose.yml` contendo o serviço de banco de dados `db`:
  * Imagem oficial: `mysql:8.0`.
  * Suporte nativo a UTF-8: `--character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci`.
  * Persistência de dados: volume nomeado `cep_mysql_data`.
  * Configuração de credenciais: usuário `cep_user`, banco `cep_db`, porta `3306:3306`.
  * Healthcheck integrado via `mysqladmin ping` para garantir que o serviço só seja considerado ativo quando o MySQL estiver pronto para receber conexões.
* Container `cep_mysql` iniciado com sucesso e validado em status `healthy`.

### 2.4. Configurações de Ambiente & Segurança
* Criado o módulo `backend/app/core/config.py` utilizando `pydantic-settings` (`Settings`):
  * Carregamento assíncrono e tipado de variáveis a partir de arquivos `.env`.
  * Definição de `DATABASE_URL` padrão (`mysql+asyncmy://cep_user:cep_password@localhost:3306/cep_db`).
  * Definição de parâmetros de segurança JWT (`SECRET_KEY`, `ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`).
  * Configuração de origens CORS liberadas para desenvolvimento.
* Criados os arquivos `.env.example` e `.env` na raiz do projeto.
* Criado o arquivo `.gitignore` abrangente para Python, Docker, ambientes virtuais, testes e futuros módulos de frontend.

### 2.5. Testes Automatizados e Qualidade de Código
* Criado o arquivo `pytest.ini` configurando descoberta de testes e modo `asyncio_mode = auto`.
* Criado teste unitário `backend/tests/unit/test_config.py` para validar a carga correta das configurações da aplicação.
* Criado teste de integração `backend/tests/integration/test_database_connection.py` executando uma consulta real assíncrona contra o container MySQL via SQLAlchemy + driver `asyncmy`.
* Validada a formatação e conformidade das regras PEP8 com o linter `ruff`.

---

## 3. Arquivos Criados e Modificados

| Arquivo | Ação | Descrição |
| :--- | :---: | :--- |
| `backend/requirements.txt` | Criado | Especificação de dependências do backend |
| `docker-compose.yml` | Criado | Configuração do container MySQL 8.0 com volume e healthcheck |
| `.env.example` | Criado | Modelo de variáveis de ambiente do projeto |
| `.env` | Criado | Configuração local ativa para banco de dados e JWT |
| `.gitignore` | Criado | Regras de exclusão para Git |
| `pytest.ini` | Criado | Configuração de execução do Pytest e caminhos Python |
| `backend/app/core/config.py` | Criado | Classe `Settings` via Pydantic Settings |
| `backend/tests/unit/test_config.py` | Criado | Teste unitário de carregamento de configurações |
| `backend/tests/integration/test_database_connection.py` | Criado | Teste de integração assíncrono com o MySQL 8.0 |
| `docs/Backend/Roadmap.md` | Modificado | Atualização do status da Fase 0 para Concluído |

---

## 4. Resultados de Validação

### 4.1. Execução de Testes Automatizados (`pytest`)
```text
backend/tests/integration/test_database_connection.py .                  [ 50%]
backend/tests/unit/test_config.py .                                      [100%]

============================== 2 passed in 0.40s ===============================
```

### 4.2. Checagem de Qualidade de Código (`ruff`)
```text
Found 0 errors.
```

### 4.3. Status do Container Docker
```text
CONTAINER ID   IMAGE       STATUS                    PORTS                               NAMES
c9918dd09ce5   mysql:8.0   Up 18 seconds (healthy)   0.0.0.0:3306->3306/tcp, 33060/tcp   cep_mysql
```

---

## 5. Próximos Passos

Com a infraestrutura base e o ambiente de desenvolvimento validados, a próxima etapa é a **Fase 1: Domínio Puro & Motor de Cálculo Estatístico (OOP + TDD)**:
1. Implementação dos Value Objects (`LimitesControle`, `EstatisticasSubgrupo`, `IndicesCapacidade`, `ViolacaoRegra`).
2. Implementação do Strategy Pattern para as cartas de controle ($\bar{X}-R, \bar{X}-s, I-MR$).
3. Implementação do detector das 8 Regras de Nelson via Specification / Composite Pattern.
4. Entidades ricas de domínio (`CartaControle`, `Subgrupo`).
5. Bateria extensiva de testes unitários baseados em dados de referência da literatura de CEP (ex: Montgomery).
