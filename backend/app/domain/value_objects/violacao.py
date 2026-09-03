from dataclasses import dataclass, field


@dataclass(frozen=True)
class ViolacaoRegra:
    """Objeto de valor imutável representando a ocorrência de uma violação de regra de controle."""

    codigo_regra: str
    descricao: str
    numero_subgrupo: int
    pontos_violadores: tuple[int, ...] = field(default_factory=tuple)

    def to_dict(self) -> dict:
        """Converte a violação para dicionário serializável em JSON."""
        return {
            "codigo_regra": self.codigo_regra,
            "descricao": self.descricao,
            "numero_subgrupo": self.numero_subgrupo,
            "pontos_violadores": list(self.pontos_violadores),
        }
