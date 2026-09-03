from abc import ABC, abstractmethod

from app.domain.entities.carta import CartaControle
from app.domain.entities.subgrupo import Subgrupo


class ISubgrupoObserver(ABC):
    """Contrato abstrato (Observer Pattern) para notificações reativas de processamento de subgrupos."""

    @abstractmethod
    async def notificar_processamento(
        self,
        carta: CartaControle,
        subgrupo: Subgrupo,
    ) -> None:
        """Despacha evento de novo subgrupo processado aos ouvintes registrados (ex: WebSockets)."""
