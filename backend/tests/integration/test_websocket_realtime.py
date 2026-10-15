import asyncio
from uuid import uuid4

import pytest
from app.application.services.processar_subgrupo import ProcessamentoSubgrupoService
from app.domain.entities.carta import CartaControle
from app.domain.entities.subgrupo import Subgrupo
from app.domain.interfaces.repositories import (
    ICartaControleRepository,
    ISubgrupoRepository,
)
from app.domain.value_objects.limites import LimitesEspecificacao
from app.infrastructure.real_time.connection_manager import (
    connection_manager,
)
from app.infrastructure.real_time.websocket_observer import (
    WebSocketNotificationObserver,
)
from app.main import app
from fastapi.testclient import TestClient


class InMemoryCartaRepository(ICartaControleRepository):
    def __init__(self) -> None:
        self.cartas: dict = {}

    async def obter_por_id(self, carta_id):
        return self.cartas.get(carta_id)

    async def salvar(self, carta):
        self.cartas[carta.id] = carta
        return carta

    async def listar_todas(self, processo_id=None):
        return list(self.cartas.values())

    async def atualizar_limites(self, carta_id, novos_limites):
        if carta_id in self.cartas:
            self.cartas[carta_id].atualizar_limites(novos_limites)


class InMemorySubgrupoRepository(ISubgrupoRepository):
    def __init__(self) -> None:
        self.subgrupos: list[Subgrupo] = []

    async def salvar(self, subgrupo):
        self.subgrupos.append(subgrupo)
        return subgrupo

    async def salvar_em_lote(self, subgrupos):
        self.subgrupos.extend(subgrupos)
        return list(subgrupos)

    async def listar_por_carta(self, carta_id, limite=None):
        return [s for s in self.subgrupos if s.carta_id == carta_id]

    async def atualizar_violacoes_em_lote(self, subgrupos):
        pass


def test_health_check():
    """Valida o endpoint base de integridade do backend."""
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "cep-backend"}


def test_websocket_handshake_e_ping_pong():
    """Valida conexão WebSocket, recebimento de handshake e resposta a ping/pong."""
    client = TestClient(app)
    carta_id = str(uuid4())

    with client.websocket_connect(f"/ws/cartas/{carta_id}") as websocket:
        # 1. Mensagem inicial de handshake
        msg_inicial = websocket.receive_json()
        assert msg_inicial["event"] == "CONEXAO_ESTABELECIDA"
        assert msg_inicial["carta_id"] == carta_id
        assert msg_inicial["status"] == "online"
        assert connection_manager.total_conexoes(carta_id) == 1

        # 2. Keep-alive via texto 'ping'
        websocket.send_text("ping")
        assert websocket.receive_text() == "pong"

        # 3. Keep-alive via payload JSON
        websocket.send_text('{"action": "ping"}')
        resposta = websocket.receive_json()
        assert resposta["type"] == "pong"

    # Após sair do contexto with, a conexão é encerrada e limpa
    assert connection_manager.total_conexoes(carta_id) == 0


def test_websocket_broadcast_ao_processar_subgrupo():
    """Valida que o processamento de um subgrupo transmite em tempo real para clientes WebSocket conectados."""
    client = TestClient(app)
    carta_id = uuid4()
    carta = CartaControle(
        id=carta_id,
        processo_id=uuid4(),
        tipo_carta="X_R",
        tamanho_subgrupo=5,
        especificacoes=LimitesEspecificacao(lse=26.0, lie=24.0, valor_nominal=25.0),
        modo_limites="DINAMICO",
    )

    carta_repo = InMemoryCartaRepository()
    subgrupo_repo = InMemorySubgrupoRepository()
    asyncio.run(carta_repo.salvar(carta))

    # Observer oficial configurado com o connection_manager global
    ws_observer = WebSocketNotificationObserver(connection_manager=connection_manager)
    service = ProcessamentoSubgrupoService(
        carta_repository=carta_repo,
        subgrupo_repository=subgrupo_repo,
        observers=[ws_observer],
    )

    with client.websocket_connect(f"/ws/cartas/{carta_id}") as websocket:
        # Handshake
        handshake = websocket.receive_json()
        assert handshake["event"] == "CONEXAO_ESTABELECIDA"

        # Executa o serviço de processamento de subgrupo
        amostra = [25.1, 24.9, 25.0, 25.2, 24.8]
        subgrupo = asyncio.run(service.executar(carta_id=carta_id, amostras_valores=amostra))
        assert subgrupo.numero_subgrupo == 1

        # O WebSocket deve receber imediatamente o evento estruturado
        evento_recebido = websocket.receive_json()
        assert evento_recebido["event"] == "NOVO_SUBGRUPO_PROCESSADO"
        assert evento_recebido["carta_id"] == str(carta_id)
        assert evento_recebido["numero_subgrupo"] == 1
        assert evento_recebido["estatisticas"]["media_x"] == pytest.approx(25.0, 0.01)
        assert evento_recebido["limites"]["lc"] == pytest.approx(25.0, 0.01)
        assert evento_recebido["status_controle"]["fora_de_controle"] is False
        assert "capacidade" in evento_recebido
