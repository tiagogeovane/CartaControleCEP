from collections.abc import Sequence
from dataclasses import dataclass, field
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from app.domain.entities.subgrupo import Subgrupo
from app.domain.value_objects.limites import LimitesControle, LimitesEspecificacao

if TYPE_CHECKING:
    from app.domain.rules.detector import DetectorRegrasNelson


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

    def reavaliar_historico_completo(
        self,
        detector: "DetectorRegrasNelson",
        limites: LimitesControle | None = None,
    ) -> list[Subgrupo]:
        """Reavalia retroativamente as Regras de Nelson para todos os subgrupos da carta.

        Sempre que os limites de controle forem recalculados no modo DINÂMICO (ou
        ao término de uma ingestão em lote / calibração Fase 1), todos os subgrupos
        do histórico devem ser reavaliados contra os limites finais consolidados.
        """
        limites_avaliacao = limites or self.limites_atuais
        if limites_avaliacao is None:
            return self.subgrupos

        return reavaliar_historico_completo(
            subgrupos=self.subgrupos,
            limites=limites_avaliacao,
            detector=detector,
            tipo_carta=self.tipo_carta,
            tamanho_subgrupo=self.tamanho_subgrupo,
        )


def reavaliar_historico_completo(
    subgrupos: Sequence[Subgrupo],
    limites: LimitesControle,
    detector: "DetectorRegrasNelson",
    tipo_carta: str = "X_R",
    tamanho_subgrupo: int = 5,
) -> list[Subgrupo]:
    """Reavalia retroativamente as Regras de Nelson para todos os subgrupos informados."""
    if not subgrupos or limites is None:
        return list(subgrupos)

    subgrupos_ordenados = sorted(subgrupos, key=lambda s: s.numero_subgrupo)
    medias_todas = [s.estatisticas.media_x for s in subgrupos_ordenados]

    tipo = tipo_carta.upper().replace("-", "_")
    is_atributo = tipo in ("P", "C")
    is_imr = not is_atributo and ("I_MR" in tipo or "IMR" in tipo or "INDIVIDUAL" in tipo or (tamanho_subgrupo == 1 and "X_R" in tipo))
    is_xs = not is_atributo and ("X_S" in tipo or "XS" in tipo or (tamanho_subgrupo > 10 and "X_R" in tipo))

    for idx, sub in enumerate(subgrupos_ordenados):
        medias_ate_idx = medias_todas[: idx + 1]

        if is_atributo:
            dispersoes_ate_idx = []
        elif is_imr:
            if len(medias_ate_idx) >= 2:
                dispersoes_ate_idx = [
                    abs(medias_ate_idx[i] - medias_ate_idx[i - 1])
                    for i in range(1, len(medias_ate_idx))
                ]
            else:
                dispersoes_ate_idx = []
        elif is_xs:
            dispersoes_ate_idx = [s.estatisticas.desvio_s for s in subgrupos_ordenados[: idx + 1]]
        else:
            dispersoes_ate_idx = [s.estatisticas.amplitude_r for s in subgrupos_ordenados[: idx + 1]]

        violacoes = detector.avaliar(
            historico_medias=medias_ate_idx,
            limites=limites,
            historico_dispersoes=dispersoes_ate_idx,
            numero_subgrupo=sub.numero_subgrupo,
        )
        sub.definir_violacoes(violacoes)

    return subgrupos_ordenados
