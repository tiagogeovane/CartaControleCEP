# Diagnóstico de Cobertura de Testes (Pytest Coverage)

* **Data da Análise:** 03/09/2026
* **Ambiente:** Backend - Controle Estatístico de Processos (CEP)
* **Meta Estipulada:** $\ge 95\%$
* **Cobertura Inicial Diagnosticada:** **89.40%** (Déficit de ~5.6%)
* **Cobertura Atual Aferida:** **100.00%** (Meta superada)
* **Status:** ✅ Plano Executado com Sucesso (96/96 testes aprovados, 100% de cobertura)

---

## 1. Resumo Executivo & Tabela de Cobertura

A execução da suíte de testes com a ferramenta `pytest-cov` sobre o diretório `backend/app` gerou os seguintes resultados:

* **Total de Declarações (Statements):** 689
* **Declarações Executadas:** 616
* **Declarações Não Cobertas (Miss):** 73
* **Percentual Global:** **89.40%**

### Relatório Detalhado por Módulo

| Módulo | Stmts | Miss | Cobertura | Linhas Não Cobertas |
| :--- | :---: | :---: | :---: | :--- |
| `backend/app/domain/interfaces/repositories.py` | 30 | 30 | **0%** | 1-59 (Arquivo inteiro) |
| `backend/app/domain/interfaces/observers.py` | 6 | 6 | **0%** | 1-11 (Arquivo inteiro) |
| `backend/app/domain/interfaces/__init__.py` | 3 | 3 | **0%** | 1-8 (Arquivo inteiro) |
| `backend/app/domain/entities/subgrupo.py` | 31 | 6 | **81%** | 24, 26, 28, 37-39 |
| `backend/app/domain/value_objects/capacidade.py` | 22 | 3 | **86%** | 16, 23, 29 |
| `backend/app/domain/strategies/xs_chart.py` | 57 | 7 | **88%** | 23, 26, 48, 72, 75, 78, 104 |
| `backend/app/domain/entities/carta.py` | 38 | 4 | **89%** | 24, 45, 50-51 |
| `backend/app/domain/strategies/imr_chart.py` | 35 | 3 | **91%** | 39, 50, 56 |
| `backend/app/domain/rules/detector.py` | 26 | 2 | **92%** | 44, 59 |
| `backend/app/domain/services/capacidade.py` | 24 | 2 | **92%** | 47-48 |
| `backend/app/domain/strategies/xr_chart.py` | 45 | 2 | **96%** | 128, 153 |
| `backend/app/domain/rules/nelson_rules.py` | 185 | 5 | **97%** | 29, 188, 254, 298, 342 |
| *Demais módulos de domínio / core* | 207 | 0 | **100%** | — |
| **TOTAL CONSOLIDADO** | **689** | **73** | **89.40%** | |

---

## 2. Diagnóstico das Causas Raiz

O déficit de 73 linhas divide-se em três grupos fundamentais:

### Causa 1: Contratos e Interfaces Abstratas Não Importados (39 linhas / 53.4% do déficit)
* **Arquivos afetados:** `interfaces/repositories.py` (30 misses), `interfaces/observers.py` (6 misses), `interfaces/__init__.py` (3 misses).
* **Motivo:** Esses módulos definem contratos abstratos (`ABC` com `@abstractmethod`) destinados à camada de infraestrutura/persistência (MySQL e WebSockets). Como o projeto finalizou a **Fase 1 (Domínio Puro)** e ainda não iniciou a **Fase 2 (Persistência)**, nenhum teste ou serviço importa ou instancia essas interfaces. Consequentemente, o interpretador Python sequer executa as instruções de declaração dessas classes durante o pytest.

---

### Causa 2: Caminhos de Exceção e Casos de Borda Não Exercitados (23 linhas / 31.5% do déficit)
O código de domínio possui validações defensivas ricas (`__post_init__` e checagens prévias), mas a suíte atual de testes concentrou-se principalmente no "caminho feliz" (happy path) e em dados canônicos de Montgomery:

1. **`backend/app/domain/entities/subgrupo.py` (6 linhas):**
   * Linha 24: `numero_subgrupo < 1` (ex: passar 0 ou negativo) não é testado.
   * Linha 26: `not self.valores_brutos` (lista vazia) não é testado.
   * Linha 28: Instanciação inicial já contendo violações (`len(self.violacoes) > 0`) não é testada no `__post_init__`.
   * Linhas 37-39: Método `adicionar_violacoes(lista)` (em lote) nunca foi invocado nos testes (apenas a versão unitária `adicionar_violacao`).

2. **`backend/app/domain/entities/carta.py` (4 linhas):**
   * Linha 24: `tamanho_subgrupo < 1` não é testado com valor inválido.
   * Linha 45: `obter_historico_dispersoes()` para cartas do tipo `"X_S"` nunca é chamada nos testes de entidade.
   * Linhas 50-51: Método `obter_ultimas_medias(quantidade)` nunca foi chamado.

