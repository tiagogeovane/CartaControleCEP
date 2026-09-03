# Planejamento Arquitetural - Sistema de Controle Estatístico de Processos (CEP)

> **Decisão Arquitetural Consolidada:** Arquitetura enxuta, robusta e direta, sem dependência de Redis. Utiliza **WebSockets nativos gerenciados em memória pelo FastAPI**, mantendo a atualização em tempo real no frontend assim que novas amostras são inseridas. O banco de dados oficial é o **MySQL 8.0**, aproveitando a experiência prévia da equipe, excelente suporte a JSON nativo e facilidade de administração.

---

## 1. Stack Tecnológica Oficial

```text
┌────────────────────────────────────────────────────────────────────────┐
│ STACK TECNOLÓGICA (SIMPLIFICADA & REATIVA)                             │
├────────────────────────────────────────────────────────────────────────┤
│ • Frontend:      React (Vite + TypeScript) + Apache ECharts + Tailwind │
│ • Backend & API: Python 3.12+ (FastAPI + Pydantic v2 + Uvicorn)        │
│ • Motor CEP:     Python Científico (NumPy + SciPy)                     │
│ • Banco Dados:   MySQL 8.0 (Motor InnoDB + JSON nativo)                │
│ • Tempo Real:    WebSockets Nativos in-memory (FastAPI)                │
│ • Infra/Deploy:  Docker & Docker Compose (ou execução direta)          │
└────────────────────────────────────────────────────────────────────────┘
```

### Justificativas da Escolha:
1. **Produtividade e Domínio da Ferramenta (MySQL 8.0):** Aproveitamento integral da experiência existente em administração, modelagem, ferramentas de visualização (MySQL Workbench, DBeaver) e rotinas de backup.
2. **Tempo Real 100% Preservado:** O FastAPI possui suporte nativo assíncrono a WebSockets com performance excelente. Um gerenciador de conexões em memória (`ConnectionManager`) atende perfeitamente ao envio de dados sequenciais com intervalo razoável.
3. **Cálculo Imediato via NumPy:** Assim que o backend recebe dados pré-coletados ou um novo subgrupo, o NumPy calcula as estatísticas em microssegundos e dispara a atualização diretamente para as conexões ativas do frontend.
4. **Isolamento via ORM:** O uso de SQLAlchemy 2.0 (`asyncmy`) desacopla a camada de aplicação do motor de banco.

---

## 2. Visão Geral da Arquitetura do Sistema

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React + Vite)                         │
│  - Dashboards interativos de Cartas de Controle (Apache ECharts)       │
│  - Limites de controle (LSC, LC, LIC) e tolerâncias (LSE, LIE)         │
│  - Atualizações em tempo real via WebSocket (anexação incremental)     │
│  - Formulário para envio de novas medições / carga de dados            │
└───────────────────────────────────▲────────────────────────────────────┘
                                    │ HTTP (REST) / WebSocket Direto
┌───────────────────────────────────▼────────────────────────────────────┐
│                    API GATEWAY & BACKEND (FastAPI)                     │
│  - AuthRouter (JWT, perfis de acesso)                                  │
│  - IngestaoRouter (Carga de dados pré-coletados e novas amostras)      │
│  - CartasRouter (Configurações, processos, limites)                    │
│  - ConnectionManager (Gerenciador de WebSockets em memória)            │
└───────────────────────▲───────────────────────▲────────────────────────┘
                        │                       │
                        │                       │ Dispara broadcast imediato
                        │                       │ via WebSocket
┌───────────────────────▼────────────────┐      │
│                   SERVIÇOS & DOMÍNIO CEP      │
│   ┌─────────────────────────────────┐  │
│   │         MotorCalculoCEP         │  │
│   │  (NumPy/SciPy: x̄, R, s, Cp, Cpk)│  │
│   └────────────────┬────────────────┘  │
│                    │                   │
│   ┌────────────────▼────────────────┐  │
│   │        DetectorAnomalias        │  │
│   │  (8 Regras de Nelson / W. Elect)│  │
│   └─────────────────────────────────┘  │
└───────────────────────┬────────────────┘
                        │
