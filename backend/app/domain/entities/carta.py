from collections.abc import Sequence
from dataclasses import dataclass, field
from uuid import UUID, uuid4

from app.domain.entities.subgrupo import Subgrupo
from app.domain.value_objects.limites import LimitesControle, LimitesEspecificacao


@dataclass
class CartaControle:
    """Entidade agregadora que representa uma Carta de Controle estatístico de um processo."""

    processo_id: UUID
    tipo_carta: str
    tamanho_subgrupo: int
    id: UUID = field(default_factory=uuid4)
    especificacoes: LimitesEspecificacao | None = None
    limites_atuais: LimitesControle | None = None
    modo_limites: str = "DINAMICO"
    subgrupos: list[Subgrupo] = field(default_factory=list)

    def __post_init__(self) -> None:
        if self.tamanho_subgrupo < 1:
            raise ValueError(f"Tamanho de subgrupo deve ser >= 1 (recebido: {self.tamanho_subgrupo}).")
        self.tipo_carta = self.tipo_carta.upper().replace("-", "_").replace(" ", "_")

    def validar_amostra(self, valores: Sequence[float]) -> None:
        """Garante a Regra de Negócio [RN02]: O número de leituras deve coincidir com o tamanho do subgrupo."""
        if len(valores) != self.tamanho_subgrupo:
            raise ValueError(
                f"Tamanho de amostra divergente: esperado {self.tamanho_subgrupo}, recebido {len(valores)} medições."
            )

    def adicionar_subgrupo(self, subgrupo: Subgrupo) -> None:
        """Anexa um novo subgrupo ao histórico da carta."""
        self.subgrupos.append(subgrupo)

    def obter_historico_medias(self) -> list[float]:
        """Retorna a lista ordenada cronologicamente de todas as médias dos subgrupos."""
        return [s.estatisticas.media_x for s in self.subgrupos]

    def obter_historico_dispersoes(self) -> list[float]:
        """Retorna a lista de dispersões (R, s ou MR) conforme o tipo de carta configurado."""
        tipo = self.tipo_carta.upper().replace("-", "_")
        if "X_S" in tipo or "XS" in tipo or (self.tamanho_subgrupo > 10 and "X_R" in tipo):
            return [s.estatisticas.desvio_s for s in self.subgrupos]
        if "I_MR" in tipo or "IMR" in tipo or "INDIVIDUAL" in tipo or (self.tamanho_subgrupo == 1 and "X_R" in tipo):
            medias = self.obter_historico_medias()
            if len(medias) < 2:
                return []
            return [abs(medias[i] - medias[i - 1]) for i in range(1, len(medias))]
        return [s.estatisticas.amplitude_r for s in self.subgrupos]


    def obter_ultimas_medias(self, quantidade: int) -> list[float]:
        """Retorna as médias dos últimos N subgrupos para avaliação de anomalias."""
        medias = self.obter_historico_medias()
        return medias[-quantidade:] if len(medias) >= quantidade else medias

    def atualizar_limites(self, novos_limites: LimitesControle) -> None:
        """Atualiza os limites de controle calculados da carta."""
        self.limites_atuais = novos_limites

    @property
    def total_subgrupos(self) -> int:
        return len(self.subgrupos)
