# Sistema de Controle Estatístico de Processos (CEP / SPC) em Tempo Real

[![Python](https://img.shields.io/badge/Python-3.12+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1?style=for-the-badge&logo=mysql&logoColor=white)](https://www.mysql.com/)
[![Docker](https://img.shields.io/badge/Docker-Enabled-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![NumPy](https://img.shields.io/badge/NumPy-Scientific-013243?style=for-the-badge&logo=numpy&logoColor=white)](https://numpy.org/)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)

Plataforma completa e reativa para **Controle Estatístico de Processos (CEP / *Statistical Process Control*)**, projetada para monitorar variáveis industriais e operacionais em tempo real. O sistema processa subgrupos amostrais em microssegundos, calcula cartas de controle estatísticas, detecta causas especiais de variação através das **8 Regras de Nelson**, avalia a capacidade do processo ($C_p$ e $C_{pk}$) e propaga as atualizações instantaneamente para a interface web via **WebSockets nativos in-memory**.

---

## 📌 Sumário

- [Visão Geral](#-visão-geral)
- [Funcionalidades Principais](#-funcionalidades-principais)
- [Arquitetura do Sistema](#-arquitetura-do-sistema)
  - [Padrões de Projeto (Backend OOP)](#padrões-de-projeto-backend-oop)
- [Stack Tecnológica](#-stack-tecnológica)
- [Estrutura do Repositório](#-estrutura-do-repositório)
- [Como Executar o Projeto](#-como-executar-o-projeto)
  - [Pré-requisitos](#pré-requisitos)
  - [Passo a Passo](#passo-a-passo)
- [Roadmap de Desenvolvimento](#-roadmap-de-desenvolvimento)
- [Documentação Técnica](#-documentação-técnica)
- [Autor](#-autor)

---

## 🎯 Visão Geral

Na indústria moderna e em linhas de produção enxutas, variações indesejadas no processo geram retrabalho, sucata e custos operacionais elevados. Este projeto visa oferecer um pipeline de dados reativo de ponta a ponta:

1. **Ingestão Contínua:** Coleta dados de subgrupos amostrais via requisições HTTP REST, upload em lote (CSV/JSON) ou sensores industriais (IoT).
2. **Processamento Científico Imediato:** O motor em Python com NumPy e SciPy calcula médias ($\bar{X}$), amplitudes ($R$) ou desvios padrão ($s$) em tempo sub-milissegundo (< 50 ms).
3. **Análise de Estabilidade:** Aplica automaticamente as 8 Regras de Nelson para identificar causas especiais de instabilidade antes que desvios graves aconteçam.
4. **Transmissão Reativa:** O backend despacha o subgrupo processado via WebSocket em memória para o frontend, permitindo que a interface gráfica (Apache ECharts) anexe o novo ponto sem recarregar a tela.

---

## 🚀 Funcionalidades Principais

- **Suporte a Múltiplas Cartas de Controle:**
  - **Carta $\bar{X}-R$:** Para subgrupos amostrais pequenos ($n \le 10$).
  - **Carta $\bar{X}-s$:** Para subgrupos de maior dimensão ($n > 10$).
  - **Carta $I-MR$:** Para leituras individuais contínuas ($n = 1$).
  - *Extensível para cartas por atributos ($p, np, c, u$).*
- **Detecção Automática de Anomalias (8 Regras de Nelson):**
  - Regra 1: Ponto além dos limites de $3\sigma$ ($LSC$ ou $LIC$).
  - Regra 2: 9 pontos consecutivos no mesmo lado da Linha Central ($LC$).
  - Regra 3: 6 pontos consecutivos estritamente crescentes ou decrescentes.
  - Regra 4: 14 pontos alternando sucessivamente para cima e para baixo.
  - Demais regras de zonas estatísticas ($2\sigma$ e $1\sigma$).
- **Estudo de Capacidade do Processo ($C_p$ e $C_{pk}$):**
  - Avaliação automática da centralização e dispersão estatística em relação às tolerâncias de engenharia ($LSE$ e $LIE$).
- **Streaming em Tempo Real:**
  - Conexão WebSocket nativa por carta (`/ws/cartas/{carta_id}`) sem necessidade de corretores externos (Zero-Redis).
- **Importação de Dados Históricos:**
  - Carga em lote de dados pré-coletados em formatos CSV ou JSON para cálculo imediato do histórico.

---

## 🏗 Arquitetura do Sistema

O projeto adota os preceitos da **Arquitetura Limpa (*Clean Architecture / Ports & Adapters*)** e do **Paradigma Orientado a Objetos (OOP)** rico:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React + Vite)                         │
│  - Dashboards com Apache ECharts (atualização incremental a 60 FPS)    │
│  - Limites de controle (LSC, LC, LIC) e tolerâncias (LSE, LIE)         │
│  - WebSocket direto para escuta contínua de novos subgrupos            │
└───────────────────────────────────▲────────────────────────────────────┘
                                    │ HTTP (REST) / WebSocket Direto
┌───────────────────────────────────▼────────────────────────────────────┐
│                    API GATEWAY & BACKEND (FastAPI)                     │
│  - Ingestão de Dados (POST /api/v1/cartas/{id}/amostras)               │
│  - Autenticação e Autorização JWT                                      │
│  - ConnectionManager (WebSockets in-memory gerenciados pelo FastAPI)   │
└───────────────────────▲───────────────────────▲────────────────────────┘
                        │                       │ Broadcast imediato
┌───────────────────────▼────────────────┐      │ via WebSocket
│           DOMÍNIO & MOTOR CEP          │      │
│  - NumPy / SciPy (cálculos em µs)      │──────┘
│  - Detector das 8 Regras de Nelson     │
└───────────────────────┬────────────────┘
                        │
┌───────────────────────▼────────────────────────────────────────────────┐
│                       BANCO DE DADOS (MySQL 8.0)                       │
│  - SQLAlchemy 2.0 (Assíncrono com asyncmy) + Alembic                   │
│  - Suporte a JSON nativo (para guardar regras violadas)                │
└────────────────────────────────────────────────────────────────────────┘
```

### Padrões de Projeto (Backend OOP)

- **Strategy Pattern:** Interface `ICartaControleStrategy` com implementações desacopladas (`CartaXRStrategy`, `CartaXsStrategy`, `CartaIMRStrategy`).
- **Factory Pattern:** `CartaStrategyFactory` para instanciação dinâmica e segura conforme os parâmetros da carta.
- **Specification / Composite Pattern:** Decomposição das 8 Regras de Nelson na interface `IRegraNelson` avaliadas em lote por `DetectorRegrasNelson`.
- **Value Objects Imutáveis:** `LimitesControle`, `EstatisticasSubgrupo` e `IndicesCapacidade` com garantia de invariantes de estado.
- **Repository Pattern:** `ICartaControleRepository` e `ISubgrupoRepository` desacoplando as regras de negócio dos detalhes do banco de dados.
- **Observer Pattern:** Notificação de novos subgrupos via `ISubgrupoObserver` implementado pelo despachante de WebSockets.

---

## 🛠 Stack Tecnológica

| Camada | Tecnologia / Biblioteca | Finalidade |
| :--- | :--- | :--- |
| **Backend & API** | Python 3.12+, FastAPI, Uvicorn, Pydantic v2 | Framework web assíncrono e validação tipada de esquemas |
| **Motor Estatístico** | NumPy, SciPy | Algoritmos de cálculo de CEP, constantes tabeladas e dispersão |
| **Persistência** | MySQL 8.0, SQLAlchemy 2.0, asyncmy, Alembic | Banco relacional com campos JSON e migrações versionadas |
| **Segurança** | python-jose, passlib (bcrypt) | Hash de credenciais e autenticação via tokens JWT |
| **Tempo Real** | WebSockets (In-Memory ConnectionManager) | Notificação *push* sem dependência de brokers externos |
| **Frontend** | React, Vite, TypeScript, Tailwind CSS, Apache ECharts | Interface interativa com renderização incremental a 60 FPS |
| **Infra & DevOps** | Docker, Docker Compose, Pytest, Ruff | Padronização de ambientes, testes e validação de linter |

---

## 📂 Estrutura do Repositório

```text
Controle-Estatistico-de-Processos/
├── docker-compose.yml             # Serviço MySQL 8.0 com healthcheck e volume persistente
├── pytest.ini                    # Configuração de descoberta assíncrona de testes
├── .env.example                  # Template de variáveis de ambiente
├── docs/                         # Documentação completa do projeto
│   ├── Planejamento.md           # Planejamento arquitetural geral e modelo ER
│   ├── Requisitos.md             # Especificação de Requisitos (SRS) e Regras de Negócio
│   └── Backend/
│       ├── Backend.md            # Arquitetura orientada a objetos (UML, SOLID, GoF)
│       ├── Roadmap.md            # Roadmap de desenvolvimento em 6 fases
│       └── feats/                # Histórico versionado de cada entrega/feature
├── backend/
│   ├── requirements.txt          # Dependências do backend Python
│   ├── app/
│   │   ├── core/                 # Configurações (Pydantic Settings) e banco de dados
│   │   ├── domain/               # Domínio Puro (Entities, Value Objects, Strategies, Rules)
│   │   ├── application/          # Casos de Uso (Services, Events)
│   │   ├── infrastructure/       # Repositórios SQLAlchemy e WebSockets
│   │   └── api/                  # Routers FastAPI e Schemas Pydantic v2
│   └── tests/
│       ├── unit/                 # Testes unitários isolados (sem banco)
│       └── integration/          # Testes de integração com MySQL 8.0
└── frontend/                     # Aplicação React + Vite (Fase subsequente)
```

---

## 💻 Como Executar o Projeto

### Pré-requisitos
- [Git](https://git-scm.com/)
- [Python 3.12+](https://www.python.org/)
- [Docker](https://www.docker.com/) e [Docker Compose](https://docs.docker.com/compose/)

### Passo a Passo

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/TiagoUNB/Controle-Estatistico-de-Processos.git
   cd Controle-Estatistico-de-Processos
   ```

2. **Configure as variáveis de ambiente:**
   ```bash
   cp .env.example .env
   ```

3. **Inicie o banco de dados MySQL via Docker Compose:**
   ```bash
   docker compose up -d db
   ```
   *O container subirá com healthcheck configurado na porta `3306`.*

4. **Crie e ative o ambiente virtual Python:**
   ```bash
   cd backend
   python3 -m venv .venv
   source .venv/bin/activate   # No Windows: .venv\Scripts\activate
   ```

5. **Instale as dependências:**
   ```bash
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

6. **Execute os testes automatizados:**
   ```bash
   pytest
   ```

---

## 🗺 Roadmap de Desenvolvimento

- [x] **Fase 0 - Setup de Ambiente & Infraestrutura Base:** Docker Compose com MySQL 8.0, virtualenv, Pydantic Settings e testes de conexão.
- [ ] **Fase 1 - Domínio Puro & Motor de Cálculo Estatístico:** Value Objects, Strategy Pattern ($\bar{X}-R, \bar{X}-s, I-MR$), detector das 8 Regras de Nelson e testes unitários.
- [ ] **Fase 2 - Persistência Relacional & Repositórios:** Mapeamento SQLAlchemy 2.0 assíncrono, migrações Alembic e repositórios.
- [ ] **Fase 3 - Casos de Uso & Orquestração:** Implementação do `ProcessamentoSubgrupoService` e validação transacional.
- [ ] **Fase 4 - Tempo Real Reativo:** `ConnectionManager` de WebSockets nativo e Observer de publicação.
- [ ] **Fase 5 - API REST & Apresentação:** Endpoints HTTP FastAPI (`/cartas`, `/amostras`, `/auth`) e segurança JWT.
- [ ] **Fase 6 - Simulador IoT, Testes E2E & Containerização:** Emissão automática de subgrupos e Dockerfile multi-stage de produção.

---

## 📖 Documentação Técnica

Para detalhes aprofundados sobre a especificação técnica e arquitetural, consulte:
- [Planejamento Geral e Modelo de Dados](docs/Planejamento.md)
- [Especificação de Requisitos e Regras de Negócio](docs/Requisitos.md)
- [Arquitetura Orientada a Objetos do Backend](docs/Backend/Backend.md)
- [Roadmap Detalhado de Implementação](docs/Backend/Roadmap.md)
- [Registro de Features Concluídas](docs/Backend/feats/README.md)

---

## 👤 Colaboradores

- **GitHub:** [@TiagoUNB](https://github.com/TiagoUNB)

---