3. **`backend/app/domain/strategies/xs_chart.py` (7 linhas):**
   * Linha 23: `calcular_c4` com $n < 2$.
   * Linha 26: Aproximação assintótica de $c_4$ para grandes amostras ($n > 100$).
   * Linha 48: `calcular_estatisticas` com menos de 2 amostras.
   * Linhas 72, 75, 78: Exceções em `calcular_limites` para listas vazias, tamanhos divergentes ou $n < 2$.
   * Linha 104: Exceção em `calcular_limites_desvio` para histórico vazio.

4. **`backend/app/domain/strategies/imr_chart.py` (3 linhas):**
   * Linha 39: `calcular_amplitudes_moveis` com menos de 2 observações (retornar lista vazia).
   * Linha 50: `calcular_limites` com histórico menor que 2 observações.
   * Linha 56: `calcular_limites` recebendo `historico_dispersoes` pré-calculado.

5. **`backend/app/domain/strategies/xr_chart.py` (2 linhas):**
   * Linha 128: Tentativa de calcular limites com $n > 15$ (fora da tabela de Montgomery).
   * Linha 153: `calcular_limites_amplitude` com histórico de dispersões vazio.

6. **`backend/app/domain/services/capacidade.py` (2 linhas):**
   * Linhas 47-48: Processo com especificação unilateral exclusivamente inferior (apenas `lie` fornecido, sem `lse`).

7. **`backend/app/domain/value_objects/capacidade.py` (3 linhas):**
   * Linha 16: `esta_aprovado()` quando `cpk is None`.
   * Linha 23: `classificacao` quando `cpk is None` (retornar `"Indeterminado"`).
   * Linha 29: `classificacao` quando $1.00 \le C_{pk} < 1.33$ (retornar `"Marginalmente Capaz"`).

8. **`backend/app/domain/rules/detector.py` (2 linhas):**
   * Linha 44: Método `adicionar_regra(regra)`.
   * Linha 59: `avaliar` chamado com histórico vazio de médias.

---

### Causa 3: Casos Negativos nas Regras de Nelson (11 linhas / 15.1% do déficit)
* **`backend/app/domain/rules/nelson_rules.py` (5 linhas):**
  * Linha 29: Regra 1 chamada com histórico vazio (`len < 1`).
  * Linha 188: Regra 5 chamada com histórico menor que 3 pontos (`len < 3`).
  * Linhas 254, 298, 342: Casos onde as Regras 6, 7 e 8 avaliam séries de dados válidas mas que **não violam** os critérios, precisando retornar explicitamente `None`.

---

## 3. Solução Proposta (Plano de Ação)

Para elevar a cobertura de **89.4%** para **> 98%**, propõe-se uma abordagem em 3 frentes sem qualquer perda de rigor técnico:

### Ação 1: Configuração do Coverage (`pyproject.toml` ou `setup.cfg`)
Configurar pragmas padrão do `coverage` para ignorar código não executável por design:
```toml
[tool.coverage.report]
exclude_lines = [
    "pragma: no cover",
    "@abstractmethod",
    "raise NotImplementedError",
    "if TYPE_CHECKING:",
    "\\.\\.\\.",
]
```
* **Impacto:** Evita penalizar métodos de interfaces abstratas que por definição não contêm corpo executável.

---

### Ação 2: Testes de Conformidade das Interfaces de Domínio
Criar `backend/tests/unit/domain/test_interfaces.py` para exercitar o carregamento dos contratos e do pacote `app.domain.interfaces`:
* Importar `ICartaControleRepository`, `ISubgrupoRepository`, `IProcessoRepository` e `ISubgrupoObserver`.
* Validar que as interfaces herdam de `ABC` e exigem implementação dos métodos abstratos.
* **Ganho:** +39 declarações cobertas (elimina 53.4% do déficit).

---

### Ação 3: Complementação dos Testes Unitários Existentes

#### Em `backend/tests/unit/domain/test_entities.py`:
* Testar exceção de `tamanho_subgrupo < 1` em `CartaControle`.
* Testar `obter_historico_dispersoes` com `tipo_carta="X_S"`.
* Testar `obter_ultimas_medias(quantidade)`.
* Testar validações de `Subgrupo`: `numero_subgrupo <= 0`, `valores_brutos` vazios, e inicialização com `violacoes`.
* Testar `Subgrupo.adicionar_violacoes(lista)`.

#### Em `backend/tests/unit/cep/test_xr_chart.py`:
* Testar `calcular_limites` com $n > 15$ esperando `ValueError`.
* Testar `calcular_limites_amplitude` com lista vazia esperando `ValueError`.

