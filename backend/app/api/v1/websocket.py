import json
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect

from app.infrastructure.real_time.connection_manager import (
    ConnectionManager,
    get_connection_manager,
)

logger = logging.getLogger("cep.websocket")

router = APIRouter()


@router.websocket("/ws/cartas/{carta_id}")
async def websocket_cartas_endpoint(
    websocket: WebSocket,
    carta_id: str,
    manager: Annotated[ConnectionManager, Depends(get_connection_manager)],
) -> None:
    """Endpoint WebSocket reativo para streaming de dados em tempo real da Carta de Controle.

    Fluxo:
    1. Aceita a conexão e registra o cliente no ConnectionManager.
    2. Emite confirmação de conexão inicial com a identificação da carta.
    3. Mantém loop assíncrono de escuta e responde a pings/heartbeats.
    4. Garante desconexão e limpeza de recursos no bloco finally.
    """
    await manager.connect(carta_id, websocket)

    # Handshake amigável informando status ativo
    await websocket.send_json(
        {
            "event": "CONEXAO_ESTABELECIDA",
            "carta_id": carta_id,
            "status": "online",
        }
    )

    try:
        while True:
            raw_text = await websocket.receive_text()
            # Suporte a keep-alive via texto puro ('ping' -> 'pong')
            if raw_text.strip().lower() == "ping":
                await websocket.send_text("pong")
                continue

            # Suporte a keep-alive via JSON estruturado
            try:
                data = json.loads(raw_text)
                if data.get("type") == "ping" or data.get("action") == "ping":
                    await websocket.send_json({"type": "pong"})
            except json.JSONDecodeError:
                pass

    except WebSocketDisconnect:
        logger.info("Cliente desconectado do WebSocket da carta %s.", carta_id)
    except Exception as e:  # noqa: BLE001
        logger.warning("Exceção na conexão WebSocket da carta %s: %s", carta_id, e)
    finally:
        await manager.disconnect(carta_id, websocket)
