from dataclasses import dataclass, field
from datetime import datetime, timezone
from uuid import UUID

from app.domain.entities.carta import CartaControle
from app.domain.entities.subgrupo import Subgrupo
from app.domain.value_objects.capacidade import IndicesCapacidade
from app.domain.value_objects.estatisticas import EstatisticasSubgrupo
from app.domain.value_objects.limites import LimitesControle
from app.domain.value_objects.violacao import ViolacaoRegra


@dataclass(frozen=True)
class SubgrupoProcessadoEvent:
    """Evento de aplicação disparado após o cálculo, avaliação e persistência de um subgrupo.

    Adere estritamente ao contrato JSON de tempo real especificado na documentação (Requisitos.md).
    """

    carta_id: UUID
    numero_subgrupo: int
    timestamp: datetime
    estatisticas: EstatisticasSubgrupo
    valores_brutos: list[float]
    limites: LimitesControle | None = None
    fora_de_controle: bool = False
    violacoes: list[ViolacaoRegra] = field(default_factory=list)
    capacidade: IndicesCapacidade | None = None
    event: str = "NOVO_SUBGRUPO_PROCESSADO"

    @classmethod
    def from_domain(
        cls,
        carta: CartaControle,
        subgrupo: Subgrupo,
        capacidade: IndicesCapacidade | None = None,
    ) -> "SubgrupoProcessadoEvent":
        """Constrói o evento a partir das entidades de domínio agregadas."""
        return cls(
            carta_id=carta.id,
            numero_subgrupo=subgrupo.numero_subgrupo,
            timestamp=subgrupo.timestamp or datetime.now(timezone.utc),
            estatisticas=subgrupo.estatisticas,
            valores_brutos=list(subgrupo.valores_brutos),
            limites=carta.limites_atuais,
            fora_de_controle=subgrupo.fora_de_controle,
            violacoes=list(subgrupo.violacoes),
            capacidade=capacidade,
        )

    def to_dict(self) -> dict:
        """Converte o evento para payload estruturado pronto para serialização JSON."""
        limites_dict = None
        if self.limites is not None:
            limites_dict = {
                "lc": round(self.limites.lc, 4),
                "lsc": round(self.limites.lsc, 4),
                "lic": round(self.limites.lic, 4),
            }

        capacidade_dict = None
        if self.capacidade is not None:
            capacidade_dict = {
                "cp": self.capacidade.cp,
                "cpk": self.capacidade.cpk,
            }

        return {
            "event": self.event,
            "carta_id": str(self.carta_id),
            "timestamp": self.timestamp.isoformat(),
            "numero_subgrupo": self.numero_subgrupo,
            "estatisticas": {
                "media_x": round(self.estatisticas.media_x, 4),
                "amplitude_r": round(self.estatisticas.amplitude_r, 4),
                "desvio_s": round(self.estatisticas.desvio_s, 4),
                "amostras_brutas": list(self.valores_brutos),
            },
            "limites": limites_dict,
            "status_controle": {
                "fora_de_controle": self.fora_de_controle,
                "regras_violadas": [v.to_dict() for v in self.violacoes],
            },
            "capacidade": capacidade_dict,
        }
