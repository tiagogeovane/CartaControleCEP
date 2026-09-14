# Guia do Simulador IoT de Telemetria Industrial

Este documento detalha o funcionamento, a arquitetura e as instruções práticas de execução do script [`backend/scripts/simulador_iot.py`](../../backend/scripts/simulador_iot.py), responsável por emular um ambiente industrial de sensores, máquinas CNC ou Controladores Lógicos Programáveis (CLPs) emitindo medições contínuas para o motor de **Controle Estatístico de Processos (CEP)**.

---

## 📌 1. Visão Geral e Propósito

Na validação de sistemas de monitoramento fabril em tempo real, a coleta manual de dados ou a dependência de maquinário físico conectado pode ser um gargalo. O **Simulador IoT** resolve essa necessidade fornecendo:

1. **Emissão Contínua de Telemetria:** gera e envia subgrupos amostrais periodicamente via requisições HTTP REST (`POST /api/v1/cartas/{id}/amostras`).
2. **Injeção Programada de Anomalias:** insere perturbações estatísticas controladas (outliers, saltos de média e tendências contínuas) para disparar e validar o funcionamento das **Regras de Nelson**.
3. **Validação do Pipeline em Tempo Real:** permite assistir visualmente no dashboard frontend (`/live`) a atualização incremental das cartas de controle a 60 FPS através dos WebSockets em memória.
4. **Telemetria e Medição de Latência:** monitora a latência ponta a ponta (rede + ingestão + cálculo NumPy + persistência + WebSocket broadcast) garantindo o atendimento ao requisito não-funcional **[RNF01]** (< 500 ms).

```text
┌─────────────────────────┐         HTTP REST (POST /amostras)        ┌─────────────────────────┐
│                         │ ────────────────────────────────────────> │      FastAPI (API)      │
│  Simulador IoT (Python) │                                           └────────────┬────────────┘
│  (simulador_iot.py)     │                                                        │
│                         │                                           ┌────────────▼────────────┐
│  - Amostras Gaussianas  │                                           │    Motor CEP (NumPy)    │
│  - Injeção Regras 1,2,3 │                                           │  - Limites LSC/LC/LIC   │
│  - Métricas de Latência │                                           │  - Regras de Nelson     │
└─────────────────────────┘                                           └────────────┬────────────┘
                                                                                   │
                                     WebSocket Nativo (ws://.../ws/cartas/{id})    │ Broadcast
                                  ┌────────────────────────────────────────────────┘ Imediato
                                  ▼
                    ┌───────────────────────────┐
                    │   Frontend (React/Vite)   │
                    │   - Apache ECharts        │
                    │   - Feed de Alarmes       │
                    │   - Animação a 60 FPS     │
                    └───────────────────────────┘
```

---

## ⚙️ 2. Como o Simulador Funciona Internamente

A classe principal `SimuladorIoTCEP` executa um ciclo de vida automatizado e resiliente:

### 2.1. Verificação de Saúde do Servidor
O simulador executa uma chamada preliminar para o endpoint `GET /health` do backend. Se a API estiver offline ou inacessível, o script interrompe graciosamente a execução orientando o operador a inicializar a aplicação.

### 2.2. Autenticação Automática
O script envia credenciais para `/api/v1/auth/login`. Caso o usuário não exista (por exemplo, em um banco de dados recém-criado), ele chama `/api/v1/auth/register`, cria o operador com perfil `ADMIN` e recupera o token JWT de autorização Bearer.

### 2.3. Resolução ou Provisionamento da Carta de Controle
- **Com `--carta-id` fornecido:** o simulador valida se o UUID existe no banco e passa a emitir medições diretamente para ela.
- **Sem `--carta-id`:** 
  1. Consulta a lista de processos industriais em busca do código de linha especificado (padrão: `CNC-SIM-01`).
  2. Se não existir, cadastra um novo processo: *"Linha de Usinagem CNC (CNC-SIM-01)"*.
  3. Procura uma carta vinculada a esse processo com o tamanho de subgrupo $n$ correspondente.
  4. Caso não exista, cadastra uma nova carta no modo `DINAMICO`, configurando automaticamente as tolerâncias de especificação de engenharia:
     - $LSE = \mu + 3.5\sigma$
     - $LIE = \mu - 3.5\sigma$
     - $Valor Nominal = \mu$

---

## 🔬 3. Mecanismo de Geração Estatística e Injeção de Anomalias

Para cada subgrupo amostral de tamanho $n$ (padrão $n = 5$), o simulador gera valores com base na distribuição normal (Gaussiana):

