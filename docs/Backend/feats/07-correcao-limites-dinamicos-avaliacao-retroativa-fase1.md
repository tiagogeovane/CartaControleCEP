# FEAT-07: Correção de Limites Dinâmicos, Avaliação Retroativa (Fase 1 CEP) e Sincronização de Regras de Nelson

* **Módulo:** Backend (Domain, Application, Infrastructure, API) & Frontend (ECharts, PDF, Ingestão)
* **Status:** ✅ Concluído
* **Data de Execução:** 14/10/2026

---

## 1. Visão Geral e Contexto

No Controle Estatístico de Processos (CEP), a operação é dividida em duas fases fundamentais:
* **Fase 1 (Calibração / Estudo Inicial):** O processo está sendo caracterizado. À medida que novos subgrupos são coletados (modo `DINAMICO`), os limites de controle devem ser continuamente recalculados com base em 100% dos dados históricos disponíveis. Além disso, sempre que os limites se alteram, **todos os subgrupos anteriores devem ser reavaliados retroativamente** contra os novos limites consolidados.
* **Fase 2 (Monitoramento Contínuo):** Os limites já foram homologados (modo `FIXO`). Eles não se alteram mais e apenas os novos subgrupos que chegam são avaliados incrementalmente contra esses limites estáveis.

