# Sistema de Controle Estatístico de Processos (CEP / SPC) em Tempo Real

[![Python](https://img.shields.io/badge/Python-3.12+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18%2F19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Apache ECharts](https://img.shields.io/badge/Apache%20ECharts-5.5+-AA344D?style=for-the-badge&logo=apacheecharts&logoColor=white)](https://echarts.apache.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-3.4+-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1?style=for-the-badge&logo=mysql&logoColor=white)](https://www.mysql.com/)
[![Docker](https://img.shields.io/badge/Docker-Enabled-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)

---

## 🎯 Sobre o Projeto

O **Sistema de Controle Estatístico de Processos (CEP / *Statistical Process Control - SPC*)** é uma plataforma industrial de alto desempenho projetada para monitoramento estatístico contínuo de variáveis de manufatura e processos produtivos em tempo real.

O sistema elimina retrabalhos e refugos na indústria ao processar subgrupos de medições em microssegundos, identificar instantaneamente causas especiais de instabilidade através das **8 Regras de Nelson**, analisar a capacidade do processo ($C_p$ e $C_{pk}$) e transmitir os dados para dashboards analíticos via **WebSockets nativos a 60 FPS**, sem necessidade de recarregamento de página ou mensagerias externas complexas.

---

## ✨ Principais Funcionalidades

- **Cartas de Controle Estatístico Completas:**
  - **Carta $\bar{X}-R$:** monitoramento de média e amplitude para subgrupos amostrais pequenos ($n \le 10$).
  - **Carta $\bar{X}-s$:** monitoramento de média e desvio-padrão para subgrupos maiores ($n > 10$).
  - **Carta $I-MR$:** leituras individuais e amplitude móvel para ensaios destrutivos ou processos contínuos ($n = 1$).
  - Cálculo automático de Linha Central ($LC$), Limite Superior de Controle ($LSC$), Limite Inferior de Controle ($LIC$) e desvio natural ($\hat{\sigma}$).
- **Motor de Detecção das 8 Regras de Nelson:**
  - **Regra 1:** 1 ponto além de $3\sigma$ (além de $LSC$ ou $LIC$).
  - **Regra 2:** 9 pontos consecutivos no mesmo lado da Linha Central.
  - **Regra 3:** 6 pontos consecutivos estritamente crescentes ou decrescentes.
  - **Regra 4:** 14 pontos alternando sucessivamente para cima e para baixo.
  - **Regras 5 a 8:** padrões específicos em Zonas Sigma ($2\sigma$ e $1\sigma$, misturas e estratificações).
- **Estudo de Capacidade de Processo ($C_p$, $C_{pk}$, $C_{pm}$):**
  - Avaliação automática da capacidade e centralização do processo em relação às especificações e tolerâncias de engenharia ($LIE$ e $LSE$).
  - Mostrador tipo *gauge* / *donut* com classificação semântica (Capaz, Aceitável ou Incapaz).
- **Dashboard Industrial Moderno:**
  - Interface desenvolvida em *Dark Mode nativo* ergonômico para chão de fábrica (paleta Slate-900/800 com acento Purple `#7C4FE0`).
  - Navegação lateral retrátil com submenu dinâmico para alternância instantânea entre cartas de controle.
  - 4 Cards de KPI com mini sparklines cúbicos Bézier e percentuais de variação em tempo real.
  - Gráficos herói com curvas suavizadas via **Apache ECharts** e barra inferior com resumo de limites e conformidade.
  - Ranking horizontal de ocorrências por Regra de Nelson e Feed de Alarmes operacionais com apontamento de causa raiz e ações corretivas.
- **Acesso Operacional Livre:**
  - Sistema otimizado para postos de trabalho fabris: qualquer operador acessa imediatamente com permissões totais de administração, sem fricção de senhas ou bloqueio de tela.

---

## 🛠 Stack Tecnológica

| Camada | Tecnologias Principais |
| :--- | :--- |
| **Frontend** | React 18/19, TypeScript, Vite, Tailwind CSS, Apache ECharts (`echarts-for-react`), Zustand, TanStack Query, Radix UI, Lucide Icons |
| **Backend** | Python 3.12+, FastAPI, Uvicorn (ASGI), Pydantic v2, WebSockets in-memory |
| **Computação Estatística** | NumPy, SciPy (cálculos em tempo sub-milissegundo) |
| **Banco de Dados** | MySQL 8.0, SQLAlchemy 2.0 (assíncrono via `asyncmy`), Alembic (migrações) |
| **Servidor Web & Proxy** | Nginx Alpine (compressão Gzip, cache de assets e proxy reverso para API/WS) |
| **DevOps & Containers** | Docker, Docker Compose, Multi-Stage Builds |

---

## 🐳 Mini Tutorial: Como Subir com Docker Localmente

O projeto possui orquestração completa via **Docker Compose**, subindo o banco MySQL 8.0, a API FastAPI (com migrações automáticas de banco via Alembic) e a interface React minificada servida por Nginx.

### Pré-requisitos

- **Docker** (versão 24.0 ou superior) instalado: [https://docs.docker.com/get-docker/](https://docs.docker.com/get-docker/)
- **Docker Compose** (versão v2.20 ou superior): incluído nativamente no Docker Desktop ou plugin `docker-compose-plugin` no Linux.

---

### Passo a Passo de Execução

#### 1. Clonar o Repositório e Entrar na Pasta

```bash
git clone https://github.com/TiagoUNB/Controle-Estatistico-de-Processos.git
cd Controle-Estatistico-de-Processos
```

#### 2. Configurar o Arquivo de Variáveis de Ambiente

Crie o arquivo `.env` na raiz do projeto a partir do modelo de exemplo:

```bash
cp .env.example .env
```

*(As variáveis padrão já estão pré-configuradas para funcionar imediatamente no ambiente Docker local).*

#### 3. Subir Toda a Aplicação via Docker Compose

Execute o comando abaixo na raiz do repositório:

```bash
docker compose up --build -d
```

> **O que esse comando faz automaticamente:**
> 1. Inicia o container do banco de dados **MySQL 8.0** (`cep_mysql`) e aguarda o *healthcheck* ficar saudável.
> 2. Compila a imagem do **Backend FastAPI** (`cep_backend`), executa as migrações estruturais do Alembic (`alembic upgrade head`) e inicia a API.
> 3. Compila a imagem do **Frontend React** em multi-stage (`cep_frontend`) e serve os assets com Nginx configurado com proxy reverso e suporte a WebSockets.

#### 4. Verificar o Status dos Containers

Para conferir se todos os 3 serviços estão rodando com integridade:

```bash
docker compose ps
```

Você verá a lista de containers com status `healthy` / `Up`:
- `cep_mysql` (porta 3306)
- `cep_backend` (porta 8000)
- `cep_frontend` (porta 3000)

---

### 🌐 Endereços de Acesso Local

Após subir os containers, acesse em seu navegador:

| Interface | URL Local | Descrição |
| :--- | :--- | :--- |
| **Dashboard CEP (Frontend)** | [http://localhost:3000](http://localhost:3000) | Interface gráfica completa do sistema em tempo real |
| **Documentação da API (Swagger)** | [http://localhost:8000/docs](http://localhost:8000/docs) | Swagger UI interativo com todos os endpoints REST |
| **Documentação Alternativa (ReDoc)** | [http://localhost:8000/redoc](http://localhost:8000/redoc) | Especificação OpenAPI detalhada |
| **Healthcheck da API** | [http://localhost:8000/health](http://localhost:8000/health) | Verificação de integridade e conexão com o banco |

---

### 📋 Comandos Úteis do Docker

- **Acompanhar os logs em tempo real:**
  ```bash
  docker compose logs -f
  ```
- **Acompanhar logs apenas do backend:**
  ```bash
  docker compose logs -f backend
  ```
- **Acompanhar logs apenas do frontend:**
  ```bash
  docker compose logs -f frontend
  ```
- **Parar a aplicação sem apagar dados:**
  ```bash
  docker compose stop
  ```
- **Reiniciar os containers:**
  ```bash
  docker compose restart
  ```
- **Derrubar os containers mantendo os volumes persistentes:**
  ```bash
  docker compose down
  ```
- **Derrubar os containers e resetar o banco de dados (apagar volume):**
  ```bash
  docker compose down -v
  ```

---

## 💻 Execução Manual sem Docker (Modo Desenvolvimento)

Caso queira executar os serviços diretamente no seu terminal local sem empacotamento completo de containers:

### 1. Subir apenas o MySQL no Docker

```bash
docker compose up -d db
```

### 2. Iniciar o Backend (FastAPI)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate    # No Windows: .venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Iniciar o Frontend (Vite)

Em outro terminal:

```bash
cd frontend
npm install
npm run dev
```
O frontend de desenvolvimento estará disponível em `http://localhost:5173`.

---

## 🧪 Execução dos Testes Automatizados

O sistema conta com testes automatizados no frontend e no backend:

```bash
# Testes do Backend (159 testes unitários e de integração)
cd backend
.venv/bin/pytest

# Testes do Frontend (109 testes em 14 suítes com Vitest)
cd frontend
npm test

# Build de Produção do Frontend
npm run build
```

---

## 📂 Estrutura do Repositório

```text
Controle-Estatistico-de-Processos/
├── docker-compose.yml             # Orquestração MySQL 8.0, Backend FastAPI e Frontend Nginx
├── .env.example                  # Variáveis de ambiente padronizadas
├── README.md                     # Documentação principal e tutorial de inicialização
├── backend/                      # Aplicação Backend Python (FastAPI + NumPy)
│   ├── Dockerfile                # Build multi-stage para produção
│   ├── requirements.txt          # Dependências do backend
│   ├── alembic/                  # Migrações versionadas do banco de dados
│   ├── app/                      # Código-fonte em Clean Architecture
│   │   ├── api/                  # Endpoints REST e WebSockets
│   │   ├── application/          # Serviços de aplicação e orquestração
│   │   ├── domain/               # Entidades, estratégias CEP e Regras de Nelson
│   │   └── infrastructure/       # Repositórios SQLAlchemy e conexão com banco
│   └── tests/                    # Suíte com 159 testes (unitários, integração e e2e)
├── frontend/                     # Aplicação Frontend (React + Vite + TypeScript)
│   ├── Dockerfile                # Build multi-stage com Nginx Alpine
│   ├── nginx.conf                # Configuração de proxy reverso e SPA
│   ├── package.json              # Dependências e scripts
│   ├── src/
│   │   ├── components/           # Componentes de layout, cartas ECharts, KPIs e alarmes
│   │   ├── pages/                # LiveStudioPage, CapacidadePage, IngestaoPage, etc.
│   │   ├── stores/               # Gerenciamento de estado global com Zustand
│   │   └── test/                 # Suíte com 109 testes com Vitest e Testing Library
└── docs/                         # Especificações de requisitos e arquitetura detalhada
```

---

## 📖 Documentação Técnica Complementar

- [Planejamento Geral e Modelo de Dados](docs/Planejamento.md)
- [Especificação de Requisitos e Regras de Negócio](docs/Requisitos.md)
- [Arquitetura Orientada a Objetos do Backend](docs/Backend/Backend.md)
- [Guia do Simulador IoT de Telemetria Industrial](docs/Backend/Simulador_IoT.md)
- [Roadmap do Frontend e Módulos](docs/frontend/Roadmap.md)

---

## 👤 Autor

- **GitHub:** [@TiagoUNB](https://github.com/TiagoUNB)