$$X \sim \mathcal{N}(\mu, \sigma^2)$$

Onde a média nominal padrão é $\mu = 25.0$ e o desvio padrão é $\sigma = 0.5$.

### O Ciclo de Anomalias de 40 Subgrupos
Quando a injeção de anomalias está ativada (comportamento padrão), o simulador opera em um ciclo contínuo de **40 subgrupos**, simulando um turno fabril realista:

| Intervalo no Ciclo | Condição Simulada | Perturbação Injetada | Regra de Nelson Disparada |
| :--- | :--- | :--- | :--- |
| **Subgrupos 1 a 11** | Operação Normal | Amostras normais sob controle ($\mu = 25.0, \sigma = 0.5$) | Nenhuma (Processo estável) |
| **Subgrupo 12** | Causa Especial Pontual | Média deslocada para $\mu + 4.2\sigma$ com dispersão baixa | **Regra 1:** 1 ponto além de $3\sigma$ (outlier além de $LSC$) |
| **Subgrupos 13 a 17** | Operação Normal | Retorno à normalidade ($\mu = 25.0$) | Nenhuma |
| **Subgrupos 18 a 26** | Deslocamento de Média (*Shift*) | Média desviada para $\mu + 1.8\sigma$ mantida por **9 pontos consecutivos** | **Regra 2:** 9 pontos consecutivos no mesmo lado da Linha Central |
| **Subgrupos 27 a 29** | Operação Normal | Retorno à normalidade ($\mu = 25.0$) | Nenhuma |
| **Subgrupos 30 a 35** | Desgaste de Ferramental (*Trend*) | Média com acréscimo linear crescente por **6 pontos consecutivos** ($\mu + passo \times 0.45\sigma$) | **Regra 3:** 6 pontos em tendência estritamente crescente |
| **Subgrupos 36 a 40** | Operação Normal | Processo recalibrado sob controle | Nenhuma |

> Se a flag `--sem-anomalias` for utilizada, o simulador suprime esse ciclo e emite exclusivamente dados sob controle estatístico.

---

## 🚀 4. Como Executar o Script

### Pré-requisitos
1. O backend precisa estar em execução (seja via Docker ou ambiente local).
2. O ambiente virtual Python do backend com as dependências instaladas (`httpx`, etc.).

---

### 4.1. Execução Padrão (Recomendada)

Com o backend rodando em `http://localhost:8000`:

```bash
# A partir da raiz do repositório
source backend/.venv/bin/activate
python backend/scripts/simulador_iot.py
```

O script criará automaticamente o processo `CNC-SIM-01`, a carta de controle e iniciará a transmissão a cada 2 segundos.

---

### 4.2. Exemplos de Comandos Úteis

#### A. Transmissão Acelerada (1 subgrupo por segundo)
Útil para demonstrações rápidas ou testes de estresse:
```bash
python backend/scripts/simulador_iot.py -i 1.0
```

#### B. Executar com Quantidade Fixa de Subgrupos
Para rodar exatamente 30 subgrupos e parar automaticamente com o relatório:
```bash
python backend/scripts/simulador_iot.py -n 30
```

#### C. Injetar em uma Carta Já Existente no Sistema
Caso você já tenha criado uma carta pelo frontend ou pela API e queira transmitir diretamente para ela:
```bash
python backend/scripts/simulador_iot.py --carta-id "f47ac10b-58cc-4372-a567-0e02b2c3d479"
```

#### D. Simulação 100% Sob Controle (Sem Anomalias)
Gera apenas dados estáveis para validar processo em conformidade e índices $C_p / C_{pk}$ elevados:
```bash
python backend/scripts/simulador_iot.py --sem-anomalias
```

#### E. Customizar Parâmetros do Processo Fabril
Exemplo para uma linha de usinagem com diâmetro nominal de $50.0\text{ mm}$, desvio $\sigma = 1.2\text{ mm}$ e subgrupos de $n = 5$ amostras a cada 1.5s:
```bash
python backend/scripts/simulador_iot.py -m 50.0 -s 1.2 -k 5 -i 1.5 --codigo-linha "TORNO-02"
```

#### F. Execução Apontando para Backend em Outro Host/Porta
Caso o backend esteja rodando em outro endereço de rede:
```bash
python backend/scripts/simulador_iot.py --url http://192.168.1.100:8000
```

---

## 📋 5. Tabela Completa de Parâmetros de Linha de Comando

