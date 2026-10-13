# Guia do Script de Ingestão de Dados via JSON

Este documento detalha o funcionamento, arquitetura e instruções práticas de execução do script [`backend/scripts/json/simulador_json.py`](../../backend/scripts/json/simulador_json.py), responsável por fornecer uma porta de entrada de medições reais ou pré-definidas para o motor de **Controle Estatístico de Processos (CEP)** através da estrutura de JSON padronizada para os testes industriais.

---

## 📌 1. Visão Geral e Propósito

Diferentemente do [`simulador_iot.py`](./Simulador_IoT.md), que gera valores aleatórios via distribuição Gaussiana e perturbações simuladas em tempo de execução, o **Simulador de Ingestão JSON**:

1. **Lê medições estruturadas no padrão oficial:** suporta arquivos padronizados com as chaves `ID` (opcional), `Unit`, `Measured_at`, `Created_by`, `Type`, `Goal`, `LSE`, `LIE` e `Data`.
2. **Fluxo em Duas Etapas (Calibração ➔ Acompanhamento):**
   - **Calibração:** Envio inicial sem `ID` cria uma nova carta de controle e calcula limites estatísticos base (modo `DINAMICO`).
   - **Acompanhamento:** Envio subsequente informando o `ID` da carta anexa os novos subgrupos à mesma carta existente, dando continuidade ao histórico e à detecção das Regras de Nelson.
   - **Alternância de Limites (`--alternar-modo-limites`):** Ao ativar a flag, quando uma carta já existente recebe dados de acompanhamento, o script invoca `GerenciarCartaService.alternar_modo_limites` para travar os limites em modo `FIXO`. Se posteriormente forem enviados novos dados de calibração, o modo é retornado para `DINAMICO`.
3. **Resolução Tolerante de ID:** caso o campo `ID` não seja fornecido ou o UUID informado não exista na base de dados (404), o script não trava: ele emite um aviso claro e cria automaticamente uma nova carta de controle.
4. **Streaming em Tempo Real ou Importação em Lote:** suporta tanto o envio sequencial com intervalo programado (reproduzindo o comportamento de telemetria para visualização no dashboard `/live` a 60 FPS) quanto a carga instantânea em lote (`--lote`).

```text
┌──────────────────────────────────────────────┐       HTTP REST (POST /amostras)        ┌─────────────────────────┐
│ Arquivo JSON (Calibração ou Acompanhamento)  │ ──────────────────────────────────────> │      FastAPI (API)      │
│ - ID (opcional: vincula a carta existente)   │                                         └────────────┬────────────┘
│ - Unit, Measured_at, Created_by, Goal        │                                                      │
│ - LSE, LIE                                   │                                         ┌────────────▼────────────┐
│ - Data: [[x1, x2, x3, x4, x5], ...]          │                                         │    Motor CEP (NumPy)    │
└──────────────────────┬───────────────────────┘                                         │  - Limites LSC/LC/LIC   │
                       │ Lê                                                              │  - Regras de Nelson     │
┌──────────────────────▼───────────────────────┐                                         └────────────┬────────────┘
│       Simulador JSON (simulador_json.py)     │                                                      │
│  - Checa se ID existe na base de dados       │                     WebSocket Nativo                 │ Broadcast
│  - Cria nova carta ou conecta à existente    │                   (ws://.../ws/cartas/{id})          │ Imediato
│  - Numeração contínua dos subgrupos (#21...) │                                                      ▼
└──────────────────────────────────────────────┘                                         ┌─────────────────────────┐
                                                                                         │  Frontend (React/Vite)  │
                                                                                         │  - Gráfico ECharts      │
                                                                                         │  - Alertas ao Vivo      │
                                                                                         └─────────────────────────┘
```

---

## ⚙️ 2. Estrutura Oficial do Arquivo JSON

```json
{
  "ID": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "Unit": "mm",
  "Measured_at": "2026-10-09 12:00:00",
  "Created_by": "Henrique",
  "Type": "X",
  "Goal": "Calibrar",
  "LSE": 5.0,
  "LIE": 4.0,
  "Data": [
    [4.96, 4.946, 4.95, 4.956, 4.958],
    [4.958, 4.927, 4.935, 4.94, 4.95],
    [4.971, 4.929, 4.965, 4.952, 4.938]
  ]
}
```

### Significado dos Campos e Mapeamento