┌───────────────────────▼────────────────────────────────────────────────┐
│                       PERSISTÊNCIA (MySQL 8.0)                         │
│  - SQLAlchemy 2.0 (Async com driver asyncmy) + Alembic                 │
│  - Tabelas: Usuario, Processo, CartaControle, Subgrupo, AmostraItem    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Especificação Técnica por Módulo

### 3.1. Frontend (React + Vite + TypeScript)
- **Framework:** React com Vite para desenvolvimento ágil e build leve.
- **Renderização Gráfica:** `echarts` e `echarts-for-react`.
  - Linhas de limite estatístico ($LSC, LC, LIC$) via `markLine`.
  - Bandas de desvio padrão ($\pm 1\sigma, \pm 2\sigma, \pm 3\sigma$) via `markArea`.
  - Destaque em vermelho para pontos que violam regras de controle.
- **Comunicação Tempo Real:**
  - O componente da carta abre uma conexão WebSocket em `/ws/cartas/{carta_id}`.
  - Ao receber uma nova medição, o ECharts executa uma atualização incremental (`setOption` com `notMerge: false`), anexando o novo ponto sem piscar a tela.
- **Carga de Dados Pré-Coletados:**
  - Tela para importar arquivo (CSV/JSON) com dados prévios e exibi-los imediatamente na carta com os limites calculados.

### 3.2. Backend & API (FastAPI + Uvicorn)
- **Linguagem:** Python 3.12+.
- **Framework:** FastAPI com Pydantic v2.
- **Gerenciador de Tempo Real em Memória (`ConnectionManager`):**
  - Mantém um dicionário `dict[carta_id, list[WebSocket]]`.
  - Quando um novo subgrupo é enviado via `POST /api/v1/cartas/{id}/amostras`, o FastAPI calcula os resultados, salva no banco e chama diretamente `await manager.broadcast(carta_id, resultado)`.

### 3.3. Motor de Cálculo Estatístico (CEP) & Detector de Anomalias
- **Cartas Suportadas:**
  - $\bar{X}-R$ (Médias e Amplitudes para subgrupos de tamanho $n \le 10$).
  - $\bar{X}-s$ (Médias e Desvios Padrão para subgrupos maiores $n > 10$).
  - $I-MR$ (Valores Individuais e Amplitude Móvel para amostras unitárias).
  - Cartas por Atributos: $p, np, c, u$.
- **Capacidade do Processo:**
  - $C_p$ (capacidade potencial) e $C_{pk}$ (capacidade real centralizada).
- **Detecção das 8 Regras de Nelson:**
  - Avaliação automática dos últimos 15 pontos a cada nova inserção para apontar causas especiais (ex.: 1 ponto fora de $3\sigma$, 9 pontos consecutivos no mesmo lado da média, 6 pontos em tendência contínua).

### 3.4. Persistência (MySQL 8.0)
- **Driver Assíncrono:** `asyncmy` com SQLAlchemy 2.0.
  - String de conexão: `mysql+asyncmy://user:pass@host:3306/cep_db`
- **Migrações:** Alembic configurado para dialeto MySQL.
- **Armazenamento de Metadados e JSON:**
  - Identificadores UUID armazenados como `VARCHAR(36)` com integridade referencial `FOREIGN KEY`.
  - Violações de regras de controle armazenadas no tipo nativo `JSON` do MySQL 8.
  - Índices compostos `(carta_id, timestamp)` para ordenação rápida de subgrupos.

---

## 4. Contrato de Comunicação (REST & WebSocket)

### 4.1. Endpoints REST Principais

| Método | Endpoint | Descrição |
| :--- | :--- | :--- |
| `GET` | `/api/v1/cartas/{id}` | Retorna metadados da carta, limites calculados e histórico de pontos |
| `POST` | `/api/v1/cartas/{id}/amostras` | Recebe um novo subgrupo de medições (entrada única sequencial) |
| `POST` | `/api/v1/cartas/{id}/importar` | Carga em lote de dados pré-coletados (CSV ou JSON) |
| `GET` | `/api/v1/cartas/{id}/capacidade` | Retorna índices calculados de $C_p$ e $C_{pk}$ |

