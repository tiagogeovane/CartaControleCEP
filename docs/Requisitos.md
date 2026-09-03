# Documento de Especificação de Requisitos de Software (SRS)
## Sistema de Controle Estatístico de Processos (CEP) em Tempo Real

---

## 1. Introdução e Visão Geral

### 1.1. Objetivo
Este documento especifica os requisitos funcionais, não-funcionais e regras de negócio para o **Sistema de Controle Estatístico de Processos (CEP)**. O sistema tem como propósito coletar, processar e exibir medições de processos industriais/operacionais em tempo real, calculando limites estatísticos, detectando anomalias e causas especiais de variação através de cartas de controle e índices de capacidade.

### 1.2. Contexto da Solução
A plataforma adota uma arquitetura reativa e enxuta:
* **Backend:** FastAPI (Python 3.12+) com motor estatístico científico (NumPy/SciPy) e gerenciador de WebSockets nativo em memória (`ConnectionManager`).
* **Frontend:** React (Vite + TypeScript), Tailwind CSS e Apache ECharts com renderização incremental em tempo real.
* **Persistência:** MySQL 8.0 (InnoDB + suporte a JSON nativo) via SQLAlchemy 2.0 assíncrono (`asyncmy`).

---

---

## 4. Requisitos Funcionais (RF)

### 4.1. Gestão de Usuários e Autenticação

* **[RF01] Cadastro de Usuários:** O sistema deve permitir que novos usuários se cadastrem informando um username unico e senha.
* **[RF02] Autenticação e Sessão:** O sistema deve autenticar usuários mediante credenciais (username e senha) e emitir tokens JWT (*JSON Web Tokens*) para autorização de requisições subsequentes.
* **[RF03] Controle de Perfil de Acesso:** O sistema deve diferenciar as ações disponíveis conforme o perfil atribuído ao usuário (ex: Operador, Engenheiro da Qualidade, Administrador).

### 4.2. Gestão de Processos e Cartas de Controle

* **[RF04] Cadastro de Processos Industriais:** O sistema deve permitir cadastrar e gerenciar processos industriais, registrando nome, código da linha de produção e descrição técnica.
* **[RF05] Criação e Configuração de Cartas de Controle:** O usuário deve ser capaz de criar uma nova carta de controle vinculada a um processo, definindo:
  * Tipo da carta: Variáveis ($\bar{X}-R$, $\bar{X}-s$, $I-MR$) ou Atributos ($p, np, c, u$).
  * Tamanho nominal do subgrupo amostral ($n$).
  * Limites de Especificação de Engenharia: Limite Superior de Especificação (LSE), Limite Inferior de Especificação (LIE) e Valor Nominal/Alvo.
  * Modo de limites de controle: Sempre Dinamico (recalculados estatisticamente).

### 4.3. Ingestão e Entrada de Dados

* **[RF06] Ingestão de Dados via Interface Web:** O frontend deve fornecer um formulário intuitivo para entrada manual de dados de medição de um novo subgrupo amostral.
* **[RF07] Ingestão de Dados via Endpoint REST (JSON):** O backend deve expor um endpoint HTTP seguro (`POST /api/v1/cartas/{id}/amostras`) que receba um payload JSON contendo o array de valores medidos, identificador do subgrupo e carimbo de data/hora (*timestamp*).
* **[RF08] Carga de Dados Pré-coletados / Em Lote:** O sistema deve permitir a importação em lote de dados históricos prévios através de arquivos nos formatos JSON ou CSV (`POST /api/v1/cartas/{id}/importar`), populando a carta e recalculando o histórico.

### 4.4. Motor de Cálculo Estatístico e Detecção de Causas Especiais

* **[RF09] Cálculo de Estatísticas Básicas do Subgrupo:** A cada novo subgrupo recebido, o motor deve calcular automaticamente a média amostral ($\bar{X}$), amplitude ($R$), desvio padrão amostral ($s$) ou métricas de atributos correspondentes.
* **[RF10] Cálculo de Limites de Controle Estatístico:** O sistema deve calcular os limites estatísticos com base em constantes tabeladas normalizadas ($A_2, D_3, D_4, c_4, B_3, B_4$):
  * Limite Superior de Controle (LSC).
  * Linha Central (LC).
  * Limite Inferior de Controle (LIC).
* **[RF11] Avaliação de Capacidade do Processo:** O sistema deve calcular os índices de capacidade $C_p$ (capacidade potencial) e $C_{pk}$ (capacidade real considerando centralização) a partir dos limites de especificação informados e da dispersão do processo.
* **[RF12] Detecção Automática de Anomalias (Regras de Nelson):** O sistema deve analisar automaticamente a sequência histórica de pontos (avaliando os últimos subgrupos) para identificar violações das 8 Regras de Nelson (ex: 1 ponto além de $3\sigma$, 9 pontos consecutivos do mesmo lado da média, 6 pontos consecutivos crescentes ou decrescentes).