* **`ID` (`str | null`, opcional):** Identificador UUID da carta de controle:
  - Se omitido ou `null`: o script cria uma nova carta (**Modo Calibração**).
  - Se informado e presente no banco: conecta-se à carta e anexa os dados (**Modo Acompanhamento**).
  - Se informado mas não encontrado (404): emite aviso e cria nova carta.
* **`Unit` (`str`):** Unidade de medida (ex: `"mm"`). Salva na descrição do processo e carta.
* **`Measured_at` (`str`):** Data base das medições (`YYYY-MM-DD HH:MM:SS`), com offsets incrementais gerados para cada subgrupo.
* **`Created_by` (`str`):** Nome do operador ou usuário técnico responsável.
* **`Type` (`str`):** Tipo de carta solicitado. Quando `"X"`, o sistema seleciona automaticamente entre $\bar{X}-R$ ($n \le 10$) ou $\bar{X}-s$ ($n > 10$) de acordo com a regra **[RN01]**.
* **`Goal` (`str`):** Finalidade do processo (ex: `"Calibrar"`, `"Acompanhamento"`), usada para nomear o processo industrial.
* **`LSE` / `LIE` (`float`):** Limite Superior e Inferior de Especificação.
* **`Data` (`list[list[float]]`):** Matriz contendo os subgrupos amostrais numéricos.

---

## 🚀 3. Instruções Práticas de Uso

### 3.1. Fase 1: Calibração (Criação da Carta)

Execute o script com o arquivo de calibração (sem campo `ID`):

```bash
python backend/scripts/json/simulador_json.py -f backend/scripts/json/dados_simulado_prova_1_0226.json
```

O script criará a carta e informará o UUID no terminal:
```text
🎉 NOVA CARTA DE CONTROLE CRIADA COM SUCESSO! (CALIBRAÇÃO)
🆔 ID DA CARTA: 8f24a1b0-96b4-4b55-bc50-13b7d14d2e88
```

---

### 3.2. Fase 2: Acompanhamento (Mesma Carta)

Adicione o ID da carta gerada no campo `"ID"` do seu arquivo JSON de acompanhamento (conforme [`dados_acompanhamento_exemplo.json`](../../backend/scripts/json/dados_acompanhamento_exemplo.json)) e execute:

```bash
python backend/scripts/json/simulador_json.py -f backend/scripts/json/dados_acompanhamento_exemplo.json
```

O script detectará a carta existente:
```text
🔗 CARTA EXISTENTE LOCALIZADA NA BASE DE DADOS!
🆔 ID da Carta:         8f24a1b0-96b4-4b55-bc50-13b7d14d2e88
📊 Subgrupos Anteriores: 20 já registrados no motor CEP
📌 Modo de Operação:     ACOMPANHAMENTO (novas amostras continuarão o histórico)
```
Os novos subgrupos serão numerados a partir do `#021`, mantendo a linha contínua do gráfico no frontend.

---

### 3.3. Fase 3: Alternância Automática de Limites (`--alternar-modo-limites` / `--fixar-limites`)

Conforme as boas práticas do CEP industrial:
- **Calibração (Fase I):** Limites devem ser **DINÂMICOS**, adaptando-se a cada subgrupo para determinar a linha-base e a capacidade natural do processo.
- **Acompanhamento (Fase II):** Limites devem ser **FIXOS** (congelados), de forma que os novos subgrupos sejam avaliados em relação aos limites de controle já calibrados sem distorcê-los.

Para ativar essa alternância automática, utilize a flag `--alternar-modo-limites` (ou os aliases `--fixar-limites` / `--alternar-modo`):

```bash
python backend/scripts/json/simulador_json.py \
  -f backend/scripts/json/dados_acompanhamento_exemplo.json \
  --alternar-modo-limites
```

**Comportamento:**
1. **Ao receber dados de acompanhamento em carta existente:** o script chama o método `alternar_modo_limites` da classe [`GerenciarCartaService`](../../backend/app/application/services/gerenciar_carta.py) (via `PATCH /api/v1/cartas/{id}/modo`), travando a carta em modo `FIXO`.
2. **Caso sejam enviados novos dados de calibração** (campo `"Goal": "Calibrar"` ou flag `--calibracao`): o script invoca novamente o método com o valor `DINAMICO`, destravando o recálculo contínuo dos limites.