### 4.2. Streaming WebSocket Direto (`/ws/cartas/{carta_id}`)

Assim que uma nova amostra é processada no endpoint `POST`, o backend transmite diretamente para o WebSocket dos clientes conectados àquela carta:

```json
{
  "event": "NOVO_SUBGRUPO_PROCESSADO",
  "carta_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "timestamp": "2026-09-03T12:00:00Z",
  "numero_subgrupo": 26,
  "estatisticas": {
    "media_x": 25.42,
    "amplitude_r": 0.85,
    "desvio_s": 0.31,
    "amostras_brutas": [25.1, 25.5, 25.8, 25.2, 25.5]
  },
  "limites": {
    "lc": 25.00,
    "lsc": 25.75,
    "lic": 24.25
  },
  "status_controle": {
    "fora_de_controle": false,
    "regras_violadas": []
  },
  "capacidade": {
    "cp": 1.33,
    "cpk": 1.15
  }
}
```

---

## 5. Fluxo de Dados Ponta a Ponta (Tempo Real Direto)

```mermaid
sequenceDiagram
    autonumber
    actor Usuario as Usuário / Operador
    participant Frontend as Frontend (React/ECharts)
    participant API as FastAPI (Backend)
    participant ConnectionMgr as ConnectionManager (In-Memory)
    participant Motor as Motor CEP (NumPy)
    participant DB as MySQL 8.0

    Usuario->>Frontend: Envia medições do subgrupo (ou importa arquivo)
    Frontend->>API: POST /api/v1/cartas/{id}/amostras
    API->>Motor: Calcula x̄, R, s e verifica regras de Nelson
    Motor-->>API: Estatísticas + status de controle
    API->>DB: Persiste Subgrupo e Amostras
    API->>ConnectionMgr: broadcast(carta_id, resultado)
    ConnectionMgr-->>Frontend: WebSocket Push instantâneo
    Frontend-->>Usuario: ECharts anexa o novo ponto imediatamente na tela
```

---

## 6. Modelo de Entidades e Relacionamentos (Banco de Dados MySQL 8.0)

```text
┌───────────────────────────────┐
│            Usuario            │
├───────────────────────────────┤
│ id (VARCHAR(36), PK)          │
│ nome (VARCHAR(150))           │
│ email (VARCHAR(150), UNIQUE)  │
│ senha_hash (VARCHAR(255))     │
│ perfil (VARCHAR(50))          │
└───────────────┬───────────────┘
                │ 1
                │
                │ N
┌───────────────▼───────────────┐       ┌─────────────────────────────┐
│           Processo            │ 1   N │        CartaControle        │
├───────────────────────────────┼───────┤─────────────────────────────┤
│ id (VARCHAR(36), PK)          │       │ id (VARCHAR(36), PK)        │
│ nome (VARCHAR(150))           │       │ processo_id (FK)            │
│ codigo_linha (VARCHAR(50))    │       │ tipo_carta (VARCHAR(30))    │
│ descricao (TEXT)              │       │ tamanho_subgrupo (INT)      │
└───────────────────────────────┘       │ limite_superior_esp (FLOAT) │
                                        │ limite_inferior_esp (FLOAT) │
                                        │ valor_nominal (FLOAT)       │
                                        │ lsc_calculado (FLOAT)       │
                                        │ lic_calculado (FLOAT)       │
                                        │ lc_calculado (FLOAT)        │
                                        │ modo_limites (VARCHAR(20))  │
                                        └──────────────┬──────────────┘
                                                       │ 1
                                                       │
                                                       │ N
                                        ┌──────────────▼──────────────┐
                                        │          Subgrupo           │
                                        ├─────────────────────────────┤
                                        │ id (VARCHAR(36), PK)        │
                                        │ carta_id (FK)               │
                                        │ numero_subgrupo (INT)       │
                                        │ timestamp (DATETIME(6))     │
                                        │ media_x (FLOAT)             │
                                        │ amplitude_r (FLOAT)         │
                                        │ desvio_s (FLOAT)            │
                                        │ fora_de_controle (BOOLEAN)  │
                                        │ regras_violadas (JSON)      │
                                        └──────────────┬──────────────┘
                                                       │ 1
                                                       │
                                        ┌──────────────┴──────────────┐
                                      N │                           N │
                        ┌───────────────▼─────────────┐ ┌─────────────▼───────────────┐
                        │       AmostraItem           │ │     OcorrenciaCausaEsp      │
                        ├─────────────────────────────┤ ├─────────────────────────────┤
                        │ id (VARCHAR(36), PK)        │ │ id (VARCHAR(36), PK)        │
                        │ subgrupo_id (FK)            │ │ subgrupo_id (FK)            │
                        │ valor_medido (FLOAT)        │ │ operador_id (FK)            │
                        │ ordem_coleta (INT)          │ │ regra_violada (VARCHAR(50)) │
                        └─────────────────────────────┘ │ causa_raiz_identificada(TEXT│
                                                        │ acao_corretiva_tomada (TEXT)│
                                                        │ timestamp_resolucao(DATETIME│
                                                        └─────────────────────────────┘
```