| Argumento | Flag Curta | Tipo | Padrão | Descrição |
| :--- | :--- | :--- | :--- | :--- |
| `--url` | — | `str` | `http://localhost:8000` | URL base do backend FastAPI |
| `--intervalo` | `-i` | `float` | `2.0` | Intervalo de tempo entre subgrupos em segundos |
| `--limite` | `-n` | `int` | `0` | Quantidade total de subgrupos a emitir (`0` = infinito até `Ctrl+C`) |
| `--tamanho` | `-k` | `int` | `5` | Quantidade de medições em cada subgrupo ($n$) |
| `--media` | `-m` | `float` | `25.0` | Média nominal do processo industrial ($\mu$) |
| `--desvio` | `-s` | `float` | `0.5` | Desvio padrão da variável monitorada ($\sigma$) |
| `--sem-anomalias` | — | `flag` | `False` | Desativa a injeção programada de perturbações estatísticas |
| `--carta-id` | — | `UUID` | `None` | UUID de uma carta já cadastrada para direcionar o envio |
| `--codigo-linha` | — | `str` | `CNC-SIM-01` | Código identificador da linha de produção/usinagem |
| `--email` | — | `str` | `admin@cep.com` | E-mail para autenticação JWT |
| `--senha` | — | `str` | `Admin123!` | Senha para autenticação JWT |

---

## 🖥 6. Interpretando a Saída no Terminal

Durante a execução, o simulador exibe cada subgrupo com formatação colorida:

```text
================================================================================
🚀 SIMULADOR DE LINHA DE PRODUÇÃO IoT - CONTROLE ESTATÍSTICO DE PROCESSOS
================================================================================
• Servidor API:      http://localhost:8000
• Carta de Controle: 8f24a1b0-96b4-4b55-bc50-13b7d14d2e88
• WebSocket Stream:  ws://localhost:8000/ws/cartas/8f24a1b0-96b4-4b55-bc50-13b7d14d2e88
• Média Nominal (μ): 25.0 | Desvio Padrão (σ): 0.5
• Tamanho Subgrupo:  n = 5 amostras
• Intervalo de Envio:2.0 s
• Injeção Anomalias: Ativada (Regras 1, 2, 3 de Nelson)
================================================================================
Pressione [Ctrl+C] a qualquer momento para interromper a simulação.

[17:35:02] #001 | X̄:  24.98 | R:  0.82 | Status: ✅ SOB CONTROLE | Regras: Nenhuma            | Latência:  18.4 ms
[17:35:04] #002 | X̄:  25.11 | R:  0.94 | Status: ✅ SOB CONTROLE | Regras: Nenhuma            | Latência:  12.1 ms
...
[17:35:24] #012 | X̄:  27.12 | R:  0.42 | Status: 🚨 FORA DE CONTROLE | Regras: [REGRA_1]          | Latência:  14.2 ms
       └─ 🚨 Perturbação: Regra 1 (Outlier além de 3σ)
```

### Relatório Consolidado de Encerramento
Ao pressionar `Ctrl+C` ou atingir o limite `--limite`, o script exibe o balanço estatístico:

```text
================================================================================
📊 RELATÓRIO CONSOLIDADO DA SIMULAÇÃO
================================================================================
• Total de subgrupos transmitidos: 45
• Subgrupos sob controle:          29 (64.4%)
• Subgrupos fora de controle:      16 (35.6%)
• Violações detectadas por regra:
    - REGRA_1: 1 ocorrência(s)
    - REGRA_2: 9 ocorrência(s)
    - REGRA_3: 6 ocorrência(s)
• Desempenho e Latência de Rede (REST Ingestão):
    - Média: 14.8 ms | Mínima: 10.2 ms | Máxima: 38.6 ms
• Requisito [RNF01] (< 500 ms):    ✅ ATENDIDO
================================================================================
```

---

## 🌐 7. Acompanhamento Visual no Frontend

Para visualizar os dados em streaming a 60 FPS enquanto o simulador está rodando:

1. Abra o navegador em [http://localhost:3000](http://localhost:3000) (ou na porta do frontend em desenvolvimento).
2. Acesse a tela **Live Studio** (`/live`).
3. No seletor superior de **Carta Ativa**, selecione a carta vinculada ao processo `CNC-SIM-01` (ou a carta informada via `--carta-id`).
4. Observe:
   - Os pontos sendo plotados na curva em tempo real via WebSocket.
   - Os pontos violadores piscando em vermelho no gráfico através do efeito pulsante.
   - Os alarmes sendo adicionados no **Feed de Alarmes** e na barra horizontal de **Distribuição das Regras de Nelson**.
   - A recalibração contínua da **Linha Central (LC)** e limites **LSC/LIC** no modo dinâmico.
