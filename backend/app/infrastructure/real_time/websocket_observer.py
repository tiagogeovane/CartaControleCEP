from app.application.events.subgrupo_events import SubgrupoProcessadoEvent
from app.application.services.analise_capacidade import AnaliseCapacidadeService
from app.domain.entities.carta import CartaControle
from app.domain.entities.subgrupo import Subgrupo
from app.domain.interfaces.observers import ISubgrupoObserver
from app.infrastructure.real_time.connection_manager import (
    ConnectionManager,
)
from app.infrastructure.real_time.connection_manager import (
    connection_manager as default_connection_manager,
)


class WebSocketNotificationObserver(ISubgrupoObserver):
    """Implementação concreta do Observer Pattern (ISubgrupoObserver) para tempo real.

    Converte entidades de subgrupo calculadas em eventos canônicos (SubgrupoProcessadoEvent)
    e transmite de forma reativa e não-bloqueante aos clientes conectados via WebSocket.
    """

    def __init__(
        self,
        connection_manager: ConnectionManager | None = None,
        capacidade_service: AnaliseCapacidadeService | None = None,
    ) -> None:
        self._manager = connection_manager or default_connection_manager
        self._capacidade_service = capacidade_service

    async def notificar_processamento(
        self,
        carta: CartaControle,
        subgrupo: Subgrupo,
    ) -> None:
        """Despacha o evento serializado para todos os clientes conectados à carta."""
        capacidade = None
        if self._capacidade_service is not None:
            capacidade = self._capacidade_service.calcular_para_carta_seguro(carta)

        evento = SubgrupoProcessadoEvent.from_domain(
            carta=carta,
            subgrupo=subgrupo,
            capacidade=capacidade,
        )

        payload = evento.to_dict()
        await self._manager.broadcast(carta_id=str(carta.id), message=payload)
