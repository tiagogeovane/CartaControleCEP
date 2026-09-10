# FEAT-04: WebSockets Nativos & Notificação Reativa

* **Fase do Roadmap:** [Fase 4 - Tempo Real Reativo (WebSockets Nativos In-Memory)](../Roadmap.md#6-fase-4-tempo-real-reativo-websockets-nativos-in-memory)
* **Status:** ✅ Concluído
* **Data de Execução:** 09/09/2026

---

## 1. Visão Geral e Contexto

Esta entrega implementa a infraestrutura de comunicação bidirecional e transmissão reativa em tempo real (*streaming in-memory*) do **Sistema de Controle Estatístico de Processos (CEP)** via **WebSockets nativos do FastAPI**.

O objetivo primordial desta fase é atender aos requisitos de desempenho e experiência do usuário ([RF13], [RF14], [RNF01], [RNF06]): assim que um subgrupo amostral é processado e persistido pelo [`ProcessamentoSubgrupoService`](file:///home/tiago/Documents/Controle%20Estatistico%20de%20Processos/backend/app/application/services/processar_subgrupo.py), a aplicação despacha o evento serializado para todos os clientes conectados ao canal daquela carta de controle (`/ws/cartas/{carta_id}`) em tempo inferior a 500 ms, sem requisições de *polling* HTTP ou bloqueio de threads de I/O.

---

## 2. O que Foi Implementado

### 2.1. Gerenciador de Conexões em Memória: `ConnectionManager` (`backend/app/infrastructure/real_time/connection_manager.py`)
Mecanismo assíncrono com trava (`asyncio.Lock`) para controle de ciclo de vida de clientes conectados:

* **Mapeamento Chaveado por Carta:** Dicionário interno `_active_connections: dict[str, list[WebSocket]]` que isola as transmissões, assegurando que telemetrias da Carta A nunca vazem para clientes monitorando a Carta B.
* **Handshake & Registro (`connect`):** Executa o `await websocket.accept()` e registra a conexão na lista de ouvintes da carta correspondente.
* **Desconexão Segura & Limpeza de Memória (`disconnect`):** Remove o socket desconectado e expurga automaticamente do dicionário chaves cujas listas fiquem vazias, prevenindo vazamentos de memória (*memory leaks*).
* **Broadcast Resiliente (`broadcast`):** Transmite o payload JSON de forma assíncrona para todas as conexões da carta alvo. Caso ocorra uma desconexão abrupta do cliente (ex: fechamento de aba ou queda de rede), captura a falha pontual sem interromper o envio aos demais clientes e limpa o socket inativo.
* **Métricas de Monitoramento:** Métodos `total_conexoes(carta_id)` e `obter_cartas_conectadas()` para telemetria operacional.

---

### 2.2. Observer de Notificação Reativa: `WebSocketNotificationObserver` (`backend/app/infrastructure/real_time/websocket_observer.py`)
Ponte orientada a objetos que implementa o contrato [`ISubgrupoObserver`](file:///home/tiago/Documents/Controle%20Estatistico%20de%20Processos/backend/app/domain/interfaces/observers.py):

* Recebe a notificação do término do pipeline com as instâncias de domínio `CartaControle` e `Subgrupo`.
* Calcula de forma não-bloqueante os índices de capacidade fabril ($C_p, C_{pk}$) se limites de especificação estiverem configurados.
* Constrói a instância de [`SubgrupoProcessadoEvent`](file:///home/tiago/Documents/Controle%20Estatistico%20de%20Processos/backend/app/application/events/subgrupo_events.py) e invoca `to_dict()`, produzindo a estrutura canônica de tempo real definida em `Requisitos.md`:
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
* Delega ao `ConnectionManager.broadcast(str(carta.id), payload)`.

---

### 2.3. Endpoint WebSocket no FastAPI (`backend/app/api/v1/websocket.py`)
Endpoint de entrada para clientes do frontend:

* **Rota:** `@router.websocket("/ws/cartas/{carta_id}")`
* **Injeção de Dependências:** `manager: Annotated[ConnectionManager, Depends(get_connection_manager)]`.
* **Mensagem de Boas-Vindas:** Envia confirmação de handshake imediato `{"event": "CONEXAO_ESTABELECIDA", "carta_id": carta_id, "status": "online"}`.
* **Keep-Alive Bidirecional:** Loop contínuo de escuta capaz de processar `ping` tanto via texto puro (`"ping"` $\to$ `"pong"`) quanto via JSON estruturado (`{"action": "ping"}` $\to$ `{"type": "pong"}`), mantendo a conexão viva contra *timeouts* de proxies reversos e firewalls.
* **Encerramento Limpo:** Trata `WebSocketDisconnect` e finaliza liberando os recursos no bloco `finally`.

---

### 2.4. Entrada Principal da Aplicação (`backend/app/main.py`)
Criação do aplicativo FastAPI com:
* Middleware de CORS com suporte total a origens (`CORSMiddleware`).
* Inclusão do roteador de tempo real `websocket_router`.
* Rota de diagnóstico operacional `GET /health`.

---

## 3. Relação de Arquivos Criados e Modificados

| Arquivo | Ação | Responsabilidade |
| :--- | :---: | :--- |
| `backend/app/infrastructure/real_time/connection_manager.py` | Criado | `ConnectionManager` in-memory com lock assíncrono e broadcast |
| `backend/app/infrastructure/real_time/websocket_observer.py` | Criado | `WebSocketNotificationObserver` conectando Use Case a WebSocket |
| `backend/app/infrastructure/real_time/__init__.py` | Criado | Exportações da camada de tempo real |
| `backend/app/api/v1/websocket.py` | Criado | Rota `@router.websocket("/ws/cartas/{carta_id}")` com ping/pong |
| `backend/app/api/v1/__init__.py` | Criado | Exportação do roteador WebSocket |
| `backend/app/main.py` | Criado | Ponto de entrada FastAPI com CORS e roteamento |
| `backend/tests/unit/real_time/test_connection_manager.py` | Criado | Testes unitários de conexão, isolamento e resiliência |
| `backend/tests/unit/real_time/test_websocket_observer.py` | Criado | Testes unitários do observer e despacho de payload |
| `backend/tests/integration/test_websocket_realtime.py` | Criado | Testes de integração E2E com `TestClient` e transmissão ao vivo |

---

## 4. Validação e Testes

1. **Bateria Completa de Testes Unitários e de Integração:**
   * **Total de Testes:** **147 testes executados e aprovados** (`pytest`).
   * **Testes de WebSocket:** Conexão assíncrona, handshake, keep-alive text/JSON, desconexão limpa e recebimento em tempo real do evento `NOVO_SUBGRUPO_PROCESSADO` gerado pelo pipeline de aplicação.
   * **Tempo de Execução:** ~2.2s.

2. **Auditoria de Código Estático (Linter):**
   * Comando: `ruff check .`
   * Resultado: **All checks passed!** (0 avisos ou erros).

---

## 5. Próximos Passos (Fase 5 do Roadmap)

Com o motor CEP, persistência MySQL, casos de uso e WebSockets concluídos, a próxima etapa é a **Fase 5: Camada de Apresentação e API REST (FastAPI)**:
* Schemas Pydantic v2 de entrada e saída (`UsuarioCreate`, `CartaControleCreate`, `AmostraIngestaoRequest`).
* Autenticação e Segurança (JWT, hashing bcrypt/passlib, dependência `get_current_user`).
* Endpoints REST HTTP para gestão de processos, cartas e ingestão (`POST /api/v1/cartas/{id}/amostras`).
