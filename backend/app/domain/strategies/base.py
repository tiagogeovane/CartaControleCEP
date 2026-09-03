from abc import ABC, abstractmethod
from collections.abc import Sequence

from app.domain.value_objects.estatisticas import EstatisticasSubgrupo
from app.domain.value_objects.limites import LimitesControle


class ICartaControleStrategy(ABC):
    """Interface abstrata para estratégias de cálculo estatístico de cartas de controle."""

    @abstractmethod
    def calcular_estatisticas(self, amostras: Sequence[float]) -> EstatisticasSubgrupo:
        """Calcula estatísticas pontuais (média, dispersão) para uma lista de medições de subgrupo."""

    @abstractmethod
    def calcular_limites(
        self,
        historico_medias: Sequence[float],
        historico_dispersoes: Sequence[float],
        n: int,
    ) -> LimitesControle:
        """Calcula os limites de controle estatístico (LC, LSC, LIC) e o sigma estimado do processo."""
