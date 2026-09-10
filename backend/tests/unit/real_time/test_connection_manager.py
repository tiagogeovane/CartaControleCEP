from unittest.mock import AsyncMock

import pytest
from app.infrastructure.real_time.connection_manager import ConnectionManager


@pytest.fixture
def manager():
    return ConnectionManager()


@pytest.mark.asyncio
async def test_connect_e_disconnect(manager):
    ws_mock = AsyncMock()

    await manager.connect("carta-1", ws_mock)

    ws_mock.accept.assert_awaited_once()
    assert manager.total_conexoes("carta-1") == 1
    assert manager.esta_conectado("carta-1", ws_mock) is True
    assert "carta-1" in manager.obter_cartas_conectadas()

    await manager.disconnect("carta-1", ws_mock)
    assert manager.total_conexoes("carta-1") == 0
    assert manager.esta_conectado("carta-1", ws_mock) is False
    assert "carta-1" not in manager.obter_cartas_conectadas()


@pytest.mark.asyncio
async def test_broadcast_apenas_para_carta_alvo(manager):
    ws1 = AsyncMock()
    ws2 = AsyncMock()
    ws_outra = AsyncMock()

    await manager.connect("carta-A", ws1)
    await manager.connect("carta-A", ws2)
    await manager.connect("carta-B", ws_outra)

    assert manager.total_conexoes("carta-A") == 2
    assert manager.total_conexoes("carta-B") == 1
    assert manager.total_conexoes() == 3

    msg = {"event": "TESTE", "dado": 123}
    enviados = await manager.broadcast("carta-A", msg)

    assert enviados == 2
    ws1.send_json.assert_awaited_once_with(msg)
    ws2.send_json.assert_awaited_once_with(msg)
    ws_outra.send_json.assert_not_awaited()


@pytest.mark.asyncio
async def test_broadcast_sem_ouvintes_retorna_zero(manager):
    enviados = await manager.broadcast("carta-inexistente", {"event": "TESTE"})
    assert enviados == 0


@pytest.mark.asyncio
async def test_broadcast_trata_desconexao_abrupta_e_expurga_socket(manager):
    ws_vivo = AsyncMock()
    ws_morto = AsyncMock()
    ws_morto.send_json.side_effect = RuntimeError("Conexão fechada pelo cliente")

    await manager.connect("carta-X", ws_vivo)
    await manager.connect("carta-X", ws_morto)
    assert manager.total_conexoes("carta-X") == 2

    msg = {"dado": "novo"}
    enviados = await manager.broadcast("carta-X", msg)

    # Apenas o socket vivo contabilizou sucesso
    assert enviados == 1
    ws_vivo.send_json.assert_awaited_once_with(msg)

    # O socket morto deve ter sido expurgado
    assert manager.total_conexoes("carta-X") == 1
    assert manager.esta_conectado("carta-X", ws_morto) is False
    assert manager.esta_conectado("carta-X", ws_vivo) is True