---

## 7. Estrutura Proposta de Diretórios do Projeto

```text
controle-estatistico-processos/
├── docker-compose.yml          # Apenas MySQL 8.0, Backend e Frontend
├── .env.example
├── docs/
│   └── Planejamento.md
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt        # fastapi, uvicorn, sqlalchemy, asyncmy, numpy, scipy
│   ├── alembic/
│   └── app/
│       ├── main.py             # Instância FastAPI e rotas principais
│       ├── core/               # Configurações do app e conexão com MySQL
│       ├── api/
│       │   ├── v1/
│       │   │   ├── auth.py
│       │   │   ├── cartas.py
│       │   │   └── amostras.py
│       │   └── websocket.py    # ConnectionManager em memória
│       ├── cep/                # Motor Estatístico Puro (NumPy & SciPy)
│       │   ├── formulas.py     # Constantes tabeladas (A2, D4, c4) e limites
│       │   ├── capacidade.py   # Cp, Cpk
│       │   └── nelson_rules.py # Detector das 8 regras de Nelson
│       ├── models/             # Modelos SQLAlchemy compatíveis com MySQL 8
│       ├── schemas/            # Schemas Pydantic
│       └── repositories/       # Acesso ao banco de dados
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.js
    └── src/
        ├── components/
        │   ├── charts/
        │   │   ├── CartaControleECharts.tsx
        │   │   └── HistogramaCapacidade.tsx
        │   ├── forms/
        │   │   ├── EnvioAmostraForm.tsx
        │   │   └── ImportarArquivoModal.tsx
        │   └── common/
        ├── hooks/
        │   └── useControlChartSocket.ts
        ├── pages/
        │   ├── DashboardPage.tsx
        │   └── CartaDetalhesPage.tsx
        └── services/
            └── api.ts
```

---

## 8. Plano de Execução em Fases

1. **Fase 1 - Estrutura Base:** Configurar ambiente com container MySQL 8.0, backend FastAPI e frontend React/Vite.
2. **Fase 2 - Motor Estatístico CEP (Python puro):** Desenvolver e testar as fórmulas matemáticas das cartas ($\bar{X}-R, \bar{X}-s$), cálculo de limites estatísticos e as regras de Nelson com NumPy/SciPy.
3. **Fase 3 - Persistência e Carga de Dados:** Modelar o banco MySQL com SQLAlchemy/Alembic e criar rotas para importar dados pré-coletados e inserir novos subgrupos.
4. **Fase 4 - Tempo Real Direto (WebSockets):** Implementar o `ConnectionManager` no FastAPI para notificar o frontend instantaneamente a cada novo dado inserido.
5. **Fase 5 - Frontend e Gráficos:** Implementar o Apache ECharts no React para exibir a carta com limites dinâmicos, zonas sigma, detecção visual de anomalias e atualização incremental em tempo real.