# FEAT-01: Domínio Puro & Motor de Cálculo Estatístico

* **Fase do Roadmap:** [Fase 1 - Domínio Puro & Motor de Cálculo Estatístico (OOP + TDD)](../Roadmap.md#3-fase-1-domínio-puro--motor-de-cálculo-estatístico-oop--tdd)
* **Status:** ✅ Concluído (Auditado & Corrigido)
* **Data de Execução:** 03/09/2026

---

## 1. Visão Geral e Contexto

Esta entrega implementa o núcleo matemático, as regras estatísticas de negócio e os padrões fundamentais de projeto do backend do **Sistema de Controle Estatístico de Processos (CEP)**, seguindo estritamente a filosofia *Inside-Out* da **Clean Architecture** e os princípios da **Orientação a Objetos (SOLID / GoF)**.


O objetivo central desta fase foi construir um motor de cálculo de alta precisão (utilizando NumPy e SciPy), 100% isolado de bancos de dados, frameworks web e adaptadores externos, coberto por testes unitários exaustivos baseados na literatura canônica de controle estatístico da qualidade (Montgomery).

---

## 2. O que Foi Implementado

### 2.1. Value Objects Imutáveis (`backend/app/domain/value_objects/`)
Implementação de dataclasses imutáveis (`frozen=True`) dotadas de métodos `__post_init__` que protegem invariantes de negócio e cálculos auxiliares:

* **`LimitesControle`** (`limites.py`):
  * Atributos: `lc` (Linha Central), `lsc` (Limite Superior de Controle), `lic` (Limite Inferior de Controle) e `sigma_estimado`.
  * Invariantes validados: $LIC \le LC \le LSC$ e $\sigma \ge 0$.
  * Propriedades calculadas: `amplitude_limites` ($LSC - LC = 3\sigma$) e `sigma_media` ($\sigma_{\bar{X}} = (LSC - LC) / 3$).
* **`LimitesEspecificacao`** (`limites.py`):
  * Atributos: `lse` (Superior), `lie` (Inferior) e `valor_nominal` (tolerâncias de projeto/engenharia).
  * Invariantes: Validação de que ao menos um limite existe, $LIE < LSE$ e $LIE \le \text{nominal} \le LSE$.
* **`EstatisticasSubgrupo`** (`estatisticas.py`):
  * Atributos: `media_x` ($\bar{X}$), `amplitude_r` ($R$), `desvio_s` ($s$) e tupla de `valores_brutos`.
  * Invariantes: $R \ge 0$ e $s \ge 0$.
* **`IndicesCapacidade`** (`capacidade.py`):
  * Atributos: $C_p$, $C_{pk}$, $C_{pu}$ e $C_{pl}$.
  * Métodos: `esta_aprovado(criterio=1.0)` e propriedade `classificacao` (Excelente Seis Sigma $\ge 1.67$, Adequado $\ge 1.33$, Marginal $\ge 1.0$, Incapaz $< 1.0$).
* **`ViolacaoRegra`** (`violacao.py`):
  * Atributos: `codigo_regra`, `descricao`, `numero_subgrupo` e tupla de `pontos_violadores`.
  * Método `to_dict()` para serialização JSON reativa.

---

### 2.2. Strategy Pattern para Cartas de Controle (`backend/app/domain/strategies/`)
Arquitetura extensível e desacoplada baseada no Strategy Pattern para suportar diferentes tamanhos de subgrupo e dinâmicas amostrais:

* **`ICartaControleStrategy`** (`base.py`):
  * Interface abstrata com contratos: `calcular_estatisticas(amostras)` e `calcular_limites(historico_medias, historico_dispersoes, n)`.
* **`CartaXRStrategy`** (`xr_chart.py`):
  * Aplicável para subgrupos de tamanho $2 \le n \le 10$.
  * Utiliza fatores tabelados de Montgomery ($A_2, D_3, D_4, d_2$) e estimativa de desvio $\hat{\sigma} = \bar{R} / d_2$.
  * Permite calcular os limites da carta de médias e da carta de amplitudes ($LIC_R = D_3 \bar{R}$, $LSC_R = D_4 \bar{R}$).
* **`CartaXsStrategy`** (`xs_chart.py`):
  * Recomendada para subgrupos moderados a grandes ($n > 10$), onde o desvio padrão $s$ é um estimador superior a $R$.
  * Cálculo dinâmico e contínuo dos coeficientes $c_4(n)$, $A_3(n)$, $B_3(n)$ e $B_4(n)$ via função Gamma analítica (`scipy.special.gamma`) e aproximação assintótica para $n > 100$.
  * Estimativa $\hat{\sigma} = \bar{s} / c_4$.
* **`CartaIMRStrategy`** (`imr_chart.py`):
  * Dedicada a leituras individuais unitárias ($n = 1$) para processos contínuos ou testes destrutivos.
  * Cálculo iterativo da amplitude móvel $MR_i = |x_i - x_{i-1}|$ para uma janela móvel de $n=2$, com fatores $d_2 = 1.128$ e $D_4 = 3.267$.
* **`CartaStrategyFactory`** (`factory.py`):
  * Implementação baseada no **Registry Pattern** através de um dicionário tipado com `ClassVar`.
  * Permite registrar novas estratégias diretamente ou via decorador (`@CartaStrategyFactory.registrar("TIPO")`) em conformidade com o princípio Open/Closed (OCP).
  * Resolve a estratégia correspondente aplicando a regra de negócio [RN01] automaticamente quando o tipo não é informado explicitamente, além de tratar transição estatística para $n > 10$ e rejeição de tipos não registrados com mensagem descritiva.

---

### 2.3. Detector das 8 Regras de Nelson (`backend/app/domain/rules/`)
Implementação completa das 8 regras empíricas de Nelson para detecção instantânea de causas especiais de instabilidade:

* **`IRegraNelson`** (`base.py`): Interface abstrata (`codigo`, `descricao`, `pontos_minimos`, `avaliar()`).
* **`Regra1TresSigma`** (`nelson_rules.py`): Ponto fora dos limites $3\sigma$ (além de LSC ou LIC).
* **`Regra2NoveMesmoLado`** (`nelson_rules.py`): 9 pontos consecutivos no mesmo lado da Linha Central (deslocamento de média).
* **`Regra3SeisTendencia`** (`nelson_rules.py`): 6 pontos consecutivos estritamente crescentes ou estritamente decrescentes.
* **`Regra4QuatorzeAlternados`** (`nelson_rules.py`): 14 pontos consecutivos alternando sucessivamente para cima e para baixo.
* **`Regra5DoisDeTresZonaA`** (`nelson_rules.py`): 2 de 3 pontos consecutivos além de $2\sigma$ no mesmo lado.
* **`Regra6QuatroDeCincoZonaB`** (`nelson_rules.py`): 4 de 5 pontos consecutivos além de $1\sigma$ no mesmo lado.
* **`Regra7QuinzeZonaC`** (`nelson_rules.py`): 15 pontos consecutivos dentro de $\pm 1\sigma$ (efeito estratificação).
* **`Regra8OitoForaZonaC`** (`nelson_rules.py`): 8 pontos consecutivos além de $\pm 1\sigma$ em qualquer lado sem nenhum ponto na Zona C (efeito mistura).
* **`DetectorRegrasNelson`** (`detector.py`):
  * Composite agregador que permite ativar, desativar e executar dinamicamente o conjunto de regras sobre a série temporal de médias.

---

### 2.4. Entidades Ricas de Domínio (`backend/app/domain/entities/`)
* **`CartaControle`** (`carta.py`): Agregado principal contendo UUID, amarração ao processo, validação de tamanho de subgrupo [RN02], gestão de subgrupos e consulta de séries históricas.
* **`Subgrupo`** (`subgrupo.py`): Entidade que agrupa valores brutos, timestamp UTC, estatísticas calculadas, status `fora_de_controle` e coleção de violações de regras com método `to_dict()`.
* **`Processo`** (`processo.py`): Entidade que encapsula a linha de produção ou processo industrial.

---

### 2.5. Serviços de Domínio e Contratos (`domain/services/` e `domain/interfaces/`)
* **`CalculadorCapacidade`** (`services/capacidade.py`): Serviço puro para cálculo de $C_p, C_{pk}, C_{pu}, C_{pl}$ com base em $\mu$, $\hat{\sigma}$ e `LimitesEspecificacao`.
* **Contratos de Persistência** (`interfaces/repositories.py`):
  * `ICartaControleRepository` (`obter_por_id`, `salvar`, `listar_todas`).
  * `ISubgrupoRepository` (`salvar`, `salvar_em_lote`, `listar_por_carta`).
  * `IProcessoRepository` (`obter_por_id`, `salvar`, `listar_todos`).
* **Contrato de Mensageria Reativa** (`interfaces/observers.py`):
  * `ISubgrupoObserver` (`notificar_processamento`).

---

## 3. Diagnóstico e Resolução do Erro Encontrado

### 3.1. Causa da Interrupção do Agente Anterior
Durante a execução do passo anterior, a ferramenta de análise estática de código (`ruff check .`) acusou **4 erros críticos** no arquivo `backend/app/domain/strategies/xr_chart.py`:

```text
RUF012 Mutable default value for class attribute
  --> backend/app/domain/strategies/xr_chart.py:18:34
  A2_TABLE: dict[int, float] = { ... }
help: Consider initializing in `__init__` or annotating with `typing.ClassVar`
```

O erro decorre da regra `RUF012`, que previne atributos mutáveis de classe (como dicionários) de serem compartilhados ou modificados indevidamente entre instâncias sem anotação explícita de classe. Devido a essa falha no linter, o pipeline do agente anterior travou antes da geração deste documento em `docs/Backend/feats/` e da atualização dos índices do projeto.

### 3.2. Correção Aplicada
O arquivo [backend/app/domain/strategies/xr_chart.py](../../backend/app/domain/strategies/xr_chart.py) foi ajustado com a importação de `ClassVar` do módulo `typing`, tipando explicitamente as tabelas de coeficientes:

```python
from typing import ClassVar

class CartaXRStrategy(ICartaControleStrategy):
    A2_TABLE: ClassVar[dict[int, float]] = { ... }
    D3_TABLE: ClassVar[dict[int, float]] = { ... }
    D4_TABLE: ClassVar[dict[int, float]] = { ... }
    D2_TABLE: ClassVar[dict[int, float]] = { ... }
```

Após a alteração, o comando `ruff check .` passou com **0 erros**.

---

## 4. Relação Completa de Arquivos

| Arquivo | Ação | Responsabilidade |
| :--- | :---: | :--- |
| `backend/app/domain/value_objects/limites.py` | Criado | `LimitesControle` e `LimitesEspecificacao` com invariantes |
| `backend/app/domain/value_objects/estatisticas.py` | Criado | `EstatisticasSubgrupo` ($\bar{X}, R, s$) |
| `backend/app/domain/value_objects/capacidade.py` | Criado | `IndicesCapacidade` ($C_p, C_{pk}$) e classificações |
| `backend/app/domain/value_objects/violacao.py` | Criado | `ViolacaoRegra` e serialização JSON |
| `backend/app/domain/strategies/base.py` | Criado | Interface abstrata `ICartaControleStrategy` |
| `backend/app/domain/strategies/xr_chart.py` | Criado / Corrigido | Estratégia $\bar{X}-R$ com tabelas Montgomery e tipagem `ClassVar` |
| `backend/app/domain/strategies/xs_chart.py` | Criado | Estratégia $\bar{X}-s$ com cálculo analítico Gamma ($c_4, A_3, B_3, B_4$) |
| `backend/app/domain/strategies/imr_chart.py` | Criado | Estratégia $I-MR$ para leituras individuais e amplitudes móveis |
| `backend/app/domain/strategies/factory.py` | Criado | `CartaStrategyFactory` com resolução de regras de negócio |
| `backend/app/domain/rules/base.py` | Criado | Interface abstrata `IRegraNelson` |
| `backend/app/domain/rules/nelson_rules.py` | Criado | Implementação das 8 Regras de Nelson |
| `backend/app/domain/rules/detector.py` | Criado | Composite `DetectorRegrasNelson` |
| `backend/app/domain/entities/subgrupo.py` | Criado | Entidade `Subgrupo` |
| `backend/app/domain/entities/carta.py` | Criado | Entidade `CartaControle` com histórico e validações |
| `backend/app/domain/entities/processo.py` | Criado | Entidade `Processo` |
| `backend/app/domain/services/capacidade.py` | Criado | Serviço de domínio `CalculadorCapacidade` |
| `backend/app/domain/interfaces/repositories.py` | Criado | Contratos abstratos de repositório |
| `backend/app/domain/interfaces/observers.py` | Criado | Contrato abstrato `ISubgrupoObserver` |
| `backend/tests/unit/domain/test_value_objects.py` | Criado | 16 testes de invariantes de Value Objects |
| `backend/tests/unit/domain/test_entities.py` | Criado | 10 testes das entidades de domínio |
| `backend/tests/unit/cep/test_xr_chart.py` | Criado | 7 testes com dados de referência Montgomery |
| `backend/tests/unit/cep/test_xs_chart.py` | Criado | 5 testes analíticos para $\bar{X}-s$ |
| `backend/tests/unit/cep/test_imr_chart.py` | Criado | 5 testes para dados individuais $I-MR$ |
| `backend/tests/unit/cep/test_nelson_rules.py` | Criado | 17 testes isolados para as 8 Regras de Nelson |
| `backend/tests/unit/cep/test_capacidade.py` | Criado | 4 testes de capacidade ($C_p, C_{pk}$) |
| `docs/Backend/feats/01-dominio-motor-cep.md` | Criado | Este documento descritivo |
| `docs/Backend/feats/README.md` | Modificado | Atualização do índice de features |
| `docs/Backend/Roadmap.md` | Modificado | Atualização dos checkboxes de status da Fase 1 |

---

## 5. Resultados de Validação

### 5.1. Execução de Testes Automatizados (`pytest`)
```text
============================= test session starts ==============================
rootdir: /home/tiago/Documents/Controle Estatistico de Processos
configfile: pytest.ini
testpaths: backend/tests
plugins: asyncio-1.4.0, anyio-4.15.0
collected 71 items

backend/tests/integration/test_database_connection.py .                  [  1%]
backend/tests/unit/cep/test_capacidade.py ....                           [  7%]
backend/tests/unit/cep/test_imr_chart.py .....                           [ 14%]
backend/tests/unit/cep/test_nelson_rules.py .................            [ 38%]
backend/tests/unit/cep/test_xr_chart.py .......                          [ 47%]
backend/tests/unit/cep/test_xs_chart.py .....                            [ 54%]
backend/tests/unit/domain/test_entities.py ...............               [ 76%]
backend/tests/unit/domain/test_value_objects.py ................         [ 98%]
backend/tests/unit/test_config.py .                                      [100%]

============================== 71 passed in 1.08s ==============================
```

### 5.2. Checagem de Qualidade de Código (`ruff`)
```text
./backend/.venv/bin/ruff check .
All checks passed!
```

---

## 6. O que Ainda Falta / Próximos Passos

Com a conclusão da **Fase 1**, todos os requisitos matemáticos e de regras de domínio estão 100% implementados, testados e com linter limpo.

O próximo passo no desenvolvimento é a **Fase 2: Persistência & Modelagem Relacional (MySQL 8.0)**:
1. **Configuração da Sessão de Banco de Dados (`backend/app/core/database.py`):**
   * Configurar `create_async_engine` e `async_sessionmaker` utilizando driver `asyncmy`.
   * Implementar dependency generator `get_db_session()`.
2. **Modelos ORM SQLAlchemy (`backend/app/infrastructure/persistence/models/`):**
   * `UsuarioModel` (`id`, `nome`, `email`, `senha_hash`, `perfil`).
   * `ProcessoModel` (`id`, `nome`, `codigo_linha`, `descricao`).
   * `CartaControleModel` (`id`, `processo_id`, `tipo_carta`, `tamanho_subgrupo`, limites).
   * `SubgrupoModel` (`id`, `carta_id`, `numero_subgrupo`, `media_x`, `regras_violadas` como JSON nativo MySQL).
   * `AmostraItemModel` (`id`, `subgrupo_id`, `valor_medido`, `ordem_coleta`).
   * `OcorrenciaCausaEspModel` (`id`, `subgrupo_id`, `operador_id`, `causa_raiz`, `acao_corretiva`).
3. **Migrações Assíncronas com Alembic (`backend/alembic/`):**
   * Configurar `env.py` assíncrono conectado ao `Base.metadata`.
   * Gerar migração inicial `criar_tabelas_iniciais_cep` e executar `alembic upgrade head`.
4. **Implementação Concreta dos Repositórios (`backend/app/infrastructure/persistence/repositories/`):**
   * `MySQLCartaControleRepository` implementando `ICartaControleRepository`.
   * `MySQLSubgrupoRepository` implementando `ISubgrupoRepository`.
5. **Testes de Integração com Banco Real:**
   * Testar criação e consulta de cartas e gravação transacional de subgrupos com medições no MySQL.
