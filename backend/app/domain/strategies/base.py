from abc import ABC, abstractmethod
from collections.abc import Sequence

from app.domain.value_objects.estatisticas import EstatisticasSubgrupo
from app.domain.value_objects.limites import LimitesControle


class ICartaControleStrategy(ABC):
    """Interface abstrata para estratégias de cálculo estatístico de cartas de controle."""

    tipo_carta: str = "GENERICA"
    nome_carta: str = "Carta de Controle"
    nome_posicao: str = "Carta de Posição"
    nome_dispersao: str = "Carta de Dispersão"
    rotulo_posicao: str = "Média"
    rotulo_dispersao: str = "Dispersão"
    sigla_dispersao: str = "D"

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

    def calcular_limites_dispersao(
        self,
        historico_dispersoes: Sequence[float],
        n: int = 1,
    ) -> tuple[float, float, float]:
        """Calcula os limites de controle da carta de dispersão auxiliar: (LIC, LC, LSC)."""
        raise NotImplementedError("Estratégia não implementa cálculo de limites de dispersão.")

