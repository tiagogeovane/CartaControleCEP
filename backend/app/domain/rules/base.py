from abc import ABC, abstractmethod
from collections.abc import Sequence

from app.domain.value_objects.limites import LimitesControle
from app.domain.value_objects.violacao import ViolacaoRegra


class IRegraNelson(ABC):
    """Contrato abstrato para avaliação de regras de detecção de anomalias (Regras de Nelson)."""

    @property
    @abstractmethod
    def codigo(self) -> str:
        """Identificador textual único da regra (ex: 'REGRA_1')."""

    @property
    @abstractmethod
    def descricao(self) -> str:
        """Descrição explicativa da regra e do tipo de desvio estatístico que ela identifica."""

    @property
    @abstractmethod
    def pontos_minimos(self) -> int:
        """Quantidade mínima de pontos consecutivos no histórico necessária para avaliar a regra."""

    @abstractmethod
    def avaliar(
        self,
        historico_medias: Sequence[float],
        limites: LimitesControle,
    ) -> ViolacaoRegra | None:
        """Avalia a sequência de pontos históricos e retorna uma ViolacaoRegra caso anomalia seja detectada."""