### 4.5. Tempo Real e Visualização Gráfica

* **[RF13] Transmissão em Tempo Real via WebSocket:** Imediatamente após a conclusão dos cálculos estatísticos de uma nova amostra e sua persistência, o backend deve enviar o subgrupo processado via conexão WebSocket ativa (`/ws/cartas/{carta_id}`).
* **[RF14] Atualização Incremental do Gráfico:** A interface web deve escutar os eventos via WebSocket e atualizar a carta de controle dinamicamente (anexação incremental via ECharts), sem necessidade de recarregar a página (*refresh* completo).
* **[RF15] Destaque Visual de Pontos Fora de Controle:** O gráfico deve destacar visualmente em cor diferenciada (ex: vermelho) os pontos que violaram quaisquer regras de controle estatístico, exibindo tooltip explicativo com a regra violada.
* **[RF16] Registro de Causas Especiais e Ações Corretivas:** O usuário deve ser capaz de registrar uma justificativa de causa raiz e a ação corretiva tomada diretamente sobre pontos identificados como fora de controle.

---

## 5. Requisitos Não-Funcionais (RNF)

| Identificador | Categoria | Descrição |
| :--- | :--- | :--- |
| **[RNF01]** | **Desempenho e Latência** | O processamento estatístico de um subgrupo via motor NumPy/SciPy deve ser executado em tempo sub-milissegundo (< 50 ms), e a entrega via WebSocket deve ocorrer com latência inferior a 500 ms após a ingestão. |
| **[RNF02]** | **Eficiência no Frontend** | A renderização de novos pontos no gráfico ECharts deve ser incremental (`notMerge: false`), garantindo 60 FPS sem congelamento da interface do usuário. |
| **[RNF03]** | **Confiabilidade e Persistência** | Todas as medições, cálculos e anomalias devem ser persistidos com garantia de integridade transacional ACID no MySQL 8.0. |
| **[RNF04]** | **Segurança** | As senhas de usuários devem ser armazenadas com hash criptográfico forte (Argon2 ou bcrypt). Todos os endpoints protegidos devem exigir validação de token JWT no cabeçalho `Authorization`. |
| **[RNF05]** | **Validação Estrita de Dados** | Todos os payloads de entrada (REST e WebSocket) devem ser validados tipologicamente pelo Pydantic v2, rejeitando medições nulas, tipos incompatíveis ou inconsistências no tamanho do subgrupo. |
| **[RNF06]** | **Escalabilidade Concorrente** | O gerenciador de WebSocket em memória (`ConnectionManager`) do FastAPI deve suportar conexões assíncronas simultâneas sem bloqueio de I/O de rede. |
| **[RNF07]** | **Portabilidade e Implantação** | O sistema deve ser empacotado para execução padronizada em contêineres Docker utilizando Docker Compose para orquestração de banco, backend e frontend. |

---

## 6. Regras de Negócio (RN)

* **[RN01] Seleção Automática do Tipo de Carta:**
  * Para subgrupos de tamanho $n \le 10$, a carta padrão de variáveis contínuas deve ser $\bar{X}-R$.
  * Para subgrupos de tamanho $n > 10$, a carta padrão de variáveis contínuas deve ser $\bar{X}-s$.
  * Para subgrupos unitários ($n = 1$), a carta padrão deve ser $I-MR$ (Valores Individuais e Amplitude Móvel).
* **[RN02] Integridade do Subgrupo:** O número de leituras em cada subgrupo deve corresponder exatamente ao `tamanho_subgrupo` configurado na Carta de Controle, rejeitando payloads com quantitativo divergente.
* **[RN03] Não Interrupção do Fluxo em Anomalias:** A ocorrência de um ponto fora de controle não rejeita a gravação do dado; o dado é persistido com a flag `fora_de_controle = true` e o código da regra de Nelson violada registrado em formato JSON.
* **[RN04] Requisito Mínimo para Cálculo de Capacidade ($C_p / C_{pk}$):** O cálculo dos índices de capacidade só deve ser exibido se os limites de especificação (LSE e/ou LIE) estiverem definidos na carta de controle e se houver um histórico mínimo de subgrupos coletados (recomendado $\ge 20$ subgrupos).

---

## 7. Interfaces Externas e Estrutura dos Dados

### 7.1. Contrato do Payload de Ingestão (POST `/api/v1/cartas/{id}/amostras`)
```json
{
  "numero_subgrupo": 26,
  "timestamp": "2026-09-03T12:00:00Z",
  "valores": [25.10, 25.50, 25.80, 25.20, 25.50]
}
```

### 7.2. Contrato do Evento Transmitido via WebSocket (`/ws/cartas/{carta_id}`)
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
    "amostras_brutas": [25.10, 25.50, 25.80, 25.20, 25.50]
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