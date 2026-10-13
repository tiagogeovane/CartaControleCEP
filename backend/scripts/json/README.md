# Script de Ingestão de Dados via JSON (Motor CEP)

Este diretório contém o script [`simulador_json.py`](./simulador_json.py), que atua como porta de entrada de medições para o motor de **Controle Estatístico de Processos (CEP)** lendo a estrutura oficial de arquivos JSON definida para os testes industriais.

O script suporta o fluxo industrial completo em duas fases:
1. **Calibração (Fase 1):** O script lê um JSON sem o campo `"ID"` (ou com `"ID": null`). Ele cria uma nova carta de controle na base de dados, calcula os limites estatísticos ($LC, LSC, LIC$) e exibe com destaque o **UUID da carta gerada**.
2. **Acompanhamento (Fase 2):** O usuário informa esse mesmo `"ID"` em um JSON posterior de acompanhamento. O script detecta a carta existente no banco de dados e transmite os novos subgrupos diretamente para ela, continuando o histórico analítico e a detecção das Regras de Nelson.

---

## 📁 Arquivos no Diretório

| Arquivo | Descrição |
| :--- | :--- |
| [`simulador_json.py`](./simulador_json.py) | Script principal de ingestão, autenticação e transmissão dos dados para a API REST. |
| [`dados_simulado_prova_1_0226.json`](./dados_simulado_prova_1_0226.json) | **Arquivo oficial da prova (Calibração):** 20 subgrupos ($n=5$), $LIE=4.0, LSE=5.0$, sem ID (cria nova carta). |
| [`dados_acompanhamento_exemplo.json`](./dados_acompanhamento_exemplo.json) | **Exemplo de Acompanhamento:** Demonstra o uso do campo `"ID"` para continuar o monitoramento de uma carta existente. |
| [`exemplo_dados.json`](./exemplo_dados.json) | Exemplo reduzido de referência (5 subgrupos) com campo opcional `"ID": null`. |
| [`dados_teste.json`](./dados_teste.json) | Bateria com 35 subgrupos contendo perturbações estatísticas para validar o disparo das **Regras 1, 2 e 3 de Nelson**. |
| [`dados_teste_simples.json`](./dados_teste_simples.json) | Exemplo de matriz numérica pura (`[[...], [...]]`) para compatibilidade com dados brutos. |

---

## 📋 Estrutura Padrão do JSON

Todos os arquivos seguem rigorosamente a estrutura abaixo:

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

### Detalhamento dos Campos

| Campo | Tipo | Obrigatório? | Descrição e Comportamento no Sistema |
| :--- | :--- | :--- | :--- |
| **`ID`** | `string \| null` | **Opcional** | **UUID da Carta de Controle:**<br>• Se omitido ou `null`: cria uma nova carta (**Modo Calibração**).<br>• Se informado e **existir no banco**: conecta-se à carta e anexa os dados (**Modo Acompanhamento**).<br>• Se informado e **não existir no banco**: emite aviso e cria uma nova carta automaticamente. |
| **`Unit`** | `string` | Sim | Unidade de medida física (ex: `"mm"`, `"kg"`, `"V"`). Salva nos metadados. |
| **`Measured_at`** | `string` | Sim | Data e hora base da medição (`YYYY-MM-DD HH:MM:SS`). Gera timestamps incrementais. |
| **`Created_by`** | `string` | Sim | Nome do operador ou engenheiro responsável. |
| **`Type`** | `string` | Sim | Tipo de carta (quando `"X"`, seleciona `X_R` para $n \le 10$ ou `X_S` para $n > 10$ via **[RN01]**). |
| **`Goal`** | `string` | Sim | Objetivo operacional (ex: `"Calibrar"`, `"Acompanhamento"`), usado para identificar o processo. |
| **`LSE`** | `float` | Sim | Limite Superior de Especificação de engenharia. |
| **`LIE`** | `float` | Sim | Limite Inferior de Especificação de engenharia. |
| **`Data`** | `array[][]` | Sim | Matriz com os subgrupos amostrais para o cálculo estatístico. |

---

## 🔄 Fluxo Completo: Calibração ➔ Acompanhamento

### Passo 1: Enviar dados de Calibração (Gera nova carta e limites)

Execute o script com os dados iniciais (sem campo `"ID"` no JSON):

```bash
python backend/scripts/json/simulador_json.py -f backend/scripts/json/dados_simulado_prova_1_0226.json
```

O script exibirá no terminal:
```text
🎉 NOVA CARTA DE CONTROLE CRIADA COM SUCESSO! (CALIBRAÇÃO)
🆔 ID DA CARTA: 8f24a1b0-96b4-4b55-bc50-13b7d14d2e88
💡 DICA: Para enviar dados de acompanhamento posteriores para esta mesma carta,
   adicione o campo "ID" no seu JSON:
   "ID": "8f24a1b0-96b4-4b55-bc50-13b7d14d2e88"
```

---

### Passo 2: Enviar dados de Acompanhamento (Para a mesma carta)

1. Crie seu JSON de acompanhamento (ou edite [`dados_acompanhamento_exemplo.json`](./dados_acompanhamento_exemplo.json)) inserindo o ID obtido:

```json
{
  "ID": "8f24a1b0-96b4-4b55-bc50-13b7d14d2e88",
  "Goal": "Acompanhamento",
  "Data": [
    [4.962, 4.958, 4.965, 4.960, 4.955],
    [4.970, 4.965, 4.968, 4.962, 4.966]
  ]
}
```

2. Execute o script apontando para esse JSON:

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

E as novas amostras serão numeradas como subgrupo `#021`, `#022`... dando continuidade contínua ao controle do processo!

---

## 🚀 Outras Opções de Execução

- **Forçar criação de nova carta isolada mesmo se o JSON contiver ID:**
  ```bash
  python backend/scripts/json/simulador_json.py --nova-carta -f meu_arquivo.json
  ```

- **Sobrescrever ID via linha de comando:**
  ```bash
  python backend/scripts/json/simulador_json.py --carta-id "8f24a1b0-96b4-4b55-bc50-13b7d14d2e88" -f meu_arquivo.json
  ```

- **Importação instantânea em lote (`--lote`):**
  ```bash
  python backend/scripts/json/simulador_json.py --lote -f meu_arquivo.json
  ```