### Problemas Críticos Identificados Anteriormente:
1. **Congelamento Indevido de Limites no 5º Subgrupo:** Ao atingir o tamanho mínimo de subgrupos, a entidade congelava os limites e não atualizava mais nos subgrupos subsequentes (#006 a #020), gerando limites parciais defasados.
2. **Ausência de Avaliação Retroativa:** Subgrupos iniciais mantinham violações baseadas em limites parciais provisórios, ou deixavam de apontar violações evidentes perante os limites consolidados finais.
3. **Inconsistência de Escala Sigma nas Regras de Nelson:** Algumas regras calculavam as zonas utilizando diretamente o desvio padrão individual ($\hat{\sigma} = \bar{R} / d_2$) em vez do desvio padrão da média da carta ($\sigma_{\bar{X}} = (LSC - LC) / 3.0$), causando falsos positivos ou falsos negativos na classificação de zonas $A$, $B$ e $C$.
4. **Dessincronização de Limites de Dispersão:** A carta secundária (Amplitude $R$ ou Desvio $s$) não possuía sincronização de limites e detecção de violações quando subgrupos extrapolavam o limite superior de dispersão ($LSC_R$).

---

## 2. O que Foi Implementado

### 2.1. Domínio Puro e Strategies (Clean Architecture)
* **Recálculo Contínuo de Limites (`CartaControle`):** Se `carta.modo_limites == "DINAMICO"` e a quantidade de subgrupos for $\ge 2$, os limites são recalculados para todo o histórico acumulado.
* **Motor de Avaliação Retroativa (`CartaControle.reavaliar_historico_completo`):**
  * Itera cronologicamente sobre todos os subgrupos da carta.
  * Avalia as médias acumuladas até cada ponto com o `DetectorRegrasNelson`, utilizando os limites finais consolidados da carta.
  * Avalia violações na carta de dispersão ($R > LSC_R$ ou $R < LIC_R$).
  * Atualiza o atributo `fora_de_controle` e a coleção de `violacoes` de cada subgrupo.
* **Escala Sigma Correta nas Regras de Nelson (`nelson_rules.py` e `detector.py`):**
  * Todas as regras zonais utilizam `sigma_carta = (limites.lsc - limites.lc) / 3.0`.
  * Regra 1 avalia contra $LSC$ e $LIC$ com tolerância estrita de ponto flutuante ($10^{-9}$).
  * Regras 5, 6, 7 e 8 utilizam as faixas zonais calculadas rigorosamente a partir de $\sigma_{\bar{X}}$.
* **Suporte a Limites de Dispersão no Value Object (`LimitesControle`):** Adição de `lc_dispersao`, `lsc_dispersao` e `lic_dispersao` como atributos opcionais e imutáveis.

### 2.2. Camada de Aplicação e Serviços
* **`ProcessamentoSubgrupoService`:**
  * No modo `DINAMICO`, recalcula limites a cada subgrupo ou ao final de uma ingestão em lote (`executar_lote`).
  * Executa a avaliação retroativa de todo o histórico.
  * Otimização de batch: em ingestões de múltiplos subgrupos (ex.: 20 amostras de uma só vez), os cálculos estatísticos e a persistência ocorrem de forma atômica e vetorizada.

### 2.3. Infraestrutura e Persistência
* **`MySQLSubgrupoRepository` & Interface `ISubgrupoRepository`:**
  * Implementação de `atualizar_violacoes_em_lote` para sincronizar no banco de dados todas as novas violações e flags `fora_de_controle` dos subgrupos históricos alterados retroativamente.

### 2.4. Frontend e Relatório PDF
* **`IngestaoPage.tsx`:** Atualização do estado global da carta e invalidação seletiva de queries do React Query (`['cartas']` e `['subgrupos', id]`) após submissões manuais e em lote.
* **`cepChartHelpers.ts` & `CapacidadePage.tsx`:** Garantia de que as `markLine` do ECharts e os cálculos de capacidade usem consistentemente os limites consolidados da API.
* **`pdfReportGenerator.ts`:** Seções 2, 3 e 4 do relatório PDF sincronizadas com os limites consolidados e novos campos de dispersão.

---

## 3. Arquivos Modificados e Criados

| Arquivo | Camada | Responsabilidade |
| :--- | :--- | :--- |
| `backend/app/domain/value_objects/limites.py` | Domínio | Inclusão dos campos de dispersão (`lc_dispersao`, `lsc_dispersao`, `lic_dispersao`). |
| `backend/app/domain/entities/carta.py` | Domínio | Método `reavaliar_historico_completo` e lógica de atualização contínua no modo dinâmico. |
| `backend/app/domain/entities/subgrupo.py` | Domínio | Métodos auxiliares para atualização atômica de violações e status de controle. |
| `backend/app/domain/rules/nelson_rules.py` | Domínio | Padronização do cálculo de $\sigma_{\bar{X}} = (LSC - LC) / 3.0$ em todas as regras zonais. |
| `backend/app/domain/rules/detector.py` | Domínio | Avaliação coordenada das 8 regras e regras de dispersão. |
| `backend/app/domain/strategies/xr_chart.py` | Domínio | Retorno completo dos limites de dispersão $R$ ($\bar{R}$, $D_4 \bar{R}$, $D_3 \bar{R}$). |
| `backend/app/domain/strategies/xs_chart.py` | Domínio | Retorno completo dos limites de dispersão $s$ ($\bar{s}$, $B_4 \bar{s}$, $B_3 \bar{s}$). |
| `backend/app/domain/interfaces/repositories.py` | Domínio | Assinatura de `atualizar_violacoes_em_lote`. |
| `backend/app/application/services/processar_subgrupo.py` | Aplicação | Orquestração do recálculo dinâmico, avaliação retroativa e batch import. |
| `backend/app/infrastructure/persistence/repositories/subgrupo_repository.py` | Infra | Persistência em lote de violações no MySQL. |
| `backend/tests/test_avaliacao_retroativa_xr.py` | Testes | Suíte de validação com 20 subgrupos reais (Prova Real). |
| `frontend/src/pages/IngestaoPage.tsx` | Frontend | Sincronização de cache e estado da carta após ingestão. |
| `frontend/src/utils/pdfReportGenerator.ts` | Frontend | Relatório PDF sincronizado com limites de posição e dispersão. |

---

## 4. Validação e Testes

### 4.1. Testes Automatizados no Backend (154 testes - 100% de aprovação)
* **Prova Real (`test_avaliacao_retroativa_xr.py`):**
  * Executado sobre o dataset padrão de 20 subgrupos ($n=5$):
    * $LC = 4.9612$
    * $LSC = 4.9740$
    * $LIC = 4.9484$
    * $\hat{\sigma} = 0.0096$
    * $LC_R = 0.02225$, $LSC_R = 0.0470$, $LIC_R = 0.0$
  * Confirmação da avaliação retroativa:
    * Subgrupo #002 ($4.9420 < 4.9484$): detecta `REGRA_1` retroativamente.
    * Subgrupo #009 ($R = 0.0560 > 0.0470$): detecta violação de limite de dispersão.
    * Subgrupos #013 e #015 ($4.9700 < 4.9740$): não violam `REGRA_1`.
    * Subgrupo #017 ($4.9760 > 4.9740$): detecta `REGRA_1`.
    * Subgrupos #018, #019 e #020 ($4.9710$): não violam `REGRA_1`, acusando `REGRA_5` e/ou `REGRA_6`.
* **Regressão Completa:** Todos os testes unitários de domínio, estratégias, repositórios, websockets e aplicação passaram com sucesso.

### 4.2. Compilação e Testes no Frontend
* **TypeScript Compiler (`npx tsc -b`):** 0 erros de compilação.
* **Vitest Suite:** 16 arquivos de teste, 127 testes executados com 100% de sucesso.
