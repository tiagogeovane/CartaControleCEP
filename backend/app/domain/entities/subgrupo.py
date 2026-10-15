from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import datetime, timezone
from uuid import UUID, uuid4

from app.domain.value_objects.estatisticas import EstatisticasSubgrupo
from app.domain.value_objects.violacao import ViolacaoRegra


@dataclass
class Subgrupo:
    """Entidade que representa um subgrupo amostral coletado em um instante de tempo."""

    carta_id: UUID
    numero_subgrupo: int
    valores_brutos: list[float]
    estatisticas: EstatisticasSubgrupo
    id: UUID = field(default_factory=uuid4)
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    fora_de_controle: bool = False
    violacoes: list[ViolacaoRegra] = field(default_factory=list)

    def __post_init__(self) -> None:
        if self.numero_subgrupo < 1:
            raise ValueError(f"Número do subgrupo deve ser >= 1 (recebido: {self.numero_subgrupo}).")
        if not self.valores_brutos:
            raise ValueError("Subgrupo não pode ter valores brutos vazios.")
        if len(self.violacoes) > 0:
            self.fora_de_controle = True

    def adicionar_violacao(self, violacao: ViolacaoRegra) -> None:
        """Registra uma violação de regra de controle sobre o subgrupo."""
        self.violacoes.append(violacao)
        self.fora_de_controle = True

    def adicionar_violacoes(self, violacoes: list[ViolacaoRegra]) -> None:
        """Registra múltiplas violações identificadas para o subgrupo."""
        if violacoes:
            self.violacoes.extend(violacoes)
            self.fora_de_controle = True

    def limpar_violacoes(self) -> None:
        """Limpa as violações registradas e redefine fora_de_controle para False."""
        self.violacoes = []
        self.fora_de_controle = False

    def definir_violacoes(self, violacoes: Sequence[ViolacaoRegra]) -> None:
        """Substitui integralmente as violações do subgrupo e atualiza fora_de_controle."""
        self.violacoes = list(violacoes)
        self.fora_de_controle = len(self.violacoes) > 0

    def to_dict(self) -> dict:
        """Representação em dicionário serializável."""
        return {
            "id": str(self.id),
            "carta_id": str(self.carta_id),
            "numero_subgrupo": self.numero_subgrupo,
            "timestamp": self.timestamp.isoformat(),
            "valores_brutos": list(self.valores_brutos),
            "media_x": self.estatisticas.media_x,
            "amplitude_r": self.estatisticas.amplitude_r,
            "desvio_s": self.estatisticas.desvio_s,
            "fora_de_controle": self.fora_de_controle,
            "violacoes": [v.to_dict() for v in self.violacoes],
        }
