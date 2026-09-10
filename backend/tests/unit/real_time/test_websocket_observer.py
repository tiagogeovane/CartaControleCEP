from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from app.domain.entities.carta import CartaControle
from app.domain.entities.subgrupo import Subgrupo
from app.domain.value_objects.capacidade import IndicesCapacidade
from app.domain.value_objects.estatisticas import EstatisticasSubgrupo
from app.domain.value_objects.limites import LimitesControle, LimitesEspecificacao
from app.infrastructure.real_time.websocket_observer import (
    WebSocketNotificationObserver,
)


@pytest.mark.asyncio
async def test_websocket_observer_broadcast():
    manager_mock = MagicMock()
    manager_mock.broadcast = AsyncMock(return_value=1)

    observer = WebSocketNotificationObserver(connection_manager=manager_mock)

    carta = CartaControle(processo_id=uuid4(), tipo_carta="X_R", tamanho_subgrupo=3)
    carta.atualizar_limites(LimitesControle(lc=10.0, lsc=12.0, lic=8.0, sigma_estimado=0.5))

    subgrupo = Subgrupo(
        carta_id=carta.id,
        numero_subgrupo=1,
        valores_brutos=[10.0, 10.5, 9.5],
        estatisticas=EstatisticasSubgrupo(
            media_x=10.0, amplitude_r=1.0, desvio_s=0.5, valores_brutos=(10.0, 10.5, 9.5)
        ),
    )

    await observer.notificar_processamento(carta, subgrupo)

    manager_mock.broadcast.assert_awaited_once()
    _, kwargs = manager_mock.broadcast.call_args
    assert kwargs["carta_id"] == str(carta.id)
    payload = kwargs["message"]
    assert payload["event"] == "NOVO_SUBGRUPO_PROCESSADO"
    assert payload["carta_id"] == str(carta.id)
    assert payload["numero_subgrupo"] == 1
    assert payload["estatisticas"]["media_x"] == 10.0
    assert payload["limites"]["lc"] == 10.0


@pytest.mark.asyncio
async def test_websocket_observer_com_capacidade():
    manager_mock = MagicMock()
    manager_mock.broadcast = AsyncMock(return_value=1)

    capacidade_mock = MagicMock()
    capacidade_mock.calcular_para_carta_seguro.return_value = IndicesCapacidade(
        cp=1.33, cpk=1.25
    )

    observer = WebSocketNotificationObserver(
        connection_manager=manager_mock,
        capacidade_service=capacidade_mock,
    )

    carta = CartaControle(
        processo_id=uuid4(),
        tipo_carta="X_R",
        tamanho_subgrupo=3,
        especificacoes=LimitesEspecificacao(lse=15.0, lie=5.0),
    )
    subgrupo = Subgrupo(
        carta_id=carta.id,
        numero_subgrupo=1,
        valores_brutos=[10.0, 10.0, 10.0],
        estatisticas=EstatisticasSubgrupo(
            media_x=10.0, amplitude_r=0.0, desvio_s=0.0, valores_brutos=(10.0, 10.0, 10.0)
        ),
    )

    await observer.notificar_processamento(carta, subgrupo)

    _, kwargs = manager_mock.broadcast.call_args
    payload = kwargs["message"]
    assert payload["capacidade"]["cp"] == 1.33
    assert payload["capacidade"]["cpk"] == 1.25
