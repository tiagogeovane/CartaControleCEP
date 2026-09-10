# FEAT-03: Camada de Aplicação & Orquestração de Subgrupos

* **Fase do Roadmap:** [Fase 3 - Camada de Aplicação (Use Cases & Orquestração)](../Roadmap.md#5-fase-3-camada-de-aplicação-use-cases--orquestração)
* **Status:** ✅ Concluído
* **Data de Execução:** 09/09/2026

---

## 1. Visão Geral e Contexto

Esta entrega implementa a **Camada de Aplicação (Use Cases / Application Services)** do backend do **Sistema de Controle Estatístico de Processos (CEP)**, conectando o núcleo matemático puro ([FEAT-01](./01-dominio-motor-cep.md)) e a infraestrutura de persistência relacional MySQL ([FEAT-02](./02-persistencia-relacional-mysql.md)) em fluxos orquestrados e orientados a objetos.

Seguindo estritamente a **Clean Architecture** e os princípios **SOLID**, os casos de uso mantêm o domínio desacoplado dos detalhes de entrega (HTTP, WebSockets) e de persistência física (SQLAlchemy/MySQL). As dependências são injetadas via inversão de controle (**DIP**) através dos contratos abstratos de repositórios (`ICartaControleRepository`, `ISubgrupoRepository`, `IProcessoRepository`) e mensageria (`ISubgrupoObserver`).

---

## 2. O que Foi Implementado

### 2.1. Orquestrador Principal: `ProcessamentoSubgrupoService` (`backend/app/application/services/processar_subgrupo.py`)
Responsável pelo pipeline completo de recebimento, validação, cálculo, avaliação de estabilidade, persistência e notificação:

1. **Validação de Pré-requisitos:** Carrega a entidade agregadora `CartaControle` e valida o tamanho amostral estrito conforme a Regra de Negócio [RN02] (`validar_amostra`), rejeitando divergências via `AmostraInvalidaError`.
2. **Resolução Dinâmica da Estratégia:** Instancia a estratégia estatística apropriada ($\bar{X}-R, \bar{X}-s, I-MR$) através da `CartaStrategyFactory`.
3. **Cálculo de Estatísticas Pontuais:** Obtém média ($\bar{X}$), amplitude ($R$) e desvio padrão ($s$) do subgrupo amostral recebido.
4. **Recálculo Contínuo de Limites (Modo DINÂMICO):** Atualiza a série temporal histórica de médias e dispersões e recalcula $LC, LSC, LIC$ e $\hat{\sigma}$ do processo. Para cartas $I-MR$, calcula dinamicamente a amplitude móvel ($MR$) a partir de 2 leituras.
5. **Avaliação das 8 Regras de Nelson:** Executa o `DetectorRegrasNelson` (Composite) sobre a série temporal contra os limites de controle calculados, identificando pontos fora de controle ($3\sigma$), tendências, alternâncias ou estratificações.
6. **Persistência Transacional:** Cria a entidade `Subgrupo` preenchendo as violações identificadas, persiste no banco relacional via `ISubgrupoRepository` e atualiza os limites da `CartaControle`.
7. **Notificação Reativa (Observer Pattern):** Dispara o evento assíncrono para os `ISubgrupoObserver` cadastrados (preparando o broadcast via WebSockets).
8. **Carga Histórica em Lote (`executar_lote`):** Permite importar sequências de subgrupos (ex: arquivos CSV ou JSON [RF08]), recalculando o histórico incrementalmente e persistindo os registros em lote (`salvar_em_lote`).

---

### 2.2. Gestão de Cartas: `GerenciarCartaService` (`backend/app/application/services/gerenciar_carta.py`)
Encapsula o ciclo de vida e configuração das cartas de controle:

* **Criação de Cartas:** Valida a existência do processo pai via `IProcessoRepository`. Se o tipo de carta não for fornecido, resolve automaticamente a estratégia recomendada com base no tamanho amostral $n$ segundo a Regra [RN01] ($n=1 \to I\text{-}MR$, $2 \le n \le 10 \to \bar{X}\text{-}R$, $n > 10 \to \bar{X}\text{-}s$).
* **Consulta e Listagem:** Recuperação de cartas com histórico por ID (`obter_carta`) e listagem geral ou filtrada por linha/processo (`listar_cartas`).
* **Parametrização de Engenharia:** Atualização de limites de especificação ($LSE, LIE, \text{Nominal}$) e alternância entre modos de limites (`DINAMICO` ou `FIXO`).

---

### 2.3. Análise de Capacidade: `AnaliseCapacidadeService` (`backend/app/application/services/analise_capacidade.py`)
Implementa o cálculo dos índices de capabilidade e estabilidade fabril:

* **Conformidade Estrita com [RN04]:** Valida que a carta possua limites de especificação ($LSE$ e/ou $LIE$), dispersão estimada positiva ($\hat{\sigma} > 0$) e histórico mínimo de medições.
* **Cálculo de Índices:** Delega ao `CalculadorCapacidade` do domínio para computar $C_p$, $C_{pk}$, $C_{pu}$ e $C_{pl}$.
* **Relatório Completo de Qualidade:** Emite parecer analítico avaliando se o processo está sob controle e é capaz ($C_{pk} \ge 1.33$), classificação Seis Sigma e aviso consultivo quando a amostragem for preliminar ($< 20$ subgrupos).
* **Modo Seguro / Não-bloqueante (`calcular_para_carta_seguro`):** Permite anexar índices de capacidade ao payload em tempo real sem interrupção de fluxo caso tolerâncias ainda não tenham sido configuradas.

---

### 2.4. Eventos de Aplicação: `SubgrupoProcessadoEvent` (`backend/app/application/events/subgrupo_events.py`)
Dataclass imutável representando o evento gerado ao final de cada processamento:

* Construtor auxiliar `from_domain(carta, subgrupo, capacidade)`.
* Método `to_dict()` em estrita conformidade com o schema JSON estabelecido na seção 7.2 de `Requisitos.md`:
  ```json
  {
    "event": "NOVO_SUBGRUPO_PROCESSADO",
    "carta_id": "...",
    "timestamp": "2026-09-09T...",
    "numero_subgrupo": 1,
    "estatisticas": { "media_x": 25.0, "amplitude_r": 0.4, "desvio_s": 0.15, "amostras_brutas": [...] },
    "limites": { "lc": 25.0, "lsc": 25.23, "lic": 24.77 },
    "status_controle": { "fora_de_controle": false, "regras_violadas": [] },
    "capacidade": { "cp": 1.6667, "cpk": 1.6667 }
  }
  ```

---

### 2.5. Exceções Padronizadas de Domínio (`backend/app/domain/exceptions.py`)
Hierarquia de exceções semânticas para tratamento uniforme nos endpoints:

* `DominioException` (base)
* `EntidadeNaoEncontradaError` $\to$ `CartaNaoEncontradaError`, `ProcessoNaoEncontradoError`, `UsuarioNaoEncontradoError`
* `AmostraInvalidaError` (tamanho amostral divergente)
* `EspecificacoesNaoDefinidasError` (ausência de LSE/LIE para cálculo de capacidade)
* `DadosInsuficientesError` (dados insuficientes para dispersão ou histórico)
* `RegraNegocioVioladaError`

---

## 3. Relação de Arquivos Criados e Modificados

| Arquivo | Ação | Responsabilidade |
| :--- | :---: | :--- |
| `backend/app/domain/exceptions.py` | Criado | Hierarquia de exceções de domínio e regras de negócio |
| `backend/app/domain/__init__.py` | Modificado | Exportação das novas exceções |
| `backend/app/domain/interfaces/repositories.py` | Modificado | Inclusão de `atualizar_limites` no contrato `ICartaControleRepository` |
| `backend/app/application/events/subgrupo_events.py` | Criado | Evento `SubgrupoProcessadoEvent` com serialização reativa |
| `backend/app/application/events/__init__.py` | Criado | Exportação de eventos da aplicação |
| `backend/app/application/services/processar_subgrupo.py` | Criado | Caso de uso `ProcessamentoSubgrupoService` |
| `backend/app/application/services/gerenciar_carta.py` | Criado | Caso de uso `GerenciarCartaService` |
| `backend/app/application/services/analise_capacidade.py` | Criado | Caso de uso `AnaliseCapacidadeService` |
| `backend/app/application/services/__init__.py` | Criado | Exportação de serviços da aplicação |
| `backend/app/application/__init__.py` | Criado | Exportação central da camada de aplicação |
| `backend/tests/unit/domain/test_interfaces.py` | Modificado | Teste de assinatura atualizado para `atualizar_limites` |
| `backend/tests/unit/application/test_subgrupo_events.py` | Criado | Testes unitários do schema e conversão do evento |
| `backend/tests/unit/application/test_gerenciar_carta.py` | Criado | Testes unitários do ciclo de vida das cartas e [RN01] |
| `backend/tests/unit/application/test_analise_capacidade.py` | Criado | Testes unitários dos índices de capacidade e [RN04] |
| `backend/tests/unit/application/test_processar_subgrupo.py` | Criado | Testes unitários do orquestrador, limites dinâmicos e Nelson |
| `backend/tests/integration/test_application_services.py` | Criado | Teste de integração ponta a ponta dos serviços com MySQL |

---

## 4. Validação e Qualidade

1. **Bateria de Testes Unitários e de Integração:**
   * **Total de Testes:** 138 testes executados e aprovados (`pytest`).
   * **Tempo de Execução:** ~1.8s.
   * **Abrangência:** Testes cobrem o domínio matemático, persistência no MySQL, casos de uso da aplicação e despacho de eventos.

2. **Auditoria de Código Estático (Linter):**
   * Comando: `ruff check .`
   * Resultado: **All checks passed!** (0 avisos ou erros).

---

## 5. Próximos Passos (Fase 4 do Roadmap)

Com a camada de aplicação concluída, o próximo passo do backend é a **Fase 4: Tempo Real Reativo (WebSockets Nativos In-Memory)**:
* Implementar o `ConnectionManager` em memória em `backend/app/infrastructure/real_time/connection_manager.py`.
* Implementar o `WebSocketNotificationObserver` conectando o `ISubgrupoObserver` ao `ConnectionManager`.
* Configurar o endpoint WebSocket em `backend/app/api/v1/websocket.py` para comunicação bi-direcional contínua com o frontend React.
