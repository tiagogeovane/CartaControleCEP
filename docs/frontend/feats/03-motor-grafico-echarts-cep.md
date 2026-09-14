# Feature FEAT-03: Motor Gráfico Especializado de Cartas CEP (Apache ECharts)

* **Fase do Roadmap:** [Fase 3 - Motor Gráfico Especializado de Cartas CEP (Apache ECharts)](../Roadmap.md#5-fase-3-motor-gr%C3%A1fico-especializado-de-cartas-cep-apache-echarts)
* **Status:** ✅ Concluído
* **Testes Automatizados:** 62 testes unitários e de integração aprovados (100% de sucesso em 8 arquivos)

---

## 1. Contexto e Motivação

O objetivo da **Fase 3** foi projetar, implementar e validar o núcleo de visualização estatística de alta precisão do sistema de Controle Estatístico de Processos (CEP), integrando o **Apache ECharts** ao ecossistema React. A interface industrial exige a plotagem sincronizada temporalmente da média amostral ($\bar{X}$ ou valor individual $X$) e da métrica de dispersão (Amplitude $R$, Desvio Padrão $s$, ou Amplitude Móvel $MR$), respeitando os limites estatísticos ($LC, LSC, LIC$), limites de engenharia ($LSE, LIE$) e destacando em tempo real as anomalias detectadas pelas **8 Regras de Nelson** com feedback visual pulsante e tooltips explicativos.

---

## 2. Decisões Arquiteturais e Padrões de Projeto

1. **Encapsulamento Modular com ECharts (`BaseChart.tsx`):**
   * Manipulação de ciclo de vida via `useRef` e `forwardRef`, provendo interface imperativa (`BaseChartRef`) com métodos utilitários:
     * `getInstance()`: acesso direto à instância do ECharts para chamadas de baixo nível.
     * `getDataURL()`: exportação de snapshots rasterizados (PNG/JPEG) com resolução configurável (retina 2x).
     * `resize()`: redimensionamento programático sob demanda.
   * Integração com `ResizeObserver` nativo para resposta instantânea (< 100 ms) a mudanças no viewport ou colapso da Sidebar.
   * Otimização para streaming: suporte a `notMerge: false` e desativação de animações pesadas nos pontos para taxa de atualização estável a 60 FPS (**[RNF02]**).

2. **Fidelidade Estatística Rigorosa e Constantes Tabeladas de Montgomery (`cepConstants.ts`):**
   * Implementação das tabelas de coeficientes normalizados para CEP conforme Montgomery:
     * $X-R$ ($n = 2 \dots 10$): $A_2, d_2, D_3, D_4$.
     * $X-s$ ($n > 10$): $A_3, c_4, B_3, B_4$.
     * $I-MR$ ($n = 1$): $d_2 = 1.128$, $D_3 = 0.0$, $D_4 = 3.267$ e fator $\frac{3}{d_2} \approx 2.6596$.
   * Algoritmo de fallback dinâmico para cálculo autônomo de limites de controle caso a carta ainda não possua limites persistidos vindos do backend.

3. **Construção Parametrizada de Opções ECharts (`cepChartHelpers.ts`):**
   * Layout bi-axial sincronizado (`axisPointer: { link: [{ xAxisIndex: 'all' }] }`):
     * **Grid Superior (42% de altura):** Linha de médias/valores individuais com faixas de dispersão gaussianas (Zonas $A = \pm 3\sigma$, $B = \pm 2\sigma$, $C = \pm 1\sigma$ via `markArea`), linhas de controle ($LC, LSC, LIC$) e limites de especificação ($LSE, LIE$).
     * **Grid Inferior (32% de altura):** Linha de dispersão com limites dedicados ($LC_{disp}, LSC_{disp}, LIC_{disp}$).
   * **Destaque Visual das Regras de Nelson:**
     * Série dedicada do tipo `effectScatter` em vermelho vibrante (`#EF4444`) com onda de choque pulsante (`rippleEffect: { scale: 3, brushType: 'stroke' }`), destacando pontos violadores das 8 regras.
   * **Tooltip Industrial Formatado:**
     * Exibição do número do subgrupo, data/hora formatada, valor medido, métrica de dispersão, amostras brutas e bloco visual de alarme detalhando o nome oficial e a descrição da regra violada com base em `REGRAS_NELSON_METADATA`.

4. **Componentes Especializados por Tipo de Carta:**
   * `CartaXRChart`: especializada para subgrupos de tamanho $2 \le n \le 10$ com cálculo de Amplitude $R$.
   * `CartaXSChart`: especializada para subgrupos de tamanho $n > 10$ com cálculo de Desvio Padrão $s$.
   * `CartaIMRChart`: especializada para subgrupos unitários ($n = 1$), computando a Amplitude Móvel $MR_i = |X_i - X_{i-1}|$ para $i \ge 1$.

5. **Controles Operacionais e Orquestração (`ControlesCarta.tsx` e `CartaControleContainer.tsx`):**
   * Barra de controles com seletor rápido de janela temporal (Últimos 30, 50, 100 pontos ou Todos) com sincronização do `dataZoom`.
   * Botão de congelamento da visualização (pausa a rolagem gráfica sem interromper a ingestão no buffer do `cepStore`).
   * Botão de exportação instantânea em arquivo PNG de alta definição com timestamp de rastreabilidade.
   * Estado vazio (*Empty State*) amigável exibido enquanto não houver subgrupos registrados.

---

## 3. Arquivos Criados e Modificados

| Arquivo | Responsabilidade |
| :--- | :--- |
| `frontend/src/utils/cepConstants.ts` | Tabelas de constantes de Montgomery ($A_2, d_2, D_3, D_4, A_3, c_4, B_3, B_4$) e funções de limites de dispersão |
| `frontend/src/types/cep.ts` | Metadados descritivos das 8 Regras de Nelson e tipos de zonas sigma |
| `frontend/src/components/charts/BaseChart.tsx` | Invólucro de integração com Apache ECharts, `ResizeObserver` e métodos via `ref` |
| `frontend/src/components/charts/cepChartHelpers.ts` | Construtor unificado de opções ECharts, cálculo de zonas, tooltips e suporte a $X-R$, $X-s$ e $I-MR$ |
| `frontend/src/components/charts/CartaXRChart.tsx` | Componente de Carta de Médias e Amplitudes ($\bar{X}-R$) |
| `frontend/src/components/charts/CartaXSChart.tsx` | Componente de Carta de Médias e Desvios Padrão ($\bar{X}-s$) |
| `frontend/src/components/charts/CartaIMRChart.tsx` | Componente de Carta Individual e Amplitude Móvel ($I-MR$) |
| `frontend/src/components/charts/ControlesCarta.tsx` | Barra de controles com janelas de zoom, congelamento e exportação PNG |
| `frontend/src/components/charts/CartaControleContainer.tsx` | Container orquestrador com auto-resolução do tipo de carta, empty-state e integração Zustand |
| `frontend/src/components/charts/index.ts` | Barrel export dos componentes do motor gráfico |
| `frontend/src/test/setup.ts` | Configuração de ambiente jsdom com polyfills para `ResizeObserver`, Canvas 2D e dimensões |
| `frontend/src/test/charts.test.tsx` | Suíte completa com 22 testes unitários e de integração cobrindo todas as métricas da Fase 3 |
| `docs/frontend/Roadmap.md` | Atualização do status da Fase 3 na matriz de rastreabilidade |

---

## 4. Validação e Testes Automatizados

* **Métrica 1 (Fidelidade Numérica vs Dataset Montgomery):**
  * Validado contra o clássico Exemplo 6.1 do livro de Montgomery ($\bar{\bar{X}} = 1.5056, \bar{R} = 0.0325, n = 5$).
  * Coordenadas plotadas em $LC, LSC, LIC$ tanto para $\bar{X}$ quanto para $R$ coincidem com as calculadas pelo backend com erro estritamente inferior a **0.001**.
* **Métrica 2 (Identificação Visual das 8 Regras de Nelson):**
  * Simulação de dados com anomalias de Regra 1 (além de $3\sigma$), Regra 2 (9 pontos no mesmo lado) e Regra 3 (6 pontos em tendência contínua).
  * Série `effectScatter` pulsante (`#EF4444`) extrai exatamente os índices correspondentes e o tooltip apresenta os metadados oficiais das regras.
* **Métrica 3 (Fluidez de Redimensionamento):**
  * Execução da rotina de redimensionamento do Canvas em tempo inferior a **100 ms**.
* **Execução Completa da Suíte de Testes (Vitest):**
  ```text
  Test Files  8 passed (8)
       Tests  62 passed (62)
    Duration  5.54s
  ```
* **Compilação Estrita TypeScript & Build de Produção:**
  ```text
  tsc -b && vite build
  ✓ built in 1.72s (Exit code 0)
  ```
* **Linter (oxlint):**
  ```text
  oxlint -> 0 warnings, 0 errors
  ```

---

## 5. Próximos Passos

Prosseguir para a **Fase 4: Telas Analíticas Centrais (Live Studio e Análise de Capacidade)**, implementando:
1. `LiveStudioPage.tsx`: Estúdio de monitoramento contínuo em tempo real conectado ao WebSocket (`/ws/cartas/{id}`), feed lateral de alarmes de Nelson e integração com o simulador IoT.
2. `CapacidadePage.tsx`: Mostradores circulares (gauges) para os índices de capacidade $C_p$ e $C_{pk}$, acompanhados de histograma de frequências das medições sobreposto com curva normal de Gauss.
