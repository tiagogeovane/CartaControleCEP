import asyncio
import logging
from collections.abc import Sequence

from fastapi import WebSocket

logger = logging.getLogger("cep.real_time")


class ConnectionManager:
    """Gerenciador in-memory de conexões ativas WebSocket chaveadas pelo ID da Carta de Controle.

    Garante comunicação reativa instantânea (< 500 ms) entre o backend e clientes conectados.
    """

    def __init__(self) -> None:
        self._active_connections: dict[str, list[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, carta_id: str, websocket: WebSocket) -> None:
        """Aceita a conexão WebSocket e registra o socket na lista de ouvintes da carta."""
        await websocket.accept()
        async with self._lock:
            if carta_id not in self._active_connections:
                self._active_connections[carta_id] = []
            if websocket not in self._active_connections[carta_id]:
                self._active_connections[carta_id].append(websocket)
        logger.debug("Cliente conectado à carta %s. Conexões ativas: %d", carta_id, len(self._active_connections[carta_id]))

    async def disconnect(self, carta_id: str, websocket: WebSocket) -> None:
        """Remove o socket da lista de ouvintes e libera recursos se a lista esvaziar."""
        async with self._lock:
            if carta_id in self._active_connections:
                if websocket in self._active_connections[carta_id]:
                    self._active_connections[carta_id].remove(websocket)
                if not self._active_connections[carta_id]:
                    del self._active_connections[carta_id]
        logger.debug("Cliente desconectado da carta %s.", carta_id)

    async def broadcast(self, carta_id: str, message: dict) -> int:
        """Transmite uma mensagem JSON assincronamente a todos os ouvintes conectados à carta.

        Trata desconexões abruptas de clientes de forma limpa, expurgando sockets mortos.
        Retorna o número de transmissões bem-sucedidas.
        """
        async with self._lock:
            sockets: list[WebSocket] = list(self._active_connections.get(carta_id, []))

        if not sockets:
            return 0

        desconectados: list[WebSocket] = []
        sucessos = 0

        for ws in sockets:
            try:
                await ws.send_json(message)
                sucessos += 1
            except Exception as e:  # noqa: BLE001
                logger.warning("Falha ao enviar JSON para WebSocket da carta %s: %s. Desconectando.", carta_id, e)
                desconectados.append(ws)

        if desconectados:
            for ws_morto in desconectados:
                await self.disconnect(carta_id, ws_morto)

        return sucessos

    def total_conexoes(self, carta_id: str | None = None) -> int:
        """Retorna o número total de conexões ativas para uma carta ou globalmente."""
        if carta_id is not None:
            return len(self._active_connections.get(carta_id, []))
        return sum(len(conns) for conns in self._active_connections.values())

    def obter_cartas_conectadas(self) -> Sequence[str]:
        """Retorna os identificadores das cartas que possuem conexões ativas."""
        return list(self._active_connections.keys())

    def esta_conectado(self, carta_id: str, websocket: WebSocket) -> bool:
        """Verifica se um dado socket está registrado como ativo para a carta."""
        return websocket in self._active_connections.get(carta_id, [])


# Instância singleton para uso compartilhado na aplicação
connection_manager = ConnectionManager()


def get_connection_manager() -> ConnectionManager:
    """Provedor de injeção de dependência para rotas FastAPI."""
    return connection_manager