#### Em `backend/tests/unit/cep/test_xs_chart.py`:
* Testar `calcular_c4(1)` esperando `ValueError`.
* Testar `calcular_c4(101)` (ramo da aproximação assintótica).
* Testar `calcular_estatisticas` com 1 elemento esperando `ValueError`.
* Testar `calcular_limites` com listas vazias, listas com tamanhos desiguais e $n < 2$.
* Testar `calcular_limites_desvio` com lista vazia.

#### Em `backend/tests/unit/cep/test_imr_chart.py`:
* Testar `calcular_amplitudes_moveis` com 1 elemento (retornando lista vazia).
* Testar `calcular_limites` com histórico $< 2$ esperando `ValueError`.
* Testar `calcular_limites` passando `historico_dispersoes` preenchido.

#### Em `backend/tests/unit/cep/test_capacidade.py`:
* Testar cálculo de capacidade com especificação apenas inferior (`lie` preenchido e `lse=None`).
* Testar `IndicesCapacidade.esta_aprovado()` e `.classificacao` com `cpk=None`.
* Testar `.classificacao` para a faixa $1.00 \le C_{pk} < 1.33$ ("Marginalmente Capaz").

#### Em `backend/tests/unit/cep/test_nelson_rules.py`:
* Testar `Regra1TresSigma` com lista vazia.
* Testar `Regra5DoisDeTresZonaA` com lista de tamanho $< 3$.
* Testar casos não violadores (esperando `None`) para Regras 6, 7 e 8.
* Em `DetectorRegrasNelson`: testar `adicionar_regra()` e `avaliar([])`.

---

## 4. Projeção Pós-Implementação

| Cenário | Stmts Cobertos | Miss | Cobertura Estimada |
| :--- | :---: | :---: | :---: |
| **Atual** | 616 / 689 | 73 | **89.40%** |
| **Apenas Ação 2 (Interfaces)** | 655 / 689 | 34 | **95.06%** ✅ |
| **Ações 1, 2 e 3 Completas** | 689 / 689 | 0 | **100.00%** 🎯 |

---

## 5. Resultados Finais Obtidos (Pós-Implementação)

O plano de ação proposto foi integralmente executado:
1. Criação do arquivo `.coveragerc` com padrões canônicos para classes abstratas e checagem estática de tipos.
2. Criação da suíte `test_interfaces.py` para carregamento e conformidade de contratos.
3. Inclusão dos testes de casos de borda e validações em `test_entities.py`, `test_xr_chart.py`, `test_xs_chart.py`, `test_imr_chart.py`, `test_capacidade.py` e `test_nelson_rules.py`.

### Relatório Final do `pytest-cov`

```text
Name                                                              Stmts   Miss  Cover   Missing
-----------------------------------------------------------------------------------------------
backend/app/core/config.py                                           12      0   100%
backend/app/domain/__init__.py                                       11      0   100%
backend/app/domain/entities/__init__.py                               4      0   100%
backend/app/domain/entities/carta.py                                 38      0   100%
backend/app/domain/entities/processo.py                              15      0   100%
backend/app/domain/entities/subgrupo.py                              31      0   100%
backend/app/domain/interfaces/__init__.py                             3      0   100%
backend/app/domain/interfaces/observers.py                            4      0   100%
backend/app/domain/interfaces/repositories.py                         9      0   100%
backend/app/domain/rules/__init__.py                                  4      0   100%
backend/app/domain/rules/base.py                                      5      0   100%
backend/app/domain/rules/detector.py                                 26      0   100%
backend/app/domain/rules/nelson_rules.py                            185      0   100%
backend/app/domain/services/__init__.py                               2      0   100%
backend/app/domain/services/capacidade.py                            24      0   100%
backend/app/domain/strategies/__init__.py                             6      0   100%
backend/app/domain/strategies/base.py                                 5      0   100%
backend/app/domain/strategies/factory.py                             49      0   100%
backend/app/domain/strategies/imr_chart.py                           35      0   100%
backend/app/domain/strategies/xr_chart.py                            45      0   100%
backend/app/domain/strategies/xs_chart.py                            57      0   100%
backend/app/domain/value_objects/__init__.py                          5      0   100%
backend/app/domain/value_objects/capacidade.py                       22      0   100%
backend/app/domain/value_objects/estatisticas.py                     11      0   100%
backend/app/domain/value_objects/limites.py                          33      0   100%
backend/app/domain/value_objects/violacao.py                          8      0   100%
-----------------------------------------------------------------------------------------------
TOTAL                                                               649      0   100%
============================== 96 passed in 1.14s ==============================
```

* **Total de Testes:** 96 testes unitários passando.
* **Cobertura Alcançada:** **100.00%** (Meta de $\ge 95\%$ superada com folga).
* **Qualidade de Código (`ruff`):** 0 erros / 0 avisos.
